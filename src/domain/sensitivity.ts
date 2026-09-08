import type { CapexLine, CostView, OpexLine, Origin, Project, ScenarioKey } from './types'
import { compare } from './compare'

/**
 * Sensitivitätsanalyse auf Basis der Datenherkunft.
 *
 * Eine einheitliche Variation von ±20 % über alle Blöcke trägt keine
 * Information: die Balkenlänge wäre immer proportional zum Blockwert und
 * wiederholte nur die Tabelle. Stattdessen leitet sich die Bandbreite aus dem
 * Herkunftsstatus ab — geschätzte Positionen wackeln stark, kundenbestätigte
 * kaum.
 *
 * Damit beantwortet der Tornado die eigentlich interessante Frage: **welche
 * Daten sollte der Kunde als Nächstes liefern?**
 */

/** Bandbreite je Herkunft, als Dezimalzahl (0.35 = ±35 %). */
export const DEFAULT_UNCERTAINTY: Record<Origin, number> = {
  /** Aus wenigen Profilmerkmalen hochgerechnet — entsprechend unsicher. */
  estimated: 0.35,
  /** Vom Berater angepasst, aber nicht belegt. */
  adjusted: 0.15,
  /** Vom Kunden bestätigt. Restunsicherheit bleibt, ist aber klein. */
  confirmed: 0.05,
}

/** Bandbreite einer Position. Ein eigener Wert schlägt den Default. */
export function uncertaintyOf(line: CapexLine | OpexLine | null | undefined): number {
  if (!line || !line.active) return 0
  return line.uncertainty ?? DEFAULT_UNCERTAINTY[line.origin]
}

export interface TornadoEntry {
  scenario: ScenarioKey
  scenarioName: string
  blockId: string
  blockName: string
  /** Gesamtdifferenz, wenn dieser Block am unteren Rand seiner Bandbreite liegt. */
  low: number
  /** Gesamtdifferenz am oberen Rand. */
  high: number
  /** Größter Ausschlag gegenüber dem Ausgangswert. Sortierkriterium. */
  swing: number
  /** Wirksame Bandbreite des Blocks, für die Beschriftung. */
  uncertainty: number
  /** Schwächster Herkunftsstatus im Block — bestimmt die Bandbreite. */
  origin: Origin
}

/**
 * Skaliert die Beträge eines Blocks.
 *
 * CapEx- und OpEx-Zeile werden mit ihrer je eigenen Bandbreite variiert, denn
 * eine Investition kann bestätigt sein, während der laufende Aufwand noch
 * geschätzt ist.
 */
function variedProject(
  project: Project,
  scenario: ScenarioKey,
  blockId: string,
  direction: -1 | 1,
  multiplier: number,
): Project {
  const clone: Project = structuredClone(project)
  const entry = clone.scenarios[scenario].entries[blockId]
  if (!entry) return clone

  if (entry.capex) {
    entry.capex.amount *= 1 + direction * uncertaintyOf(entry.capex) * multiplier
  }
  if (entry.opex) {
    entry.opex.amount *= 1 + direction * uncertaintyOf(entry.opex) * multiplier
  }
  return clone
}

/** Rangfolge der Herkunftsstati von unsicher nach sicher. */
const ORIGIN_RANK: Record<Origin, number> = { estimated: 0, adjusted: 1, confirmed: 2 }

function weakestOrigin(capex: CapexLine | null, opex: OpexLine | null): Origin {
  const active = [capex, opex].filter((l) => l?.active) as Array<CapexLine | OpexLine>
  if (active.length === 0) return 'estimated'
  return active.reduce<Origin>(
    (weakest, line) => (ORIGIN_RANK[line.origin] < ORIGIN_RANK[weakest] ? line.origin : weakest),
    'confirmed',
  )
}

/**
 * Tornado-Analyse.
 *
 * @param multiplier Globaler Regler. 1,0 = die Bandbreiten aus dem
 *   Herkunftsstatus, 2,0 = doppelt so breit. Er skaliert die Bandbreiten,
 *   ersetzt sie nicht.
 */
export function tornado(
  project: Project,
  view: CostView,
  multiplier = 1,
  topN = 5,
): { base: number; entries: TornadoEntry[] } {
  const baseResult = compare(project, view)
  const base = baseResult.delta
  const entries: TornadoEntry[] = []

  for (const scenario of ['onprem', 'cloud'] as ScenarioKey[]) {
    const series = scenario === 'onprem' ? baseResult.onprem : baseResult.cloud

    for (const block of project.blocks) {
      if (!block.enabled) continue
      const blockSum = (series.byBlock[block.id] ?? []).reduce((a, b) => a + b, 0)
      if (blockSum === 0) continue

      const entry = project.scenarios[scenario].entries[block.id]
      if (!entry) continue

      const spread = Math.max(uncertaintyOf(entry.capex), uncertaintyOf(entry.opex))
      if (spread === 0) continue

      const low = compare(variedProject(project, scenario, block.id, -1, multiplier), view).delta
      const high = compare(variedProject(project, scenario, block.id, 1, multiplier), view).delta

      entries.push({
        scenario,
        scenarioName: project.scenarios[scenario].name,
        blockId: block.id,
        blockName: block.name,
        low,
        high,
        swing: Math.max(Math.abs(low - base), Math.abs(high - base)),
        uncertainty: spread * multiplier,
        origin: weakestOrigin(entry.capex, entry.opex),
      })
    }
  }

  entries.sort((a, b) => b.swing - a.swing)
  return { base, entries: entries.slice(0, topN) }
}

/**
 * Erzeugt eine Projektvariante mit geändertem Diskontsatz und/oder Laufzeit.
 * Grundlage der Schieberegler in der Sensitivitätsansicht.
 */
export function withParameters(
  project: Project,
  overrides: { discountRate?: number; horizonYears?: number },
): Project {
  const clone: Project = structuredClone(project)
  if (overrides.discountRate !== undefined) clone.settings.discountRate = overrides.discountRate
  if (overrides.horizonYears !== undefined) clone.settings.horizonYears = overrides.horizonYears
  return clone
}
