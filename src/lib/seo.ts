/**
 * robots.txt and sitemap.xml for the static export. Both need the site's public address, which is
 * the optional NEXT_PUBLIC_SITE_URL setting, so without it neither file is written.
 */
export function seoFiles(siteUrl: string | undefined): Record<string, string> {
  const value = siteUrl?.trim();
  if (!value) return {};
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("NEXT_PUBLIC_SITE_URL must be an https URL");
  const home = url.href.endsWith("/") ? url.href : `${url.href}/`;
  return {
    "robots.txt": `User-agent: *\nAllow: /\n\nSitemap: ${home}sitemap.xml\n`,
    "sitemap.xml":
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url><loc>${home}</loc></url>\n` +
      `</urlset>\n`,
  };
}
