import { describe, expect, it } from 'vitest'
import { tornado, withParameters } from '../sensitivity'
import { compare } from '../compare'
import { createEmptyProject } from '../defaults'
import { createExampleProject } from '../example'

describe('Sensitivität', () => {
  it('lässt leere Blöcke aus dem Tornado heraus', () => {
    const p = createEmptyProject()
    p.settings.defaultEscalation = 0
    p.scenarios.onprem.entries.compute.opex = {
      active: true, amount: 100_000, period: 'year', startYear: 1, endYear: null, escalation: 0,
    }
    const { entries } = tornado(p, 'cashflow')
    expect(entries).toHaveLength(1)
    expect(entries[0].blockId).toBe('compute')
  })

  it('misst den Ausschlag als Wirkung auf die Gesamtdifferenz', () => {
    const p = createEmptyProject()
    p.settings.defaultEscalation = 0
    p.scenarios.onprem.entries.compute.opex = {
      active: true, amount: 100_000, period: 'year', startYear: 1, endYear: null, escalation: 0,
    }
    const { base, entries } = tornado(p, 'cashflow', 0.2, 5)
    expect(base).toBe(500_000)
    // −20 % auf einen On-Prem-Block senkt die Differenz um 100.000.
    expect(entries[0].low).toBeCloseTo(400_000, 6)
    expect(entries[0].high).toBeCloseTo(600_000, 6)
    expect(entries[0].swing).toBeCloseTo(100_000, 6)
  })

  it('sortiert nach Wirkung und begrenzt auf die Top-Einträge', () => {
    const { entries } = tornado(createExampleProject(), 'cashflow', 0.2, 3)
    expect(entries).toHaveLength(3)
    expect(entries[0].swing).toBeGreaterThanOrEqual(entries[1].swing)
    expect(entries[1].swing).toBeGreaterThanOrEqual(entries[2].swing)
  })

  it('verändert das Original nicht', () => {
    const p = createExampleProject()
    const before = compare(p, 'cashflow').delta
    tornado(p, 'cashflow')
    withParameters(p, { discountRate: 0.15, horizonYears: 3 })
    expect(compare(p, 'cashflow').delta).toBe(before)
  })

  it('verkürzt bei geringerer Laufzeit die Reihen', () => {
    const shorter = withParameters(createExampleProject(), { horizonYears: 3 })
    expect(compare(shorter, 'cashflow').onprem.totalByYear).toHaveLength(3)
  })
})
