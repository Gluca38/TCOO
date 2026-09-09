# TCO-Rechner — Briefing für eine neue Sitzung

Vergleicht die Gesamtkosten einer IT-Landschaft über einen konfigurierbaren
Zeitraum: On-Premises gegen Public Cloud. Nutzer ist ein Berater, der das
Werkzeug **im Kundengespräch** einsetzt.

## Absprachen mit dem Nutzer

**Kein Push ohne ausdrückliche Freigabe.** Jeder Push auf den Branch löst ein
automatisches Deployment aus — der Push *ist* die Live-Änderung. Lokal
arbeiten, testen, zeigen, warten. Auch bei Kleinigkeiten wie Tippfehlern oder
Dokumentation: immer fragen.

Ohne Rückfrage erlaubt: lesen, bauen, testen, Screenshots, lokale Dateien
ändern, committen.

**Sprache:** Deutsch, auch in Code-Kommentaren und Commit-Nachrichten.

## Wo was liegt

| | |
|---|---|
| Repository | `Gluca38/TCOO`, Branch `claude/tco-calculator-webapp-nps1ww` (zugleich Default-Branch) |
| Live | https://tco-rechner-mu.vercel.app — Vercel-Projekt `tco-rechner`, deployt automatisch bei jedem Push |
| Privates Testartefakt | https://claude.ai/code/artifact/3ba09c55-407f-463b-95f6-03e0eeb4050f |

Das GitHub-Repo ist **öffentlich**. Die Vercel-Seite ist ohne Login
erreichbar (Production öffentlich, Preview-Deployments geschützt) — das ist
so gewollt.

## Grundprinzip, das nicht verhandelbar ist

Der Rechner kalkuliert **nicht bottom-up**. Kein Preiskatalog, keine Flavors,
keine Stücklisten. Je Kostenblock wird ein kumulierter Betrag eingetragen.
Der Wert liegt in Struktur, zeitlicher Verteilung und methodisch sauberer
Auswertung — nicht im Ermitteln von Preisen.

**Jede Ergebniszahl muss bis auf die Eingaben aufschlüsselbar sein.** Es gibt
keine Zuschläge und keine Annahmen im Code, die nicht im UI sichtbar sind.
Ein Klick auf jede Zelle der Jahrestabelle zeigt die vollständige Rechenkette.
Wer hier etwas hinzufügt, macht es sichtbar oder lässt es.

## Methodische Festlegungen

Diese sind entschieden. Nicht neu aufrollen, ohne dass der Nutzer es verlangt.

| Thema | Festlegung |
|---|---|
| Zeitraster | Jahresscharf, keine Monatslogik |
| Eingabetiefe | Genau eine CapEx- und eine OpEx-Zeile je Block und Szenario |
| Szenarien | Fix zwei; Datenmodell wäre für mehr offen, UI nicht |
| OpEx-Betrag | Wert im **Startjahr der Position**; Steigerung wirkt ab da |
| CapEx-Betrag | Nominal im Anfalljahr, **nie indexiert**, auch Wiederholungen nicht |
| Abschreibung | Linear, volle Jahresscheiben ab Anfalljahr |
| Diskontierung | Jahresende, erstes Jahr `t = 1`, nominaler Satz |
| Barwert | Nur auf die Cashflow-Sicht anwendbar |
| Restwerte | Keine. Keine Altbestände, keine Sunk Costs, keine kalkulatorischen Zinsen |
| Break-even | Vorzeichenwechsel der kumulierten Differenz, linear interpoliert |
| Sensitivität | Bandbreite je Position aus dem Herkunftsstatus; Regler ist Multiplikator |
| Vorzeichen | Positive Differenz heißt: Cloud günstiger |

**P&L-Summe ≠ Cashflow-Summe** ist gewollt: Abschreibungsscheiben hinter dem
Zeitraumende fallen aus der P&L-Summe. Der Betrag wird als *nicht erfasste
Restabschreibung* ausgewiesen — Transparenz, kein Zuschlag.

## Herkunft je Position

Jede Betragszeile trägt `origin`: `estimated` · `adjusted` · `confirmed`.

**Die zentrale Regel:** Ein erneutes Generieren aus dem Profil überschreibt
ausschließlich `estimated`. Angepasste und kundenbestätigte Werte bleiben
unangetastet, ebenso selbst geschriebene Notizen (`noteOrigin: 'manual'`).
Diese Regel ist der Kern der Vorbefüllung — sie hatte schon ein Loch
(abgewählte Zeilen kamen zurück) und ist jetzt durch Tests abgesichert.

Der Herkunftsstatus steuert zugleich die Bandbreite im Tornado:
geschätzt ±35 %, angepasst ±15 %, kundenbestätigt ±5 %.

## Architektur

```
src/
├─ domain/     Datenmodell, Formeln, Vergleich, Sensitivität, Schema
│  └─ presets/ Koeffiziententabelle, Quellen, Profil, Erzeugung, Beispiel
├─ state/      Store und Persistenz-Naht (ProjectRepository)
├─ io/         JSON-Export/-Import, CSV-Export
├─ format/     de-DE-Formatierung, tolerantes Eingabeparsing
└─ ui/
```

`src/domain/` importiert **kein React** und nichts aus dem übrigen `src/`.
Eine ESLint-Regel erzwingt das. Grund: Berechnung und Datenmodell sollen
später unverändert serverseitig laufen können, falls Login dazukommt. Die
Naht dafür ist `src/state/repository.ts`.

## Koeffizienten und Quellen

`src/domain/presets/coefficients.ts` ist eine **reine Datentabelle ohne
Logik**, mit Kommentar und Belastbarkeitsangabe hinter jedem Wert. Die
Quellenlage steht in `src/domain/presets/SOURCES.md`.

Es sind **recherchierte Größenordnungen für den deutschen Markt, keine
Angebotspreise**. Zwei Werte sind besonders schwach belegt und bewegen das
Ergebnis am stärksten: **VMs je Host** und **VMs je Vollzeitkraft** — die
auffindbaren Studien stammen aus 2009–2011 und streuen um den Faktor 10.
Beide sind im Profildialog überschreibbar.

Beim Schreiben von Notiztexten: **keine erfundenen Quellenangaben.** Kein
Textbaustein darf „Branchenmedian" oder „Erfahrungswert" behaupten. Keine
Dateinamen im Text — die Notizen werden im Kundengespräch vorgelesen.

## Fallstricke, die schon zugeschlagen haben

**Keine nativen Browserdialoge.** `confirm`, `prompt` und `alert` sind im
eingebetteten Betrieb blockiert und liefern lautlos `false`/`null` — der
Knopf wirkt kaputt. Ein Test durchsucht den Quelltext darauf.

**Beim Testen keine Dialoge automatisch bestätigen.** Genau das hat den
obigen Fehler verdeckt: Das Testskript hatte einen Dialog-Handler und lief an
der Fehlerbedingung vorbei.

**Nach dem Push die Live-Seite mit Cache-Buster prüfen.** Der erste Abruf
liefert sonst aus dem CDN-Cache das alte Bundle. Vergleich: Bundle-Hash in
`dist/assets/` gegen den im ausgelieferten HTML.

**Export funktioniert im Artefakt nicht.** Downloads sind dort blockiert.
JSON und CSV nur auf der Vercel-Seite oder lokal testen.

## Prüfen

```bash
npm test          # 117 Tests
npm run build
npx eslint .
npm run dev       # lokal ansehen
```

Die Testlandschaft, nach Zweck:

- `domain/__tests__/invariants.test.ts` — Eigenschaften über 60 zufällig
  erzeugte Projekte. **Schlägt bei Formeländerungen als Erstes an.**
- `domain/__tests__/example.golden.test.ts` — durchgerechnetes Referenz­szenario,
  friert die Rechenmaschine ein
- `presets/__tests__/neutrality.test.ts` — Fälle, in denen On-Premises
  gewinnen muss, und solche für die Cloud. **Bei Fehlschlag sind die
  Koeffizienten schief — nicht die Schwelle anpassen, sondern berichten.**
- `presets/__tests__/generate.test.ts` — Erzeugung und Zusammenführungsregel
- `ui/__tests__/noNativeDialogs.test.ts` — siehe Fallstricke

Bei UI-Änderungen zusätzlich die laufende App ansehen, nicht nur Tests.
Chromium liegt unter `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`;
Playwright ist keine Abhängigkeit des Projekts und wird bei Bedarf
installiert und danach wieder entfernt.

## Nicht enthalten

Kein Login, kein Backend, kein Teilen per URL, kein Excel- und kein
PDF-Export, kein Dark Mode, keine qualitativen Faktoren wie Time-to-Market.
Alle Eingaben bleiben im Browser des Besuchers.
