# Copy-&-Paste-Prompt: Multi-Plattform-Gerüst für andere Tools

**Für Johann:** Diesen Block 1:1 in eine neue KI-Session kopieren, die `<NAME>`
Vorkommen an das neue Tool anpassen (nur 3 Stellen). Der Prompt baut dasselbe
Gerüst, das StreamCaster nutzt — für Windows (exe), macOS, Linux, iOS, iPadOS,
Android und Web.

---

You are a senior full-stack engineer. Build **<NAME>**, a tool whose core logic is a
web app, packaged for every platform from ONE codebase. Follow this scaffold exactly;
it is proven (used by the StreamCaster project) and CI-verified.

## 0. Non-negotiable ground rules
- Free-tier infra only (Cloudflare Workers + Pages / Durable Objects). No accounts, no tracking, no ads.
- TypeScript strict everywhere. pnpm monorepo. Conventional commits. Every feature ships with tests before merge.
- Old-device duty: web build target `es2018` + a plain-ES5 inline fallback overlay in each `index.html` (detect missing `Promise`/`fetch`/`WebSocket`/`RTCPeerConnection`, render a readable message, never a white screen).
- Never put secrets in the repo; document all access in an ACCESS.md (accounts, deploy steps, test devices) for AI handoff.

## 1. Monorepo layout
```
<NAME>/
├── apps/
│   ├── web-core/        # ALL business logic: Vite + TS + PWA (service worker, offline shell)
│   ├── worker-api/      # Cloudflare Worker: stateless API + Durable Object for per-key state
│   └── proxy/           # optional Cloudflare Worker: CORS/HLS/file relay with SSRF guard (block private IPs, HTTPS-only, size caps)
├── packages/shared/     # protocol types, client SDK, validation (pure TS, fully unit-tested)
├── shells/
│   ├── tauri/           # Tauri v2 shell -> Windows .exe/.msi, macOS .app/.dmg, Linux .AppImage/.deb
│   └── capacitor/       # Capacitor shell -> iOS/iPadOS + Android
├── e2e/                 # Playwright specs against the deployed stack (env-selectable URLs)
├── scripts/             # build-site.mjs, deploy.mjs (wrangler), sign/notarize helpers
├── docs/                # PROTOCOL.md, LIMITATIONS.md, guides
├── STATUS.md            # SSOT status file + scripts/check-status.mjs freshness gate
├── ACCESS.md            # credentials/handoff (private!)
├── DECISIONS.md         # numbered ADRs: every why gets a line
└── vitest.config.ts     # pool: "threads" (portable in sandboxed CI)
```

## 2. Platform strategy (one web core, thin shells)
- **Web (always first):** the PWA is the product. Responsive, keyboard + touch + TV-remote navigable.
- **Windows / macOS / Linux:** Tauri v2 wraps the built web app (`shells/tauri`). Native window, auto-update, file dialogs. Do NOT use Electron unless a native Node module is unavoidable (40 MB vs 3 MB binaries).
- **iOS / iPadOS + Android:** Capacitor wraps the same web app. Known platform ceilings, document them in LIMITATIONS.md, don't fight them:
  - iOS WKWebView has NO `getDisplayMedia` → screen capture features must degrade gracefully (capability gating with an explanatory tooltip, plus a native escape hatch if the tool truly needs it).
  - Background execution and autoplay policies differ; always implement a muted-autoplay fallback and reconnection-on-visibilitychange.
- **Platform detection lives in ONE module** (`web-core/src/platform.ts`); feature gates ask capabilities, never user-agent sniffing.

## 3. Backend contract
- One Worker routes `/ws` (WebSocket), `/sse` (fallback stream), `/send` (POST for SSE clients), `/health`, plus `/state`. A Durable Object instance per key (room/session) holds WebSocket attachments (role-based, max 2 roles), persists state in SQLite KV, TTL cleanup via alarms (2 h).
- Client SDK in `packages/shared`: WebSocket with 5 s open-timeout → SSE+POST fallback, heartbeat every 30 s, typed messages, takeover semantics (newest connection of a role wins; the stale one closes with code 4001).
- Messages: `join | ping/pong | cmd | state | error` — every payload is a discriminated union in `protocol.ts`; server validates with a `parseClientMessage` guard.

## 4. Quality gates (merge-blocking, wired into .github/workflows/ci.yml)
1. `pnpm install --frozen-lockfile`
2. `pnpm verify` = typecheck + vitest (unit) + status freshness check
3. `pnpm build:site` (production build of the web core)
4. On deploy: run the full Playwright E2E suite against the LIVE URLs (env: `E2E_BASE_URL`, `E2E_SIGNALING_URL`, `E2E_PROXY_URL`)
Deploy stays manual (`pnpm deploy:all`) until a `CLOUDFLARE_API_TOKEN` repo secret is deliberately added.

## 5. Build & release commands
```bash
pnpm install
pnpm build:site                                   # web core -> dist
pnpm --filter ./shells/tauri tauri build          # win .exe/.msi, mac .app/.dmg, linux AppImage/deb
pnpm --filter ./shells/capacitor cap sync && \
pnpm --filter ./shells/capacitor build:ios && \
pnpm --filter ./shells/capacitor build:android    # ipa/aab (signing via ACCESS.md-stored credentials)
node scripts/deploy.mjs                           # workers + pages
```

## 6. Acceptance criteria (define "done" like this)
- Same feature set demonstrably works on: Chrome/Edge/Firefox/Safari (desktop), Android Chrome, iOS Safari, and inside both shells.
- Every device class has a graceful path when a browser API is missing (gated UI, ES5 overlay, native escape hatch).
- E2E suite green against production; unit tests green; no TODO without a DECISIONS.md/Backlog entry.
- A stranger (human or AI) can rebuild and redeploy the whole system using only README.md + ACCESS.md.
