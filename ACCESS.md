# StreamCaster — Access & Integration Reference

Zentrale Referenz für jeden KI-Agenten, der an StreamCaster arbeitet.
Alle Endpunkte, Deploy-Befehle und Integrationspunkte in einer Datei.

## Live URLs

| Dienst | URL | Zweck |
|---|---|---|
| Sender (PWA) | https://streamcaster.pages.dev | Cast-Startseite, Fähigkeiten-Hub |
| Receiver | https://streamcaster.pages.dev/r/ | TV-Empfängerseite, auto-generiert Room-Code |
| Signaling-Worker | https://streamcaster-signaling.streamcaster.workers.dev | WebSocket-Signaling, Room-DO |
| Proxy-Worker | https://streamcaster-proxy.streamcaster.workers.dev | CORS-Relay, HLS-Rewrite, Media-Pass-through |

## Deploy

**Voraussetzung:** `pnpm exec wrangler login` (Cloudflare-Account, einmalig).
Account: CF-ACCOUNT-EMAIL-REDACTED · Account-ID: CF-ACCOUNT-ID-REDACTED

**Deploy-Befehl:** `pnpm deploy:all`
- Registriert workers.dev-Subdomain falls fehlt (Preflight)
- Deployt Signaling-Worker → URL wird ins Site-Build gebacken
- Deployt Proxy-Worker → URL wird ins Site-Build gebacken
- Baut Site neu mit echten Worker-URLs
- Erstellt Pages-Projekt falls fehlt
- Deployt nach Cloudflare Pages

**Nur Site neu bauen (ohne Deploy):** `pnpm build:site`

## Signaling-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| GET | /health | Health-Check |
| WS | /ws?code=CODE&role=sender\|receiver | WebSocket-Signaling |
| GET | /sse?code=CODE&role=ROLE | SSE-Fallback (TV-Browser ohne WS) |
| POST | /send?code=CODE | POST-Fallback für Commands |
| GET | /state?code=CODE | Playback-State abfragen |

## Proxy-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| GET | /health | Health-Check |
| GET | /fetch?url=URL | CORS-Relay für HTML/JSON (2MB-Cap) |
| GET | /hls?url=URL | m3u8-Manifest mit umgeschriebenen URIs |
| GET | /seg?url=URL | Segment-Pass-through mit Range-Forwarding |

SSRF-Guards: nur https:, keine privaten/Loopback-Ziele, Content-Type-Whitelist.

## Protokoll

**Room-Code:** 6 Zeichen, Alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (kein 0/O/1/I/L)

**CommandOps (Sender → Receiver):**
```json
{"t":"cmd","op":{"name":"load","url":"...","title":"...","mime":"..."}}
{"t":"cmd","op":{"name":"play"}}
{"t":"cmd","op":{"name":"pause"}}
{"t":"cmd","op":{"name":"seek","time":12.5}}
{"t":"cmd","op":{"name":"volume","value":0.8}}
{"t":"cmd","op":{"name":"stop"}}
{"t":"cmd","op":{"name":"subtitle","url":"...","label":"Deutsch"}}
{"t":"cmd","op":{"name":"file-meta","filename":"...","size":1234,"mime":"..."}}
{"t":"cmd","op":{"name":"stream-start","kind":"screen"|"camera"}}
{"t":"cmd","op":{"name":"stream-stop"}}
```

**WebRTC-Signalisierung:**
```json
{"t":"webrtc","kind":"answer"|"ice","payload":...}
```

**State-Sync (Receiver → Sender):**
```json
{"t":"state","state":{"paused":false,"position":12.5,"duration":120,"currentUrl":"...","title":"..."}}
```

## Integrationspunkte (für externe Projekte)

### AirPlay-Receiver-APK (geplant)
- Verbindet sich als Receiver via WS zum Signaling-Worker
- Generiert eigenen Room-Code (gleiches Alphabet)
- Empfängt CommandOps, spielt Media via ExoPlayer
- APK-Download-URL: Platzhalter `AIRPLAY_RECEIVER_APK_URL` (in Webapp einzutragen)
- Prompt: `research/airplay-receiver-apk-prompt.md`

### Intercepting-Proxy (geplant, Option C)
- Neue Proxy-Route `/browse?url=URL`
- Lädt Zielseite, injiziert Intercept-Script
- Monkey-patched HTMLMediaElement.prototype.play / src-Setter
- Abgefangene Media-URL → PostMessage an Eltern-Frame → Cast-Kandidat
- IP-gebundene Tokens: Media durch `/seg?url=` leiten, nicht direkt

## Repository-Struktur

```
apps/sender/        — Sender-PWA (Vite + TypeScript)
apps/receiver/      — Receiver-Seite (Vite + TypeScript)
apps/signaling/     — Signaling-Worker (Cloudflare Worker + DO)
apps/proxy/         — Proxy-Worker (Cloudflare Worker)
packages/shared/    — Gemeinsames Protokoll, Room-Code, Capabilities
scripts/            — deploy.mjs, build-site.mjs, ensure-workers-subdomain.mjs
e2e/                — Playwright-E2E (13 Specs)
site/               — Build-Output (site/dist → Pages deploy)
docs/               — LIMITATIONS.md, PROTOCOL.md, PROXY.md
research/           — SCOPE.md, airplay-receiver-apk-prompt.md
```

## Build & Test

```bash
pnpm install              # Dependencies
pnpm -r typecheck         # Typecheck alle Packages
pnpm test                 # Unit-Tests (35)
pnpm build:site           # Site bauen ohne Deploy
pnpm deploy:all           # Full Deploy
```

## Cloudflare-Zugang

- **Login:** `pnpm exec wrangler login` (OAuth, öffnet Browser)
- **Dashboard:** https://dash.cloudflare.com
- **Workers-Subdomain:** streamcaster.workers.dev
- **Pages-Projekt:** streamcaster

Kein API-Token im Repo. Wrangler-OAuth-Token liegt in
`%APPDATA%/xdg.config/.wrangler/config/default.toml` (maschinenlokal).

## Versionierung

- v1.0.0 — v1.0.3: Webapp, Proxy, Extraction, Chromecast, Deploy-Automation
- Geplant: Intercepting-Proxy, PWA-Manifest, Fähigkeiten-Hub-UI
- Extern: AirPlay-Receiver-APK (eigenständiges Projekt)
