import { z } from "zod";

/**
 * Schemas for the Laboratory, architecture and skill-map content. Field rules live here; rules
 * that span files, such as an edge naming a real project, live in ./validate.ts.
 */

const nonEmpty = z.string().trim().min(1);
const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const reviewNotes = z.array(z.string()).optional();

const CodeExcerptSchema = z.strictObject({ source: nonEmpty, text: nonEmpty });

const WeightSchema = z.strictObject({ label: nonEmpty, value: z.number().gt(0).lte(1) });

const StageNoteSchema = z.strictObject({
  project: id,
  /** "not_used": this project has no such stage, and the Laboratory says so. */
  status: z.enum(["implemented", "not_used"]),
  summary: nonEmpty,
  input: nonEmpty,
  output: nonEmpty,
  code: CodeExcerptSchema.optional(),
  weights: z.array(WeightSchema).optional(),
});

const LabStageSchema = z.strictObject({
  id,
  label: nonEmpty,
  layer: id,
  concept: nonEmpty,
  notes: z.array(StageNoteSchema).min(1),
});

const LabModuleSchema = z.strictObject({
  id,
  label: nonEmpty,
  short: nonEmpty,
  command: nonEmpty,
  keywords: z.array(nonEmpty),
  intro: nonEmpty,
  simulator: z.literal("queue").optional(),
  layers: z.array(z.strictObject({ id, label: nonEmpty, description: nonEmpty })).min(1),
  stages: z.array(LabStageSchema).min(2),
});

export const LabDocumentSchema = z.array(LabModuleSchema).min(1);
export const LabContentSchema = z.strictObject({
  review_notes: reviewNotes,
  modules: LabDocumentSchema,
});

export const NODE_KINDS = [
  "interface",
  "server",
  "service",
  "pipeline",
  "ai",
  "data",
  "output",
] as const;

const ArchitectureNodeSchema = z.strictObject({
  id,
  label: nonEmpty,
  kind: z.enum(NODE_KINDS),
  responsibility: nonEmpty,
  inputs: z.array(nonEmpty).min(1),
  outputs: z.array(nonEmpty).min(1),
  technologies: z.array(nonEmpty).min(1),
  source: nonEmpty,
});

const ArchitectureViewSchema = z.strictObject({
  cols: z.number().int().min(1).max(6),
  rows: z.number().int().min(1).max(6),
  at: z.record(id, z.tuple([z.number().min(0), z.number().min(0)])),
  edges: z.array(z.tuple([id, id, nonEmpty])).min(1),
  flows: z.array(z.strictObject({ label: nonEmpty, path: z.array(id).min(2) })).optional(),
});

const ArchitectureSchema = z.strictObject({
  slug: id,
  summary: nonEmpty,
  nodes: z.array(ArchitectureNodeSchema).min(2),
  system: ArchitectureViewSchema,
  engineering: ArchitectureViewSchema,
});

export const ArchitectureDocumentSchema = z.array(ArchitectureSchema).min(1);
export const ArchitectureContentSchema = z.strictObject({
  review_notes: reviewNotes,
  architectures: ArchitectureDocumentSchema,
});

const MapSkillSchema = z.strictObject({
  id,
  label: nonEmpty,
  /** The exact name in content/skills.json. */
  skill: nonEmpty,
  lab: id.optional(),
  explanation: nonEmpty,
});

const MapEdgeSchema = z.strictObject({
  skill: id,
  project: id,
  note: nonEmpty,
  evidence: nonEmpty,
});

export const SkillMapDocumentSchema = z.strictObject({
  skills: z.array(MapSkillSchema).min(1),
  edges: z.array(MapEdgeSchema).min(1),
});
export const SkillMapContentSchema = SkillMapDocumentSchema.extend({ review_notes: reviewNotes });

const AboutStageSchema = z.strictObject({
  id,
  label: nonEmpty,
  explanation: nonEmpty,
  example: z.strictObject({ project: id, text: nonEmpty }),
});

const PerspectiveStageSchema = z.strictObject({
  id,
  label: nonEmpty,
  annotation: nonEmpty,
  explanation: nonEmpty,
  /** Interests and skills this stage rests on, from this file and content/skills.json. */
  grounded_in: z.array(nonEmpty).min(1),
});

const PrincipleSchema = z.strictObject({ id, label: nonEmpty, text: nonEmpty });

export const AboutDocumentSchema = z.strictObject({
  eyebrow: nonEmpty,
  /** The section's statement, one entry per line. */
  headline: z.array(nonEmpty).min(1),
  /** Phrases within the headline set in the accent colour. */
  headline_accent: z.array(nonEmpty),
  intro: nonEmpty,
  interests: z.array(nonEmpty).min(1),
  perspective: z.strictObject({ note: nonEmpty, stages: z.array(PerspectiveStageSchema).min(2) }),
  principles: z.array(PrincipleSchema).min(1),
  /** Phrases the hero cycles through under the role. */
  role_loop: z.array(nonEmpty).min(2),
  /** The owner's real photograph. Null shows an abstract pattern, never a stand-in face. */
  portrait: z.strictObject({
    src: z
      .string()
      .regex(/^\/images\/[\w.-]+\.(jpe?g|png|webp)$/)
      .nullable(),
    alt: nonEmpty,
  }),
  earlier_education: z.array(
    z.strictObject({ level: nonEmpty, institution: nonEmpty, year: nonEmpty }),
  ),
  process: z.strictObject({ note: nonEmpty, stages: z.array(AboutStageSchema).min(2) }),
});
export const AboutContentSchema = AboutDocumentSchema.extend({ review_notes: reviewNotes });

export type LabModule = z.infer<typeof LabModuleSchema>;
export type LabStage = z.infer<typeof LabStageSchema>;
export type StageNote = z.infer<typeof StageNoteSchema>;
export type Architecture = z.infer<typeof ArchitectureSchema>;
export type ArchitectureNode = z.infer<typeof ArchitectureNodeSchema>;
export type ArchitectureView = z.infer<typeof ArchitectureViewSchema>;
export type NodeKind = (typeof NODE_KINDS)[number];
export type SkillMap = z.infer<typeof SkillMapDocumentSchema>;
export type MapSkill = z.infer<typeof MapSkillSchema>;
export type MapEdge = z.infer<typeof MapEdgeSchema>;

export type About = z.infer<typeof AboutDocumentSchema>;

const EvidenceItemSchema = z.strictObject({
  label: nonEmpty,
  kind: z.enum(["source", "test", "api", "schema", "readme"]),
  /** Relative to the project's repository root. Never a local filesystem path. */
  path: z
    .string()
    .regex(/^[\w.-]+(\/[\w.-]+)*$/, "path must be relative to the repository, with no drive or ..")
    .refine((p) => !p.split("/").includes(".."), "path must not leave the repository"),
  /** True once the file has been read and the cited code found in it. */
  inspected: z.boolean(),
  /** A public file, only when its contents were checked on the repository's main branch. */
  url: z.url({ protocol: /^https$/ }).optional(),
});

const EvidenceApplicationSchema = z.strictObject({
  project: id,
  implementation: nonEmpty,
  context: nonEmpty,
  /** Absent when unconfirmed: no contribution is claimed on the page. */
  contribution: nonEmpty.optional(),
  /** approved: the owner's approved wording. owner_stated: the owner's own statement, not yet approved.
   * unconfirmed: no contribution wording is approved, so none is shown. */
  contribution_status: z.enum(["approved", "owner_stated", "unconfirmed"]),
  insight: nonEmpty,
  evidence: z.array(EvidenceItemSchema).min(1),
});

const EvidenceApplicationChecked = EvidenceApplicationSchema.refine(
  (a) => (a.contribution_status === "unconfirmed") === (a.contribution === undefined),
  {
    message: "a contribution is shown exactly when it is approved or owner-stated",
    path: ["contribution"],
  },
);

const EvidenceRecordSchema = z.strictObject({
  id,
  capability: nonEmpty,
  summary: nonEmpty,
  applications: z.array(EvidenceApplicationChecked).min(1),
});

const QuickViewSchema = z.strictObject({
  record: id,
  project: id,
  worked_on: nonEmpty,
  why: nonEmpty,
});

export const EvidenceDocumentSchema = z.strictObject({
  records: z.array(EvidenceRecordSchema).min(1),
  quick_view: z.array(QuickViewSchema).max(3),
});
export const EvidenceContentSchema = EvidenceDocumentSchema.extend({ review_notes: reviewNotes });

export type Evidence = z.infer<typeof EvidenceDocumentSchema>;
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type EvidenceApplication = z.infer<typeof EvidenceApplicationSchema>;

const CapabilitySchema = z.strictObject({
  id,
  label: nonEmpty,
  description: nonEmpty,
  /** The Laboratory module that shows this capability working, when there is one. */
  lab: id.optional(),
  projects: z.array(z.strictObject({ slug: id, note: nonEmpty })).min(1),
});

export const CapabilityDocumentSchema = z.array(CapabilitySchema).min(1);
export const CapabilityContentSchema = z.strictObject({
  review_notes: reviewNotes,
  capabilities: CapabilityDocumentSchema,
});
export type Capability = z.infer<typeof CapabilitySchema>;

const CaseSourceSchema = z.strictObject({
  label: nonEmpty,
  /** Relative to the project's repository root. Never a local filesystem path. */
  path: z
    .string()
    .regex(/^[\w.-]+(\/[\w.-]+)*$/, "path must be relative to the repository, with no drive or ..")
    .refine((p) => !p.split("/").includes(".."), "path must not leave the repository"),
  url: z.url({ protocol: /^https$/ }),
});

const CaseSchema = z.strictObject({
  id,
  project: id,
  title: nonEmpty,
  category: nonEmpty,
  intro: nonEmpty,
  challenge: nonEmpty,
  investigation: nonEmpty,
  approach: z.array(nonEmpty).min(1),
  result: z.array(nonEmpty).min(1),
  takeaway: nonEmpty,
  contribution: nonEmpty,
  /** approved: the owner's approved wording. owner_stated: the owner's own statement. */
  contribution_status: z.enum(["approved", "owner_stated"]),
  sources: z.array(CaseSourceSchema).min(1),
});

export const CasebookDocumentSchema = z.array(CaseSchema).min(1).max(6);
export const CasebookContentSchema = z.strictObject({
  review_notes: reviewNotes,
  cases: CasebookDocumentSchema,
});
export type CaseStudy = z.infer<typeof CaseSchema>;

export interface ExplorerContent {
  about: About;
  lab: LabModule[];
  architectures: Architecture[];
  skillMap: SkillMap;
  evidence: Evidence;
  capabilities: Capability[];
  casebook: CaseStudy[];
}
