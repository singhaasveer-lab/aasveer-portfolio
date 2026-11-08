/**
 * Draws the 1200x630 link preview from content/profile.json with the site's own fonts and colours,
 * and writes it to public/social/link-preview.png. The page links it only when the site URL is set. It is a static file, so it
 * work in the static export. Run `pnpm og:generate` after changing the name, role or headline.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readContent } from "../src/lib/content/readContent";
import { LINK_PREVIEW, linkPreviewAlt } from "../src/lib/site";

const ROOT = process.cwd();
const fontUrl = (file: string) => pathToFileURL(path.join(ROOT, "node_modules", file)).href;

async function main() {
  const { profile } = readContent(path.join(ROOT, "content"));
  const [first, ...rest] = profile.full_name.split(" ");
  // The headline after its role: the tagline already on the site.
  const tagline = profile.headline.split("|").slice(1).join("·").replace(/\s+/g, " ").trim();

  const html = `<!doctype html><meta charset="utf-8"><style>
    @font-face { font-family: Fraunces; src: url("${fontUrl("@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2")}"); font-weight: 100 900; }
    @font-face { font-family: Fraunces; font-style: italic; src: url("${fontUrl("@fontsource-variable/fraunces/files/fraunces-latin-opsz-italic.woff2")}"); font-weight: 100 900; }
    @font-face { font-family: Geist Mono; src: url("${fontUrl("geist/dist/fonts/geist-mono/GeistMono-Variable.woff2")}"); font-weight: 100 900; }
    * { margin: 0; box-sizing: border-box; }
    body { width: 1200px; height: 630px; overflow: hidden; position: relative; color: #eef2ff;
      font-family: "Geist Mono"; padding: 72px 80px;
      background: radial-gradient(60% 80% at 92% 0%, rgb(63 213 245 / .2), transparent 70%),
        radial-gradient(50% 70% at 0% 100%, rgb(155 135 255 / .16), transparent 70%), #05070d; }
    .grid { position: absolute; inset: 0;
      background-image: linear-gradient(rgb(200 214 255 / .05) 1px, transparent 1px),
        linear-gradient(90deg, rgb(200 214 255 / .05) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: linear-gradient(120deg, transparent 30%, #000); }
    .mark { position: relative; font-size: 22px; letter-spacing: .2em; color: #8fa0c4; }
    .mark b { font-weight: 400; color: #3fd5f5; }
    h1 { position: relative; margin-top: 66px; font-family: Fraunces; font-weight: 380;
      font-size: 134px; line-height: .98; letter-spacing: -.02em; }
    h1 em { display: block; padding: 0 .1em .16em .32em; margin-bottom: -.16em; width: max-content;
      background: linear-gradient(90deg, #7fe4f8, #9b87ff); -webkit-background-clip: text; color: transparent; }
    .role { position: absolute; left: 80px; bottom: 112px; font-size: 28px; letter-spacing: .14em;
      text-transform: uppercase; color: #3fd5f5; }
    .tag { position: absolute; left: 80px; bottom: 68px; font-size: 24px; color: #c6d0e6; }
  </style><div class="grid"></div>
  <p class="mark"><b>NEXUS</b> // PORTFOLIO</p>
  <h1>${first}<em>${rest.join(" ")}</em></h1>
  <p class="role">${profile.role}</p>
  <p class="tag">${tagline}</p>`;

  const page_file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "og-")), "og.html");
  fs.writeFileSync(page_file, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(page_file).href);
  await page.evaluate(() => document.fonts.ready);

  const alt = linkPreviewAlt(profile);
  const target = path.join(ROOT, "public", ...LINK_PREVIEW.path.split("/").filter(Boolean));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target });
  await browser.close();
  console.log(`[og] wrote the link preview images: ${alt}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
