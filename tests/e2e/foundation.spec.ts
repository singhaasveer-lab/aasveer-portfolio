import { CERTIFICATIONS_LAYOUT } from "../../src/config/layout";
import { expect, hydrated, test, type Page } from "./fixtures";

const WIDTHS = [320, 390, 768, 1280];

const activeId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? "");

test.describe("page foundation", () => {
  test("has exactly one h1 with the owner's name, and sections in page order", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("Aasveer Singh");
    const order = await page.locator("main > section").evaluateAll((els) => els.map((e) => e.id));
    expect(order).toEqual([
      "intro",
      "about",
      "evidence",
      "projects",
      "skills",
      "casebook",
      "ai-lab",
      "education-certifications",
      "contact",
    ]);
    // Exactly one footer, rendered after main.
    await expect(page.locator("footer")).toHaveCount(1);
    expect(await page.evaluate(() => document.querySelector("main + footer") !== null)).toBe(true);
  });

  test("headings follow a logical level order", async ({ page }) => {
    await page.goto("/");
    const levels = await page
      .locator("h1, h2, h3, h4, h5, h6")
      .evaluateAll((els) => els.map((e) => Number(e.tagName[1])));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++)
      expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
  });

  test("the skip link is the first Tab stop, visible on focus, and moves focus to main", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    const box = await skip.boundingBox();
    expect(box!.width).toBeGreaterThan(40);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Enter");
    expect(await activeId(page)).toBe("main-content");
  });

  test("makes no request to /api/ while loading the page", async ({ page }) => {
    const apiRequests: string[] = [];
    page.on("request", (r) => {
      if (new URL(r.url()).pathname.startsWith("/api/")) apiRequests.push(r.url());
    });
    await page.goto("/", { waitUntil: "networkidle" });
    expect(apiRequests).toEqual([]);
  });

  test("loads without console errors or third-party requests", async ({ page, baseURL }) => {
    const errors: string[] = [];
    const external: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (!r.url().startsWith(baseURL!) && !r.url().startsWith("data:")) external.push(r.url());
    });
    await page.goto("/", { waitUntil: "networkidle" });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
});

test.describe("hero fits the first screen", () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    test(`at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      const hero = page.locator("#intro");
      const targets = [
        hero.locator("h1"),
        hero.locator(".hero-role"),
        hero.getByText(/B\.Tech CSE \(AI\/ML\) student/i),
        hero.getByText(/Building end-to-end AI applications/),
        hero.locator(".chip").last(),
        hero.getByText("Amritsar, Punjab, India"),
        hero.getByRole("link", { name: /Download resume/ }),
        hero.getByRole("link", { name: /GitHub/ }),
        hero.getByRole("link", { name: /LinkedIn/ }),
      ];
      for (const t of targets) {
        await expect(t).toBeVisible();
        const box = (await t.boundingBox())!;
        expect(box.y + box.height, await t.innerText()).toBeLessThanOrEqual(viewport.height);
        expect(box.y).toBeGreaterThanOrEqual(0);
      }
      await expect(hero.locator(".chip")).toHaveText([
        "Generative AI",
        "Large Language Models",
        "RAG",
        "NLP",
        "Machine Learning",
        "Recommendation Systems",
      ]);
    });
  }
});

test.describe("navigation", () => {
  test("desktop section links scroll to the section and focus its heading", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary", exact: true });
    for (const [label, heading] of [
      ["About", "about-heading"],
      ["Evidence", "evidence-heading"],
      ["Skills", "skills-heading"],
      ["Casebook", "casebook-heading"],
      ["AI Lab", "ai-lab-heading"],
      ["Education", "education-heading"],
      ["Projects", "projects-heading"],
      ["Contact", "contact-heading"],
    ] as const) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect.poll(() => activeId(page)).toBe(heading);
      await expect(page.locator(`#${heading}`)).toBeInViewport();
    }
  });

  test("hero actions: the resume downloads, and GitHub and LinkedIn open in a new tab", async ({
    page,
  }) => {
    await page.goto("/");
    const hero = page.locator("#intro");
    await expect(hero.getByRole("link", { name: /View projects/i })).toHaveCount(0);
    const actions = hero.getByTestId("hero-actions").getByRole("link");
    await expect(actions).toHaveCount(3);
    const resume = actions.nth(0);
    await expect(resume).toHaveAccessibleName(/Download resume/);
    await expect(resume).toHaveClass(/btn-primary/);
    await expect(resume).toHaveAttribute(
      "href",
      "/resume/Aasveer_Singh_AI_ML_Engineer_Resume_v3_fnl.pdf",
    );
    await expect(resume).toHaveAttribute("download", "");
    const [download] = await Promise.all([page.waitForEvent("download"), resume.click()]);
    expect(download.suggestedFilename()).toBe("Aasveer_Singh_AI_ML_Engineer_Resume_v3_fnl.pdf");
    for (const [i, name, href] of [
      [1, /GitHub profile \(opens in a new tab\)/, "https://github.com/singhaasveer-lab"],
      [2, /LinkedIn profile \(opens in a new tab\)/, "https://linkedin.com/in/aasveer-singh"],
    ] as const) {
      const link = actions.nth(i);
      await expect(link).toHaveAccessibleName(name);
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  const scene = (page: Page) =>
    page.getByTestId("scene-rail").getAttribute("data-active-scene", { timeout: 5000 });
  const current = (page: Page) =>
    page
      .getByRole("navigation", { name: "Primary", exact: true })
      .locator("[aria-current=location]")
      .textContent();

  test("loading /#projects shows the Projects section and both indicators say Projects", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#projects");
    await expect(page.locator("#projects-heading")).toBeInViewport();
    await expect.poll(() => scene(page)).toBe("projects");
    await expect(page.getByTestId("scene-rail")).toContainText(/projects/i);
    await expect.poll(() => current(page)).toMatch(/Projects/);
  });

  test("a reload of /#projects after reading elsewhere still lands on Projects", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.evaluate(() => history.replaceState(null, "", "/#projects"));
    await page.reload();
    await expect(page.locator("#projects-heading")).toBeInViewport();
    await expect.poll(() => scene(page)).toBe("projects");
  });

  test("every nav link, manual scrolling and back/forward keep the indicators in step", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect.poll(() => scene(page)).toBe("intro");
    const nav = page.getByRole("navigation", { name: "Primary", exact: true });
    for (const [label, id] of [
      ["About", "about"],
      ["Evidence", "evidence"],
      ["Projects", "projects"],
      ["Skills", "skills"],
      ["Casebook", "casebook"],
      ["AI Lab", "ai-lab"],
      ["Education", "education-certifications"],
      ["Contact", "contact"],
    ] as const) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect.poll(() => scene(page)).toBe(id);
      await expect.poll(() => current(page)).toContain(label);
    }
    await page.goBack();
    await expect(page).toHaveURL(/#education-certifications$/);
    await expect.poll(() => scene(page)).toBe("education-certifications");
    await page.goForward();
    await expect.poll(() => scene(page)).toBe("contact");
    // Manual scrolling back to the top.
    await page.mouse.wheel(0, -100000);
    await expect.poll(() => scene(page)).toBe("intro");
  });

  test("mobile menu is a real disclosure: Enter/Space toggle, Escape closes and returns focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const button = page.getByRole("button", { name: "Menu" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    const panelId = await button.getAttribute("aria-controls");
    const panel = page.locator(`[id="${panelId}"]`);
    await expect(panel).toBeHidden();
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
    // Accessible names: the decorative index numbers are aria-hidden.
    const names = [
      "About",
      "Evidence",
      "Projects",
      "Skills",
      "Casebook",
      "AI Lab",
      "Education",
      "Contact",
    ];
    for (const [i, name] of names.entries()) {
      await expect(panel.getByRole("link").nth(i)).toHaveAccessibleName(name);
    }

    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();

    await page.keyboard.press("Space");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Space");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("choosing a mobile menu link closes the panel and focuses the section heading", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const button = page.getByRole("button", { name: "Menu" });
    await button.click();
    const panel = page.locator(`[id="${await button.getAttribute("aria-controls")}"]`);
    await panel.getByRole("link", { name: "Projects" }).click();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => activeId(page)).toBe("projects-heading");
  });

  test("the mobile panel closes when the viewport widens to desktop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const button = page.getByRole("button", { name: "Menu" });
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(button).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("keyboard and focus", () => {
  test("every interactive element is reachable by Tab, in page order, with a visible focus indicator", async ({
    page,
  }) => {
    test.slow(); // It presses Tab once for every control on the page.
    await page.setViewportSize({ width: 1280, height: 800 });
    // Snapshot after hydration: the hero actions are re-wrapped for fine pointers once it ends.
    await page.goto("/", { waitUntil: "networkidle" });
    const expected = await page
      .locator("a[href], button:visible, summary, input:visible, textarea:visible")
      .evaluateAll((els) =>
        els
          // Roving tabindex: only the selected Laboratory tab is a Tab stop.
          .filter((e) => !e.matches('[tabindex="-1"]'))
          // A closed disclosure's content is not a Tab stop; its summary is.
          .filter((e) => {
            const closed = e.closest("details:not([open])");
            return !closed || (e.tagName === "SUMMARY" && e.parentElement === closed);
          })
          .filter(
            (e) => (e as HTMLElement).offsetParent !== null || e.matches(".sr-only-focusable"),
          )
          // Moving elements (the Credential Orbit) rewrite their style; compare without it.
          .map((e) => e.outerHTML.replace(/ style="[^"]*"/, "").slice(0, 80)),
      );
    const visited: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const cs = getComputedStyle(el);
        return {
          html: el.outerHTML.replace(/ style="[^"]*"/, "").slice(0, 80),
          outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2,
        };
      });
      expect(info.outline, `focus indicator on ${info.html}`).toBe(true);
      visited.push(info.html);
    }
    expect(visited).toEqual(expected);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("removes the hero entrance and all transitions, keeping content identical", async ({
    page,
  }) => {
    await page.goto("/");
    const h1 = page.locator("h1");
    expect(await h1.evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
    expect(await h1.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
    const animated = await page.evaluate(
      () =>
        [...document.querySelectorAll("*")].filter((e) => {
          const cs = getComputedStyle(e);
          return (
            cs.animationName !== "none" ||
            cs.transitionDuration.split(",").some((d) => parseFloat(d) > 0)
          );
        }).length,
    );
    expect(animated).toBe(0);
    await expect(page.locator(".btn-primary").first()).toBeVisible();
  });

  test("shows the same text as the default motion setting", async ({ browser }) => {
    const reduced = await browser.newPage({ reducedMotion: "reduce" });
    const normal = await browser.newPage({ reducedMotion: "no-preference" });
    await reduced.goto("/");
    await normal.goto("/");
    // Compare once both pages have hydrated, or React restores what is removed below.
    await hydrated(reduced);
    await hydrated(normal);
    // Moving copies are decorative, and may be caught part-way: the hero loop's static line and
    // the stat strip's real numbers are the content, and must match.
    for (const page of [reduced, normal]) {
      await page
        .locator('.hero-loop-live, .stat-strip dd [aria-hidden="true"], [data-testid=orbit-pause]')
        .evaluateAll((els) => els.forEach((el) => el.remove()));
    }
    expect(await reduced.locator("body").innerText()).toBe(
      await normal.locator("body").innerText(),
    );
    await reduced.close();
    await normal.close();
  });
});

test.describe("responsive layout", () => {
  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      // Content sliding in from the side must never widen the page at any point of the scroll.
      // The walk visits the whole page, which takes a while now it has eight sections.
      test.slow();
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += 500) {
        await page.evaluate((v) => window.scrollTo(0, v), y);
        await page.waitForTimeout(40);
        const w = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(w, `scroll width at y=${y}`).toBeLessThanOrEqual(clientWidth);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      // Scroll scenes park content that has not arrived yet off to one side (clipped, so it adds
      // no scroll width, as checked above). Measure the layout itself, at rest.
      await page.addStyleTag({ content: '[style*="transform"]{transform:none!important}' });
      const wide = await page.evaluate(
        (w) =>
          [...document.querySelectorAll("main *, header *, footer *")]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.width > 0 && r.right > w + 1 && !e.closest("[aria-hidden=true]");
            })
            .map((e) => e.outerHTML.slice(0, 60)),
        width,
      );
      expect(wide).toEqual([]);
    });
  }

  test("body text is at least 16px on phone widths and touch targets are at least 44px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    expect(
      await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    const small = await page
      .locator("a[href]:visible, button:visible, summary:visible")
      .evaluateAll((els) =>
        els
          .filter((e) => !e.matches(".sr-only-focusable"))
          .map((e) => ({ html: e.outerHTML.slice(0, 60), r: e.getBoundingClientRect() }))
          .filter(({ r }) => r.height < 44 || r.width < 44)
          .map(({ html, r }) => `${html} ${Math.round(r.width)}x${Math.round(r.height)}`),
      );
    expect(small).toEqual([]);
  });
});

test.describe("direct section URLs and content visibility", () => {
  for (const [hash, heading] of [
    ["skills", "skills-heading"],
    ["education-certifications", "education-heading"],
    ["projects", "projects-heading"],
    ["contact", "contact-heading"],
  ] as const) {
    test(`loading /#${hash} lands on that section, below the sticky header`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/#${hash}`);
      const header = page.locator("header.site-header");
      // The section heading must be in the viewport and not hidden under the header.
      await expect
        .poll(async () => {
          const h = (await page.locator(`#${heading}`).boundingBox())!;
          const bar = (await header.boundingBox())!;
          return h.y >= bar.y + bar.height && h.y < 800;
        })
        .toBe(true);
      // Contact is the last section, so the page can only scroll as far as its bottom.
      if (hash !== "contact") {
        const top = (await page.locator(`#${hash}`).boundingBox())!.y;
        expect(top).toBeLessThan(160);
      }
    });
  }

  test("no text stays invisible after scrolling through the page", async ({ page }) => {
    test.slow(); // It walks the whole page.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const height = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y <= height; y += 400) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1500);
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll("main *")]
        .filter((e) => e.closest("details:not([open])") === null)
        // Elements whose own CSS entrance is still pending are excluded: headless Chromium
        // only advances CSS animations when a frame is produced. What must never happen is
        // content held at opacity 0 by script state (Motion inline styles).
        .filter((e) => e.getAnimations().length === 0)
        .filter((e) => (e.textContent ?? "").trim() !== "" && getComputedStyle(e).opacity === "0")
        .map((e) => e.outerHTML.slice(0, 80)),
    );
    expect(hidden).toEqual([]);
  });

  test("every section's content is visible without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    const invisible = await page.evaluate(() =>
      [...document.querySelectorAll("main *")]
        .filter((e) => e.closest("details:not([open])") === null)
        // Elements whose own CSS entrance is still pending are excluded: headless Chromium
        // only advances CSS animations when a frame is produced. What must never happen is
        // content held at opacity 0 by script state (Motion inline styles).
        .filter((e) => e.getAnimations().length === 0)
        .filter((e) => (e.textContent ?? "").trim() !== "" && getComputedStyle(e).opacity === "0")
        .map((e) => e.outerHTML.slice(0, 80)),
    );
    expect(invisible).toEqual([]);
    await expect(
      page.locator(
        CERTIFICATIONS_LAYOUT === "classic"
          ? "[data-testid=vault-group] li"
          : "[data-testid=orbit-card]",
      ),
    ).toHaveCount(12);
    await expect(page.locator("#skills h3")).toHaveCount(8);
    await context.close();
  });
});

test.describe("scroll scenes", () => {
  /** The live inline transform and opacity of a scene's moving layer. */
  const state = (page: Page, variant: string) =>
    page.evaluate((v) => {
      const layer = document.querySelector(`[data-scene="${v}"]`)!.firstElementChild as HTMLElement;
      return { transform: layer.style.transform, opacity: Number(getComputedStyle(layer).opacity) };
    }, variant);
  const settle = (page: Page) => page.waitForTimeout(900);

  test("transitions follow the scroll position forward and back", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/", { waitUntil: "networkidle" });
    await settle(page);
    const heroAtTop = await state(page, "hero");

    // Scrolling down: the hero recedes while the next scene is still on its way in.
    await page.evaluate(() => window.scrollTo(0, 420));
    await settle(page);
    const heroLeaving = await state(page, "hero");
    expect(heroLeaving.opacity).toBeLessThan(heroAtTop.opacity);
    expect(heroLeaving.transform).not.toBe(heroAtTop.transform);

    // A scene below the fold is parked part-way, then settles as it arrives.
    const skillsTop = await page.evaluate(
      () => document.getElementById("skills")!.getBoundingClientRect().top + window.scrollY,
    );
    await page.evaluate((y) => window.scrollTo(0, y - 760), skillsTop);
    await settle(page);
    const skillsEntering = await state(page, "lattice");
    expect(skillsEntering.opacity).toBeLessThan(0.95);
    await page.evaluate((y) => window.scrollTo(0, y - 100), skillsTop);
    await settle(page);
    expect((await state(page, "lattice")).opacity).toBeGreaterThan(0.95);

    // Scrolling back up reverses both.
    await page.evaluate((y) => window.scrollTo(0, y - 760), skillsTop);
    await settle(page);
    expect((await state(page, "lattice")).opacity).toBeLessThan(0.95);
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
    expect((await state(page, "hero")).opacity).toBeGreaterThan(heroLeaving.opacity);
  });

  test("project cards enter from alternating sides", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/", { waitUntil: "networkidle" });
    const cards = page.locator("#projects ol:not(.case-flow) > li");
    test.skip((await cards.count()) < 3, "fewer than three published projects");
    const x = (i: number) =>
      cards.nth(i).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    // Parked below the fold: the second card waits to the left, the third to the right.
    expect(await x(1)).toBeLessThan(0);
    expect(await x(2)).toBeGreaterThan(0);
  });
});
