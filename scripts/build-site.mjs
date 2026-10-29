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

// 3. Legacy /r/<CODE> links + short APK redirect.
//    The receiver itself no longer depends on a rewrite: it keeps its room code
//    in ?code=, so /r/?code=XXXXXX always resolves to the real r/index.html.
//    This rule is only a courtesy for old /r/<CODE> URLs; on the deployed host
//    it is not honoured (that path falls through to the sender), which is why
//    nothing may rely on it.
//    /apk keeps the Fire TV "Downloader" input short and lets us swap the
//    release target without touching the SPA.
const APK_URL =
  "https://github.com/Johi251/streamcaster-airplay-receiver/releases/latest/download/streamcaster-receiver.apk";
writeFileSync(
  join(siteDist, "_redirects"),
  [
    "/r/* /r/index.html 200",
    `/apk ${APK_URL} 302`,
    "",
  ].join("\n")
);

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
