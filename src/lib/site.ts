/**
 * The site's public address (NEXT_PUBLIC_SITE_URL) and the link preview built from it.
 *
 * Without a valid https address, the page has no canonical URL and no link preview tags, and
 * robots.txt and sitemap.xml are not written: nothing ever points at localhost. Local development
 * works without it. `pnpm release:check` reports a missing or placeholder address as a blocker.
 */

/** The published link preview image (1200 x 630), written by `pnpm og:generate`. */
export const LINK_PREVIEW = { path: "/social/link-preview.png", width: 1200, height: 630 };

/** A valid https address, or null. Used for metadata, so a test address still builds. */
export function parseSiteUrl(value: string | undefined): URL | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

const NOT_PRODUCTION =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|example\.(com|org|net))$|\.(localhost|example|test|invalid|local)$/i;

/** Why this address cannot be released, or null when it is a real production address. */
export function siteUrlProblem(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return "NEXT_PUBLIC_SITE_URL is not set";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "NEXT_PUBLIC_SITE_URL is not a valid URL";
  }
  if (url.protocol !== "https:") return "NEXT_PUBLIC_SITE_URL must use https";
  if (NOT_PRODUCTION.test(url.hostname)) {
    return `NEXT_PUBLIC_SITE_URL points at ${url.hostname}, which is not a production domain`;
  }
  return null;
}

/** The preview's alt text: name, role and the tagline the site already shows. */
export function linkPreviewAlt(profile: { full_name: string; role: string; headline: string }) {
  const tagline = profile.headline.split("|").slice(1).join("·").replace(/\s+/g, " ").trim();
  return `${profile.full_name}, ${profile.role}. ${tagline}`;
}
