# AGENTS.md — entry point for AI agents & CL tools

You are working on **StreamCaster** — a free cross-platform casting + screen
mirroring webapp (pnpm monorepo: `apps/sender`, `apps/receiver`,
`apps/signaling`, `apps/proxy`, `packages/shared` + a site build for
Cloudflare Pages).

## Read in this order

1. **[STATUS.md](STATUS.md)** — current project state. The single source of
   truth; do not restate status anywhere else, always link to it.
2. **[ACCESS.md](ACCESS.md)** — live URLs, endpoints, deploy commands,
   machine-local credentials map.
3. **[DECISIONS.md](DECISIONS.md)** — D1–D7. A change that contradicts a
   recorded decision must argue why the decision changes, never silently
   work around it.
4. Task-specific: `docs/HANDBUCH.md` (devices), `docs/RELEASE.md` (shipping),
   `docs/PLAN-Abschluss-2026-11-09.md` (v1 residual closure),
   `docs/PROTOCOL.md` / `docs/PROXY.md` (contracts),
   `docs/LIMITATIONS.md` (non-goals).

## Working rules

- **`pnpm verify` must be green** before you report anything done
  (typecheck + unit tests + `scripts/check-status.mjs` SSOT check).
- **Update STATUS.md's `last-updated:`** whenever you change project state —
  the check script fails if it goes stale.
- **No GPL code in this repo.** MIT web stack; UxPlay stays in the separate
  GPL-3.0 APK repo (`airplay-receiver/`, gitignored).
- **No external mutations without Johann's explicit approval:** `git push`,
  repo visibility, wrangler deploys, GitHub releases. Local work only unless
  told otherwise; see `docs/RELEASE.md` §0.
- **Secrets:** everything in `.secrets/` and `%APPDATA%/.wrangler` is
  machine-local; never commit, never print.
- **Commits:** short imperative subjects, reference decision numbers
  (`fix: validate malformed #join deep link (D7)`).
- Room-code alphabet has no `0/O/1/I/L` — helpers must use
  `23456789ABCDEFGHJKMNPQRSTUVWXYZ`.

## Where agents leave notes for other agents

`.workbuddy-ai/memory/MEMORY.md` — architecture essentials, gotchas, past
bug post-mortems. Keep it terse; status belongs in STATUS.md, not here.
