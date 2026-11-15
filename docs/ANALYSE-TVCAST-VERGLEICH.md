# Vergleich: StreamCaster vs. „TV Cast" (2kit, Fire-TV-Edition)

**Stand:** 2026-11-15 · Basis: Features der App-Familie „Video & TV Cast" von
2kit Consulting (video-tv-cast.com, Fire-TV-Edition: video-tv-cast.com/amazon-fire-tv)
sowie unsere eigene Analyse `ANALYSE-Multi-Gerät-Streaming.md` im Workspace.
Ziel: abschauen, was gut ist — und bewusst lassen, was nicht zu uns passt.
Aktueller Projektzustand (SSOT): [../STATUS.md](../STATUS.md).

---

## 1. Wie „TV Cast" funktioniert (Referenzmodell)

Der Sender ist eine **native Mobile-App** (iOS/Android) mit **eingebautem Browser**:
1. Phone und Fire TV im gleichen WLAN, Receiver-App auf dem TV starten.
2. Nutzer surft im App-Browser (z. B. Streaming-Seite) und startet das Video dort.
3. Die App **erkennt die Video-URL automatisch** und bietet einen Cast-Knopf an.
4. Die TV-App spielt die URL **nativ** (hardwarebeschleunigt) ab.

Dazu verkauft 2kit: Screen-Mirroring-Apps, Screen-Recording, TV-Fernbedienungs-Apps,
Premium per In-App-Kauf, Werbung in der Gratis-Version, Tracking (App-Store-Datenlabel:
Standort, Nutzerdaten, Diagnose).

## 2. Feature-Matrix

| Feature | TV Cast (2kit) | StreamCaster | Anmerkung |
|---|---|---|---|
| Web-Videos casten (URL/Stream) | ✅ | ✅ | Wir: URL-Cast + automatische Extraktion + Probe |
| Eingebauter Browser mit Video-Erkennung | ✅ (nativ) | ✅ (Browse & Cast via Intercepting Proxy, Ad-Block-Zähler) | Kernidee übernommen; wir per Proxy-iframe statt nativem Browser |
| Automatischer Cast bei „Play" im Browser | ✅ | ⚠️ Teilweise | Extraktion castet bei genau einem Kandidaten sofort; im Browse-iframe wird der Kandidat als Button angeboten (Bewertung unten) |
| Lesezeichen im Sendebrowser | ✅ | ✅ | `sc.browse.bookmarks`, lokal, max. 60 |
| Natives Playback auf dem TV | ✅ | ✅ (Fire-TV-APK: Media3/ExoPlayer) | APK seit v1.0.4 ab Fire OS 5 (Stick 1. Gen) |
| Screen-Mirroring Phone→TV | ✅ (eigene App) | ✅ Android/Desktop Chrome (WebRTC), iPhone→Fire TV via AirPlay (APK) | iOS-Browser können ohne `getDisplayMedia` nicht mitspielen — Architektur-Grenze, kein Feature-Versäumnis |
| Lokale Dateien senden | ✅ (Photos/Medien) | ✅ Video/Audio via WebRTC-DataChannel + Untertitel (.vtt) | |
| Empfänger-Auswahl | „Gerät wählen" (Bonjour/MDNS) | Room-Code/QR — Gerät egal | Wir koppeln geräteunabhängig über den Code, nicht per Gerätesuche |
| Empfänger-Hardware | Chromecast, Samsung/LG/Sony, Roku, Fire TV | **Jeder Browser** + Fire TV/Android TV (APK) + Chromecast-Gating | Unser Web-Empfänger läuft auch auf Echo Show, alten Smart-TVs, Laptop |
| Kosten/Werbung/Tracking | Gratis mit Werbung, Premium-IAP, Tracking | Keins, MIT-Open-Source, selbst hostbar | Kernunterschied |
| Qualitätssicherung | unbekannt | CI-Gate + Unit-/E2E-Suite gegen die Live-Umgebung (aktuelle Zahlen: [../STATUS.md](../STATUS.md)) | |

## 3. Was wir uns abschauen (Roadmap-Ideen, priorisiert)

1. **„Cast on play" im Browse-iframe (P1):** TV Casts Stärke ist der null-Klick-Flow.
   **Präzisierung (verifiziert 2026-11-15):** `BROWSE_INJECT` in
   `apps/proxy/src/rewrite.ts` hookt `play()`/`playing`/`loadstart` und neue
   `<video>`-Elemente **bereits** und postet `type:'media'`; der Sender macht daraus
   nur einen Button. Es fehlt also **nur die automatische Reaktion**, nicht die
   Erfassung — ein kleiner Eingriff, kein Architekturprojekt. Vor der Umsetzung zu
   lösen: Autoplay-/Werbe-False-Positives und `blob:`-/`data:`-URLs werden aktuell
   **nicht** gefiltert (tote Loads auf dem TV), der Link-Preview-D7-Flow würde
   umgangen, und es gibt **keine E2E-Spec** für den Media-Capture-Pfad. Empfehlung:
   Auto-Cast nur bei genau einem plausiblen `http(s)`-Kandidaten, mit Debounce,
   einmal pro Navigation und sichtbarem Rückgängig — plus einer neuen Spec.
2. **PWA Share-Target (P1):** Android-„Teilen → StreamCaster" aus jedem Browser/App
   heraus. `manifest.webmanifest` um `share_target` erweitern, Sender-Deep-Link mit
   vorbefüllter URL. Kleiner Aufwand, großer UX-Gewinn — TV Cast hat das als
   „Teilen-in-App" ebenfalls.
3. **Verlauf für die URL-Eingabe (P2):** letzte 10 URLs als Chips unter dem Eingabefeld
   (localStorage-Muster wie die Bookmarks — `sc.url.history`).
4. **Wiedergabeliste/Queue (P2):** `load`-Command um `queue`-Operationen erweitern;
   Receiver spielt Liste ab. Protocol-Erweiterung in `packages/shared/src/protocol.ts`.
5. **Foto-/Musikmodus (P3):** Slideshow statt `<video>`. Erst wenn 1–4 durch sind.

## 4. Was wir bewusst NICHT übernehmen

- **Werbung, In-App-Käufe, Tracking, Daten-Sammeln** — Gegensatz zum Projektziel.
  **Begriffsklärung (korrigiert 2026-11-15):** „ohne Wartezeit" meint den
  **Werbe-Pre-Roll vor dem Video**, nicht die Netzwerklatenz. Der Pre-Roll ist
  zugleich das lukrativste Werbeformat (CPM $7–12) — ihn zu entfernen heißt, dem
  Werbemodell seinen stärksten Umsatzträger zu nehmen. Bezifferter Ausblick,
  was Monetarisierung *nach* Fertigstellung bedeuten würde (bewusst **nicht
  umgesetzt**): [MONETARISIERUNG-AUSBLICK.md](MONETARISIERUNG-AUSBLICK.md).
- **Native Gerätesuche als Kopplung** (mDNS/Bonjour-Only): schließt Router-Isolation und
  aktive AP-Isolation aus; unser QR/Code-Pairing funktioniert auch dort.
- **Closed Source / Lock-in**: Unser Empfänger läuft im Browser des Geräts — kein
  App-Store-Zwang auf der Empfängerseite.
- **DRM-Inhalte** (Netflix & Co.): bei beiden Tools unmöglich (EME-Lizenzierung) —
  weiterhin in `docs/LIMITATIONS.md`.

## 5. Fazit

StreamCaster deckt die Kern-UX von TV Cast (Surfen → erkennen → casten) bereits ab,
ist dabei geräteunbezogener (jeder Browser ist Empfänger), werbefrei, open source und
automatisiert getestet. Der größte noch offene UX-Vorsprung von TV Cast ist der
**Null-Klick-Cast im eingebauten Browser** (Idee 1) — danach Share-Target (Idee 2).
Beides ist mit der bestehenden Architektur (BROWSE_INJECT, Link-Preview, Protocol)
sauber umsetzbar, ohne neue Infrastruktur.
