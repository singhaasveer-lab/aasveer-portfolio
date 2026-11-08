/**
 * Builds the portfolio database (data/portfolio.db by default) from content/*.json and
 * db/schema.sql. Used by scripts/build-db.ts, by the tests, and by src/lib/db/client.ts to
 * rebuild a stale database during development.
 *
 * 1. Validates every content file with Zod (fails with the file and field on error).
 * 2. Creates a fresh database in a temporary file, applies the schema, inserts all rows and
 *    records the schema and content fingerprints in build_info.
 * 3. Runs PRAGMA foreign_key_check and integrity_check.
 * 4. Replaces the previous database only on success, so a failed build never leaves a partial file.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { readContent, type PortfolioContent } from "../content/readContent";
import { contentFingerprint, schemaFingerprint } from "./fingerprint";

export interface BuildDbOptions {
  contentDir?: string;
  schemaPath?: string;
  outPath?: string;
}

export interface BuildDbSummary {
  outPath: string;
  skills: number;
  projects: number;
  publishedProjects: number;
  certifications: number;
  prominentCertifications: number;
}

export function insertContent(db: Database.Database, content: PortfolioContent): void {
  const { profile, skills, projects, certifications, explorer } = content;

  db.prepare(
    `INSERT INTO profile (id, full_name, headline, status_label, role, intro, focus_areas,
       summary, location, education_degree, education_institution, education_period,
       github_url, linkedin_url, email, resume_href)
     VALUES (1, @full_name, @headline, @status_label, @role, @intro, @focus_areas,
       @summary, @location,
       @degree, @institution, @period, @github_url, @linkedin_url, @email, @resume_href)`,
  ).run({
    full_name: profile.full_name,
    headline: profile.headline,
    status_label: profile.status_label,
    role: profile.role,
    intro: profile.intro,
    focus_areas: JSON.stringify(profile.focus_areas),
    summary: profile.summary,
    location: profile.location,
    ...profile.education,
    ...profile.links,
  });

  const insertSkill = db.prepare(
    `INSERT INTO skill (category, name, display_order) VALUES (?, ?, ?)`,
  );
  let order = 0;
  for (const group of skills.groups) {
    for (const name of group.skills) insertSkill.run(group.category, name, ++order);
  }

  const insertProject = db.prepare(
    `INSERT INTO project (slug, display_name, resume_name, category, period, problem_statement, description,
       role_statement, role_status, publish_status, repository_url, repository_status, demo_url, display_order,
       walkthrough_src, walkthrough_poster, walkthrough_description)
     VALUES (@slug, @display_name, @resume_name, @category, @period, @problem_statement, @description,
       @role_statement, @role_status, @publish_status, @repository_url, @repository_status, @demo_url,
       @display_order, @walkthrough_src, @walkthrough_poster, @walkthrough_description)`,
  );
  const insertTech = db.prepare(
    `INSERT INTO project_technology (project_id, position, name) VALUES (?, ?, ?)`,
  );
  const insertHighlight = db.prepare(
    `INSERT INTO project_highlight (project_id, position, value, label) VALUES (?, ?, ?, ?)`,
  );
  for (const project of projects.projects) {
    // review_note is an editorial comment in the content file and is never stored.
    const { technologies, highlights, walkthrough, review_note: _reviewNote, ...row } = project;
    void _reviewNote;
    const { lastInsertRowid } = insertProject.run({
      ...row,
      walkthrough_src: walkthrough?.src ?? null,
      walkthrough_poster: walkthrough?.poster ?? null,
      walkthrough_description: walkthrough?.description ?? null,
    });
    technologies.forEach((name, i) => insertTech.run(lastInsertRowid, i + 1, name));
    highlights.forEach((h, i) => insertHighlight.run(lastInsertRowid, i + 1, h.value, h.label));
  }

  const insertCert = db.prepare(
    `INSERT INTO certification (issuer, course_name, is_prominent, display_order, completed_on, credential_url, certificate_url, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const c of certifications.certifications) {
    insertCert.run(
      c.issuer,
      c.course_name,
      c.is_prominent ? 1 : 0,
      c.display_order,
      c.completed_on ?? null,
      c.credential_url ?? null,
      c.certificate_url ?? null,
      c.visibility ?? "standard",
    );
  }

  const insertDocument = db.prepare(`INSERT INTO explorer_document (key, document) VALUES (?, ?)`);
  insertDocument.run("lab", JSON.stringify(explorer.lab));
  insertDocument.run("architecture", JSON.stringify(explorer.architectures));
  insertDocument.run("skill_map", JSON.stringify(explorer.skillMap));
  insertDocument.run("about", JSON.stringify(explorer.about));
  insertDocument.run("evidence", JSON.stringify(explorer.evidence));
  insertDocument.run("capabilities", JSON.stringify(explorer.capabilities));
  insertDocument.run("casebook", JSON.stringify(explorer.casebook));
}

/** Records what the database was built from, for the freshness check in client.ts. */
function recordBuildInfo(
  db: Database.Database,
  sources: { schemaPath: string; contentDir: string },
) {
  const insert = db.prepare(`INSERT INTO build_info (key, value) VALUES (?, ?)`);
  insert.run("schema_hash", schemaFingerprint(sources.schemaPath));
  insert.run("content_hash", contentFingerprint(sources.contentDir));
  insert.run("schema_path", path.resolve(sources.schemaPath));
  insert.run("content_dir", path.resolve(sources.contentDir));
}

export function buildDatabase(options: BuildDbOptions = {}): BuildDbSummary {
  const root = process.cwd();
  const contentDir = options.contentDir ?? path.join(root, "content");
  const schemaPath = options.schemaPath ?? path.join(root, "db", "schema.sql");
  const outPath =
    options.outPath ?? process.env.PORTFOLIO_DB_PATH ?? path.join(root, "data", "portfolio.db");

  const content = readContent(contentDir);
  const schema = fs.readFileSync(schemaPath, "utf8");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tmpPath = `${outPath}.${process.pid}.tmp`;
  fs.rmSync(tmpPath, { force: true });

  const db = new Database(tmpPath);
  try {
    db.pragma("foreign_keys = ON");
    db.exec(schema);
    db.transaction(() => {
      insertContent(db, content);
      recordBuildInfo(db, { schemaPath, contentDir });
    })();

    const fkProblems = db.pragma("foreign_key_check") as unknown[];
    if (fkProblems.length > 0) {
      throw new Error(`DATA_INVALID: foreign_key_check returned ${fkProblems.length} row(s)`);
    }
    const integrity = db.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") {
      throw new Error(`INTERNAL_ERROR: integrity_check returned ${String(integrity)}`);
    }

    const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    const summary: BuildDbSummary = {
      outPath,
      skills: count("SELECT COUNT(*) AS n FROM skill"),
      projects: count("SELECT COUNT(*) AS n FROM project"),
      publishedProjects: count(
        "SELECT COUNT(*) AS n FROM project WHERE publish_status = 'published'",
      ),
      certifications: count("SELECT COUNT(*) AS n FROM certification"),
      prominentCertifications: count(
        "SELECT COUNT(*) AS n FROM certification WHERE is_prominent = 1",
      ),
    };
    db.close();
    try {
      fs.rmSync(outPath, { force: true });
      fs.renameSync(tmpPath, outPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EBUSY" || code === "EPERM") {
        throw new Error(
          `INTERNAL_ERROR: ${outPath} is in use (a running "next dev" server keeps it open on Windows). ` +
            "Stop the dev server and run the command again.",
        );
      }
      throw err;
    }
    return summary;
  } catch (err) {
    if (db.open) db.close();
    fs.rmSync(tmpPath, { force: true });
    throw err;
  }
}
