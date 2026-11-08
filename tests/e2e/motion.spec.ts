import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { expect, hydrated, test, type Page } from "./fixtures";

const study = (page: Page) => page.getByTestId("case-dialog").and(page.locator("[open]"));
const openCase = async (page: Page, name: string) => {
  await page.getByRole("button", { name: `Read case study: ${name}` }).click();
  await expect(study(page).getByRole("heading", { level: 2, name })).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
});

test.describe("hero text loop", () => {
  const phrases = (
    JSON.parse(fs.readFileSync("content/about.json", "utf8")) as { role_loop: string[] }
  ).role_loop;

  test("cycles through the phrases, and stops on hover", async ({ page }) => {
    await page.goto("/");
    const loop = page.getByTestId("hero-loop");
    const live = loop.locator(".hero-loop-live");
    await expect(live).toHaveText(phrases[0]!);
    await expect(live).toHaveText(phrases[1]!, { timeout: 6000 });
    await loop.hover();
    await expect(loop).not.toHaveAttribute("data-running", "true");
    await page.mouse.move(5, 5);
    await expect(loop).toHaveAttribute("data-running", "true");
  });

  test("stops while focus is in the hero's text", async ({ page }) => {
    await page.goto("/");
    await page.locator(".hero-actions a").first().focus();
    await expect(page.getByTestId("hero-loop")).not.toHaveAttribute("data-running", "true");
  });

  test("is a static comma-separated line under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".hero-loop-static")).toHaveText(phrases.join(", "));
    await expect(page.locator(".hero-loop-live")).toBeHidden();
    const box = (await page.locator(".hero-loop-static").boundingBox())!;
    expect(box.width).toBeGreaterThan(100);
  });

  test("is a static line without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    const box = (await page.locator(".hero-loop-static").boundingBox())!;
    expect(box.width).toBeGreaterThan(100);
    await expect(page.locator(".hero-loop-live")).toBeHidden();
    await context.close();
  });
});

test.describe("signal pulse", () => {
  test("travels the connectors, and each stage lights as it arrives", async ({ page }) => {
    await page.goto("/#ai-lab");
    await page.getByTestId("lab-trace").click();
    await expect(page.getByTestId("lab-pulse")).toHaveCount(1);
    const current = page.locator('.lab-node[aria-current="step"]');
    await expect(current).toHaveAttribute("data-testid", "lab-stage-input");
    await expect(current).toHaveAttribute("data-testid", "lab-stage-processing", {
      timeout: 3000,
    });
    await expect(current).toHaveAttribute("data-testid", "lab-stage-chunking", { timeout: 3000 });
    await page.getByTestId("lab-trace").click();
    await expect(page.getByTestId("lab-pulse")).toHaveCount(0);
  });

  test("under reduced motion, stages highlight in turn with nothing moving", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#ai-lab");
    await page.getByTestId("lab-trace").click();
    await expect(page.locator('.lab-node[aria-current="step"]')).toHaveAttribute(
      "data-testid",
      "lab-stage-processing",
      { timeout: 3000 },
    );
    await expect(page.getByTestId("lab-pulse")).toHaveCount(0);
  });
});

test.describe("skill popover", () => {
  test("lists a skill's projects, links to Engineering Connections, and Escape returns focus", async ({
    page,
  }) => {
    await page.goto("/#skills");
    const chip = page.locator("#skills").getByRole("button", { name: "RAG", exact: true });
    await chip.click();
    const popover = page.getByRole("dialog", { name: "Projects that use RAG" });
    await expect(popover).toContainText("StudyForge AI");
    await expect(popover).toContainText("InterviewIQ");
    await expect(popover.getByRole("link", { name: /See all connections/ })).toHaveAttribute(
      "href",
      "#engineering-connections",
    );
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(chip).toBeFocused();
  });
});

test.describe("case study media", () => {
  test("every project has a keyboard-operable comparison slider", async ({ page }) => {
    await page.goto("/#projects");
    for (const name of ["StudyForge AI", "SmartQueue AI"]) {
      await openCase(page, name);
      const slider = study(page).getByRole("slider", {
        name: `Compare the ${name} application with its architecture`,
      });
      await expect(slider).toHaveAttribute("aria-valuenow", "50");
      await slider.focus();
      await page.keyboard.press("ArrowRight");
      await expect(slider).toHaveAttribute("aria-valuenow", "55");
      await page.keyboard.press("Home");
      await expect(slider).toHaveAttribute("aria-valuenow", "0");
      await expect(slider).toHaveAttribute("aria-valuetext", /architecture/);
      await expect(study(page).getByTestId("architecture-sketch")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(study(page)).toHaveCount(0);
    }
  });

  test("the slider can be dragged", async ({ page }) => {
    await page.goto("/#projects");
    await openCase(page, "PennyBloom");
    await page.waitForTimeout(700);
    const box = (await study(page).locator(".case-compare").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    const value = await study(page).getByRole("slider").getAttribute("aria-valuenow");
    expect(Number(value)).toBeLessThan(30);
  });

  test("StudyForge AI shows its demo screenshot and a gallery; others have no gallery", async ({
    page,
  }) => {
    await page.goto("/#projects");
    const card = page.getByRole("article", { name: "StudyForge AI" });
    await expect(card.locator(".case-thumb img")).toHaveAttribute("alt", /StudyForge AI home/);
    await openCase(page, "StudyForge AI");
    await expect(study(page).locator(".case-shot figcaption")).toHaveText(
      "Application screenshot, demo account",
    );
    await expect(study(page).getByTestId("project-flow")).toContainText("TF-IDF retrieval");
    const gallery = study(page).getByTestId("project-gallery");
    await expect(gallery).toContainText("Planner, demo account (1 of 2)");
    await gallery.getByRole("button", { name: "Next slide" }).click();
    await expect(gallery).toContainText("Practice quiz");
    await page.keyboard.press("Escape");
    await expect(study(page)).toHaveCount(0);
    await openCase(page, "InterviewIQ");
    await expect(study(page).getByTestId("project-gallery")).toHaveCount(0);
  });

  test("their code loads only when a case study opens", async ({ page }) => {
    const before: string[] = [];
    page.on("request", (r) => before.push(r.url()));
    await page.goto("/#projects", { waitUntil: "networkidle" });
    const loaded = before.length;
    await openCase(page, "PennyBloom");
    await expect(study(page).getByRole("slider")).toBeVisible();
    expect(before.slice(loaded).some((url) => url.endsWith(".js"))).toBe(true);
  });
});

test.describe("glow", () => {
  test("sits behind the featured card and the active module, moving only transform and opacity", async ({
    page,
  }) => {
    await page.goto("/#projects");
    await expect(page.locator(".case-glow")).toHaveCount(1);
    await page.goto("/#ai-lab");
    await expect(page.locator(".lab-tab-glow")).toHaveCount(1);
    await expect(page.locator('.lab-tab[aria-selected="true"] .lab-tab-glow')).toHaveCount(1);
  });

  test("holds still under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#ai-lab");
    const glow = page.locator(".lab-tab-glow > div");
    const first = await glow.evaluate((el) => getComputedStyle(el).transform);
    await page.waitForTimeout(600);
    expect(await glow.evaluate((el) => getComputedStyle(el).transform)).toBe(first);
  });
});

test.describe("staggered lists", () => {
  test("settle fully visible once they have been in view", async ({ page }) => {
    await page.goto("/#skills");
    await page.waitForTimeout(1200);
    const hidden = await page
      .locator("#skills .guide-skills > li")
      .evaluateAll((els) => els.filter((el) => getComputedStyle(el).opacity !== "1").length);
    expect(hidden).toBe(0);
  });

  test("are visible without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    const hidden = await page
      .locator(
        ".guide-skills > li, .vault-list > li, [data-testid=orbit-card], [data-testid=project-tags] > li",
      )
      .evaluateAll((els) => els.filter((el) => getComputedStyle(el).opacity !== "1").length);
    expect(hidden).toBe(0);
    await context.close();
  });
});

test.describe("launcher toolbar", () => {
  test("expands into the quick links, and Escape closes it", async ({ page }) => {
    await page.goto("/");
    const launcher = page.getByTestId("nexus-launcher");
    await launcher.click();
    const quick = page.getByTestId("nexus-quick");
    await expect(quick.getByRole("link")).toHaveText([
      "Evidence",
      "Projects",
      "AI Lab",
      "Contact",
      "Download Resume",
    ]);
    await page.keyboard.press("Escape");
    await expect(quick).toHaveCount(0);
    await expect(launcher).toBeFocused();
  });

  test("a quick link goes to its section", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nexus-launcher").click();
    await page.getByTestId("nexus-quick").getByRole("link", { name: "Evidence" }).click();
    await expect(page).toHaveURL(/#evidence$/);
    await expect(page.getByTestId("nexus-quick")).toHaveCount(0);
  });

  test("the panel stays on screen on a phone", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 640 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto("/");
    await hydrated(page);
    await page.getByTestId("nexus-launcher").tap();
    await page.waitForTimeout(500);
    const box = (await page.locator(".nexus-quick").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    await context.close();
  });
});

test.describe("text roll", () => {
  test("rolls a nav link on hover, keeping its width and name", async ({ page }) => {
    await page.goto("/");
    const link = page
      .getByRole("navigation", { name: "Primary", exact: true })
      .getByRole("link", { name: "Projects", exact: true });
    const before = (await link.boundingBox())!.width;
    await link.hover();
    await expect(link.locator(".nav-roll-text")).toHaveCount(1);
    expect((await link.boundingBox())!.width).toBe(before);
    await expect(link).toHaveAccessibleName("Projects");
    await expect(link.locator(".nav-roll-text")).toHaveCount(0, { timeout: 3000 });
  });

  test("does not run under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary", exact: true });
    await nav.getByRole("link", { name: "Projects", exact: true }).hover();
    await page.waitForTimeout(200);
    await expect(nav.locator(".nav-roll-text")).toHaveCount(0);
  });
});

test.describe("spinning badge", () => {
  const angle = (page: Page) =>
    page
      .getByTestId("hero-badge")
      .locator("> div")
      .evaluate((el) => getComputedStyle(el).transform);

  test("carries the role and city, and turns slowly", async ({ page }) => {
    await page.goto("/");
    const badge = page.getByTestId("hero-badge");
    await expect(badge).toHaveAttribute("aria-hidden", "true");
    expect((await badge.textContent())!.replace(/\s/g, "")).toContain("AI/MLENGINEER·AMRITSAR·");
    const first = await angle(page);
    await page.waitForTimeout(700);
    expect(await angle(page)).not.toBe(first);
  });

  test("holds still under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const first = await angle(page);
    await page.waitForTimeout(500);
    expect(await angle(page)).toBe(first);
  });
});

test.describe("custom cursor", () => {
  test("is a label over project cards, and the normal cursor elsewhere", async ({ page }) => {
    await page.goto("/#projects");
    const card = page.getByRole("article", { name: "PennyBloom" });
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await card.hover();
    await expect(page.getByTestId("case-cursor")).toHaveText("Open case");
    await page.mouse.move(4, 400);
    await expect(page.getByTestId("case-cursor")).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).not.toBe("none");
  });

  test("disappears when the page moves on from the cards without the mouse moving", async ({
    page,
  }) => {
    await page.goto("/#projects");
    const card = page.getByRole("article", { name: "PennyBloom" });
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await card.hover();
    await expect(page.getByTestId("case-cursor")).toHaveText("Open case");
    // The pointer stays still; only the page moves to the next section.
    await page.evaluate(() =>
      document.getElementById("contact")?.scrollIntoView({ behavior: "instant" }),
    );
    await expect(page.getByTestId("case-cursor")).toHaveCount(0);
  });

  test("is absent under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#projects");
    await page.getByRole("article", { name: "PennyBloom" }).hover();
    await expect(page.getByTestId("case-cursor")).toHaveCount(0);
  });

  test("is absent on touch screens", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto("/#projects");
    await hydrated(page);
    await page.getByRole("article", { name: "PennyBloom" }).tap();
    await expect(page.getByTestId("case-cursor")).toHaveCount(0);
    await context.close();
  });
});

test.describe("open states", () => {
  test("the popover and the quick links have no accessibility violations", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#skills");
    await page.waitForTimeout(800);
    await page.locator("#skills").getByRole("button", { name: "RAG", exact: true }).click();
    const popover = await new AxeBuilder({ page }).include(".skill-popover").analyze();
    expect(popover.violations.map((v) => v.id)).toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByTestId("nexus-launcher").click();
    await page.waitForTimeout(400);
    const quick = await new AxeBuilder({ page }).include(".nexus-quick").analyze();
    expect(quick.violations.map((v) => v.id)).toEqual([]);
  });
});
