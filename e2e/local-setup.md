# Local E2E setup

Three services must run before the suite:

```bash
# 1. build the site with local URLs baked in (VITE_ICE_SERVERS='[]' skips
#    unreachable STUN servers in sandboxed environments)
VITE_SIGNALING_URL=http://127.0.0.1:8787 VITE_PROXY_URL=http://127.0.0.1:8788 \
VITE_ICE_SERVERS='[]' pnpm build:site

# 2. start the services (each in its own terminal)
node e2e/local-server.mjs 4173          # static site with /r/* SPA rewrites
cd apps/signaling && wrangler dev --port 8787
cd apps/proxy && wrangler dev --port 8788 --var ALLOW_PRIVATE_TARGETS:1

# 3. run the suite
npx playwright test -c e2e/playwright.config.ts
```

Health checks: `http://127.0.0.1:4173/`, `http://127.0.0.1:8787/health`,
`http://127.0.0.1:8788/health`.

## Deployed run

Point at a live Pages deployment instead:

```bash
E2E_BASE_URL=https://streamcaster.pages.dev npx playwright test -c e2e/playwright.config.ts
```

(The signaling/proxy workers are referenced via the baked-in
`VITE_SIGNALING_URL`/`VITE_PROXY_URL`, so the deployed site talks to deployed
workers — no local services needed.)

## Browser requirements

- Full Chromium (`channel: "chromium"`) — the headless shell lacks
  `getUserMedia`. Fake device + auto-grant flags are in the config.
- Screen capture (`getDisplayMedia`) cannot be auto-confirmed headlessly —
  the mirror spec validates the identical WebRTC transport via the camera
  path; screen mirroring is a manual headed-Chrome check.

## Fixtures

`apps/receiver/public/media/`: `sample.mp4`, `sample.m3u8` (+ `seg0.ts`),
`master.m3u8` (variant playlist). `apps/receiver/public/fixtures/page.html`:
extraction test page (og:video + JSON-LD + `<video>` + player-config script).
