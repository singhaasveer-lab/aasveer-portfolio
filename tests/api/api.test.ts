import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET as certificationsGET } from "../../src/app/api/certifications.json/route";
import { GET as profileGET } from "../../src/app/api/profile.json/route";
import { GET as projectsGET } from "../../src/app/api/projects.json/route";
import { errorBody, successBody } from "../../src/lib/api/envelope";
import {
  CertificationsEnvelopeSchema,
  ErrorEnvelopeSchema,
  ProfileEnvelopeSchema,
  ProjectsEnvelopeSchema,
  SKILL_CATEGORIES,
  type ProjectsContent,
} from "../../src/lib/validation/schemas";
import { ROOT, makeContentDir, useTemporaryDatabase } from "../helpers";

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

async function body(res: Response) {
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  return res.json();
}

describe("envelope builders", () => {
  it("build the success and error envelopes", () => {
    expect(successBody([1])).toEqual({ data: [1] });
    expect(ErrorEnvelopeSchema.parse(errorBody("DATA_MISSING", "no row"))).toEqual({
      error: { code: "DATA_MISSING", message: "no row" },
    });
  });
});

describe("route handlers (seed data)", () => {
  it("GET /api/profile.json returns the profile envelope with eight ordered skill groups", async () => {
    const json = ProfileEnvelopeSchema.parse(await body(profileGET()));
    expect(json.data.full_name).toBe("Aasveer Singh");
    expect(json.data.skill_groups.map((g) => g.category)).toEqual([...SKILL_CATEGORIES]);
    // The site publishes no email address; the public profile JSON must carry none either.
    expect(json.data.links.email).toBeNull();
    expect(json.data.links.resume_href).toBe(
      "/resume/Aasveer_Singh_AI_ML_Engineer_Resume_v3_fnl.pdf",
    );
  });

  it("GET /api/projects.json lists the six published projects, wording only where approved", async () => {
    const json = ProjectsEnvelopeSchema.parse(await body(projectsGET()));
    expect(json.data.map((p) => p.slug)).toEqual([
      "studyforge-ai",
      "pennybloom",
      "interviewiq",
      "wingman-ai",
      "giftbro-ai",
      "smartqueue-ai",
    ]);
    for (const p of json.data) {
      expect(p.role.status === "approved" || p.role.statement === null, p.slug).toBe(true);
    }
  });

  it("GET /api/certifications.json returns all twelve, eight prominent, in display order", async () => {
    const json = CertificationsEnvelopeSchema.parse(await body(certificationsGET()));
    expect(json.data).toHaveLength(12);
    expect(json.data.filter((c) => c.is_prominent)).toHaveLength(8);
    expect(json.data.map((c) => c.display_order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe("route handlers (publication fixture)", () => {
  it("publishes only published, verified entries, in display order, with ordered technologies", async () => {
    restore = useTemporaryDatabase(
      makeContentDir((files) => {
        for (const p of (files["projects.json"] as ProjectsContent).projects) {
          if (p.slug !== "giftbro-ai" && p.slug !== "interviewiq") p.publish_status = "draft";
        }
      }),
    );
    const json = ProjectsEnvelopeSchema.parse(await body(projectsGET()));
    expect(json.data.map((p) => p.slug)).toEqual(["interviewiq", "giftbro-ai"]);
    expect(json.data[0]!.technologies).toEqual([
      "React 19",
      "TypeScript",
      "Tailwind CSS",
      "Python",
      "FastAPI",
      "SQLAlchemy",
      "SQLite",
      "JWT Authentication",
      "Gemini API",
      "Vite",
      "Express",
    ]);
    // InterviewIQ has no approved wording; GiftBro AI carries the owner's approved wording.
    expect(json.data.map((p) => [p.slug, p.role.status, p.role.statement])).toEqual([
      ["interviewiq", "pending", null],
      [
        "giftbro-ai",
        "approved",
        "TF-IDF, cosine similarity, weighted recommendation scoring and Gemini personalization.",
      ],
    ]);
    // No internal workflow fields leak into the public resource.
    for (const p of json.data) {
      expect(Object.keys(p).sort()).toEqual(
        [
          "slug",
          "display_name",
          "resume_name",
          "category",
          "period",
          "problem_statement",
          "description",
          "technologies",
          "role",
          "repository_url",
          "demo_url",
          "highlights",
          "walkthrough",
        ].sort(),
      );
    }
  });

  it("returns an error envelope (not partial data) when required data is missing", async () => {
    restore = useTemporaryDatabase(makeContentDir());
    const Database = (await import("better-sqlite3")).default;
    const { closeDb } = await import("../../src/lib/db/client");
    closeDb();
    const db = new Database(process.env.PORTFOLIO_DB_PATH!);
    db.prepare("DELETE FROM profile").run();
    db.close();
    const res = profileGET();
    expect(res.status).toBe(500);
    const json = ErrorEnvelopeSchema.parse(await res.json());
    expect(json.error.code).toBe("DATA_MISSING");
  });
});

describe("generated static files in out/api (run `pnpm build` first)", () => {
  const outApi = path.join(ROOT, "out", "api");
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(outApi, name), "utf8"));

  it("exist for all three resources", () => {
    for (const name of ["profile.json", "projects.json", "certifications.json"]) {
      expect(fs.existsSync(path.join(outApi, name)), `out/api/${name}`).toBe(true);
    }
  });

  it("validate against their response schemas and apply publication filtering", () => {
    expect(ProfileEnvelopeSchema.safeParse(read("profile.json")).success).toBe(true);
    const projects = ProjectsEnvelopeSchema.parse(read("projects.json"));
    expect(projects.data).toHaveLength(6);
    expect(
      projects.data.every((p) => p.role.status === "approved" || p.role.statement === null),
    ).toBe(true);
    const certs = CertificationsEnvelopeSchema.parse(read("certifications.json"));
    expect(certs.data).toHaveLength(12);
    expect(certs.data.filter((c) => c.is_prominent)).toHaveLength(8);
  });

  it("match what the route handlers return for the current content", async () => {
    expect(read("projects.json")).toEqual(await projectsGET().json());
    expect(read("certifications.json")).toEqual(await certificationsGET().json());
    expect(read("profile.json")).toEqual(await profileGET().json());
  });
});
