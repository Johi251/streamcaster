# StreamCaster — Handbuch & Projektrückblick

> **Status:** Der aktuelle Projektzustand steht ausschließlich in
> [STATUS.md](../STATUS.md) (Single Source of Truth). Dieses Handbuch
> beschreibt Geräte und Funktionen, keinen temporären Status.

## 1. Was ist StreamCaster?

StreamCaster bringt Web-Video, lokale Dateien und den Bildschirm eines Smartphones/PCs
auf den Fernseher — **ohne Kabel, ohne Dongle, ohne Account, ohne Installation auf dem
Sender**. Ein Gerät *sendet* (Smartphone/PC), ein zweites *empfängt* (meist der Fernseher)
und spielt ab. Beide finden sich über einen 6-stelligen Raum-Code, den der TV anzeigt.

- Live-Sender (PWA): **https://streamcaster.pages.dev**
- Live-Empfänger (TV-Browser): **https://streamcaster.pages.dev/r/**
- Fire-TV-App (AirPlay für iPhone): **https://streamcaster.pages.dev/a.apk**

---

## 2. Unterstützte Geräte

| Rolle | Gerät | Voraussetzung | Status |
|---|---|---|---|
| **Sender** (startet den Cast) | Smartphone, Tablet, PC | Moderner Browser (Chrome, Edge, Firefox, Safari) + Internet | ✅ alles ab ~2019 |
| **Empfänger (Browser)** | Amazon Fire TV (Silk-Browser) | Fire OS 5–8 | ✅ getestet (Stick 4K) |
| **Empfänger (Browser)** | Android TV / Google TV / Chromecast mit Google TV / Nvidia Shield | Android-Browser | ✅ |
| **Empfänger (Browser)** | Samsung Smart-TV (App „Internet", ab ~2019) | Tizen-Browser | ✅ |
| **Empfänger (Browser)** | LG Smart-TV (App „Web-Browser", ab ~2019) | webOS-Browser | ✅ |
| **Empfänger (Browser)** | Beliebiger TV/Box mit modernem Browser + Bildschirm | HTML5/H.264 | ✅ |
| **Empfänger (AirPlay)** | Amazon Fire TV Stick & Cube | Fire OS **5–8** + installierte APK | ✅ (minSdk 22) |
| **iPhone / iPad** (als Sender) | Safari → Sender-PWA **oder** AirPlay-Spiegelung | iOS 13+ | ✅ |

**Hinweise / Grenzen:**
- Der Cast läuft über das lokale Netzwerk (gleiches WLAN empfohlen). Eine Internet-
  Verbindung ist nur für das Signaling nötig, die Medien gehen P2P.
- Sehr alte Smart-TVs mit zu altem Browser: empfiehlt sich ein Fire TV / Chromecast als
  Empfänger dazwischen.
- Manche Video-Portale blocken Fremd-Player; dafür gibt es die „Browse & Cast"-Funktion
  (siehe Funktionen), die den Proxy nutzt.
- **Fire OS 5** (ältere Sticks, z. B. 2. Gen / Lite): durch `minSdk 22` + v1-Signatur
  der APK unterstützt — vorher scheiterte die Installation mit „Problem beim Parsen
  des Pakets".

---

## 3. Funktionen

- **Link casten:** Eine URL (YouTube, Vimeo, direct MP4/HLS, viele Portale) eingeben oder
  einfügen → der TV lädt und spielt ab.
- **Link-Vorschau (Bestätigungs-Modal):** Vor jedem URL-Cast erscheint ein Modal mit
  Domain und vollständiger URL — **Cast** führt aus, **Abbrechen** bricht ab. Nur
  http(s)-Ziele; `javascript:`/`data:`/`file:` werden abgelehnt (Sicherheits-Gate,
  seit 09.11.2026 live).
- **Datei senden:** Lokale Video-/Audio-/Bilddatei vom Sender zum TV übertragen.
- **Bildschirm- & Kamera-Spiegeln:** Der Sender streamt seinen Screen oder die Webcam
  via WebRTC zum TV.
- **QR-Code-Pairing (One-Click-Setup, D7):** Der TV zeigt einen QR-Code; mit der Handy-
  Kamera scannen verbindet direkt über den `/#join=CODE`-Deep-Link — kein Tippen nötig.
  Das QR-Pairing ist die offizielle v1-Form des „One-Click-Setups"; ein kaputter
  Deep-Link-Code verbindet nie automatisch, sondern wird nur ins Eingabefeld übernommen.
- **Fester Raum per Link:** `/r/?code=XXXXXX` öffnet den Receiver direkt in einem bestimmten
  Raum (reload-fest) — praktisch für Lesezeichen und QR-Deep-Links.
- **Browse & Cast (Proxy):** Die „Browse & Cast"-Karte lädt eine Webseite im abgesicherten
  Proxy (CORS-Rewrite, HLS-Umschreibung, Range-Forwarding), erlaubt Medien-Capture und
  castet die gefundene URL — umgeht Browser-Same-Origin-Blockaden.
- **AirPlay für iPhone/iPad:** Die Fire-TV-App emuliert einen AirPlay-2-Empfänger
  (mDNS-Name „StreamCaster TV"), sodass iPhone/iPad nativ spiegeln können.
- **Steuerung:** Pause, Seek (±10 s), Lautstärke, Stop — vom Sender aus **und** mit der
  TV-Fernbedienung (OK = Pause, Zurück = Beenden).
- **PWA:** Der Sender ist als installierbare Progressive Web App ausgelegt (Offline-Shell,
  Manifest, Icons) — kein App-Store nötig.

---

## 4. Wie es technisch funktioniert (Kurzfassung)

- **Signaling-Worker** (Cloudflare Worker + Durable Object `Room`): hält Räume, vermittelt
  WebSocket-Verbindungen (Sender ↔ Receiver) und bietet SSE/POST-Fallbacks für Browser
  ohne WebSockets.
- **Proxy-Worker** (Cloudflare Worker): CORS-Relay, HLS-Manifest-Rewrite, Segment-
  Passthrough und der Intercepting-Proxy (`/browse`, `/p`) für das Browse-&-Cast-Feature.
  SSRF-Guards (nur https, keine privaten Ziele).
- **Sender** (Vite/TS PWA) und **Receiver** (Vite/TS Web-App) teilen ein gemeinsames
  Protokoll-Package (`packages/shared`): Room-Code, CommandOps, Capabilities, WebRTC-
  Signalisierung.
- **Media-Transport:** WebRTC P2P für Dateien/Screen; für abspielbare URLs HLS/H.264 über
  hls.js im Receiver. Kein Medien-Upload in die Cloud.
- **AirPlay-Receiver-APK** (eigenes Android-Projekt): native App mit ExoPlayer/Media3 für
  Video und UxPlay-Kern für AirPlay-2-Spiegelung; meldet sich als Receiver am Signaling an.

---

## 5. Schnellstart

**Empfänger (TV mit Browser):**
1. Browser am TV öffnen → `https://streamcaster.pages.dev/r/`
2. 6-stelligen Code und QR-Code abwarten.

**Sender (Smartphone/PC):**
1. `https://streamcaster.pages.dev` öffnen.
2. QR mit der Kamera scannen (verbindet automatisch) **oder** Code eingeben → Connect.
3. Link einfügen, Datei wählen oder Bildschirm spiegeln → der TV spielt ab.

**iPhone/iPad per AirPlay (Fire TV):**
1. Am Fire TV *Downloader* installieren (Amazon Appstore).
2. In Downloader eingeben: `streamcaster.pages.dev/a.apk` → installieren
   („Apps aus unbekannten Quellen" erlauben).
3. *StreamCaster Receiver* starten → Code erscheint.
4. Am iPhone: Kontrollzentrum → *Bildschirmsynchronisierung* → „StreamCaster TV".

---

## 6. Vom Konzept zum fertigen Produkt (Rückblick)

**Ausgangsidee.** Web-Video und lokale Medien sollen ohne Hardware (Chromecast/Apple TV)
und ohne Account auf jeden Fernseher kommen. Ziel: Sender = beliebiger Browser, Empfänger
= TV-Browser, Verbindung über einen kurzen Code.

**Architektur-Entscheidungen.**
- **Cloudflare Free Tier** als Backend: Workers für Signaling + Proxy, Durable Objects für
  zustandsbehaftete Räume, Pages für die statische Auslieferung von Sender/Receiver/APK.
  Kein eigener Server, kein Datenbank-Setup.
- **WebRTC P2P** für Dateien und Screen-Cast (niedrige Latenz, keine Medien in der Cloud);
  **HLS/H.264** im Receiver für abspielbare URLs.
- **PWA statt nativer Sender-App** — keine App-Store-Pflicht, sofort auf jedem Browser.
- **AirPlay-Receiver-APK** nur dort, wo native Spiegelung (iPhone) gewünscht ist — ein
  Fire-TV-spezifisches Zusatzmodul, sauber vom Web-Stack getrennt.

**Was gebaut wurde.**
- Sender-PWA (Link/Datei/Screen/Kamera, Link-Vorschau-Modal vor jedem Cast,
  Browse-&-Cast, QR-Pairing mit Deep-Link-Härtung, PWA-Shell).
- Receiver-Web-App (QR-Idle-Screen, Player mit TV-Fernbedienung, Reconnect-Logik,
  Status-Chip).
- Signaling-Worker (WebSocket + SSE/POST-Fallback, Room-DO mit Role-Takeover).
- Proxy-Worker (CORS/HLS-Rewrite, Range-Forwarding, Intercepting-Proxy, SSRF-Guards).
- AirPlay-Receiver-APK (ExoPlayer/Media3 + UxPlay-Kern, v1.0.4 mit Fire-OS-5-Support).
- Ein-Klick-Deploy-Pipeline (`pnpm deploy:all`) und eine Anleitungs-Generator-Pipeline
  (vier PDFs: DE/EN × Fire TV / Smart TV).

**Kompatibilitäts-Ziel.** Die APK unterstützt mit `minSdk 22` und v1-Signatur Fire OS 5
bis 8 — also auch ältere Fire-TV-Sticks, die vorher mit „Problem beim Parsen des Pakets"
scheiterten. Die Download-URL `streamcaster.pages.dev/a.apk` liefert die APK als echte
Datei (korrekter MIME-Typ, kein Redirect), damit auch ältere Browser sie nicht als HTML
speichern.

**Verifikation.** End-to-End auf einem Fire TV Stick 4K (AFTMM, Fire OS 6) geprüft:
App installiert (v1.0.4, versionCode 5, minSdk 22), `HubActivity` startet, Raum-Code wird
angezeigt, Video-Cast über ExoPlayer bestätigt. Der Web-Stack ist via `wrangler tail`
stabil (keine Fehler über mehrere Stunden). **iPhone/iPad-AirPlay-Spiegelung** auf den
Fire TV via Receiver-APK verifiziert (Bild + Steuerung) — die native Sender-Brücke
funktioniert. Zusätzlich deckt eine Playwright-E2E-Suite (19 Tests) Pairing inkl.
Deep-Link-Härtung, URL-Cast mit Bestätigungs-Modal (inkl. Abbruch-Pfad), HLS (direkt
und über den Proxy), Browse & Cast, WebRTC-Mirror und Chromecast-Gating ab —
**19/19 grün gegen die Live-Umgebung** (`streamcaster.pages.dev`, Stand 09.11.2026;
jeweils aktueller Prüfstand in [STATUS.md](../STATUS.md)).

**Quellcode & Lizenz.** Web-App: `Johi251/streamcaster` — **öffentlich seit 09.11.2026**,
Lizenz **MIT** (`LICENSE`, Hinweise in `NOTICE.md`). APK: öffentliches Repo
`Johi251/streamcaster-airplay-receiver`, Lizenz **GPL-3.0** (weil der UxPlay-Kern
eingebunden ist; eigene `LICENSE` und `NOTICE.md`). Die Trennung ist bewusst: der
Web-Stack bleibt GPL-frei, damit MIT gültig ist (Details: `CONTRIBUTING.md`,
`docs/RELEASE.md`). Cloudflare-Account und GitHub-CLI sind auf dem Entwickler-Rechner
authentifiziert; Zugänge stehen in `ACCESS.md`, die echten Konto-Metadaten nur lokal
in der gitignorierten `.workbuddy-ai/memory/LOCAL-ACCESS.local.md`.

---

## 7. Dokumentation & Nachweise

Dieses Handbuch ist die **Geräte- und Funktionsreferenz**. Versionen, Deploy-Stände
und Testergebnisse stehen ausschließlich in [STATUS.md](../STATUS.md)
(Single Source of Truth).

| Thema | Dokument |
|---|---|
| Einstieg für KI-Agenten, Arbeitsregeln | [AGENTS.md](../AGENTS.md) |
| Zugänge, Live-URLs, Deploy | [ACCESS.md](../ACCESS.md) |
| Produktentscheidungen D1–D7 | [DECISIONS.md](../DECISIONS.md) |
| Grenzen & Nicht-Ziele | [LIMITATIONS.md](LIMITATIONS.md) |
| Protokoll-Referenz | [PROTOCOL.md](PROTOCOL.md) |
| Proxy-Vertrag & SSRF-Regeln | [PROXY.md](PROXY.md) |
| Release-Checkliste (MIT / GPL-3.0) | [RELEASE.md](RELEASE.md) |
| Senior-Code-Review & Team-Regeln | [TEAM-QUALITY-GUIDE.md](TEAM-QUALITY-GUIDE.md) |
| Security-Review (Cybersecurity) | [SECURITY-REVIEW.md](SECURITY-REVIEW.md) |
| Vergleich mit „TV Cast" (2kit) | [ANALYSE-TVCAST-VERGLEICH.md](ANALYSE-TVCAST-VERGLEICH.md) |
| Monetarisierung — Ausblick | [MONETARISIERUNG-AUSBLICK.md](MONETARISIERUNG-AUSBLICK.md) |
| Lizenz-Optionen / White-Label — Ausblick | [LIZENZ-OPTIONEN-AUSBLICK.md](LIZENZ-OPTIONEN-AUSBLICK.md) |
| Gerüst für Windows/macOS/Linux/iOS/iPadOS/Web | [COPY-PASTE-PROMPT-MULTIPLATFORM.md](../COPY-PASTE-PROMPT-MULTIPLATFORM.md) |

**Zu den Dateiformaten:** `docs/HANDBUCH.md`, `docs/HANDBUCH.html` und
`docs/HANDBUCH StreamCaster.pdf` sind **dasselbe Handbuch in drei Formaten** —
die HTML- und PDF-Dateien sind Exporte, keine eigenständigen Handbücher. Sie
werden aus der Markdown-Quelle erzeugt mit `node docs/guides/build-handbuch.mjs`
und liegen seit 15.11.2026 versioniert im Repository. Die vier Ein-Seiten-PDFs
(`StreamCaster-Quickstart-*.pdf`, `StreamCaster-Ultrakurzanleitung-*.pdf`) sind
dagegen **eigenständige Kurzanleitungen** (`node docs/guides/build.mjs`).

---

## 8. Deployment-Setup (auf andere Projekte übertragbar)

StreamCaster läuft vollständig auf dem **Cloudflare Free Tier**. Es gibt keinen
Server, keine Datenbank-Mietung und kein API-Token im Repository.

| Ebene | Dienst / Config |
|---|---|
| Sender + Receiver | Cloudflare **Pages**, Projekt `streamcaster`, Output `site/dist` |
| Signaling | Cloudflare **Worker** `streamcaster-signaling` + Durable Object `Room` (SQLite, `apps/signaling/wrangler.toml`) |
| Proxy | Cloudflare **Worker** `streamcaster-proxy`, zustandslos (`apps/proxy/wrangler.toml`) |
| APK | Echte Datei `site/dist/a.apk` auf Pages, `/apk` intern nach `/a.apk` rewritten (200, kein Redirect) |
| CI | `.github/workflows/ci.yml`: `pnpm verify` + `pnpm build:site` bei Push/PR — Deploy bewusst manuell |

**Einmalige Einrichtung**

1. Cloudflare-Account anlegen → `pnpm exec wrangler login` (OAuth; Token bleibt maschinenlokal
   in `%APPDATA%/xdg.config/.wrangler/config/default.toml`, nie im Repo).
2. `workers.dev`-Subdomain registrieren — `scripts/ensure-workers-subdomain.mjs` prüft das
   vor dem ersten Worker-Deploy automatisch.
3. Pages-Projekt `streamcaster` anlegen — `deploy.mjs` tut das beim ersten Deploy selbst.

**Build & Deploy**

```bash
pnpm install --frozen-lockfile
pnpm verify          # Typecheck + 72 Unit-Tests + STATUS-Frische-Check
pnpm deploy:all      # 1 Signaling → 2 Proxy → 3 Site-Build → 4 Pages
```

`deploy:all` (`scripts/deploy.mjs`) ist die Reihenfolge kritisch: erst werden die
beiden Worker deployt und ihre `.workers.dev`-URLs aus der Wrangler-Ausgabe
gelesen, dann wird die Site mit `VITE_SIGNALING_URL` / `VITE_PROXY_URL` gebaut
(beide URLs sind im Frontend zur Build-Zeit eingebacken) und danach nach Pages
hochgeladen. Ein reines `pnpm build:site` ohne diese Variablen deaktiviert
Browse-&-Cast („Proxy not configured").

**Page-Output-Contract** (`site/dist`)

- `_redirects`: `/r/* → /r/index.html` (SPA-Fallback), `/apk → /a.apk` (200).
- `_headers`: Security-Header global, CSP für `/r/*`, APK-MIME
  `application/vnd.android.package-archive` + `Content-Disposition: attachment`.
- `a.apk` stammt aus `airplay-receiver/dist/streamcaster-receiver.apk`
  (`scripts/build-site.mjs`); fehlt sie, greift ein GitHub-Release-Fallback.

**Lokal entwickeln / testen**

```bash
pnpm dev:sender      # Sender-PWA
pnpm dev:receiver    # TV-Receiver
pnpm dev:signaling / pnpm dev:proxy
E2E_BASE_URL=https://streamcaster.pages.dev \
E2E_SIGNALING_URL=https://streamcaster-signaling.streamcaster.workers.dev \
E2E_PROXY_URL=https://streamcaster-proxy.streamcaster.workers.dev \
  pnpm exec playwright test -c e2e/playwright.config.ts
```

**Warum das übernehmbar ist:** ein Web-Core, zwei kleine Worker, ein
Status-Gate, ein Deploy-Skript — keine Plattform-SDKs, keine Secrets im Repo,
monatliche Kosten 0 € im Free-Tier.

---

## 9. Plattform-Abdeckung & native Apps

Die **PWA ist das Produkt**. Ein Codebase deckt alle gängigen Plattformen ab;

| Plattform | Verfügbar via | Besonderheit |
|---|---|---|
| Web (Chrome/Edge/Firefox/Safari) | PWA, direkt | vollständiger Funktionsumfang |
| Windows / macOS / Linux | PWA „Installieren" | natives Fenster, Offline-Shell, kein Store |
| iOS / iPadOS | Safari → „Zum Home-Bildschirm" | **kein** `getDisplayMedia` → Screen-Mirroring gesperrt (D2); URL/Datei-Cast + AirPlay-Pfad funktionieren |
| Android | PWA + Fire-TV-APK | PWA installierbar, APK für native AirPlay-Spiegelung |
| Fire TV / Android TV | Silk-Browser **oder** APK | APK = ExoPlayer + UxPlay-Kern (AirPlay 2) |
| Samsung / LG / Philips TV | TV-Browser | kein APK möglich (kein ADB-Sideload) |

**Nicht gebaut:** native `.exe`/`.msi`, `.dmg`/`.app`, `.AppImage`/`.deb`,
App-Store-Apps für iOS/Android, Electron/Tauri/Capacitor-Wrapper. Das ist eine
bewusste Entscheidung: die PWA liefert dieselbe Funktionalität ohne
Signatur-, Notarisation- und Store-Aufwand. Für Projekte, die zwingend
Store-Binaries brauchen, ist das Gerüst in
[COPY-PASTE-PROMPT-MULTIPLATFORM.md](../COPY-PASTE-PROMPT-MULTIPLATFORM.md)
beschrieben (Tauri/Capacitor als dünne Schalen um denselben Web-Core) — es ist
eine **Empfehlung für neue Projekte**, kein Bestandteil dieses Repositories.

Grenzen im Detail: [LIMITATIONS.md](LIMITATIONS.md), Entscheidungen:
[DECISIONS.md](../DECISIONS.md).

---

## 10. Detaillierte Komponenten-Referenz (Funktionen & Aufgaben)

### 10.1 Sender: StreamCaster (PWA)

**Rolle:** Initiator & Controller — steuert was auf dem Empfänger gespielt wird.

| Aufgabe | Implementierung |
|---------|----------------|
| **Room-Management** | Generiert/validiert 6-stellige Codes. Verbindet via WS/SSE zum Signaling Worker. Zeigt QR-Code für One-Click-Pairing (`/#join=CODE`). |
| **URL-Cast** | Nutzt `extractFromPage(url)` → lädt Seite über `/browse` Proxy → Heuristiken finden `.m3u8`, `<video>`, `<source>`, `og:video` → zeigt Kandidaten im Link-Preview Modal → User bestätigt → sendet `load` Command über Signaling. |
| **File-Cast** | Drag&Drop / File Input → `URL.createObjectURL(blob)` → sendet `load` mit Blob-URL. Unterstützt: MP4, WebM, MP3, M4A, HLS (via Proxy). |
| **Screen Mirroring** | `navigator.mediaDevices.getDisplayMedia()` → `SenderPeer` (WebRTC) → Offer/ICE über Signaling → P2P Stream zum Receiver. |
| **Camera Mirroring** | `getUserMedia({video: {facingMode: "environment"}})` → gleicher WebRTC Pfad. |
| **Chromecast** | Native `cast.framework` SDK → Receiver Discovery im LAN → Session Request → Media Load. |
| **AirPlay Download Hub** | Karte in UI → direkter Download `https://streamcaster.pages.dev/a.apk` + Sideloading-Anleitung für Fire TV (Downloader App). |
| **Sicherheit** | Link-Preview Modal zeigt Domain + volle URL vor jedem Cast. Blockiert `javascript:`/`data:`/`file:` Protokolle. SSRF-Guard für Extraction URLs. |
| **PWA / Offline** | `manifest.webmanifest` + `sw.js` (Offline Shell: Navigation + Assets cached). Installierbar auf Android/iOS/Desktop. |
| **State Machine** | `idle` → `connecting` → `connected` → `casting/playing` → `error/reconnecting`. Persistiert Room-Code in `localStorage`. |

**Kern-Dateien:**
```
apps/sender/src/main.ts           # Entry, State Machine, Signaling Client, Cast Orchestrierung
apps/sender/src/transport/
  remote.ts       → RemoteTransport (Commands über Signaling WS)
  webrtc.ts       → SenderPeer (WebRTC P2P für Mirror)
  cast.ts         → Chromecast Integration
  file.ts         → File-Cast Blob URL Handling
apps/sender/src/extract/
  detect.ts       → Media Detection (m3u8, video, source, og:video)
  heuristics.ts   → Scoring & Ranking der Kandidaten
  probe.ts        → HEAD/Range Requests für MIME/Size
  useExtract.ts   → React Hook für Browse-&-Cast Flow
apps/sender/src/ui/linkPreview.ts # Link-Preview Modal (Security Gate)
```

---

### 10.2 Receiver: StreamCaster Receiver (PWA)

**Rolle:** Player & Anzeige — empfängt Commands, spielt Media, zeigt Status.

| Aufgabe | Implementierung |
|---------|----------------|
| **Room-Code Anzeige** | Generiert eigenen Code bei Start. URL `/?code=XXXXXX` macht Reload-fest. QR-Code für Deep-Link Pairing. |
| **Media Playback** | `ReceiverPlayer` Factory wählt: `HlsPlayer` (m3u8, ABR), `MpxPlayer` (mp4/webm/mp3 native), `WebRtcPlayer` (Mirror Stream via `srcObject`). |
| **HLS.js Player** | Adaptive Bitrate nativ. Muted-Autoplay-Fallback für TV-Browser ohne User-Gesture (Silk, Tizen, webOS). |
| **WebRTC Peer** | `ReceiverPeer` → `setRemoteDescription(offer)` → `createAnswer()` → ICE Candidates → `ontrack` → `video.srcObject = stream`. |
| **Command Handling** | `load`, `play`, `pause`, `seek`, `volume`, `stop`, `subtitle`, `stream-start/stop` via Signaling. Validiert Commands vor Ausführung. |
| **State Sync** | Sendet `state` Updates (position, duration, paused, currentUrl, title) an Sender alle 500ms + on change. |
| **Touch/Remote Controls** | On-Screen Buttons: Play/Pause, Seek ±10s, Volume, Fullscreen, Close. Tastatur: Space=Play/Pause, ←/→=Seek, ↑/↓=Volume. TV-Fernbedienung: OK=Pause, Zurück=Beenden. |
| **PWA Offline** | Service Worker cached Shell + Assets. Funktioniert nach erstem Laden ohne Netzwerk. |
| **Reconnect Logic** | Exponential Backoff (1s, 2s, 4s... max 30s) bei WS/SSE Verlust. Zeigt "Reconnecting..." Toast. |

**Kern-Dateien:**
```
apps/receiver/src/main.ts           # Entry, State Machine, Signaling Client
apps/receiver/src/player/player.ts  # ReceiverPlayer Factory + 3 Implementierungen
apps/receiver/src/webrtc/receive.ts # ReceiverPeer (WebRTC Answer + ICE)
apps/receiver/src/signaling.ts      # ReceiverClient (WS/SSE, Reconnect, Message Handling)
```

---

### 10.3 Signaling Worker: streamcaster-signaling.streamcaster.workers.dev

**Rolle:** Koordinator & Message Router — hält Räume, vermittelt Verbindungen.

| Aufgabe | Implementierung |
|---------|----------------|
| **Room Durable Object** | Pro Room-Code eine DO-Instanz (`Room`). State im Memory (Peers, Messages, State). TTL: 2h Inaktivität → Auto-Delete. |
| **WebSocket Endpoint** | `GET /ws?code=CODE&role=sender\|receiver` → Upgrade → bidirektional. Heartbeat Ping/Pong 30s. |
| **SSE Fallback** | `GET /sse?code=CODE&role=ROLE` für Browser ohne WS (alte TV-Browser). Server-Sent Events. |
| **POST Fallback** | `POST /send?code=CODE` für Commands ohne WS/SSE. Body: JSON CommandOp. |
| **State Query** | `GET /state?code=CODE` → aktueller Playback-State (für Debug/External). |
| **Message Routing** | Alle Messages < 128 Bytes. Typen: `join`, `webrtc`, `cmd`, `state`, `ping`, `leave`. Broadcast an alle Peers im Room außer Sender. |
| **Peer Presence** | `joined` Response enthält `peerPresent: boolean` — einzige verlässliche Info ob Gegenrolle da ist. `peers` zählt sich selbst mit. |
| **Capabilities Exchange** | Sender sendet `caps` bei Join (Resolution, Codec, Bitrate, Mirror-Support). Receiver nutzt für Quality-Negotiation. |
| **Security** | Max Message Size 64 KB. Room-Code Validierung (Alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ`). Role-Normalisierung (invalid → receiver). POST-only `/send` mit Body-Cap (64 KB). |

**Protokoll (Kurz):**
```json
// Client → Server
{"t":"join","role":"sender","code":"ABC123","peerId":"...","caps":{...}}
{"t":"webrtc","kind":"offer|ice","payload":{...}}
{"t":"cmd","op":{"name":"load","url":"...","title":"...","mime":"..."}}
{"t":"state","state":{"paused":false,"position":12.5,"duration":120}}
{"t":"ping","ts":1234567890}
{"t":"leave"}

// Server → Client
{"t":"joined","code":"ABC123","role":"sender","peerPresent":true,"peers":2,"state":{},"peerCaps":{...}}
{"t":"peer-joined","role":"receiver","caps":{...}}
{"t":"peer-left","role":"receiver"}
{"t":"webrtc","kind":"answer|ice","payload":{...}}
{"t":"cmd","op":{...}}
{"t":"state","state":{...}}
{"t":"pong","ts":1234567890}
{"t":"error","message":"...","code":"..."}
```

**Kern-Dateien:**
```
apps/signaling/src/index.ts          # Worker Entry, Routing (WS/SSE/POST/GET)
apps/signaling/src/room.ts           # Room Durable Object (State, Peers, Broadcast, TTL)
apps/signaling/src/protocol.ts       # Message Validation (parseClientMessage, parseServerMessage)
```

---

### 10.4 Proxy Worker: streamcaster-proxy.streamcaster.workers.dev

**Rolle:** CORS-Relay, HLS-Rewrite, Intercepting Proxy — macht fremde Media im Browser spielbar.

| Endpoint | Aufgabe | Details |
|----------|---------|---------|
| `GET /health` | Health Check | `{ok: true}` |
| `GET /fetch?url=URL` | CORS Relay HTML/JSON | 2 MB Cap. Stript `set-cookie`, `www-authenticate`, `authorization`, `content-length`. Erlaubt nur `text/*`, `application/json`. |
| `GET /hls?url=URL` | HLS Manifest Rewrite | Lädt `.m3u8`, schreibt **alle** URIs um (Segments, Keys, Variants) → `/seg?url=` oder `/hls?url=`. Behält Query-Parameter. |
| `GET /seg?url=URL` | Segment Pass-Through | Streamed Response mit Range-Forwarding (206 Support). Content-Type Passthrough. |
| `GET /browse?url=URL` | Intercepting Proxy | Lädt HTML, injiziert `BROWSE_INJECT` Script (Media Capture + PostMessage), rewrited **alle** Links/Forms/Iframes zu weiteren `/browse?url=` Hops. Stript `X-Frame-Options`, CSP `frame-ancestors`. |
| `GET /p?url=URL` | Permissiver Passthrough | Für gecapturte Media-URLs. Range + CORS. Weniger strikt als `/fetch`. |

**SSRF Guards (Sicherheit):**
| Guard | Regel |
|-------|-------|
| Protocol | Nur `https:` erlaubt |
| Host | Block: `localhost`, `127.0.0.1`, `::1`, `*.local`, `*.localhost`, `*.localdomain` |
| Private IPs | Block: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `fc00::/7` |
| Ports | Block: 22, 23, 25, 53, 110, 139, 143, 445, 3306, 5432, 6379, 8080, 8443, 9000+ |
| Redirects | Max 3 Hops, jedes Ziel wird erneut geprüft |
| Content-Type | Pro Endpoint strikt definiert |

**Byte-Limiter:** `streamBodyWithLimit(response, maxBytes = 50 MB)` für Segments.

**Kern-Dateien:**
```
apps/proxy/src/index.ts          # Worker Entry, Routing
apps/proxy/src/guard.ts          # SSRF Guards (isSafeHost, validateUrl, parseUrl)
apps/proxy/src/limit.ts          # Streaming Byte Cap Helpers
apps/proxy/src/rewrite.ts        # HLS Manifest Rewrite + Browse HTML Inject
  rewriteManifest()              # Alle URIs in m3u8 umschreiben
  BROWSE_INJECT                  # Media Capture Script für /browse
```

---

### 10.5 APK: StreamCaster Receiver (Native Android / Fire TV)

**Rolle:** Native Empfänger für Fire TV — Video Cast + AirPlay Spiegelung.

**Download:** https://streamcaster.pages.dev/a.apk (direkte Datei, **kein Redirect**)  
**Kurzform:** https://streamcaster.pages.dev/apk (Rewrite → `/a.apk`)

| Aufgabe | Implementierung |
|---------|----------------|
| **Video Cast** | Empfängt `load` Command via Signaling WS → `StreamCasterPlayer` (ExoPlayer/Media3) spielt MP4, HLS, DASH. HW-Decoding (`HW.video.avc`, `HW.video.hevc`). Eigene Controller-UI (OK=Pause, ±10s, Zurück=Beenden). |
| **AirPlay Spiegelung** | UxPlay Kern (RAOP + AirPlay 2). mDNS: `_airplay._tcp` + `_raop._tcp` als **"StreamCaster TV"**. iPhone/iPad finden Gerät nativ in AirPlay-Menü. Port 7000. |
| **Signaling Client** | WebSocket zu `streamcaster-signaling.streamcaster.workers.dev`. Generiert eigenen Room-Code. Reconnect mit Backoff. Capabilities: `mirror=false`, `screenCast=false` (nur Video). |
| **Fire OS 5+ Support** | `minSdk 22` (Android 5.1). ABIs: `arm64-v8a` + `armeabi-v7a`. v1+v2+v3 Signatur (v1 zwingend für Android ≤6). Media3 1.8.0 (1.9+ fordert minSdk 23). Keine Compose Widgets (eigene Controls auf `Player`). |
| **ADB Debugging** | `adb connect IP:5555` → Logs, Install, Launch. Bei `offline`: ADB am Stick AUS/EIN togglen. |

**Build & Release:**
| Schritt | Befehl / Ort |
|---------|-------------|
| CI Build | `.github/workflows/android.yml` (Ubuntu, unsigniert) |
| Lokale Signatur | `scripts/sign-apk.mjs <unsigned.apk> <signed.apk>` mit Keystore `airplay-receiver/.secrets/streamcaster-release.jks` |
| Keystore Config | `airplay-receiver/.secrets/signing.properties` (gitignored) |
| Release | `gh release create vX.Y.Z <apk> --repo Johi251/streamcaster-airplay-receiver` |
| Pages Sync | Signierte APK → `airplay-receiver/dist/streamcaster-receiver.apk` → `pnpm deploy:all` kopiert nach `site/dist/a.apk` |

**Verifizierte Hardware:**
| Gerät | Fire OS | Arch | Status |
|-------|---------|------|--------|
| Fire TV Stick 4K (AFTMM) | 6.7.1.1 | armeabi-v7a | ✅ Video Cast + AirPlay |
| Fire TV Stick 1. Gen / Lite | 5.x | armeabi-v7a | ✅ (v1.0.4 minSdk 22) |
| Fire TV Cube | 6/7/8 | arm64 | ✅ |

**Kern-Dateien (airplay-receiver Repo):**
```
airplay-receiver/app/src/main/java/com/streamcaster/receiver/
  HubActivity.kt          # Room Code, Status, QR
  PlayerActivity.kt       # ExoPlayer + Custom Controller
  signaling/SignalingClient.kt  # WS Client + Reconnect
  airplay/AirPlayService.kt     # UxPlay Wrapper (Port 7000)
  player/StreamCasterPlayer.kt  # ExoPlayer Wrapper
```
