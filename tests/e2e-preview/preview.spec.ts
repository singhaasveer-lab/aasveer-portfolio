import { expect, test } from "@playwright/test";
import { CERTIFICATIONS_LAYOUT } from "../../src/config/layout";
import { contactDetails } from "../../src/lib/privacy";
import fs from "node:fs";
import path from "node:path";

interface ProjectContent {
  slug: string;
  display_name: string;
  category: string;
  technologies: string[];
  problem_statement: string;
  repository_url: string;
  repository_status: string;
  publish_status: string;
  role_status: string;
  role_statement: string | null;
}

const projects = (
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "projects.json"), "utf8")) as {
    projects: ProjectContent[];
  }
).projects;

test.describe("development preview (next dev, PORTFOLIO_PREVIEW=1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    // The dev build hydrates slowly, and the case study buttons work only after it.
    await page
      .getByTestId("scene-rail")
      .and(page.locator("[data-measured]"))
      .waitFor({ state: "attached" });
  });

  test("labels itself as a development preview", async ({ page }) => {
    await expect(page.getByRole("note")).toContainText("DEVELOPMENT PREVIEW");
  });

  test("shows all six projects in order, with their resume text and technology lists", async ({
    page,
  }) => {
    const cards = page.getByTestId("project-card");
    await expect(cards).toHaveCount(6);
    await expect(cards.locator("h3")).toHaveText(projects.map((p) => p.display_name));
    expect(projects.map((p) => p.display_name)).toEqual([
      "StudyForge AI",
      "PennyBloom",
      "InterviewIQ",
      "Wingman AI",
      "GiftBro AI",
      "SmartQueue AI",
    ]);
    for (const [i, p] of projects.entries()) {
      await expect(cards.nth(i).getByTestId("project-category")).toHaveText(p.category);
      await expect(cards.nth(i)).toContainText(p.problem_statement);
      await page.getByRole("button", { name: `Read case study: ${p.display_name}` }).click();
      const study = page.getByTestId("case-dialog").and(page.locator("[open]"));
      await expect(study.getByTestId("project-technologies").locator("li")).toHaveText(
        p.technologies,
      );
      await page.keyboard.press("Escape");
      await expect(study).toHaveCount(0);
    }
  });

  test("withholds unverified repository links and unapproved contribution statements", async ({
    page,
  }) => {
    for (const p of projects) {
      await page.getByRole("button", { name: `Read case study: ${p.display_name}` }).click();
      const study = page.getByTestId("case-dialog").and(page.locator("[open]"));
      const link = study.getByRole("link", { name: new RegExp(`${p.display_name} repository`) });
      if (p.repository_status === "verified") {
        await expect(link).toHaveAttribute("href", p.repository_url);
        await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      } else {
        await expect(link).toHaveCount(0);
        await expect(study.getByTestId("project-link-withheld")).toBeVisible();
      }
      // Contribution wording appears exactly for the approved roles.
      if (p.role_status === "approved") {
        await expect(study.getByTestId("project-role")).toContainText(p.role_statement!);
      } else {
        await expect(study.getByTestId("project-role")).toHaveCount(0);
      }
      await page.keyboard.press("Escape");
      await expect(study).toHaveCount(0);
    }
  });

  test("shows all twelve certifications in the credential archive", async ({ page }) => {
    await expect(
      page.locator(
        CERTIFICATIONS_LAYOUT === "classic"
          ? "[data-testid=vault-group] li"
          : "[data-testid=orbit-card]",
      ),
    ).toHaveCount(12);
    await expect(
      page.getByTestId(CERTIFICATIONS_LAYOUT === "classic" ? "vault-status" : "orbit-status"),
    ).toContainText("Showing 12 of 12 credentials");
  });

  test("shows no phone number or contact link", async ({ page }) => {
    expect(contactDetails(await page.content())).toEqual([]);
  });

  test("serves only published projects from the public JSON resource", async ({ request }) => {
    const res = await request.get("/api/projects.json");
    expect(res.status()).toBe(200);
    const { data } = (await res.json()) as { data: { slug: string }[] };
    expect(data.map((p) => p.slug)).toEqual(
      projects.filter((p) => p.publish_status === "published").map((p) => p.slug),
    );
  });
});
