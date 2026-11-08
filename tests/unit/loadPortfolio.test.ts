import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPortfolio } from "../../src/lib/data/loadPortfolio";
import { isPreviewEnabled } from "../../src/lib/data/preview";
import { SKILL_CATEGORIES, type ProjectsContent } from "../../src/lib/validation/schemas";
import { ROOT, makeContentDir, useTemporaryDatabase } from "../helpers";

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
  vi.unstubAllEnvs();
});

const ORDER = [
  "StudyForge AI",
  "PennyBloom",
  "InterviewIQ",
  "Wingman AI",
  "GiftBro AI",
  "SmartQueue AI",
];

/** Takes GiftBro AI back to an unchecked draft, to exercise the publication gates. */
const draftGiftBro = (files: Record<string, unknown>) => {
  const p = (files["projects.json"] as ProjectsContent).projects.find(
    (x) => x.slug === "giftbro-ai",
  )!;
  p.publish_status = "draft";
  p.repository_status = "unverified";
};

describe("loadPortfolio()", () => {
  it("returns one typed object from the shared queries", () => {
    const p = loadPortfolio();
    expect(p.profile.full_name).toBe("Aasveer Singh");
    expect(p.profile.role).toBe("AI/ML Engineer");
    expect(p.profile.focus_areas).toEqual([
      "Generative AI",
      "Large Language Models",
      "RAG",
      "NLP",
      "Machine Learning",
      "Recommendation Systems",
    ]);
    expect(p.links).toEqual(p.profile.links);
    expect(p.skillGroups.map((g) => g.category)).toEqual([...SKILL_CATEGORIES]);
    expect(p.certifications).toHaveLength(12);
    expect(p.preview).toBe(false);
  });

  it("returns all six published projects in display order, with verified links", () => {
    const { projects } = loadPortfolio();
    expect(projects.map((x) => x.display_name)).toEqual(ORDER);
    expect(projects.every((x) => x.repository_url?.startsWith("https://github.com/"))).toBe(true);
  });

  it("shows contribution wording only where the owner approved it", () => {
    const roles = Object.fromEntries(
      loadPortfolio().projects.map((p) => [p.slug, p.role_statement]),
    );
    expect(roles).toEqual({
      interviewiq: null,
      "wingman-ai": "Backend, local RAG and NLP, OCR, Reply Lab, and Dating Tips.",
      "giftbro-ai":
        "TF-IDF, cosine similarity, weighted recommendation scoring and Gemini personalization.",
      "studyforge-ai": "RAG, study planning, quizzes, NLP, FastAPI, and SQLite.",
      "smartqueue-ai":
        "Queue management, token generation, queue-position information, wait-time estimation and staff dispatch.",
      pennybloom: null,
    });
  });

  it("leaves a draft out of the production data", () => {
    restore = useTemporaryDatabase(makeContentDir(draftGiftBro));
    expect(loadPortfolio().projects.map((x) => x.slug)).not.toContain("giftbro-ai");
  });

  it("does not import the API route handlers", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/lib/data/loadPortfolio.ts"), "utf8");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(imports.some((i) => /app\/api|lib\/api|route/.test(i!))).toBe(false);
    expect(imports).toContain("../db/queries");
  });
});

describe("development preview switch", () => {
  it("is on only with the development server and PORTFOLIO_PREVIEW=1", () => {
    vi.stubEnv("PORTFOLIO_PREVIEW", "1");
    vi.stubEnv("NODE_ENV", "production");
    expect(isPreviewEnabled()).toBe(false);
    vi.stubEnv("NODE_ENV", "test");
    expect(isPreviewEnabled()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(isPreviewEnabled()).toBe(true);
    vi.stubEnv("PORTFOLIO_PREVIEW", "");
    expect(isPreviewEnabled()).toBe(false);
  });

  it("shows a draft in the preview with its unverified link withheld, never in production", () => {
    restore = useTemporaryDatabase(makeContentDir(draftGiftBro));
    vi.stubEnv("PORTFOLIO_PREVIEW", "1");
    vi.stubEnv("NODE_ENV", "development");
    const preview = loadPortfolio();
    expect(preview.preview).toBe(true);
    expect(preview.projects.map((p) => p.display_name)).toEqual(ORDER);
    const gift = preview.projects.find((p) => p.slug === "giftbro-ai")!;
    expect(gift.repository_url).toBeNull();
    expect(gift.demo_url).toBeNull();
    vi.stubEnv("NODE_ENV", "production");
    expect(loadPortfolio().projects.map((p) => p.slug)).not.toContain("giftbro-ai");
  });
});
