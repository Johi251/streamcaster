# StreamCaster Receiver — AirPlay für Fire TV

Android-TV-App, die einen Amazon Fire TV Stick in einen **AirPlay-2-Empfänger**
verwandelt und gleichzeitig als **StreamCaster-Receiver** arbeitet.

- iPhone/iPad/Mac → Kontrollzentrum → Bildschirmspiegelung → **StreamCaster TV**
- StreamCaster-Webapp → Raum-Code eingeben → URL/Datei auf dem TV abspielen
- Kostenlos, kein Abo, kein Zeitlimit, keine Cloud im AirPlay-Pfad

Die App baut auf dem bewährten Open-Source-AirPlay-Kern
[jqssun/android-airplay-server](https://github.com/jqssun/android-airplay-server)
(UxPlay + JNI, GPL-3.0) auf und ergänzt ihn um die StreamCaster-Oberfläche,
den Raum-Code und die Signaling-Anbindung.

## Download

**APK (Fire TV Stick, arm64):**
`https://github.com/Johi251/streamcaster-airplay-receiver/releases/latest/download/streamcaster-receiver.apk`

> Stand dieses Builds: siehe [Releases](https://github.com/Johi251/streamcaster-airplay-receiver/releases).
> Das APK ist mit einem lokalen Release-Key signiert (nicht im Repo).

## Installation auf dem Fire TV Stick (Sideloading)

```
① Fire TV → „Suchen“ → „Downloader“ installieren (Amazon Appstore, gratis)
② Downloader öffnen → APK-URL eingeben:
   https://github.com/Johi251/streamcaster-airplay-receiver/releases/latest/download/streamcaster-receiver.apk
③ „Apps aus unbekannten Quellen“ für Downloader erlauben → APK installieren
④ „StreamCaster Receiver“ starten → Raum-Code erscheint
```

Danach:

1. iPhone/iPad im **selben WLAN** wie der Fire TV.
2. Kontrollzentrum öffnen → **Bildschirmspiegelung** → **StreamCaster TV**.
3. Der TV schaltet automatisch auf Vollbild.

Für URL-Casting: auf [streamcaster.pages.dev](https://streamcaster.pages.dev)
den Raum-Code vom TV eingeben und eine Medien-URL senden.

## Funktionen

- **AirPlay-Spiegelung** (H.264/H.265) über den UxPlay-Kern, inkl. Audio
- **AirPlay-Audio** (RAOP/AAC/ALAC) mit Metadaten und Fernbedienung
- **mDNS/Bonjour**: `_airplay._tcp` und `_raop._tcp`
- **StreamCaster-Hub**: großer Raum-Code, Status für Signaling und AirPlay
- **URL-Casting** über den StreamCaster-Signaling-Worker (WebSocket)
- **ExoPlayer/Media3**: MP4, HLS, Untertitel (VTT), Lautstärke, Seek
- **State-Sync** an den Sender (Position, Dauer, Pause, Titel, Volume)
- **D-Pad-Bedienung**: OK = Play/Pause, ◀ ▶ = 10 s, Zurück = beenden
- **Deutschsprachige UI**, StreamCaster-Glassmorphism-Optik
- **Auto-Start** der AirPlay-Erkennung beim Öffnen des Hubs

## Grenzen (v1.0.0)

- **WebRTC-Screen/Camera-Mirroring** aus der Webapp wird nicht dekodiert.
  Für iPhone-Spiegelung ist AirPlay der vorgesehene Weg; der Sender zeigt
  einen Hinweis, wenn er WebRTC startet.
- **Kein Chromecast-Receiver** und **kein DLNA-Renderer** in dieser Version.
- **DRM-Inhalte** (Netflix, Apple TV App …) gehen bei AirPlay nicht.
- Nur **arm64-v8a** (Fire TV Stick 4K und neuer). Ältere 32-Bit-Sticks
  werden nicht unterstützt.
- Auf einem echten Fire TV Stick wurde dieser Build noch nicht verifiziert;
  die AirPlay-Basis ist die öffentlich getestete Upstream-App.

## Selbst bauen

Voraussetzungen:

- JDK 21
- Android SDK mit `platforms;android-37.0`, `build-tools;37.0.0`
- NDK `27.0.12077973`
- CMake `3.22.1`
- **Build-Pfad ohne Leerzeichen** (FFmpegs `configure` lehnt Leerzeichen im
  Quellpfad ab; auf Windows z. B. unter `%TEMP%\scbuild` bauen)

```bash
git clone --recursive https://github.com/Johi251/streamcaster-airplay-receiver.git
cd streamcaster-airplay-receiver

# SDK-Pfad eintragen
echo "sdk.dir=/pfad/zum/android-sdk" > local.properties

./gradlew :app:assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

Der Release-Build liest die Signatur aus `local.properties`:

```properties
storeFile=.secrets/streamcaster-release.jks
storePassword=…
keyAlias=streamcaster
keyPassword=…
```

Der Keystore ist **nicht** im Repo. Für eigene Builds einen neuen erzeugen:

```bash
keytool -genkeypair -keystore .secrets/streamcaster-release.jks \
  -alias streamcaster -keyalg RSA -keysize 2048 -validity 10000
```

Die nativen Abhängigkeiten werden als Git-Submodule geladen:
UxPlay, libplist, openssl-cmake und FFmpeg. Der erste Build kompiliert
OpenSSL und ein minimales FFmpeg (ALAC/AAC) für arm64 — das dauert einige
Minuten.

## Architektur

```
HubActivity (Launcher)
 ├─ StreamCasterSession ── WebSocket ── signaling.streamcaster.workers.dev
 │    └─ CommandOps (load/play/pause/seek/volume/stop/subtitle)
 ├─ CastPlayerActivity ── ExoPlayer/Media3 (URL, HLS, VTT)
 ├─ AirPlayService (Upstream) ── UxPlay/JNI ── AirPlay/RAOP
 │    ├─ mDNS: _airplay._tcp, _raop._tcp
 │    └─ MainActivity: AirPlay-Vollbild + Einstellungen
 └─ HubScreen: Raum-Code, Signaling-Status, AirPlay-Status
```

Der Kotlin-Namespace bleibt `io.github.jqssun.airplay`, weil die
JNI-Bridge des Upstreams an diese Klassennamen gebunden ist. Die
Installations-ID ist `com.streamcaster.receiver`.

## Protokoll

- WS: `wss://streamcaster-signaling.streamcaster.workers.dev/ws?code=<CODE>&role=receiver`
- Join: `{"t":"join","role":"receiver","code":"<CODE>","caps":{…}}`
- Raum-Code: 6 Zeichen aus `23456789ABCDEFGHJKMNPQRSTUVWXYZ`
- Befehle: `{"t":"cmd","op":{"name":"load","url":"…"}}`
- State: `{"t":"state","state":{"paused":false,"position":12.5,…}}`

## Lizenz & Credits

Dieses Projekt steht unter **GPL-3.0** (siehe [LICENSE](LICENSE)), weil es
den GPL-lizenzierten UxPlay-Kern und die Android-Basis von
`jqssun/android-airplay-server` nutzt. Wer die App weiterverbreitet, muss
den Quellcode ebenfalls unter GPL-3.0 verfügbar machen.

- [jqssun/android-airplay-server](https://github.com/jqssun/android-airplay-server) — Android/UxPlay-Basis (GPL-3.0)
- [UxPlay](https://github.com/FDH2/UxPlay) — AirPlay/RAOP-Server (GPL-3.0)
- [FFmpeg](https://ffmpeg.org) — ALAC/AAC-Decoder (LGPL/GPL, siehe Build)
- [Next Player](https://github.com/anilbeesetti/nextplayer) — Player-Vorbild
- StreamCaster-Webapp — UI, Signaling, Protokoll

Änderungen gegenüber dem Upstream: StreamCaster-Hub, Raum-Code,
Signaling-Client, ExoPlayer-Casting, Branding/Icon, deutschsprachige
Oberfläche, Launcher-Wechsel und arm64-only Build.
