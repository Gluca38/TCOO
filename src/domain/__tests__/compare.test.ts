import { describe, expect, it } from 'vitest'
import { compare, findBreakEven, scenarioKpis } from '../compare'
import { createEmptyProject } from '../defaults'
import type { Project } from '../types'

function baseProject(): Project {
  const p = createEmptyProject()
  p.settings.startYear = 2026
  p.settings.horizonYears = 5
  p.settings.discountRate = 0.07
  p.settings.defaultEscalation = 0
  return p
}

describe('Break-even', () => {
  it('findet den Vorzeichenwechsel und interpoliert linear', () => {
    // Kumulierte Differenz: -100, -50, +50 → Wechsel in Jahr 3, auf halber Strecke.
    expect(findBreakEven([-100, -50, 50])).toBeCloseTo(2.5, 10)
  })

  it('meldet null, wenn der Wechsel im Zeitraum nicht eintritt', () => {
    expect(findBreakEven([-100, -200, -300])).toBeNull()
  })

  it('meldet null, wenn es keinen Unterschied gibt', () => {
    expect(findBreakEven([0, 0, 0])).toBeNull()
  })

  it('meldet 0, wenn das Zielszenario von Beginn an günstiger ist', () => {
    expect(findBreakEven([100, 200])).toBe(0)
  })
})

describe('Vergleich', () => {
  it('rechnet die Differenz als On-Prem minus Cloud', () => {
    const p = baseProject()
    p.scenarios.onprem.entries.compute.opex = {
      active: true, amount: 100_000, period: 'year', startYear: 1, endYear: null, escalation: 0,
    }
    p.scenarios.cloud.entries.compute.opex = {
      active: true, amount: 60_000, period: 'year', startYear: 1, endYear: null, escalation: 0,
    }
    const r = compare(p, 'cashflow')
    expect(r.deltaByYear).toEqual([40_000, 40_000, 40_000, 40_000, 40_000])
    expect(r.delta).toBe(200_000)
    expect(r.deltaPercent).toBeCloseTo(0.4, 10)
  })

  it('bildet den Barwert immer auf Cashflow-Basis, auch in der P&L-Sicht', () => {
    const p = baseProject()
    p.scenarios.onprem.entries.compute.capex = {
      active: true, amount: 500_000, year: 1, usefulLifeYears: 5, refreshEveryYears: null,
    }
    const cash = compare(p, 'cashflow')
    const pnl = compare(p, 'pnl')

    // Die angezeigte Sicht unterscheidet sich …
    expect(cash.onprem.totalByYear[0]).toBe(500_000)
    expect(pnl.onprem.totalByYear[0]).toBe(100_000)
    // … der Barwert bleibt identisch, weil er auf Zahlungsströmen beruht.
    expect(pnl.npvOnprem).toBeCloseTo(cash.npvOnprem, 8)
    expect(cash.npvOnprem).toBeCloseTo(500_000 / 1.07, 6)
  })

  it('erkennt den Break-even bei Migrationsvorleistung im ersten Jahr', () => {
    const p = baseProject()
    p.scenarios.onprem.entries.compute.opex = {
      active: true, amount: 200_000, period: 'year', startYear: 1, endYear: null, escalation: 0,
    }
    p.scenarios.cloud.entries.compute.opex = {
      active: true, amount: 100_000, period: 'year', startYear: 1, endYear: null, escalation: 0,
    }
    p.scenarios.cloud.entries.migration.capex = {
      active: true, amount: 250_000, year: 1, usefulLifeYears: 3, refreshEveryYears: null,
    }
    const r = compare(p, 'cashflow')
    // Jahr 1: 200.000 − 350.000 = −150.000; danach je +100.000
    expect(r.cumulativeDeltaByYear).toEqual([-150_000, -50_000, 50_000, 150_000, 250_000])
    expect(r.breakEvenYear).toBeCloseTo(2.5, 10)
  })

  it('berechnet die Amortisation der Migrationsvorleistung nachvollziehbar', () => {
    const p = baseProject()
    p.scenarios.onprem.entries.compute.opex = {
      active: true, amount: 200_000, period: 'year', startYear: 1, endYear: null, escalation: 0,
    }
    p.scenarios.cloud.entries.compute.opex = {
      active: true, amount: 100_000, period: 'year', startYear: 1, endYear: null, escalation: 0,
    }
    p.scenarios.cloud.entries.migration.capex = {
      active: true, amount: 250_000, year: 1, usefulLifeYears: 3, refreshEveryYears: null,
    }
    const r = compare(p, 'cashflow')
    expect(r.migrationPayback).not.toBeNull()
    expect(r.migrationPayback!.upfront).toBe(250_000)
    // Einsparung ohne den Migrationsblock: 100.000 pro Jahr.
    expect(r.migrationPayback!.annualSaving).toBeCloseTo(100_000, 6)
    expect(r.migrationPayback!.years).toBeCloseTo(2.5, 10)
  })
})

describe('Kennzahlen je Szenario', () => {
  it('trennt CapEx und OpEx und weist die Quote aus', () => {
    const p = baseProject()
    p.scenarios.onprem.entries.compute.capex = {
      active: true, amount: 300_000, year: 1, usefulLifeYears: 5, refreshEveryYears: null,
    }
    p.scenarios.onprem.entries.support.opex = {
      active: true, amount: 100_000, period: 'year', startYear: 1, endYear: null, escalation: 0,
    }
    const [onprem] = scenarioKpis(p, compare(p, 'cashflow'))
    expect(onprem.capexTotal).toBe(300_000)
    expect(onprem.opexTotal).toBe(500_000)
    expect(onprem.total).toBe(800_000)
    expect(onprem.averageAnnual).toBe(160_000)
    expect(onprem.capexShare).toBeCloseTo(0.375, 10)
  })
})
