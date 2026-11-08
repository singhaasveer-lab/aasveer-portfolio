import { getDb } from "./client";

/**
 * Named, read-only query functions. The only code that reads the database.
 * Called directly by src/lib/data/loadPortfolio.ts and by the API route handlers;
 * neither of those calls the other.
 */

export interface ProfileRow {
  full_name: string;
  headline: string;
  status_label: string;
  role: string;
  intro: string;
  focus_areas: string[];
  summary: string;
  location: string;
  education: { degree: string; institution: string; period: string };
  links: {
    github_url: string;
    linkedin_url: string;
    email: string | null;
    resume_href: string | null;
  };
}

export interface SkillGroupRow {
  category: string;
  skills: string[];
}

export interface ProjectRow {
  slug: string;
  display_name: string;
  resume_name: string;
  category: string;
  period: string | null;
  problem_statement: string;
  description: string;
  technologies: string[];
  role: { status: string; statement: string | null };
  repository_url: string;
  demo_url: string | null;
  highlights: { value: string; label: string }[];
  walkthrough: { src: string; poster: string; description: string } | null;
}

export interface CertificationRow {
  issuer: string;
  course_name: string;
  is_prominent: boolean;
  display_order: number;
  completed_on: string | null;
  credential_url: string | null;
  certificate_url: string | null;
  featured: boolean;
}

interface RawProfile {
  full_name: string;
  headline: string;
  status_label: string;
  role: string;
  intro: string;
  focus_areas: string;
  summary: string;
  location: string;
  education_degree: string;
  education_institution: string;
  education_period: string;
  github_url: string;
  linkedin_url: string;
  email: string | null;
  resume_href: string | null;
}

interface RawProject {
  id: number;
  slug: string;
  display_name: string;
  resume_name: string;
  category: string;
  period: string | null;
  problem_statement: string;
  description: string;
  role_statement: string | null;
  role_status: string;
  repository_url: string;
  demo_url: string | null;
  walkthrough_src: string | null;
  walkthrough_poster: string | null;
  walkthrough_description: string | null;
}

export function getProfile(): ProfileRow | null {
  const row = getDb()
    .prepare<[], RawProfile>(
      `SELECT full_name, headline, status_label, role, intro, focus_areas, summary, location,
              education_degree, education_institution, education_period,
              github_url, linkedin_url, email, resume_href
         FROM profile WHERE id = 1`,
    )
    .get();
  if (!row) return null;
  return {
    full_name: row.full_name,
    headline: row.headline,
    status_label: row.status_label,
    role: row.role,
    intro: row.intro,
    focus_areas: JSON.parse(row.focus_areas) as string[],
    summary: row.summary,
    location: row.location,
    education: {
      degree: row.education_degree,
      institution: row.education_institution,
      period: row.education_period,
    },
    links: {
      github_url: row.github_url,
      linkedin_url: row.linkedin_url,
      email: row.email,
      resume_href: row.resume_href,
    },
  };
}

/** The Laboratory, architecture, skill-map and About documents, parsed but not yet validated. */
export function getExplorerDocuments(): Record<string, unknown> {
  const rows = getDb()
    .prepare<[], { key: string; document: string }>(`SELECT key, document FROM explorer_document`)
    .all();
  return Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.document) as unknown]));
}

export function getSkillGroups(): SkillGroupRow[] {
  const rows = getDb()
    .prepare<[], { category: string; name: string }>(
      `SELECT category, name FROM skill ORDER BY display_order`,
    )
    .all();
  const groups: SkillGroupRow[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last && last.category === row.category) last.skills.push(row.name);
    else groups.push({ category: row.category, skills: [row.name] });
  }
  return groups;
}

function technologiesFor(projectId: number): string[] {
  return getDb()
    .prepare<[number], { name: string }>(
      `SELECT name FROM project_technology WHERE project_id = ? ORDER BY position`,
    )
    .all(projectId)
    .map((r) => r.name);
}

function highlightsFor(projectId: number): ProjectRow["highlights"] {
  return getDb()
    .prepare<[number], { value: string; label: string }>(
      `SELECT value, label FROM project_highlight WHERE project_id = ? ORDER BY position`,
    )
    .all(projectId);
}

function toProjectRow(row: RawProject): ProjectRow {
  return {
    slug: row.slug,
    display_name: row.display_name,
    resume_name: row.resume_name,
    category: row.category,
    period: row.period,
    problem_statement: row.problem_statement,
    description: row.description,
    technologies: technologiesFor(row.id),
    role: { status: row.role_status, statement: row.role_statement },
    repository_url: row.repository_url,
    demo_url: row.demo_url,
    highlights: highlightsFor(row.id),
    walkthrough:
      row.walkthrough_src && row.walkthrough_poster && row.walkthrough_description
        ? {
            src: row.walkthrough_src,
            poster: row.walkthrough_poster,
            description: row.walkthrough_description,
          }
        : null,
  };
}

const PROJECT_COLUMNS = `id, slug, display_name, resume_name, category, period, problem_statement, description,
  role_statement, role_status, repository_url, demo_url,
  walkthrough_src, walkthrough_poster, walkthrough_description`;

/**
 * Published projects in display order. Both publication gates (published, verified repository)
 * are applied here as well as in the CHECK constraint and the seed validation, so a draft can
 * never leak. Wording for a pending role is removed here too, so it can never be shown.
 */
export function getPublishedProjects(): ProjectRow[] {
  return getDb()
    .prepare<[], RawProject>(
      `SELECT ${PROJECT_COLUMNS} FROM project
        WHERE publish_status = 'published'
          AND repository_status = 'verified'
        ORDER BY display_order`,
    )
    .all()
    .map(toProjectRow);
}

/**
 * Every project, including drafts. Development preview and release checks only.
 * Never used by the API route handlers or by a production page render.
 */
export function getAllProjectsForReview(): (ProjectRow & {
  publish_status: string;
  repository_status: string;
})[] {
  return getDb()
    .prepare<[], RawProject & { publish_status: string; repository_status: string }>(
      `SELECT ${PROJECT_COLUMNS}, publish_status, repository_status FROM project ORDER BY display_order`,
    )
    .all()
    .map((row) => ({
      ...toProjectRow(row),
      publish_status: row.publish_status,
      repository_status: row.repository_status,
    }));
}

export function getCertifications(): CertificationRow[] {
  return getDb()
    .prepare<
      [],
      Omit<CertificationRow, "is_prominent" | "featured"> & {
        is_prominent: number;
        visibility: string;
      }
    >(
      `SELECT issuer, course_name, is_prominent, display_order, completed_on, credential_url,
              certificate_url, visibility
         FROM certification WHERE visibility <> 'hidden' ORDER BY display_order`,
    )
    .all()
    .map(({ visibility, ...r }) => ({
      ...r,
      is_prominent: r.is_prominent === 1,
      featured: visibility === "featured",
    }));
}
