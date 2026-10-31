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
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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

// 3. Legacy /r/<CODE> links + the short APK path.
//    The receiver itself no longer depends on a rewrite: it keeps its room code
//    in ?code=, so /r/?code=XXXXXX always resolves to the real r/index.html.
//    This rule is only a courtesy for old /r/<CODE> URLs; on the deployed host
//    it is not honoured (that path falls through to the sender), which is why
//    nothing may rely on it.
//
//    The APK is served as a REAL FILE from Pages, not as a redirect:
//    a Fire TV on-screen keyboard turns "streamcaster.pages.dev/apk" into a
//    4-character input, and a redirect chain (GitHub -> release-assets) is what
//    makes older Silk browsers save an HTML page instead of the binary — which
//    then fails the install with "Problem beim Parsen des Pakets".
//    "/apk" is an internal rewrite (status 200), so the client sees one hop.
const APK_FALLBACK_URL =
  "https://github.com/Johi251/streamcaster-airplay-receiver/releases/latest/download/streamcaster-receiver.apk";
const apkSource = process.env.APK_SOURCE || join(root, "airplay-receiver", "dist", "streamcaster-receiver.apk");
const apkLocal = join(siteDist, "a.apk");
const hasLocalApk = existsSync(apkSource);

if (hasLocalApk) {
  cpSync(apkSource, apkLocal);
  console.log("APK hosted locally: " + apkSource + " -> site/dist/a.apk");
} else {
  console.warn(
    "warn: no APK at " + apkSource + " — /apk falls back to a GitHub redirect.\n" +
      "      Build it (airplay-receiver) or set APK_SOURCE=<path to .apk>."
  );
}

writeFileSync(
  join(siteDist, "_redirects"),
  [
    "/r/* /r/index.html 200",
    hasLocalApk ? "/apk /a.apk 200" : `/apk ${APK_FALLBACK_URL} 302`,
    "",
  ].join("\n")
);

// 4. Security headers (Cloudflare Pages _headers)
//    No CSP here: the Cast SDK injects scripts from gstatic.com at runtime —
//    a CSP would break native Chromecast. The rest is strict.
//
//    The APK needs its own block: the package installer only accepts a file
//    that is served as application/vnd.android.package-archive, and the
//    attachment disposition makes the browser save it as "streamcaster.apk"
//    instead of trying to render it inline.
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
    "/a.apk",
    "  Content-Type: application/vnd.android.package-archive",
    "  Content-Disposition: attachment; filename=\"streamcaster.apk\"",
    "  X-Content-Type-Options: nosniff",
    "  Cache-Control: public, max-age=3600",
    "",
    "/apk",
    "  Content-Type: application/vnd.android.package-archive",
    "  Content-Disposition: attachment; filename=\"streamcaster.apk\"",
    "  X-Content-Type-Options: nosniff",
    "  Cache-Control: public, max-age=3600",
    "",
  ].join("\n")
);

console.log("site assembled at " + siteDist);
