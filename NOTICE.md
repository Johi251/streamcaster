# Third-party notices

## Scope of this repository

Two independently licensed tracks live in this repository:

| Path | License | Scope |
| --- | --- | --- |
| `apps/`, `packages/`, `site/`, `scripts/`, `e2e/`, root docs | **MIT** — see `LICENSE` | Web sender, web receiver, signaling + proxy Workers, shared library, site |
| `airplay-receiver/` (git subtree) | **GPL-3.0** — see `airplay-receiver/LICENSE` and `airplay-receiver/NOTICE.md` | Native Android/Fire TV AirPlay receiver APK, incl. the UxPlay/JNI core |

The GPL track is a separate work: the web bundles do not link against it and the
APK ships as a standalone binary. The root MIT license applies to the web track
only. GPL-3.0 obligations apply when distributing or modifying the APK.

## Runtime dependencies of the shipped web bundles

| Component | Usage | License |
|---|---|---|
| [hls.js](https://github.com/video-dev/hls.js) `^1.5.15` | HLS playback in the web receiver | Apache-2.0 |
| [qrcode](https://github.com/soldair/node-qrcode) `^1.5.4` | Room-code QR rendering in the web receiver | MIT |

Runtime dependencies of the Workers (`signaling`, `proxy`) are limited to the
Cloudflare Workers runtime; no third-party code is bundled.

## Build-time tooling

Development tooling (`vite`, `typescript`, `vitest`, `wrangler`,
`@playwright/test`) is used to build and test this software and is not
distributed with it: Vite/Eslint-ecosystem components are MIT, TypeScript is
Apache-2.0, Playwright is Apache-2.0, Wrangler is MIT/Apache-2.0 (see the
respective packages).

## Trademarks

AirPlay, Chromecast, Fire TV, Apple TV, iPhone and iPad are trademarks of
their respective owners. This project is not affiliated with, endorsed by, or
sponsored by Apple, Google or Amazon. The AirPlay interoperability in the `airplay-receiver/` subtree is provided by
UxPlay (GPL-3.0).
