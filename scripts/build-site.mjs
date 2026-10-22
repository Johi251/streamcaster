/**
 * Assembles the single Cloudflare Pages deploy:
 *   site/dist/          — sender SPA (root)
 *   site/dist/r/        — receiver SPA (vite base "/r/")
 *   site/dist/_redirects — SPA fallback for /r/*
 *
 * Env required for production URLs:
 *   VITE_SIGNALING_URL, VITE_PROXY_URL
 */
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteDist = join(root, "site", "dist");

function run(cmd, cwd = root) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

// 1. build shared + receiver + sender
run("pnpm build:shared");
run("pnpm build:receiver");
run("pnpm build:sender");

// 2. assemble site/dist (tolerate a failed trash/remove — cpSync merges over
//    the previous build; stale hashed assets are harmless)
try {
  rmSync(join(root, "site"), { recursive: true, force: true });
} catch (e) {
  console.warn("warn: could not fully clear site/ (" + String(e).slice(0, 120) + ") — merging over previous build");
}
mkdirSync(join(siteDist, "r"), { recursive: true });
cpSync(join(root, "apps", "receiver", "dist"), join(siteDist, "r"), { recursive: true });
cpSync(join(root, "apps", "sender", "dist"), siteDist, { recursive: true });

// 3. SPA fallback for receiver deep links (/r/<CODE>)
writeFileSync(join(siteDist, "_redirects"), "/r/* /r/index.html 200\n");

// 4. Security headers (Cloudflare Pages _headers)
//    No CSP here: the Cast SDK injects scripts from gstatic.com at runtime —
//    a CSP would break native Chromecast. The rest is strict.
writeFileSync(
  join(siteDist, "_headers"),
  [
    "/*",
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  X-Frame-Options: DENY",
    "  Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), geolocation=()",
    "  Cross-Origin-Opener-Policy: same-origin",
    "",
  ].join("\n")
);

console.log("site assembled at " + siteDist);
