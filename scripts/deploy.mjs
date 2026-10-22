/**
 * One-command deploy for StreamCaster.
 *
 * Order matters: the two Workers are deployed FIRST (their .workers.dev URLs
 * are printed), then the site is rebuilt with those URLs baked in, then
 * Cloudflare Pages is deployed.
 *
 * Prerequisites (one-time, by you):
 *   1. a free Cloudflare account  (https://dash.cloudflare.com/sign-up)
 *   2. wrangler login             (opens your browser — click "Allow")
 *
 * Then: pnpm deploy:all
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, cwd = root, capture = false) {
  return execSync(cmd, { cwd, stdio: capture ? "pipe" : "inherit", encoding: capture ? "utf8" : undefined });
}

function wrangler(args, cwd = root, capture = false) {
  return run(`pnpm exec wrangler ${args}`, cwd, capture);
}

// 0. preflight: the account needs a workers.dev subdomain before the first
//    worker deploy (API error 10063) — register it if missing.
console.log("==> checking workers.dev subdomain…");
execSync("node scripts/ensure-workers-subdomain.mjs streamcaster", { cwd: root, stdio: "inherit" });

// 1. deploy workers, capture their URLs
console.log("==> deploying signaling worker…");
const signalingOut = wrangler("deploy", join(root, "apps", "signaling"), true);
const signalingUrl = signalingOut.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i)?.[0];
if (!signalingUrl) {
  console.error("could not determine the signaling worker URL from wrangler output:\n" + signalingOut);
  process.exit(1);
}
console.log("    signaling: " + signalingUrl);

console.log("==> deploying proxy worker…");
const proxyOut = wrangler("deploy", join(root, "apps", "proxy"), true);
const proxyUrl = proxyOut.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i)?.[0];
if (!proxyUrl) {
  console.error("could not determine the proxy worker URL from wrangler output:\n" + proxyOut);
  process.exit(1);
}
console.log("    proxy:     " + proxyUrl);

// 2. build the site with the real worker URLs (build-site.mjs inherits env)
console.log("==> building site…");
execSync("node scripts/build-site.mjs", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VITE_SIGNALING_URL: signalingUrl, VITE_PROXY_URL: proxyUrl },
});

// 3. deploy Pages (wrangler pages deploy does NOT create the project — do it first)
console.log("==> ensuring pages project…");
try {
  wrangler("pages project create streamcaster --production-branch main");
} catch {
  console.log("    (project already exists — continuing)");
}
console.log("==> deploying pages…");
wrangler("pages deploy site/dist --project-name streamcaster --commit-dirty=true");

console.log("\nDone. Sender: https://streamcaster.pages.dev  ·  Receiver: https://streamcaster.pages.dev/r/");
