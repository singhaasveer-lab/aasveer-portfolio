import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { expect, hydrated, test, type Page } from "./fixtures";

interface Item {
  label: string;
  path: string;
  url?: string;
}
interface Application {
  project: string;
  implementation: string;
  context: string;
  /** Absent when no contribution is confirmed. */
  contribution?: string;
  insight: string;
  evidence: Item[];
}
interface EvidenceRecord {
  id: string;
  capability: string;
  applications: Application[];
}

const evidence = JSON.parse(fs.readFileSync("content/evidence.json", "utf8")) as {
  records: EvidenceRecord[];
  quick_view: { record: string; project: string; worked_on: string }[];
};
const projects = (
  JSON.parse(fs.readFileSync("content/projects.json", "utf8")) as {
    projects: { slug: string; display_name: string; repository_url: string }[];
  }
).projects;
const repo = (slug: string) => projects.find((p) => p.slug === slug)!.repository_url;
const nameOf = (slug: string) => projects.find((p) => p.slug === slug)!.display_name;

const noOverflow = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

const record = (page: Page) => page.getByTestId("evidence-record");

test.describe("Evidence Engine", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#evidence");
    await hydrated(page);
  });

  test("replaces Areas of Exploration, after About and before Projects", async ({ page }) => {
    const order = await page.locator("main > section").evaluateAll((els) => els.map((e) => e.id));
    expect(order.indexOf("evidence")).toBe(order.indexOf("about") + 1);
    expect(order.indexOf("projects")).toBe(order.indexOf("evidence") + 1);
    const section = page.locator("#evidence");
    await expect(section.getByRole("heading", { level: 2 })).toHaveText(
      "Don't take my word for it.",
    );
    await expect(section).toContainText(
      "Every technical claim should have something behind it. Explore the projects, implementations and engineering evidence that demonstrate how I turn technical knowledge into working systems.",
    );
    const nav = page.getByRole("navigation", { name: "Primary", exact: true });
    await expect(nav.getByRole("link", { name: "Evidence", exact: true })).toHaveAttribute(
      "href",
      "#evidence",
    );
  });

  test("every capability reveals its record, trail, contribution and insight", async ({ page }) => {
    for (const r of evidence.records) {
      const button = page.getByTestId(`evidence-capability-${r.id}`);
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(record(page)).toHaveAttribute("data-record", r.id);
      const first = r.applications[0]!;
      await expect(record(page)).toHaveAttribute("data-project", first.project);
      await expect(record(page).getByRole("heading", { level: 3 })).toHaveText(r.capability);
      const trail = page.getByTestId("evidence-trail").locator("li");
      await expect(trail).toHaveCount(4);
      await expect(trail.nth(0)).toContainText("Capability");
      await expect(trail.nth(1)).toContainText(nameOf(first.project));
      await expect(trail.nth(2)).toContainText(first.implementation);
      await expect(trail.nth(3)).toContainText(`${first.evidence.length} inspected file`);
      await expect(record(page)).toContainText(first.context);
      if (first.contribution) {
        await expect(record(page)).toContainText(first.contribution);
      } else {
        await expect(page.getByTestId("evidence-contribution-status")).toHaveCount(0);
      }
      await expect(record(page)).toContainText(first.insight);
      await expect(page.getByTestId("evidence-sources").locator("li")).toHaveCount(
        first.evidence.length,
      );
    }
  });

  test("switching the project changes the record and its sources", async ({ page }) => {
    await page.getByTestId("evidence-capability-backend").click();
    for (const a of evidence.records.find((r) => r.id === "backend")!.applications) {
      await page.getByTestId(`evidence-project-${a.project}`).click();
      await expect(page.getByTestId(`evidence-project-${a.project}`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(record(page)).toHaveAttribute("data-project", a.project);
      await expect(record(page)).toContainText(a.context);
      const sources = page.getByTestId("evidence-sources");
      for (const item of a.evidence) await expect(sources).toContainText(item.path);
    }
  });

  test("source records expand, and every link opens the right public file", async ({ page }) => {
    for (const r of evidence.records) {
      await page.getByTestId(`evidence-capability-${r.id}`).click();
      for (const a of r.applications) {
        if (r.applications.length > 1)
          await page.getByTestId(`evidence-project-${a.project}`).click();
        await expect(record(page)).toHaveAttribute("data-project", a.project);
        const sources = page.getByTestId("evidence-sources");
        for (const [i, item] of a.evidence.entries()) {
          const details = sources.locator("details").nth(i);
          await details.locator("summary").click();
          await expect(details).toHaveAttribute("open", "");
          await expect(details).toContainText("Source verified");
          await expect(details).toContainText("Public source available");
          const link = details.getByTestId("evidence-source-link");
          await expect(link).toHaveAttribute("href", `${repo(a.project)}/blob/main/${item.path}`);
          await expect(link).toHaveAttribute("target", "_blank");
          await expect(link).toHaveAttribute("rel", "noopener noreferrer");
        }
      }
    }
  });

  test("a contribution is shown only where it is confirmed", async ({ page }) => {
    // InterviewIQ's integration evidence is public, but it claims no contribution.
    await page.getByTestId("evidence-capability-integration").click();
    await expect(page.getByTestId("evidence-record")).toHaveAttribute(
      "data-project",
      "interviewiq",
    );
    await expect(page.getByTestId("evidence-contribution-status")).toHaveCount(0);
    await expect(page.getByTestId("evidence-record")).not.toContainText("My contribution");
    await page.getByTestId("evidence-capability-ocr").click();
    await expect(page.getByTestId("evidence-contribution-status")).toHaveText(
      "Confirmed contribution",
    );
    await page.getByTestId("evidence-capability-recommendation").click();
    await expect(page.getByTestId("evidence-contribution-status")).toHaveText(
      "Confirmed contribution",
    );
  });

  test("the project link and architecture explorer lead on from a record", async ({ page }) => {
    await page.getByTestId("evidence-capability-ocr").click();
    await expect(
      page.locator("#evidence").getByRole("link", { name: /View Wingman AI/ }),
    ).toHaveAttribute("href", "#project-wingman-ai");
    expect(await page.locator("#project-wingman-ai").count()).toBe(1);
    await page
      .locator("#evidence")
      .getByRole("button", { name: "Explore architecture of Wingman AI" })
      .click();
    await expect(page.getByRole("dialog", { name: "Wingman AI" })).toBeVisible();
  });

  test("the recruiter quick view shows three contributions and traces each", async ({ page }) => {
    const toggle = page.getByTestId("evidence-quick-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    const cards = page.getByTestId("evidence-quick-card");
    await expect(cards).toHaveCount(3);
    for (const [i, q] of evidence.quick_view.entries()) {
      const card = cards.nth(i);
      await expect(card).toContainText(nameOf(q.project));
      await expect(card).toContainText(q.worked_on);
      for (const link of await card.locator("a").all()) {
        expect(await link.getAttribute("href")).toMatch(
          new RegExp(`^${repo(q.project)}/blob/main/`),
        );
      }
    }
    await cards.nth(1).getByTestId("evidence-quick-trace").click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(record(page)).toHaveAttribute("data-record", evidence.quick_view[1]!.record);
    await expect(record(page)).toHaveAttribute("data-project", evidence.quick_view[1]!.project);
  });

  test("works from the keyboard, with visible focus", async ({ page }) => {
    const button = page.getByTestId("evidence-capability-nlp");
    await button.focus();
    expect(await button.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(record(page)).toHaveAttribute("data-record", "nlp");
    await page.getByTestId("evidence-capability-data").focus();
    await page.keyboard.press("Space");
    await expect(record(page)).toHaveAttribute("data-record", "data");
    const summary = page.getByTestId("evidence-sources").locator("summary").first();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("evidence-sources").locator("details").first()).toHaveAttribute(
      "open",
      "",
    );
  });

  test("has no accessibility violations, in either view", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await hydrated(page);
    await page.waitForTimeout(1200);
    const audit = async () => {
      const { violations } = await new AxeBuilder({ page }).include("#evidence").analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    };
    await page.getByTestId("evidence-sources").locator("summary").first().click();
    await audit();
    await page.getByTestId("evidence-quick-toggle").click();
    await page.waitForTimeout(500);
    await audit();
  });

  test("logs no console errors while everything is used", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.reload();
    await hydrated(page);
    for (const r of evidence.records) await page.getByTestId(`evidence-capability-${r.id}`).click();
    await page.getByTestId("evidence-quick-toggle").click();
    await page.getByTestId("evidence-quick-trace").first().click();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});

test.describe("Evidence Engine without motion or JavaScript", () => {
  test("reduced motion keeps every interaction, with no trail animation", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto("/#evidence");
    await hydrated(page);
    await page.getByTestId("evidence-capability-queue").click();
    await expect(record(page)).toHaveAttribute("data-record", "queue");
    const animation = await page
      .getByTestId("evidence-trail")
      .locator("li")
      .first()
      .evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(animation)).toBeLessThan(0.02);
    await context.close();
  });

  test("every record and source can be read without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/#evidence");
    const html = await page.locator("#evidence").innerHTML();
    for (const r of evidence.records) {
      expect(html).toContain(r.capability.replace(/&/g, "&amp;"));
      for (const a of r.applications)
        for (const item of a.evidence) expect(html).toContain(item.path);
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
  test(`Evidence Engine fits and works at ${width}px`, async ({ browser }) => {
    const touch = width < 1000;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage();
    await page.goto("/#evidence");
    await hydrated(page);
    await noOverflow(page);
    const press = (id: string) =>
      touch ? page.getByTestId(id).tap() : page.getByTestId(id).click();
    await press("evidence-capability-llm");
    await expect(record(page)).toHaveAttribute("data-record", "llm");
    await press("evidence-project-interviewiq");
    await expect(record(page)).toHaveAttribute("data-project", "interviewiq");
    await noOverflow(page);
    for (const id of ["evidence-capability-llm", "evidence-project-interviewiq"]) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(40);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await press("evidence-quick-toggle");
    await expect(page.getByTestId("evidence-quick-card")).toHaveCount(3);
    await noOverflow(page);
    await context.close();
  });
}
