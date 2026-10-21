# E2E tests

Playwright specs validating the deployed (or locally served) StreamCaster stack.

- `playwright.config.ts` — projects for desktop + Android-emulation Chromium; `E2E_BASE_URL` env selects target.
- `specs/` — pairing, url-cast, hls, control, mirror, chromecast-gating, extract.
- `local-setup.md` — how to run everything locally with `wrangler dev` + `vite preview`.

Run: `pnpm exec playwright test` (from repo root, after `pnpm exec playwright install chromium`).
