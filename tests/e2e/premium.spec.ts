import fs from "node:fs";
import { CERTIFICATIONS_LAYOUT } from "../../src/config/layout";
import { contactDetails, personalEmails } from "../../src/lib/privacy";
import { expect, hydrated, test, type Page } from "./fixtures";

const RESUME = "/resume/Aasveer_Singh_AI_ML_Engineer_Resume_v3_fnl.pdf";
const EXPECTED_CREDENTIALS: Record<string, string[]> = {
  "Anthropic Claude Academy": [
    "Claude Code 101",
    "Building with the Claude API",
    "Claude Platform 101",
    "Claude 101",
  ],
  "IBM SkillsBuild": [
    "Introduction to Large Language Models",
    "Machine Learning",
    "AI Practitioner: Ready to Use AI",
  ],
  "Google Cloud Skills Boost": ["Introduction to Generative AI"],
  Cisco: ["Introduction to Modern AI"],
  "Microsoft Learn": [
    "Introduction to Prompt Engineering with GitHub",
    "Azure Database for PostgreSQL: Vector Search",
  ],
  "HP LIFE": ["Critical Thinking in the AI Era"],
};

/** The frame's rotation in degrees about each axis, from its computed transform. */
const tilt = (page: Page) =>
  page.getByTestId("hero-portrait").evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return {
      y: (Math.asin(Math.max(-1, Math.min(1, -m.m13))) * 180) / Math.PI,
      x: (Math.asin(Math.max(-1, Math.min(1, m.m23))) * 180) / Math.PI,
    };
  });

const energy = (page: Page) =>
  page
    .getByTestId("neural-field")
    .evaluate((el) => Number((el as HTMLElement).dataset.energy ?? 0));

const translateX = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);

test.describe("hero portrait", () => {
  test("shows the actual photograph, loaded and described", async ({ page }) => {
    await page.goto("/");
    const image = page.locator("#intro").getByRole("img", { name: "Portrait of Aasveer Singh" });
    await expect(image).toBeVisible();
    const loaded = await image.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    expect(loaded).toBeGreaterThan(0);
  });

  test("serves the approved portrait byte for byte, and no unused copy", async ({ request }) => {
    const served = await request.get("/images/aasveer-portrait-cutout.webp");
    expect(served.status()).toBe(200);
    const approved = fs.readFileSync("public/images/aasveer-portrait-cutout.webp");
    expect(Buffer.compare(await served.body(), approved)).toBe(0);
    for (const unused of ["/images/aasveer-portrait.png", "/image/aasveer-profile.png"]) {
      expect((await request.get(unused)).status(), unused).toBe(404);
    }
  });

  test("is a major anchor: large, on the hero's base line, with the turban in view", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const person = (await page.locator(".hp-person").boundingBox())!;
    expect(person.width).toBeGreaterThan(1440 * 0.4);
    expect(person.height).toBeGreaterThan(900 * 0.7);
    expect(person.y).toBeGreaterThanOrEqual(68); // Below the header, so the turban is uncut.
    const hero = (await page.locator("#intro").boundingBox())!;
    expect(Math.abs(person.y + person.height - (hero.y + hero.height))).toBeLessThan(4);
  });

  test("the photograph itself never tilts, only its frame", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.mouse.move(1260, 110, { steps: 8 });
    await expect.poll(async () => Math.abs((await tilt(page)).y)).toBeGreaterThan(1.5);
    const matrix = await page
      .locator(".hp-person")
      .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform));
    expect(matrix.is2D).toBe(true);
    expect(matrix.b).toBe(0);
    expect(matrix.a).toBe(1);
    expect(Math.abs(matrix.e)).toBeLessThanOrEqual(5.1);
  });

  test("appears once on the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("img", { name: "Portrait of Aasveer Singh" })).toHaveCount(1);
  });

  test("applies no filter or blend to the photograph", async ({ page }) => {
    await page.goto("/");
    const style = await page
      .locator("#intro")
      .getByRole("img", { name: "Portrait of Aasveer Singh" })
      .evaluate((el) => {
        const c = getComputedStyle(el);
        return { filter: c.filter, blend: c.mixBlendMode, opacity: c.opacity };
      });
    expect(style).toEqual({ filter: "none", blend: "normal", opacity: "1" });
  });

  for (const [width, height] of [
    [320, 700],
    [390, 844],
    [768, 1024],
    [1280, 800],
    [1920, 1080],
  ] as const) {
    test(`keeps the whole face in frame at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1800); // The letters overshoot their box while they rise in.
      // Each part of the name stays on one line, beside the portrait.
      const lines = await page.locator(".hero-name .name-line").evaluateAll((els) =>
        els.map((el) => ({
          fits: el.scrollWidth <= el.clientWidth + 1,
          height: el.getBoundingClientRect().height,
          size: parseFloat(getComputedStyle(el).fontSize),
        })),
      );
      expect(lines).toHaveLength(2);
      for (const line of lines) {
        expect(line.fits).toBe(true);
        expect(line.height).toBeLessThan(line.size * 1.5);
      }
      const box = (await page.getByTestId("hero-portrait").boundingBox())!;
      expect(box.width).toBeGreaterThan(90);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("cursor-reactive hero", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
  });

  test("the neural field lights up near the pointer and settles after it leaves", async ({
    page,
  }) => {
    await page.mouse.move(1000, 300);
    await page.mouse.move(1010, 310, { steps: 6 });
    await expect.poll(() => energy(page)).toBeGreaterThan(1);
    await page.mouse.move(640, 30); // Onto the header, which is outside the hero.
    await expect.poll(() => energy(page), { timeout: 8000 }).toBeLessThan(0.5);
  });

  test("the portrait tilts towards the pointer, within restrained limits", async ({ page }) => {
    await page.mouse.move(1260, 110, { steps: 8 });
    await expect.poll(async () => Math.abs((await tilt(page)).y)).toBeGreaterThan(1.5);
    await page.waitForTimeout(900);
    const { x, y } = await tilt(page);
    expect(Math.abs(y)).toBeLessThanOrEqual(6.1);
    expect(Math.abs(x)).toBeLessThanOrEqual(4.6);
  });

  test("the frame returns to rest when the pointer leaves", async ({ page }) => {
    await page.mouse.move(1260, 110, { steps: 8 });
    await expect.poll(async () => Math.abs((await tilt(page)).y)).toBeGreaterThan(1.5);
    await page.mouse.move(640, 30); // Onto the header, which is outside the hero.
    await expect
      .poll(async () => Math.abs((await tilt(page)).y), { timeout: 6000 })
      .toBeLessThan(0.2);
  });

  test("planes move by different amounts, in layers", async ({ page }) => {
    await page.mouse.move(1270, 400, { steps: 8 });
    await page.waitForTimeout(1200);
    const title = await translateX(page, ".hero-title");
    const body = await translateX(page, ".hero-body");
    const grid = await translateX(page, ".hero-depth");
    const person = await translateX(page, ".hp-person");
    const rings = await translateX(page, ".hp-rings");
    expect(Math.abs(title)).toBeGreaterThan(Math.abs(body));
    expect(Math.sign(grid)).toBe(-Math.sign(title));
    expect(Math.sign(rings)).toBe(-Math.sign(person));
    expect(new Set([title, body, grid, person, rings].map((v) => v.toFixed(1))).size).toBe(5);
  });

  test("the light follows the pointer and the system cursor stays", async ({ page }) => {
    await page.mouse.move(700, 300, { steps: 6 });
    await page.waitForTimeout(700);
    const first = await page.getByTestId("hero-light").evaluate((el) => el.style.background);
    await page.mouse.move(300, 500, { steps: 6 });
    await page.waitForTimeout(700);
    const second = await page.getByTestId("hero-light").evaluate((el) => el.style.background);
    expect(second).not.toBe(first);
    const cursor = await page.evaluate(() => getComputedStyle(document.body).cursor);
    expect(cursor).not.toBe("none");
  });

  test("pointer movement causes no React re-render of the hero text", async ({ page }) => {
    const before = await page.locator("#intro-heading").evaluate((el) => {
      (window as unknown as { heading: Element }).heading = el.firstElementChild!;
      return true;
    });
    expect(before).toBe(true);
    await page.mouse.move(800, 200, { steps: 20 });
    const same = await page
      .locator("#intro-heading")
      .evaluate(
        (el) => el.firstElementChild === (window as unknown as { heading: Element }).heading,
      );
    expect(same).toBe(true);
  });

  test("a button leans towards the pointer, stays clickable and settles", async ({ page }) => {
    const button = page.locator("#intro").getByRole("link", { name: /Download resume/ });
    const magnet = button.locator("..");
    const pull = () => magnet.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    await page.waitForTimeout(2000); // Let the entrance finish, so the button's box is final.
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + box.width + 30, box.y + box.height / 2, { steps: 6 });
    await expect.poll(pull).toBeGreaterThan(2);
    expect(await pull()).toBeLessThan(16);
    await page.mouse.move(640, 200, { steps: 4 });
    await expect.poll(async () => Math.abs(await pull())).toBeLessThan(0.5);
    const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test("text stays selectable, and layers never block the pointer", async ({ page }) => {
    const blocked = await page.evaluate(() =>
      [".neural-field", ".hero-depth", ".hero-light"].map(
        (s) => getComputedStyle(document.querySelector(s)!).pointerEvents,
      ),
    );
    expect(blocked).toEqual(["none", "none", "none"]);
    const select = await page
      .locator("#intro-heading")
      .evaluate((el) => getComputedStyle(el).userSelect);
    expect(select).not.toBe("none");
  });

  test("the entrance uses a different movement for each element", async ({ page }) => {
    const names = await page.evaluate(() =>
      [".hero-label", ".hero-letter", ".hero-role", ".hero-intro", ".chip", ".hero-rise"].map(
        (s) => getComputedStyle(document.querySelector(s)!).animationName,
      ),
    );
    expect(new Set(names).size).toBe(6);
    const delays = await page.evaluate(() =>
      [".hero-label", ".hero-role", ".hero-intro", ".chip", ".hero-rise"].map((s) =>
        parseFloat(getComputedStyle(document.querySelector(s)!).animationDelay),
      ),
    );
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
  });

  test("the name keeps its accessible text", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Aasveer Singh" })).toBeVisible();
  });

  test("the surname paints: its gradient text is the element's own text", async ({ page }) => {
    const surname = page.locator(".name-accent");
    await expect(surname).toHaveText("Singh");
    await expect(surname.locator("span")).toHaveCount(0);
    const box = (await surname.boundingBox())!;
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(50);
  });
});

test.describe("neural field stability", () => {
  /** Frame timestamps that lag performance.now(), and a record of every arc drawn. */
  const watchCanvas = (page: Page, lag: number) =>
    page.addInitScript((frameLag) => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (run) => raf((time) => run(time - frameLag));
      const arc = CanvasRenderingContext2D.prototype.arc;
      const stats = { count: 0, bad: 0 };
      (window as unknown as { arcs: typeof stats }).arcs = stats;
      CanvasRenderingContext2D.prototype.arc = function (x, y, radius, ...rest) {
        stats.count++;
        if (![x, y, radius].every(Number.isFinite) || radius < 0) stats.bad++;
        return arc.call(this, x, y, radius, ...rest);
      };
    }, lag);
  const arcs = (page: Page) =>
    page.evaluate(() => (window as unknown as { arcs: { count: number; bad: number } }).arcs);

  for (const lag of [0, 400]) {
    test(`stays valid and keeps animating with frames ${lag}ms behind the clock`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await watchCanvas(page, lag);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/");
      const field = page.getByTestId("neural-field");
      const energy = async () => Number(await field.getAttribute("data-energy"));
      for (let i = 0; i < 24; i++) {
        await page.mouse.move(700 + i * 22, 180 + (i % 6) * 70);
        await page.waitForTimeout(30);
      }
      await expect.poll(energy).toBeGreaterThan(0.5);
      // Away from the hero and back, then the pointer leaves.
      await page.evaluate(() => window.scrollTo(0, 2400));
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.mouse.move(1000, 300, { steps: 5 });
      await expect.poll(energy).toBeGreaterThan(0.5);
      await page.mouse.move(2, 2, { steps: 3 });
      const { count, bad } = await arcs(page);
      expect(count).toBeGreaterThan(100);
      expect(bad).toBe(0);
      expect(errors).toEqual([]);
    });
  }
});

test.describe("hero without a mouse", () => {
  test("touch devices get a static hero with no pointer effects", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto("/");
    await hydrated(page);
    await page.touchscreen.tap(200, 300);
    await page.waitForTimeout(400);
    await expect(page.getByTestId("hero-light")).toHaveCount(0);
    expect(await page.getByTestId("hero-portrait").evaluate((el) => el.style.transform)).toBe("");
    await expect(page.getByTestId("neural-field")).toBeVisible();
    await context.close();
  });

  test("reduced motion keeps everything, at rest", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto("/");
    await hydrated(page);
    await page.mouse.move(1200, 200, { steps: 8 });
    await page.waitForTimeout(500);
    await expect(page.getByTestId("hero-light")).toHaveCount(0);
    expect(await page.getByTestId("hero-portrait").evaluate((el) => el.style.transform)).toBe("");
    await expect(
      page.getByRole("img", { name: "Portrait of Aasveer Singh" }).first(),
    ).toBeVisible();
    await expect(
      page.locator("#intro").getByRole("link", { name: /Download resume/ }),
    ).toBeVisible();
    await expect(
      page.locator(
        CERTIFICATIONS_LAYOUT === "classic"
          ? "[data-testid=vault-group] li"
          : "[data-testid=orbit-card]",
      ),
    ).toHaveCount(12);
    await expect(page.locator("#contact").getByRole("link", { name: /GitHub/ })).toBeVisible();
    await context.close();
  });

  test("the keyboard reaches the three hero actions in order", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const hero = page.locator("#intro");
    await hero.getByRole("link", { name: /Download resume/ }).focus();
    await expect(hero.getByRole("link", { name: /Download resume/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(hero.getByRole("link", { name: /GitHub/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(hero.getByRole("link", { name: /LinkedIn/ })).toBeFocused();
  });
});

test.describe("academic record", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#education-certifications");
  });

  test("identifies the section and shows the degree as the primary record", async ({ page }) => {
    const section = page.locator("#education-certifications");
    await expect(section).toContainText("Academic record // Education");
    await expect(page.getByTestId("education-entry")).toHaveText(
      "B.Tech, Computer Science & Engineering (AI/ML), Amritsar Group of Colleges, 2023–2027",
    );
  });

  test("shows earlier education from the resume, with no grades", async ({ page }) => {
    const history = page.getByTestId("earlier-education");
    await expect(history.locator("li")).toHaveCount(2);
    await expect(history).toContainText("Shri Guru Harkishan Sen. Sec. School");
    await expect(history).toContainText("2023");
    await expect(history).toContainText("Shri Guru Harkishan Public School");
    await expect(history).toContainText("2021");
    const text =
      (await history.innerText()) + (await page.getByTestId("education-entry").innerText());
    expect(text).not.toMatch(/%|CGPA|GPA|grade|marks/i);
  });
});

test.describe("credential archive", () => {
  // The classic layout. tests/e2e/orbit.spec.ts covers the Credential Orbit.
  test.skip(CERTIFICATIONS_LAYOUT !== "classic", "the classic certifications layout is not active");
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#education-certifications");
  });

  const courses = (page: Page) => page.locator("[data-testid=vault-group] .cert-course");

  test("the default view shows all twelve, grouped by the correct issuer", async ({ page }) => {
    await expect(page.getByTestId("credential-archive")).toContainText(
      "Credential archive // Certifications",
    );
    await expect(page.getByTestId("vault-status")).toHaveText("Showing 12 of 12 credentials");
    await expect(courses(page)).toHaveCount(12);
    for (const [issuer, expected] of Object.entries(EXPECTED_CREDENTIALS)) {
      const group = page.getByTestId("vault-group").filter({ hasText: issuer }).first();
      const shown = await group.locator(".cert-course").allInnerTexts();
      expect(shown.sort(), issuer).toEqual([...expected].sort());
    }
  });

  test("selecting an issuer reveals only its records, and All restores them", async ({ page }) => {
    await page.getByTestId("vault-filter").filter({ hasText: "IBM SkillsBuild" }).click();
    await expect(page.getByTestId("vault-status")).toHaveText("Showing 3 of 12 credentials");
    await expect(courses(page)).toHaveCount(3);
    await page.getByTestId("vault-filter-all").click();
    await expect(courses(page)).toHaveCount(12);
  });

  test("an issuer group collapses and expands from the keyboard", async ({ page }) => {
    const group = page.getByTestId("vault-group").first();
    await group.getByTestId("vault-group-toggle").focus();
    await page.keyboard.press("Enter");
    await expect(group.locator(".cert-course")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(group.locator(".cert-course").first()).toBeVisible();
  });

  test("selecting a record shows its details beside the list", async ({ page }) => {
    const detail = page.getByTestId("credential-detail");
    await expect(detail).toContainText("Claude Code 101");
    await page.getByRole("button", { name: /Azure Database for PostgreSQL/ }).click();
    await expect(detail).toContainText("Azure Database for PostgreSQL: Vector Search");
    await expect(detail).toContainText("Microsoft Learn");
  });

  test("invents no dates, IDs, seals or verification links", async ({ page }) => {
    const archive = page.getByTestId("credential-archive");
    await expect(archive.getByRole("link")).toHaveCount(0);
    await expect(archive).not.toContainText("Completed");
    expect(await archive.innerText()).not.toMatch(/verified|credential id|\b20\d\d\b/i);
  });

  test("works by touch on a phone, with everything reachable", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 700 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto("/#education-certifications");
    await hydrated(page);
    await expect(courses(page)).toHaveCount(12);
    await page.getByTestId("vault-filter").filter({ hasText: "Cisco" }).tap();
    await expect(courses(page)).toHaveText(["Introduction to Modern AI"]);
    const detail = page.getByTestId("credential-detail");
    await expect(detail).toContainText("Cisco");
    await page.getByTestId("vault-record").tap();
    await expect(detail).toHaveCount(0);
    await page.getByTestId("vault-filter-all").tap();
    await expect(courses(page)).toHaveCount(12);
    await context.close();
  });
});

test.describe("open channel", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#contact");
  });

  test("states its identity, heading and invitation", async ({ page }) => {
    const contact = page.locator("#contact");
    await expect(contact).toContainText("Open channel // Establish connection");
    await expect(contact.getByRole("heading", { level: 2 })).toHaveText(
      "Let's start a conversation.",
    );
    await expect(contact).toContainText(
      "Have a project in mind, an opportunity to discuss or a technical question? Send me a message.",
    );
  });

  test("GitHub and LinkedIn are linked, and no email address is shown", async ({ page }) => {
    const contact = page.locator("#contact");
    expect(personalEmails(await contact.innerText())).toEqual([]);
    await expect(contact.locator("a[href^='mailto:']")).toHaveCount(0);
    const github = contact.getByRole("link", { name: /GitHub/ });
    await expect(github).toHaveAttribute("href", "https://github.com/singhaasveer-lab");
    await expect(github).toHaveAttribute("target", "_blank");
    const linkedin = contact.getByRole("link", { name: /LinkedIn/ });
    await expect(linkedin).toHaveAttribute("href", "https://linkedin.com/in/aasveer-singh");
    await expect(linkedin).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("channels have a visible focus state and comfortable size", async ({ page }) => {
    const link = page.locator("#contact").getByRole("link", { name: /GitHub/ });
    await link.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const outline = await link.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test("the form validates each field with a clear message", async ({ page }) => {
    const form = page.getByTestId("contact-form");
    await hydrated(page);
    await form.getByTestId("contact-submit").click();
    await expect(form.getByTestId("contact-error-name")).toHaveText("Enter your full name.");
    await expect(form.getByTestId("contact-error-email")).toHaveText("Enter your email address.");
    await expect(form.getByTestId("contact-error-message")).toHaveText("Enter a message.");
    await expect(form.getByLabel("Full name")).toBeFocused();
    await expect(form.getByLabel("Full name")).toHaveAttribute("aria-invalid", "true");
    await form.getByLabel("Full name").fill("Ada Lovelace");
    await form.getByLabel("Email address").fill("ada@");
    await form.getByLabel("Email address").blur();
    await expect(form.getByTestId("contact-error-name")).toHaveCount(0);
    await expect(form.getByTestId("contact-error-email")).toContainText("valid email address");
  });

  test("with a configured endpoint, a failed send keeps the message and claims nothing", async ({
    page,
  }) => {
    const form = page.getByTestId("contact-form");
    await hydrated(page);
    const endpoint = await form.getAttribute("action");
    test.skip(!endpoint, "this build has no contact endpoint");
    // The request never leaves the browser: no message is sent and no response is invented.
    await page.route(endpoint!, (route) => route.abort("internetdisconnected"));
    await form.getByLabel("Full name").fill("Ada Lovelace");
    await form.getByLabel("Email address").fill("ada@example.com");
    await form.getByLabel("Your message").fill("Hello");
    await form.getByTestId("contact-submit").click();
    await expect(form.getByTestId("contact-failure")).toContainText("could not be sent");
    await expect(page.getByTestId("contact-success")).toHaveCount(0);
    await expect(form.getByLabel("Your message")).toHaveValue("Hello");
  });

  test("without a configured endpoint it never claims a message was sent", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => r.method() === "POST" && requests.push(r.url()));
    const form = page.getByTestId("contact-form");
    await hydrated(page);
    test.skip(!!(await form.getAttribute("action")), "this build has a contact endpoint");
    await expect(form.getByTestId("contact-unconfigured")).toBeVisible();
    await form.getByLabel("Full name").fill("Ada Lovelace");
    await form.getByLabel("Email address").fill("ada@example.com");
    await form.getByLabel("Your message").fill("Hello");
    await form.getByTestId("contact-submit").click();
    await expect(form.getByRole("alert")).toContainText("not sent");
    await expect(page.getByTestId("contact-success")).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("the form works from the keyboard alone", async ({ page }) => {
    const form = page.getByTestId("contact-form");
    await hydrated(page);
    await form.getByLabel("Full name").focus();
    await page.keyboard.type("Ada");
    await page.keyboard.press("Tab");
    await expect(form.getByLabel("Email address")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(form.getByLabel("Your message")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(form.getByTestId("contact-submit")).toBeFocused();
    const outline = await form
      .getByTestId("contact-submit")
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(form.getByTestId("contact-error-email")).toBeVisible();
  });

  test("shows no availability claims or phone number", async ({ page }) => {
    const text = await page.locator("#contact").innerText();
    expect(text).not.toMatch(/online|available now|response time/i);
    expect(contactDetails(text)).toEqual([]);
  });
});

test.describe("project visuals", () => {
  const CARDS = [
    "InterviewIQ",
    "Wingman AI",
    "GiftBro AI",
    "StudyForge AI",
    "SmartQueue AI",
    "PennyBloom",
  ];

  test("each of the six shows a loaded visual and its pipeline", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#projects");
    for (const name of CARDS) {
      await page.getByRole("button", { name: `Read case study: ${name}` }).click();
      const card = page.getByTestId("case-dialog").and(page.locator("[open]"));
      await expect(card.getByTestId("project-flow").locator("li").first()).toBeVisible();
      const image = card.locator(".case-shot img");
      await expect
        .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
      await expect(image).toHaveAttribute("alt", new RegExp(name.split(" ")[0]!));
      await page.keyboard.press("Escape");
      await expect(card).toHaveCount(0);
    }
  });

  for (const width of [320, 768, 1280]) {
    test(`illustrations stay inside their cards at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/#projects");
      const fits = await page
        .locator(".case-thumb")
        .evaluateAll((els) => els.every((el) => el.scrollWidth <= el.clientWidth + 1));
      expect(fits).toBe(true);
    });
  }
});

test.describe("resume", () => {
  test("the URL serves the exact approved PDF", async ({ request }) => {
    const served = await request.get(RESUME);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toContain("application/pdf");
    // The approved resume is the one published in public/resume; the build copies it unchanged.
    const approved = fs.readFileSync(`public${RESUME}`);
    expect(Buffer.compare(await served.body(), approved)).toBe(0);
  });

  for (const [where, selector, name] of [["Hero", "#intro", /Download resume/]] as const) {
    test(`the ${where} button downloads it`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/");
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.locator(selector).getByRole("link", { name }).click(),
      ]);
      expect(download.suggestedFilename()).toBe("Aasveer_Singh_AI_ML_Engineer_Resume_v3_fnl.pdf");
    });
  }
});

test.describe("case study dialog", () => {
  const study = (page: Page) => page.getByTestId("case-dialog").and(page.locator("[open]"));
  const open = async (page: Page, name: string) => {
    await page.getByRole("button", { name: `Read case study: ${name}` }).click();
    await expect(study(page).getByRole("heading", { level: 2, name })).toBeVisible();
  };

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#projects");
  });

  test("follows the new order, with the case numbers to match", async ({ page }) => {
    await expect(page.getByTestId("project-card").locator("h3")).toHaveText([
      "StudyForge AI",
      "PennyBloom",
      "InterviewIQ",
      "Wingman AI",
      "GiftBro AI",
      "SmartQueue AI",
    ]);
    await expect(page.getByTestId("project-card").first()).toContainText("Case file 01 / 06");
    await expect(page.getByTestId("project-card").first()).toHaveAttribute(
      "data-layout",
      "featured",
    );
  });

  test("is a real modal: named, focus inside, the page inert", async ({ page }) => {
    await open(page, "StudyForge AI");
    await expect(page.getByRole("dialog", { name: "StudyForge AI" })).toBeVisible();
    await expect(page.getByTestId("case-dialog-close").locator("visible=true")).toBeFocused();
    expect(await study(page).evaluate((el) => el.matches(":modal"))).toBe(true);
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => {
        const active = document.activeElement;
        return active === document.body || !!active?.closest("dialog[open]");
      });
      expect(inside).toBe(true);
    }
  });

  test("shows the full case study, with the approved contribution", async ({ page }) => {
    await open(page, "StudyForge AI");
    await expect(study(page)).toContainText("Approach");
    await expect(study(page).getByTestId("project-role")).toContainText(
      "RAG, study planning, quizzes, NLP, FastAPI, and SQLite.",
    );
    await expect(
      study(page).getByRole("button", { name: "Explore architecture of StudyForge AI" }),
    ).toBeVisible();
  });

  test("shows no highlights or walkthrough, because none are set", async ({ page }) => {
    await open(page, "PennyBloom");
    await expect(study(page).getByTestId("project-highlights")).toHaveCount(0);
    await expect(study(page).getByTestId("project-walkthrough")).toHaveCount(0);
  });

  for (const [how, close] of [
    ["Escape", (page: Page) => page.keyboard.press("Escape")],
    ["the close button", (page: Page) => study(page).getByTestId("case-dialog-close").click()],
    ["the scrim", (page: Page) => page.mouse.click(8, 400)],
  ] as const) {
    test(`${how} closes it and returns focus to the card`, async ({ page }) => {
      await open(page, "PennyBloom");
      await close(page);
      await expect(study(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Read case study: PennyBloom" })).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.className)).not.toContain(
        "overlay-open",
      );
    });
  }

  test("clicking the card opens it, and the keyboard opens it", async ({ page }) => {
    const card = page.getByRole("article", { name: "InterviewIQ" });
    await card.locator(".case-problem").click();
    await expect(study(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(study(page)).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(study(page)).toBeVisible();
  });

  test("opens and closes under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await open(page, "GiftBro AI");
    await page.keyboard.press("Escape");
    await expect(study(page)).toHaveCount(0);
  });

  test("fits a phone", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 640 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto("/#projects");
    await hydrated(page);
    await page.getByRole("button", { name: "Read case study: Wingman AI" }).tap();
    await expect(study(page)).toBeVisible();
    await page.waitForTimeout(700);
    const box = (await page.locator("dialog[open] .case-dialog-panel").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(box.y + box.height).toBeLessThanOrEqual(640);
    await context.close();
  });

  test("every detail is reachable without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/#projects");
    const card = page.getByRole("article", { name: "StudyForge AI" });
    // Playwright's text and role locators skip <noscript>, so the rendered text is read directly.
    const text = await card.innerText();
    expect(text).toContain("APPROACH");
    expect(text).toContain("RAG, study planning, quizzes, NLP, FastAPI, and SQLite.");
    expect(text).toContain("StudyForge AI repository");
    expect(await card.locator("noscript a").first().isVisible()).toBe(true);
    await expect(page.locator(".case-open").first()).toBeHidden();
    await context.close();
  });
});

test.describe("motion accents", () => {
  test("the stat strip counts up to numbers taken from the data", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const strip = page.getByTestId("stat-strip");
    await strip.scrollIntoViewIfNeeded();
    const links = JSON.parse(fs.readFileSync("content/skill-map.json", "utf8")) as {
      edges: unknown[];
    };
    const expected = ["6+", "12+", `${links.edges.length}+`];
    await expect(strip.locator("dd .sr-only")).toHaveText(expected);
    await expect(strip.locator('dd [aria-hidden="true"]')).toHaveText(expected, { timeout: 6000 });
  });

  test("the stat strip shows its real numbers without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    await expect(
      page.getByTestId("stat-strip").locator('dd [aria-hidden="true"]').first(),
    ).toHaveText("6+");
    await context.close();
  });

  test("a kicker settles on its real text and never changes length", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#projects");
    const kicker = page.locator("#projects header").getByText("Projects / case files");
    await expect(kicker).toBeVisible({ timeout: 4000 });
  });

  test("under reduced motion every accent is off", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#ai-lab");
    await page.waitForTimeout(500);
    await expect(page.locator(".lab-node [style*='offset-path']")).toHaveCount(0);
    await expect(page.locator(".bg-clip-text")).toHaveCount(0);
    await expect(page.getByTestId("lab-trace")).toContainText("Trace the signal");
    await page.goto("/#contact");
    await page.waitForTimeout(500);
    await expect(page.locator(".resume-cta [style*='offset-path']")).toHaveCount(0);
    await page.goto("/#projects");
    await page.waitForTimeout(400);
    const transform = await page
      .locator(".case-thumb")
      .first()
      .evaluate((el) => getComputedStyle(el).transform);
    expect(transform).toBe("none");
  });

  test("the active Laboratory stage carries a border trail", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#ai-lab");
    const stage = page.locator('.lab-node[aria-current="step"]');
    await stage.scrollIntoViewIfNeeded();
    await expect(stage.locator("[style*='offset-path']")).toHaveCount(1);
  });

  test("screenshots tilt slightly for a mouse, and return to rest", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#projects");
    const thumb = page.getByRole("article", { name: "PennyBloom" }).locator(".case-thumb");
    await thumb.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const box = (await thumb.boundingBox())!;
    await page.mouse.move(box.x + box.width - 10, box.y + 10, { steps: 6 });
    await expect
      .poll(() => thumb.evaluate((el) => (el as HTMLElement).style.transform))
      .toMatch(/rotateX\((?!0deg)/);
    const angle = await thumb.evaluate((el) =>
      Math.abs(parseFloat(/rotateY\((-?[\d.]+)deg/.exec((el as HTMLElement).style.transform)![1]!)),
    );
    expect(angle).toBeLessThanOrEqual(3.2);
  });

  test("the header blur appears only after scrolling, clear of the portrait", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.locator(".header-blur")).toHaveCount(0);
    const height = (await page.locator(".site-header").boundingBox())!.height;
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(page.locator(".header-blur")).toHaveCount(1);
    // It hangs below the header: the sticky header itself never grows.
    const header = (await page.locator(".site-header").boundingBox())!;
    expect(header.height).toBe(height);
    const blur = (await page.locator(".header-blur").boundingBox())!;
    expect(blur.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator(".header-blur")).toHaveCount(0);
  });

  test("the shimmering labels stay readable", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#ai-lab");
    await page.getByTestId("lab-trace").scrollIntoViewIfNeeded();
    const label = page.getByTestId("lab-trace").locator(".bg-clip-text");
    await expect(label).toHaveText("Trace the signal");
    const base = await label.evaluate((el) => {
      const probe = document.createElement("span");
      probe.style.color = getComputedStyle(el).getPropertyValue("--base-color");
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    expect(base).not.toBe("rgba(0, 0, 0, 0)");
  });
});
