import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { CERTIFICATIONS_LAYOUT } from "../../src/config/layout";
import { expect, hydrated, test, type Page } from "./fixtures";

interface Cert {
  issuer: string;
  course_name: string;
  display_order: number;
  completed_on?: string;
  credential_url?: string;
  certificate_url?: string;
  visibility?: string;
}
const certs = (
  JSON.parse(fs.readFileSync("content/certifications.json", "utf8")) as { certifications: Cert[] }
).certifications
  .filter((c) => c.visibility !== "hidden")
  .sort((a, b) => a.display_order - b.display_order);
const academies = [...new Set(certs.map((c) => c.issuer))];
const countOf = (issuer: string) => certs.filter((c) => c.issuer === issuer).length;

test.skip(CERTIFICATIONS_LAYOUT !== "orbit", "Credential Orbit 3.0 is not the active layout");
// The test browser renders WebGL in software, so frames are slow: allow for it.
test.setTimeout(90_000);

interface Debug {
  camera: [number, number, number];
  target: [number, number, number];
  phase: number;
  pan: number;
  extent: { minX: number; maxX: number; minY: number; maxY: number };
  core: { x: number; y: number };
  focus: number;
  frames: number;
  running: boolean;
  entered: boolean;
  drifting: boolean;
}

const stage = (page: Page) => page.getByTestId("orbit-stage");
const labels = (page: Page) => page.getByTestId("orbit-card");
const debug = (page: Page) =>
  stage(page).evaluate((el) =>
    (el as HTMLElement & { spaceDebug?: () => unknown }).spaceDebug?.(),
  ) as Promise<Debug>;

async function open(page: Page, width = 1280, height = 800) {
  await page.setViewportSize({ width, height });
  await page.goto("/#education-certifications");
  await hydrated(page);
  await stage(page).scrollIntoViewIfNeeded();
  await expect(stage(page)).toHaveAttribute("data-renderer", "webgl", { timeout: 20_000 });
  await expect.poll(async () => (await debug(page)).entered, { timeout: 20_000 }).toBe(true);
}
const away = (page: Page) => page.mouse.move(2, 2);
const noOverflow = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};
const labelBoxes = (page: Page) =>
  labels(page).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, t: getComputedStyle(el).transform };
    }),
  );

test.describe("Credential Orbit 3.0", () => {
  test("loads the 3D scene lazily, only as the section approaches", async ({ page }) => {
    const scripts: string[] = [];
    page.on("response", (r) => {
      if (r.url().endsWith(".js")) scripts.push(r.url());
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/", { waitUntil: "networkidle" });
    const hasThree = async (urls: string[]) => {
      for (const url of urls) {
        const body = await (await page.request.get(url)).text();
        if (body.includes("WebGLRenderer")) return true;
      }
      return false;
    };
    expect(await hasThree(scripts)).toBe(false);
    await expect(page.locator(".cs-canvas")).toHaveCount(0);
    await stage(page).scrollIntoViewIfNeeded();
    await expect(stage(page)).toHaveAttribute("data-renderer", "webgl", { timeout: 20_000 });
    expect(await hasThree(scripts)).toBe(true);
    await expect(page.getByTestId("space-canvas")).toHaveCount(1);
  });

  test("shows every certificate and academy from the data", async ({ page }) => {
    await open(page);
    await expect(labels(page)).toHaveCount(certs.length);
    for (const [i, cert] of certs.entries()) {
      const tag = labels(page).nth(i);
      await expect(tag).toContainText(String(i + 1).padStart(2, "0"));
      await expect(tag.getByTestId("orbit-name")).toHaveText(cert.course_name);
      await expect(tag.getByTestId("orbit-name")).toBeVisible();
      await expect(tag).toHaveAttribute(
        "aria-label",
        `${cert.issuer
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
          .toUpperCase()} ${String(i + 1).padStart(2, "0")} ${cert.course_name} ${cert.issuer}, open the credential inspector`,
      );
    }
    const buttons = page.getByTestId("orbit-academy");
    await expect(buttons).toHaveCount(academies.length);
    for (const [i, issuer] of academies.entries()) {
      await expect(buttons.nth(i)).toContainText(issuer);
      await expect(buttons.nth(i)).toContainText(String(countOf(issuer)));
    }
    // The centre is the 3D core alone, with no text over it; the count is in the status line.
    await expect(page.getByTestId("orbit-core")).toHaveCount(0);
    await expect(stage(page)).not.toContainText(/credential system|nexus/i);
    await expect(page.getByTestId("orbit-status")).toHaveText(
      `Showing ${certs.length} of ${certs.length} credentials · All academies`,
    );
    const list = page.getByTestId("orbit-list");
    await list.locator("summary").click();
    for (const cert of certs) await expect(list).toContainText(cert.course_name);
  });

  test("at every orbital position, no tags collide and the whole system fits", async ({ page }) => {
    test.setTimeout(150_000);
    await open(page);
    await away(page);
    const box = (await stage(page).boundingBox())!;
    const check = async () => {
      const tags = await labelBoxes(page);
      const { core } = await debug(page);
      const cx = box.x + core.x * box.width;
      const cy = box.y + core.y * box.height;
      for (const [k, t] of tags.entries()) {
        // Upright: translate only, never rotated, skewed or scaled.
        const m = /matrix\(([^)]+)\)/.exec(t.t)![1]!.split(",").map(Number);
        expect(m.slice(0, 4)).toEqual([1, 0, 0, 1]);
        // Inside the stage.
        expect(t.x).toBeGreaterThanOrEqual(box.x - 1);
        expect(t.x + t.w).toBeLessThanOrEqual(box.x + box.width + 1);
        expect(t.y).toBeGreaterThanOrEqual(box.y - 1);
        expect(t.y + t.h).toBeLessThanOrEqual(box.y + box.height + 1);
        // Clear of the 3D core.
        const offCore =
          t.x + t.w <= cx - 40 || t.x >= cx + 40 || t.y + t.h <= cy - 40 || t.y >= cy + 40;
        expect(offCore, `label ${k + 1} over the core`).toBe(true);
        // Readable: never shrunk.
        expect(t.h).toBeGreaterThanOrEqual(56);
        // Clear of every other tag.
        for (const [n, u] of tags.entries()) {
          if (n <= k) continue;
          const apart =
            t.x + t.w <= u.x + 1 ||
            u.x + u.w <= t.x + 1 ||
            t.y + t.h <= u.y + 1 ||
            u.y + u.h <= t.y + 1;
          expect(apart, `tags ${k + 1} and ${n + 1} overlap`).toBe(true);
        }
      }
      // The whole orbital structure projects inside the stage.
      const { extent } = await debug(page);
      expect(extent.minX).toBeGreaterThan(0);
      expect(extent.maxX).toBeLessThan(1);
      expect(extent.minY).toBeGreaterThan(0);
      expect(extent.maxY).toBeLessThan(1);
    };
    // Turn the orbit through a full set of positions: academies swing it to new phases.
    await check();
    for (const k of [0, 1, 2, 3, 4, 5]) {
      await page.getByTestId("orbit-academy").nth(k).click();
      await away(page);
      await page.waitForTimeout(2200);
      await check();
    }
    await page.getByTestId("orbit-academy-all").click();
    await away(page);
    await page.waitForTimeout(1500);
    await check();
  });

  test("hovering a label lights its connector, and long titles show in full", async ({ page }) => {
    await open(page);
    await page.getByTestId("orbit-pause").click();
    const previews = page.getByTestId("orbit-preview");
    const visiblePreviews = () =>
      previews.evaluateAll(
        (els) => els.filter((el) => el.checkVisibility({ visibilityProperty: true })).length,
      );
    for (const k of certs.keys()) {
      const tag = labels(page).nth(k);
      const b = (await tag.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await expect(page.locator(".cs-links line").nth(k)).toHaveAttribute("data-hover", "true");
      await expect(page.locator(".cs-links line[data-hover]")).toHaveCount(1);
      if (certs[k]!.course_name.length > 40) {
        await expect(tag.getByTestId("orbit-preview")).toBeVisible();
        await expect(tag.getByTestId("orbit-preview")).toContainText(certs[k]!.course_name);
        await expect.poll(visiblePreviews).toBe(1);
      } else {
        await expect.poll(visiblePreviews).toBe(0);
      }
    }
    await away(page);
  });

  test("the orbit moves continuously, and the labels travel with it", async ({ page }) => {
    await open(page);
    await away(page);
    const a = await debug(page);
    const first = await labelBoxes(page);
    await page.waitForTimeout(2000);
    const b = await debug(page);
    expect(b.phase).toBeGreaterThan(a.phase);
    expect(b.drifting).toBe(true);
    expect(b.frames).toBeGreaterThan(a.frames);
    const later = await labelBoxes(page);
    expect(later.map((l) => l.t)).not.toEqual(first.map((l) => l.t));
  });

  test("pause stops all motion and the render loop; resume restarts it", async ({ page }) => {
    await open(page);
    const pause = page.getByTestId("orbit-pause");
    await pause.click();
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await away(page);
    await expect.poll(async () => (await debug(page)).running, { timeout: 15_000 }).toBe(false);
    const held = await debug(page);
    await page.waitForTimeout(1200);
    const still = await debug(page);
    expect(still.phase).toBe(held.phase);
    expect(still.frames).toBe(held.frames);
    await pause.click();
    await away(page);
    await expect
      .poll(async () => (await debug(page)).phase, { timeout: 15_000 })
      .toBeGreaterThan(held.phase);
  });

  test("hovering a certificate or focusing inside holds the orbit", async ({ page }) => {
    await open(page);
    await away(page);
    await expect.poll(async () => (await debug(page)).drifting).toBe(true);
    // Move straight onto a label: the orbit holds as the pointer arrives.
    const box = (await labels(page).first().boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(async () => (await debug(page)).drifting).toBe(false);
    const held = (await debug(page)).phase;
    await page.waitForTimeout(1000);
    expect(Math.abs((await debug(page)).phase - held)).toBeLessThan(1e-3);
    await away(page);
    await expect.poll(async () => (await debug(page)).drifting).toBe(true);
    await labels(page).nth(3).focus();
    await expect.poll(async () => (await debug(page)).drifting).toBe(false);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect.poll(async () => (await debug(page)).drifting, { timeout: 10_000 }).toBe(true);
  });

  test("the camera follows the pointer with damping, and settles back", async ({ page }) => {
    await open(page);
    const box = (await stage(page).boundingBox())!;
    const rest = (await debug(page)).camera;
    await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2);
    // Damped: not at its offset on the next frames, but getting there.
    await expect
      .poll(async () => (await debug(page)).camera[0], { timeout: 10_000 })
      .toBeGreaterThan(rest[0] + 0.3);
    const right = (await debug(page)).camera[0];
    await page.mouse.move(box.x + 8, box.y + box.height / 2, { steps: 4 });
    await expect
      .poll(async () => (await debug(page)).camera[0], { timeout: 10_000 })
      .toBeLessThan(rest[0] - 0.3);
    expect(right).toBeLessThan(rest[0] + 1);
    await away(page);
    await expect
      .poll(async () => Math.abs((await debug(page)).camera[0] - rest[0]), { timeout: 15_000 })
      .toBeLessThan(0.02);
  });

  test("each academy lights its certificates, turns them forward and moves the camera's focus", async ({
    page,
  }) => {
    await open(page);
    for (const issuer of academies) {
      const button = page.getByTestId("orbit-academy").filter({ hasText: issuer });
      await button.click();
      await away(page);
      await expect(button).toHaveAttribute("aria-pressed", "true");
      const n = countOf(issuer);
      await expect(page.getByTestId("orbit-status")).toHaveText(
        `Showing ${n} of ${certs.length} credentials · ${issuer}`,
      );
      await expect(page.locator("[data-testid=orbit-card][data-hot]")).toHaveCount(n);
      await expect(page.locator("[data-testid=orbit-card][data-dim]")).toHaveCount(
        certs.length - n,
      );
      for (const label of await page.locator("[data-testid=orbit-card][data-hot]").all()) {
        expect(await label.getAttribute("aria-label")).toContain(` ${issuer}, open`);
      }
      await expect
        .poll(async () => (await debug(page)).focus, { timeout: 15_000 })
        .toBeGreaterThan(0.95);
      // Every certificate stays in the environment.
      await expect(labels(page)).toHaveCount(certs.length);
    }
    // The chosen academy has been turned to the front: nearer the camera than the rest.
    const issuer = academies[1]!;
    await page.getByTestId("orbit-academy").filter({ hasText: issuer }).click();
    await away(page);
    await page.waitForTimeout(3000);
    const near = await labels(page).evaluateAll((els) => {
      const n = (el: Element) => parseFloat((el as HTMLElement).style.getPropertyValue("--near"));
      const hot = els.filter((el) => el.hasAttribute("data-hot")).map(n);
      const rest = els.filter((el) => !el.hasAttribute("data-hot")).map(n);
      const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
      return { hot: mean(hot), rest: mean(rest) };
    });
    expect(near.hot).toBeGreaterThan(near.rest);
    expect((await debug(page)).target[2]).toBeGreaterThan(0.4);
    await page.getByTestId("orbit-academy-all").click();
    await expect(page.locator("[data-testid=orbit-card][data-dim]")).toHaveCount(0);
    await expect
      .poll(async () => (await debug(page)).focus, { timeout: 15_000 })
      .toBeLessThan(0.05);
  });

  test("every certificate opens the inspector from its label, and closing restores the view", async ({
    page,
  }) => {
    test.setTimeout(240_000); // Twelve inspections, in software-rendered WebGL.
    await open(page);
    await page.getByTestId("orbit-pause").click();
    const issuer = academies[0]!;
    await page.getByTestId("orbit-academy").filter({ hasText: issuer }).click();
    for (const [i, cert] of certs.entries()) {
      await labels(page).nth(i).click();
      const panel = page.getByTestId("orbit-panel");
      await expect(panel).toBeVisible();
      await expect(stage(page)).toHaveAttribute("data-inspecting", "true");
      await expect(panel.getByRole("heading", { level: 4 })).toHaveText(cert.course_name);
      await expect(panel.getByRole("heading", { level: 4 })).toBeFocused();
      await expect(panel).toContainText(cert.issuer);
      await expect(panel).toContainText(cert.completed_on ?? "Not recorded");
      if (cert.certificate_url) {
        await expect(panel.getByTestId("orbit-view-certificate")).toHaveAttribute(
          "href",
          cert.certificate_url,
        );
      } else {
        await expect(panel.getByTestId("orbit-view-certificate")).toHaveCount(0);
      }
      if (!cert.certificate_url && !cert.credential_url) {
        await expect(panel.getByTestId("orbit-no-document")).toBeVisible();
        await expect(panel.locator("a, img")).toHaveCount(0);
      }
      await expect
        .poll(async () => (await debug(page)).pan, { timeout: 15_000 })
        .toBeGreaterThan(0.9);
      if (i % 2) await page.keyboard.press("Escape");
      else await panel.getByTestId("orbit-close").click();
      await expect(page.getByTestId("orbit-panel")).toHaveCount(0);
      await expect(labels(page).nth(i)).toBeFocused();
      await expect(page.getByTestId("orbit-academy").filter({ hasText: issuer })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect.poll(async () => (await debug(page)).pan, { timeout: 15_000 }).toBeLessThan(0.1);
      // The certificate last inspected stays marked.
      await expect(labels(page).nth(i)).toHaveAttribute("data-selected", "true");
    }
  });

  test("the inspector expands out of the certificate it belongs to", async ({ page }) => {
    await open(page);
    await page.getByTestId("orbit-pause").click();
    // Click and sample the panel on the very next frames, inside the page, so nothing is missed.
    const sample = await page.evaluate(async () => {
      const label = document.querySelectorAll<HTMLElement>("[data-testid=orbit-card]")[1]!;
      const from = label.getBoundingClientRect();
      label.click();
      const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
      await frame();
      await frame();
      const panel = document.querySelector<HTMLElement>("[data-testid=orbit-panel]")!;
      const early = panel.getBoundingClientRect();
      await new Promise((r) => setTimeout(r, 1500));
      const settled = panel.getBoundingClientRect();
      return { from: from.toJSON(), early: early.toJSON(), settled: settled.toJSON() };
    });
    // It starts near the label's size and position, then grows into place.
    expect(sample.early.width).toBeLessThan(sample.settled.width - 20);
    expect(Math.abs(sample.early.x - sample.from.x)).toBeLessThan(
      Math.abs(sample.settled.x - sample.from.x),
    );
  });

  test("academies and certificates work from the keyboard", async ({ page }) => {
    await open(page);
    await page.getByTestId("orbit-academy-all").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("orbit-academy").first()).toHaveAttribute("aria-pressed", "true");
    const label = labels(page).nth(5);
    await label.focus();
    expect(await label.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("orbit-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(label).toBeFocused();
  });

  test("stops rendering when scrolled out of view", async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => (await debug(page)).running, { timeout: 15_000 }).toBe(false);
    const frames = (await debug(page)).frames;
    await page.waitForTimeout(1000);
    expect((await debug(page)).frames).toBe(frames);
  });

  test("has no accessibility violations and logs no errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    const audit = async () => {
      const { violations } = await new AxeBuilder({ page })
        .include("[data-testid=credential-orbit]")
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    };
    await audit();
    await page.getByTestId("orbit-academy").filter({ hasText: "IBM SkillsBuild" }).click();
    await audit();
    await labels(page).nth(2).click();
    await page.waitForTimeout(400);
    await audit();
    expect(errors).toEqual([]);
  });
});

test.describe("Credential Orbit 3.0 without motion, WebGL or JavaScript", () => {
  test("reduced motion: a still composition with every interaction", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await open(page);
    await expect(page.getByTestId("orbit-pause")).toHaveCount(0);
    const box = (await stage(page).boundingBox())!;
    await page.mouse.move(box.x + box.width - 8, box.y + 20);
    await page.waitForTimeout(1200);
    const a = await debug(page);
    expect(a.drifting).toBe(false);
    expect(a.running).toBe(false);
    await page.waitForTimeout(800);
    const b = await debug(page);
    expect(b.phase).toBe(a.phase);
    expect(b.camera).toEqual(a.camera);
    await page.getByTestId("orbit-academy").filter({ hasText: "Cisco" }).click();
    await expect(page.locator("[data-testid=orbit-card][data-hot]")).toHaveCount(1);
    await labels(page).first().click();
    await expect(page.getByTestId("orbit-panel")).toBeVisible();
    await context.close();
  });

  test("without WebGL, the same environment is drawn from the model and still works", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (type.startsWith("webgl")) return null;
        return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof original;
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/#education-certifications");
    await hydrated(page);
    await stage(page).scrollIntoViewIfNeeded();
    await expect(stage(page)).toHaveAttribute("data-renderer", "fallback", { timeout: 15_000 });
    await expect(page.locator(".cs-fallback")).toBeVisible();
    await expect(page.locator(".cs-canvas")).toHaveCount(0);
    await expect(labels(page)).toHaveCount(certs.length);
    for (const label of await labels(page).all()) await expect(label).toBeVisible();
    await page.getByTestId("orbit-academy").filter({ hasText: "Microsoft Learn" }).click();
    await expect(page.locator("[data-testid=orbit-card][data-hot]")).toHaveCount(2);
    await labels(page).nth(6).click();
    await expect(page.getByTestId("orbit-panel")).toContainText(certs[6]!.course_name);
    expect(errors).toEqual([]);
    await context.close();
  });

  test("every certificate is in the page without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/#education-certifications");
    await expect(labels(page)).toHaveCount(certs.length);
    for (const label of await labels(page).all()) await expect(label).toBeVisible();
    await context.close();
  });
});

for (const [width, height] of [
  [320, 640],
  [390, 844],
  [768, 1024],
  [1024, 800],
  [1440, 900],
  [1920, 1080],
] as const) {
  test(`Credential Orbit 3.0 fits and works at ${width}px`, async ({ browser }) => {
    const touch = width < 1024;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage();
    await page.goto("/#education-certifications");
    await hydrated(page);
    await stage(page).scrollIntoViewIfNeeded();
    await expect(stage(page)).toHaveAttribute("data-renderer", "webgl", { timeout: 20_000 });
    await noOverflow(page);
    const press = async (locator: ReturnType<Page["locator"]>) =>
      touch ? locator.tap() : locator.click();

    if (width < 768) {
      // Phones: every certificate a round touch target on the ring; the inspector stacks below.
      const box = (await stage(page).boundingBox())!;
      const tags = await labelBoxes(page);
      expect(tags).toHaveLength(certs.length);
      for (const [k, t] of tags.entries()) {
        expect(t.w).toBeGreaterThanOrEqual(44);
        expect(t.h).toBeGreaterThanOrEqual(44);
        expect(t.x).toBeGreaterThanOrEqual(box.x - 1);
        expect(t.x + t.w).toBeLessThanOrEqual(box.x + box.width + 1);
        for (const u of tags.slice(k + 1)) {
          const apart =
            t.x + t.w <= u.x + 1 ||
            u.x + u.w <= t.x + 1 ||
            t.y + t.h <= u.y + 1 ||
            u.y + u.h <= t.y + 1;
          expect(apart).toBe(true);
        }
      }
      const names = page.getByTestId("orbit-names").getByRole("button");
      await expect(names).toHaveCount(certs.length);
      for (const [k, cert] of certs.entries())
        await expect(names.nth(k)).toContainText(cert.course_name);
      await press(page.getByTestId("orbit-academy").filter({ hasText: "Cisco" }));
      await expect(page.locator("[data-testid=orbit-card][data-hot]")).toHaveCount(1);
      await press(names.nth(2));
      await expect(page.getByTestId("orbit-panel")).toContainText(certs[2]!.course_name);
      await press(page.getByTestId("orbit-close"));
      await press(labels(page).nth(5));
      const panel = page.getByTestId("orbit-panel");
      await expect(panel).toBeVisible();
      await expect(panel).toContainText(certs[5]!.course_name);
      // Measured after any scroll the inspector caused: it sits below the scene.
      const after = (await stage(page).boundingBox())!;
      expect((await panel.boundingBox())!.y).toBeGreaterThanOrEqual(after.y + after.height - 1);
      await press(page.getByTestId("orbit-close"));
      await expect(panel).toHaveCount(0);
    } else {
      await page.getByTestId("orbit-pause").click();
      const box = (await stage(page).boundingBox())!;
      for (const l of await labelBoxes(page)) {
        expect(l.x).toBeGreaterThanOrEqual(box.x - 2);
        expect(l.x + l.w).toBeLessThanOrEqual(box.x + box.width + 2);
      }
      await press(page.getByTestId("orbit-academy").filter({ hasText: "IBM SkillsBuild" }));
      await expect(page.locator("[data-testid=orbit-card][data-hot]")).toHaveCount(3);
      const { extent } = await debug(page);
      expect(extent.minX).toBeGreaterThan(0);
      expect(extent.maxX).toBeLessThan(1);
    }
    await noOverflow(page);
    for (const button of await page.getByTestId("orbit-academy").all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await context.close();
  });
}
