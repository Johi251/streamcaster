# Release checklist — StreamCaster

This repo releases in two separate tracks with different licenses:

| Track                | Repo                                | License | Artefact                    |
| -------------------- | ----------------------------------- | ------- | --------------------------- |
| Web stack            | this repo (`Johi251/streamcaster`)  | MIT     | Cloudflare Pages + Workers  |
| AirPlay receiver APK | `airplay-receiver/` (separate repo) | GPL-3.0 | `streamcaster-receiver.apk` |

## 0. Hard rule — external mutations need approval

Everything below is local until the step is explicitly marked  
**[external — approval required]**. Publishing, pushing tags, flipping repo  
visibility or uploading release assets is a human decision, never an agent  
action. Johann approves each external step individually.

## 1. Local pre-flight (fully autonomous)

- [ ] `pnpm verify` green (typecheck + unit tests, includes  
  `scripts/check-status.mjs` SSOT check)
- [ ] `pnpm build` green
- [ ] `git status` clean — no untracked planned artefacts, no secrets staged
- [ ] `NOTICE.md` still matches reality: dependency versions in  
  `apps/receiver/package.json` vs. the table (hls.js, qrcode)
- [ ] `STATUS.md` reflects the state that is about to be tagged
- [ ] No GPL code entered this repo (UxPlay stays in the APK repo)

## 2. Version + tag (local)

- [ ] Bump versions: root `package.json` and the affected workspace packages
- [ ] Update `airplay-receiver` `AIRPLAY_APK_VERSION` in  
  `apps/sender/src/main.ts` **only if** a new APK was released
- [ ] Commit: `release: vX.Y.Z`
- [ ] Tag locally: `git tag vX.Y.Z` (existing pattern: `v1.0.0` … `v1.0.3`)

## 3. Publishing [external — approval required, each step separately]

- [ ] **Push commits + tag** to `origin/main`
- [ ] **GitHub Pages / Cloudflare Pages deploy** (`pnpm deploy:pages` uses  
  wrangler auth from the local environment)
- [ ] **Workers deploy** (`pnpm deploy:signaling`, `pnpm deploy:proxy`)
- [ ] **APK release** happens in the receiver repo under GPL-3.0; afterwards  
  verify the `/apk` redirect still points at the new "latest" asset and  
  the SHA-256 shown in the sender's AirPlay card matches the asset
- [ ] Flip repo visibility **public** (currently private) — only after the  
  first public tag, and only with Johann's explicit go

## 4. Post-release verification

- [ ] `https://<pages-host>/` serves the new sender; `/r/` shows code + QR
- [ ] Receiver on a real TV joins with a fresh code; URL cast + HLS via proxy  
  work; APK download route works
- [ ] `STATUS.md` updated with the release date and version
- [ ] GitHub release notes reference `NOTICE.md` for the APK track
