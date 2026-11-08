/**
 * Lighthouse on the production build: three mobile runs against out/, served locally. The target is
 * a median performance score of at least 90 and a median LCP of at most 2.5 s.
 * Records each run and the median performance score and LCP in lighthouse-reports/summary.json.
 * Uses CHROME_PATH, else an installed Chrome or Edge, else Playwright's Chromium. Run `pnpm build` first.
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { createServer } from "./serve-out-lib";

const RUNS = 3;
const REPORT_DIR = path.join(process.cwd(), "lighthouse-reports");

/** Runs a command without blocking the event loop, so the in-process static server keeps serving. */
function runCommand(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

async function main() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  // Playwright's Chromium first: an installed Edge stopped launching for Lighthouse on this machine.
  const installed = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].find((p) => fs.existsSync(p));
  const bundled = chromium.executablePath();
  const chromePath = process.env.CHROME_PATH ?? (fs.existsSync(bundled) ? bundled : installed);
  if (!chromePath) throw new Error("No browser found. Set CHROME_PATH.");
  console.log(`[lighthouse] browser: ${chromePath}`);
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const cli = path.join(process.cwd(), "node_modules", "lighthouse", "cli", "index.js");

  const runs: {
    performance: number;
    accessibility: number;
    lcpMs: number;
    cls: number;
    tbtMs: number;
  }[] = [];
  for (let i = 1; i <= RUNS; i++) {
    const out = path.join(REPORT_DIR, `mobile-run-${i}.json`);
    // A failed run must never pass off an earlier report as its own result.
    fs.rmSync(out, { force: true });
    const result = await runCommand(
      process.execPath,
      [
        cli,
        url,
        "--quiet",
        "--output=json",
        `--output-path=${out}`,
        "--only-categories=performance,accessibility,best-practices,seo",
        "--form-factor=mobile",
        "--throttling-method=simulate",
        "--chrome-flags=--headless=new",
      ],
      { ...process.env, CHROME_PATH: chromePath },
    );
    if (!fs.existsSync(out)) {
      server.close();
      throw new Error(`Lighthouse run ${i} produced no report.\n${result.stderr}`);
    }
    const lhr = JSON.parse(fs.readFileSync(out, "utf8"));
    const run = {
      performance: Math.round(lhr.categories.performance.score * 100),
      accessibility: Math.round(lhr.categories.accessibility.score * 100),
      lcpMs: Math.round(lhr.audits["largest-contentful-paint"].numericValue),
      cls: Number(lhr.audits["cumulative-layout-shift"].numericValue.toFixed(3)),
      tbtMs: Math.round(lhr.audits["total-blocking-time"].numericValue),
    };
    runs.push(run);
    console.log(`run ${i}: ${JSON.stringify(run)}`);
  }
  server.close();

  const summary = {
    measuredAt: new Date().toISOString(),
    url: "local static server over out/",
    formFactor: "mobile (Lighthouse default simulated throttling)",
    runs,
    median: {
      performance: median(runs.map((r) => r.performance)),
      lcpMs: median(runs.map((r) => r.lcpMs)),
      accessibility: median(runs.map((r) => r.accessibility)),
    },
    targets: { performance: ">= 90", lcpMs: "<= 2500" },
  };
  fs.writeFileSync(path.join(REPORT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`median: ${JSON.stringify(summary.median)}`);
  const met = summary.median.performance >= 90 && summary.median.lcpMs <= 2500;
  console.log(met ? "Performance target met on this machine." : "Performance target NOT met.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
