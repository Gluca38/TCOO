import { describe, expect, it } from 'vitest'
import { tornado, withParameters } from '../sensitivity'
import { compare } from '../compare'
import { createEmptyProject } from '../defaults'
import { createReferenceProject } from './referenceProject'

describe('Sensitivität', () => {
  it('lässt leere Blöcke aus dem Tornado heraus', () => {
    const p = createEmptyProject()
    p.settings.defaultEscalation = 0
    p.scenarios.onprem.entries.compute.opex = {
      active: true, amount: 100_000, origin: 'estimated', uncertainty: null, period: 'year', startYear: 1, endYear: null, escalation: 0,
    }
    const { entries } = tornado(p, 'cashflow')
    expect(entries).toHaveLength(1)
    expect(entries[0].blockId).toBe('compute')
  })

  it('leitet die Bandbreite aus dem Herkunftsstatus ab', () => {
    const p = createEmptyProject()
    p.settings.defaultEscalation = 0
    p.scenarios.onprem.entries.compute.opex = {
      active: true, amount: 100_000, origin: 'estimated', uncertainty: null,
      period: 'year', startYear: 1, endYear: null, escalation: 0,
    }
    const { base, entries } = tornado(p, 'cashflow', 1, 5)
    expect(base).toBe(500_000)
    // Geschätzt = ±35 % auf 500.000 über fünf Jahre.
    expect(entries[0].uncertainty).toBeCloseTo(0.35, 6)
    expect(entries[0].low).toBeCloseTo(325_000, 6)
    expect(entries[0].high).toBeCloseTo(675_000, 6)
    expect(entries[0].swing).toBeCloseTo(175_000, 6)
  })

  it('verkleinert die Bandbreite mit besserer Datenlage', () => {
    const p = createEmptyProject()
    p.settings.defaultEscalation = 0
    const line = {
      active: true, amount: 100_000, origin: 'estimated' as const, uncertainty: null,
      period: 'year' as const, startYear: 1, endYear: null, escalation: 0,
    }
    p.scenarios.onprem.entries.compute.opex = { ...line }
    const geschaetzt = tornado(p, 'cashflow').entries[0].swing

    p.scenarios.onprem.entries.compute.opex = { ...line, origin: 'adjusted' }
    const angepasst = tornado(p, 'cashflow').entries[0].swing

    p.scenarios.onprem.entries.compute.opex = { ...line, origin: 'confirmed' }
    const bestaetigt = tornado(p, 'cashflow').entries[0].swing

    expect(geschaetzt).toBeGreaterThan(angepasst)
    expect(angepasst).toBeGreaterThan(bestaetigt)
    expect(bestaetigt).toBeCloseTo(25_000, 6) // 5 % auf 500.000
  })

  it('lässt eine eigene Bandbreite den Default schlagen', () => {
    const p = createEmptyProject()
    p.settings.defaultEscalation = 0
    p.scenarios.onprem.entries.compute.opex = {
      active: true, amount: 100_000, origin: 'estimated', uncertainty: 0.1,
      period: 'year', startYear: 1, endYear: null, escalation: 0,
    }
    expect(tornado(p, 'cashflow').entries[0].swing).toBeCloseTo(50_000, 6)
  })

  it('wirkt als Multiplikator, nicht als Absolutwert', () => {
    const p = createEmptyProject()
    p.settings.defaultEscalation = 0
    p.scenarios.onprem.entries.compute.opex = {
      active: true, amount: 100_000, origin: 'confirmed', uncertainty: null,
      period: 'year', startYear: 1, endYear: null, escalation: 0,
    }
    const einfach = tornado(p, 'cashflow', 1).entries[0].swing
    const doppelt = tornado(p, 'cashflow', 2).entries[0].swing
    expect(doppelt).toBeCloseTo(einfach * 2, 6)
  })

  it('sortiert nach Wirkung und begrenzt auf die Top-Einträge', () => {
    const { entries } = tornado(createReferenceProject(), 'cashflow', 1, 3)
    expect(entries).toHaveLength(3)
    expect(entries[0].swing).toBeGreaterThanOrEqual(entries[1].swing)
    expect(entries[1].swing).toBeGreaterThanOrEqual(entries[2].swing)
  })

  it('verändert das Original nicht', () => {
    const p = createReferenceProject()
    const before = compare(p, 'cashflow').delta
    tornado(p, 'cashflow')
    withParameters(p, { discountRate: 0.15, horizonYears: 3 })
    expect(compare(p, 'cashflow').delta).toBe(before)
  })

  it('verkürzt bei geringerer Laufzeit die Reihen', () => {
    const shorter = withParameters(createReferenceProject(), { horizonYears: 3 })
    expect(compare(shorter, 'cashflow').onprem.totalByYear).toHaveLength(3)
  })
})
