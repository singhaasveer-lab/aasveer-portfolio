/**
 * Requests every external link in the content files and reports the result.
 * Run before release (`pnpm check:links`), not on every commit. Some hosts (LinkedIn in
 * particular) block automated requests, so confirm each failure by hand before treating it
 * as broken. A passing check here does not mark a repository as verified: the owner sets
 * repository_status to "verified" only after checking the repository by hand.
 */
import { readContent } from "../src/lib/content/readContent";

interface LinkResult {
  label: string;
  url: string;
  status: number | null;
  finalUrl: string | null;
  note: string;
}

async function probe(label: string, url: string): Promise<LinkResult> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (portfolio link check)" },
      signal: AbortSignal.timeout(15_000),
    });
    const note =
      res.status === 999 || res.status === 429
        ? "blocked or rate-limited by the host; check by hand"
        : res.ok
          ? "reachable"
          : "not reachable";
    return { label, url, status: res.status, finalUrl: res.url, note };
  } catch (err) {
    return {
      label,
      url,
      status: null,
      finalUrl: null,
      note: `request failed: ${(err as Error).message}`,
    };
  }
}

async function main() {
  const { profile, projects } = readContent();
  const targets: [string, string][] = [
    ["GitHub profile", profile.links.github_url],
    ["LinkedIn profile", profile.links.linkedin_url],
  ];
  if (profile.links.resume_href?.startsWith("https://")) {
    targets.push(["Resume", profile.links.resume_href]);
  }
  for (const p of projects.projects) {
    targets.push([`${p.display_name} repository (${p.repository_status})`, p.repository_url]);
    if (p.demo_url) targets.push([`${p.display_name} demo`, p.demo_url]);
  }

  const results = await Promise.all(targets.map(([label, url]) => probe(label, url)));
  let failures = 0;
  for (const r of results) {
    const ok = r.status !== null && r.status >= 200 && r.status < 400;
    if (!ok) failures++;
    console.log(
      `${ok ? "ok  " : "FAIL"}  ${String(r.status ?? "---").padEnd(4)} ${r.label}\n        ${r.url}` +
        (r.finalUrl && r.finalUrl !== r.url ? `\n        -> ${r.finalUrl}` : "") +
        `\n        ${r.note}`,
    );
  }
  console.log(`\n[check-links] ${results.length - failures}/${results.length} reachable.`);
  if (failures) process.exitCode = 1;
}

void main();
