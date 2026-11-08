import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { expect, hydrated, test, type Page } from "./fixtures";

interface AboutContent {
  headline: string[];
  perspective: { stages: { id: string; label: string; explanation: string }[] };
  principles: { id: string; label: string; text: string }[];
  process: { stages: { id: string; label: string; explanation: string }[] };
}

const about = JSON.parse(fs.readFileSync("content/about.json", "utf8")) as AboutContent;
const skillMap = JSON.parse(fs.readFileSync("content/skill-map.json", "utf8")) as {
  skills: { id: string; label: string }[];
  edges: { skill: string; project: string; note: string }[];
};

const noOverflow = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

test.describe("About section", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#about");
  });

  test("opens with the statement, the person and the facts, and no portrait", async ({ page }) => {
    const section = page.locator("#about");
    await expect(section.getByRole("heading", { level: 2 })).toHaveText(about.headline.join(" "));
    await expect(section).toContainText("The engineer behind the systems");
    await expect(section).toContainText("Aasveer Singh");
    await expect(section).toContainText("AI/ML Engineer");
    await expect(page.getByTestId("about-dossier")).toContainText(
      "Amritsar Group of Colleges, 2023–2027",
    );
    await expect(section.locator("img")).toHaveCount(0);
  });

  test("every Engineering Perspective stage explains itself and lights the chain", async ({
    page,
  }) => {
    const chain = page.getByTestId("engineering-perspective");
    await chain.scrollIntoViewIfNeeded();
    await expect(chain).toContainText("not the architecture of any one project");
    for (const stage of about.perspective.stages) {
      const button = page.getByTestId(`perspective-${stage.id}`);
      await button.click();
      await expect(button).toHaveAttribute("aria-current", "step");
      const panel = page.getByTestId("perspective-panel");
      await expect(panel).toHaveAttribute("data-stage", stage.id);
      await expect(panel).toContainText(stage.explanation);
    }
    await expect(page.getByTestId("perspective-pulse")).toBeAttached();
  });

  test("the diagram moves a little with the pointer, and its stages do not", async ({ page }) => {
    await page.getByTestId("engineering-perspective").scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const grid = page.locator(".persp-grid");
    const field = (await page.locator(".persp-field").boundingBox())!;
    const stage = page.getByTestId("perspective-problem");
    const before = (await stage.boundingBox())!;
    await page.mouse.move(field.x + 10, field.y + field.height / 2, { steps: 4 });
    await expect
      .poll(() => grid.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41))
      .toBeGreaterThan(1);
    const moved = await grid.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    expect(moved).toBeLessThanOrEqual(10);
    expect((await stage.boundingBox())!.x).toBeCloseTo(before.x, 0);
  });

  test("the three principles are always readable, and selecting one brings it forward", async ({
    page,
  }) => {
    await page.getByTestId("engineering-principles").scrollIntoViewIfNeeded();
    for (const principle of about.principles) {
      await expect(page.getByTestId("engineering-principles")).toContainText(principle.text);
    }
    for (const principle of about.principles) {
      const button = page.getByTestId(`principle-${principle.id}`);
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator('.principle-button[aria-pressed="true"]')).toHaveCount(1);
    }
    const fill = page.locator(".principles-rail span");
    await expect
      .poll(() => fill.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a))
      .toBeCloseTo(1, 1);
  });

  test("every How I Build stage updates the panel and moves along the path", async ({ page }) => {
    await page.getByTestId("build-process").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("build-process")).toContainText("more than a fixed recipe");
    expect(about.process.stages).toHaveLength(5);
    const scale = () =>
      page
        .locator(".journey-rail span")
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    let last = -1;
    for (const stage of about.process.stages) {
      const button = page.getByTestId(`process-${stage.id}`);
      await button.click();
      await expect(button).toHaveAttribute("aria-current", "step");
      const panel = page.getByTestId("process-panel");
      await expect(panel).toHaveAttribute("data-stage", stage.id);
      await expect(panel).toContainText(stage.explanation);
      await page.waitForTimeout(600);
      const now = await scale();
      expect(now).toBeGreaterThan(last);
      last = now;
    }
  });

  test("Engineering Connections closes About, with every verified link in its table", async ({
    page,
  }) => {
    const block = page.getByTestId("engineering-connections");
    // Inside About, after How I Build, and before the next section.
    expect(
      await block.evaluate((el) => {
        const about = el.closest("section");
        const build = about?.querySelector(".ab-build, [data-testid^='process-']");
        return {
          inAbout: about?.id,
          afterBuild: build ? !!(build.compareDocumentPosition(el) & 4) : false,
        };
      }),
    ).toEqual({ inAbout: "about", afterBuild: true });
    await expect(block.getByRole("heading", { level: 3 })).toHaveText(
      "Where my skills meet real builds.",
    );
    await expect(block).toContainText(
      "An overview of the technical capabilities applied across my projects.",
    );
    const table = page.getByTestId("connections-table");
    await expect(table).toBeHidden();
    await block.getByText("View the connections as a table").click();
    await expect(table).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(skillMap.skills.length);
    await expect(table.locator("tbody li")).toHaveCount(skillMap.edges.length);
    for (const edge of skillMap.edges) await expect(table).toContainText(edge.note);
  });

  test("the graphical Skill Connection Matrix and Areas of Exploration are gone", async ({
    page,
  }) => {
    await expect(page.locator("#skill-map")).toHaveCount(0);
    await expect(page.getByTestId("skill-matrix")).toHaveCount(0);
    await expect(page.getByTestId("exploration-network")).toHaveCount(0);
    await expect(page.getByText("Areas of exploration", { exact: false })).toHaveCount(0);
  });

  test("the signal follows scrolling down and back up, and scrolling is never captured", async ({
    page,
  }) => {
    const scale = () =>
      page
        .getByTestId("about-spine")
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).d);
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(700);
    const early = await scale();
    const y = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 1400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y + 1000);
    await page.waitForTimeout(700);
    const later = await scale();
    expect(later).toBeGreaterThan(early);
    await page.mouse.wheel(0, -1400);
    await page.waitForTimeout(800);
    expect(await scale()).toBeLessThan(later);
  });

  test("works by keyboard, with visible focus", async ({ page }) => {
    const stage = page.getByTestId("perspective-intelligence");
    await stage.focus();
    const outline = await stage.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(stage).toHaveAttribute("aria-current", "step");
    const principle = page.getByTestId("principle-human");
    await principle.focus();
    await expect(principle).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Enter");
    await expect(principle).toHaveAttribute("aria-pressed", "true");
    const summary = page.getByTestId("engineering-connections").locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("connections-table")).toBeVisible();
  });

  test("has no accessibility violations once settled", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    const { violations } = await new AxeBuilder({ page }).include("#about").analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });

  test("logs no console errors while everything is used", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.reload();
    await hydrated(page);
    for (const id of ["perspective-experience", "principle-systems", "process-refine"]) {
      await page.getByTestId(id).click();
    }
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});

test.describe("About without motion or JavaScript", () => {
  test("reduced motion keeps every interaction, with nothing travelling", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#about");
    await page.getByTestId("perspective-engineering").click();
    await expect(page.getByTestId("perspective-panel")).toHaveAttribute(
      "data-stage",
      "engineering",
    );
    await expect(page.getByTestId("perspective-pulse")).toHaveCount(0);
    await page.getByTestId("process-connect").click();
    await expect(page.getByTestId("process-panel")).toHaveAttribute("data-stage", "connect");
  });

  test("everything can be read without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/#about");
    const text = await page.locator("#about").innerText();
    for (const item of [
      ...about.perspective.stages.map((s) => s.explanation),
      ...about.principles.map((p) => p.text),
      ...about.process.stages.map((s) => s.explanation),
      "Where my skills meet real builds.",
    ]) {
      expect(text).toContain(item);
    }
    // The table sits in a native disclosure, which opens without JavaScript.
    await page.getByText("View the connections as a table").click();
    const table = await page.getByTestId("connections-table").innerText();
    for (const edge of skillMap.edges) expect(table).toContain(edge.note);
    await context.close();
  });
});

for (const [width, height] of [
  [320, 640],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080],
] as const) {
  test(`About fits and works at ${width}px`, async ({ browser }) => {
    const touch = width < 1000;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage();
    await page.goto("/#about");
    await hydrated(page);
    await noOverflow(page);
    const press = (id: string) =>
      touch ? page.getByTestId(id).tap() : page.getByTestId(id).click();
    await press("perspective-experience");
    await expect(page.getByTestId("perspective-panel")).toHaveAttribute("data-stage", "experience");
    await press("principle-human");
    await press("process-pipeline");
    await expect(page.getByTestId("process-panel")).toHaveAttribute("data-stage", "pipeline");
    const summary = page.getByTestId("engineering-connections").locator("summary");
    const table = page.getByTestId("connections-table");
    // The block may still be rising into place; press again only if it did not open.
    await expect(async () => {
      if (!(await table.isVisible())) await (touch ? summary.tap() : summary.click());
      await expect(table).toBeVisible({ timeout: 1000 });
    }).toPass();
    await noOverflow(page);
    // Every row stays inside the page: stacked on phones, a table on wider screens.
    for (const row of await table.locator("tbody tr").all()) {
      const box = (await row.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
    }
    // Stages stay inside the drawing, and targets stay large enough to press.
    const field = (await page.locator(".persp-field").boundingBox())!;
    for (const stage of about.perspective.stages) {
      const box = (await page.getByTestId(`perspective-${stage.id}`).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y).toBeGreaterThanOrEqual(field.y - 40);
    }
    await context.close();
  });
}
