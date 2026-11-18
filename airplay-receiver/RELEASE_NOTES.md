# StreamCaster Receiver v1.0.4

AirPlay-2-Empfänger für Amazon Fire TV Stick, Android TV und Smart TVs, mit
StreamCaster-Hub. Diese Version installiert auf **Fire OS 5** (Android 5.1) —
vorherige Versionen brachen dort mit „Problem beim Parsen des Pakets" ab.

## Enthalten

- **AirPlay-Spiegelung und -Audio** über den UxPlay-Kern (H.264/H.265,
  AAC/ALAC), mDNS als `StreamCaster TV` im lokalen Netz
- **StreamCaster-Hub**: 6-stelliger Raum-Code, Signaling-Status, AirPlay-Status
- **URL-Casting** über den StreamCaster-Signaling-Worker
- **ExoPlayer/Media3**: MP4, HLS, VTT-Untertitel, Seek, Lautstärke
- **State-Sync** an den Sender
- **D-Pad-Bedienung**, deutsche UI, StreamCaster-Branding

## Warum es auf älteren Fire TV Sticks vorher nicht lief

Zwei unabhängige Ursachen, beide behoben:

1. **minSdk 24** — Fire OS 5 (Fire TV Stick 1. Gen, Fire TV Stick Lite) ist
   Android 5.1.1 = API 22. Der Paket-Installer bricht bei `minSdkVersion 24`
   mit „Problem beim Parsen des Pakets" ab. Jetzt: **minSdk 22**.
2. **Redirect-Kette beim Download** — die alte APK-Adresse zeigte per 302 auf
   GitHub und von dort auf den Release-Asset-Server. Ältere Silk-Browser haben
   dabei gelegentlich die HTML-Antwort statt der Binärdatei gespeichert; das
   Ergebnis war kein gültiges ZIP und damit dieselbe Fehlermeldung.
   Jetzt liegt die APK **direkt** unter `https://streamcaster.pages.dev/apk`
   (kein Redirect, `Content-Type: application/vnd.android.package-archive`,
   `Content-Disposition: attachment`).

## Installation (Fire TV)

```
① Fire TV → „Suchen" → „Downloader" installieren (Amazon Appstore, gratis)
② Downloader öffnen → APK-Adresse eingeben:
   streamcaster.pages.dev/apk
③ „Apps aus unbekannten Quellen" für Downloader erlauben → installieren
④ „StreamCaster Receiver" starten → Raum-Code erscheint
```

iPhone/iPad: Kontrollzentrum → Bildschirmspiegelung → **StreamCaster TV**.
Beide Geräte müssen im selben WLAN sein; AP-Isolation am Router muss aus sein.

## Kompatibilität

- **Fire OS 5+** (Android 5.1 / API 22) bis Fire OS 8 (API 29)
- ABIs: `arm64-v8a` und `armeabi-v7a`
- minSdk 22, targetSdk 34, Paket `com.streamcaster.receiver`
- Signatur: v1 (JAR) + v2 + v3 — v1 wird von Android 5.x/6.x zwingend verlangt
- Zertifikat unverändert gegenüber v1.0.0 → Update über die alte Version
  installierbar, kein Deinstallieren nötig

## Bekannte Grenzen

- WebRTC-Screen/Camera-Mirroring aus der Webapp wird noch nicht dekodiert.
  Für iPhone-Spiegelung ist AirPlay der vorgesehene Weg.
- Kein Chromecast-Receiver und kein DLNA-Renderer in dieser Version.
- Kein DRM (Netflix, Apple TV App …) über AirPlay.

## Prüfsumme

```
SHA-256: 4cb303e669ab7222360e69bd03413ac866879a012bde30aaac43b9c38f0e1f57
```

Quellcode: GPL-3.0, vollständig in diesem Repository inklusive Submodule.
