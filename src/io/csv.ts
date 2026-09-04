import type { CostView, Project, ScenarioKey } from '../domain/types'
import { calendarYear, computeScenario, discountSeries } from '../domain/calc'
import { compare, scenarioKpis } from '../domain/compare'

/**
 * CSV-Export für deutsches Excel.
 *
 * Deutsches Excel erwartet Semikolon als Trennzeichen und Komma als
 * Dezimaltrennzeichen; ohne UTF-8-BOM werden Umlaute falsch dargestellt.
 * Deshalb wird der Export von Hand erzeugt statt über eine Standardbibliothek.
 */

const SEP = ';'
export const CSV_BOM = '﻿'

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    // Komma als Dezimaltrennzeichen, kein Tausenderpunkt (stört beim Einlesen).
    return value.toFixed(2).replace('.', ',')
  }
  const needsQuotes = /[";\n]/.test(value)
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value
}

function row(values: Array<string | number | null | undefined>): string {
  return values.map(cell).join(SEP)
}

function viewLabel(view: CostView): string {
  return view === 'cashflow' ? 'Cashflow (Auszahlung im Anfalljahr)' : 'P&L (abgeschriebene Kosten)'
}

/** Erzeugt den vollständigen CSV-Export inklusive Annahmen und Rohdaten. */
export function projectToCsv(project: Project, view: CostView = project.settings.view): string {
  const s = project.settings
  const result = compare(project, view)
  const years = result.onprem.years
  const yearHeaders = years.map((t) => String(calendarYear(s, t)))
  const lines: string[] = []

  /* --- Annahmen ------------------------------------------------------- */
  lines.push(row(['TCO-Vergleich']))
  lines.push(row(['Titel', project.meta.title]))
  lines.push(row(['Exportiert am', new Date().toLocaleString('de-DE')]))
  lines.push(row(['Sicht', viewLabel(view)]))
  lines.push(row(['Startjahr', s.startYear]))
  lines.push(row(['Betrachtungszeitraum (Jahre)', s.horizonYears]))
  lines.push(row(['Diskontierungssatz', `${(s.discountRate * 100).toFixed(2).replace('.', ',')} %`]))
  lines.push(row(['Globale Steigerungsrate', `${(s.defaultEscalation * 100).toFixed(2).replace('.', ',')} %`]))
  if (project.meta.notes) lines.push(row(['Notiz', project.meta.notes]))
  lines.push('')

  /* --- Jahreswerte je Block ------------------------------------------- */
  lines.push(row(['Jahreswerte je Block']))
  lines.push(row(['Szenario', 'Block', ...yearHeaders, 'Gesamt']))

  for (const key of ['onprem', 'cloud'] as ScenarioKey[]) {
    const scenario = project.scenarios[key]
    const series = key === 'onprem' ? result.onprem : result.cloud
    for (const block of project.blocks) {
      if (!block.enabled) continue
      const values = series.byBlock[block.id] ?? []
      const total = values.reduce((a, b) => a + b, 0)
      if (total === 0) continue
      lines.push(row([scenario.name, block.name, ...values, total]))
    }
    lines.push(row([scenario.name, 'Summe CapEx', ...series.capexByYear, series.capexByYear.reduce((a, b) => a + b, 0)]))
    lines.push(row([scenario.name, 'Summe OpEx', ...series.opexByYear, series.opexByYear.reduce((a, b) => a + b, 0)]))
    lines.push(row([scenario.name, 'Gesamt', ...series.totalByYear, series.total]))
    lines.push(row([scenario.name, 'Kumuliert', ...series.cumulativeByYear, series.total]))
    lines.push('')
  }

  /* --- Vergleich ------------------------------------------------------- */
  lines.push(row(['Vergleich (On-Prem minus Cloud, positiv = Cloud günstiger)']))
  lines.push(row(['', '', ...yearHeaders, 'Gesamt']))
  lines.push(row(['Differenz', '', ...result.deltaByYear, result.delta]))
  lines.push(row(['Differenz kumuliert', '', ...result.cumulativeDeltaByYear, result.delta]))
  lines.push('')

  /* --- Barwerte (immer auf Cashflow-Basis) ----------------------------- */
  const onpremCash = computeScenario(project, 'onprem', 'cashflow')
  const cloudCash = computeScenario(project, 'cloud', 'cashflow')
  lines.push(row(['Barwerte (Basis: Cashflow)']))
  lines.push(row(['', '', ...yearHeaders, 'Barwert gesamt']))
  lines.push(
    row([
      project.scenarios.onprem.name,
      'diskontiert',
      ...discountSeries(onpremCash.totalByYear, s.discountRate),
      result.npvOnprem,
    ]),
  )
  lines.push(
    row([
      project.scenarios.cloud.name,
      'diskontiert',
      ...discountSeries(cloudCash.totalByYear, s.discountRate),
      result.npvCloud,
    ]),
  )
  lines.push(row(['Barwertdifferenz', '', ...years.map(() => null), result.npvDelta]))
  lines.push('')

  /* --- Kennzahlen ------------------------------------------------------ */
  lines.push(row(['Kennzahlen']))
  for (const kpi of scenarioKpis(project, result)) {
    lines.push(row([kpi.name, 'Gesamt', kpi.total]))
    lines.push(row([kpi.name, 'Durchschnitt pro Jahr', kpi.averageAnnual]))
    lines.push(row([kpi.name, 'davon CapEx', kpi.capexTotal]))
    lines.push(row([kpi.name, 'davon OpEx', kpi.opexTotal]))
  }
  lines.push(row(['Differenz gesamt', '', result.delta]))
  if (result.deltaPercent !== null) {
    lines.push(row(['Differenz in Prozent', '', `${(result.deltaPercent * 100).toFixed(2).replace('.', ',')} %`]))
  }
  lines.push(
    row([
      'Break-even (undiskontiert)',
      '',
      result.breakEvenYear === null ? 'im Zeitraum nicht erreicht' : `Jahr ${(result.breakEvenYear + 1).toFixed(2).replace('.', ',')}`,
    ]),
  )
  lines.push(
    row([
      'Break-even (Barwert)',
      '',
      result.breakEvenYearDiscounted === null ? 'im Zeitraum nicht erreicht' : `Jahr ${(result.breakEvenYearDiscounted + 1).toFixed(2).replace('.', ',')}`,
    ]),
  )
  if (view === 'pnl') {
    lines.push(row([project.scenarios.onprem.name, 'nicht erfasste Restabschreibung', result.onprem.unrecognizedDepreciation]))
    lines.push(row([project.scenarios.cloud.name, 'nicht erfasste Restabschreibung', result.cloud.unrecognizedDepreciation]))
  }
  lines.push('')

  /* --- Eingabewerte ---------------------------------------------------- */
  lines.push(row(['Eingabewerte (Rohdaten)']))
  lines.push(
    row([
      'Szenario', 'Block', 'Kostenart', 'Betrag', 'Einheit', 'Anfalls-/Startjahr',
      'Endjahr', 'Nutzungsdauer', 'Wiederholung alle', 'Steigerung', 'Notiz',
    ]),
  )
  for (const key of ['onprem', 'cloud'] as ScenarioKey[]) {
    const scenario = project.scenarios[key]
    for (const block of project.blocks) {
      const entry = scenario.entries[block.id]
      if (!entry) continue
      if (entry.capex?.active) {
        lines.push(
          row([
            scenario.name, block.name, 'CapEx', entry.capex.amount, 'einmalig',
            calendarYear(s, entry.capex.year), '', `${entry.capex.usefulLifeYears} Jahre`,
            entry.capex.refreshEveryYears ? `${entry.capex.refreshEveryYears} Jahre` : '',
            '', entry.note,
          ]),
        )
      }
      if (entry.opex?.active) {
        const esc = entry.opex.escalation ?? s.defaultEscalation
        lines.push(
          row([
            scenario.name, block.name, 'OpEx', entry.opex.amount,
            entry.opex.period === 'month' ? 'pro Monat' : 'pro Jahr',
            calendarYear(s, entry.opex.startYear),
            entry.opex.endYear === null ? '' : calendarYear(s, entry.opex.endYear),
            '', '',
            `${(esc * 100).toFixed(2).replace('.', ',')} %${entry.opex.escalation === null ? ' (global)' : ''}`,
            entry.note,
          ]),
        )
      }
    }
  }

  return CSV_BOM + lines.join('\r\n')
}
