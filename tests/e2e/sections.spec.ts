import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import fs from "node:fs";
import path from "node:path";
import { contactDetails } from "../../src/lib/privacy";

const OUT = path.join(process.cwd(), "out");
const apiJson = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(OUT, "api", name), "utf8")) as { data: unknown[] };
const profile = () =>
  apiJson("profile.json").data as unknown as {
    links: {
      github_url: string;
      linkedin_url: string;
      email: string | null;
      resume_href: string | null;
    };
    skill_groups: { category: string }[];
  };

test.describe("skills, education and certifications", () => {
  test("shows the seven skill groups in resume order, with no ratings", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#skills");
    await expect(section.locator("h3")).toHaveText(profile().skill_groups.map((g) => g.category));
    expect(await section.innerText()).not.toMatch(/%/);
    await expect(section.locator("progress, meter, input[type=range]")).toHaveCount(0);
  });

  test("shows the exact education entry", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("education-entry")).toHaveText(
      "B.Tech, Computer Science & Engineering (AI/ML), Amritsar Group of Colleges, 2023–2027",
    );
  });
});

test.describe("projects", () => {
  test("cards match out/api/projects.json in count and order, or the empty state shows", async ({
    page,
  }) => {
    await page.goto("/");
    const published = apiJson("projects.json").data as {
      display_name: string;
      technologies: string[];
    }[];
    const cards = page.getByTestId("project-card");
    if (published.length === 0) {
      await expect(cards).toHaveCount(0);
      await expect(page.getByTestId("projects-empty")).toHaveText(
        "No project entries are available right now.",
      );
    } else {
      await expect(cards.locator("h3")).toHaveText(published.map((p) => p.display_name));
      for (const p of published) {
        await page.getByRole("button", { name: `Read case study: ${p.display_name}` }).click();
        const study = page.getByTestId("case-dialog").and(page.locator("[open]"));
        await expect(study.getByTestId("project-technologies").locator("li")).toHaveText(
          p.technologies,
        );
        await page.keyboard.press("Escape");
        await expect(study).toHaveCount(0);
      }
    }
  });

  test("the page never shows workflow words or placeholders", async ({ page }) => {
    await page.goto("/");
    const text = await page.locator("body").innerText();
    for (const word of [
      /\bdraft\b/i,
      /\bpending\b/i,
      /\bapproved\b/i,
      /coming soon/i,
      /\breview\b/i,
      /placeholder/i,
    ]) {
      expect(text).not.toMatch(word);
    }
  });

  test("an unpublished project's repository URL is never linked", async ({ page }) => {
    // The links are in each card's <noscript> text, so they are read from the served page.
    const html = await (await page.request.get("/")).text();
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    for (const url of [
      "https://github.com/singhaasveer-lab/InterviewIQ",
      "https://github.com/singhaasveer-lab/wingman_ai",
      "https://github.com/singhaasveer-lab/giftbro-ai",
      "https://github.com/akshita-sharda/STUDYFORGE-AI-",
      "https://github.com/singhaasveer-lab/smartqueue-ai",
    ]) {
      const published = (apiJson("projects.json").data as { repository_url: string }[]).some(
        (p) => p.repository_url === url,
      );
      expect(hrefs.includes(url)).toBe(published);
    }
  });
});

test.describe("contact and footer", () => {
  test("every external link opens in a new tab with noopener noreferrer and says so", async ({
    page,
  }) => {
    await page.goto("/");
    const links = await page.locator("a[href^='http']").evaluateAll((as) =>
      as.map((a) => ({
        href: a.getAttribute("href"),
        target: a.getAttribute("target"),
        rel: a.getAttribute("rel"),
        text: a.textContent ?? "",
      })),
    );
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const l of links) {
      expect(l.target, l.href!).toBe("_blank");
      expect(l.rel, l.href!).toBe("noopener noreferrer");
      expect(l.text, l.href!).toContain("(opens in a new tab)");
    }
  });

  test("contact shows LinkedIn and GitHub with the approved URLs", async ({ page }) => {
    await page.goto("/");
    const contact = page.locator("#contact");
    await expect(contact.getByRole("link", { name: /LinkedIn profile/ })).toHaveAttribute(
      "href",
      "https://linkedin.com/in/aasveer-singh",
    );
    await expect(contact.getByRole("link", { name: /GitHub profile/ })).toHaveAttribute(
      "href",
      "https://github.com/singhaasveer-lab",
    );
  });

  test("Contact shows no email or resume; no phone number anywhere", async ({ page }) => {
    await page.goto("/");
    const { links } = profile();
    const html = await page.content();
    expect(contactDetails(html)).toEqual([]);
    const contact = page.locator("#contact");
    await expect(contact.locator("a[href^='mailto:']")).toHaveCount(0);
    if (links.email) await expect(contact).not.toContainText(links.email);
    await expect(contact.getByRole("link", { name: /resume/i })).toHaveCount(0);
    // The hero and the footer offer the resume.
    await expect(page.getByRole("link", { name: /resume/i })).toHaveCount(
      links.resume_href ? 2 : 0,
    );
  });

  test("the hero resume download works", async ({ page, request }) => {
    const { links } = profile();
    test.skip(!links.resume_href, "resume not published");
    await page.goto("/");
    const hero = page.locator("#intro");
    const pdf = await request.get(links.resume_href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      hero.getByRole("link", { name: /Download resume/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("Aasveer_Singh_AI_ML_Engineer_Resume_v3_fnl.pdf");
  });

  test("footer reaches every destination contact offers and includes the current year", async ({
    page,
  }) => {
    await page.goto("/");
    const external = (sel: string) =>
      page
        .locator(`${sel} a[href]`)
        .evaluateAll((as) =>
          [
            ...new Set(as.map((a) => a.getAttribute("href")!).filter((h) => !h.startsWith("#"))),
          ].sort(),
        );
    expect(await external("footer")).toEqual(expect.arrayContaining(await external("#contact")));
    await expect(page.locator("footer")).toContainText(String(new Date().getFullYear()));
    await expect(page.locator("footer").getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "#contact",
    );
  });
});

test.describe("accessibility (axe)", () => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    test(`no serious or critical violations at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      // Open the mobile menu so its content is scanned too.
      if (viewport.width < 768) await page.getByRole("button", { name: "Menu" }).click();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      const summary = results.violations.map(
        (v) => `${v.impact} ${v.id}: ${v.nodes.length} node(s)`,
      );
      console.log(
        `[axe ${viewport.width}px] violations: ${summary.length ? summary.join("; ") : "none"}`,
      );
      expect(
        blocking,
        JSON.stringify(
          blocking.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          null,
          2,
        ),
      ).toEqual([]);
    });
  }
});
