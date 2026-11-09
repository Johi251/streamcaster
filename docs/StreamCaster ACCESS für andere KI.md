# StreamCaster — Access & Integration Reference

Zentrale Referenz für jeden KI-Agenten, der an StreamCaster arbeitet.
Alle Endpunkte, Deploy-Befehle und Integrationspunkte in einer Datei.

> **Status:** Der aktuelle Projektzustand steht ausschließlich in
> [STATUS.md](../STATUS.md) (Single Source of Truth). Dies ist eine synchronisierte
> Kopie der kanonischen [ACCESS.md](../ACCESS.md) — bei Abweichung gilt ACCESS.md.

## Live URLs

| Dienst | URL | Zweck |
|---|---|---|
| Sender (PWA) | https://streamcaster.pages.dev | Cast-Startseite, Fähigkeiten-Hub |
| Receiver | https://streamcaster.pages.dev/r/ | TV-Empfängerseite, auto-generiert Room-Code |
| Receiver (Code in URL) | https://streamcaster.pages.dev/r/?code=XXXXXX | Reload-fest; `/r/<CODE>` funktioniert auf Pages **nicht** (fällt auf den Sender zurück) |
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

**Join-Antwort (Server → Client):**
```json
{"t":"joined","code":"ABC234","role":"sender","peers":2,"peerPresent":true,"state":{},"peerCaps":{}}
```
`peerPresent` ist die einzige verlässliche Aussage darüber, ob die Gegenrolle im Raum ist —
`peers` zählt den Beitretenden selbst mit. Der Sender zeigt erst bei `peerPresent: true` die
verbundene Ansicht; sonst den Wartezustand mit sichtbarem Code. Clients sollten
`peerPresent ?? peers >= 2` lesen, damit ältere Worker weiter funktionieren.

## Integrationspunkte (für externe Projekte)

### AirPlay-Receiver-APK (veröffentlicht, v1.0.4)
- Eigenständiges Repo: https://github.com/Johi251/streamcaster-airplay-receiver (GPL-3.0)
- Verbindet sich als Receiver via WS zum Signaling-Worker, generiert eigenen Room-Code
- Empfängt CommandOps, spielt Media via ExoPlayer/Media3; AirPlay-2-Spiegelung via UxPlay-Kern
- AirPlay-Gerätename im mDNS: **„StreamCaster TV"** (App-Name: „StreamCaster Receiver")
- Download (stabil, `latest`): `https://github.com/Johi251/streamcaster-airplay-receiver/releases/latest/download/streamcaster-receiver.apk`
- **Kurze Direkt-URL der Webapp: `https://streamcaster.pages.dev/a.apk`** — echte Datei auf
  Cloudflare Pages, MIME `application/vnd.android.package-archive`, **KEINE Umleitung**.
  Kurzform `/apk` (Rewrite auf `/a.apk`) ist für die Fire-TV-Tastatur gedacht.
  Vorher war `/apk` ein 302 auf GitHub (2 Hops) → ältere Silk-Browser speicherten die
  HTML-Antwort statt der APK → „Problem beim Parsen des Pakets". Jetzt behoben.
- Build v1.0.4: 9.535.890 Bytes, SHA-256 `4cb303e669ab7222360e69bd03413ac866879a012bde30aaac43b9c38f0e1f57`
- ABIs `arm64-v8a` + `armeabi-v7a`, minSdk **22** (Fire OS 5 = Android 5.1), targetSdk 34, Paket `com.streamcaster.receiver`
- Signatur v1+v2+v3 (v1 zwingend für Android ≤6), Cert-SHA-256 `57d47fdad1d88ef1535a4e23ce66e9c16db3e2ecfd5f9f0499cb0748ccc86d9c`
  (identisch zu v1.0.0 → Updates installieren über die alte Version)
- **Build läuft auf GitHub Actions (Ubuntu)**, `.github/workflows/android.yml`; Artifact = unsigniert,
  Signatur lokal mit `airplay-receiver/.secrets/streamcaster-release.jks` via `scripts/sign-apk.mjs`.
  Optional signiert die CI selbst, wenn die Repo-Secrets `ANDROID_KEYSTORE_B64`,
  `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` gesetzt sind.
- Kompatibilität: **Fire OS 5+ (Android 5.1+)** — Fire TV Stick 1. Gen/Lite (Fire OS 5), 2./3. Gen,
  4K/4K Max (Fire OS 6/7/8), Cube. minSdk 22 deckt alle ab.
- **Lint-Gate in der CI:** `:app:lintRelease` läuft mit, bricht aber nur bei `NewApi`-Funden ab
  (Aufrufe über minSdk hinaus = Absturz auf älteren Geräten). Die übrigen Lint-Fehler sind Altlasten.
  Stand: 0 `NewApi`-Verstöße (alle API-23-Stellen mit `Build.VERSION.SDK_INT`-Guards abgesichert).
- Webapp-Karte: `buildAirPlayCard()` in `apps/sender/src/main.ts`
- Prompt: `research/airplay-receiver-apk-prompt.md`
- **Auf echter Hardware verifiziert** (29./31.10., Fire TV Stick 4K 1. Gen `AFTMM`, Fire OS 6.7.1.1,
  `armeabi-v7a`, SDK 25): App startet, `HubActivity` im Vordergrund, Raum-Code wird angezeigt,
  `AirPlayService` auf Port 7000, mDNS `_airplay._tcp` + `_raop._tcp` als „StreamCaster TV".
  Diagnose per `adb connect LAN-IP-REDACTED:5555` (ADB-Debugging am Stick aktiviert).
- **Video-Cast auf Hardware bestätigt** (v1.0.3): Browser-Sender → `{t:"join"}` → Receiver spielt
  MP4 über ExoPlayer (`HW.video.avc`, 1280×720, 833 kbps), eigene Wiedergabe-Leiste mit
  „OK = Pause", ±10 s, „Zurück = Beenden"; am Ende „0:10 / 0:10" und „OK = Abspielen".
- **Verifiziert (31.10.):** iPhone/iPad-AirPlay-Spiegelung auf Fire TV via Receiver-APK
  funktioniert — Bild erscheint, Steuerung über AirPlay. Damit ist die volle
  Sender-Brücke (Web-PWA **und** native AirPlay) abgedeckt.
- **Offen:** E2E-Playwright-Suite (13 Specs) bewusst aufgeschoben; Sender-Gegenstelle
  (Web-App → TV) in vorherigen Sessions bereits geprüft.

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
pnpm test                 # Unit-Tests (47)
pnpm build:site           # Site bauen ohne Deploy
pnpm deploy:all           # Full Deploy
```

**Wichtig — `build:site` allein reicht nicht für Browse:** Die Sender-App backt
`VITE_PROXY_URL` / `VITE_SIGNALING_URL` zur Build-Zeit ein. Ohne diese Variablen
ist der In-Page-Browser deaktiviert ("Proxy not configured"). `deploy:all` setzt
sie automatisch aus den deployten Worker-URLs; ein manueller Build braucht:

```bash
VITE_SIGNALING_URL=https://streamcaster-signaling.streamcaster.workers.dev \
VITE_PROXY_URL=https://streamcaster-proxy.streamcaster.workers.dev \
node scripts/build-site.mjs
```

### E2E-Tests (Playwright, 17 Tests)

Laufen gegen eine bereits deployte Umgebung (kein lokaler Server nötig). Die
`?code=`-Übergabe an den Receiver ist Voraussetzung für deterministische Räume.

```bash
E2E_BASE_URL=https://streamcaster.pages.dev \
E2E_PROXY_URL=https://streamcaster-proxy.streamcaster.workers.dev \
E2E_SIGNALING_URL=https://streamcaster-signaling.streamcaster.workers.dev \
pnpm exec playwright test -c e2e/playwright.config.ts
```

Stand: 17/17 grün gegen Live (Oktober 2026). Hinweis: Der HLS-über-Proxy-Test
braucht die echte, öffentlich erreichbare Seite als `E2E_BASE_URL` — ein
`127.0.0.1`-Ursprung ist für den Remote-Proxy nicht abrufbar.

## Cloudflare-Zugang

- **Login:** `pnpm exec wrangler login` (OAuth, öffnet Browser)
- **Dashboard:** https://dash.cloudflare.com
- **Workers-Subdomain:** streamcaster.workers.dev
- **Pages-Projekt:** streamcaster

Kein API-Token im Repo. Wrangler-OAuth-Token liegt in
`%APPDATA%/xdg.config/.wrangler/config/default.toml` (maschinenlokal).

## Zugänge für KI-Handoff

Diese Sektion sammelt alle Zugänge an einem Ort, damit ein anderer KI-Agent (oder du von
einem anderen Tool aus) Änderungen vornehmen kann. **Alle Secrets sind maschinenlokal und
gitignored** — sie werden hier nur lokalisiert, nicht im Klartext hinterlegt. Für einen
anderen Rechner müssen Keystore + Passwort + Wrangler-Login separat übertragen werden.

### GitHub
- **Web-App (Haupt-Repo):** `https://github.com/Johi251/streamcaster` — **ÖFFENTLICH (seit 09.11.2026, Freigabe Johann)**.
  Enthält Sender, Receiver, Worker, Proxy, Site, Docs. Stand ist auf `main` gepusht
  (Remote `origin` konfiguriert). Push: `git push`. Achtung: die Git-Historie enthält
  weiterhin Zugangs-Metadaten (CF-Account-E-Mail/-ID, LAN-IP des Test-Sticks), die vor
  der Öffnung committet wurden — keine Zugangsdaten, aber öffentlich sichtbar. Regel ab
  sofort: keine neuen Zugangsdaten/Metadaten in getrackte Dateien.
- **APK-Repo:** `https://github.com/Johi251/streamcaster-airplay-receiver` — **PUBLIK**.
  Eigenständiges Android-Projekt; im Haupt-Repo via `.gitignore` ausgeklammert
  (`airplay-receiver/`). Build + Release v1.0.4 liegen dort.
- **Auth:** `gh` CLI ist auf diesem Rechner authentifiziert (OAuth). Neue Repos:
  `gh repo create <name> --private --source . --remote origin --push`.

### Cloudflare
- **Auth:** `pnpm exec wrangler login` (OAuth) — einmalig eingerichtet. Token in
  `%APPDATA%/xdg.config/.wrangler/config/default.toml` (maschinenlokal, nicht im Repo).
- **Account:** CF-ACCOUNT-EMAIL-REDACTED · Account-ID `CF-ACCOUNT-ID-REDACTED`
- **Workers-Subdomain:** `streamcaster.workers.dev`
- **Pages-Projekt:** `streamcaster` · **Dashboard:** https://dash.cloudflare.com

### APK signieren (für künftige Versionen)
- Der CI-Build (`airplay-receiver/.github/workflows/android.yml`) liefert ein **unsigniertes**
  Artefakt. Signatur lokal mit dem Keystore `airplay-receiver/.secrets/streamcaster-release.jks`.
- Keystore-Passwort + Key-Alias/-Passwort: `airplay-receiver/.secrets/signing.properties`
  (gitignored, maschinenlokal).
- Signier-Skript: `scripts/sign-apk.mjs <unsigniert.apk> <ausgabe.apk>` — erzwingt v1+v2+v3
  (v1 zwingend für Android ≤6) und minSdk 22.
- Danach Release: `gh release create vX.Y.Z <apk> --repo Johi251/streamcaster-airplay-receiver`
  und die signierte APK nach `airplay-receiver/dist/streamcaster-receiver.apk` kopieren, damit
  `scripts/build-site.mjs` sie auf Pages unter `/a.apk` ausliefert (danach `pnpm deploy:all`).

### Test-Device (Fire TV Stick 4K, AFTMM)
- ADB over Wi-Fi: `adb connect LAN-IP-REDACTED:5555` (ADB-Debugging am Stick aktiviert).
- ADB-Toolchain: `airplay-receiver/.toolchain/android-sdk/platform-tools/` (oder
  `C:\Users\johan\scb-sdk\platform-tools`). In **jeder** neuen Shell erst `adb connect`
  ausführen — der ADB-Daemon hält nicht über Shell-Aufrufe hinweg.
- Bei `offline`-Zustand: am Stick **Einstellungen → Meine Fire TV → Entwickleroptionen →
  ADB-Debugging AUS, dann EIN** (startet adbd neu); ggf. „USB-Debugging zulassen" erneut
  bestätigen.
- Verifikation nach Install: `adb install -r <apk>` (connect + install in einem Shell-Aufruf),
  `adb shell dumpsys package com.streamcaster.receiver | grep versionName`,
  `adb shell am start -n com.streamcaster.receiver/.HubActivity`.

## Versionierung

- v1.0.0 — v1.0.3: Webapp, Proxy, Extraction, Chromecast, Deploy-Automation
- v1.1.0: PWA (Manifest + Icons + Service Worker, Offline-Shell), AirPlay-Download-Hub,
  Intercepting-Proxy (`/browse` + `/p`), Browse-&-Cast-UI im Sender
- v1.1.1: APK-Download live verdrahtet (`/apk`-Redirect), AirPlay-Karte mit
  Sideloading-Anleitung + SHA-256, AirPlay-Gerätename „StreamCaster TV"
- v1.1.2: AirPlay-Karte auf APK v1.0.1 umgestellt (18,4 MB, arm64 + armv7, Fire OS 6+),
  Vertrauenszeile zweizeilig, Kompatibilitätshinweis
- v1.1.3: AirPlay-Karte auf APK v1.0.2 (Startabsturz behoben)
- v1.1.4: AirPlay-Karte auf APK v1.0.3 (`singleTask`, keine Doppel-Oberfläche mehr)
- Extern: AirPlay-Receiver-APK v1.0.4 (GitHub: Johi251/streamcaster-airplay-receiver, GPL-3.0)
  — v1.0.0 war auf Fire OS 6 nicht installierbar (minSdk 28, nur arm64),
  v1.0.1 stürzte beim Start ab (`RoundedCornerShape(999)` = 999 Prozent),
  v1.0.2/1.0.3 beheben das bzw. die doppelte Activity-Instanz,
  v1.0.4 senkt minSdk 24→22 (Fire OS 5) und signiert v1+v2+v3, damit auch alte
  Fire-TV-Sticks („Problem beim Parsen des Pakets") installieren können; APK liegt
  ab sofort direkt auf `streamcaster.pages.dev/a.apk` (kein GitHub-Redirect mehr)
