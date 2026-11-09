# STATUS — StreamCaster (single source of truth)

> **Rule:** This file is the ONLY place that states project status. Every other
> document links here and must not duplicate status text.
> Agents: read this first, then [AGENTS.md](AGENTS.md) for working rules.

- **last-updated:** 2026-11-09
- **Web-Stack version:** v1.1.4-equivalent (tags up to `v1.0.3`; see ACCESS.md
  versioning for the detail history)
- **APK (separate repo, GPL-3.0):** v1.0.4 — live on
  `https://streamcaster.pages.dev/a.apk`, SHA-256 `4cb303e6…f1f57` verified
  against the deployed artefact on 2026-11-09
- **Deployed:** sender/receiver on Cloudflare Pages, signaling + proxy Workers
  (free tier), all live URLs in [ACCESS.md](ACCESS.md)

## What works (verified)

| Area | State |
|---|---|
| URL cast (mp4 direct, HLS direct/proxy) | ✅ live, E2E-tested |
| Extract-from-page + Browse-&-Cast (intercepting proxy) | ✅ live |
| Screen mirroring / camera / local files (WebRTC) | ✅ (not on iOS — D2) |
| Chromecast (detection-gated Web Sender SDK) | ✅ |
| Receiver page: code + QR pairing, TV remote support, PWA offline shell | ✅ |
| Sender link-preview confirm modal before casting | ✅ since 2026-11-09 (A1) |
| One-click setup = QR + `/#join=` deep link | ✅ declared in D7; malformed deep links never auto-connect (hardened 2026-11-09) |
| AirPlay mirroring iPhone → Fire TV via APK | ✅ verified on hardware (31.10.) |

## v1 residual status (closing plan: docs/PLAN-Abschluss-2026-11-09.md)

| Residual | State |
|---|---|
| 1. Link-Preview Modal | ✅ CLOSED 2026-11-09 — wired into `castUrl()` via `apps/sender/src/ui/linkPreview.ts`, 8 unit tests |
| 2. One-Click Setup | ✅ CLOSED 2026-11-09 — QR deep link declared the v1 form (D7); discovery = v1.1 with the DLNA bridge |
| 3. Open-Source Release | ✅ PREPARED 2026-11-09 — `LICENSE` (MIT), `NOTICE.md`, `CONTRIBUTING.md`, `docs/RELEASE.md`, license metadata in all `package.json`. **External steps still pending Johann's approval** (see below) |
| Sender APK card metadata | ✅ FIXED 2026-11-09 — was showing v1.0.3/18.4 MB/old SHA; now matches the deployed v1.0.4 artefact |

## Open items

1. **Done 2026-11-09 (approved by Johann):** repo made **public** on GitHub,
   all local work pushed, existing tags v1.0.0–v1.0.3 published. Future
   releases follow [docs/RELEASE.md](docs/RELEASE.md).
2. **Access-metadata purge — DONE 2026-11-09 (approved by Johann):** the entire
   git history was rewritten with `git filter-repo` (replace-text + mailmap to
   `Johi251@users.noreply.github.com`) and force-pushed; an independent fresh
   clone verified 0 hits across all 42 commits for the CF account e-mail/ID,
   the test Fire TV LAN IP and all personal e-mail addresses. Caveat: GitHub
   may still serve old commit SHAs from cache until garbage collection; no
   forks/PRs existed, so no external copies. Real values live in the
   untracked `.workbuddy-ai/memory/LOCAL-ACCESS.local.md` (never commit).
   Rule going forward: no access metadata in tracked files.
3. `docs/HANDBUCH StreamCaster.pdf` and `docs/HANDBUCH.html` stay
   **untracked on purpose** (generated exports of HANDBUCH.md).
4. E2E suite cannot run in this sandbox (needs deployed Workers/network);
   last full green run: 17/17 against live (Oct 2026). The new pairing
   regression test (malformed deep link) needs the next live E2E run.

## Doc map (who holds what)

| Need | File |
|---|---|
| Status (this file) | `STATUS.md` |
| Agent entry + rules | `AGENTS.md` (CLAUDE.md/GEMINI.md point here) |
| URLs, endpoints, credentials map, deploy | `ACCESS.md` |
| Decisions (D1–D7) | `DECISIONS.md` |
| Device handbook | `docs/HANDBUCH.md` |
| Closing plan for v1 residuals | `docs/PLAN-Abschluss-2026-11-09.md` |
| Original feature plan (living) | `Plan-Multi-Gerate-Streaming.md` |
| Release checklist | `docs/RELEASE.md` |
| Limits & non-goals | `docs/LIMITATIONS.md` |
| What is NOT possible and why | `docs/LIMITATIONS.md` |
| Protocol reference | `docs/PROTOCOL.md` |
| Proxy contract + SSRF policy | `docs/PROXY.md` |
