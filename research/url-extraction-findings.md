# Media URL extraction — findings & prioritized heuristics

Evidence classes: **[S]** self-hosted fixture capture (HAR via Playwright,
see `e2e/specs/extract.spec.ts`), **[D]** documented public convention
(Open Graph spec, schema.org, player documentation).

Reliability: ★★★ = near-always a real media URL · ★★ = usually · ★ = heuristic,
needs verification by `probeMedia()`.

## Priority order (highest first)

| # | Pattern | Evidence | Reliability | Notes |
|---|---------|----------|-------------|-------|
| 1 | `<video src="…">` attributes | [S] | ★★★ | Already-playing media. Direct selector `video[src]`. |
| 2 | `<video><source src="…"></video>` | [S] | ★★★ | Include `type` attr for mime. |
| 3 | URL regex: `.mp4` / `.m3u8` / `.mpd` / `.webm` in raw HTML | [S] | ★★★ | Strongest signal when it appears in `<script>` or attributes; verify with HEAD probe. |
| 4 | `og:video` / `og:video:url` / `og:video:secure_url` meta | [D] | ★★★ | Open Graph video tag; widely emitted by CMSs. |
| 5 | JSON-LD `VideoObject.contentUrl` / `embedUrl` | [D] | ★★★ | schema.org convention; `contentUrl` is the direct file. |
| 6 | `<meta property="twitter:player:stream">` | [D] | ★★ | Legacy Twitter card stream tag. |
| 7 | `<link rel="alternate" type="application/vnd.apple.mpegurl">` | [D] | ★★ | HLS alternate link (Apple podcast/blog convention). |
| 8 | Player globals: `jwplayer().getPlaylist()`, `videojs` options, `window.playerConfig`, `window.__INITIAL_STATE__` containing `.m3u8`/`.mp4` | [D] | ★ | Regex-scan raw HTML for m3u8/mp4 strings rather than evaluating JS (CSP + safety). |
| 9 | `data-video`, `data-mp4`, `data-src` attributes on any element | [S] | ★ | Common lazy-load convention. |
| 10 | `<iframe src>` pointing to a known player page | [D] | ★ | v1: surface as candidate with "open iframe URL instead" hint; do not recurse (scope/timebox). |

## Verification pipeline (implement in `detect.ts` / `probe.ts`)

1. Fetch page (direct → proxy `/fetch` fallback).
2. `DOMParser` scan for #1, #2, #4, #5, #6, #7, #9; raw-text regex for #3, #8.
3. De-duplicate, rank by table order, keep top 8.
4. For each candidate: `probeMedia()` — ranged GET (direct, then proxy) →
   confirm mime/size; drop dead URLs.
5. `corsOk` decides routing: mp4 → always direct on receiver; HLS without CORS
   headers → route through proxy `/hls?url=`.

## Proxy constraints discovered (feeds `apps/proxy` design)

- m3u8 manifests reference segments/keys with **relative URIs** — rewriter must
  resolve against the *original* manifest URL before wrapping into proxy URLs.
- `#EXT-X-KEY:URI=` must be rewritten like segments (pass-through, never
  altered content) or AES-128 clear-key HLS fails.
- Master playlists reference variant playlists → rewrite as `/hls?url=…`;
  media playlists reference segments → rewrite as `/seg?url=` (pass-through).
- DRM manifests (Widevine `#EXT-X-KEY:METHOD=SAMPLE-AES`, `.mpd` with
  ContentProtection) fail naturally in the player — receiver surfaces a
  "DRM-protected" toast. No bypass attempted (SCOPE.md exclusion).

## Limitations

- Sites that build URLs only at runtime via obfuscated JS cannot be extracted
  without executing their code — out of scope (CSP, safety, ToS).
- Encrypted/DRM streams are detected and reported, never decrypted.
- iframe-embedded players are surfaced as hints, not recursed in v1.
