import { describe, expect, it } from 'vitest'
import {
  annualBaseAmount,
  capexEvents,
  computeScenario,
  depreciationSlices,
  discountFactor,
  explainCell,
  npv,
  opexForYear,
} from '../calc'
import { createEmptyProject } from '../defaults'
import type { CapexLine, OpexLine, Project, Settings } from '../types'

const settings: Settings = {
  startYear: 2026,
  horizonYears: 5,
  discountRate: 0.07,
  defaultEscalation: 0.03,
  view: 'cashflow',
  discounted: false,
}

function opex(partial: Partial<OpexLine> = {}): OpexLine {
  return {
    active: true,
    amount: 100_000,
    origin: 'estimated',
    uncertainty: null,
    period: 'year',
    startYear: 1,
    endYear: null,
    escalation: null,
    ...partial,
  }
}

function capex(partial: Partial<CapexLine> = {}): CapexLine {
  return {
    active: true,
    amount: 100_000,
    origin: 'estimated',
    uncertainty: null,
    year: 1,
    usefulLifeYears: 5,
    refreshEveryYears: null,
    ...partial,
  }
}

describe('OpEx', () => {
  it('rechnet Monatsbeträge auf Jahresbeträge hoch', () => {
    expect(annualBaseAmount(opex({ amount: 1_000, period: 'month' }))).toBe(12_000)
    expect(annualBaseAmount(opex({ amount: 1_000, period: 'year' }))).toBe(1_000)
  })

  it('wendet die Steigerung ab dem Startjahr der Position an, nicht ab Jahr 1', () => {
    const line = opex({ amount: 100_000, startYear: 3, escalation: 0.1 })
    expect(opexForYear(line, 2, settings)).toBe(0)
    // Im eigenen Startjahr gilt der Nominalbetrag.
    expect(opexForYear(line, 3, settings)).toBeCloseTo(100_000, 6)
    expect(opexForYear(line, 4, settings)).toBeCloseTo(110_000, 6)
    expect(opexForYear(line, 5, settings)).toBeCloseTo(121_000, 6)
  })

  it('nutzt die globale Steigerungsrate, wenn die Position keine eigene hat', () => {
    const line = opex({ amount: 100_000, escalation: null })
    expect(opexForYear(line, 2, settings)).toBeCloseTo(103_000, 6)
  })

  it('berücksichtigt das Endjahr', () => {
    const line = opex({ amount: 50_000, startYear: 1, endYear: 2, escalation: 0 })
    expect(opexForYear(line, 2, settings)).toBe(50_000)
    expect(opexForYear(line, 3, settings)).toBe(0)
  })

  it('liefert 0 für inaktive Zeilen', () => {
    expect(opexForYear(opex({ active: false }), 1, settings)).toBe(0)
  })
})

describe('CapEx', () => {
  it('erzeugt genau ein Ereignis ohne Wiederholung', () => {
    expect(capexEvents(capex({ year: 2 }), 5)).toEqual([
      { year: 2, amount: 100_000, isRefresh: false },
    ])
  })

  it('wiederholt mit demselben Nominalbetrag und indexiert nicht', () => {
    const events = capexEvents(capex({ amount: 300_000, year: 1, refreshEveryYears: 2 }), 5)
    expect(events.map((e) => e.year)).toEqual([1, 3, 5])
    expect(events.every((e) => e.amount === 300_000)).toBe(true)
    expect(events.filter((e) => e.isRefresh)).toHaveLength(2)
  })

  it('ignoriert Investitionen hinter dem Betrachtungszeitraum', () => {
    expect(capexEvents(capex({ year: 7 }), 5)).toEqual([])
  })

  it('schreibt linear über die Nutzungsdauer ab', () => {
    const { within, unrecognized } = depreciationSlices(
      capex({ amount: 500_000, year: 1, usefulLifeYears: 5 }),
      5,
    )
    expect(within).toHaveLength(5)
    expect(within.every((s) => s.amount === 100_000)).toBe(true)
    expect(unrecognized).toBe(0)
  })

  it('weist Abschreibungsscheiben jenseits des Zeitraums separat aus', () => {
    const { within, unrecognized } = depreciationSlices(
      capex({ amount: 500_000, year: 4, usefulLifeYears: 5 }),
      5,
    )
    // Nur die Jahre 4 und 5 liegen im Zeitraum.
    expect(within).toHaveLength(2)
    expect(unrecognized).toBeCloseTo(300_000, 6)
  })
})

describe('Diskontierung', () => {
  it('nutzt die Jahresende-Konvention mit t=1 im ersten Jahr', () => {
    expect(discountFactor(0.07, 1)).toBeCloseTo(1 / 1.07, 10)
    expect(discountFactor(0.07, 3)).toBeCloseTo(1 / Math.pow(1.07, 3), 10)
  })

  it('berechnet den Barwert einer Reihe', () => {
    const result = npv([100, 100], 0.1)
    expect(result).toBeCloseTo(100 / 1.1 + 100 / 1.21, 8)
  })
})

describe('Szenario-Aggregation', () => {
  function projectWith(capexLine: CapexLine | null, opexLine: OpexLine | null): Project {
    const p = createEmptyProject()
    p.settings = { ...settings }
    p.scenarios.onprem.entries.compute = {
      blockId: 'compute',
      note: '',
      noteOrigin: 'manual',
      capex: capexLine,
      opex: opexLine,
    }
    return p
  }

  it('bucht CapEx in der Cashflow-Sicht voll ins Anfalljahr', () => {
    const p = projectWith(capex({ amount: 500_000, year: 2, usefulLifeYears: 5 }), null)
    const s = computeScenario(p, 'onprem', 'cashflow')
    expect(s.totalByYear).toEqual([0, 500_000, 0, 0, 0])
    expect(s.total).toBe(500_000)
  })

  it('verteilt dieselbe Investition in der P&L-Sicht auf Jahresscheiben', () => {
    const p = projectWith(capex({ amount: 500_000, year: 2, usefulLifeYears: 5 }), null)
    const s = computeScenario(p, 'onprem', 'pnl')
    expect(s.totalByYear).toEqual([0, 100_000, 100_000, 100_000, 100_000])
    // Die fünfte Scheibe fällt in Jahr 6 und damit aus dem Zeitraum.
    expect(s.unrecognizedDepreciation).toBeCloseTo(100_000, 6)
  })

  it('lässt deaktivierte Blöcke vollständig aus der Rechnung', () => {
    const p = projectWith(capex({ amount: 500_000 }), null)
    p.blocks = p.blocks.map((b) => (b.id === 'compute' ? { ...b, enabled: false } : b))
    expect(computeScenario(p, 'onprem', 'cashflow').total).toBe(0)
  })

  it('kumuliert korrekt über die Jahre', () => {
    const p = projectWith(null, opex({ amount: 100_000, escalation: 0 }))
    const s = computeScenario(p, 'onprem', 'cashflow')
    expect(s.cumulativeByYear).toEqual([100_000, 200_000, 300_000, 400_000, 500_000])
  })
})

describe('Aufschlüsselung', () => {
  it('nennt jeden angewandten Rechenschritt', () => {
    const p = createEmptyProject()
    p.settings = { ...settings }
    p.scenarios.cloud.entries.compute = {
      blockId: 'compute',
      note: '',
      noteOrigin: 'manual',
      capex: null,
      opex: opex({ amount: 10_000, period: 'month', escalation: 0.05 }),
    }
    const contributions = explainCell(p, 'cloud', 3, 'cashflow', 'compute')
    expect(contributions).toHaveLength(1)
    const [c] = contributions
    expect(c.value).toBeCloseTo(120_000 * 1.05 ** 2, 6)
    expect(c.steps[0].value).toBe(120_000)
    expect(c.steps[1].value).toBeCloseTo(132_300, 6)
  })

  it('erklärt eine Reinvestition als solche', () => {
    const p = createEmptyProject()
    p.settings = { ...settings }
    p.scenarios.onprem.entries.compute = {
      blockId: 'compute',
      note: '',
      noteOrigin: 'manual',
      capex: capex({ amount: 200_000, year: 1, refreshEveryYears: 3 }),
      opex: null,
    }
    const [c] = explainCell(p, 'onprem', 4, 'cashflow', 'compute')
    expect(c.value).toBe(200_000)
    expect(c.steps[0].label).toContain('Reinvestition')
  })
})
