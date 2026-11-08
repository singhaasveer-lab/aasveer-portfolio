import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/*
 * Fingerprints of the database's two sources. scripts/build-db.ts records both in the build_info
 * table; src/lib/db/client.ts compares them with the files on disk, so a database built from an
 * older schema (or, during development, older content) is detected instead of failing later
 * with errors such as "no such column".
 */

export const defaultSchemaPath = () => path.join(process.cwd(), "db", "schema.sql");
export const defaultContentDir = () => path.join(process.cwd(), "content");

/** Line endings are normalised so a checkout with CRLF files yields the same fingerprint. */
const hash = (text: string) =>
  createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex").slice(0, 16);

export function schemaFingerprint(schemaPath = defaultSchemaPath()): string {
  return hash(fs.readFileSync(schemaPath, "utf8"));
}

export function contentFingerprint(contentDir = defaultContentDir()): string {
  const files = fs
    .readdirSync(contentDir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  return hash(
    files
      .map((name) => `${name}\n${fs.readFileSync(path.join(contentDir, name), "utf8")}`)
      .join("\n\0\n"),
  );
}
