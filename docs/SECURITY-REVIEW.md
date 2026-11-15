# Security Review — Senior-Durchgang mit Cybersecurity-Brille

**Aktueller Projektzustand (SSOT): [../STATUS.md](../STATUS.md).**
Stand: 2026-11-15 · Umfang: alle Kernmodule (`sender`, `receiver`, `signaling`
+ `Room`-DO, `proxy`, `shared`), CI-Workflow, Pages-Header, Service Worker,
Dependency-Audit, Secret-Scan über getrackte Dateien.

> Dies ist ein technisches Review, **keine** penetration testing und kein
> Ersatz für eine externe Prüfung. Jedes Finding wurde gegen den echten Code
> und — wo möglich — empirisch gegen die Plattform-API gegengeprüft.

---

## 1. Methode

1. Vollständiges Lesen der Kernquellen (nicht nur Stichproben).
2. Gegenprobe jeder Behauptung am tatsächlichen Laufzeitverhalten
   (Beispiel: `desiredSize` der Web-Streams-API in Node gemessen, statt aus
   der Dokumentation zu raten).
3. Fix → Unit-Test → `pnpm verify` → Produktions-Build.
4. Restrisiken werden **benannt**, nicht wegoptimiert oder beschönigt.

---

## 2. Gefunden und behoben

| # | Schwere | Fund | Ort | Fix |
|---|---|---|---|---|
| S1 | **Hoch (Funktion + DoS)** | Byte-Caps waren wirkungslos: `controller.desiredSize` (Chunk-Zähler/Backpressure) wurde mit einem **Byte**-Limit verglichen. Gemessen: nach dem ersten `enqueue` ist `desiredSize` = 1, und `1 > -2.097.152` ist **immer wahr** → jeder gestreamte Body wurde nach dem **ersten Chunk** abgebrochen. Im `/p`-Pfad kam zusätzlich ein neuer `getReader()` pro `pull()` hinzu (zweiter Pull ⇒ „stream locked"). Kleine E2E-Fixtures passen in einen Chunk und haben den Fehler maskiert. | `apps/proxy/src/index.ts` (`/fetch`, `/p`) | Neues Modul `apps/proxy/src/limit.ts` mit echtem Byte-Zähler, **einem** Reader pro Stream; angewendet auf `/fetch`, `/seg` und `/p`. 4 Regressionstests. |
| S2 | **Hoch** | `window.addEventListener("message", …)` prüfte nur `__sc === true`, **nicht** `e.origin` und **nicht** `e.source`. Das injizierte Script postet mit `'*'`. Damit konnte jedes fremde Fenster (Ad-iframe, Opener, Extension) eine beliebige Medien-URL in die Kandidatenliste einschleusen. | `apps/sender/src/main.ts` (`onMsg`) | Streng: `e.source === iframe.contentWindow` **und** `e.origin === new URL(proxy).origin`. Zusätzlich werden `blob:`/`data:`/`javascript:`-Kandidaten via `parseSafeUrl` verworfen, bevor sie als toter Proxy-Request beim TV landen. |
| S3 | **Mittel** | `/browse` leitete **alle** Upstream-Header weiter — inklusive `Set-Cookie` (Cookies auf der Proxy-Origin, lesbar von jeder anderen proxied Page), `Content-Length`/`Content-Encoding` (wir haben das HTML aber neu geschrieben → falsche Angaben, Dekodierfehler) sowie `WWW-Authenticate`. | `apps/proxy/src/index.ts` (`handleBrowse`) | Diese Header werden entfernt; ergänzt `Referrer-Policy: no-referrer` und `X-Content-Type-Options: nosniff`. |
| S4 | **Mittel** | SSRF-Guard: beliebige Ports (Port-Scan-Relay), URL-Credentials und private/link-local/IPv4-gemappte **IPv6**-Literale waren erlaubt. Decimal/Hex/Octal-IPv4 werden von der WHATWG-URL-API zwar auf `127.0.0.1` normalisiert und waren damit schon abgedeckt — das wurde explizit nachgemessen. | `apps/proxy/src/guard.ts` | Port auf 80/443 begrenzt, Credentials abgelehnt, `fc00::/7`, `fe80::/10`, `::*` und `.localhost`/`.localdomain` geblockt. 6 Tests. |
| S5 | **Mittel** | `parseClientMessage` prüfte nur `"t" in data` und castete dann blind auf die Union. `{"t":"cmd"}` ohne `op` crashte das Room-DO bei `msg.op.name` und beendete dessen Message-Loop. `/send` las den Body zudem **unbegrenzt** mit `request.text()`. | `packages/shared/src/protocol.ts`, `apps/signaling/src/room.ts` | Validierung aller vom Routing dereferenzierten Felder + 64-KB-Frame-Cap; `readCapped()` für POST, Methoden-Check, WS-Frame-Cap, SSE-`role` wird auf `sender`/`receiver` validiert. 7 Tests. |
| S6 | **Niedrig** | CI lief mit Default-`GITHUB_TOKEN`-Scopes und persistierten Credentials im Checkout. | `.github/workflows/ci.yml` | `permissions: contents: read`, `persist-credentials: false`. |
| S7 | **Niedrig** | Receiver hatte gar keine CSP (Begründung: Cast-SDK auf dem Sender). Der Receiver lädt das SDK aber **nicht**. | `scripts/build-site.mjs` (`_headers`) | Schmale CSP für `/r/*`: `object-src 'none'; base-uri 'self'; form-action 'self'` — ohne `default-src`, damit Medien beliebiger Origins weiter laufen. |

**Zusätzlich geprüft, ohne Befund:** XSS-Sinks (durchgehend `textContent`/`el()`, kein `innerHTML` mit Fremddaten — inkl. `toast()` und Error-Handler), `parseSafeUrl`-Gate vor URL-Casts, Room-Code-Alphabet (32 Zeichen, `crypto.getRandomValues`, 32⁶ ≈ 1,07 Mrd.), WebSocket→SSE-Degradierung, Generation-Guards, Takeover-Logik, TTL-Alarm, Service-Worker-Cache (nur Same-Origin-Shell, keine Cross-Origin-Medien), `pnpm audit --prod` (**0 bekannte Schwachstellen**), Secret-Scan über alle getrackten Dateien (**0 Treffer** für Konto-Metadaten/LAN-IP).

---

## 3. Verifikation

- `pnpm verify`: **EXIT 0** — Typecheck + **72/72 Unit-Tests** (vorher 55) + SSOT-Check.
- Produktions-Build `pnpm build:site` mit echten Worker-URLs: **EXIT 0**.
- E2E-Suite gegen die Live-Umgebung: siehe [STATUS.md](../STATUS.md) (die Suite läuft gegen den deployten Stand).
- `pnpm audit --prod`: „No known vulnerabilities found".

> **Wichtig:** die Worker-Fixes (S1, S3, S4, S5) sind im Repo, aber erst nach
> einem `pnpm deploy:all` in Produktion wirksam. Ein Deploy ist eine externe
> Mutation nach `docs/RELEASE.md` §0 und braucht eine eigene Freigabe.

---

## 4. Restrisiken (bewusst nicht „weggefixt")

| Prio | Risiko | Warum offen / mögliche Maßnahme |
|---|---|---|
| **P1** | **Kein Rate-Limit** auf `/send`, `/ws`, `/fetch`, `/p`. CORS ist `*`, der Proxy ist ein offenes Relay. Jeder kann auf Free-Tier-Kosten Requests erzeugen; `idFromName(code)` erzeugt pro 6-stelligem Code ein neues Durable Object → gezielte Ressourcen-/Kosten-Erschöpfung. | Braucht eine zentrale Zählstelle (Cloudflare Rate Limiting / ein DO-Token-Bucket pro IP-Hash). Nicht mit ein paar Zeilen im Worker sauber lösbar. Bereits im [TEAM-QUALITY-GUIDE.md](TEAM-QUALITY-GUIDE.md) als P1 geführt. |
| **P1** | **DNS-Rebinding**: ein öffentlicher Hostname kann zum Zeitpunkt des `fetch` auf eine private IP auflösen. Die Guard-Prüfung sieht nur den Namen. | Auf Worker-Ebene ohne eigene Auflösung+Pinning nicht vollständig lösbar; Cloudflare blockt vieles, aber nicht garantiert. Vor einem kommerziellen Betrieb messen. |
| **P2** | **Keine Authentifizierung**: der 6-stellige Raum-Code ist das einzige Geheimnis (≈1,07 Mrd. Kombinationen). Wer ihn kennt oder errät, kann Kommandos senden. | Design-Entscheidung (kein Account, D7). Für Privatnutzung angemessen; für SaaS/Mehrmandanten **nicht** ausreichend. |
| **P2** | **`/browse` führt fremden HTML+JS unter der Proxy-Origin aus** (`allow-scripts allow-same-origin`, CSP entfernt). Das ist funktional gewollt, aber eine bewusst große Angriffsfläche. `set-cookie` ist jetzt entfernt; `frame-ancestors` auf die eigene Pages-Origin wäre der nächste Schritt. | Nicht umgesetzt, weil es lokale Entwicklungs-/E2E-Setups mit `127.0.0.1` brechen würde → konfigurierbare `SITE_ORIGIN`-Variable nötig. |
| **P2** | **Keine globale CSP auf dem Sender** (Cast-SDK lädt zur Laufzeit Scripts von gstatic.com). | Bewusster Trade-off, dokumentiert in `scripts/build-site.mjs`. Der Receiver hat jetzt eine schmale CSP. |
| **P3** | CI-Actions per Tag statt Commit-SHA gepinnt. | Supply-Chain-Härtung; SHA-Pinning bei nächster CI-Änderung. |
| **P3** | Room-Code-Normalisierung im Worker erlaubt Zeichen (`0/O/1/I/L`), die das Alphabet nie erzeugt. | Harmlos, aber unnötige Räume möglich; auf `isValidRoomCode` umstellen. |

---

## 5. Bewertung

Die Architektur ist für ein privates, selbst gehostetes Tool **solide**:
klare Zustandsmodelle, Degradierung statt Absturz, keine Fremddaten in
DOM-Sinks, keine Secrets im Repo, keine bekannten Abhängigkeitslücken. Der
schwerwiegendste Fund (S1) war **kein klassisches Sicherheitsleck, sondern ein
stiller Funktionsfehler**, den ein Security-Durchgang wegen der Ressourcen-Caps
überhaupt erst sichtbar gemacht hat — ein gutes Beispiel dafür, warum
„Sicherheit" und „Korrektheit" nicht getrennt betrachtet werden dürfen.

Für einen **kommerziellen / mehrmandantenfähigen Betrieb** ist das Projekt
dagegen **noch nicht ausgelegt**: P1 (Rate-Limit/Offenes Relay) und P2
(Authentifizierung) müssten vorher geschlossen werden. Das ist eine bewusste,
ehrliche Grenze — kein versteckter Mangel.
