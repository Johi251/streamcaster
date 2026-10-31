# StreamCaster — Architecture & Product Decisions

## D1 — DLNA/UPnP push: deferred to v1.1 (decided v1)

**Decision:** v1 ships without a DLNA/UPnP sender path. Smart TVs, Fire TV (Silk
browser), Echo Show and any browser-capable device are served by the
**receiver-page model**: open `https://<site>/r/` on the device, it shows a room
code + QR, and the sender pushes commands over signaling. mp4 plays natively in
`<video>`, HLS via hls.js.

**Why not DLNA in v1:**
1. SSDP multicast is impossible from a browser and from Cloudflare Workers — a
   UPnP bridge must run as a Node helper on a LAN PC, which breaks the
   "free webapp, nothing to install" promise.
2. Most Wi-Fi APs have client isolation enabled, blocking SSDP entirely.
3. Per-vendor AVTransport quirks (Samsung/LG/Sony differ in action sets and
   DIDL metadata) are a support burden disproportionate to v1 value.
4. The autonomous E2E suite cannot validate a physical UPnP stack, so the
   feature would ship unvalidated.

**Migration path (v1.1):** a Node bridge (`apps/dlna-bridge`) joins the existing
signaling room as `role: "receiver"` with a `dlna` capability and translates
`load/play/pause/seek/stop` CommandOps to AVTransport
`SetAVTransportURI/Play/Pause/Seek/Stop` SOAP calls. No protocol change needed.

## D2 — iOS screen mirroring: impossible in a pure webapp (accepted)

iOS Safari exposes no `getDisplayMedia` and no Cast framework, so a webapp
cannot mirror an iPhone screen. The sender UI disables mirroring on iOS with an
explanatory tooltip. What works from an iPhone: URL casting, camera streaming,
and controlling the receiver. Screen mirroring works on Android/desktop Chrome.
A native iOS shell (Replica-style) is the only way around this — out of scope
for a free webapp.

## D3 — Chromecast: official Cast Web Sender SDK, detection-gated

Native casting to Chromecast uses Google's documented Cast Web Sender API.
It only exists in desktop/Android Chrome — the Cast button is rendered only
when `cast.framework` is detected. iPhone users use the receiver-page path.
Mirroring to Chromecast is out of scope for v1 (different capture API).

## D4 — Reverse engineering: bounded and legal

The "rea" toolkit is used only for media-URL *extraction* research (how public
pages expose mp4/HLS URLs: meta tags, JSON-LD, player configs). Hard exclusions:
no DRM/EME circumvention, no deobfuscation of proprietary players, no
reverse engineering of AirPlay/Fire TV private protocols. See
`research/SCOPE.md`.

## D5 — Media proxy: direct-URL-first, proxy only on CORS failure

Sender probes each media URL; mp4 always plays directly on the receiver
(`<video src>` needs no CORS). HLS only routes through the proxy Worker when
the origin does not send CORS headers. This keeps free-tier Worker load minimal.

## D6 — Room code via URL: query form only (`?code=`)

**Decision:** The receiver adopts a valid 6-char code from `?code=` (and, on any
host that actually serves it, from the `/r/<CODE>` path); otherwise it generates
a random code as before. `/r/?code=XXXXXX` is the reload-stable form used by QR
deep links, bookmarks and the E2E suite.

**Why the query form:** Cloudflare Pages does not apply the `/r/*` SPA rewrite to
path segments — `/r/<CODE>` falls through to the sender's `index.html`. The query
form resolves to the real `/r/` directory, so it works on every host. Making the
room deterministic also lets the Playwright suite drive both sides into the same
room and lets a user pin a room via bookmark.
