/**
 * `pnpm db:build`: builds data/portfolio.db from content/*.json and db/schema.sql.
 * The builder itself lives in src/lib/db/build.ts.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildDatabase } from "../src/lib/db/build";

export { buildDatabase, insertContent } from "../src/lib/db/build";
export type { BuildDbOptions, BuildDbSummary } from "../src/lib/db/build";

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  try {
    const s = buildDatabase();
    console.log(
      `[build-db] ${path.relative(process.cwd(), s.outPath)}: ${s.skills} skills, ` +
        `${s.projects} projects (${s.publishedProjects} published), ` +
        `${s.certifications} certifications (${s.prominentCertifications} prominent)`,
    );
  } catch (err) {
    console.error(`[build-db] FAILED\n${(err as Error).message}`);
    process.exit(1);
  }
}
