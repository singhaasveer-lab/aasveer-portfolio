import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { expect, hydrated, test, type Page } from "./fixtures";

interface Case {
  id: string;
  project: string;
  title: string;
  category: string;
  intro: string;
  challenge: string;
  investigation: string;
  approach: string[];
  result: string[];
  takeaway: string;
  contribution: string;
  sources: { path: string; url: string }[];
}
const cases = (JSON.parse(fs.readFileSync("content/casebook.json", "utf8")) as { cases: Case[] })
  .cases;
const projects = (
  JSON.parse(fs.readFileSync("content/projects.json", "utf8")) as {
    projects: { slug: string; display_name: string; repository_url: string }[];
  }
).projects;
const nameOf = (slug: string) => projects.find((p) => p.slug === slug)!.display_name;
const repoOf = (slug: string) => projects.find((p) => p.slug === slug)!.repository_url;

const dossier = (page: Page) => page.getByTestId("case-dossier");
const noOverflow = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

test.describe("Engineering Casebook", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#casebook");
    await hydrated(page);
  });

  test("sits between Skills and AI Lab, with its heading and navigation entry", async ({
    page,
  }) => {
    const order = await page.locator("main > section").evaluateAll((els) => els.map((e) => e.id));
    expect(order.indexOf("casebook")).toBe(order.indexOf("skills") + 1);
    expect(order.indexOf("ai-lab")).toBe(order.indexOf("casebook") + 1);
    const section = page.locator("#casebook");
    await expect(section).toContainText(/Engineering casebook/i);
    await expect(section.getByRole("heading", { level: 2 })).toHaveText("Behind the build.");
    await expect(section).toContainText(
      "Every system has an engineering story. Explore the challenges, investigations and technical decisions behind the systems I build.",
    );
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary", exact: true });
    await nav.getByRole("link", { name: "Casebook", exact: true }).click();
    await expect(page).toHaveURL(/#casebook$/);
    await expect(page.locator("#casebook-heading")).toBeFocused();
    await expect(page.locator("#casebook-heading")).toBeInViewport();
  });

  test("the archive lists each case with its number, project, title, category and intro", async ({
    page,
  }) => {
    const files = page.locator(".cb-file");
    await expect(files).toHaveCount(cases.length);
    for (const [i, c] of cases.entries()) {
      const file = files.nth(i);
      await expect(file).toContainText(`Case 0${i + 1}`);
      await expect(file).toContainText(nameOf(c.project));
      await expect(file.getByRole("heading", { level: 3 })).toHaveText(c.title);
      await expect(file).toContainText(c.category);
      await expect(file).toContainText(c.intro);
      await expect(page.getByTestId(`case-open-${c.id}`)).toHaveAttribute("aria-expanded", "false");
    }
    await expect(dossier(page)).toHaveCount(0);
  });

  test("every case opens its full five-chapter story, and closes again", async ({ page }) => {
    for (const c of cases) {
      const open = page.getByTestId(`case-open-${c.id}`);
      await open.click();
      await expect(open).toHaveAttribute("aria-expanded", "true");
      await expect(dossier(page)).toHaveAttribute("data-case", c.id);
      await expect(page.locator("#casebook-dossier-title")).toBeFocused();
      await expect(dossier(page).getByRole("heading", { level: 3 })).toHaveText(c.title);
      await expect(dossier(page).getByRole("heading", { level: 4 })).toHaveText([
        "The challenge",
        "The investigation",
        "The approach",
        "The result",
        "The takeaway",
      ]);
      for (const text of [
        c.challenge,
        c.investigation,
        ...c.approach,
        ...c.result,
        c.takeaway,
        c.contribution,
      ]) {
        await expect(dossier(page)).toContainText(text);
      }
      const links = dossier(page).locator(".cb-sources a");
      await expect(links).toHaveCount(c.sources.length);
      for (const [i, s] of c.sources.entries()) {
        await expect(links.nth(i)).toHaveAttribute(
          "href",
          `${repoOf(c.project)}/blob/main/${s.path}`,
        );
        await expect(links.nth(i)).toHaveAttribute("target", "_blank");
        await expect(links.nth(i)).toHaveAttribute("rel", "noopener noreferrer");
      }
      await page.getByTestId("case-close").click();
      await expect(dossier(page)).toHaveCount(0);
      await expect(open).toHaveAttribute("aria-expanded", "false");
      await expect(open).toBeFocused();
    }
  });

  test("Escape closes a case and returns focus; another case opens from the dossier", async ({
    page,
  }) => {
    await page.getByTestId(`case-open-${cases[0]!.id}`).click();
    await expect(dossier(page)).toHaveAttribute("data-case", cases[0]!.id);
    await page.getByTestId(`case-switch-${cases[2]!.id}`).click();
    await expect(dossier(page)).toHaveAttribute("data-case", cases[2]!.id);
    await expect(page.locator("#casebook-dossier-title")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dossier(page)).toHaveCount(0);
    await expect(page.getByTestId(`case-open-${cases[2]!.id}`)).toBeFocused();
  });

  test("works from the keyboard alone, with visible focus", async ({ page }) => {
    const open = page.getByTestId(`case-open-${cases[1]!.id}`);
    await open.focus();
    expect(await open.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(dossier(page)).toHaveAttribute("data-case", cases[1]!.id);
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("case-close")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dossier(page)).toHaveCount(0);
    await expect(open).toBeFocused();
  });

  test("the project link leads to that project", async ({ page }) => {
    await page.getByTestId(`case-open-${cases[0]!.id}`).click();
    const link = dossier(page).getByRole("link", { name: /in Projects/ });
    await expect(link).toHaveAttribute("href", `#project-${cases[0]!.project}`);
    expect(await page.locator(`#project-${cases[0]!.project}`).count()).toBe(1);
  });

  test("has no accessibility violations, closed or open, and logs no errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await hydrated(page);
    await page.waitForTimeout(1200);
    let { violations } = await new AxeBuilder({ page }).include("#casebook").analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    for (const c of cases) {
      await page.getByTestId(`case-open-${c.id}`).click();
      await page.waitForTimeout(700); // The dossier fades in; audit it at rest.
      ({ violations } = await new AxeBuilder({ page }).include("#casebook").analyze());
      expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
});

test.describe("Engineering Casebook without motion or JavaScript", () => {
  test("reduced motion keeps every interaction, with no chapter animation", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto("/#casebook");
    await hydrated(page);
    await page.getByTestId(`case-open-${cases[0]!.id}`).click();
    await expect(dossier(page)).toBeVisible();
    const duration = await page
      .locator(".cb-chapter")
      .first()
      .evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(duration)).toBeLessThan(0.02);
    await context.close();
  });

  test("every case can be read in full without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/#casebook");
    const text = await page.locator("#casebook").innerText();
    for (const c of cases) {
      for (const t of [
        c.title,
        c.challenge,
        c.investigation,
        ...c.approach,
        ...c.result,
        c.takeaway,
      ]) {
        expect(text).toContain(t);
      }
    }
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
  test(`Casebook fits and works at ${width}px`, async ({ browser }) => {
    const touch = width < 1000;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage();
    await page.goto("/#casebook");
    await hydrated(page);
    await noOverflow(page);
    const open = page.getByTestId(`case-open-${cases[1]!.id}`);
    await (touch ? open.tap() : open.click());
    await expect(dossier(page)).toHaveAttribute("data-case", cases[1]!.id);
    await expect(page.locator("#casebook-dossier-title")).toBeInViewport();
    await noOverflow(page);
    for (const el of await dossier(page).locator("button, a").all()) {
      const box = (await el.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(-0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const close = page.getByTestId("case-close");
    await (touch ? close.tap() : close.click());
    await expect(dossier(page)).toHaveCount(0);
    await context.close();
  });
}
