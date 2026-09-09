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
 * Was ein Block umfasst, in vorlesbarer Form.
 *
 * Bewusst als Fließtext und ohne Formularmarken: Die Texte landen im
 * Notizfeld und werden im Kundengespräch vorgelesen. Wo Verwechslungsgefahr
 * mit einem Nachbarblock besteht, wird sie benannt — Doppelzählungen sind
 * der häufigste Fehler beim Erfassen.
 */
export const BLOCK_GUIDANCE: Record<string, Guidance> = {
  compute: {
    onprem:
      'Die Server-Hardware für die Virtualisierung — Hosts mit Prozessoren, Arbeitsspeicher und lokalen Datenträgern, einschließlich der Reserve für den Ausfall eines Hosts. Speichersysteme und Netzwerk werden getrennt erfasst und haben eigene Blöcke.',
    cloud:
      'Die laufenden Kosten der Rechenleistung, also die Instanzen beziehungsweise virtuellen Maschinen samt zugesicherter Rabatte. Speicher und Datenverkehr stehen in eigenen Blöcken.',
  },
  database: {
    onprem:
      'Dedizierte Datenbankserver und die zugehörigen Lizenzen. Falls die Datenbanklizenzen bereits unter Lizenzen und Software stehen, gehören sie nicht ein zweites Mal hierher.',
    cloud:
      'Managed-Datenbankdienste. Der Aufschlag gegenüber einer selbst betriebenen Datenbank bezahlt Sicherung, Hochverfügbarkeit und Patching — also Arbeit, die dafür beim Personal wegfällt.',
  },
  storage: {
    onprem:
      'Speichersysteme mit Controllern und Redundanz. Entscheidend ist der Unterschied zwischen roher und nutzbarer Kapazität: Wer 120 Terabyte nutzen will, kauft deutlich mehr ein.',
    cloud:
      'Block- und Objektspeicher samt Snapshots. Die Speicherklasse bestimmt den Preis maßgeblich — selten muss alles auf der schnellsten Klasse liegen.',
  },
  network: {
    onprem:
      'Switching, Load Balancing und die laufende Anbindung ans Weitverkehrsnetz.',
    cloud:
      'Anbindung und Load Balancing, dazu der ausgehende Datenverkehr. Dieser Anteil wird regelmäßig unterschätzt, weil er erst im laufenden Betrieb sichtbar wird.',
  },
  backup: {
    both:
      'Sicherung und Wiederanlauf: Zweitkopie, Medien, Zweitstandort und die regelmäßigen Wiederherstellungstests. Der Primärspeicher steht im Block Storage.',
  },
  facility: {
    onprem:
      'Flächenumlage, Strom, Kühlung und unterbrechungsfreie Stromversorgung. Nur beim Betrieb im eigenen Rechenzentrum relevant.',
    cloud:
      'Bleibt bewusst leer. Fläche und Energie sind im Cloud-Preis bereits enthalten und stecken im Block Compute. Sie hier noch einmal zu erfassen, würde dieselben Kosten zweimal zählen.',
  },
  licenses: {
    onprem:
      'Virtualisierung, Betriebssysteme und Anwendungen. Seit der Übernahme von VMware durch Broadcom hat sich dieser Posten in vielen Häusern erheblich verschoben — er lohnt eine eigene Prüfung.',
    cloud:
      'Was an Lizenzen übrig bleibt. Ein Teil ist in den Diensten bereits enthalten, und genau dieser Teil ist die Einsparung gegenüber dem Eigenbetrieb.',
  },
  support: {
    onprem:
      'Wartungsverträge und Herstellersupport für die Hardware, üblicherweise ein Prozentsatz des Anschaffungswerts pro Jahr.',
    cloud: 'Der Supportvertrag des Plattformanbieters.',
  },
  staff: {
    both:
      'Der Betriebsaufwand in Vollkosten, nicht das Bruttogehalt — der Arbeitgeberanteil kommt mit rund einem Fünftel obendrauf.',
    onprem: 'Enthalten ist hier auch die Betreuung der Hardware.',
    cloud:
      'Die Hardwarebetreuung entfällt, dafür kommen Plattformsteuerung und Kostenkontrolle hinzu. Die Entlastung fällt in der Praxis geringer aus, als sie von Anbietern dargestellt wird.',
  },
  security: {
    both:
      'Security-Werkzeuge, Audits, Penetrationstests und Compliance-Nachweise. Ein höherer Regulierungsgrad im Profil hebt diesen Block an.',
  },
  migration: {
    onprem:
      'Bleibt leer: Wer im eigenen Rechenzentrum bleibt, hat keinen Umstellungsaufwand.',
    cloud:
      'Der Aufwand für die Umstellung selbst — Projektleitung, externe Unterstützung, Parallelbetrieb, Tests und Abnahmen. Dieser Block entscheidet maßgeblich darüber, ab wann sich der Wechsel rechnet.',
  },
  other: {
    both: 'Schulung, Enablement und alles Kleinteilige, das in keinen anderen Block passt.',
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
