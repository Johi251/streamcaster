# Eigenständiges Projekt: StreamCaster AirPlay Receiver (Fire TV Stick APK)

## Kontext

Du baust einen eigenständigen AirPlay-Receiver als Android-APK, der auf
einem Amazon Fire TV Stick per Sideloading läuft. Er ergänzt die bestehende
Webapp **StreamCaster** (live auf https://streamcaster.pages.dev), die
URL-Casting, HLS-Proxy, WebRTC-Screen-Mirror und Media-Extraction bietet.

**Problem, das gelöst wird:** iPhone-Bildschirm-Spiegelung auf Fire TV.
StreamCaster ist eine Webapp und kann AirPlay nicht empfangen (Browser können
kein mDNS/Bonjour). iOS-Geräte können ihren Bildschirm nur über AirPlay
spiegeln. Eine native Android-App auf dem Fire TV schließt diese Lücke.

**Ziel:** Kostenlose, unbegrenzte AirPlay-Receiver-App, kein Abo, kein
Zeitlimit. Alternative zu AirScreen (zeitbegrenzt) und AirReceiver (2,99 $).

**Empfohlenes KI-Modell für diesen Build:** Claude 3.5 Sonnet in Claude Code
(CLI) oder Cursor (IDE). Grund: überlegen in Kotlin/NDK-Integration und
großem Codebase-Kontext. Kostenlos Alternative: Gemini 2.5 Pro in AI Studio.

**Arbeitsordner (lokal):** `C:\Users\johan\MASTER_SETUP\00 PROJEKTE\StreamCaster`
ist der gemeinsame Projektordner. Die Webapp liegt direkt dort (pnpm-Monorepo).
Dieses APK-Projekt wird als Unterordner `airplay-receiver\` angelegt:

```
C:\Users\johan\MASTER_SETUP\00 PROJEKTE\StreamCaster\
  ├─ apps/ packages/ scripts/ site/   ← StreamCaster Webapp (pnpm-Monorepo)
  ├─ research/airplay-receiver-apk-prompt.md  ← dieser Prompt
  ├─ ACCESS.md                        ← zentrale Integrations-Referenz
  └─ airplay-receiver/                 ← NEU: dieses Android-Projekt hier anlegen
```

Die `airplay-receiver\`-Umgebung ist eigenständig (eigene Gradle-Build,
eigenes Git-Repo optional). Sie verbindet sich mit der Webapp nur über die
Signaling-Worker-URL aus ACCESS.md — keine Datei-Abhängigkeit zur Webapp.

## Wichtig: StreamCaster ist der zentrale Hub

**https://streamcaster.pages.dev ist die einzige Adresse, die der Nutzer
kennt.** Die Webapp ist der zentrale Einstiegspunkt für alle Fähigkeiten.
Sie ist eine **PWA (Progressive Web App)** — auf iPhone und Android kann
man sie direkt vom Browser aus als App installieren („Zum Home-Bildschirm
hinzufügen" / „Add to Home Screen"). Die installierte PWA startet im
Fullscreen-Modus ohne Browser-Adressleiste, mit eigenem Icon und Splash-Screen.

### Fähigkeiten-Hub (Startseite der Webapp)

Die Startseite listet alle Fähigkeiten als Karten. Jede Karte führt zur
Funktion oder zum Download. Kurz, knackig, visuell (Icons + Nummern):

**Karte 1: URL streamen**
- Direkt in der Webapp
- URL eingeben → Room-Code vom TV ablesen → Receiver spielt ab
- Funktioniert auf jedem Gerät mit Browser
- Sender: `streamcaster.pages.dev` / Receiver: `streamcaster.pages.dev/r/`

**Karte 2: Bildschirm teilen**
- Direkt in der Webapp
- Überträgt deinen Bildschirm als Live-Video an den Receiver
- Modi: ganzer Bildschirm / Anwendungsfenster / Browser-Tab (Chrome bietet alle drei)
- **Erfordert Chrome oder Edge** (Chromium-basiert; getDisplayMedia)
- Funktioniert nicht in Safari, Firefox mobile, Samsung Internet
- Sender: StreamCaster öffnen → „Bildschirm teilen" → Stream geht über WebRTC
- Receiver: `streamcaster.pages.dev/r/` im TV-Browser

**Karte 3: Kamera streamen**
- Direkt in der Webapp
- Überträgt die Kamera als Live-Stream
- Funktioniert auf jedem Gerät mit Kamera (getUserMedia)

**Karte 4: Streaming-Seiten (AniWorld etc.)**
- Direkt in der Webapp
- Intercepting-Proxy: Seite wird durch StreamCaster geladen
- Play-Button drücken → echte Media-URL wird abgefangen → an Receiver gesendet
- VPN-Schutz durch Cloudflare (Zielseite sieht Cloudflare-IP, nicht deine)

**Karte 5: An Chromecast senden**
- Direkt in der Webapp (nur Chrome/Edge)
- Sendet eine Media-URL (mp4/HLS) an einen echten Chromecast-Stick
- Der Chromecast holt das Video selbst vom Internet — Handy/PC ist nur Fernbedienung
- Unterschied zu „Bildschirm teilen": hier wird eine URL abgespielt, nicht dein
  Bildschirm live übertragen
- Cast-Button erscheint automatisch, wenn ein Chromecast im Netz erkannt wird

**Karte 6: iPhone-Display spiegeln**
- **Erfordert zusätzliche Receiver-App (dieses Projekt)**
- Flow:
  1. Fire TV: Receiver-APK starten (zeigt Room-Code + AirPlay aktiv)
  2. iPhone: Control Center → Screen Mirroring → Fire TV auswählen
  3. iPhone-Bildschirm erscheint auf dem TV
- iPhone braucht keine App — AirPlay ist in iOS eingebaut
- Die Receiver-App auf dem Fire TV ist das, was das iPhone findet
- **Download-Button in dieser Karte:** „Receiver-App herunterladen (Fire TV Stick)"
  → führt zum APK-Download (GitHub Releases)
- **Sideloading-Anleitung (direkt in der Webapp, visuell):**
  ```
  ① Fire TV → „Find" → „Search" → „Downloader" installieren (Amazon Appstore, gratis)
  ② Downloader öffnen → APK-URL eingeben (Link aus der Webapp kopieren)
  ③ „Apps aus unbekannten Quellen" erlauben → APK installieren
  ④ App starten → Room-Code erscheint → iPhone über AirPlay verbinden
  ```

### Download-Integration der APK in die Webapp

Die StreamCaster-Webapp (die separat gepflegt wird) hat einen festen Platz
für den APK-Download-Link. Die APK-Release-URL wird dort eingetragen:

- Konstante `AIRPLAY_RECEIVER_APK_URL` in der Webapp (z.B.
  `https://github.com/<user>/streamcaster-airplay-receiver/releases/latest/download/streamcaster-receiver.apk`)
- Die „iPhone-Display spiegeln"-Karte rendert einen Download-Button mit
  dieser URL + die Sideloading-Anleitung oben
- **Du lieferst die Release-URL → sie wird in die Webapp eingetragen → deployt**

## StreamCaster — was bereits existiert

StreamCaster ist eine pnpm-Monorepo-Webapp auf Cloudflare Free-Tier:

- **Sender** (https://streamcaster.pages.dev): URL-Cast, HLS-Playback,
  WebRTC-Screen/Camera-Mirror, Media-Extraction, Chromecast-Web-Sender-SDK
  — ist eine **PWA**: Manifest + Service Worker, installierbar auf
  iPhone/Android Homescreen
- **Receiver** (https://streamcaster.pages.dev/r/): Browser-basiert, empfängt
  Commands und WebRTC-Streams über WebSocket-Signaling — auto-generiert
  Room-Code beim Öffnen ohne URL-Code
- **Signaling-Worker**: Cloudflare Worker + SQLite-Durable-Object pro Raum,
  WebSocket primär, SSE+POST-Fallback für TV-Browser
- **Proxy-Worker**: /fetch (CORS-Relay), /hls (m3u8-Rewrite), /seg (Range-
  Pass-through), SSRF-Guards
- **Protokoll**: Room-Codes (6 Zeichen, kein 0/O/1/I/L), CommandOps (load,
  play, pause, seek, volume, stop, subtitle, file-meta, stream-start/stop),
  Playback-State-Sync

**Architektur-Details (für Integration):**
- Signaling: WS unter `wss://streamcaster-signaling.streamcaster.workers.dev/ws?code=<CODE>&role=receiver`
- SSE-Fallback: `.../sse?code=<CODE>&role=receiver`
- POST-Fallback: `POST .../send?code=<CODE>` mit `{t:"join",role:"receiver"}`
- State-Query: `GET .../state?code=<CODE>`
- CommandOps: `{t:"cmd", op:{name:"load", url:"...", title:"...", mime:"..."}}`
- WebRTC-Signalierung: `{t:"webrtc", kind:"answer"|"ice", payload:...}`
- Room-Code-Alphabet: `23456789ABCDEFGHJKMNPQRSTUVWXYZ`

## Anforderungen an das APK

### Kernfunktionen

1. **AirPlay-Receiver (Bildschirm-Spiegelung)**
   - Empfängt AirPlay-Mirroring von iPhone/iPad/Mac
   - mDNS/Bonjour-Advertising im lokalen Netz (`_airplay._tcp`, `_raop._tcp`)
   - AirPlay-Video und AirPlay-Audio (RAOP)
   - Full-HD-Playback, Audio-Sync
   - Optional: AirPlay-Passcode-Eingabe am TV

2. **Google Cast-Receiver (optional, wenn einfach)**
   - Empfängt Cast von Chrome/Android
   - Registriert sich als Cast-Gerät im Netz

3. **StreamCaster-Receiver-Integration**
   - Verbindet sich beim Start mit dem StreamCaster-Signaling-Server
   - Generiert einen 6-stelligen Room-Code, zeigt ihn groß an
   - Empfängt CommandOps und spielt Media ab (mp4 direkt, HLS via ExoPlayer,
     WebRTC-Stream via ExoPlayer)
   - State-Sync an den Sender (play/pause/position/duration)
   - **Branding:** StreamCaster-Logo, Glassmorphism-Optik wie die Webapp

4. **UI**
   - Idle-Screen: StreamCaster-Logo, Room-Code groß, Status-Text
   - Fullscreen-Video-Playback
   - Fernbedienungs-tauglich (D-Pad-Navigation)
   - Modern: Glassmorphism, runde Ecken, klare Typografie, dezente Animationen
   - Wenn AirPlay aktiv: Fullscreen-Mirror, kein UI-Chrome

### Technische Basis

- **Sprache:** Kotlin (empfohlen) oder Java
- **Min-SDK:** Fire OS 7 (Android 9 / API 28) — Fire TV Stick 4K und neuer
- **Target-SDK:** API 33+ (Fire OS Kompatibilität)
- **Build:** Gradle, APK-Output
- **Package-Name:** `com.streamcaster.receiver`

### Empfohlene Open-Source-Libraries

**AirPlay-Receiver (schwerer Teil — bestehende Implementierungen nutzen):**

1. **UxPlay** (https://github.com/antimof/UxPlay) — C, AirPlay-Mirroring +
   Audio, aktiv gepflegt, als NDK-Library einbindbar
2. **RPiPlay** (https://github.com/FD-/RPiPlay) — C-basiert, ähnlich
3. **raop-receiver** (https://github.com/ultrascripts/raop-receiver) — Rust

**Android-spezifisch:**

4. **ExoPlayer** (Media3) — Video-Playback, HLS, WebRTC-Source
5. **NsdManager** — mDNS-Service-Discovery (Android-API)
6. **OkHttp** — WebSocket-Client für StreamCaster-Signaling

**AirPlay auf Android — konkretester Pfad:**
UxPlay als NDK-Library, in Kotlin-App einbinden. AirPlay-Server macht
mDNS-Advertising, Video-Stream an ExoPlayer/Surface-View weiterreichen.

### Integration in StreamCaster

```
[Fire TV APK]
  ├─ AirPlay-Server (mDNS, RAOP, Mirroring) ← iPhone verbindet sich direkt
  ├─ StreamCaster-Client (WS zum Signaling-Worker)
  │    ├─ generiert Room-Code
  │    ├─ empfängt CommandOps → ExoPlayer
  │    └─ empfängt WebRTC-Stream → ExoPlayer/WebView
  └─ UI (Room-Code, Video-Playback, Status)
```

**Signaling-Verbindung (Kotlin):**
```kotlin
val wsUrl = "wss://streamcaster-signaling.streamcaster.workers.dev/ws?code=$code&role=receiver"
val client = OkHttpClient.Builder()
    .pingInterval(30, TimeUnit.SECONDS)
    .build()
val request = Request.Builder().url(wsUrl).build()
client.newWebSocket(request, object : WebSocketListener() {
    override fun onMessage(webSocket: WebSocket, text: String) {
        val msg = JSONObject(text)
        when (msg.getString("t")) {
            "joined" -> showStatus("Waiting for sender…")
            "peer-joined" -> showStatus("Sender connected")
            "cmd" -> executeCommand(msg.getJSONObject("op"))
            "webrtc" -> handleWebRTC(msg.getString("kind"), msg.get("payload"))
            "state" -> {}
            "error" -> toast(msg.getString("message"))
        }
    }
})
```

**Room-Code-Generierung:**
```kotlin
val ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
fun generateRoomCode(length: Int = 6): String {
    val bytes = ByteArray(length)
    SecureRandom().nextBytes(bytes)
    return bytes.map { ALPHABET[(it.toInt() and 0xFF) % ALPHABET.length] }.joinToString("")
}
```

### Sideloading auf Fire TV

```
① Fire TV → „Find" → „Search" → „Downloader" (Amazon Appstore, gratis)
② Downloader öffnen → APK-URL eingeben (Link aus StreamCaster-Webapp)
③ „Apps aus unbekannten Quellen" erlauben → APK installieren
④ App starten → Room-Code → iPhone: Control Center → Screen Mirroring → Fire TV
```

Diese Anleitung wird auch direkt in der StreamCaster-Webapp angezeigt.

### Bonus (falls Zeit bleibt)

- **DLNA/UPnP-Receiver:** zusätzlich als DLNA-Renderer (UPnP/AVTransport).
  Library: Cling (https://github.com/4th-line/cling)
- **Auto-Start:** startet beim Fire-TV-Boot (BOOT_COMPLETED-Receiver)
- **Wakeup:** Wake-on-LAN bei Standby

### Constraints

- **Kostenlos:** keine Paid-Libraries, keine Paid-APIs
- **Offline-fähig für AirPlay:** lokal im WLAN, kein Cloud-Dienst
- **Fire-TV-optimiert:** D-Pad-Navigation, kein Touch-UI
- **APK-Größe:** unter 50 MB ideal
- **Lizenzen:** GPL-kompatibel (UxPlay = GPL → Open-Source) oder
  LGPL/BSD-Alternative
- **Branding:** StreamCaster-Optik, StreamCaster-Logo, gleiche Farbwelt

## Was du tun sollst

1. Android-Studio-Projekt aufsetzen (Kotlin + Gradle)
2. AirPlay-Server als NDK-Library einbinden (UxPlay-Port)
3. StreamCaster-Signaling-Client implementieren (WS, Room-Code, CommandOps)
4. ExoPlayer für Media-Playback
5. UI: Idle-Screen mit Room-Code, Fullscreen-Video, StreamCaster-Branding
6. APK bauen, auf GitHub Releases veröffentlichen (stabile URL)
7. README mit Sideloading-Anleitung
8. Release-URL melden → wird in StreamCaster-Webapp als Download eingetragen

## Referenzen

- **Lokaler Arbeitsordner:** `C:\Users\johan\MASTER_SETUP\00 PROJEKTE\StreamCaster`
- **Webapp-Repo (im Arbeitsordner):** `apps/`, `packages/`, `scripts/`, `site/`
- **Dieser Prompt:** `research/airplay-receiver-apk-prompt.md`
- **Integrations-Referenz:** `ACCESS.md` (alle URLs, Endpunkte, Protokoll-Spec)
- **APK-Projekt anlegen unter:** `airplay-receiver/` (Schwesterordner der Webapp)
- StreamCaster Hub: https://streamcaster.pages.dev
- StreamCaster Receiver (Browser): https://streamcaster.pages.dev/r/
- Signaling-Worker: https://streamcaster-signaling.streamcaster.workers.dev
- Proxy-Worker: https://streamcaster-proxy.streamcaster.workers.dev
- UxPlay: https://github.com/antimof/UxPlay
- RPiPlay: https://github.com/FD-/RPiPlay
- ExoPlayer/Media3: https://developer.android.com/media/media3
- Cling (DLNA): https://github.com/4th-line/cling
- Fire TV Sideloading: Downloader-App aus Amazon Appstore
