# Lizenz-Optionen & White-Label — Zukunftsszenario

**Aktueller Projektzustand (SSOT): [../STATUS.md](../STATUS.md).**
Stand: 2026-11-15 · **Ausblick, nicht umgesetzt.** Die aktuelle Lizenz bleibt MIT.
Das hier ist eine technisch-juristische Einordnung, **keine Rechtsberatung** —
vor einem echten Verkauf gehört ein Anwalt / Steuerberater drauf.

---

## 0. Was du formuliert hast — und wie ich es lese

Deine Zielkette:

1. *„Was ich will, soll immer kostenlos sein."*
2. *„Wenn es gebaut ist, will ich es kostenlos verwenden."*
3. *„Ich will es am liebsten in dieser kostenlosen Form, jedoch unkenntlich oder
   nicht sichtbar für einen potenziellen Kunden, diese für mich kostenlose
   Variante verkaufen."*

**Zu 1 + 2 — das ist automatisch erfüllt, ohne jede Konstruktion.** Als Urheber
musst du dir keine Lizenz geben; du nutzt dein eigenes Werk immer frei, egal
welche Lizenz *andere* bekommen. Es gibt also gar kein Szenario, in dem du für
deine eigene Nutzung zahlst. Die eigentliche Frage lautet: **was dürfen Kunden
und was dürfen Dritte?**

**Zu 3 — hier gibt es zwei Lesarten, und ich widerspreche einer davon.**

| Lesart | Bedeutung | Bewertung |
|---|---|---|
| **A — White-Label / Dual Branding** (so habe ich es umgesetzt gedacht) | Du behältst deine private, kostenlose Variante intern. Kunden bekommen eine **eigenständig gebrandete** kommerzielle Variante (eigener Name, Logo, Farben, Domain, eigene Instanz). Die freie Community-Variante wird dem Kunden gegenüber nicht als Produktmarke gezeigt. | **Legal, üblich, technisch einfach.** Das ist das klassische Open-Core-/White-Label-Modell. |
| **B — Herkunft verschweigen** | Der Kunde soll *nicht erfahren*, dass er technisch dieselbe Variante bekommt, die es kostenlos gibt, und soll glauben, er erwerbe ein exklusiv entwickeltes Produkt. | **Setze ich nicht um.** Das ist kein Lizenzmodell, sondern eine falsche Angabe über die Beschaffenheit der Leistung (in DE u. a. § 263 StGB / UWG / Gewährleistungsrisiken). Unabhängig von der Lizenz. |

Ich habe im Folgenden konsequent **Lesart A** angenommen. Falls du B meintest:
sag es mir bitte — dann sage ich dir klar, wo die Grenze verläuft, aber ich baue
das nicht.

---

## 1. Was heute schon gilt (verifiziert)

| Fakt | Beleg / Bedeutung |
|---|---|
| **Verkaufen ist unter MIT ausdrücklich erlaubt.** | OSI-MIT-Text: *„… to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, **sublicense, and/or sell copies** …"* → **Du brauchst für einen Verkauf gar keinen Lizenzwechsel.** |
| **Einzige Pflicht: Hinweis mitliefern.** | *„The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software."* → „Unkenntlich" darf die **Marke/UI** betreffen, **nicht** den Lizenztext. Der darf aber in einer `LICENSE`-Datei oder einem „Open-Source-Lizenzen"-Bildschirm stehen — er muss nicht sichtbar im UI prangen. |
| **Markenrecht ≠ Code-Lizenz.** | MIT gewährt keine Markenrechte. Du darfst deine Kopie unter eigener Marke vertreiben; du darfst nicht eine fremde Marke benutzen oder eine Lizenz als Endorsement ausgeben. Marken-/Namensschutz ist ein eigener, separater Schritt (DPMA/EUIPO). |
| **Bereits veröffentlichte Stände bleiben MIT.** | Die MIT-Erlaubnis wird jedem Empfänger einer Kopie unentgeltlich erteilt und lässt sich für **bereits verteilte Kopien** nicht einseitig zurücknehmen. GitHub weist analog darauf hin, dass Forks und lokale Kopien nach einer Änderung weiter existieren. → Ein Wechsel der `LICENSE` wirkt **nur für neue Commits/Versionen**, nie rückwirkend auf die Tags `v1.0.0`–`v1.0.3` (Repo ist seit 09.11.2026 öffentlich). |
| **Du hast die alleinige Verfügungsgewalt über neuen Code.** | `git shortlog -sne --all`: **alle 48 Commits** auf eine Identität (`Johi251`), nach dem History-Rewrite. → Für **Dual Licensing** braucht ein Projekt genau das. Kämen später fremde Contributions dazu, bräuchte es einen **CLA** (Contributor License Agreement), sonst darf deren Code nicht umlizenziert werden. |
| **Drittkomponenten sind kommerziell unkritisch — mit einer Ausnahme.** | Laut `NOTICE.md`: Web-Stack MIT, zur Laufzeit nur `hls.js` (Apache-2.0) und `qrcode` (MIT). Beide erlauben kommerzielle Nutzung. **Der APK-Track ist GPL-3.0** (UxPlay-Kern, eigenes Repo) — der lässt sich **nicht** proprietär machen; bei Vertrieb der APK greifen GPL-Pflichten (Quellangebot, gleiche Lizenz). |
| **Es ist aktuell kein SaaS.** | Keine Accounts, keine Nutzerdatenbank, kein Billing, keine Mandantentrennung. Es ist eine selbst hostbare statische Web-App + zwei Cloudflare-Worker. Siehe §4. |

**Kurzfassung:** Der Wunsch „kostenlos für mich, verkauft an Kunden, optisch
eigenständig" ist **mit der heutigen MIT-Lizenz bereits erfüllbar**. Ein
Lizenzwechsel ist nur nötig, wenn du zusätzlich **verhindern** willst, dass
Dritte dasselbe tun.

---

## 2. Möglichkeiten unter einer anderen Lizenz (Zukunft)

| # | Modell | Für dich gratis | Kunde zahlt | White-Label | Verhindert Gratis-Konkurrenz | Aufwand | Eignung |
|---|---|---|---|---|---|---|---|
| 1 | **MIT + White-Label** (*Status quo*) | ✅ | ✅ | ✅ | ❌ | minimal | **Empfohlener Start.** Verkauft werden Marke, Hosting, Support, Konfiguration — nicht Code-Exklusivität. |
| 2 | **Open-Core**: MIT-Kern + neues proprietäres Modul | ✅ | ✅ | ✅ | nur für **neue** Teile | mittel | Wenn echte Premium-Funktionen entstehen (z. B. Team-Verwaltung). |
| 3 | **AGPL-3.0 + kommerzielle Dual-Lizenz** | ✅ | ✅ | ✅ | ✅ (für neue Versionen) | hoch | Stärkster Schutz, v. a. gegen SaaS-Anbieter, die den Code nutzen ohne zu zahlen. Braucht CLA + Vertriebsprozess. |
| 4 | **GPL-3.0 + kommerzielle Dual-Lizenz** (Qt-Modell) | ✅ | ✅ | ✅ | ✅ | hoch | Eher für Bibliotheken/SDKs als für eine Web-App. |
| 5 | **BSL 1.1 / Source-Available** mit Change Date | ✅ | ✅ | ✅ | ⏳ zeitlich befristet | mittel | Produktionsnutzung untersagt, Quelle offen, nach Change Date automatisch Open Source. **Nicht OSI-zertifiziert** — „Open Source" dürftest du dann nicht mehr schreiben. |
| 6 | **Apache-2.0 + CLA** | ✅ | ✅ | ✅ | ❌ | mittel | Bringt expliziten Patentgrant — für Firmenkunden oft ein Verkaufsargument, ändert aber nichts an der Gratis-Konkurrenz. |
| 7 | **Reines Dienstleistungs-/Markenmodell** (Code unverändert MIT) | ✅ | ✅ (Service) | ✅ | ❌ | minimal | Schnellster Weg: eigene Instanz, eigene Domain, SLA, Einrichtung, Support. |

**Wichtig bei 2–5:** Alle diese Modelle gelten **nur für Code, der nach dem
Wechsel entsteht**. Der heute veröffentlichte MIT-Stand bleibt frei verfügbar —
auch für genau die Kunden, die später deine kommerzielle Variante kaufen
könnten. Das ist kein Fehler im Plan, sondern der Preis dafür, dass das Repo
bereits öffentlich ist. Wer das nicht will, muss ein **neues, privates Repo**
starten und nur unveröffentlichten Code einbringen.

---

## 3. Was „unkenntlich" technisch konkret bedeutet (Lesart A)

1. **Branding zur Build-Zeit:** Name, Logo, Farben, `manifest.webmanifest`,
   `<title>`, APK-Label als Konfiguration (env / `brand.config.json`) statt
   hartkodiert. Kein „StreamCaster"-String im sichtbaren UI der Kundenversion.
2. **Eigene Infrastruktur:** eigenes Cloudflare-Pages-Projekt + eigene Worker,
   gebacken über `VITE_SIGNALING_URL` / `VITE_PROXY_URL` — der Kunde sieht nur
   seine eigene Domain, nie `streamcaster.pages.dev`.
3. **Pflichtunterlagen mitliefern:** `LICENSE` (MIT-Hinweis darf nicht entfernt
   werden), `NOTICE.md` (hls.js, qrcode), sowie bei Auslieferung der APK deren
   GPL-3.0-Hinweise. Bei Binaries genügt ein erreichbarer Lizenz-Bildschirm.
4. **Saubere Kommunikation:** „Eigene, gebrandete und gehostete Instanz auf
   Basis eines Open-Source-Kerns" ist korrekt. „Exklusiv von uns entwickelt,
   keine freie Version vorhanden" ist es nicht.
5. **Rechtliches vor dem ersten Verkauf:** AGB, Widerrufsbelehrung (B2C),
   Impressum, DSGVO/AVV bei Hosting, Gewährleistungsausschluss, ggf.
   Markenanmeldung. **Nicht** von mir zu beurteilen.

---

## 4. Zum Begriff „SaaS"

Du nennst es SaaS-Tool — technisch ist es das **nicht** (und das ist gut so für
die Privatnutzung). Für ein echtes kommerzielles SaaS wären zusätzlich nötig:

- Authentifizierung & Mandantentrennung (aktuell: 6-stelliger Raum-Code als
  einziges Geheimnis),
- Billing/Abo-Verwaltung, Rechnungsstellung,
- Rate-Limits & Abuse-Schutz (siehe [SECURITY-REVIEW.md](SECURITY-REVIEW.md) P1:
  der Proxy ist derzeit ein offenes Relay mit `CORS: *`),
- Secrets-Management, Monitoring/Logging, Backup, SLA, DSGVO/AVV,
- horizontale Skalierung statt Cloudflare Free Tier.

**Lizenz-Haken dabei:** AGPL behandelt Netzwerknutzung als Vertrieb — wer ein
modifiziertes AGPL-System als SaaS betreibt, muss den Nutzern die Quellen
anbieten. Genau deshalb ist AGPL + kommerzielle Dual-Lizenz (Modell 3) das
Standardmodell für SaaS-Anbieter, die beides wollen: offener Kern und
geschützter kommerzieller Betrieb.

---

## 5. Empfehlung (Ausblick, kein Beschluss)

1. **Jetzt: nichts ändern.** MIT behalten, privat kostenlos nutzen, Repo
   öffentlich lassen. Damit ist dein Kernwunsch bereits erfüllt.
2. **Stufe 1 (geringer Aufwand, größter Effekt):** Branding-Konfiguration als
   reines Build-Feature + eigene Deploy-Zielvariable. Kein Lizenzwechsel, kein
   Risiko, sofort eine „unkenntliche" Kundeninstanz möglich.
3. **Stufe 2 (nur bei echtem Schutzbedarf):** **neues privates Repo** für neue
   Module unter proprietärer Lizenz oder BSL; den MIT-Kern als Abhängigkeit
   sauber dokumentieren. CLA für alle zukünftigen Mitwirkenden. **Nie**
   versuchen, bereits veröffentlichte Commits umzuwidmen.
4. **Stufe 3:** Dual Licensing / AGPL erst mit anwaltlicher Begleitung und
   einem echten Vertriebsprozess.

---

## 6. Quellen (abgerufen 2026-11-15)

| Aussage | Quelle |
|---|---|
| MIT-Text: Nutzung, Sublicensing, Verkauf; Pflicht zur Aufnahme von Copyright- und Permission-Hinweis | Open Source Initiative — https://opensource.org/license/mit |
| Umgang mit bestehenden Lizenzen, Forks und lokalen Kopien; Hinweis, dass GitHub keine Rechtsberatung leistet | GitHub Docs — https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository |
| BSL 1.1: Additional Use Grant, Change Date, Parameterisierung | SPDX — https://spdx.org/licenses/BUSL-1.1 |
| AGPL: Netzwerknutzung als Vertrieb (Grundlage für Dual-Licensing bei SaaS) | GNU AGPL-3.0, §13 — https://www.gnu.org/licenses/agpl-3.0.html |
| Projektinterne Fakten (Lizenzsplit, Drittkomponenten, Repo-Status) | `LICENSE`, `NOTICE.md`, `docs/RELEASE.md`, `STATUS.md`, `git shortlog -sne --all` |

**Monetarisierungs-Zahlen und -Modelle** stehen bewusst getrennt in
[MONETARISIERUNG-AUSBLICK.md](MONETARISIERUNG-AUSBLICK.md). Beide Dokumente
sind Ausblicke; im Code ist **nichts** davon umgesetzt.
