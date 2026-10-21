/**
 * Minimal static server for local E2E: serves site/dist with
 * Cloudflare-Pages-like behavior — real files first, then /r/* SPA rewrite.
 * Usage: node e2e/local-server.mjs [port] [rootDir]
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.argv[2] ?? 4173);
const rootArg = process.argv[3] ?? fileURLToPath(new URL("../site/dist", import.meta.url));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".mp4": "video/mp4",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const root = rootArg;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";

    const candidate = normalize(join(root, pathname));
    if (!candidate.startsWith(normalize(root))) {
      res.writeHead(403).end();
      return;
    }

    let file = candidate;
    let found = true;
    try {
      const s = await stat(file);
      if (s.isDirectory()) file = join(file, "index.html");
    } catch {
      found = false;
    }

    // Cloudflare Pages behavior: unmatched /r/* paths rewrite to /r/index.html
    if (!found && pathname.startsWith("/r/")) file = join(root, "r", "index.html");

    try {
      const data = await readFile(file);
      res.writeHead(200, {
        "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
        "accept-ranges": "bytes",
      });
      res.end(data);
    } catch {
      res.writeHead(404).end("not found: " + pathname);
    }
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});

server.listen(port, "127.0.0.1", () => console.log(`static server on http://127.0.0.1:${port} serving ${root}`));
