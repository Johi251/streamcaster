# Third-party notices

## Scope of this repository

This repository (web sender, web receiver, signaling worker, media proxy,
shared library, site) is licensed under the **MIT License** — see `LICENSE`.
It contains no GPL code.

The **Android AirPlay receiver APK is a separate repository**
(`airplay-receiver/`, excluded from this repo via `.gitignore`). Because it
bundles [UxPlay](https://github.com/FDH2/UxPlay), that repository is licensed
**GPL-3.0** and carries its own `LICENSE` and `NOTICE.md`. Distributing or
modifying the APK happens there, under GPL-3.0 — not here.

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
sponsored by Apple, Google or Amazon. The AirPlay interoperability in the
separate receiver repository is provided by UxPlay (GPL-3.0).
