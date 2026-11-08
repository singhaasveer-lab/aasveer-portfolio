/**
 * Release-readiness check (`pnpm release:check`). Reads the content files and lists every
 * item that blocks a public release: missing content, wrong project order or unset deployment
 * configuration.
 * Exits with code 1 while any blocker remains. It never changes content.
 */
import { contactEndpoint } from "../src/lib/contact";
import { readContent } from "../src/lib/content/readContent";
import { siteUrlProblem } from "../src/lib/site";

const REQUIRED_ORDER = [
  "StudyForge AI",
  "PennyBloom",
  "InterviewIQ",
  "Wingman AI",
  "GiftBro AI",
  "SmartQueue AI",
];

function main() {
  const { profile, projects } = readContent();
  const blockers: string[] = [];
  const notes: string[] = [];

  const entries = projects.projects;
  const published = entries.filter((p) => p.publish_status === "published");
  for (const p of entries) {
    const reasons: string[] = [];
    if (p.repository_status !== "verified") reasons.push("repository URL not verified");
    if (p.publish_status !== "published") reasons.push('publish_status is not "published"');
    if (reasons.length) blockers.push(`${p.display_name}: ${reasons.join("; ")}`);
    if (p.role_status !== "approved") {
      notes.push(`${p.display_name}: no approved contribution statement, so none is shown.`);
    }
    if (p.review_note) notes.push(`${p.display_name}: ${p.review_note}`);
  }
  if (published.length !== REQUIRED_ORDER.length) {
    blockers.push(
      `Release requires exactly ${REQUIRED_ORDER.length} published projects; ${published.length} published.`,
    );
  }
  const order = published.map((p) => p.display_name);
  if (published.length === REQUIRED_ORDER.length && order.join("|") !== REQUIRED_ORDER.join("|")) {
    blockers.push(`Project order must be ${REQUIRED_ORDER.join(", ")}; found ${order.join(", ")}.`);
  }
  // links.email is intentionally null: the site publishes no email address, so none is required here.
  const siteProblem = siteUrlProblem(process.env.NEXT_PUBLIC_SITE_URL);
  if (siteProblem) {
    blockers.push(
      `${siteProblem}: set it to the real https domain, so canonical URL, link previews, robots.txt and sitemap.xml are written.`,
    );
  }
  if (!contactEndpoint(process.env.NEXT_PUBLIC_CONTACT_FORM_ENDPOINT)) {
    blockers.push(
      "NEXT_PUBLIC_CONTACT_FORM_ENDPOINT is not set to an https form endpoint: the contact form cannot send messages (see README, Production configuration).",
    );
  }
  if (!profile.links.resume_href) {
    blockers.push(
      "No resume location: set profile.links.resume_href, or the resume download cannot work.",
    );
  }
  notes.push(
    "Owner confirmation: Microsoft Learn issuer for 'Azure Database for PostgreSQL: Vector Search'.",
    "Manual: run `pnpm check:links` and confirm each repository by hand before setting repository_status.",
  );

  console.log("Release readiness\n=================");
  console.log(`Published projects: ${published.length}/${REQUIRED_ORDER.length}`);
  console.log(`\nBlockers (${blockers.length}):`);
  for (const b of blockers) console.log(`  - ${b}`);
  console.log(`\nNotes:`);
  for (const n of notes) console.log(`  - ${n}`);
  console.log(
    blockers.length
      ? "\nNOT READY FOR RELEASE. Resolve the blockers above."
      : "\nNo content blockers. Complete the manual checks before deploying.",
  );
  if (blockers.length) process.exitCode = 1;
}

main();
