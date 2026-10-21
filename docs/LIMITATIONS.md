# Limitations — read before promising anything

## iOS (iPhone / iPad)

- **Screen mirroring: impossible in a pure webapp.** iOS Safari exposes no
  `getDisplayMedia`. Mirror buttons are disabled with an explanatory tooltip.
  (Replica et al. achieve this via native iOS shells — out of scope.)
- **Chromecast: not available.** iOS Chrome uses WKWebView; the Cast framework
  never loads. The Cast button is detection-gated and simply absent. Use the
  receiver-page path (works fine on iPhone).
- **Works from iPhone:** URL casting, page-extraction casting, camera
  streaming, all remote controls.

## Chromecast

- Detection-gated: only desktop/Android Chrome gets the Cast button.
- Subtitles are not supported over the Cast path in v1.
- Mirroring/camera to Chromecast is out of scope (different capture API).
- For real-device casting: register the sender origin at
  https://cast.google.com/publish/ (Cast developer console), add
  `<site domain>` to the "Receiver" allowlist, and use the default media
  receiver app ID (as coded). Not needed for receiver-page casting.
- E2E validates the detection gating and op-mapping unit tests only — no
  physical Chromecast in CI.

## Browsers / TV devices

- **WebRTC features** (screen mirror, camera, local file) need WebSocket-capable
  browsers on BOTH ends; SSE-only TV browsers keep casting but lose live streams.
- **HLS** plays natively (Safari) or via hls.js (MSE). TV browsers without MSE
  (very old) only get mp4 URLs. The receiver's `canPlay` matrix is reported to
  the sender, which warns before casting.
- **Codecs:** mp4 H.264/AAC is the universal target. HEVC/H.265 is common on
  TVs but not on older browsers — cast mp4 when in doubt.
- **DRM content** (Netflix, Prime, …) is NOT supported and will not be
  bypassed. Protected manifests fail with a "DRM-protected" notice.

## Infrastructure

- Cloudflare free tier: 100k requests/day per Worker; no bandwidth cap but
  ~10 ms CPU per request. The direct-URL-first policy keeps the proxy idle
  unless CORS forces it through. Personal use is comfortable; heavy shared
  usage would exceed free tier.
- Signaling is 1 sender + 1 receiver per room code by design.

## Out of scope (v1)

- DLNA/UPnP push to Smart-TVs' native players (decision + migration path:
  `DECISIONS.md` D1).
- DASH (mpd) playback.
- Multi-receiver / multi-sender rooms.
- AirPlay (proprietary; and browser senders cannot do mDNS anyway).
