# Contributing to StreamCaster

Thanks for your interest! This repository is the **web stack** (sender,
receiver, signaling, proxy) and is MIT-licensed. The **Android AirPlay
receiver APK lives in its own repository** (`airplay-receiver/`, GPL-3.0) —
APK issues and patches belong there.

## Development setup

Requirements: Node.js 20+, pnpm 10+.

```sh
pnpm install
pnpm verify        # typecheck + unit tests — must be green before any push
pnpm build         # shared -> receiver -> sender
pnpm dev:sender    # vite dev server
pnpm dev:receiver
```

End-to-end tests need local Workers + a Chromium via Playwright:

```sh
pnpm exec playwright test
```

## Ground rules

1. **Read the decisions first.** `DECISIONS.md` records why the architecture
   looks the way it is (D1 DLNA deferral, D2 iOS mirroring limits, D5
   direct-URL-first proxy, D6 room-code transport, D7 one-click = QR deep
   link). A PR that contradicts a recorded decision must argue why the
   decision should change — not silently work around it.
2. **`STATUS.md` is the single source of truth** for project state. Do not
   duplicate status text in other docs; link to it. `scripts/check-status.mjs`
   verifies this in `pnpm verify`.
3. **No GPL code in this repo.** The MIT license only holds because the web
   stack is clean; UxPlay-derived code stays in the GPL-3.0 receiver repo.
4. **Commits:** short imperative subject lines, e.g.
   `fix: validate malformed #join deep link (D7)`.
5. **Secrets stay out.** `.secrets/`, wrangler tokens and account IDs never
   enter the repo or the issue tracker.

## Submitting changes

1. Fork / branch from `main`.
2. Make the change; add or adjust tests (`*.test.ts` runs under vitest,
   `e2e/specs/*.spec.ts` under Playwright).
3. `pnpm verify` green.
4. Open a PR describing *what* and *why*, referencing the relevant decision
   (D-number) if applicable.

## Licensing

By contributing you agree that your contributions are licensed under the
MIT License. See `LICENSE` and `NOTICE.md` for third-party notices.
