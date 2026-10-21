# Research scope & legal guardrails

This folder documents the bounded reverse-engineering research phase for
StreamCaster's URL-extraction feature, following the *workflow* of the
[rea](https://github.com/morluto/rea) toolkit (capture → analyze → evidence →
limitations) without installing its binary-analysis tooling (not needed here).

## In scope

1. **Where media URLs surface in public web pages** — metadata, DOM, and
   player-configuration patterns. Evidence: HAR captures of pages we control
   (self-hosted test fixtures) plus well-documented, stable public conventions
   (Open Graph, schema.org JSON-LD, common player globals).
2. **CORS behavior of media origins** — direct vs. proxied loading decisions.
3. **Manifest structure** (m3u8) for URL rewriting through the proxy Worker.

## Hard exclusions (never, in any phase)

- **DRM circumvention**: no interception of EME/Widevine/FairPlay/PlayReady
  key exchange, no CDM analysis, no decryption of protected streams.
- **Private casting protocols**: no reverse engineering of AirPlay, Fire TV
  casting, or proprietary vendor protocols. Chromecast uses Google's public
  Cast SDK; Smart TVs are served by the receiver-page model.
- **Deobfuscation of proprietary players**: no unpacking/minified-code
  deobfuscation of third-party players, no scraping of paywalled services.
- **Aggressive automated capture of third-party sites**: HAR evidence is
  collected from pages we host ourselves; public-page conventions are cited
  from public documentation (Open Graph spec, schema.org, player docs).

## Method

- `captures/` — HAR files from our own test fixtures (see
  `e2e/specs/extract.spec.ts`, which exercises the same extraction pipeline
  against a self-hosted test page; the Playwright run records the network log).
- `url-extraction-findings.md` — prioritized heuristics list with evidence
  class and reliability rating, consumed by
  `apps/sender/src/extract/heuristics.ts`.
