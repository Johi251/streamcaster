# StreamCaster — Abschlussplan (Stand: 2026-11-09)

Dieses Dokument ist **lebendig**, kein Historien-Archiv. Es beschreibt die drei
offenen Punkte aus der Standprüfung vom 09.11.2026, ihre Umsetzung und die
Akzeptanzkriterien. Aktueller Gesamtstatus: **[STATUS.md](../STATUS.md)**.

## Ausgangslage (verifiziert)

`Plan-Multi-Gerate-Streaming.md` datiert 2026-10-29 20:43:47; der Code und die
Dokumentation entwickelten sich bis 2026-11-06 weiter (20 Commits nach dem
Plan-Datum). Der Plan war `untracked` und lag bis 09.11. im deprecated Ordner
`MASTER_SETUP\WorkBuddy\ Project Manager`. Er war daher nie Quelle der Wahrheit.

Standprüfung gegen Code, Git und `README.md` / `DECISIONS.md` /
`docs/HANDBUCH.md` / `docs/LIMITATIONS.md` ergab 10 Punkte, davon 7 umgesetzt
oder bewusst dokumentiert entschieden. Drei echte Reste:

| # | Rest | Befund |
|---|---|---|
| 1 | Link-Preview Modal | Nur CSS `apps/sender/public/style.css:388-445` (`.preview-*`). Kein Markup in `index.html`, keine Referenz in `main.ts`. Totes CSS. |
| 2 | One-Click Setup (UPnP/mDNS) | QR-Deep-Link `#join=<code>` ist implementiert und E2E-getestet (`e2e/specs/pairing.spec.ts`). mDNS/DNSSD existiert nur in der APK (`NsdServiceManager.kt`, `UsbMdnsAdvertiser.kt`, `dnssd.c`). `DECISIONS.md` D1 verschiebt DLNA/UPnP bewusst auf v1.1. |
| 3 | Open-Source Release | Remote `Johi251/streamcaster` + APK-Repo öffentlich, 4 Tags, Pages live. Aber: keine `LICENSE` im Hauptrepo, alle `package.json` auf `private: true`, kein `repository`/`license`-Feld, `.github/` untracked. |

## Grundsatz: keine Schein-Erfüllung

`DECISIONS.md` D1 ist eine gültige Architekturentscheidung (SSDP-Multicast ist
aus Browser und Cloudflare Worker technisch unmöglich; AP-Client-Isolation;
DIDL-Quirks; E2E kann physischen UPnP-Stack nicht validieren). DLNA/UPnP wird
**nicht** implementiert, sondern als v1.1 mit klarem Migrationspfad geführt.
Der browser-kompatible Ersatz — QR + `#join=` Deep-Link — ist die v1-Form von
"One-Click Setup" und wird als solche deklariert und abgesichert.

## Arbeitspakete

### A1 — Link-Preview Modal verdrahten
- Ziel: Beim Einfügen/Erkennen einer URL vor dem Cast eine Vorschau mit Domain,
  vollständiger URL und den Aktionen **Cast** / **Abbrechen** anzeigen.
  Nutzt die bereits vorhandenen `.preview-*`-Klassen (kein CSS-Duplikat).
- Dateien: `apps/sender/src/main.ts` (neues Modul `apps/sender/src/ui/linkPreview.ts`),
  `apps/sender/src/ui/linkPreview.test.ts`.
- Akzeptanz: nur `http`/`https`, keine `javascript:`/`data:`; Domain aus `URL.hostname`;
  Escape/Backdrop schließt; Fokus zurück auf Auslöser; Unit-Tests grün;
  `pnpm typecheck` grün; kein Eingriff in bestehende Cast-Pfade.

### A2 — One-Click Setup deklarieren + absichern
- Ziel: Den QR/`#join=`-Pfad als offiziellen v1-One-Click-Setup festschreiben,
  Sicherheitslücke schließen (Deep-Link-Code validieren), D1 um D7 ergänzen.
- Dateien: `DECISIONS.md` (D7), `Plan-Multi-Gerate-Streaming.md`, `README.md`,
  `docs/HANDBUCH.md`, `e2e/specs/pairing.spec.ts` (Regressionstest für ungültigen Code).
- Akzeptanz: kein Widerspruch zu D1; Test für ungültigen `#join=`-Code; Doku nennt
  QR als One-Click und DLNA als v1.1.

### A3 — Open-Source Release vorbereiten
- Ziel: Lokal alles für ein rechtssicheres OSS-Release herstellen.
- Dateien: `LICENSE` (MIT), `NOTICE.md` (UxPlay/OpenSSL/hls.js/QRCode),
  `CONTRIBUTING.md`, `package.json` (`license`, `repository`, `private: false`
  nur im Root), `README.md` (License-Abschnitt), `docs/RELEASE.md` (Checkliste).
- Akzeptanz: LICENSE vorhanden; `pnpm verify` grün; **keine externe Mutation**
  (Repo-Sichtbarkeit, `git push`, GitHub-API) ohne explizite Freigabe.

### A4 — Single Source of Truth für alle Agenten
- Ziel: Jedes CL-Tool / jeder KI-Agent findet den aktuellen Stand ohne Raten.
- Dateien: `STATUS.md` (SSOT), `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
  `ACCESS.md`, `docs/StreamCaster ACCESS für andere KI.md`, `README.md`,
  `.workbuddy-ai/memory/MEMORY.md`, Tageslog.
- Regel: `STATUS.md` ist die einzige Statusquelle. Alle anderen Dokumente
  verlinken dorthin und duplizieren **keinen** Status.
- Akzeptanz: `scripts/check-status.mjs` prüft SSOT-Frische + Link-Vollständigkeit
  und läuft in `pnpm verify`.

## Reihenfolge
A1 → A2 → A3 → A4 → `pnpm verify` + `pnpm build` → STATUS.md finalisieren →
Memory/Tageslog → Abschlussbericht.

## Nicht im Scope (bewusst)
- DLNA/UPnP-Bridge `apps/dlna-bridge` (v1.1, siehe D1).
- Native Apple TV / Tizen / webOS Apps (proprietäre SDKs; Browser-Receiver deckt
  Samsung/LG ab).
- GitHub-Repo-Sichtbarkeit, `git push`, Release-Tag — externe Mutationen,
  benötigen Johanns Freigabe.
