# StreamCaster

Free cross-platform **media casting + screen mirroring webapp**. Sender runs in any
phone/desktop browser; the receiver runs on any device with a browser — Fire TV
(Silk), Smart TVs, Echo Show, Chromecast-with-Google-TV, PC.

No install, no OS lock-in, no account. Everything free-tier.

## Architecture

```
 Phone/desktop browser                TV / Fire TV / Echo Show / PC
┌─────────────────────────┐           ┌────────────────────────────┐
│ SENDER SPA (/)          │  commands │ RECEIVER SPA (/r/<CODE>)   │
│  - cast URL / extract   │ ◀────────▶│  - <video> + hls.js        │
│  - mirror / camera      │  WebSocket│  - WebRTC media + file     │
│  - Chromecast button    │           │  - code + QR pairing       │
└─────────────────────────┘           └────────────────────────────┘
            │                                     │
            └──────────── Cloudflare ────────────┘
   Worker "streamcaster-signaling": DO Room per code, WS + SSE fallback
   Worker "streamcaster-proxy":     /fetch (CORS relay), /hls (manifest
                                    rewrite), /seg (pass-through stream)
```

Monorepo (pnpm): `apps/sender`, `apps/receiver`, `apps/signaling`,
`apps/proxy`, `packages/shared` (protocol, signaling client, room codes,
capability probing, ICE config).

## Two ways to cast

| Target | Path | Works from iPhone? |
|---|---|---|
| Any browser-capable device | open `https://<site>/r/`, enter the 6-char code | ✅ |
| Chromecast (desktop/Android Chrome) | Cast Web Sender SDK, button shown only when `cast.framework` detected | ❌ (iOS limitation — use receiver page) |

**URL casting** pushes the media URL to the receiver (phone stays free).
**Screen mirroring / local files** use WebRTC between sender and receiver —
requires WebSocket-capable browsers on both ends (same Wi-Fi recommended).

## Deploy (free)

```bash
wrangler login                    # one-time: YOUR Cloudflare account (free plan is enough)
pnpm build:site                   # builds sender + receiver into site/dist
VITE_SIGNALING_URL=https://<signaling>.workers.dev \
VITE_PROXY_URL=https://<proxy>.workers.dev \
pnpm build:site                   # rebuild with production URLs
pnpm deploy:all                   # signaling Worker + proxy Worker + Pages
```

Cloudflare resources created:
- Worker `streamcaster-signaling` (SQLite-backed Durable Object `Room`, free tier)
- Worker `streamcaster-proxy` (stateless)
- Pages project `streamcaster` (single site, sender at `/`, receiver at `/r/`)

Notes:
- Chromecast needs the Cast SDK domain allowlist (same origin is fine for local
  testing; real-device casting requires registering the sender origin in the
  Cast developer console — see docs/LIMITATIONS.md).
- `ALLOW_PRIVATE_TARGETS` is a dev-only flag on the proxy. Never set it in
  production.

## Local development

```bash
pnpm install
pnpm dev:signaling      # wrangler dev :8787
pnpm dev:proxy          # wrangler dev :8788
pnpm dev:receiver       # vite :5174 (served under /r/)
pnpm dev:sender         # vite :5173
```

For local E2E, build the site with local URLs:
```bash
VITE_SIGNALING_URL=http://127.0.0.1:8787 VITE_PROXY_URL=http://127.0.0.1:8788 \
VITE_ICE_SERVERS='[]' pnpm build:site
```
(`VITE_ICE_SERVERS='[]'` skips unreachable STUN servers in sandboxes; omit it
for production.)

## Test

```bash
pnpm verify                  # typecheck + unit tests (vitest)
# E2E (see e2e/local-setup.md — starts servers, then:)
npx playwright test -c e2e/playwright.config.ts
```

## Docs

- `DECISIONS.md` — product decisions (DLNA deferral, iOS limits, rea scope)
- `research/` — bounded URL-extraction research + findings
- `docs/LIMITATIONS.md` — what this can NOT do and why
- `docs/PROXY.md` — proxy Worker contract + SSRF policy
- `docs/PROTOCOL.md` — signaling protocol reference
