import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";
import {
  AboutContentSchema,
  EvidenceContentSchema,
  CapabilityContentSchema,
  CasebookContentSchema,
  ArchitectureContentSchema,
  LabContentSchema,
  SkillMapContentSchema,
  type ExplorerContent,
} from "../explorer/schema";
import { explorerReferenceIssues } from "../explorer/validate";
import {
  CertificationsContentSchema,
  ProfileContentSchema,
  ProjectsContentSchema,
  SkillsContentSchema,
  type CertificationsContent,
  type ProfileContent,
  type ProjectsContent,
  type SkillsContent,
} from "../validation/schemas";

/** A walkthrough names local files, so a missing one fails the build rather than the page. */
function missingMedia(projects: ProjectsContent, publicDir: string) {
  return projects.projects.flatMap((p, i) =>
    p.walkthrough
      ? (["src", "poster"] as const)
          .filter((key) => !fs.existsSync(path.join(publicDir, p.walkthrough![key])))
          .map((key) => ({
            path: `projects.${i}.walkthrough.${key}`,
            message: `${p.slug}: public${p.walkthrough![key]} does not exist`,
          }))
      : [],
  );
}

export interface PortfolioContent {
  profile: ProfileContent;
  skills: SkillsContent;
  projects: ProjectsContent;
  certifications: CertificationsContent;
  explorer: ExplorerContent;
}

/** A seed-content error that names the file and field, so the build message is actionable. */
export class ContentValidationError extends Error {
  readonly code = "DATA_INVALID" as const;
  constructor(
    readonly file: string,
    readonly issues: { path: string; message: string }[],
  ) {
    super(
      `DATA_INVALID in ${file}:\n` +
        issues.map((i) => `  - ${i.path || "(root)"}: ${i.message}`).join("\n"),
    );
    this.name = "ContentValidationError";
  }
}

function readJson(file: string): unknown {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    throw new ContentValidationError(file, [
      { path: "", message: "file is missing or unreadable" },
    ]);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new ContentValidationError(file, [
      { path: "", message: `invalid JSON: ${(err as Error).message}` },
    ]);
  }
}

function parseFile<S extends z.ZodType>(file: string, schema: S): z.infer<S> {
  const result = schema.safeParse(readJson(file));
  if (!result.success) {
    throw new ContentValidationError(
      file,
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

/** Reads and validates the content files. Throws ContentValidationError on the first invalid file. */
export function readContent(contentDir = path.join(process.cwd(), "content")): PortfolioContent {
  const rel = (name: string) => path.join(contentDir, name);
  const skills = parseFile(rel("skills.json"), SkillsContentSchema);
  const projects = parseFile(rel("projects.json"), ProjectsContentSchema);
  const { skills: mapSkills, edges } = parseFile(rel("skill-map.json"), SkillMapContentSchema);
  const { review_notes: _aboutNotes, ...about } = parseFile(rel("about.json"), AboutContentSchema);
  void _aboutNotes;
  const explorer: ExplorerContent = {
    about,
    lab: parseFile(rel("lab.json"), LabContentSchema).modules,
    architectures: parseFile(rel("architecture.json"), ArchitectureContentSchema).architectures,
    skillMap: { skills: mapSkills, edges },
    capabilities: parseFile(rel("capabilities.json"), CapabilityContentSchema).capabilities,
    casebook: parseFile(rel("casebook.json"), CasebookContentSchema).cases,
    evidence: (({ review_notes: _notes, ...rest }) => (void _notes, rest))(
      parseFile(rel("evidence.json"), EvidenceContentSchema),
    ),
  };

  const media = missingMedia(projects, path.join(contentDir, "..", "public"));
  if (media.length > 0) throw new ContentValidationError(rel("projects.json"), media);

  const issues = explorerReferenceIssues(explorer, projects, skills);
  if (issues.length > 0) throw new ContentValidationError(rel(issues[0]!.file), issues);

  return {
    profile: parseFile(rel("profile.json"), ProfileContentSchema),
    skills,
    projects,
    certifications: parseFile(rel("certifications.json"), CertificationsContentSchema),
    explorer,
  };
}
