# StreamCaster — Handbuch & Projektrückblick

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
- **Datei senden:** Lokale Video-/Audio-/Bilddatei vom Sender zum TV übertragen.
- **Bildschirm- & Kamera-Spiegeln:** Der Sender streamt seinen Screen oder die Webcam
  via WebRTC zum TV.
- **QR-Code-Pairing:** Der TV zeigt einen QR-Code; mit der Handy-Kamera scannen verbindet
  direkt — kein Tippen des Codes nötig.
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
- Sender-PWA (Link/Datei/Screen/Kamera, Browse-&-Cast, QR-Pairing, PWA-Shell).
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
stabil (keine Fehler über mehrere Stunden).

**Quellcode & Zugang.** Web-App: privates Repo `Johi251/streamcaster`. APK: öffentliches
Repo `Johi251/streamcaster-airplay-receiver`. Cloudflare-Account und GitHub-CLI sind auf
dem Entwickler-Rechner authentifiziert; alle Zugänge sind in `ACCESS.md` dokumentiert.
