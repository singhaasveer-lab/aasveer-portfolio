/**
 * Presentation switches. Content is unaffected: both layouts read the same certification data.
 *
 * CERTIFICATIONS_LAYOUT
 *   "orbit"    - Credential Orbit 3.0: a spatial WebGL credential environment (experimental).
 *   "orbit-2d" - Credential Orbit 2.0: the flat orbital path, kept for comparison.
 *   "classic"  - The original credential archive: issuer filters, an index and a detail record.
 *
 * Change the default below, or set NEXT_PUBLIC_CERTIFICATIONS_LAYOUT at build time to compare the
 * two without editing code. Any other value falls back to the default.
 */
export type CertificationsLayout = "orbit" | "orbit-2d" | "classic";

const DEFAULT_CERTIFICATIONS_LAYOUT: CertificationsLayout = "orbit";

function pick(value: string | undefined): CertificationsLayout {
  return value === "orbit" || value === "orbit-2d" || value === "classic"
    ? value
    : DEFAULT_CERTIFICATIONS_LAYOUT;
}

export const CERTIFICATIONS_LAYOUT: CertificationsLayout = pick(
  process.env.NEXT_PUBLIC_CERTIFICATIONS_LAYOUT,
);
