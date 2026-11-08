import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDatabase } from "../scripts/build-db";
import { closeDb } from "../src/lib/db/client";

export const ROOT = path.resolve(__dirname, "..");
export const CONTENT_DIR = path.join(ROOT, "content");
export const RESUME_FIXTURE = path.join(ROOT, "tests", "fixtures", "resume.txt");

export function readJson<T = unknown>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

/** Copies content/ to a temporary directory and lets the test change any file. */
export function makeContentDir(
  mutate: (files: Record<string, unknown>) => void = () => {},
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-content-"));
  const files: Record<string, unknown> = {};
  for (const name of fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".json"))) {
    files[name] = readJson(path.join(CONTENT_DIR, name));
  }
  mutate(files);
  for (const [name, value] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2));
  }
  return dir;
}

/**
 * Builds a database from a content directory into a temporary file and points the query
 * layer at it. Returns a restore function that switches back to the default database.
 */
export function useTemporaryDatabase(contentDir: string): () => void {
  const previous = process.env.PORTFOLIO_DB_PATH;
  const outPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-db-")), "test.db");
  buildDatabase({ contentDir, outPath });
  closeDb();
  process.env.PORTFOLIO_DB_PATH = outPath;
  return () => {
    closeDb();
    if (previous === undefined) delete process.env.PORTFOLIO_DB_PATH;
    else process.env.PORTFOLIO_DB_PATH = previous;
  };
}

/**
 * Parses each project's "Tech Stack:" line from the resume fixture, following line wraps.
 * Keyed by the resume heading name (text before " | ").
 */
export function resumeTechStacks(): Map<string, string[]> {
  const lines = fs.readFileSync(RESUME_FIXTURE, "utf8").split(/\r?\n/);
  const stacks = new Map<string, string[]>();
  let current: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const heading = /^(.+?) \| /.exec(line);
    if (heading && !line.startsWith("Tech Stack:")) current = heading[1]!;
    if (line.startsWith("Tech Stack:") && current) {
      let text = line.slice("Tech Stack:".length);
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j]!.trim();
        if (!next || next.includes(" | ") || /^[A-Z &]+$/.test(next) || next.startsWith("GitHub:"))
          break;
        text += ` ${next}`;
        i = j;
      }
      stacks.set(
        current,
        text
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      );
    }
  }
  return stacks;
}
