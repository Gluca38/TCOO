# Quellen und Herleitung der Koeffizienten

Diese Datei dokumentiert, woher jeder Wert in `coefficients.ts` stammt.
Sie ist der Prüfpfad für jede erzeugte Zahl.

**Stand der Recherche: 8. September 2026**

## Wie diese Werte einzuordnen sind

Die Koeffizienten sind **recherchierte Größenordnungen für den deutschen
Markt**, keine Angebotspreise und keine Median-Werte aus einer
Projektdatenbank. Sie dienen dazu, im Erstgespräch aus wenigen Merkmalen ein
plausibles Szenario zu erzeugen — als Gesprächsgrundlage, nicht als Ergebnis.

Sie sind ausdrücklich dafür gedacht, gegen echte Projektdaten ausgetauscht zu
werden.

### Einschränkung der Recherche

Die Recherche erfolgte **über Websuche**. Die Primärdokumente (BDEW-Analyse,
Bitkom-Studien, Hersteller-Preislisten) konnten wegen der Netzwerkrichtlinie
der Arbeitsumgebung **nicht selbst geöffnet und gegengelesen** werden. Die
Werte beruhen auf den Zusammenfassungen und Zitaten, welche die Suche
zurückgeliefert hat. Wo unten „gut" steht, heißt das: mehrere unabhängige
Treffer nannten übereinstimmende Größenordnungen — nicht: im Original geprüft.

### Unsicherheitsklassen

| Klasse | Bedeutung |
|---|---|
| **gut** | Mehrere übereinstimmende Treffer, aktuelle Quellen, enge Spanne |
| **mittel** | Belastbare Quelle, aber Listenpreis statt Einkauf, oder breite Spanne |
| **schwach** | Veraltete Quellen, Streuung über eine Größenordnung, oder Modellannahme ohne belegte Quelle |

Umrechnung USD → EUR: **0,92 €/$** (Größenordnung September 2026).

---

## 1. Energie und Rechenzentrum

### Industriestrompreis Deutschland

- **Wert: 16,0 ct/kWh** für Jahresverbrauch 160.000 kWh – 20 Mio. kWh
- Quelle: BDEW-Strompreisanalyse Januar 2026, über Websuche referenziert
  (https://www.bdew.de/media/documents/BDEW_Strompreisanalyse_012026_1.pdf)
- Kontext: Neuvertragspreise, Rückgang um 1,6 ct/kWh gegenüber Vorjahr
- **Unsicherheit: gut** — mehrere Treffer nannten denselben Wert.
  Spanne je nach Abnahmemenge und Entlastungen 15–25 ct/kWh.

### PUE deutscher Rechenzentren

- **Wert: 1,39** (Durchschnitt)
- Quelle: über Websuche referenziert, u. a.
  https://www.serverroom-security.com/blog/rechenzentrum-effizienz-verbessern-2026
  im Umfeld der Bitkom-Erhebungen zu deutschen Rechenzentren
  (https://www.bitkom.org/Presse/Presseinformation/Deutsche-Rechenzentren-Wachstum-Effizienz)
- **Unsicherheit: gut** — konsistent mit dem in der Branche genannten Bereich
  1,3–1,5 für Bestandsrechenzentren.

### Colocation

- **Wert: 200–800 €/Rack/Monat**, verwendet: **500 €** (Mitte)
- **Strom separat: 0,38–0,55 €/kWh**, verwendet: **0,45 €/kWh**
- Quellen (Anbieterpreise, über Websuche):
  - https://www.telemaxx.de/services/rechenzentrum/colocation/server-rack-cage-hoeheneinheit-kosten
  - https://www.centron.de/pricing/colocation
  - https://www.telehouse-rechenzentrum.de/blog/was-kostet-colocation-in-deutschland-pro-rack/
- Wichtig: Der Colocation-Strompreis ist ein **Weiterverkaufspreis inklusive
  Kühlung und USV**. Auf ihn darf der PUE **nicht** zusätzlich angewandt
  werden — das wäre Doppelzählung.
- **Unsicherheit: gut** für die Spanne, **mittel** für den gewählten Mittelwert
  (starke Standortabhängigkeit: Frankfurt am oberen Rand).

### Leistungsaufnahme je Virtualisierungshost

- **Wert: 450 W** — **Modellannahme, keine belegte Quelle**
- Anhaltspunkt aus der Recherche: 2–6 kWh je Rack sowie 500–1.500 W/m²
  (IBM-Untersuchung, über Websuche referenziert)
- **Unsicherheit: schwach.** Der tatsächliche Wert hängt von Sockelzahl,
  Bestückung und Auslastung ab und schwankt zwischen etwa 250 und 800 W.

**Hergeleitet, eigenes Rechenzentrum:**

```
450 W × PUE 1,39            = 625,5 W an der Steckdose
× 8.760 h / 1.000           = 5.479 kWh je Host und Jahr
× 0,16 €/kWh                = 877 € Strom je Host und Jahr
+ Fläche, USV, Klima, Bau   = 600 € (Modellannahme, schwach)
                            ≈ 1.480 € je Host und Jahr
```

**Hergeleitet, Colocation:**

```
450 W × 8.760 h / 1.000     = 3.942 kWh je Host und Jahr (ohne PUE, s. o.)
× 0,45 €/kWh                = 1.774 € Strom je Host und Jahr
+ Rackanteil 6.000 €/Jahr ÷ 15 Hosts = 400 €
                            ≈ 2.170 € je Host und Jahr
```

Dass Colocation je Host teurer herauskommt als das eigene Rechenzentrum, ist
kein Fehler: Der Colocation-Strompreis enthält die Marge des Betreibers,
während beim eigenen Rechenzentrum Gebäudekapital und Abschreibung der
Infrastruktur hier nur pauschal mit 600 € angesetzt sind. Wer die Gebäudeseite
vollständig ansetzt, kommt anders heraus — deshalb ist dieser Wert im Tool
überschreibbar.

**Externer Hoster: 0 €** — die Kosten stecken dann in der Hosting-Rechnung
und gehören in den Block Compute, nicht hierher.

---

## 2. Serverhardware

- **Wert: 18.000 € je Host** (2 Sockel, Rack, inkl. RAM und lokalen Medien)
- Quelle: Dell PowerEdge Listenpreise Deutschland, über Websuche
  (https://www.dell.com/de-de/shop/poweredge-server/sr/servers/2-sockel)
  - PowerEdge R760XS: 14.543 €
  - PowerEdge R7715: 22.478 €
  - PowerEdge R770: 30.135 €
- **Unsicherheit: mittel.** Das sind **Listenpreise**. Im Enterprise-Einkauf
  liegen die tatsächlichen Preise erfahrungsgemäß deutlich darunter, wie weit,
  ist ohne Angebot nicht belegbar. Der gewählte Wert liegt bewusst im unteren
  Drittel der Liste.

---

## 3. Konsolidierung und Personal — die zwei schwächsten Werte

Diese beiden Größen übersetzen die vom Kunden genannte VM-Zahl überhaupt erst
in Kosten. Sie sind damit die stärksten Hebel im Modell **und** die am
schlechtesten belegten. Beide sind deshalb im Profildialog überschreibbar.

### VMs je Host

- **Verwendet: 20** — **Modellannahme**
- Belegte Spanne: 3:1 bis 15:1, je nach Reifegrad
  (https://en.wikipedia.org/wiki/Consolidation_ratio,
  EMA-Erhebung 2009 über https://www.networkworld.com/article/839344/,
  https://www.computerworld.com/article/1706586/)
- **Warum über der belegten Spanne:** Die zugrunde liegenden Erhebungen
  stammen aus 2009–2011. Die Kernzahl je Sockel ist seither um ein Vielfaches
  gestiegen. Ein Wert am oberen Rand der alten Spanne wäre für heutige
  Hardware zu niedrig und würde die Hostzahl und damit die On-Prem-Kosten
  künstlich aufblähen.
- **Unsicherheit: schwach.** Dies ist eine begründete Annahme, keine
  recherchierte Zahl. Realistisch sind je nach Last 10 bis 40.

### VMs je Vollzeitkraft

- **Verwendet: 80** — **Modellannahme**
- Belegte Spanne: 50:1 bis 500:1 für virtuelle Server, 10:1 bis 50:1 physisch
  (Gartner-Zitat über https://itbenchmark.wordpress.com/2011/03/18/virtualization-and-adminserver-ratio/,
  https://softpanorama.org/Admin/number_of_servers_per_sysadmin.shtml)
- **Unsicherheit: schwach.** Streuung um eine ganze Größenordnung, Quellen aus
  2011. Der gewählte Wert liegt im unteren Bereich, weil die Spitzenwerte
  hochstandardisierte, homogene Umgebungen voraussetzen.

### Personalkosten je Vollzeitkraft

- **Wert: 67.000 € Vollkosten je Jahr**
- Bruttogehalt Systemadministrator Deutschland: 53.600–55.000 €
  (https://www.stepstone.de/gehalt/Systemadministrator-in.html,
  https://www.jobvector.de/gehalt/systemadministrator/)
- Hergeleitet: 55.000 € × 1,21 (Arbeitgeberanteil Sozialversicherung
  ca. 21 %) ≈ 66.550 € → gerundet 67.000 €
- **Unsicherheit: gut** für das Bruttogehalt, **mittel** für die Vollkosten —
  Arbeitsplatzkosten, Weiterbildung und Overhead sind nicht enthalten.

### Personalbedarf in der Cloud

- **Verwendet: Faktor 0,75** gegenüber On-Premises
- **Modellannahme, keine belegte Quelle.** Hardwarebetreuung entfällt,
  Plattformsteuerung und FinOps kommen hinzu.
- **Unsicherheit: schwach.** Der Wert ist bewusst konservativ gewählt: Eine
  stärkere Entlastung wird von Anbietern regelmäßig behauptet, ist aber
  öffentlich nicht belastbar belegt. Ein zu niedriger Faktor würde das
  Ergebnis systematisch zugunsten der Cloud verzerren.

---

## 4. Lizenzen

### Virtualisierung

- **Wert: 157 €/Core/Jahr**, bei 32 Cores je Host ≈ **5.000 €/Host/Jahr**
- Quelle: VMware vSphere Foundation (VVF) Marktpreise 150–190 $/Core/Jahr;
  VCF-Listenpreis 350–400 $/Core/Jahr, im Enterprise-Abschluss effektiv
  100–130 $/Core/Jahr
  (https://redresscompliance.com/vmware-vcf-pricing-2026,
  https://focus.sva.de/datacenter-infrastruktur/vmware-by-broadcom-2026/,
  https://www.clouditiv.de/blog/vmware-lizenzkosten-2026-broadcom-aenderungen)
- **Unsicherheit: mittel.** Die Preisgestaltung ist seit der
  Broadcom-Übernahme stark in Bewegung; einzelne dokumentierte Fälle zeigen
  Vervierfachungen bei Vertragsverlängerung. Wer VMware ersetzt hat, muss
  diesen Wert zwingend anpassen.

### Betriebssystem und Anwendungen

- **Wert: 250 €/VM/Jahr** — **Modellannahme**
- **Unsicherheit: schwach.** Hängt vollständig vom Lizenzmix ab
  (Windows Datacenter, Linux-Subskriptionen, Datenbanklizenzen) und streut
  zwischen nahe null und mehreren Tausend Euro je VM.
- In der Cloud um **Faktor 0,6** angesetzt, weil ein Teil der Lizenzen in den
  Diensten enthalten ist — ebenfalls eine Annahme.

---

## 5. Storage

### On-Premises

- **Wert: 900 €/TB nutzbar**, Anschaffung, Nutzungsdauer 5 Jahre
- Anhaltspunkte: NetApp ASA Listenpreise 120–240 $/TB, im Enterprise-Rabatt
  effektiv 55–130 $/TB für die reine Kapazität; Enterprise-NVMe 300–1.172 $/TB
  (https://vendorbenchmark.com/blog/enterprise-storage-per-tb-pricing-benchmark,
  https://www.verge.io/blog/storage/all-flash-array-cost-2026/,
  https://pcserverandparts.com/news/enterprise-ssd-prices-2026-server-storage-buying-guide/)
- Der gewählte Wert liegt über den reinen Medienpreisen, weil Controller,
  Redundanz, Gehäuse und Erstsupport enthalten sind.
- **Unsicherheit: schwach — und derzeit besonders volatil.** Die Quellen
  berichten für 2025/2026 Steigerungen der Vorproduktkosten um 300–900 %
  durch die KI-getriebene NAND- und DRAM-Nachfrage; ein Modell nennt eine
  Vervierfachung der Drei-Jahres-TCO binnen eines Jahres. **Dieser Wert
  veraltet schneller als alle anderen.**

### Cloud

- **Wert: 1.100 €/TB/Jahr**
- Hergeleitet aus Block-Storage-Preisen: AWS gp3 0,0928 $/GB/Monat,
  Azure Elastic SAN / Premium SSD v2 vergleichbar
  (https://www.aws.eu/ebs/pricing/,
  https://www.finout.io/blog/cloud-storage-pricing-comparison)
  → 0,0928 $ × 0,92 = 0,0854 € /GB/Monat → 87,4 €/TB/Monat → 1.049 €/TB/Jahr
  → aufgerundet auf 1.100 € für Snapshots und Grundsicherung
- **Unsicherheit: mittel.** Region und Leistungsklasse verändern den Wert
  erheblich; Archivklassen liegen um eine Größenordnung darunter.

### Storage je VM

- **Wert: 0,8 TB/VM** — **Modellannahme**, wird nur verwendet, wenn im Profil
  keine TB-Zahl angegeben ist.
- **Unsicherheit: schwach.**

---

## 6. Cloud-Compute

- **Wert: 1.320 €/VM/Jahr** (110 €/Monat)
- Anhaltspunkt: 4 vCPU / 16 GB RAM on demand ≈ 137 €/Monat
  (abgeleitet aus einem EKS-Beispiel mit 3 Knoten m5.xlarge zu ~410 €/Monat,
  https://bfg-it.de/kubernetes-kosten-2026-eks-aks-gke-pricing/)
- Der Ansatz liegt darunter, weil eine durchschnittliche VM kleiner ist als
  4 vCPU und Reservierungen üblich sind.
- **Unsicherheit: mittel.** Die Annahme einer durchschnittlichen VM-Größe ist
  der schwache Teil; Reservierungsrabatte von 30–40 % sind marktüblich, aber
  vertragsabhängig.
- Für die Open Telekom Cloud konnten über die Websuche **keine belastbaren
  Stückpreise** ermittelt werden; die Preisseiten waren nicht abrufbar. Der
  Wert stammt daher aus dem allgemeinen Hyperscaler-Niveau.

---

## 7. Übrige Blöcke

Für die folgenden Blöcke ließen sich keine belastbaren öffentlichen
Größenordnungen für den deutschen Markt finden. Die Werte sind **begründete
Modellannahmen** und als solche in `coefficients.ts` gekennzeichnet.
Unsicherheit durchgehend **schwach**:

| Block | Ansatz | Begründung |
|---|---|---|
| Datenbankservices | 15 % des Compute-Werts | Datenbanken laufen typischerweise auf einem Teil der Umgebung; in der Cloud höher wegen Managed-Service-Aufschlag |
| Netzwerk | 220 €/VM/Jahr on-prem · in der Cloud zusätzlich Egress-Anteil | Switching, Anbindung, Load Balancing |
| Backup / DR | 12 % des Storage-Werts | Zweitkopie, Medien, Zweitstandort |
| Wartung und Support | 12 % des Hardware-CapEx je Jahr | Übliche Größenordnung für Herstellersupport |
| Security & Compliance | 180 €/VM/Jahr, Aufschlag je Regulierungsgrad | Werkzeuge, Audits, Penetrationstests |
| Migration | 900 €/VM einmalig, Aufschlag je Regulierungsgrad | Nur im Cloud-Szenario |
| Sonstiges | 150 €/VM/Jahr | Schulung, Kleinteiliges |

Die Aufschläge je Regulierungsgrad (Standard 1,0 · erhöht 1,4 · stark
reguliert 2,0 für Security; 1,0 · 1,15 · 1,35 für Personal) sind ebenfalls
Modellannahmen ohne belegte Quelle.

---

## Was als Nächstes ersetzt werden sollte

Nach Wirkung auf das Ergebnis sortiert:

1. **VMs je Host** und **VMs je Vollzeitkraft** — größter Hebel, schwächste Beleglage
2. **Storage-Preis On-Premises** — derzeit extrem volatil
3. **Serverpreis je Host** — Listenpreis durch echte Angebotspreise ersetzen
4. **Cloud-Compute je VM** — durch ein konkretes Angebot ersetzen
5. **Personalfaktor Cloud** — der am schwersten belegbare Vorteil überhaupt
