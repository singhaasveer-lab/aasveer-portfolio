import path from "node:path";

/** Location of the build-time database. Tests may point PORTFOLIO_DB_PATH at a temporary file. */
export function databasePath(): string {
  return process.env.PORTFOLIO_DB_PATH ?? path.join(process.cwd(), "data", "portfolio.db");
}
