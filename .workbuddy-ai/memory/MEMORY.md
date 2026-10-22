# StreamCaster — project memory

## What this is
Free cross-platform casting + screen-mirroring webapp (pnpm monorepo:
apps/sender, apps/receiver, apps/signaling, apps/proxy, packages/shared).
Receiver-page model (works on Fire TV/Smart TV/Echo Show browsers) + native
Chromecast via Cast Web Sender SDK. All Cloudflare free tier. v1.0.0 tagged.

## Architecture essentials
- Signaling: CF Worker + SQLite Durable Object `Room` per room code; WS primary,
  SSE+POST fallback; playback state persisted in kv table; 2h TTL alarm.
- Casting path A (commands): sender pushes CommandOp over signaling; receiver
  player loads mp4 natively / HLS via hls.js. Works from iPhone.
- Casting path B (live): WebRTC between sender/receiver for screen/camera
  mirror + local file via datachannel. Needs WS-capable browsers both sides.
- Proxy Worker: /fetch (CORS relay, 2MB), /hls (m3u8 URI rewrite), /seg
  (pass-through w/ Range). Direct-URL-first; proxy only when origin lacks CORS.
- Chromecast: detection-gated (UA gate + script injection), CommandOp→Cast
  mapping in apps/sender/src/cast/chromecast.ts (toCastIntent, unit-tested).
- Deployment: one Pages project (sender at /, receiver at /r/ via
  scripts/build-site.mjs + _redirects), two Workers. Deploy = wrangler login
  (needs Johann's CF account — no creds on machine) then pnpm deploy:all.

## Critical bugs found in skeleton (all fixed)
1. Receiver main.ts TDZ: start() ran at boot before `let client` declaration →
   crash on every page load. Declarations moved to top.
2. Sender never handled `t:"webrtc"` messages → receiver's answer/ICE never
   processed → all live streams dead. Added case in onMessage.
3. protocol.ts file-meta had duplicate `name` key (TS error, runtime bug).
   Renamed field to `filename`.
4. room.ts deserializeAttachment("role") — workers-types signature mismatch,
   cast to local interface.

## E2E (13 specs, all green locally)
- Runs against: node e2e/local-server.mjs 4173 (static, Pages-like /r/*
  rewrites) + wrangler dev 8787 (signaling) + 8788 (proxy,
  ALLOW_PRIVATE_TARGETS:1). Build site first with local URLs baked:
  VITE_SIGNALING_URL/VITE_PROXY_URL/VITE_ICE_SERVERS='[]'.
- Playwright needs channel:"chromium" (full build — headless shell lacks
  getUserMedia) + fake device/UI flags. getDisplayMedia can't be
  auto-confirmed headlessly → mirror spec validates via camera path instead.
- Room-code alphabet: no 0/O/1/I/L (no-confusable). Test helpers must use
  "23456789ABCDEFGHJKMNPQRSTUVWXYZ".

## Gotchas
- pnpm: workspace deps MUST use `workspace:*` (not `*`) or install fails.
- pnpm 10 needs pnpm.onlyBuiltDependencies for esbuild/workerd/sharp.
- Sandbox: STUN UDP blocked/unreliable → VITE_ICE_SERVERS='[]' for E2E;
  WebRTC ICE itself works cross-page (DTLS fine).
- site/ rmSync can hit the env safe-delete shim timeout; build-site.mjs
  tolerates it and merges over the previous build.
- DECISIONS.md: DLNA deferred to v1.1 (bridge joins signaling room as
  receiver with dlna cap — no protocol change needed).
