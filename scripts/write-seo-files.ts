/** Runs after `next build`: writes robots.txt and sitemap.xml into out/ when a site URL is set. */
import fs from "node:fs";
import path from "node:path";
import { seoFiles } from "../src/lib/seo";

const files = Object.entries(seoFiles(process.env.NEXT_PUBLIC_SITE_URL));
for (const [name, text] of files) fs.writeFileSync(path.join(process.cwd(), "out", name), text);
console.log(
  files.length > 0
    ? `[seo] wrote ${files.map(([name]) => name).join(" and ")}`
    : "[seo] NEXT_PUBLIC_SITE_URL is not set: robots.txt and sitemap.xml skipped",
);
