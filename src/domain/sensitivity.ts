import type { CostView, Project, ScenarioKey } from './types'
import { compare } from './compare'

export interface TornadoEntry {
  scenario: ScenarioKey
  scenarioName: string
  blockId: string
  blockName: string
  /** Gesamtdifferenz (On-Prem − Cloud), wenn dieser Block um −pct variiert. */
  low: number
  /** Gesamtdifferenz, wenn dieser Block um +pct variiert. */
  high: number
  /** Größter Ausschlag gegenüber dem Ausgangswert. Sortierkriterium. */
  swing: number
}

/** Skaliert alle Beträge eines Blocks in einem Szenario. */
function scaledProject(
  project: Project,
  scenario: ScenarioKey,
  blockId: string,
  factor: number,
): Project {
  const clone: Project = structuredClone(project)
  const entry = clone.scenarios[scenario].entries[blockId]
  if (!entry) return clone
  if (entry.capex) entry.capex.amount *= factor
  if (entry.opex) entry.opex.amount *= factor
  return clone
}

/**
 * Tornado-Analyse: variiert jeden Block je Szenario um ±pct und misst die
 * Wirkung auf die Gesamtdifferenz.
 *
 * Es werden nur Blöcke betrachtet, die im jeweiligen Szenario überhaupt
 * Kosten tragen — leere Blöcke haben per Definition keine Wirkung.
 */
export function tornado(
  project: Project,
  view: CostView,
  pct = 0.2,
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

      const low = compare(scaledProject(project, scenario, block.id, 1 - pct), view).delta
      const high = compare(scaledProject(project, scenario, block.id, 1 + pct), view).delta

      entries.push({
        scenario,
        scenarioName: project.scenarios[scenario].name,
        blockId: block.id,
        blockName: block.name,
        low,
        high,
        swing: Math.max(Math.abs(low - base), Math.abs(high - base)),
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
