// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CertificationsSection } from "../../src/components/certifications/CertificationsSection";
import { ProjectHighlights } from "../../src/components/projects/ProjectHighlights";
import { ProjectWalkthrough } from "../../src/components/projects/ProjectWalkthrough";
import { readContent } from "../../src/lib/content/readContent";
import { buildDatabase } from "../../src/lib/db/build";
import { linkPreviewAlt, parseSiteUrl, siteUrlProblem } from "../../src/lib/site";
import { seoFiles } from "../../src/lib/seo";
import {
  CertificationContentSchema,
  ProjectContentSchema,
  type CertificationsContent,
  type ProjectsContent,
  type PublicCertification,
} from "../../src/lib/validation/schemas";

afterEach(cleanup);

const CONTENT_DIR = path.join(process.cwd(), "content");
const content = readContent(CONTENT_DIR);
const walkthrough = {
  src: "/media/projects/demo.mp4",
  poster: "/media/projects/demo.webp",
  description: "A student uploads a PDF and asks a question.",
};

/** A copy of the content folder, with projects.json or certifications.json changed. */
function contentCopy(
  change: (files: { projects: ProjectsContent; certifications: CertificationsContent }) => void,
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-content-"));
  const contentDir = path.join(dir, "content");
  fs.cpSync(CONTENT_DIR, contentDir, { recursive: true });
  const read = <T,>(name: string) =>
    JSON.parse(fs.readFileSync(path.join(contentDir, name), "utf8")) as T;
  const files = {
    projects: read<ProjectsContent>("projects.json"),
    certifications: read<CertificationsContent>("certifications.json"),
  };
  change(files);
  fs.writeFileSync(path.join(contentDir, "projects.json"), JSON.stringify(files.projects));
  fs.writeFileSync(
    path.join(contentDir, "certifications.json"),
    JSON.stringify(files.certifications),
  );
  return { dir, contentDir };
}

describe("project highlights", () => {
  const base = content.projects.projects[0]!;

  it("are empty for every project until the owner gives real figures", () => {
    for (const project of content.projects.projects) expect(project.highlights).toEqual([]);
  });

  it("render nothing while empty", () => {
    const { container } = render(<ProjectHighlights highlights={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("render each value with its label when set", () => {
    render(
      <ProjectHighlights
        highlights={[
          { value: "4", label: "Study modes" },
          { value: "2", label: "Interfaces" },
        ]}
      />,
    );
    expect(screen.getByTestId("project-highlights").textContent).toContain("Study modes");
    expect(screen.getByText("4")).toBeDefined();
  });

  it("must be empty or hold two to four items", () => {
    const item = { value: "1", label: "x" };
    const parse = (highlights: unknown[]) =>
      ProjectContentSchema.safeParse({ ...base, highlights }).success;
    expect(parse([])).toBe(true);
    expect(parse([item])).toBe(false);
    expect(parse([item, item])).toBe(true);
    expect(parse([item, item, item, item, item])).toBe(false);
  });

  it("survive the database build, in order", () => {
    const { dir, contentDir } = contentCopy(({ projects }) => {
      projects.projects[0]!.highlights = [
        { value: "A", label: "First" },
        { value: "B", label: "Second" },
      ];
    });
    const outPath = path.join(dir, "t.db");
    buildDatabase({ contentDir, outPath });
    const db = new Database(outPath, { readonly: true });
    const rows = db.prepare("SELECT value FROM project_highlight ORDER BY position").all();
    db.close();
    expect(rows).toEqual([{ value: "A" }, { value: "B" }]);
  });
});

describe("project walkthrough", () => {
  it("is empty for every project", () => {
    for (const project of content.projects.projects) expect(project.walkthrough).toBeNull();
  });

  it("renders nothing while empty", () => {
    const { container } = render(<ProjectWalkthrough walkthrough={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("is a muted video that loads nothing until asked, with a poster and a description", () => {
    const { container } = render(<ProjectWalkthrough walkthrough={walkthrough} />);
    const video = container.querySelector("video")!;
    expect(video.muted).toBe(true);
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.getAttribute("poster")).toBe(walkthrough.poster);
    expect(video.getAttribute("aria-label")).toBe(walkthrough.description);
    expect(video.hasAttribute("autoplay")).toBe(false);
  });

  it("shows a GIF only to people who allow motion, and its poster to everyone else", () => {
    const { container } = render(
      <ProjectWalkthrough walkthrough={{ ...walkthrough, src: "/media/projects/demo.gif" }} />,
    );
    const source = container.querySelector("source")!;
    expect(source.getAttribute("media")).toBe("(prefers-reduced-motion: no-preference)");
    const image = container.querySelector("img")!;
    expect(image.getAttribute("src")).toBe(walkthrough.poster);
    expect(image.getAttribute("loading")).toBe("lazy");
  });

  it("accepts only local files", () => {
    const base = content.projects.projects[0]!;
    const parse = (src: string) =>
      ProjectContentSchema.safeParse({ ...base, walkthrough: { ...walkthrough, src } }).success;
    expect(parse("/media/projects/demo.webm")).toBe(true);
    expect(parse("https://example.com/demo.mp4")).toBe(false);
  });

  it("fails the build when its file is missing", () => {
    const { contentDir } = contentCopy(({ projects }) => {
      projects.projects[0]!.walkthrough = walkthrough;
    });
    expect(() => readContent(contentDir)).toThrow(/does not exist/);
  });
});

describe("certification details", () => {
  const cert = (extra: Partial<PublicCertification> = {}): PublicCertification => ({
    issuer: "Cisco",
    course_name: "Introduction to Modern AI",
    is_prominent: true,
    display_order: 1,
    completed_on: null,
    credential_url: null,
    certificate_url: null,
    featured: false,
    ...extra,
  });

  it("shows no date, Verify link or Featured mark when none is set", () => {
    render(<CertificationsSection certifications={[cert()]} />);
    expect(screen.queryByText("Completed")).toBeNull();
    expect(screen.queryByRole("link", { name: /Verify/ })).toBeNull();
    expect(screen.queryByTestId("vault-featured")).toBeNull();
  });

  it("shows the date and a Verify link when they are set", () => {
    render(
      <CertificationsSection
        certifications={[
          cert({ completed_on: "March 2026", credential_url: "https://example.com/verify" }),
        ]}
      />,
    );
    expect(screen.getAllByText(/March 2026/).length).toBeGreaterThan(0);
    const verify = screen.getByRole("link", { name: /Verify/ });
    expect(verify.getAttribute("href")).toBe("https://example.com/verify");
  });

  it("marks a featured entry", () => {
    render(<CertificationsSection certifications={[cert({ featured: true })]} />);
    expect(screen.getByTestId("vault-featured")).toBeDefined();
  });

  it("hides nothing yet: no entry has a visibility set", () => {
    for (const c of content.certifications.certifications) expect(c.visibility).toBeUndefined();
  });

  it("accepts only the two visibility values", () => {
    const base = content.certifications.certifications[0]!;
    const parse = (visibility: string) =>
      CertificationContentSchema.safeParse({ ...base, visibility }).success;
    expect(parse("featured")).toBe(true);
    expect(parse("hidden")).toBe(true);
    expect(parse("secret")).toBe(false);
  });

  it("keeps a hidden entry in the database, out of the public query", () => {
    const { dir, contentDir } = contentCopy(({ certifications }) => {
      certifications.certifications[11]!.visibility = "hidden";
    });
    const outPath = path.join(dir, "t.db");
    buildDatabase({ contentDir, outPath });
    const db = new Database(outPath, { readonly: true });
    const count = (where: string) =>
      (db.prepare(`SELECT COUNT(*) AS n FROM certification ${where}`).get() as { n: number }).n;
    expect(count("")).toBe(12);
    expect(count("WHERE visibility <> 'hidden'")).toBe(11);
    db.close();
  });
});

describe("robots.txt and sitemap.xml", () => {
  it("are skipped when no site URL is set", () => {
    expect(seoFiles(undefined)).toEqual({});
    expect(seoFiles("  ")).toEqual({});
  });

  it("use the site URL when it is set", () => {
    const files = seoFiles("https://example.com");
    expect(files["robots.txt"]).toContain("Sitemap: https://example.com/sitemap.xml");
    expect(files["sitemap.xml"]).toContain("<loc>https://example.com/</loc>");
  });

  it("refuse an address that is not https", () => {
    expect(() => seoFiles("http://example.com")).toThrow(/https/);
  });
});

describe("link preview image", () => {
  it("is 1200 by 630, in public/social", () => {
    const png = fs.readFileSync(path.join(process.cwd(), "public", "social", "link-preview.png"));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});

describe("site URL", () => {
  it("accepts only a valid https address for metadata", () => {
    expect(parseSiteUrl(undefined)).toBeNull();
    expect(parseSiteUrl("  ")).toBeNull();
    expect(parseSiteUrl("not a url")).toBeNull();
    expect(parseSiteUrl("http://portfolio.example")).toBeNull();
    expect(parseSiteUrl("https://portfolio.example")?.origin).toBe("https://portfolio.example");
  });

  it("reports a missing, insecure, local or placeholder address as not releasable", () => {
    expect(siteUrlProblem(undefined)).toMatch(/not set/);
    expect(siteUrlProblem("http://aasveer.dev")).toMatch(/https/);
    for (const host of [
      "localhost",
      "127.0.0.1",
      "example.com",
      "site.example",
      "a.test",
      "a.invalid",
    ]) {
      expect(siteUrlProblem(`https://${host}`), host).toMatch(/not a production domain/);
    }
    expect(siteUrlProblem("https://aasveer.dev")).toBeNull();
  });

  it("builds the preview's alt text from the profile", () => {
    expect(
      linkPreviewAlt({ full_name: "A B", role: "Engineer", headline: "Engineer | RAG | Python" }),
    ).toBe("A B, Engineer. RAG · Python");
  });
});
