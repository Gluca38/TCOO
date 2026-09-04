import type {
  BlockId,
  CapexLine,
  OpexLine,
  Project,
  ScenarioKey,
  CostView,
  Settings,
} from './types'

/* ------------------------------------------------------------------ *
 * Grundbausteine
 * ------------------------------------------------------------------ */

/** Jahresindizes 1..H des Betrachtungszeitraums. */
export function yearIndices(horizonYears: number): number[] {
  return Array.from({ length: horizonYears }, (_, i) => i + 1)
}

/** Kalenderjahr zu einem Jahresindex. */
export function calendarYear(settings: Settings, t: number): number {
  return settings.startYear + t - 1
}

/** Diskontfaktor: Jahresende-Konvention, erstes Jahr t = 1. */
export function discountFactor(rate: number, t: number): number {
  return 1 / Math.pow(1 + rate, t)
}

/** Ein einzelner Rechenschritt für die Aufschlüsselung im UI. */
export interface TraceStep {
  label: string
  detail: string
  value: number
}

/* ------------------------------------------------------------------ *
 * OpEx
 * ------------------------------------------------------------------ */

/** Normalisiert den eingegebenen Betrag auf einen Jahresbetrag. */
export function annualBaseAmount(line: OpexLine): number {
  return line.period === 'month' ? line.amount * 12 : line.amount
}

/** Effektive Steigerungsrate: Position schlägt globalen Default. */
export function effectiveEscalation(line: OpexLine, settings: Settings): number {
  return line.escalation ?? settings.defaultEscalation
}

export function isOpexActiveInYear(line: OpexLine, t: number): boolean {
  if (!line.active) return false
  if (t < line.startYear) return false
  if (line.endYear !== null && t > line.endYear) return false
  return true
}

/**
 * OpEx-Betrag im Jahr t.
 *
 * Der eingegebene Betrag ist der Wert im Startjahr der Position. Die
 * Steigerung wirkt ab dem Startjahr, nicht ab Jahr 1.
 */
export function opexForYear(line: OpexLine, t: number, settings: Settings): number {
  if (!isOpexActiveInYear(line, t)) return 0
  const base = annualBaseAmount(line)
  const g = effectiveEscalation(line, settings)
  return base * Math.pow(1 + g, t - line.startYear)
}

export function opexTrace(line: OpexLine, t: number, settings: Settings): TraceStep[] {
  if (!isOpexActiveInYear(line, t)) return []
  const base = annualBaseAmount(line)
  const g = effectiveEscalation(line, settings)
  const exp = t - line.startYear
  const steps: TraceStep[] = []

  steps.push({
    label: 'Basisbetrag',
    detail:
      line.period === 'month'
        ? `${fmtRaw(line.amount)} € / Monat × 12`
        : `${fmtRaw(line.amount)} € / Jahr`,
    value: base,
  })

  if (exp > 0) {
    steps.push({
      label: 'Steigerung',
      detail: `${(g * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} % über ${exp} ${
        exp === 1 ? 'Jahr' : 'Jahre'
      } → × ${Math.pow(1 + g, exp).toLocaleString('de-DE', { maximumFractionDigits: 4 })}`,
      value: base * Math.pow(1 + g, exp),
    })
  }

  return steps
}

/* ------------------------------------------------------------------ *
 * CapEx
 * ------------------------------------------------------------------ */

export interface CapexEvent {
  /** Jahresindex, in dem die Investition anfällt. */
  year: number
  amount: number
  /** true, wenn dies eine Wiederholung (Refresh) der Erstinvestition ist. */
  isRefresh: boolean
}

/**
 * Alle Investitionszeitpunkte einer CapEx-Zeile innerhalb des Zeitraums.
 *
 * Wiederholungen laufen mit demselben Nominalbetrag — CapEx wird nicht
 * indexiert.
 */
export function capexEvents(line: CapexLine, horizonYears: number): CapexEvent[] {
  if (!line.active || line.amount === 0) return []
  const events: CapexEvent[] = []
  if (line.year >= 1 && line.year <= horizonYears) {
    events.push({ year: line.year, amount: line.amount, isRefresh: false })
  }
  const step = line.refreshEveryYears
  if (step !== null && step > 0) {
    for (let y = line.year + step; y <= horizonYears; y += step) {
      if (y >= 1) events.push({ year: y, amount: line.amount, isRefresh: true })
    }
  }
  return events
}

export interface DepreciationSlice {
  /** Jahr, in dem die Abschreibungsscheibe anfällt. */
  year: number
  amount: number
  /** Jahr der zugrunde liegenden Investition. */
  investmentYear: number
}

/** Lineare Abschreibung, volle Jahresscheiben ab dem Anfalljahr. */
export function depreciationSlices(
  line: CapexLine,
  horizonYears: number,
): { within: DepreciationSlice[]; unrecognized: number } {
  const within: DepreciationSlice[] = []
  let unrecognized = 0
  const life = Math.max(1, Math.floor(line.usefulLifeYears || 0))

  for (const ev of capexEvents(line, horizonYears)) {
    const perYear = ev.amount / life
    for (let k = 0; k < life; k++) {
      const y = ev.year + k
      if (y <= horizonYears) {
        within.push({ year: y, amount: perYear, investmentYear: ev.year })
      } else {
        // Scheiben jenseits des Betrachtungszeitraums fallen aus der Rechnung.
        unrecognized += perYear
      }
    }
  }
  return { within, unrecognized }
}

/* ------------------------------------------------------------------ *
 * Aggregation je Szenario
 * ------------------------------------------------------------------ */

export interface ScenarioSeries {
  years: number[]
  /** Wert je Block und Jahr in der gewählten Sicht, undiskontiert. */
  byBlock: Record<BlockId, number[]>
  capexByYear: number[]
  opexByYear: number[]
  totalByYear: number[]
  cumulativeByYear: number[]
  total: number
  /** Nur relevant in der P&L-Sicht: nicht im Zeitraum erfasste Abschreibung. */
  unrecognizedDepreciation: number
}

function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0)
}

/**
 * Berechnet die Jahresreihen eines Szenarios in der angegebenen Sicht.
 *
 * Deaktivierte Blöcke und inaktive Zeilen fließen nicht ein.
 */
export function computeScenario(
  project: Project,
  key: ScenarioKey,
  view: CostView,
): ScenarioSeries {
  const H = project.settings.horizonYears
  const years = yearIndices(H)
  const scenario = project.scenarios[key]

  const byBlock: Record<BlockId, number[]> = {}
  const capexByYear = zeros(H)
  const opexByYear = zeros(H)
  let unrecognizedDepreciation = 0

  for (const block of project.blocks) {
    const series = zeros(H)
    byBlock[block.id] = series
    if (!block.enabled) continue

    const entry = scenario.entries[block.id]
    if (!entry) continue

    if (entry.capex?.active) {
      if (view === 'cashflow') {
        for (const ev of capexEvents(entry.capex, H)) {
          series[ev.year - 1] += ev.amount
          capexByYear[ev.year - 1] += ev.amount
        }
      } else {
        const { within, unrecognized } = depreciationSlices(entry.capex, H)
        unrecognizedDepreciation += unrecognized
        for (const slice of within) {
          series[slice.year - 1] += slice.amount
          capexByYear[slice.year - 1] += slice.amount
        }
      }
    }

    if (entry.opex?.active) {
      for (const t of years) {
        const v = opexForYear(entry.opex, t, project.settings)
        series[t - 1] += v
        opexByYear[t - 1] += v
      }
    }
  }

  const totalByYear = years.map((_, i) => capexByYear[i] + opexByYear[i])
  const cumulativeByYear: number[] = []
  let running = 0
  for (const v of totalByYear) {
    running += v
    cumulativeByYear.push(running)
  }

  return {
    years,
    byBlock,
    capexByYear,
    opexByYear,
    totalByYear,
    cumulativeByYear,
    total: running,
    unrecognizedDepreciation,
  }
}

/**
 * Barwert einer Jahresreihe.
 *
 * Wird ausschließlich auf Cashflow-Reihen angewendet — Barwerte setzen
 * Zahlungsströme voraus.
 */
export function npv(seriesByYear: number[], rate: number): number {
  return seriesByYear.reduce((sum, v, i) => sum + v * discountFactor(rate, i + 1), 0)
}

/** Diskontierte Jahresreihe. */
export function discountSeries(seriesByYear: number[], rate: number): number[] {
  return seriesByYear.map((v, i) => v * discountFactor(rate, i + 1))
}

/* ------------------------------------------------------------------ *
 * Aufschlüsselung einer einzelnen Zelle
 * ------------------------------------------------------------------ */

export interface Contribution {
  blockId: BlockId
  blockName: string
  kind: 'capex' | 'opex'
  value: number
  steps: TraceStep[]
}

/**
 * Liefert alle Beiträge zu einer Zelle (Szenario × Block-Auswahl × Jahr),
 * inklusive der angewandten Rechenschritte. Grundlage des Drilldowns.
 */
export function explainCell(
  project: Project,
  key: ScenarioKey,
  t: number,
  view: CostView,
  blockId?: BlockId,
): Contribution[] {
  const H = project.settings.horizonYears
  const scenario = project.scenarios[key]
  const out: Contribution[] = []

  for (const block of project.blocks) {
    if (!block.enabled) continue
    if (blockId && block.id !== blockId) continue
    const entry = scenario.entries[block.id]
    if (!entry) continue

    if (entry.capex?.active) {
      if (view === 'cashflow') {
        for (const ev of capexEvents(entry.capex, H)) {
          if (ev.year !== t) continue
          out.push({
            blockId: block.id,
            blockName: block.name,
            kind: 'capex',
            value: ev.amount,
            steps: [
              {
                label: ev.isRefresh ? 'Reinvestition (Refresh)' : 'Investition',
                detail: `Auszahlung im Anfalljahr, nominal${
                  ev.isRefresh ? ` · Wiederholung alle ${entry.capex.refreshEveryYears} Jahre` : ''
                }`,
                value: ev.amount,
              },
            ],
          })
        }
      } else {
        const { within } = depreciationSlices(entry.capex, H)
        const slices = within.filter((s) => s.year === t)
        for (const s of slices) {
          out.push({
            blockId: block.id,
            blockName: block.name,
            kind: 'capex',
            value: s.amount,
            steps: [
              {
                label: 'Abschreibung',
                detail: `Investition ${calendarYear(project.settings, s.investmentYear)} über ${
                  entry.capex.usefulLifeYears
                } Jahre linear`,
                value: s.amount,
              },
            ],
          })
        }
      }
    }

    if (entry.opex?.active) {
      const v = opexForYear(entry.opex, t, project.settings)
      if (v !== 0) {
        out.push({
          blockId: block.id,
          blockName: block.name,
          kind: 'opex',
          value: v,
          steps: opexTrace(entry.opex, t, project.settings),
        })
      }
    }
  }

  return out
}

/* ------------------------------------------------------------------ *
 * intern
 * ------------------------------------------------------------------ */

function fmtRaw(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}
