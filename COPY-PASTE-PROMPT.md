# StreamCaster — Project Architecture & Build Guide

**For AI agents or CLI:**
Follow these steps to build, test, and deploy StreamCaster. Each step is self-contained.

---

## 1. Project Structure

```
C:\Users\johan\MASTER_SETUP\00 PROJEKTE\StreamCaster\
├── apps/
│   ├── proxy/                    (WebWorker: /hls / /seg / /browse / /p)
│   ├── sender/                   (PWA: browser-based casting + screen mirror)
│   │   ├── public/               (HTML, CSS, manifest, service-worker)
│   │   ├── src/
│   │   │   ├── main.ts           ← Entry point (controller: DOM → signal → render)
│   │   │   ├── extract/           (Page video extraction: URL → probe → direct cast)
│   │   │   ├── capture/           (screen & camera via MediaDevices API)
│   │   │   ├── cast/              (Chromecast SDK integration)
│   │   │   └── transport/           (WebRTC peer + RemoteRelay)
│   │   │       ├── webrtc.ts
│   │   │       ├── file.ts
│   │   │       └── cast.ts        ← Transport arbitration (Chromecast vs receiver)
│   │   └── manifest.webmanifest (PWA: standalone, offline cache, icons)
│   └── receiver/                 (PWA: any browser, Glassmorphism UI)
│       ├── public/
│       │   ├── style.css          ← CSS variables, glassmorphism, responsive
│       │   └── index.html
│       └── src/
│           ├── main.ts              ← Controller: signal → state → render
│           ├── player/player.ts   ← HLS / MP4 / WebRTC factory (service)
│           ├── webrtc/receive.ts  ← RTCPeerConnection + DataChannel (infra)
│           └── signaling.ts       ← SignalingClient wrapper (infra)
├── packages/
│   └── shared/
│       ├── client.ts       (SignalingClient: connect, send, handlers)
│       ├── protocol.ts     (CommandOp: load/play/pause/seek/volume/stop/file-meta/stream-start)
│       ├── roomcode.ts     (generateRoomCode: 6-char, no confusable chars)
│       ├── capabilities.ts
│       └── types.ts        (SignalingStatus, ServerMessage, ReceiverCaps, PlaybackState)
├── e2e/
│   └── specs/             (13 Playwright specs: browse, control, extract, mirror, url-cast, etc.)
├── scripts/
│   ├── build-site.mjs     (Build sender + receiver → static)
│   ├── deploy.mjs          (wrangler: workers + Pages)
│   └── gen-icons.mjs        (Generate PNGs from SVG via Node, no ImageMagick)
├── docs/
│   ├── LIMITATIONS.md     (DRM: no. iOS mirror: no. DLNA: v1.1)
│   ├── PROXY.md           (Proxy Worker contract)
│   └── PROTOCOL.md         (Signaling protocol reference)
├── DECISIONS.md            (Product decisions with rationale)
└── README.md              (Architecture diagram, build/deploy commands)
```

---

## 2. Build Commands

```bash
# Install pnpm workspace deps (must use workspace:*)
pnpm install

# Build static site (sender at /, receiver at /r/)
pnpm build:site

# Deploy to Cloudflare (needs wrangler login first)
pnpm deploy:all

# Run tests locally (needs servers on ports 4173, 8787, 8788)
pnpm verify

# Run E2E with Playwright
npx playwright test -c e2e/playwright.config.ts
```

---

## 3. Server-Side Components (Cloudflare Workers)

### Signaling Worker (`apps/signaling`)

- Language: TypeScript → compile to WASM (wrangler)
- Backend: SQLite Durable Object `Room` (1 per 6-char room code)
- Protocol: WebSocket (primary) + SSE + POST fallback
- Features:
  - Room creation (auto-cleanup after 2h of inactivity)
  - Peer join / leave events
  - Command relay (Sender → Receiver, or Receiver → Sender)
  - State sync (playback position, volume, duration, title)

Deployment:
```bash
cd apps/signaling
wrangler login
wrangler deploy
# Deployed to: https://<your-id>.workers.dev
```

### Proxy Worker (`apps/proxy`)

- Language: TypeScript → WASM (wrangler)
- Routes:
  - `/hls?url=` → Reads remote m3u8, rewrites `<media-source>` URIs, returns rewritten manifest
  - `/seg?url=` → Range-based pass-through of HLS segments (preserves `Range` header)
  - `/browse?url=` → Fetches the page, injects capture script (rewriteBrowseHtml), returns iframe target
  - `/p?url=` → Pass-through for mp4/ts/m4s with CORS headers + Range support
  - `/fetch?url=` → Generic CORS relay (2MB limit)
- SSRF protection via allowlist + private IP blocklist

Deployment:
```bash
cd apps/proxy
wrangler deploy
```

---

## 4. Protocol Reference

### Server → Client Messages (WebSocket)

| Type             | Payload                                    | Description                          |
|------------------|--------------------------------------------|--------------------------------------|
| `joined`         | `{ t: "joined", peerPresent: bool, peers: number, receiveCaps }` | Receiver joined the room; peerPresent = TV is listening |
| `peer-joined`    | `{ t: "peer-joined", role: "sender"\|"receiver", caps }` | New peer connected via WebRTC |
| `peer-left`      | `{ t: "peer-left", role: "sender"\|"receiver" }` | Peer disconnected |
| `cmd`            | `{ t: "cmd", op: CommandOp }`             | Command from one peer to the other |
| `webrtc`         | `{ t: "webrtc", kind: "offer"\|"ice", payload: RTCPeerMessage }` | WebRTC handshake |
| `state`          | `{ t: "state", state: PlaybackState }`    | Remote player state sync |
| `error`          | `{ t: "error", message: string, code: string }` | Error from the room |

### CommandOps (CommandOp)

| name           | Payload                                    | Description                        |
|----------------|--------------------------------------------|------------------------------------|
| `load`         | `{ name: "load", url: string, title: string, mime: string }` | Load media (direct URL or via proxy) |
| `play`         | `{ name: "play" }`                         | Play / unpause                       |
| `pause`        | `{ name: "pause" }`                         | Pause                              |
| `seek`         | `{ name: "seek", time: number (ms) }`      | Seek to time in milliseconds         |
| `volume`       | `{ name: "volume", value: number (0-1) }`  | Set volume level                     |
| `stop`         | `{ name: "stop" }`                         | Stop playback                       |
| `file-meta`    | `{ name: "file-meta", name: string, size: number, mime: string }` | File metadata (sent before chunks) |
| `stream-start` | `{ name: "stream-start", kind: "screen"\|"camera" }` | Begin live stream |
| `stream-stop`  | `{ name: "stream-stop" }`                  | End live stream                     |
| `sub-title`    | `{ name: "sub-title", content: string, label: string }` | Send subtitles (.vtt)               |

### PlaybackState

| field      | type   | Description                       |
|------------|--------|-----------------------------------|
| `paused`   | bool   | Current playback state            |
| `position` | number | Current position in milliseconds  |
| `duration` | number | Total duration in milliseconds    |
| `title`    | string | Current media title               |

---

## 5. Receiver PWA (Any Device)

### Features
- Glassmorphism idle screen with room code & QR
- HLS playback (hls.js), MP4/WebM (native), WebRTC mirror (P2P)
- Seek bar (±10s buttons, draggable), volume slider
- Touch gestures (swipe ±30s on video)
- Keyboard shortcuts: Space (play/pause), Arrows (seek ±10s, volume ±10%)
- Service Worker for offline caching

### Supported Devices
- **Fire TV (Silk Browser)** → Receives HLS/MP4 via URL cast or WebRTC
- **Smart TV / Browser** → Receives HLS/MP4 via URL cast
- **Android Chrome** → Receives WebRTC screen mirror or HLS/MP4
- **iPhone Safari** → Receives HLS/MP4 via URL cast (no WebRTC screen mirror)
- **Desktop Chrome/Edge** → Receives everything

### Build & Run (Local)
```bash
VITE_SIGNALING_URL=http://127.0.0.1:8787 \
VITE_PROXY_URL=http://127.0.0.1:8788 \
pnpm dev:receiver
```

Open `http://localhost:5174/r/<6-CHAR-CODE>` in a browser.

---

## 6. Receiver UI

### Idle Screen
- Card with room code (large, monospace)
- QR code (lazily generated on connect)
- Connection status chip (offline / waiting / connected)

### Connected Screen
- `#play-pause-overlay` — centered ⏸/▶ on tap
- Bottom glass controls:
  - Seek bar (draggable) ± 10s buttons
  - Volume slider with label

### Styling
- CSS variables (`--bg`, `--card`, `--text`, `--accent`, `--radius`, etc.)
- Glassmorphism: `backdrop-filter: saturate(160%) blur(16px)`
- Responsive breakpoints:
  - Mobile (<640px): compact controls, smaller font
  - TV (1280px+): larger hit targets, bigger font, more padding

---

## 7. Build & Test Checklist

### Quick Verify
```bash
pnpm verify          # Types + unit tests
pnpm deploy:all      # Deploy to Cloudflare (needs login)
```

### Before Deploying
- [ ] Set `VITE_SIGNALING_URL` and `VITE_PROXY_URL` to your Cloudflare Worker URLs
- [ ] Test receiver at `/r/<CODE>` on a separate device
- [ ] Test sender casting (URL, screen, file, extract)
- [ ] Confirm E2E tests pass locally
- [ ] Check that the Service Worker doesn't cache dev versions (`location.hostname !== "localhost"`)

---

## 8. Architecture Notes

### Fullstack Pattern (Receiver)
```
main.ts          ← Controller: DOM events → state → render → signaling
  └─ player.ts    ← Service: HLS / MP4 / WebRTC playback
  └─ webrtc/      ← Infra: RTCPeerConnection + DataChannel
  └─ signaling.ts ← Infra: ReceiverClient wrapper
```

### Fullstack Pattern (Sender)
```
main.ts          ← Controller: DOM events → state → render → signaling
  └─ extract/     ← Service: URL detection, page scraping
  └─ capture/     ← Service: screen / camera capture
  └─ transport/   ← Infra: WebRTC peer, file send, remote relay
  └─ cast/        ← Infra: Chromecast SDK
```

### Transport Arbitration (Sender)
```
castActive === true   → Commands go via Chromecast SDK
castActive === false  → Commands go via WebSocket signaling
```

---

## 9. Known Limitations

- **iOS screen mirroring**: Not possible from a browser (no `getDisplayMedia` in Safari/WKWebView). Use AirPlay on Fire TV instead.
- **DRM content**: Netflix, Disney+ etc. use DRM — cannot be captured or cast by web technologies.
- **Chromecast**: Works on desktop Chrome / Android Chrome only. Not available on iPhone Safari.
- **DLNA**: Deferred to v1.1 (would need a Node bridge on a LAN PC).
- **Private IP / NAT**: WebRTC needs STUN/TURN servers for cross-network connectivity. Free STUN only (no TURN).

---

*Last updated: 2026-10-29*