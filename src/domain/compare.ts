import type { CostView, Project, ScenarioKey } from './types'
import { computeScenario, npv, type ScenarioSeries } from './calc'

export const MIGRATION_BLOCK_ID = 'migration'

export interface ComparisonResult {
  view: CostView
  onprem: ScenarioSeries
  cloud: ScenarioSeries
  /** onprem − cloud je Jahr. Positiv = Cloud günstiger. */
  deltaByYear: number[]
  cumulativeDeltaByYear: number[]
  /** Gesamtdifferenz in der gewählten Sicht, undiskontiert. */
  delta: number
  /** Relative Differenz zur On-Prem-Summe. null, wenn On-Prem 0 ist. */
  deltaPercent: number | null
  /** Barwerte — immer auf Basis der Cashflow-Reihen. */
  npvOnprem: number
  npvCloud: number
  npvDelta: number
  /** Break-even auf undiskontierter Basis, als Jahresindex mit Nachkommaanteil. */
  breakEvenYear: number | null
  /** Break-even auf Barwertbasis. */
  breakEvenYearDiscounted: number | null
  /** Amortisation der Cloud-Vorleistung im Migrationsblock, in Jahren. */
  migrationPayback: MigrationPayback | null
}

export interface MigrationPayback {
  /** Summe der Cloud-Kosten im Migrationsblock über den Zeitraum. */
  upfront: number
  /** Durchschnittliche jährliche Einsparung ohne den Migrationsblock. */
  annualSaving: number
  /** upfront / annualSaving, in Jahren. null wenn keine Einsparung entsteht. */
  years: number | null
}

/**
 * Break-even der kumulierten Differenz.
 *
 * Gesucht ist der Vorzeichenwechsel von negativ (Cloud teurer) nach positiv.
 * Zwischen zwei Jahren wird linear interpoliert. Rückgabe ist ein
 * Jahresindex mit Nachkommaanteil; 0 bedeutet „von Beginn an günstiger".
 * null bedeutet, dass der Wechsel im Zeitraum nicht eintritt.
 */
export function findBreakEven(cumulativeDelta: number[]): number | null {
  // Ohne echten Unterschied gibt es keinen Break-even.
  if (cumulativeDelta.every((v) => v === 0)) return null

  let prev = 0
  for (let i = 0; i < cumulativeDelta.length; i++) {
    const cur = cumulativeDelta[i]
    if (cur > 0 && prev <= 0) {
      const step = cur - prev
      const frac = step === 0 ? 0 : Math.abs(prev) / Math.abs(step)
      return i + frac
    }
    prev = cur
  }
  return null
}

function cumulate(values: number[]): number[] {
  const out: number[] = []
  let running = 0
  for (const v of values) {
    running += v
    out.push(running)
  }
  return out
}

/** Summe der Kosten eines einzelnen Blocks über den Zeitraum. */
export function blockTotal(series: ScenarioSeries, blockId: string): number {
  return (series.byBlock[blockId] ?? []).reduce((a, b) => a + b, 0)
}

function computeMigrationPayback(
  project: Project,
  onprem: ScenarioSeries,
  cloud: ScenarioSeries,
): MigrationPayback | null {
  const block = project.blocks.find((b) => b.id === MIGRATION_BLOCK_ID && b.enabled)
  if (!block) return null

  const upfront = blockTotal(cloud, MIGRATION_BLOCK_ID)
  if (upfront <= 0) return null

  // Einsparung ohne den Migrationsblock, damit die Vorleistung nicht gegen
  // sich selbst gerechnet wird.
  const onpremWithout = onprem.total - blockTotal(onprem, MIGRATION_BLOCK_ID)
  const cloudWithout = cloud.total - upfront
  const annualSaving = (onpremWithout - cloudWithout) / project.settings.horizonYears

  return {
    upfront,
    annualSaving,
    years: annualSaving > 0 ? upfront / annualSaving : null,
  }
}

/** Vollständiger Vergleich beider Szenarien in der gewählten Sicht. */
export function compare(project: Project, view: CostView = project.settings.view): ComparisonResult {
  const onprem = computeScenario(project, 'onprem', view)
  const cloud = computeScenario(project, 'cloud', view)

  const deltaByYear = onprem.totalByYear.map((v, i) => v - cloud.totalByYear[i])
  const cumulativeDeltaByYear = cumulate(deltaByYear)
  const delta = onprem.total - cloud.total

  // Barwerte immer auf Cashflow-Basis, unabhängig von der angezeigten Sicht.
  const onpremCash = view === 'cashflow' ? onprem : computeScenario(project, 'onprem', 'cashflow')
  const cloudCash = view === 'cashflow' ? cloud : computeScenario(project, 'cloud', 'cashflow')
  const rate = project.settings.discountRate
  const npvOnprem = npv(onpremCash.totalByYear, rate)
  const npvCloud = npv(cloudCash.totalByYear, rate)

  const discountedDelta = onpremCash.totalByYear.map(
    (v, i) => (v - cloudCash.totalByYear[i]) / Math.pow(1 + rate, i + 1),
  )

  return {
    view,
    onprem,
    cloud,
    deltaByYear,
    cumulativeDeltaByYear,
    delta,
    deltaPercent: onprem.total === 0 ? null : delta / onprem.total,
    npvOnprem,
    npvCloud,
    npvDelta: npvOnprem - npvCloud,
    breakEvenYear: findBreakEven(cumulativeDeltaByYear),
    breakEvenYearDiscounted: findBreakEven(cumulate(discountedDelta)),
    migrationPayback: computeMigrationPayback(project, onprem, cloud),
  }
}

export interface ScenarioKpi {
  key: ScenarioKey
  name: string
  total: number
  averageAnnual: number
  capexTotal: number
  opexTotal: number
  /** Anteil CapEx an der Gesamtsumme. null, wenn Gesamtsumme 0. */
  capexShare: number | null
}

export function scenarioKpis(project: Project, result: ComparisonResult): ScenarioKpi[] {
  return (['onprem', 'cloud'] as ScenarioKey[]).map((key) => {
    const s = key === 'onprem' ? result.onprem : result.cloud
    const capexTotal = s.capexByYear.reduce((a, b) => a + b, 0)
    const opexTotal = s.opexByYear.reduce((a, b) => a + b, 0)
    return {
      key,
      name: project.scenarios[key].name,
      total: s.total,
      averageAnnual: s.total / project.settings.horizonYears,
      capexTotal,
      opexTotal,
      capexShare: s.total === 0 ? null : capexTotal / s.total,
    }
  })
}
