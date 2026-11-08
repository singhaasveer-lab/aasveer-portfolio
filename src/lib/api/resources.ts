import type { z } from "zod";
import { getCertifications, getProfile, getPublishedProjects, getSkillGroups } from "../db/queries";
import {
  CertificationsEnvelopeSchema,
  ProfileEnvelopeSchema,
  ProjectsEnvelopeSchema,
  type ErrorCode,
} from "../validation/schemas";
import { jsonError, jsonSuccess } from "./envelope";

/**
 * Builders for the three static JSON resources. Each calls the shared query functions
 * directly (never loadPortfolio()) and validates the full envelope before responding.
 */

class ResourceError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function checked<S extends z.ZodType>(schema: S, data: unknown, resource: string): Response {
  const result = schema.safeParse({ data });
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.map(String).join(".")}: ${i.message}`)
      .join("; ");
    throw new ResourceError("DATA_INVALID", `${resource} failed validation: ${detail}`);
  }
  return jsonSuccess(data);
}

function respond(resource: string, build: () => Response): Response {
  try {
    return build();
  } catch (err) {
    const code = err instanceof ResourceError ? err.code : "INTERNAL_ERROR";
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api] ${resource}: ${code}: ${message}`);
    return jsonError(
      code,
      err instanceof ResourceError ? message : `Unexpected error building ${resource}`,
    );
  }
}

export function profileResponse(): Response {
  return respond("profile.json", () => {
    const profile = getProfile();
    if (!profile) throw new ResourceError("DATA_MISSING", "profile.json: no profile row");
    return checked(
      ProfileEnvelopeSchema,
      { ...profile, skill_groups: getSkillGroups() },
      "profile.json",
    );
  });
}

export function projectsResponse(): Response {
  return respond("projects.json", () =>
    checked(ProjectsEnvelopeSchema, getPublishedProjects(), "projects.json"),
  );
}

export function certificationsResponse(): Response {
  return respond("certifications.json", () =>
    checked(CertificationsEnvelopeSchema, getCertifications(), "certifications.json"),
  );
}
