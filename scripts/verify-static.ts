/**
 * Post-build verification of the static export (runs at the end of `pnpm build`).
 *
 * Checks (Architecture Section 4, "Build verification for the static JSON files"):
 *  - out/api/{profile,projects,certifications}.json exist, with no extensionless API outputs
 *  - each file parses and validates against its response schema
 *  - projects.json holds only published entries, with wording only for approved roles; certifications.json holds every entry not marked hidden
 *  - each file is served with a JSON content type by the local static server
 * Plus release-safety checks across all of out/:
 *  - no draft project text, unverified repository URL, phone number, private file or database
 *  - no development-preview marker
 *  - no email or resume link while the content withholds them
 */
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { readContent } from "../src/lib/content/readContent";
import { contactDetails } from "../src/lib/privacy";
import { parseSiteUrl } from "../src/lib/site";
import { seoFiles } from "../src/lib/seo";
import {
  CertificationsEnvelopeSchema,
  ProfileEnvelopeSchema,
  ProjectsEnvelopeSchema,
} from "../src/lib/validation/schemas";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "out");
const failures: string[] = [];
const passes: string[] = [];

function check(ok: boolean, message: string) {
  (ok ? passes : failures).push(message);
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

async function main() {
  if (!fs.existsSync(path.join(OUT, "index.html"))) {
    console.error("[verify-static] out/index.html is missing. Run `pnpm build` first.");
    process.exit(1);
  }

  const apiDir = path.join(OUT, "api");
  const resources = {
    "profile.json": ProfileEnvelopeSchema,
    "projects.json": ProjectsEnvelopeSchema,
    "certifications.json": CertificationsEnvelopeSchema,
  } as const;

  const parsed: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(resources)) {
    const file = path.join(apiDir, name);
    if (!fs.existsSync(file)) {
      check(false, `out/api/${name} exists`);
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(fs.readFileSync(file, "utf8"));
      check(true, `out/api/${name} is valid JSON`);
    } catch {
      check(false, `out/api/${name} is valid JSON`);
      continue;
    }
    const result = schema.safeParse(json);
    check(
      result.success,
      `out/api/${name} matches its response schema` +
        (result.success ? "" : `: ${result.error.issues.map((i) => i.message).join("; ")}`),
    );
    parsed[name] = result.success ? result.data : null;
  }

  const apiEntries = fs.existsSync(apiDir) ? fs.readdirSync(apiDir) : [];
  check(
    apiEntries.every((e) => e.endsWith(".json")),
    `out/api contains only .json outputs (found: ${apiEntries.join(", ")})`,
  );

  const content = readContent();
  const projects = parsed["projects.json"] as {
    data: { slug: string; role: { status: string; statement: string | null } }[];
  } | null;
  if (projects) {
    const publishedSlugs = content.projects.projects
      .filter((p) => p.publish_status === "published")
      .map((p) => p.slug);
    check(
      JSON.stringify(projects.data.map((p) => p.slug)) === JSON.stringify(publishedSlugs),
      `projects.json lists exactly the published entries in order (${publishedSlugs.length})`,
    );
    check(
      projects.data.every((p) => p.role.status === "approved" || p.role.statement === null),
      "projects.json carries contribution wording only where the owner approved it",
    );
  }
  const certs = parsed["certifications.json"] as { data: { is_prominent: boolean }[] } | null;
  if (certs) {
    const listed = content.certifications.certifications.filter((c) => c.visibility !== "hidden");
    check(
      certs.data.length === listed.length,
      `certifications.json has ${listed.length} entries (${certs.data.length})`,
    );
    check(
      certs.data.filter((c) => c.is_prominent).length ===
        listed.filter((c) => c.is_prominent).length,
      "certifications.json keeps its prominent entries",
    );
  }

  // ---- Release-safety scan over every text file in out/ ----
  const files = walk(OUT);
  const textFiles = files.filter((f) => /\.(html|json|txt|js|css|xml|webmanifest)$/.test(f));
  const corpus = textFiles.map((f) => ({ f, text: fs.readFileSync(f, "utf8") }));
  const found = (needle: string | RegExp) =>
    corpus
      .filter(({ text }) =>
        typeof needle === "string" ? text.includes(needle) : needle.test(text),
      )
      .map(({ f }) => path.relative(ROOT, f));

  for (const p of content.projects.projects.filter((x) => x.publish_status !== "published")) {
    const leaks = [...found(p.problem_statement), ...found(p.repository_url)];
    check(
      leaks.length === 0,
      `draft "${p.slug}" text and repository URL are absent from out/ ${leaks.join(", ")}`,
    );
  }
  const home = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
  check(
    [
      'id="about"',
      'id="engineering-connections"',
      'id="evidence"',
      'id="ai-lab"',
      "NEXUS / EXPLORE",
    ].every((text) => home.includes(text)),
    "About, Engineering Connections, the Evidence Engine, the AI Systems Laboratory and NEXUS launcher are in the page",
  );
  check(
    !home.includes('id="skill-map"') && !home.includes("exploration-network"),
    "the Skill Connection Matrix and Areas of Exploration are gone",
  );
  // Contact details are found by their shape; no real address or number is stored in this code.
  const allowedEmails = content.profile.links.email ? [content.profile.links.email] : [];
  const contactLeaks = corpus
    .map(({ f, text }) => ({ f, kinds: contactDetails(text, { allowedEmails }) }))
    .filter(({ kinds }) => kinds.length > 0)
    .map(({ f, kinds }) => `${path.relative(ROOT, f)} (${kinds.join(", ")})`);
  check(
    contactLeaks.length === 0,
    `no email address, phone number or contact link in out/ ${contactLeaks.join("; ")}`,
  );
  const previewLeaks = found("DEVELOPMENT PREVIEW");
  check(
    previewLeaks.length === 0,
    `no development-preview marker in out/ ${previewLeaks.join(", ")}`,
  );
  // The link preview image always ships; the page links it only with a valid site URL.
  check(
    fs.existsSync(path.join(OUT, "social", "link-preview.png")),
    "out/social/link-preview.png exists",
  );
  const localhost = found(/https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)[:/]/);
  check(localhost.length === 0, `nothing in out/ points at localhost ${localhost.join(", ")}`);
  const site = parseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const meta = (attr: string) =>
    new RegExp(
      `<(?:meta|link)[^>]*(?:property|name|rel)="${attr}"[^>]*(?:content|href)="([^"]+)"`,
    ).exec(home)?.[1] ?? null;
  if (site) {
    const origin = site.origin;
    for (const tag of ["og:image", "twitter:image", "canonical"]) {
      const value = meta(tag);
      check(!!value && value.startsWith(origin), `${tag} is an absolute URL on ${origin}`);
    }
  } else {
    check(
      !meta("og:image") && !meta("twitter:image") && !meta("canonical"),
      "no canonical URL or link preview tags without NEXT_PUBLIC_SITE_URL (release:check reports it)",
    );
  }
  const seo = Object.keys(seoFiles(process.env.NEXT_PUBLIC_SITE_URL));
  for (const name of ["robots.txt", "sitemap.xml"]) {
    check(
      fs.existsSync(path.join(OUT, name)) === seo.includes(name),
      `out/${name} ${seo.includes(name) ? "exists" : "is skipped without a site URL"}`,
    );
  }

  const resumeHref = content.profile.links.resume_href;
  const resumeFile = resumeHref ? path.join(OUT, resumeHref) : null;
  const privateFiles = files.filter(
    (f) =>
      /\.(db|sqlite|db-journal|tmp)$/i.test(f) ||
      (/\.pdf$/i.test(f) && path.resolve(f) !== (resumeFile && path.resolve(resumeFile))),
  );
  check(
    privateFiles.length === 0,
    `no database, temporary or unapproved PDF files in out/ ${privateFiles.map((f) => path.relative(ROOT, f)).join(", ")}`,
  );
  if (resumeFile) {
    check(
      fs.existsSync(resumeFile) &&
        fs.readFileSync(resumeFile).subarray(0, 5).toString("latin1") === "%PDF-",
      `the approved resume is a PDF at out${resumeHref}`,
    );
  }
  check(!fs.existsSync(path.join(OUT, "private")), "no private/ directory in out/");

  // ---- Content types from the local static server ----
  const { createServer } = await import("./serve-out-lib");
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  for (const name of Object.keys(resources)) {
    const res = await fetch(`http://127.0.0.1:${port}/api/${name}`);
    const type = res.headers.get("content-type") ?? "";
    check(
      res.status === 200 && type.startsWith("application/json"),
      `GET /api/${name} -> ${res.status} ${type}`,
    );
  }
  if (resumeHref) {
    const res = await fetch(`http://127.0.0.1:${port}${resumeHref}`);
    const type = res.headers.get("content-type") ?? "";
    check(
      res.status === 200 && type.startsWith("application/pdf"),
      `GET ${resumeHref} -> ${res.status} ${type}`,
    );
  }
  server.close();

  for (const p of passes) console.log(`  ok    ${p}`);
  for (const f of failures) console.log(`  FAIL  ${f}`);
  if (failures.length) {
    console.error(`[verify-static] ${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log(`[verify-static] all ${passes.length} checks passed.`);
}

main().catch((err) => {
  console.error("[verify-static] INTERNAL_ERROR", err);
  process.exit(1);
});
