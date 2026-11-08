/** Static file server for out/, shared by scripts/serve-out.ts and scripts/verify-static.ts. */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";

const OUT_DIR = path.resolve(process.cwd(), "out");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".pdf": "application/pdf",
  ".webmanifest": "application/manifest+json",
};

function resolveFile(urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]!.split("#")[0]!);
  } catch {
    return null;
  }
  const candidates = decoded.endsWith("/")
    ? [path.join(decoded, "index.html")]
    : [decoded, `${decoded}.html`, path.join(decoded, "index.html")];
  for (const candidate of candidates) {
    const full = path.resolve(OUT_DIR, `.${candidate}`);
    if (!full.startsWith(OUT_DIR + path.sep) && full !== OUT_DIR) return null;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

export function createServer(): http.Server {
  return http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }
    const file = resolveFile(req.url ?? "/");
    const notFound = path.join(OUT_DIR, "404.html");
    const target = file ?? (fs.existsSync(notFound) ? notFound : null);
    if (!target) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    const type = CONTENT_TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream";
    const isAsset = target.includes(`${path.sep}_next${path.sep}static${path.sep}`);
    // Text is compressed, as any real host would do, so local measurements are comparable.
    const accepts = String(req.headers["accept-encoding"] ?? "").includes("gzip");
    const compress = accepts && /^(text\/|application\/json|image\/svg)/.test(type);
    res.writeHead(file ? 200 : 404, {
      "content-type": type,
      "x-content-type-options": "nosniff",
      "cache-control": isAsset ? "public, max-age=31536000, immutable" : "no-cache",
      vary: "accept-encoding",
      ...(compress ? { "content-encoding": "gzip" } : {}),
    });
    if (req.method === "HEAD") res.end();
    else if (compress) fs.createReadStream(target).pipe(zlib.createGzip()).pipe(res);
    else fs.createReadStream(target).pipe(res);
  });
}
