/**
 * Preflight for deploy: make sure the Cloudflare account has a workers.dev
 * subdomain registered (error 10063 on first Worker deploy otherwise).
 *
 * The OAuth token is read from wrangler's own config file — it never appears
 * in a command line. Registration goes through the Cloudflare REST API with
 * the same token `wrangler login` stored, using the workers_scripts:write
 * scope the login flow already requested.
 *
 * Usage: node scripts/ensure-workers-subdomain.mjs [preferred-subdomain]
 * Exits 0 when a subdomain exists or was created; non-zero on real failure.
 * If no wrangler token is found, exits 0 — wrangler itself will report the
 * auth problem with a better message.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://api.cloudflare.com/client/v4";

function findWranglerConfig() {
  const candidates = [
    process.env.XDG_CONFIG_HOME && join(process.env.XDG_CONFIG_HOME, ".wrangler", "config", "default.toml"),
    process.env.APPDATA && join(process.env.APPDATA, "xdg.config", ".wrangler", "config", "default.toml"),
    join(homedir(), ".wrangler", "config", "default.toml"),
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

function readToken(configPath) {
  const text = readFileSync(configPath, "utf8");
  const match = text.match(/^\s*oauth_token\s*=\s*"([^"]+)"/m);
  return match?.[1];
}

/** Cloudflare API call via curl (proxy env vars are honored automatically). */
function cf(token, method, path, body) {
  const args = [
    "-sS", "-X", method, `${API}${path}`,
    "-H", `Authorization: Bearer ${token}`,
    "-H", "Content-Type: application/json",
    ...(body ? ["-d", JSON.stringify(body)] : []),
  ];
  const out = execFileSync("curl", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(out);
}

const preferred = process.argv[2] || "streamcaster";
const candidates = [preferred, `${preferred}-app`, `${preferred}-tv`, `${preferred}-cast`];

const configPath = findWranglerConfig();
if (!configPath) {
  console.log("    (no wrangler token found — skipping subdomain check, wrangler will handle auth)");
  process.exit(0);
}
const token = readToken(configPath);
if (!token) {
  console.log("    (wrangler config without oauth token — skipping subdomain check)");
  process.exit(0);
}

const accounts = cf(token, "GET", "/accounts");
const accountId = accounts?.result?.[0]?.id;
if (!accountId) {
  console.error("    could not read account id from Cloudflare API: " + JSON.stringify(accounts).slice(0, 300));
  process.exit(1);
}

// already registered? then nothing to do.
const current = cf(token, "GET", `/accounts/${accountId}/workers/subdomain`);
if (current?.success && current?.result?.subdomain) {
  console.log(`    workers.dev subdomain already registered: ${current.result.subdomain}.workers.dev`);
  process.exit(0);
}

for (const sub of candidates) {
  // availability probe: 10031 = taken, anything else (incl. 10032) = free
  const probe = cf(token, "GET", `/accounts/${accountId}/workers/subdomains/${sub}`);
  if (probe?.errors?.[0]?.code === 10031) {
    console.log(`    subdomain "${sub}" is taken — trying next…`);
    continue;
  }
  const res = cf(token, "PUT", `/accounts/${accountId}/workers/subdomain`, { subdomain: sub });
  if (res?.success) {
    console.log(`    registered workers.dev subdomain: ${sub}.workers.dev`);
    process.exit(0);
  }
  console.log(`    could not register "${sub}" (${String(res?.errors?.[0]?.message ?? "").slice(0, 120)}) — trying next…`);
}

console.error("    could not register a workers.dev subdomain — register one at dash.cloudflare.com → Workers & Pages");
process.exit(1);
