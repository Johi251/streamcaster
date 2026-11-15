# Team Quality Guide — StreamCaster

**Zweck:** Senior-Entwickler-Leitplanken + Code-Quality-Kontrolle für dieses Projekt
(und als Vorlage für Nachfolgeprojekte). Stand: 2026-11-15, nach vollständigem
Code-Review aller Kernmodule (sender, receiver, signaling/Room-DO, proxy, shared).
Aktueller Projektzustand (SSOT): [../STATUS.md](../STATUS.md).

---

## Teil 1 — Was dieser Code bereits richtig macht (davon lernen!)

Das hier ist keine Übertreibung: Der Code folgt Senior-Praktiken, die viele
kommerzielle Projekte vermissen lassen. **Diese Muster sind verbindlich** — neuer
Code muss sich daran messen lassen.

| # | Muster | Wo | Warum es wichtig ist |
|---|---|---|---|
| 1 | **Single Source of Truth**: ein `AppState`, ein `render()` leitet alles ab | `apps/receiver/src/main.ts` §2/§9 | Kein „Zustand ist über 12 DOM-Elemente verstreut". Wer UI ändern will, ändert State + render, nie „irgendwo das Element". |
| 2 | **Ehrliche UI-Phasen**: `"home" \| "waiting" \| "connected"` | `apps/sender/src/main.ts` (`Phase`) | „Socket offen" ≠ „TV verbunden". Der Kommentar dazu („must not be dressed up as one") ist Programm: kein Status-Fake. |
| 3 | **Generation-Guards gegen Race-Conditions**: `clientGen` | receiver `connectSignaling()` | Events eines pensionierten Sockets werden ignoriert, sonst flappt der Room beim Reconnect. Muster: „Jeder Client bekommt eine Generation, Events zählen nur, wenn die Generation noch aktuell ist." |
| 4 | **Takeover statt Reject**: neue Verbindung derselben Rolle schließt die alte | `apps/signaling/src/room.ts` `handleJoin()` | Ein TV, das aus dem Standby aufwacht, würde sonst minutenlang „offline" bleiben, weil die halboffene Kante am Edge noch lebt. |
| 5 | **Backoff + Wake-up-Kicks**: exp. Backoff bis 15 s, erster Retry sofort, plus `visibilitychange`/`focus`/`pageshow`/`keydown`-Kicks | receiver `scheduleReconnect()` | TV-Browser frieren Hintergrund-Tabs ein; ohne Kicks bleibt der Room tot, ohne dass der Nutzer etwas tut. |
| 6 | **Transport-Degradierung statt Fehler**: WebSocket → (Timeout 5 s) → SSE + POST | `packages/shared/src/client.ts` | Alte TV-Browser mit kaputtem WS bleiben nutzbar. Fallback ist ein Status, kein Absturz. |
| 7 | **Cleanup-Disziplin**: `browseCleanup`, `teardown()`, `beforeunload` | sender + receiver | Jeder Listener, der registriert wird, hat einen Abmeldepfad. Kein Leak über Session-Grenzen. |
| 8 | **Kommentare erklären WARUM, nicht WAS** | überall (z. B. `room.ts` Takeover-Kommentar) | Der wertvollste Teil der Codebase. Neue Kommentare müssen dieser Norm folgen — ein `// set x` ist verboten. |
| 9 | **Capability-Gating statt Feature-Blindflug**: `canMirror()`, `ReceiverCaps`, Chromecast-Gating | sender capture/cast, E2E `chromecast-gating.spec.ts` | Buttons, die im Browser nicht gehen können, sind disabled **mit Begründung im Tooltip** — nicht versteckt, nicht kaputt. |
| 10 | **Kein `innerHTML` mit Fremddaten**: DOM wird über `el()`/`textContent` gebaut | sender `main.ts`, receiver | XSS-Resistenz by design. Der einzige `innerHTML`-ähnliche Pfad ist der ES5-Fallback-Guard in `index.html` — ausschließlich mit `textContent` und statischen Strings. |

**Lernsatz fürs Team:** Robustheit hier kommt nicht von try/catch-Flut, sondern
von klaren Zustandsmodellen + Degradierungs-Ketten + Aufräum-Disziplin.

---

## Teil 2 — Review-Ergebnis (2026-11-15)

### Gefunden und **direkt gefixt** (dieser Commit)

| Schwere | Finding | Fix |
|---|---|---|
| **Hoch** | CI-Workflow war ein Stub: `deploy-pages.yml` published das **Repo-Wurzelverzeichnis** nach GitHub Pages — kein Build, keine Tests, nichts sinnvolles deployt | Ersetzt durch `.github/workflows/ci.yml`: `pnpm install --frozen-lockfile` → `pnpm verify` → `pnpm build:site` auf jedem Push/PR. Deploy bleibt manuell (Absicht: Secrets-Limitierung). |
| **Hoch** | **Peer-Leak im Sender**: `startStreaming()`/`pickAndSendFile()` überschrieben `peer` ohne `stop()` — alter `RTCPeerConnection` + Capture-Indikator blieben aktiv | `peer?.stop()` vor jedem Neuaufbau |
| **Mittel** | `formatTime()` zeigte Filme ≥ 1 h als „95:30" und Live-Streams als „NaN:NaN" | Stunden-Support (`1:35:30`) + `Number.isFinite`-Guard |
| **Mittel** | HLS-Erkennung prüfte `url.endsWith(".m3u8")` — URLs mit Query-String (`video.m3u8?token=1`) wurden als mp4 geladen und brachen | Pfad-Prüfung via `new URL()` (receiver `loadPlayer`) |
| **Mittel** | Kein `unhandledrejection`-Handler — async Fehler (WebRTC-Negotiation, Blob-Playback) verschwanden lautlos auf dem TV | Handler ergänzt → Toast + console.error |
| **Niedrig** | `loadedmetadata` übernahm `NaN`/`Infinity` (Live) als `state.duration` → Seek-Mathe kaputt | Finite-Guard |
| **Niedrig** | hls.js-Config enthielt nicht existierende Optionen (`enableNativeHls`, `maxFragmentBufferLength`) — still ignoriert, aber irreführend | Entfernt; echter Grund für `maxBufferLength: 3` dokumentiert |
| **Mittel (Altgeräte)** | Vite-Target `es2020` (= Chromium 80+) schloss aktualisierte Fire-OS-5-Silk-Browser aus; ohne Modul-Support: weißer Screen | Target `es2018` (beide Apps) + **ES5-Fallback-Overlay** in beiden `index.html`: fehlen `Promise`/`fetch`/`WebSocket`/(WebRTC), erscheint eine lesbare Seite mit dem APK-Pfad statt eines weißen Screens. Der Guard läuft **vor** dem Modul-Bundle und ist bewusst ES5 (kein Arrow, kein `const`, kein Template-Literal). |

### Backlog (bewusst nicht in diesem Commit, priorisiert)

| Prio | Item | Warum / Hinweis |
|---|---|---|
| P1 | Rate-Limit für `/send` (Proxy/IP-basiert) | Öffentlicher Endpoint ohne Throttle. Room-Codes sind 6-stellig mit ~31-Zeichen-Alphabet, aber ein Spammer mit bekanntem Code kann die Nachricht fluten. Umsetzung im Worker (DO-freundlich: z. B. Token-Bucket im Room). |
| P1 | Volume-/Label-Update ×4 im receiver `main.ts` + `bindEvents()` dupliziert Logik | Refactor: `setVolumeUI(v)` Helper. Reiner Lesbarkeits-Fix, null Risiko. |
| P2 | `player.ts`: VTT-Track-Code dreimal identisch (HLS/MP4/WebRTC-Klassen) | Base-Klasse oder Mixin `withVttTracks`. |
| P2 | `hlsHs: any` / `hlsInstance: any` | `hls.js` hat eigene Types — `import Hls from "hls.js"` typisiert. |
| P2 | `findRole()` gibt `{} as WebSocket` für SSE-occupied zurück (dokumentierter Type-Lie) | Sauberer: Return-Typ `WebSocket \| "sse" \| null`. |
| P3 | `apps/signaling/src/index.ts`: pathname-Switch setzt jeden Pfad auf sich selbst (toter Code) | Vereinfachen beim nächsten Worker-Deploy. |
| P3 | E2E-Abdeckung für den APK-Pfad (adb-Install-Smoke in CI-selfhosted) | Braucht Android-Runner oder self-hosted Runner mit Gerät. |
| P3 | CI-Deploy-Job mit `CLOUDFLARE_API_TOKEN` als Repo-Secret | Erst wenn Automatisierung gewünscht ist; sonst bleibt Deploy manuell (knapp, kontrolliert). |

---

## Teil 3 — Team-Praktiken (verbindlich)

### Definition of Done (für jeden Merge nach `main`)
1. `pnpm verify` grün (Typecheck + Unit-Tests + Status-Check — Stand heute: 55).
2. Für UI-/Flow-Änderungen: betroffene E2E-Specs lokal grün, bei Deploy die Live-Suite
   (19/19) — siehe `ACCESS.md` Abschnitt „Build & Test".
3. Neue Fehlerfälle sind entweder behandelt (Toast/Degradierung) oder haben einen
   Backlog-Eintrag mit Prio. „Läuft schon irgendwie" zählt nicht.
4. Kommentare an Neuem erklären das **Warum** (siehe Teil 1, Muster 8).
5. Konventioneller Commit (`fix:`, `feat:`, `docs:`, `test:`, `chore:`) — die History
   ist hier bereits sauber, das bleibt so.

### PR-/Review-Checkliste (Reviewer fragen diese 6 Fragen)
1. **Zustand:** Gibt es jetzt zwei Quellen der Wahrheit, wo es vorher eine gab?
2. **Races:** Kann das Feature mit einem Reconnect/Timeout kollidieren? (Generation-Guard nötig?)
3. **Cleanup:** Wird jeder Listener/Timer/Peer wieder abgemeldet (auch bei Fehlerpfaden)?
4. **Altgeräte:** Läuft es ohne Modul-Support/MSE/WebRTC weiter sichtbar nutzbar (Guard/Fallback)?
5. **Fehler-Philosophie:** Passende Stufe gewählt? → s. Tabelle unten.
6. **Tests:** Unit für Logik, E2E für Nutzerfluss — und zwar auf der Ebene, die das Risiko trägt?

### Fehlerbehandlungs-Konvention (die drei Stufen — so ist es im Code, so bleibt es)
| Stufe | Wann | Beispiel |
|---|---|---|
| **Degradieren + Status melden** | Es gibt einen brauchbaren Fallback | WS→SSE, Mute-Autoplay-Fallback, Chromecast-Detect-Fail → `castAvail = false` |
| **Toast (nicht-blockierend)** | Nutzer kann reagieren, Session lebt weiter | `toast("Signaling error: …")`, Send-Status |
| **Throw / Fail-Loud** | Nur bei Programmierfehlern & fehlenden DOM-Elementen | `q()` throws bei fehlendem `#id` — bewusst laut, damit Builds es zeigen |
| Verboten | Stiller `catch {}` **ohne** Kommentar, der sagt, warum Stille ok ist | Vorhandene leere catches haben alle einen Begründungs-Kommentar — neue auch. |

### Testpyramide (was wohin gehört)
- **Unit (vitest, 55):** reine Logik — Room-Code-Alphabet, Chromecast-Befehle, Link-Preview, Proxy-Guard/Blocklist/Rewrite.
- **E2E (Playwright, 19):** Nutzerflüsse über das echte Signaling — Pairing, URL-Cast, Browse, Mirror, HLS, Extract, Chromecast-Gating.
- **Manuell auf Hardware:** nur Dinge, die Chromium nicht simulieren kann (Fire-TV-APK-Install, AirPlay, Autoplay-Politik von TV-Browsern) — dokumentiert in `ACCESS.md`.

---

## Teil 4 — Richtwerte für neue Architektur-Entscheidungen

1. **Ein Feature = ein Transport-Adapter + ein CommandOp + eine Spec.** Neue Cast-Wege
   folgen dem Muster aus `README.md` („Adding a New Casting Method").
2. **Server-Dauerzustand nur im Room-DO (SQLite-KV), clientseitiger Dauerzustand nur
   `localStorage`** (Bookmarks-Muster mit try/catch + Validierung beim Laden).
3. **Protocol ist Source of Truth:** Erst `protocol.ts` ändern, dann Client/Server.
4. **Jede Abschätzung „das wird der TV-Browser sicher können" ist falsch bis bewiesen.**
   Fire OS 5 Silk ≈ Chromium 59–63: kein `?.`-Chaining im Handlauf, Modul-Support lückenhaft,
   WebSocket-Upgrade bricht unter Proxies. Deshalb: Guard + Degradierung + APK-Pfad.
