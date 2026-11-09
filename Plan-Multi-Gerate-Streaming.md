# StreamCaster — Multi-Geräte-Streaming-Plan (lebendig)

> **Status:** Der verbindliche Projektzustand steht in [STATUS.md](STATUS.md).
> Dieses Dokument ist der ursprüngliche Feature-Plan (Fassung 29.10.2026) und
> wurde am 09.11.2026 auf den realen Stand gebracht — es ist **aktuell**, nicht
> historisch. Abweichungen zwischen Plan und Code werden hier nachgezogen,
> sobald sie entstehen.

## Ausgangsplan und realer Stand (abgeglichen 09.11.2026)

Der Plan datierte vom 29.10.; Code, Tests und Dokumentation liefen bis zum
31.10. weiter (20 Commits). Der Abgleich gegen Code, Git-Tags und die
autorisativen Dokumente (`STATUS.md`, `DECISIONS.md`, `docs/HANDBUCH.md`)
ergab: 7 von 10 Punkten waren längst umgesetzt oder bewusst entschieden, drei
waren echte Reste — alle drei am 09.11.2026 abgeschlossen (Näheres:
[docs/PLAN-Abschluss-2026-11-09.md](docs/PLAN-Abschluss-2026-11-09.md)).

## ✅ Phase 1: Done

- Browser Receiver (PWA) — `apps/receiver`, inkl. TV-Fernbedienung, Reconnect
- Signaling Server — Cloudflare Worker + Durable Object, WS + SSE-Fallback
- Proxy Worker — `/fetch`, `/hls`, `/seg`, `/browse`, `/p`
- Room-Matching via Signaling — 6-Zeichen-Codes ohne 0/O/1/I/L
- Media Capture (Screen, Camera) — WebRTC; iOS-Grenze dokumentiert (D2)
- URL Cast with Extraction — Heuristiken + Probe, Direct-URL-first (D5)
- Chrome-Cast / Chromecast Support — Cast Web Sender SDK, detection-gated (D3)

## ✅ Phase 2: Done (seit 31.10. bzw. 09.11.)

| Punkt | Stand |
|---|---|
| Receiver UI improvements | ✅ QR-Pairing, Status-Chips, Wartezustand (`peerPresent`), TV-Fernbedienung |
| Link-Preview Modal | ✅ **09.11.2026 verdrahtet** — `apps/sender/src/ui/linkPreview.ts`, bestehendes `.preview-*`-CSS genutzt, Bestätigung vor jedem URL-Cast, 8 Unit-Tests |
| PWA Service Worker (offline cache) | ✅ Sender `sw.js` + Receiver `service-worker.js`, nur Produktion |

## ✅ Phase 3: Aufgelöst in Entscheidungen (09.11.2026)

Phase 3 war „To-Plan" — heute ist jeder Punkt entschieden oder gebaut:

| Punkt | Entscheidung | Verankert in |
|---|---|---|
| Cast-Enforcement: Chromecast | ✅ gebaut (Phase 1) | `apps/sender/src/cast/chromecast.ts` |
| Cast-Enforcement: AirPlay | ✅ gebaut — separates APK-Repo, v1.0.4, Hardware-verifiziert | `airplay-receiver/` (GPL-3.0), ACCESS.md |
| Cast-Enforcement: DLNA | 🔜 **v1.1, bewusst verschoben** (D1) — SSDP aus Browser/Worker unmöglich; Migrationspfad `apps/dlna-bridge` steht | `DECISIONS.md` D1 |
| Native Receiver Apps (Apple TV, Samsung, LG) | 🚫 **Out of scope** — proprietäre SDKs; Samsung/LG laufen über den Browser-Receiver (HANDBUCH §2) | `docs/LIMITATIONS.md` |
| One-Click Setup (UPnP/mDNS Discovery) | ✅ **QR + `/#join=` Deep-Link ist die v1-Form** (D7); malformed Deep-Links verbinden nie automatisch; mDNS-Discovery = v1.1 mit DLNA-Bridge | `DECISIONS.md` D7, `e2e/specs/pairing.spec.ts` |
| Open-Source Release | ✅ **vorbereitet 09.11.2026** — `LICENSE` (MIT, Web-Stack), `NOTICE.md`, `CONTRIBUTING.md`, `docs/RELEASE.md`; APK-Repo bereits GPL-3.0 + eigene NOTICE. **Externe Schritte** (Repo-Sichtbarkeit, Push, Tag) warten auf Freigabe | `docs/RELEASE.md` |

## Was nicht geändert wird (bewusst)

- **DLNA/UPnP vor v1.1** — D1 ist eine Architekturentscheidung, kein Versäumnis.
- **Native TV-Apps** — der Browser-Receiver deckt Samsung/LG/Echo Show ab; die
  AirPlay-Lücke auf Fire TV schließt das APK.
- **Netzwerk-Discovery im Browser** — technisch unmöglich ohne natives
  Hilfsprogramm; kommt mit der v1.1-Bridge.

## Pflege dieses Dokuments

Wenn Plan und Realität auseinanderlaufen, wird diese Datei nachgezogen und
`STATUS.md` (`last-updated:`) aktualisiert. `pnpm verify` bricht, wenn STATUS.md
veraltet oder ein Einstiegspunkt die SSOT nicht verlinkt
(`scripts/check-status.mjs`).
