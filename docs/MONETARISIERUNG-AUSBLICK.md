# Monetarisierung — Ausblick (nicht umgesetzt)

**Aktueller Projektzustand (SSOT): [../STATUS.md](../STATUS.md).**

> **Dies ist ein Ausblick, kein Feature und kein Beschluss.**
> Stand 2026-11-15: StreamCaster hat **keine Werbung, kein Tracking, keine
> In-App-Käufe, keinen Preis, kein Abo**. Das ist eine bewusste Produktentscheidung
> (siehe [DECISIONS.md](../DECISIONS.md) und
> [ANALYSE-TVCAST-VERGLEICH.md](ANALYSE-TVCAST-VERGLEICH.md) §4).
> Dieses Dokument existiert ausschließlich, damit die Frage *„was wäre nach der
> Fertigstellung denkbar?"* beantwortet und nachvollziehbar beziffert ist.
> **Freigabe-Gate:** erst nach abgeschlossener Funktionsperfektion **und** nach
> expliziter Freigabe durch Johann. Bis dahin wird keine Zeile Monetarisierungs-Code
> eingebaut.

---

## 0. Begriffsklärung / Korrektur einer Annahme

Die Anforderung *„ohne Wartezeit und ohne Werbung direkt streamen"* bezog sich auf
den **Werbeblock vor dem Video (Pre-Roll)**, wie ihn TVcast in der Gratisversion
schaltet — **nicht** auf Netzwerklatenz. Eine frühere Interpretation (Ladezeit /
Signaling-Latenz) war falsch und wird hiermit korrigiert.

Zwei getrennte Dinge, die nicht vermischt werden dürfen:

| Begriff | Bedeutung | Realität in StreamCaster |
|---|---|---|
| **Werbe-Wartezeit** | Erzwungener Ad-Block vor dem Stream | **0** — bewusst ausgeschlossen, bleibt so |
| **Technische Latenz** | Signaling + optionaler Proxy-Hop + HLS-Puffer + Decoder-Start | **ca. 1–3 s**, physikalisch nicht auf 0 reduzierbar |

Pre-Roll ist zugleich das lukrativste Werbeformat (Quelle §8: CPM $7–12). Wer ihn
entfernt, entfernt den wichtigsten Umsatzträger des Werbemodells. Das ist kein
Versehen, sondern genau der gewünschte Trade-off.

---

## 1. Wie eine kostenlose App mit Werbung Geld verdient (Grundlagen)

- **Impression** = eine sichtbare Anzeige. Nicht der Download zählt, sondern die Nutzung.
- **CPM** = Preis pro 1.000 Einblendungen, den der Werbetreibende zahlt.
- **eCPM** = *effektiver* Erlös pro 1.000 Einblendungen für den Publisher. Er ist
  **bereits netto** nach dem Anteil des Ad-Netzwerks — man darf also nicht noch
  einmal einen Netzwerkabzug rechnen.
- **Fill Rate** = Anteil der Anzeigenplätze, für die überhaupt ein Käufer gefunden
  wurde. Eine Lücke zahlt nichts.
- **Auktion / Mediation**: mehrere Netzwerke bieten gleichzeitig; das höchste Gebot
  gewinnt. Deshalb schwankt eCPM nach Land, Format, Jahreszeit und Gerät.
- **Formate** (Richtwerte iOS/Android, Quelle §8): Banner $0,25–2,50 · Interstitial
  $1,50–8,00 · Rewarded Video $5–30 · Video-Pre-Roll CPM $7–12.
- **Auszahlung** kommt vom Ad-Netzwerk, **nicht** über den App Store. Deshalb fällt
  auf Ad-Umsatz **keine** Store-Gebühr an.
- **Die Store-Gebühr (15–30 %) betrifft nur Kaufpreis und Abo** (In-App Purchase).

**Formel (Quelle §8):**

```
Monatsumsatz Ads = DAU × Sessions/Tag × Ads/Session × 30 × Fill Rate × eCPM / 1000
```

---

## 2. Die drei Modelle

| Modell | Formel | Gebühr | Charakter |
|---|---|---|---|
| **A — Einmalpreis** | Neue Käufe × Preis × (1 − Store-Anteil) | 15–30 % | Einmalig, kein wiederkehrender Erlös, Updates/Infrastruktur laufen weiter |
| **B — Monatliches Abo** | MAU × Conversion × Preis × (1 − Store-Anteil) | 15–30 % | Wiederkehrend, aber Churn frisst den Bestand; braucht dauerhaft spürbaren Mehrwert |
| **C — Werbung (frei)** | siehe Formel §1 | **0 %** | Skalierungsgeschäft: erst ab viel täglicher Nutzung interessant |

---

## 3. Angenommene Eingangswerte (Annahmen, keine Messwerte)

Es gibt **keine Nutzerzahlen** für dieses Projekt. Alle Werte sind Szenario-Annahmen
und müssen vor jeder echten Entscheidung durch echte Metriken ersetzt werden.

| Parameter | Vorsichtig | Etwas optimistisch |
|---|---|---|
| MAU | 2.000 | 30.000 |
| DAU (15 % / 25 % der MAU) | 300 | 7.500 |
| Neue Installs / Monat | 300 | 4.000 |
| Sessions / Tag | 1,5 | 2 |
| Ads / Session | 2 | 3 |
| Publisher-eCPM (USD) | 2,00 | 6,00 |
| Fill Rate | 85 % | 95 % |
| Einmalpreis | $4,99 | $6,99 |
| Käuferanteil der Installs | 15 % | 20 % |
| Abo-Preis / Monat | $2,99 | $3,99 |
| Free→Paid Conversion | 1,5 % | 3 % |
| Store-Anteil | 15 % | 15 % |

Store-Anteil 15 % = Apple **App Store Small Business Program** (offiziell, §8) bzw.
Google Play im unteren Umsatzband. Ohne das Programm gilt 30 % — dann fallen die
Netto-Erlöse aus A und B um **21 %** niedriger aus.

---

## 4. Proberechnung (nachgerechnet, netto pro Monat in USD)

Alle Beträge **vor** Steuern, Entwicklerkonten, Infrastruktur und Arbeitszeit.

### Vorsichtig

| Modell | Zwischenschritt | Netto / Monat |
|---|---|---|
| A — Einmalpreis | 300 × 15 % = 45 Käufer × $4,99 = $224,55 → × 0,85 | **$190,87** |
| B — Abo | 2.000 × 1,5 % = 30 Abonnenten × $2,99 = $89,70 → × 0,85 | **$76,25** |
| C — Werbung | 300 × 1,5 × 2 × 30 × 0,85 = 22.950 Impr. × $2,00 / 1.000 | **$45,90** |

Bestes Modell: **Einmalpreis**, hochgerechnet ~$2.290/Jahr.

### Etwas optimistisch

| Modell | Zwischenschritt | Netto / Monat |
|---|---|---|
| A — Einmalpreis | 4.000 × 20 % = 800 Käufer × $6,99 = $5.592 → × 0,85 | **$4.753,20** |
| B — Abo | 30.000 × 3 % = 900 Abonnenten × $3,99 = $3.591 → × 0,85 | **$3.052,35** |
| C — Werbung | 7.500 × 2 × 3 × 30 × 0,95 = 1.282.500 Impr. × $6,00 / 1.000 | **$7.695,00** |

Bestes Modell: **Werbung**, hochgerechnet ~$92.340/Jahr.

### Gegenprobe (unabhängige Plausibilisierung)

Mit dem vorsichtigen eCPM braucht man für **$1.000/Monat** aus Ads exakt
**500.000 Impressions** = **6.536 DAU** ≈ **43.573 MAU**. Die Quelle §8 nennt
für „significant revenue ($1,000+/month)" **10.000+ DAU** — gleiche Größenordnung,
also ist das Szenario nicht aus der Luft gegriffen. Im optimistischen Fall genügen
bereits ~975 DAU (~3.900 MAU), weil eCPM und Ad-Dichte dreimal höher liegen.

---

## 5. Was die Zahlen wirklich sagen

1. **Werbung lohnt sich erst ab Masse.** Bei 2.000 MAU ist sie mit $46/Monat das
   *schlechteste* der drei Modelle. TVcast kann nur deshalb werbefinanziert gratis
   sein, weil es Reichweite plus erzwungenen Pre-Roll hat.
2. **Der höchste Nominalwert ist der unerwünschteste Weg.** $7.695/Monat setzen
   genau die Werbung voraus, die aus dem Projekt ausgeschlossen ist. Der Vergleich
   ist also kein Argument *für* Ads, sondern eine Bezifferung des Verzichts.
3. **Alle Zahlen sind Umsatz, nicht Gewinn.** Abzuziehen: Apple-Entwicklerkonto
   (~99 €/Jahr), Google Play (25 $ einmalig — Richtwerte, vor Release prüfen),
   Cloudflare Workers Paid ab $5/Monat (§8) sowie Steuern und Arbeitszeit. Im
   vorsichtigen Szenario bleibt nach Zeit und Fixkosten real **nichts** übrig.
4. **Abo braucht einen Grund.** Ein Abo ohne wiederkehrenden Mehrwert churned.
   Bei z. B. 8 % Monats-Churn müssen im optimistischen Szenario ~72 neue Abonnenten
   pro Monat nur den Bestand halten.
5. **Infrastruktur wächst mit, nicht nur der Umsatz.** Der Free-Tier liegt bei
   100.000 Requests/Tag (~3 Mio./Monat). HLS-Segmente über `/seg` und `/p`
   erzeugen pro Wiedergabe viele Requests; bei 7.500 DAU ist der Paid-Plan
   ($5/Monat, 10 Mio. Requests inklusive, danach $0,30/Mio.) realistisch nötig.

---

## 6. Gegengründe / Risiken (vor jeder Entscheidung prüfen)

- **Produktversprechen:** „keine Werbung, kein Tracking, MIT, selbst hostbar" ist
  der Kernunterschied zu TVcast (§4 des Vergleichs). Personalisierte Werbung — also
  die, die den hohen eCPM zahlt — braucht genau das Tracking, das wir ausschließen.
  Ohne Einwilligung sinkt der eCPM in der EU deutlich.
- **Recht & Compliance:** GDPR/TTDSG-Einwilligung, iOS ATT, UMP-Consent-Flow,
  Datenschutzerklärung, AdMob-Richtlinien. Ein Tool, das beliebige Web-Videos über
  einen Proxy castet, ist policy- und urheberrechtlich heikler als ein
  Standard-Utility — vor einer Monetarisierung juristisch zu prüfen.
- **Open Source:** Bei MIT kann jeder eine werbefreie Variante bauen. Das deckelt
  die Zahlungsbereitschaft und macht ein Ad-Modell angreifbar.
- **DRM** bleibt außen vor ([LIMITATIONS.md](LIMITATIONS.md)); „direkt streamen"
  gilt nur für freie Streams — einbezahlen auf DRM-Inhalte ist kein Geschäftsmodell.
- **App-Store-Review:** Preis/Abo/Ads erfordern korrekte Angaben, Abo-Bedingungen,
  Widerruf und Restore-Flow. Das ist eigener Implementierungs- und Testaufwand.

---

## 7. Empfehlung als Ausblick (kein Beschluss)

Reihenfolge, falls das Thema *nach* der Funktionsperfektion jemals aufgegriffen wird:

1. **Nichts ändern.** Kostenlos, werbefrei, selbst hostbar bleibt der Standard.
2. Falls überhaupt: **freiwilliges „Unterstützen"-IAP oder einmaliger Kauf** — das
   einzige Modell, das ohne Tracking und ohne Werbe-Wartezeit auskommt und schon bei
   kleiner Nutzung den höchsten Netto-Erlös liefert.
3. **Abo** nur, wenn ein echter, wiederkehrender Mehrwert entsteht (z. B. gehostete
   Instanz, eigene Infrastruktur, Geräte-Sync) — nicht für das bestehende Feature-Set.
4. **Werbung nicht empfohlen.** Sie widerspricht dem Produktkern, braucht ~43.000 MAU
   für $1.000/Monat im vorsichtigen Fall und funktioniert nur mit dem Pre-Roll,
   den Johann ausdrücklich ausschließt.

Jede Umsetzung bräuchte ohnehin eine neue Entscheidung in `DECISIONS.md` — laut
`AGENTS.md` darf eine aufgezeichnete Entscheidung nicht stillschweigend umgangen
werden.

---

## 8. Quellen (abgerufen 2026-11-15)

| Aussage | Quelle |
|---|---|
| eCPM-Spannen je Format, DE-CPM $4–9, Pre-Roll $7–12, Formel, „$1.000+/Monat ab 10.000+ DAU" | MonetizeMore, *How Much Ad Revenue Can Apps Really Make in 2026?* — https://www.monetizemore.com/blog/how-much-ad-revenue-can-apps-generate/ |
| 15 % Provision auf Paid Apps / IAP | Apple, *App Store Small Business Program* — https://developer.apple.com/app-store/small-business-program/ |
| Workers Paid ab $5/Monat, 10 Mio. Requests inkl., $0,30/Mio. darüber | Cloudflare, *Workers & Pages Pricing* — https://www.cloudflare.com/plans/developer-platform/ |
| 15 % Google-Play-Service-Fee im unteren Umsatzband, 25 $ Registrierung | Sekundärquellen; **vor einem Release offiziell gegenprüfen** |
| Conversion 1,5 %/3 %, Churn 8 %, Fill Rate, DAU/MAU, Ad-Dichte | **Szenario-Annahmen dieses Dokuments**, nicht empirisch belegt |

**Hinweis zur Währung:** alle Quellen notieren in USD; deshalb auch die Rechnung in
USD. Für EUR mit dem jeweiligen Tageskurs umrechnen. eCPM, Fill Rate und Conversion
sind die drei Größen, die das Ergebnis dominieren — die Bandbreite zwischen
„vorsichtig" und „optimistisch" ist absichtlich groß, weil genau diese Werte unsicher
sind.
