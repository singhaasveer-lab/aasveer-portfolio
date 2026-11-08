import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDatabase } from "../../scripts/build-db";
import { ContentValidationError, readContent } from "../../src/lib/content/readContent";
import { contactDetails } from "../../src/lib/privacy";
import {
  ProjectContentSchema,
  SKILL_CATEGORIES,
  type CertificationsContent,
  type ProfileContent,
  type ProjectsContent,
} from "../../src/lib/validation/schemas";
import { CONTENT_DIR, RESUME_FIXTURE, makeContentDir, resumeTechStacks } from "../helpers";

const resumeText = fs.readFileSync(RESUME_FIXTURE, "utf8");
const content = readContent(CONTENT_DIR);

function tmpDb() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-db-")), "t.db");
}

describe("seed content", () => {
  it("validates all four content files", () => {
    expect(() => readContent(CONTENT_DIR)).not.toThrow();
  });

  it("has the eight resume skill categories in resume order", () => {
    expect(content.skills.groups.map((g) => g.category)).toEqual([...SKILL_CATEGORIES]);
  });

  it("uses only skills that appear in the resume, in the resume's order per category", () => {
    for (const group of content.skills.groups) {
      const line = resumeText.split(/\r?\n/).findIndex((l) => l.startsWith(`${group.category}:`));
      expect(line, `resume line for ${group.category}`).toBeGreaterThanOrEqual(0);
      // A category line may wrap; join the next line unless it starts another "Label:" line.
      const lines = resumeText.split(/\r?\n/);
      const next = lines[line + 1] ?? "";
      const continues =
        next.trim() !== "" && !/^[A-Z][\w /&+-]*:/.test(next) && !/^[A-Z &]+$/.test(next.trim());
      const text = `${lines[line]!.slice(group.category.length + 1)} ${continues ? next : ""}`;
      const resumeSkills = text.split(",").map((s) => s.replace(/\s+/g, " ").trim());
      const positions = group.skills.map((s) => resumeSkills.indexOf(s));
      positions.forEach((pos, i) =>
        expect(pos, `${group.skills[i]} in ${group.category}`).toBeGreaterThanOrEqual(0),
      );
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it("has twelve certifications, eight prominent, with names and issuers found in the resume", () => {
    const certs = content.certifications.certifications;
    expect(certs).toHaveLength(12);
    expect(certs.filter((c) => c.is_prominent)).toHaveLength(8);
    for (const c of certs) {
      expect(resumeText, c.course_name).toContain(c.course_name);
      expect(resumeText, c.issuer).toContain(c.issuer);
    }
  });

  it("marks exactly the eight featured courses as prominent", () => {
    const prominent = content.certifications.certifications
      .filter((c) => c.is_prominent)
      .map((c) => `${c.issuer}: ${c.course_name}`);
    expect(prominent).toEqual([
      "Anthropic Claude Academy: Claude Code 101",
      "Anthropic Claude Academy: Building with the Claude API",
      "IBM SkillsBuild: Introduction to Large Language Models",
      "IBM SkillsBuild: Machine Learning",
      "Google Cloud Skills Boost: Introduction to Generative AI",
      "Cisco: Introduction to Modern AI",
      "Microsoft Learn: Introduction to Prompt Engineering with GitHub",
      "Microsoft Learn: Azure Database for PostgreSQL: Vector Search",
    ]);
  });

  it("lists the six projects in display order", () => {
    expect(content.projects.projects.map((p) => p.display_name)).toEqual([
      "StudyForge AI",
      "PennyBloom",
      "InterviewIQ",
      "Wingman AI",
      "GiftBro AI",
      "SmartQueue AI",
    ]);
  });

  it("matches each project's technology list to the resume Tech Stack line exactly, in order", () => {
    const stacks = resumeTechStacks();
    // PennyBloom is newer than the resume, so its list comes from its source code.
    for (const p of content.projects.projects.filter((x) => x.slug !== "pennybloom")) {
      expect(stacks.get(p.resume_name), p.resume_name).toEqual(p.technologies);
    }
  });

  it("publishes all six projects with verified repositories (current seed state)", () => {
    for (const p of content.projects.projects) {
      expect(p.publish_status, p.slug).toBe("published");
      expect(p.repository_status, p.slug).toBe("verified");
    }
  });

  it("carries exactly the owner-approved contribution wording, and none for the others", () => {
    const roles = Object.fromEntries(
      content.projects.projects.map((p) => [p.slug, [p.role_status, p.role_statement]]),
    );
    expect(roles).toEqual({
      interviewiq: ["pending", null],
      "wingman-ai": ["approved", "Backend, local RAG and NLP, OCR, Reply Lab, and Dating Tips."],
      "giftbro-ai": [
        "approved",
        "TF-IDF, cosine similarity, weighted recommendation scoring and Gemini personalization.",
      ],
      "studyforge-ai": ["approved", "RAG, study planning, quizzes, NLP, FastAPI, and SQLite."],
      "smartqueue-ai": [
        "approved",
        "Queue management, token generation, queue-position information, wait-time estimation and staff dispatch.",
      ],
      pennybloom: ["pending", null],
    });
  });

  it("uses the owner's hero focus areas and a role line", () => {
    const profile = content.profile as ProfileContent;
    expect(profile.role).toBe("AI/ML Engineer");
    expect(profile.location).toBe("Amritsar, Punjab, India");
    expect(profile.focus_areas).toEqual([
      "Generative AI",
      "Large Language Models",
      "RAG",
      "NLP",
      "Machine Learning",
      "Recommendation Systems",
    ]);
  });

  it("takes each project's category from its resume heading", () => {
    const headings = resumeText
      .split(/\r?\n/)
      .map((l) => /^(.+?) \| (.+?)\s+(?:\w{3} )?\d{4}/.exec(l))
      .filter((m) => m !== null);
    for (const p of content.projects.projects) {
      if (p.slug === "pennybloom") continue; // Not on the resume.
      const heading = headings.find((m) => m[1] === p.resume_name);
      expect(heading?.[2], p.slug).toBe(p.category);
    }
  });

  it("claims nothing for PennyBloom that its source does not contain", () => {
    const penny = content.projects.projects.find((p) => p.slug === "pennybloom")!;
    expect(penny.repository_url).toBe("https://github.com/singhaasveer-lab/PennyBloom");
    expect(penny.demo_url).toBeNull();
    for (const absent of ["SQLite", "Gemini API", "JWT Authentication", "RAG"]) {
      expect(penny.technologies).not.toContain(absent);
    }
    const text = `${penny.problem_statement} ${penny.description}`.toLowerCase();
    for (const word of ["ai-powered", "machine learning", "bank", "invest", "login", "database"]) {
      expect(text).not.toContain(word);
    }
  });

  it("describes InterviewIQ's knowledge base as its source implements it", () => {
    const interview = content.projects.projects.find((p) => p.slug === "interviewiq")!;
    expect(interview.description).not.toContain("semantic search");
    expect(interview.description).toContain("keyword matches");
  });

  it("lists no technology for SmartQueue AI that its source never imports", () => {
    const smartqueue = content.projects.projects.find((p) => p.slug === "smartqueue-ai")!;
    for (const unused of ["Gemini API", "Google GenAI SDK", "Express", "Motion"]) {
      expect(smartqueue.technologies).not.toContain(unused);
    }
    expect(smartqueue.demo_url).toBeNull();
  });

  it("uses the approved GitHub, LinkedIn and resume links, and publishes no email address", () => {
    const profile = content.profile as ProfileContent;
    expect(profile.links.github_url).toBe("https://github.com/singhaasveer-lab");
    expect(profile.links.linkedin_url).toBe("https://linkedin.com/in/aasveer-singh");
    expect(profile.links.email).toBeNull();
    expect(profile.links.resume_href).toBe(
      "/resume/Aasveer_Singh_AI_ML_Engineer_Resume_v3_fnl.pdf",
    );
  });

  it("ships the approved resume as a real PDF at its public path, and no other public PDF", () => {
    const href = (content.profile as ProfileContent).links.resume_href!;
    const file = path.join(CONTENT_DIR, "..", "public", href);
    expect(fs.readFileSync(file).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const publicPdfs = fs
      .readdirSync(path.join(CONTENT_DIR, "..", "public"), { recursive: true })
      .map(String)
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .map((f) => `/${f.replaceAll("\\", "/")}`);
    expect(publicPdfs).toEqual([href]);
  });

  it("contains no phone number or email address anywhere in the content files", () => {
    for (const name of fs.readdirSync(CONTENT_DIR)) {
      const text = fs.readFileSync(path.join(CONTENT_DIR, name), "utf8");
      expect(contactDetails(text), name).toEqual([]);
      expect(text).not.toMatch(/\b\d{10}\b/);
    }
  });

  it("uses the exact education wording, with an en dash", () => {
    const e = content.profile.education;
    expect(`${e.degree}, ${e.institution}, ${e.period}`).toBe(
      "B.Tech, Computer Science & Engineering (AI/ML), Amritsar Group of Colleges, 2023–2027",
    );
  });
});

describe("publication rule (schema)", () => {
  const base = (content.projects as ProjectsContent).projects[0]!;

  it("accepts a published project without contribution wording (role pending)", () => {
    const r = ProjectContentSchema.safeParse({
      ...base,
      role_status: "pending",
      role_statement: null,
      publish_status: "published",
      repository_status: "verified",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an approved role with an empty statement", () => {
    const r = ProjectContentSchema.safeParse({
      ...base,
      role_status: "approved",
      role_statement: "   ",
      publish_status: "published",
      repository_status: "verified",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a published project whose repository is unverified", () => {
    const r = ProjectContentSchema.safeParse({
      ...base,
      role_status: "approved",
      role_statement: "Approved wording.",
      publish_status: "published",
      repository_status: "unverified",
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("repository_status");
  });

  it("rejects wording while the role is still pending", () => {
    const r = ProjectContentSchema.safeParse({
      ...base,
      role_status: "pending",
      role_statement: "Unapproved wording.",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a published project with approved wording and a verified repository", () => {
    const r = ProjectContentSchema.safeParse({
      ...base,
      role_status: "approved",
      role_statement: "Approved wording.",
      publish_status: "published",
      repository_status: "verified",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-https repository URL and a malformed slug", () => {
    expect(
      ProjectContentSchema.safeParse({ ...base, repository_url: "http://x.dev" }).success,
    ).toBe(false);
    expect(ProjectContentSchema.safeParse({ ...base, slug: "Bad Slug" }).success).toBe(false);
  });
});

describe("scripts/build-db.ts", () => {
  it("builds the database from the seed files", () => {
    const outPath = tmpDb();
    const summary = buildDatabase({ outPath });
    expect(summary).toMatchObject({
      skills: 55,
      projects: 6,
      publishedProjects: 6,
      certifications: 12,
      prominentCertifications: 8,
    });
    const db = new Database(outPath, { readonly: true });
    expect(db.pragma("foreign_key_check")).toEqual([]);
    const techCount = db.prepare("SELECT COUNT(*) AS n FROM project_technology").get() as {
      n: number;
    };
    expect(techCount.n).toBe(11 + 10 + 9 + 7 + 6 + 8);
    db.close();
  });

  it("fails, naming the file and field, when a project is published with an unverified repository", () => {
    const dir = makeContentDir((files) => {
      (files["projects.json"] as ProjectsContent).projects[0]!.repository_status = "unverified";
    });
    const outPath = tmpDb();
    let error: unknown;
    try {
      buildDatabase({ contentDir: dir, outPath });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ContentValidationError);
    expect((error as Error).message).toContain("projects.json");
    expect((error as Error).message).toContain("projects.0.publish_status");
    expect(fs.existsSync(outPath)).toBe(false);
  });

  it("fails when a certification is duplicated", () => {
    const dir = makeContentDir((files) => {
      const c = files["certifications.json"] as CertificationsContent;
      c.certifications.push({ ...c.certifications[0]!, display_order: 99 });
    });
    expect(() => buildDatabase({ contentDir: dir, outPath: tmpDb() })).toThrow(/duplicate/);
  });

  it("fails when a skill category is renamed or reordered", () => {
    const dir = makeContentDir((files) => {
      const s = files["skills.json"] as { groups: { category: string }[] };
      [s.groups[0], s.groups[1]] = [s.groups[1]!, s.groups[0]!];
    });
    expect(() => buildDatabase({ contentDir: dir, outPath: tmpDb() })).toThrow(/skills\.json/);
  });

  it("enforces the publish rule in SQL as well as in Zod", () => {
    const outPath = tmpDb();
    buildDatabase({ outPath });
    const db = new Database(outPath);
    // A published row needs a verified repository.
    expect(() =>
      db
        .prepare("UPDATE project SET repository_status = 'unverified' WHERE slug = 'interviewiq'")
        .run(),
    ).toThrow(/CHECK constraint/);
    // A pending role never carries wording; an approved one always does.
    expect(() =>
      db.prepare("UPDATE project SET role_statement = 'x' WHERE slug = 'interviewiq'").run(),
    ).toThrow(/CHECK constraint/);
    expect(() =>
      db.prepare("UPDATE project SET role_status = 'approved' WHERE slug = 'interviewiq'").run(),
    ).toThrow(/CHECK constraint/);
    db.close();
  });

  it("counts only published entries", () => {
    const dir = makeContentDir((files) => {
      const p = (files["projects.json"] as ProjectsContent).projects[0]!;
      p.publish_status = "draft";
      p.repository_status = "unverified";
    });
    const summary = buildDatabase({ contentDir: dir, outPath: tmpDb() });
    expect(summary.publishedProjects).toBe(5);
  });
});
