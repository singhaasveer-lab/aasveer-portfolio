import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { expect, hydrated, test, type Page } from "./fixtures";

interface CapabilityContent {
  id: string;
  label: string;
  description: string;
  lab?: string;
  projects: { slug: string; note: string }[];
}
const capabilities = (
  JSON.parse(fs.readFileSync("content/capabilities.json", "utf8")) as {
    capabilities: CapabilityContent[];
  }
).capabilities;
const projects = (
  JSON.parse(fs.readFileSync("content/projects.json", "utf8")) as {
    projects: { slug: string; display_name: string }[];
  }
).projects;
const nameOf = (slug: string) => projects.find((p) => p.slug === slug)!.display_name;

const panel = (page: Page) => page.getByTestId("network-panel");
const litLinks = (page: Page) =>
  page
    .locator(".explore-line[data-on]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-link")!).sort());
const litProjects = (page: Page) =>
  page
    .locator(".explore-projects li[data-on] button")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-testid")!.replace("network-project-", "")).sort(),
    );

const noOverflow = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

test.describe("AI Systems Laboratory capability map", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#ai-lab");
    await hydrated(page);
  });

  test("sits inside the Laboratory, before its workflows, with no navigation entry", async ({
    page,
  }) => {
    const network = page.getByTestId("capability-network");
    expect(await network.evaluate((el) => el.closest("section")?.id)).toBe("ai-lab");
    expect(
      await network.evaluate((el) => {
        const lab = document.querySelector('[data-testid="ai-lab"]')!;
        return !!(el.compareDocumentPosition(lab) & Node.DOCUMENT_POSITION_FOLLOWING);
      }),
    ).toBe(true);
    const nav = page.getByRole("navigation", { name: "Primary", exact: true });
    for (const name of [/Skill Map/, /Matrix/, /Exploration/, /Capability/]) {
      await expect(nav.getByRole("link", { name })).toHaveCount(0);
    }
  });

  test("shows all twelve capabilities as peer nodes, none cut off", async ({ page }) => {
    const field = (await page.locator(".explore-field").boundingBox())!;
    for (const c of capabilities) {
      const node = page.getByTestId(`network-capability-${c.id}`);
      await expect(node).toHaveText(c.label);
      const box = (await node.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(field.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(field.y + field.height + 1);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    for (const slug of new Set(capabilities.flatMap((c) => c.projects.map((p) => p.slug)))) {
      await expect(page.getByTestId(`network-project-${slug}`)).toBeVisible();
    }
  });

  test("the network takes about 58% of the width and the panel the rest", async ({ page }) => {
    const box = (sel: string) => page.locator(sel).first().boundingBox();
    const net = (await box(".explore-field"))!;
    const reading = (await box(".explore-reading"))!;
    const share = net.width / (net.width + reading.width);
    expect(share).toBeGreaterThan(0.53);
    expect(share).toBeLessThan(0.62);
    expect(reading.x).toBeGreaterThan(net.x + net.width - 1);
    expect(net.height).toBeGreaterThanOrEqual(680);
  });

  test("every capability lights only its verified projects and fills the panel", async ({
    page,
  }) => {
    for (const c of capabilities) {
      await page.getByTestId(`network-capability-${c.id}`).click();
      await expect(page.getByTestId(`network-capability-${c.id}`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(panel(page)).toHaveAttribute("data-id", c.id);
      await expect(panel(page).getByRole("heading", { level: 4 })).toHaveText(c.label);
      await expect(panel(page)).toContainText(c.description);
      for (const use of c.projects) {
        await expect(panel(page)).toContainText(nameOf(use.slug));
        await expect(panel(page)).toContainText(use.note);
      }
      await expect(
        panel(page).getByRole("button", { name: /Explore architecture of/ }),
      ).toHaveCount(c.projects.length);
      expect(await litProjects(page)).toEqual(c.projects.map((p) => p.slug).sort());
      expect(await litLinks(page)).toEqual(c.projects.map((p) => `${c.id}:${p.slug}`).sort());
    }
  });

  test("unlit connections stay visible, but subdued", async ({ page }) => {
    await page.getByTestId("network-capability-recommendation").click();
    const opacity = () =>
      page
        .locator(".explore-line:not([data-on])")
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).strokeOpacity));
    await expect.poll(opacity).toBeLessThan(0.4);
    expect(await opacity()).toBeGreaterThan(0.1);
  });

  test("a project node lights its capabilities and lists how it uses each", async ({ page }) => {
    await page.getByTestId("network-project-pennybloom").click();
    await expect(panel(page)).toHaveAttribute("data-kind", "project");
    await expect(panel(page).getByRole("heading", { level: 4 })).toHaveText("PennyBloom");
    const uses = capabilities.filter((c) => c.projects.some((p) => p.slug === "pennybloom"));
    for (const c of uses) {
      await expect(panel(page)).toContainText(c.label);
      await expect(page.getByTestId(`network-capability-${c.id}`)).toHaveAttribute(
        "data-focus",
        "true",
      );
    }
    expect(await litLinks(page)).toEqual(uses.map((c) => `${c.id}:pennybloom`).sort());
    await panel(page).getByRole("button", { name: "Explore architecture of PennyBloom" }).click();
    await expect(page.getByRole("dialog", { name: "PennyBloom" })).toBeVisible();
  });

  test("Explore Architecture opens that project's architecture view", async ({ page }) => {
    await page.getByTestId("network-capability-ocr").click();
    await panel(page).getByRole("button", { name: "Explore architecture of Wingman AI" }).click();
    await expect(page.getByRole("dialog", { name: "Wingman AI" })).toBeVisible();
  });

  test("a capability opens its own workflow in the Laboratory below", async ({ page }) => {
    await page.getByTestId("network-capability-recommendation").click();
    await panel(page).getByTestId("network-workflow").click();
    await expect(page.getByTestId("lab-panel")).toHaveAttribute("data-module", "recommendation");
    await expect(page.locator("#lab-workflows")).toBeFocused();
    await expect(page.locator("#lab-workflows")).toBeInViewport();
    // A capability without a module offers no workflow link.
    await page.getByTestId("network-capability-frontend").click();
    await expect(panel(page)).toHaveAttribute("data-id", "frontend");
    await expect(panel(page).getByTestId("network-workflow")).toHaveCount(0);
  });

  test("hovering previews without changing the selection", async ({ page }) => {
    await page.getByTestId("network-capability-retrieval").click();
    await page.getByTestId("network-capability-recommendation").hover();
    expect(await litProjects(page)).toEqual(["giftbro-ai"]);
    await expect(panel(page)).toHaveAttribute("data-id", "retrieval");
  });

  test("works from the keyboard, with visible focus", async ({ page }) => {
    const node = page.getByTestId("network-capability-nlp");
    await node.focus();
    expect(await node.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(panel(page)).toHaveAttribute("data-id", "nlp");
    await page.getByTestId("network-project-giftbro-ai").focus();
    await page.keyboard.press("Space");
    await expect(panel(page)).toHaveAttribute("data-id", "giftbro-ai");
  });

  test("does not capture scrolling", async ({ page }) => {
    const network = page.getByTestId("capability-network");
    const box = (await network.boundingBox())!;
    await page.mouse.move(box.x + box.width / 3, box.y + 200);
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 300);
  });

  test("has no accessibility violations and logs no errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await hydrated(page);
    await page.waitForTimeout(1200);
    await page.getByTestId("network-capability-backend").click();
    await page.waitForTimeout(500); // The panel fades in; audit it at rest.
    let { violations } = await new AxeBuilder({ page }).include("#lab-capabilities").analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    await page.getByTestId("network-project-interviewiq").click();
    await page.waitForTimeout(500); // The panel fades in; audit it at rest.
    ({ violations } = await new AxeBuilder({ page }).include("#lab-capabilities").analyze());
    expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe("capability map without motion or JavaScript", () => {
  test("reduced motion keeps every interaction, with nothing travelling", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto("/#ai-lab");
    await hydrated(page);
    await page.getByTestId("network-capability-data").click();
    await expect(panel(page)).toHaveAttribute("data-id", "data");
    await expect(page.getByTestId("network-pulse")).toHaveCount(0);
    await context.close();
  });

  test("every capability and its projects can be read without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/#ai-lab");
    const text = await page.locator("#lab-capabilities").innerText();
    for (const c of capabilities) {
      expect(text).toContain(c.description);
      for (const p of c.projects) expect(text).toContain(p.note);
    }
    await context.close();
  });
});

for (const [width, height] of [
  [320, 640],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1920, 1080],
] as const) {
  test(`capability map fits and works at ${width}px`, async ({ browser }) => {
    const touch = width < 1100;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage();
    await page.goto("/#ai-lab");
    await hydrated(page);
    await noOverflow(page);
    for (const node of await page.locator(".explore-topic, .explore-project").all()) {
      const box = (await node.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(-0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const press = (id: string) =>
      touch ? page.getByTestId(id).tap() : page.getByTestId(id).click();
    await press("network-capability-ocr");
    await expect(panel(page)).toHaveAttribute("data-id", "ocr");
    await press("network-project-studyforge-ai");
    await expect(panel(page)).toHaveAttribute("data-id", "studyforge-ai");
    await noOverflow(page);
    if (width < 1100) {
      // Stacked: the panel follows the network.
      const net = (await page.locator(".explore-field").boundingBox())!;
      const reading = (await page.locator(".explore-reading").boundingBox())!;
      expect(reading.y).toBeGreaterThanOrEqual(net.y + net.height - 1);
    }
    await context.close();
  });
}
