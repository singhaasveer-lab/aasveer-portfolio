/**
 * Minimal static server for the exported site in out/. Used by `pnpm start`, Playwright and
 * Lighthouse. Serves files with explicit content types (JSON resources as application/json)
 * and never serves anything outside out/.
 *
 *   pnpm start            -> http://127.0.0.1:4173
 *   pnpm start --port 5000
 */
import fs from "node:fs";
import path from "node:path";
import { createServer } from "./serve-out-lib";

const OUT_DIR = path.resolve(process.cwd(), "out");

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (!fs.existsSync(path.join(OUT_DIR, "index.html"))) {
  console.error("[serve-out] out/index.html not found. Run `pnpm build` first.");
  process.exit(1);
}

const port = Number(argValue("--port") ?? process.env.PORT ?? 4173);
const host = argValue("--host") ?? "127.0.0.1";
createServer().listen(port, host, () => {
  console.log(`[serve-out] Serving out/ at http://${host}:${port}/`);
});
