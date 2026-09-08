import type { Project, ScenarioKey } from '../types'
import { createEmptyProject } from '../defaults'
import { applyGenerated } from './generate'
import { demoProfile } from './profile'

/**
 * Beispielszenario zum Kennenlernen.
 *
 * Zweck ist nicht die Rechnung, sondern das Verständnis: Wer den Rechner zum
 * ersten Mal öffnet, soll je Kostenblock sehen, **was dort überhaupt
 * hineingehört** und woran man erkennt, dass etwas im falschen Block steht.
 *
 * Die Zahlen entstehen aus demselben Demo-Profil und denselben Koeffizienten
 * wie die reguläre Vorbefüllung — dadurch kann das Beispiel nicht von der
 * Berechnung abdriften. Ergänzt wird lediglich je Block eine Erklärung, die
 * der Herleitung vorangestellt wird.
 */

interface Guidance {
  /** Gilt für beide Szenarien. */
  both?: string
  onprem?: string
  cloud?: string
}

/**
 * Was gehört in welchen Block.
 *
 * Bewusst auch formuliert, was **nicht** hineingehört — die häufigsten Fehler
 * beim Erfassen sind Doppelzählungen zwischen benachbarten Blöcken.
 */
export const BLOCK_GUIDANCE: Record<string, Guidance> = {
  compute: {
    onprem:
      'Hierher gehört: Server-Hardware für die Virtualisierung — Hosts, CPU, RAM, lokale Datenträger, Ausfallreserve. Nicht hierher: Speichersysteme und Netzwerk, dafür gibt es eigene Blöcke.',
    cloud:
      'Hierher gehört: laufende Kosten der Rechenleistung, also Instanzen bzw. VMs inklusive zugesicherter Rabatte. Nicht hierher: Speicher und Datenverkehr, die stehen in eigenen Blöcken.',
  },
  database: {
    onprem:
      'Hierher gehört: dedizierte Datenbankserver und Datenbanklizenzen, soweit sie nicht bereits unter „Lizenzen und Software" erfasst sind. Auf Doppelzählung achten.',
    cloud:
      'Hierher gehört: Managed-Datenbankdienste. Der Aufschlag gegenüber einer selbst betriebenen Datenbank ist der Preis für Backup, Hochverfügbarkeit und Patching — genau das entfällt dafür beim Personal.',
  },
  storage: {
    onprem:
      'Hierher gehört: Speichersysteme mit Controllern und Redundanz. Achtung auf den Unterschied zwischen roher und nutzbarer Kapazität — wer 120 TB nutzen will, kauft deutlich mehr.',
    cloud:
      'Hierher gehört: Block- und Objektspeicher inklusive Snapshots. Die Speicherklasse entscheidet stark über den Preis; nicht alles muss auf der schnellsten Klasse liegen.',
  },
  network: {
    both: 'Hierher gehört: Switching, Anbindung, Load Balancing.',
    onprem: 'Zusätzlich die laufende WAN-Anbindung.',
    cloud:
      'Zusätzlich der ausgehende Datenverkehr (Egress) — in Cloud-Rechnungen regelmäßig unterschätzt, weil er erst im Betrieb sichtbar wird.',
  },
  backup: {
    both:
      'Hierher gehört: Sicherung und Wiederanlauf — Zweitkopie, Medien, Zweitstandort, Wiederherstellungstests. Nicht hierher: der Primärspeicher.',
  },
  facility: {
    onprem:
      'Hierher gehört: Flächenumlage, Strom, Kühlung, USV. Nur beim Eigenbetrieb relevant.',
    cloud:
      'In der Cloud und beim externen Hoster stecken diese Kosten im Servicepreis. Hier etwas einzutragen würde sie doppelt zählen — deshalb bleibt der Block leer.',
  },
  licenses: {
    onprem:
      'Hierher gehört: Virtualisierung, Betriebssysteme, Anwendungen. Der Posten hat sich seit der Broadcom-Übernahme von VMware bei vielen Häusern deutlich verschoben und lohnt eine eigene Prüfung.',
    cloud:
      'Hierher gehört: was an Lizenzen übrig bleibt. Ein Teil ist in den Diensten enthalten — genau dieser Teil ist die Einsparung gegenüber dem Eigenbetrieb.',
  },
  support: {
    onprem:
      'Hierher gehört: Hardware-Wartungsverträge und Herstellersupport, üblicherweise als Prozentsatz des Anschaffungswerts pro Jahr.',
    cloud: 'Hierher gehört: der Supportvertrag des Plattformanbieters.',
  },
  staff: {
    both:
      'Hierher gehört: der Betriebsaufwand in Vollkosten, nicht das Bruttogehalt. Rund ein Fünftel Arbeitgeberanteil kommt auf das Gehalt obendrauf.',
    onprem: 'Enthält die Hardwarebetreuung, die in der Cloud entfällt.',
    cloud:
      'Hardwarebetreuung entfällt, Plattformsteuerung und Kostenkontrolle kommen hinzu. Die Entlastung fällt in der Praxis geringer aus, als Anbieter sie darstellen.',
  },
  security: {
    both:
      'Hierher gehört: Security-Werkzeuge, Audits, Penetrationstests, Compliance-Nachweise. Der Regulierungsgrad im Profil hebt diesen Block an.',
  },
  migration: {
    onprem:
      'Beim Weiterbetrieb fällt kein Migrationsaufwand an — deshalb bleibt der Block hier leer.',
    cloud:
      'Hierher gehört: der Aufwand für die Umstellung selbst — Projektleitung, externe Unterstützung, Parallelbetrieb, Tests, Abnahmen. Dieser Block entscheidet maßgeblich über den Break-even.',
  },
  other: {
    both: 'Hierher gehört: Schulung, Enablement und alles Kleinteilige, das sonst nirgends passt.',
  },
}

function guidanceFor(blockId: string, scenario: ScenarioKey): string {
  const g = BLOCK_GUIDANCE[blockId]
  if (!g) return ''
  const specific = scenario === 'onprem' ? g.onprem : g.cloud
  return [g.both, specific].filter(Boolean).join(' ')
}

/**
 * Erzeugt das Beispielszenario: Zahlen aus dem Demo-Profil, ergänzt um die
 * Erklärung je Block.
 */
export function createExampleProject(): Project {
  const project = applyGenerated(createEmptyProject(), demoProfile())

  project.meta.title = 'Beispiel: Hardware-Refresh gegen Migration in die Public Cloud'
  project.meta.notes =
    'Beispieldaten zum Kennenlernen. Die bestehende Serverlandschaft erreicht in Jahr 3 das ' +
    'Ende der Nutzungsdauer; verglichen wird die Ersatzinvestition mit einer Migration in die ' +
    'Public Cloud. Jeder Block trägt in der Notiz eine Erklärung, was dort hineingehört.'

  project.scenarios.onprem.notes =
    'Weiterbetrieb im eigenen Rechenzentrum mit Ersatzinvestition zum Ende der Nutzungsdauer.'
  project.scenarios.cloud.notes =
    'Migration in die Public Cloud mit einmaligem Umstellungsaufwand im ersten Jahr.'

  for (const scenario of ['onprem', 'cloud'] as ScenarioKey[]) {
    for (const block of project.blocks) {
      const entry = project.scenarios[scenario].entries[block.id]
      if (!entry) continue
      const guidance = guidanceFor(block.id, scenario)
      if (!guidance) continue
      // Erklärung vor die Herleitung setzen; die Herleitung bleibt erhalten.
      entry.note = entry.note ? `${guidance}\n\n${entry.note}` : guidance
    }
  }

  return project
}
