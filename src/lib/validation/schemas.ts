import { z } from "zod";

/**
 * Zod schemas shared by scripts/build-db.ts, src/lib/data/loadPortfolio.ts, the API
 * route handlers and the tests. Three layers:
 *   1. Seed content (content/*.json), validated before the database is built.
 *   2. Public data shapes, returned by loadPortfolio() and written to /api/*.json.
 *   3. Response envelopes for the static JSON resources.
 */

// The eight resume category labels, in resume order (D30).
export const SKILL_CATEGORIES = [
  "Languages",
  "AI / ML",
  "Generative AI & NLP",
  "AI Models & Platforms",
  "Backend & APIs",
  "Data & Databases",
  "Frontend",
  "Tools & Concepts",
] as const;

export const SkillCategorySchema = z.enum(SKILL_CATEGORIES);

const nonEmpty = z.string().trim().min(1);
const httpsUrl = z.url({ protocol: /^https$/ });
const nullableNonEmpty = nonEmpty.nullable();
const reviewNotes = z.array(z.string()).optional();

// Resume link: a site-relative path under /resume/ or an external https URL.
const resumeHref = z
  .string()
  .trim()
  .refine((v) => /^\/resume\/[\w.-]+\.pdf$/.test(v) || /^https:\/\//.test(v), {
    message: "resume_href must be a /resume/*.pdf path or an https URL",
  });

// ---------------------------------------------------------------------------
// 1. Seed content
// ---------------------------------------------------------------------------

export const ProfileContentSchema = z.strictObject({
  full_name: nonEmpty,
  headline: nonEmpty,
  status_label: nonEmpty,
  role: nonEmpty,
  intro: nonEmpty,
  focus_areas: z.array(nonEmpty).min(1).max(8),
  summary: nonEmpty,
  location: nonEmpty,
  education: z.strictObject({
    degree: nonEmpty,
    institution: nonEmpty,
    period: nonEmpty,
  }),
  links: z.strictObject({
    github_url: httpsUrl,
    linkedin_url: httpsUrl,
    email: z.email().nullable(),
    resume_href: resumeHref.nullable(),
  }),
  review_notes: reviewNotes,
});

export const SkillsContentSchema = z
  .strictObject({
    review_notes: reviewNotes,
    groups: z.array(
      z.strictObject({
        category: SkillCategorySchema,
        skills: z.array(nonEmpty).min(1),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    const categories = value.groups.map((g) => g.category);
    if (categories.join("|") !== SKILL_CATEGORIES.join("|")) {
      ctx.addIssue({
        code: "custom",
        path: ["groups"],
        message: `skill groups must be exactly the resume categories in order: ${SKILL_CATEGORIES.join("; ")}`,
      });
    }
    value.groups.forEach((group, gi) => {
      const seen = new Set<string>();
      group.skills.forEach((skill, si) => {
        if (seen.has(skill)) {
          ctx.addIssue({
            code: "custom",
            path: ["groups", gi, "skills", si],
            message: `duplicate skill "${skill}" in ${group.category}`,
          });
        }
        seen.add(skill);
      });
    });
  });

export const RoleStatusSchema = z.enum(["pending", "approved"]);
export const PublishStatusSchema = z.enum(["draft", "published"]);
export const RepositoryStatusSchema = z.enum(["unverified", "verified"]);

/** One measured result, such as "~1.2s" and "average answer time". Owner-supplied only. */
export const ProjectHighlightSchema = z.strictObject({ value: nonEmpty, label: nonEmpty });

/** A short muted walkthrough: a local video or GIF with a poster image. Never a remote file. */
export const ProjectWalkthroughSchema = z.strictObject({
  src: z.string().regex(/^\/media\/projects\/[\w.-]+\.(mp4|webm|gif)$/),
  poster: z.string().regex(/^\/media\/projects\/[\w.-]+\.(webp|png|jpe?g)$/),
  /** What the walkthrough shows, for people who cannot see it. */
  description: nonEmpty,
});

export const ProjectContentSchema = z
  .strictObject({
    slug: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]*$/, "slug must be lowercase letters, digits and hyphens"),
    display_name: nonEmpty,
    resume_name: nonEmpty,
    category: nonEmpty,
    period: nullableNonEmpty,
    problem_statement: nonEmpty,
    description: nonEmpty,
    technologies: z.array(nonEmpty).min(1),
    role_statement: z.string().nullable(),
    role_status: RoleStatusSchema,
    publish_status: PublishStatusSchema,
    repository_url: httpsUrl,
    repository_status: RepositoryStatusSchema,
    demo_url: httpsUrl.nullable(),
    display_order: z.int().positive(),
    /** Empty until the owner gives real figures; nothing renders while it is empty. */
    highlights: z.array(ProjectHighlightSchema).max(4).default([]),
    walkthrough: ProjectWalkthroughSchema.nullable().default(null),
    review_note: z.string().optional(),
  })
  .superRefine((p, ctx) => {
    const hasStatement = typeof p.role_statement === "string" && p.role_statement.trim().length > 0;
    if (p.role_status === "approved" && !hasStatement) {
      ctx.addIssue({
        code: "custom",
        path: ["role_statement"],
        message: `${p.slug}: role_status is "approved" but role_statement is empty`,
      });
    }
    if (p.role_status === "pending" && p.role_statement !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["role_statement"],
        message: `${p.slug}: role_statement must be null while role_status is "pending"`,
      });
    }
    // Publish rule (docs/TECHNICAL_DECISIONS.md D2, revised by D24): a published project needs a
    // verified repository. Its contribution statement is shown only once the owner approves it.
    if (p.publish_status === "published") {
      if (p.repository_status !== "verified") {
        ctx.addIssue({
          code: "custom",
          path: ["publish_status"],
          message: `${p.slug}: cannot be published until repository_status is "verified"`,
        });
      }
    }
    if (p.highlights.length === 1) {
      ctx.addIssue({
        code: "custom",
        path: ["highlights"],
        message: `${p.slug}: highlights must be empty or hold two to four items`,
      });
    }
    const seen = new Set<string>();
    p.technologies.forEach((t, i) => {
      if (seen.has(t)) {
        ctx.addIssue({
          code: "custom",
          path: ["technologies", i],
          message: `${p.slug}: duplicate technology "${t}"`,
        });
      }
      seen.add(t);
    });
  });

export const ProjectsContentSchema = z
  .strictObject({
    review_notes: reviewNotes,
    projects: z.array(ProjectContentSchema),
  })
  .superRefine((value, ctx) => {
    uniqueBy(value.projects, (p) => p.slug, "slug", ctx, "projects");
    uniqueBy(value.projects, (p) => String(p.display_order), "display_order", ctx, "projects");
  });

export const CertificationContentSchema = z.strictObject({
  issuer: nonEmpty,
  course_name: nonEmpty,
  is_prominent: z.boolean(),
  display_order: z.int().positive(),
  /** Only a real completion date and credential link. Absent means none is shown. */
  completed_on: nonEmpty.optional(),
  credential_url: httpsUrl.optional(),
  certificate_url: nonEmpty.optional(),
  /** Absent means an ordinary entry. "hidden" removes it from the page and the API. */
  visibility: z.enum(["featured", "hidden"]).optional(),
});

export const CertificationsContentSchema = z
  .strictObject({
    review_notes: reviewNotes,
    certifications: z.array(CertificationContentSchema).min(1),
  })
  .superRefine((value, ctx) => {
    uniqueBy(
      value.certifications,
      (c) => String(c.display_order),
      "display_order",
      ctx,
      "certifications",
    );
    uniqueBy(
      value.certifications,
      (c) => `${c.issuer}::${c.course_name}`,
      "issuer + course_name",
      ctx,
      "certifications",
    );
  });

function uniqueBy<T>(
  items: T[],
  key: (item: T) => string,
  label: string,
  ctx: z.RefinementCtx,
  path: string,
) {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    const k = key(item);
    if (seen.has(k)) {
      ctx.addIssue({ code: "custom", path: [path, i], message: `duplicate ${label}: ${k}` });
    }
    seen.add(k);
  });
}

export type ProfileContent = z.infer<typeof ProfileContentSchema>;
export type SkillsContent = z.infer<typeof SkillsContentSchema>;
export type ProjectContent = z.infer<typeof ProjectContentSchema>;
export type ProjectsContent = z.infer<typeof ProjectsContentSchema>;
export type CertificationsContent = z.infer<typeof CertificationsContentSchema>;

// ---------------------------------------------------------------------------
// 2. Public data shapes (loadPortfolio() and /api/*.json)
// ---------------------------------------------------------------------------

export const LinksSchema = z.strictObject({
  github_url: httpsUrl,
  linkedin_url: httpsUrl,
  email: z.email().nullable(),
  resume_href: resumeHref.nullable(),
});

export const SkillGroupSchema = z.strictObject({
  category: SkillCategorySchema,
  skills: z.array(nonEmpty).min(1),
});

export const ProfileSchema = z.strictObject({
  full_name: nonEmpty,
  headline: nonEmpty,
  status_label: nonEmpty,
  role: nonEmpty,
  intro: nonEmpty,
  focus_areas: z.array(nonEmpty).min(1).max(8),
  summary: nonEmpty,
  location: nonEmpty,
  education: z.strictObject({
    degree: nonEmpty,
    institution: nonEmpty,
    period: nonEmpty,
  }),
  links: LinksSchema,
});

export const ProfileResourceSchema = ProfileSchema.extend({
  skill_groups: z.array(SkillGroupSchema).length(SKILL_CATEGORIES.length),
});

// A public project is published with a verified repository. Its contribution wording is present
// only when the owner has approved it; a pending role never carries wording.
export const PublicProjectSchema = z.strictObject({
  slug: nonEmpty,
  display_name: nonEmpty,
  resume_name: nonEmpty,
  category: nonEmpty,
  period: nullableNonEmpty,
  problem_statement: nonEmpty,
  description: nonEmpty,
  technologies: z.array(nonEmpty).min(1),
  role: z.union([
    z.strictObject({ status: z.literal("approved"), statement: nonEmpty }),
    z.strictObject({ status: z.literal("pending"), statement: z.null() }),
  ]),
  repository_url: httpsUrl,
  demo_url: httpsUrl.nullable(),
  highlights: z.array(ProjectHighlightSchema).max(4),
  walkthrough: ProjectWalkthroughSchema.nullable(),
});

export const PublicCertificationSchema = z.strictObject({
  issuer: nonEmpty,
  course_name: nonEmpty,
  is_prominent: z.boolean(),
  display_order: z.int().positive(),
  completed_on: nullableNonEmpty,
  credential_url: httpsUrl.nullable(),
  certificate_url: nullableNonEmpty,
  featured: z.boolean(),
});

export type ProjectHighlight = z.infer<typeof ProjectHighlightSchema>;
export type ProjectWalkthrough = z.infer<typeof ProjectWalkthroughSchema>;
export type Links = z.infer<typeof LinksSchema>;
export type SkillGroup = z.infer<typeof SkillGroupSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileResource = z.infer<typeof ProfileResourceSchema>;
export type PublicProject = z.infer<typeof PublicProjectSchema>;
export type PublicCertification = z.infer<typeof PublicCertificationSchema>;

// ---------------------------------------------------------------------------
// 3. Response envelopes
// ---------------------------------------------------------------------------

export const ErrorCodeSchema = z.enum(["DATA_INVALID", "DATA_MISSING", "INTERNAL_ERROR"]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({ code: ErrorCodeSchema, message: nonEmpty }),
});

export const successEnvelope = <T extends z.ZodType>(data: T) => z.strictObject({ data });

export const ProfileEnvelopeSchema = successEnvelope(ProfileResourceSchema);
export const ProjectsEnvelopeSchema = successEnvelope(z.array(PublicProjectSchema));
export const CertificationsEnvelopeSchema = successEnvelope(z.array(PublicCertificationSchema));

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
