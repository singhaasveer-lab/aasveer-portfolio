import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";
import {
  getAllProjectsForReview,
  getCertifications,
  getExplorerDocuments,
  getProfile,
  getPublishedProjects,
  getSkillGroups,
} from "../db/queries";
import {
  AboutDocumentSchema,
  EvidenceDocumentSchema,
  CapabilityDocumentSchema,
  CasebookDocumentSchema,
  ArchitectureDocumentSchema,
  LabDocumentSchema,
  SkillMapDocumentSchema,
  type ExplorerContent,
} from "../explorer/schema";
import {
  PublicCertificationSchema,
  ProfileSchema,
  PublicProjectSchema,
  SKILL_CATEGORIES,
  SkillGroupSchema,
  type Links,
  type Profile,
  type ProjectHighlight,
  type ProjectWalkthrough,
  type PublicCertification,
  type SkillGroup,
} from "../validation/schemas";
import { isPreviewEnabled } from "./preview";

/**
 * The shape a project card renders. In production every field comes from a published entry, so
 * role_statement and repository_url are always set. In the development preview they are null
 * until the owner approves the wording and verifies the repository.
 */
export interface ProjectView {
  slug: string;
  display_name: string;
  category: string;
  problem_statement: string;
  description: string;
  technologies: string[];
  role_statement: string | null;
  repository_url: string | null;
  demo_url: string | null;
  /** True when public/images/projects/<slug>.webp exists. */
  has_screenshot: boolean;
  highlights: ProjectHighlight[];
  walkthrough: ProjectWalkthrough | null;
}

export interface Portfolio {
  profile: Profile;
  links: Links;
  skillGroups: SkillGroup[];
  certifications: PublicCertification[];
  projects: ProjectView[];
  /** Laboratory, architecture, skill-map and About content, limited to the projects shown. */
  explorer: ExplorerContent;
  /** True only under `pnpm dev:preview`. Never true in a production build. */
  preview: boolean;
}

export class PortfolioDataError extends Error {
  constructor(
    readonly code: "DATA_INVALID" | "DATA_MISSING",
    readonly query: string,
    detail: string,
  ) {
    super(`${code} from ${query}(): ${detail}`);
    this.name = "PortfolioDataError";
  }
}

const hasScreenshot = (slug: string) =>
  fs.existsSync(path.join(process.cwd(), "public", "images", "projects", `${slug}.webp`));

function validate<S extends z.ZodType>(query: string, schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new PortfolioDataError("DATA_INVALID", query, detail);
  }
  return result.data;
}

/** Keeps only what belongs to the projects on the page, so a draft project can never appear. */
function loadExplorer(projects: ProjectView[]): ExplorerContent {
  const documents = getExplorerDocuments();
  const shown = new Set(projects.map((p) => p.slug));
  const query = "getExplorerDocuments";
  const lab = validate(query, LabDocumentSchema, documents.lab);
  const architectures = validate(query, ArchitectureDocumentSchema, documents.architecture);
  const skillMap = validate(query, SkillMapDocumentSchema, documents.skill_map);
  const about = validate(query, AboutDocumentSchema, documents.about);
  const evidence = validate(query, EvidenceDocumentSchema, documents.evidence);
  const records = evidence.records
    .map((r) => ({ ...r, applications: r.applications.filter((a) => shown.has(a.project)) }))
    .filter((r) => r.applications.length > 0);

  const edges = skillMap.edges.filter((e) => shown.has(e.project));
  const modules = lab
    .map((module) => ({
      ...module,
      stages: module.stages.map((stage) => ({
        ...stage,
        notes: stage.notes.filter((n) => shown.has(n.project)),
      })),
    }))
    .filter((module) => module.stages.every((stage) => stage.notes.length > 0));
  const capabilities = validate(query, CapabilityDocumentSchema, documents.capabilities)
    .map(({ lab: module, ...c }) => ({
      ...c,
      projects: c.projects.filter((p) => shown.has(p.slug)),
      // A capability leads to its Laboratory module only while that module is shown.
      ...(module && modules.some((m) => m.id === module) ? { lab: module } : {}),
    }))
    .filter((c) => c.projects.length > 0);
  return {
    about: {
      ...about,
      process: {
        ...about.process,
        stages: about.process.stages.filter((s) => shown.has(s.example.project)),
      },
    },
    lab: modules,
    capabilities,
    casebook: validate(query, CasebookDocumentSchema, documents.casebook).filter((c) =>
      shown.has(c.project),
    ),
    architectures: architectures.filter((a) => shown.has(a.slug)),
    evidence: {
      records,
      quick_view: evidence.quick_view.filter(
        (q) => shown.has(q.project) && records.some((r) => r.id === q.record),
      ),
    },
    skillMap: {
      skills: skillMap.skills.filter((s) => edges.some((e) => e.skill === s.id)),
      edges,
    },
  };
}

/**
 * Loads all page data at build time. Calls the shared query functions directly and never
 * imports or invokes the API route handlers. Throws on invalid or missing data, which
 * fails the build, so a partial page is never produced.
 */
export function loadPortfolio(): Portfolio {
  const profileRow = getProfile();
  if (!profileRow) throw new PortfolioDataError("DATA_MISSING", "getProfile", "no profile row");
  const profile = validate("getProfile", ProfileSchema, profileRow);

  const skillGroups = validate("getSkillGroups", SkillGroupSchema.array(), getSkillGroups());
  const categories = skillGroups.map((g) => g.category).join("|");
  if (categories !== SKILL_CATEGORIES.join("|")) {
    throw new PortfolioDataError(
      "DATA_INVALID",
      "getSkillGroups",
      `expected the resume categories in order, got: ${categories}`,
    );
  }

  const certifications = validate(
    "getCertifications",
    PublicCertificationSchema.array(),
    getCertifications(),
  );

  const preview = isPreviewEnabled();
  const projects: ProjectView[] = preview
    ? // Development preview: every entry from content/projects.json, in display order. Unapproved
      // role statements and unverified repository (and demo) links are withheld, never shown.
      getAllProjectsForReview().map((p) => {
        const verified = p.repository_status === "verified";
        return {
          slug: p.slug,
          display_name: p.display_name,
          category: p.category,
          problem_statement: p.problem_statement,
          description: p.description,
          technologies: p.technologies,
          role_statement: p.role.status === "approved" ? p.role.statement : null,
          repository_url: verified ? p.repository_url : null,
          demo_url: verified ? p.demo_url : null,
          has_screenshot: hasScreenshot(p.slug),
          highlights: p.highlights,
          walkthrough: p.walkthrough,
        };
      })
    : validate("getPublishedProjects", PublicProjectSchema.array(), getPublishedProjects()).map(
        (p) => ({
          slug: p.slug,
          display_name: p.display_name,
          category: p.category,
          problem_statement: p.problem_statement,
          description: p.description,
          technologies: p.technologies,
          role_statement: p.role.statement,
          repository_url: p.repository_url,
          demo_url: p.demo_url,
          has_screenshot: hasScreenshot(p.slug),
          highlights: p.highlights,
          walkthrough: p.walkthrough,
        }),
      );

  return {
    profile,
    links: profile.links,
    skillGroups,
    certifications,
    projects,
    explorer: loadExplorer(projects),
    preview,
  };
}
