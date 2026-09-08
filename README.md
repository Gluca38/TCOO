# TCO-Rechner — On-Premises vs. Public Cloud

Vergleicht die Gesamtkosten einer IT-Landschaft über einen konfigurierbaren
Betrachtungszeitraum zwischen einem On-Premises- und einem Public-Cloud-Szenario.

## Grundprinzip

Der Rechner kalkuliert **nicht bottom-up**. Es gibt keinen Preiskatalog, keine
Flavors, keine Stücklisten und keine einzelnen VMs. Je Kostenblock wird ein
kumulierter Betrag eingetragen. Der Mehrwert liegt in der Struktur, der
zeitlichen Verteilung und der methodisch sauberen Auswertung — nicht im
Ermitteln von Preisen.

Jede Ergebniszahl ist bis auf die Eingaben aufschlüsselbar: ein Klick auf eine
Zelle der Jahrestabelle zeigt Rohbetrag, angewandte Steigerung,
Abschreibungsscheibe und Diskontfaktor. Was dort nicht steht, passiert in der
Berechnung auch nicht.

## Profilbasierte Vorbefüllung

Wenn der Kunde noch keine Kostendaten geliefert hat, lässt sich aus fünf im
Erstgespräch erfragbaren Merkmalen ein vollständiges Szenario hochrechnen:
Anzahl VMs (oder Mitarbeiterzahl), Storage, Jahr des nächsten
Hardware-Refresh, heutiges Betriebsmodell und Regulierungsgrad.

**Jede erzeugte Position trägt sichtbar ihre Herkunft:**

| Status | Bedeutung | Bandbreite in der Sensitivität |
|---|---|---|
| **geschätzt** | aus dem Profil erzeugt | ±35 % |
| **angepasst** | von Hand überschrieben | ±15 % |
| **kundenbestätigt** | vom Kunden bestätigt, per Klick setzbar | ±5 % |

**Die zentrale Regel:** Ein erneutes Generieren überschreibt ausschließlich
Positionen mit Status *geschätzt*. Angepasste und bestätigte Werte bleiben
unangetastet — auch bei mehrfachem Nachjustieren des Profils. Dasselbe gilt
für selbst geschriebene Notizen.

Der Tornado in der Sensitivität rangiert dadurch nicht mehr nach Blockgröße,
sondern nach tatsächlicher Unsicherheit. Er beantwortet damit die Frage,
welche Daten der Kunde als Nächstes liefern sollte.

### Koeffizienten anpassen

Alle Werte stehen in `src/domain/presets/coefficients.ts` — einer reinen
Datentabelle ohne Logik, mit Kommentar und Belastbarkeitsangabe hinter jedem
Wert. Die vollständige Quellenlage steht daneben in
[`src/domain/presets/SOURCES.md`](src/domain/presets/SOURCES.md).

**Die Koeffizienten sind recherchierte Größenordnungen für den deutschen
Markt, keine Angebotspreise.** Sie sind ausdrücklich dafür gedacht, gegen
echte Projektdaten ausgetauscht zu werden. Die beiden Werte mit dem größten
Einfluss — VMs je Host und VMs je Vollzeitkraft — beruhen auf Erhebungen von
2009–2011 und streuen um den Faktor 10; beide sind deshalb direkt im
Profildialog überschreibbar.

### Neutralität

`src/domain/presets/__tests__/neutrality.test.ts` hält Fälle fest, in denen
On-Premises gewinnen muss (kurz zurückliegender Refresh, kleine Umgebung,
hoher Standardisierungsgrad) und solche, in denen die Cloud gewinnen muss
(schlecht konsolidierte, personalintensive Umgebung). Zusätzlich wird
strukturell geprüft, dass kein Block einseitig leer bleibt — einzige
zulässige Ausnahmen sind das Rechenzentrum (nur On-Prem) und die Migration
(nur Cloud).

## Schnellstart

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # Berechnungslogik prüfen
npm run build    # statisches dist/ erzeugen
npm run lint
```

## Methodische Festlegungen

Diese Entscheidungen sind bewusst getroffen und im Code umgesetzt:

| Thema | Festlegung |
|---|---|
| Zeitraster | Jahresscharf, keine Monats- oder Anteilslogik |
| Eingabetiefe | Genau eine CapEx- und eine OpEx-Zeile je Block und Szenario |
| OpEx-Betrag | Wert im **Startjahr der Position**; Steigerung wirkt ab diesem Jahr |
| CapEx-Betrag | Nominal im Anfalljahr, **nie indexiert** — auch Wiederholungen nicht |
| Abschreibung | Linear, volle Jahresscheiben ab dem Anfalljahr |
| Diskontierung | Jahresende-Konvention, erstes Jahr `t = 1`, nominaler Satz |
| Barwert | Nur auf die Cashflow-Sicht anwendbar — Barwerte setzen Zahlungsströme voraus |
| Restwerte | Keine. Keine Altbestände, keine Sunk Costs, keine kalkulatorischen Zinsen |
| Break-even | Vorzeichenwechsel der kumulierten Differenz, linear interpoliert |
| Sensitivität | Bandbreite je Position aus dem Herkunftsstatus, globaler Regler als Multiplikator |

**P&L-Summe ≠ Cashflow-Summe.** Abschreibungsscheiben, die hinter das Ende des
Betrachtungszeitraums fallen, gehen nicht in die P&L-Summe ein. Der Betrag wird
im Annahmenkasten als *nicht erfasste Restabschreibung* ausgewiesen — als
Transparenz, nicht als Zuschlag.

### Formeln

```
opex(t)     = Betrag × (1 + g)^(t − Startjahr)      für Startjahr ≤ t ≤ Endjahr
cashflow(t) = Σ Investitionen mit Anfalljahr t + opex(t)
pnl(t)      = Σ Abschreibungsscheiben (A / L) in t + opex(t)
NPV         = Σ value(t) / (1 + r)^t
delta(t)    = onprem(t) − cloud(t)                  positiv = Cloud günstiger
```

## Architektur

```
src/
├─ domain/    Datenmodell, Formeln, Vergleich, Sensitivität, Schema — rein funktional
│  └─ presets/  Koeffiziententabelle, Quellen, Profil, Erzeugung
├─ state/     Store und Persistenz-Naht
├─ io/        JSON-Export/-Import, CSV-Export
├─ format/    de-DE-Formatierung und tolerantes Eingabeparsing
└─ ui/        Oberfläche
```

`src/domain/` importiert weder React noch sonst etwas aus dem übrigen Projekt.
Eine ESLint-Regel erzwingt das. Der Grund: Berechnung und Datenmodell sollen
später unverändert serverseitig weiterverwendbar sein.

### Nachrüstbarkeit von Login und zentraler Speicherung

Version 1 hat bewusst keine Benutzerverwaltung. Die Erweiterbarkeit hängt nicht
an der Framework-Wahl, sondern an einer definierten Naht in
`src/state/repository.ts`:

```ts
interface ProjectRepository {
  load(id?: string): Promise<Project | null>
  save(project: Project, id?: string): Promise<void>
  list(): Promise<ProjectSummary[]>
  clear(id?: string): Promise<void>
}
```

Heute existiert genau eine Implementierung (`LocalStorageProjectRepository`).
Kommen Login und Server hinzu, tritt eine `HttpProjectRepository` daneben —
Berechnung und Oberfläche bleiben unverändert, weil beide nur das Interface
kennen.

## Daten und Datenschutz

Alle Eingaben bleiben im Browser (`localStorage`). Es gibt keinen Server, keine
Registrierung und keine Übertragung von Eingaben. Gesichert wird über den
JSON-Export, der sich unverändert wieder importieren lässt; der Import prüft
gegen ein Schema und meldet Fehler im Klartext, statt halb zu laden.

Der CSV-Export ist für deutsches Excel aufbereitet (Semikolon-Trennung,
Komma-Dezimaltrennzeichen, UTF-8-BOM) und enthält neben den Ergebnissen auch
die Annahmen und die Rohdaten der Eingabe.

## Tests

`npm test` prüft die Berechnungslogik: Einzelformeln, Randfälle und ein
vollständig durchgerechnetes Referenzszenario als Golden Master
(`src/domain/__tests__/example.golden.test.ts`). Ändert eine Anpassung an der
Logik eines dieser Ergebnisse, schlägt der Test fehl und die Änderung muss
bewusst bestätigt werden.

Dazu kommen die Tests der Vorbefüllung: Erzeugung, die Zusammenführungsregel
über drei aufeinanderfolgende Generierungsläufe, die Migration von
Schema-Version 1 auf 2 und die Neutralitätsprüfung.

## Deployment

`npm run build` erzeugt ein statisches `dist/`, das auf jedem Webserver läuft.
Für Vercel, Netlify und Cloudflare Pages liegen `vercel.json` und
`netlify.toml` bei (Build-Befehl `npm run build`, Ausgabeverzeichnis `dist`).
Soll die App in einem Unterpfad laufen, wird beim Build `VITE_BASE` gesetzt:

```bash
VITE_BASE=/tco/ npm run build
```

## Bekannte Grenzen der Version 1

- Genau zwei Szenarien, kein Teilen per URL
- Die Koeffizienten sind recherchierte Größenordnungen, keine Projektdaten
- Kein Excel- und kein PDF-Export (JSON und CSV decken Sicherung und
  Weiterverarbeitung ab)
- Keine Dark-Mode-Variante
- Keine qualitativen Faktoren (Time-to-Market, Skalierbarkeit) — nur Freitext
