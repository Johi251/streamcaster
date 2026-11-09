/**
 * SSOT check — verifies that STATUS.md stays fresh and that every entry-point
 * document links to it instead of duplicating status. Part of `pnpm verify`.
 *
 * Fails when:
 *  - STATUS.md is missing or has no parseable `last-updated:` date
 *  - that date is older than MAX_AGE_DAYS
 *  - a required entry-point document is missing or does not reference STATUS.md
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MAX_AGE_DAYS = 30;

function fail(msg) {
  console.error("check-status FAILED: " + msg);
  process.exit(1);
}

const statusPath = join(ROOT, "STATUS.md");
if (!existsSync(statusPath)) fail("STATUS.md is missing at the repo root.");

const status = readFileSync(statusPath, "utf8");
// Tolerant against markdown emphasis: `- **last-updated:** 2026-11-09`.
const m = status.match(/last-updated:\s*\**\s*(\d{4}-\d{2}-\d{2})/);
if (!m) fail("STATUS.md has no `last-updated: YYYY-MM-DD` line.");
const last = new Date(m[1] + "T00:00:00Z");
if (Number.isNaN(last.getTime())) fail("STATUS.md last-updated date is unparseable: " + m[1]);
const ageDays = Math.floor((Date.now() - last.getTime()) / 86_400_000);
if (ageDays > MAX_AGE_DAYS) {
  fail(`STATUS.md is stale (last-updated ${m[1]}, ${ageDays} days ago; max ${MAX_AGE_DAYS}). Update it or the state it describes.`);
}
console.log(`check-status: STATUS.md fresh (last-updated ${m[1]}, ${ageDays}d ago)`);

// Entry-point documents must reference STATUS.md (link, not duplicate).
const mustReference = [
  "README.md",
  "ACCESS.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "docs/HANDBUCH.md",
  "docs/RELEASE.md",
  "docs/PLAN-Abschluss-2026-11-09.md",
];
for (const rel of mustReference) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) fail(`required document missing: ${rel}`);
  const text = readFileSync(p, "utf8");
  if (!text.includes("STATUS.md")) {
    fail(`${rel} does not reference STATUS.md — link to the SSOT instead of stating status.`);
  }
}

// Thin pointers must exist and route to AGENTS.md (no duplicated rules).
for (const rel of ["CLAUDE.md", "GEMINI.md"]) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) fail(`agent pointer missing: ${rel}`);
  const text = readFileSync(p, "utf8");
  if (!text.includes("AGENTS.md")) fail(`${rel} must point to AGENTS.md.`);
}

console.log("check-status: SSOT links complete (7 documents + 2 agent pointers)");
