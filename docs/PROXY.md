# Proxy Worker (streamcaster-proxy)

Stateless Cloudflare Worker that solves two problems:
1. **CORS** — hls.js needs CORS headers on manifests and segments; many
   origins don't send them.
2. **Page probing** — the sender's extract feature needs a CORS-safe way to
   read third-party HTML.

## Routes

| Route | Purpose | Limits |
|---|---|---|
| `GET /fetch?url=` | CORS relay for HTML/JSON/text probes | https-only, 2 MB body, content-type whitelist, 3-redirect cap |
| `GET /hls?url=` | Fetch m3u8, rewrite every URI to this proxy (`/hls?url=` for playlist refs, `/seg?url=` for segments/keys/maps) | https-only, 1 MB manifest, no server-side variant fetching (player fetches each) |
| `GET /seg?url=` | Pure pass-through stream, forwards `Range` | ~0 CPU (streaming I/O) |
| `GET /health` | Liveness | — |

## SSRF policy

- Only `https:` URLs in production (`ALLOW_PRIVATE_TARGETS=1` relaxes this for
  local E2E fixtures — never set it in production).
- Hostname blocklist: localhost, `127.*`, `10.*`, `192.168.*`, `172.16-31.*`,
  `169.254.*` (incl. cloud metadata), `*.internal`, `*.local`, `192.0.2.*`.
- Max 3 redirects; every redirect target is re-validated through the same
  guards.
- Content-type whitelist: `text/html`, `application/json`,
  `*mpegurl`, `*dash+xml`, `video/mp4|webm|mp2t`, `audio/mp2t`,
  `(binary|application)/octet-stream`.

## Free-tier notes

- Rewriting is CPU-light (string pass). Segments are pass-through streams.
- Direct-URL-first policy in the sender keeps this Worker idle unless an
  origin lacks CORS headers.

## What it deliberately does NOT do

- No decryption, no DRM handling (`#EXT-X-KEY` URIs are rewritten like any
  other URI; the keys themselves are untouched — protected streams fail
  naturally and are reported as DRM-protected).
- No caching (personal scale).
