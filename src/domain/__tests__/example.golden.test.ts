import { describe, expect, it } from 'vitest'
import { createExampleProject } from '../example'
import { compare } from '../compare'
import { computeScenario } from '../calc'
import { validateProject } from '../validate'

/**
 * Golden-Master: das Beispielszenario ist vollständig durchgerechnet und hier
 * mit festen Werten verankert.
 *
 * Ändert eine Anpassung an der Berechnungslogik eines dieser Ergebnisse,
 * schlägt der Test fehl und die Änderung muss bewusst bestätigt werden.
 * Alle Zahlen sind von Hand über die dokumentierten Formeln nachrechenbar.
 */
describe('Beispielszenario (Golden Master)', () => {
  const project = createExampleProject()

  it('rechnet die Cashflow-Sicht stabil', () => {
    const r = compare(project, 'cashflow')

    expect(r.onprem.totalByYear.map(Math.round)).toEqual([
      1_194_000, 1_419_660, 2_767_232, 1_546_804, 1_388_468,
    ])
    expect(r.cloud.totalByYear.map(Math.round)).toEqual([
      1_672_400, 1_333_092, 1_247_793, 1_287_343, 1_328_186,
    ])

    expect(Math.round(r.onprem.total)).toBe(8_316_164)
    expect(Math.round(r.cloud.total)).toBe(6_868_814)
    expect(Math.round(r.delta)).toBe(1_447_349)
    expect(r.deltaPercent).toBeCloseTo(0.174, 3)
  })

  it('erreicht den Break-even im dritten Jahr', () => {
    const r = compare(project, 'cashflow')
    expect(r.cumulativeDeltaByYear.map(Math.round)).toEqual([
      -478_400, -391_832, 1_127_607, 1_387_068, 1_447_349,
    ])
    expect(r.breakEvenYear).toBeCloseTo(2.2579, 4)
    // Diskontiert verschiebt sich der Break-even leicht nach hinten.
    expect(r.breakEvenYearDiscounted).toBeCloseTo(2.2995, 4)
  })

  it('weist den Barwertvorteil aus', () => {
    const r = compare(project, 'cashflow')
    expect(Math.round(r.npvDelta)).toBe(1_109_745)
    expect(r.npvDelta).toBeLessThan(r.delta) // Diskontierung mindert den Vorteil
  })

  it('amortisiert die Migrationsvorleistung in rund anderthalb Jahren', () => {
    const { migrationPayback } = compare(project, 'cashflow')
    expect(migrationPayback).not.toBeNull()
    expect(Math.round(migrationPayback!.upfront)).toBe(623_600)
    expect(migrationPayback!.years).toBeCloseTo(1.506, 3)
  })

  it('macht die nicht erfasste Restabschreibung in der P&L-Sicht sichtbar', () => {
    const onprem = computeScenario(project, 'onprem', 'pnl')
    const cloud = computeScenario(project, 'cloud', 'pnl')
    // Investitionen in den Jahren 2–4 mit 5 Jahren Nutzungsdauer ragen heraus.
    expect(Math.round(onprem.unrecognizedDepreciation)).toBe(754_000)
    // Die Migration ist über 3 Jahre ab Jahr 1 abgeschrieben und passt hinein.
    expect(cloud.unrecognizedDepreciation).toBe(0)
  })

  it('meldet den erwarteten Hinweis zum Cloud-Szenario und sonst nichts Kritisches', () => {
    const warnings = validateProject(project)
    expect(warnings.filter((w) => w.level === 'warn')).toEqual([])
  })
})
