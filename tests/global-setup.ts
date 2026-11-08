import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDatabase } from "../scripts/build-db";

/**
 * Builds a fresh database from content/ for this test run, in a temporary directory, so tests
 * never contend with a dev server that holds data/portfolio.db open. Test workers inherit
 * PORTFOLIO_DB_PATH from this process.
 */
export default function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-test-db-"));
  const outPath = path.join(dir, "portfolio.db");
  buildDatabase({ outPath });
  process.env.PORTFOLIO_DB_PATH = outPath;
  return () => fs.rmSync(dir, { recursive: true, force: true });
}
