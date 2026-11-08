import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDatabase } from "../../scripts/build-db";
import { closeDb, getDb } from "../../src/lib/db/client";
import { contentFingerprint, schemaFingerprint } from "../../src/lib/db/fingerprint";
import { getProfile } from "../../src/lib/db/queries";
import { contactDetails } from "../../src/lib/privacy";
import { CONTENT_DIR, ROOT, makeContentDir } from "../helpers";

/*
 * Regression: a database generated from an older db/schema.sql (no profile.role column) was kept
 * open by a running dev server while the code moved on, and the page failed with
 * "SqliteError: no such column: role". The builder now records fingerprints of its sources and
 * the client checks them before any query runs.
 */

const previousPath = process.env.PORTFOLIO_DB_PATH;
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  if (previousPath === undefined) delete process.env.PORTFOLIO_DB_PATH;
  else process.env.PORTFOLIO_DB_PATH = previousPath;
});

const tmpFile = () =>
  path.join(fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-fresh-")), "portfolio.db");

/** The profile table exactly as the database generated on 2026-10-30 had it: no role column. */
function legacyDatabase(file: string) {
  const db = new Database(file);
  db.exec(`CREATE TABLE profile (
    id INTEGER PRIMARY KEY, full_name TEXT, headline TEXT, status_label TEXT, summary TEXT,
    location TEXT, education_degree TEXT, education_institution TEXT, education_period TEXT,
    github_url TEXT, linkedin_url TEXT, email TEXT, resume_href TEXT)`);
  db.prepare(
    `INSERT INTO profile VALUES (1, 'Aasveer Singh', 'h', 's', 'x', 'l', 'd', 'i', 'p',
       'https://github.com/singhaasveer-lab', 'https://linkedin.com/in/aasveer-singh', NULL, NULL)`,
  ).run();
  db.close();
}

describe("database schema contract", () => {
  it("records the fingerprints of the schema and content it was built from", () => {
    const file = tmpFile();
    buildDatabase({ outPath: file });
    const db = new Database(file, { readonly: true });
    const info = Object.fromEntries(
      (
        db.prepare("SELECT key, value FROM build_info").all() as { key: string; value: string }[]
      ).map((r) => [r.key, r.value]),
    );
    db.close();
    expect(info.schema_hash).toBe(schemaFingerprint(path.join(ROOT, "db", "schema.sql")));
    expect(info.content_hash).toBe(contentFingerprint(CONTENT_DIR));
  });

  it("gives the profile table every column the profile query reads", () => {
    const file = tmpFile();
    buildDatabase({ outPath: file });
    const db = new Database(file, { readonly: true });
    const columns = (db.prepare("PRAGMA table_info(profile)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    db.close();
    const source = fs.readFileSync(path.join(ROOT, "src", "lib", "db", "queries.ts"), "utf8");
    const select = /SELECT ([\s\S]+?)\s+FROM profile/.exec(source)![1]!;
    for (const column of select.split(",").map((c) => c.trim())) {
      expect(columns, `profile.${column}`).toContain(column);
    }
  });
});

describe("stale database detection", () => {
  it("refuses a database built from an older schema, naming the fix, outside development", () => {
    const file = tmpFile();
    legacyDatabase(file);
    process.env.PORTFOLIO_DB_PATH = file;
    expect(() => getDb()).toThrow(/out of date.*pnpm db:build/);
    expect(() => getProfile()).toThrow(/out of date/);
  });

  it("refuses a database whose recorded schema no longer matches db/schema.sql", () => {
    const file = tmpFile();
    buildDatabase({ outPath: file });
    const db = new Database(file);
    db.prepare("UPDATE build_info SET value = 'older' WHERE key = 'schema_hash'").run();
    db.close();
    process.env.PORTFOLIO_DB_PATH = file;
    expect(() => getDb()).toThrow(/db\/schema\.sql has changed/);
  });

  it("rebuilds a legacy database in development, preserving the profile and contact data", () => {
    const file = tmpFile();
    legacyDatabase(file);
    process.env.PORTFOLIO_DB_PATH = file;
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "info").mockImplementation(() => {});
    const profile = getProfile()!;
    expect(profile.full_name).toBe("Aasveer Singh");
    expect(profile.role).toBe("AI/ML Engineer");
    expect(profile.links.email).toBeNull();
    expect(profile.links.resume_href).toBe(
      "/resume/Aasveer_Singh_AI_ML_Engineer_Resume_v3_fnl.pdf",
    );
    expect(contactDetails(JSON.stringify(profile))).toEqual([]);
  });

  it("picks up content edits in development without a restart", () => {
    const dir = makeContentDir();
    const file = tmpFile();
    buildDatabase({ contentDir: dir, outPath: file });
    process.env.PORTFOLIO_DB_PATH = file;
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["Date"] });
    expect(getProfile()!.role).toBe("AI/ML Engineer");

    const profilePath = path.join(dir, "profile.json");
    const json = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    fs.writeFileSync(profilePath, JSON.stringify({ ...json, role: "Machine Learning Engineer" }));
    vi.setSystemTime(Date.now() + 5000);
    expect(getProfile()!.role).toBe("Machine Learning Engineer");
  });
});
