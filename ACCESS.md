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
| GET | /browse?url=URL | Intercepting-Proxy: lädt Seite, injiziert Media-Capture, re-routed Links |
| GET | /p?url=URL | Permissiver Passthrough (Media/HTML) mit Range + CORS (für gecapturte URLs) |

SSRF-Guards: nur https:, keine privaten/Loopback-Ziele, Content-Type-Whitelist
(/browse erlaubt text/html; /p ist bewusst permissiv für gecapturte Media).

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

### AirPlay-Receiver-APK (veröffentlicht, v1.0.2)
- Eigenständiges Repo: https://github.com/Johi251/streamcaster-airplay-receiver (GPL-3.0)
- Verbindet sich als Receiver via WS zum Signaling-Worker, generiert eigenen Room-Code
- Empfängt CommandOps, spielt Media via ExoPlayer/Media3; AirPlay-2-Spiegelung via UxPlay-Kern
- AirPlay-Gerätename im mDNS: **„StreamCaster TV"** (App-Name: „StreamCaster Receiver")
- Download (stabil, `latest`): `https://github.com/Johi251/streamcaster-airplay-receiver/releases/latest/download/streamcaster-receiver.apk`
- Kurz-Redirect der Webapp: **`https://streamcaster.pages.dev/apk`** → 302 auf obige URL
  (definiert in `scripts/build-site.mjs` → `_redirects`; Release-Wechsel braucht kein SPA-Redeploy)
- Build v1.0.2: 18.362.116 Bytes, SHA-256 `e7c78af64464e979be13359d57e161c20e09b629d43366a7489a847ab45b0843`
- ABIs `arm64-v8a` + `armeabi-v7a`, minSdk **24**, targetSdk 34, Paket `com.streamcaster.receiver`
- Signatur v2/v3, Cert-SHA-256 `57d47fdad1d88ef1535a4e23ce66e9c16db3e2ecfd5f9f0499cb0748ccc86d9c`
  (identisch zu v1.0.0 → Updates installieren über die alte Version)
- **Build läuft auf GitHub Actions (Ubuntu)**, `.github/workflows/android.yml`; Artifact = unsigniert,
  Signatur lokal mit `airplay-receiver/.secrets/streamcaster-release.jks`.
  Optional signiert die CI selbst, wenn die Repo-Secrets `ANDROID_KEYSTORE_B64`,
  `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` gesetzt sind.
- Kompatibilität: **Fire OS 6+ (Android 7.0+)** — Fire TV Stick 4K/4K Max/Lite, 3rd-Gen-Stick, Cube.
  Fire OS 5 (2. Gen) ist zu alt (API 22 < minSdk 24).
- **Lint-Gate in der CI:** `:app:lintRelease` läuft mit, bricht aber nur bei `NewApi`-Funden ab
  (Aufrufe über minSdk hinaus = Absturz auf älteren Geräten). Die übrigen Lint-Fehler sind Altlasten.
  Stand: 0 `NewApi`-Verstöße.
- Webapp-Karte: `buildAirPlayCard()` in `apps/sender/src/main.ts`
- Prompt: `research/airplay-receiver-apk-prompt.md`
- **Auf echter Hardware verifiziert** (29.10., Fire TV Stick 4K 1. Gen `AFTMM`, Fire OS 6.7.1.1,
  `armeabi-v7a`, SDK 25): App startet, `HubActivity` im Vordergrund, Raum-Code wird angezeigt,
  `AirPlayService` auf Port 7000, mDNS `_airplay._tcp` + `_raop._tcp` als „StreamCaster TV".
  Diagnose per `adb connect LAN-IP-REDACTED:5555` (ADB-Debugging am Stick aktiviert).
- **Offen:** E2E-Test mit iPhone (Bildschirmspiegelung) und Sender-Gegenstelle.

### Intercepting-Proxy (Option C — umgesetzt)
- Proxy-Route `/browse?url=URL` lädt Zielseite, injiziert Media-Capture-Script
  (`rewrite.ts` BROWSE_INJECT), re-routed selbige Links/Forms/Iframes durch
  weitere `/browse?url=`-Hops, streift X-Frame-Options + CSP.
- Gecapturte Media-URL (postMessage an Eltern-Frame) → Cast-Kandidat im Sender.
- Routing der Kandidaten: HLS (`.m3u8`) → `/hls?url=`; sonstiges Media → `/p?url=`
  (permissiver Passthrough mit Range + CORS).
- IP-gebundene Tokens: Media immer durch Proxy leiten, nie direkt.

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
- v1.1.0: PWA (Manifest + Icons + Service Worker, Offline-Shell), AirPlay-Download-Hub,
  Intercepting-Proxy (`/browse` + `/p`), Browse-&-Cast-UI im Sender
- v1.1.1: APK-Download live verdrahtet (`/apk`-Redirect), AirPlay-Karte mit
  Sideloading-Anleitung + SHA-256, AirPlay-Gerätename „StreamCaster TV"
- v1.1.2: AirPlay-Karte auf APK v1.0.1 umgestellt (18,4 MB, arm64 + armv7, Fire OS 6+),
  Vertrauenszeile zweizeilig, Kompatibilitätshinweis
- v1.1.3: AirPlay-Karte auf APK v1.0.2 (Startabsturz behoben)
- Extern: AirPlay-Receiver-APK v1.0.2 (GitHub: Johi251/streamcaster-airplay-receiver, GPL-3.0)
  — v1.0.0 war auf Fire OS 6 nicht installierbar (minSdk 28, nur arm64),
  v1.0.1 stürzte beim Start ab (`RoundedCornerShape(999)` = 999 Prozent)
