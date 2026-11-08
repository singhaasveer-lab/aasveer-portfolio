/**
 * Renders the existing brand mark (src/app/icon.svg) into the two fallbacks browsers still ask
 * for: src/app/favicon.ico (16, 32 and 48 px) and src/app/apple-icon.png (180 px). The mark is not
 * redrawn; the SVG is rasterised as it is. The Apple icon fills its corners with the mark's own
 * background colour, because iOS applies its own rounded mask. Run with `pnpm icons:generate`.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP = path.join(ROOT, "src", "app");
const svg = fs.readFileSync(path.join(APP, "icon.svg"), "utf8");
/** The mark's own background, from its first rect. */
const background = /<rect[^>]*fill="([^"]+)"/.exec(svg)?.[1] ?? "#08090b";

/** An .ico file holding PNG images (supported by every current browser). */
function ico(images: { size: number; png: Buffer }[]) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

async function main() {
  const browser = await chromium.launch();
  const render = async (size: number, fill: string | null) => {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const body = fill ? `background:${fill}` : "background:transparent";
    await page.setContent(
      `<!doctype html><style>html,body{margin:0;${body}}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    const png = await page.screenshot({ omitBackground: !fill, type: "png" });
    await page.close();
    return png;
  };
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) images.push({ size, png: await render(size, null) });
  fs.writeFileSync(path.join(APP, "favicon.ico"), ico(images));
  fs.writeFileSync(path.join(APP, "apple-icon.png"), await render(180, background));
  await browser.close();
  console.log(
    `[icons] wrote src/app/favicon.ico (${sizes.join(", ")} px) and src/app/apple-icon.png (180 px)`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
