import { describe, expect, it } from 'vitest'
import { capexEvents, computeScenario, depreciationSlices, npv } from '../calc'
import { compare, findBreakEven } from '../compare'
import { tornado } from '../sensitivity'
import { createEmptyProject } from '../defaults'
import { parseProject } from '../schema'
import type { CostView, Project, ScenarioKey } from '../types'

/**
 * Invariantenprüfung der Berechnung.
 *
 * Statt einzelne Beispiele nachzurechnen, werden hier Eigenschaften geprüft,
 * die für **jedes** Projekt gelten müssen. Das findet Fehler, die ein
 * handverlesener Testfall nie trifft.
 */

/** Deterministischer Zufall — ein Fehlschlag ist reproduzierbar. */
function makeRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function randomProject(seed: number): Project {
  const r = makeRandom(seed)
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)]
  const p = createEmptyProject()

  p.settings.horizonYears = 1 + Math.floor(r() * 10)
  p.settings.discountRate = pick([0, 0.03, 0.07, 0.15])
  p.settings.defaultEscalation = pick([-0.05, 0, 0.03, 0.1])
  const H = p.settings.horizonYears

  for (const key of ['onprem', 'cloud'] as ScenarioKey[]) {
    for (const block of p.blocks) {
      const entry = p.scenarios[key].entries[block.id]
      if (r() < 0.35) {
        entry.capex = {
          active: r() < 0.9,
          amount: Math.round(r() * 500_000) - 50_000, // auch negative Beträge
          origin: pick(['estimated', 'adjusted', 'confirmed'] as const),
          uncertainty: r() < 0.3 ? r() : null,
          year: 1 + Math.floor(r() * (H + 2)), // auch außerhalb der Laufzeit
          usefulLifeYears: 1 + Math.floor(r() * 8),
          refreshEveryYears: r() < 0.3 ? 1 + Math.floor(r() * 5) : null,
        }
      }
      if (r() < 0.5) {
        const start = 1 + Math.floor(r() * (H + 1))
        entry.opex = {
          active: r() < 0.9,
          amount: Math.round(r() * 80_000),
          origin: pick(['estimated', 'adjusted', 'confirmed'] as const),
          uncertainty: r() < 0.3 ? r() : null,
          period: pick(['month', 'year'] as const),
          startYear: start,
          endYear: r() < 0.4 ? start + Math.floor(r() * 4) : null,
          escalation: r() < 0.5 ? pick([-0.1, 0, 0.05]) : null,
        }
      }
      if (r() < 0.15) p.blocks.find((b) => b.id === block.id)!.enabled = false
    }
  }
  return p
}

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1)
const VIEWS: CostView[] = ['cashflow', 'pnl']

describe('Jahresreihen', () => {
  it('Summe über alle Blöcke entspricht der Gesamtzeile', () => {
    for (const seed of SEEDS) {
      const p = randomProject(seed)
      for (const view of VIEWS) {
        for (const key of ['onprem', 'cloud'] as ScenarioKey[]) {
          const s = computeScenario(p, key, view)
          s.years.forEach((_, i) => {
            const ausBloecken = p.blocks.reduce((sum, b) => sum + (s.byBlock[b.id]?.[i] ?? 0), 0)
            expect(ausBloecken, `Seed ${seed}, ${view}, ${key}, Jahr ${i + 1}`).toBeCloseTo(
              s.totalByYear[i],
              6,
            )
          })
        }
      }
    }
  })

  it('CapEx plus OpEx ergibt die Gesamtzeile, kumuliert endet auf der Summe', () => {
    for (const seed of SEEDS) {
      const p = randomProject(seed)
      for (const view of VIEWS) {
        const s = computeScenario(p, 'onprem', view)
        s.totalByYear.forEach((v, i) => {
          expect(v).toBeCloseTo(s.capexByYear[i] + s.opexByYear[i], 6)
        })
        expect(s.cumulativeByYear.at(-1)).toBeCloseTo(s.total, 6)
      }
    }
  })

  it('erzeugt niemals NaN oder Unendlich', () => {
    for (const seed of SEEDS) {
      const p = randomProject(seed)
      for (const view of VIEWS) {
        const r = compare(p, view)
        const alle = [
          ...r.onprem.totalByYear,
          ...r.cloud.totalByYear,
          ...r.deltaByYear,
          ...r.cumulativeDeltaByYear,
          r.delta,
          r.npvOnprem,
          r.npvCloud,
          r.npvDelta,
        ]
        for (const v of alle) expect(Number.isFinite(v), `Seed ${seed}, ${view}`).toBe(true)
      }
    }
  })
})

describe('Abschreibung', () => {
  /**
   * Die wichtigste Invariante der P&L-Sicht: Jeder investierte Euro taucht
   * entweder als Abschreibung im Zeitraum auf oder in der ausgewiesenen
   * Restabschreibung. Verschwindet Geld dazwischen, ist die Info-Zeile falsch
   * und die Abweichung zur Cashflow-Summe unerklärt.
   */
  it('verteilt jede Investition vollständig auf Zeitraum und Restabschreibung', () => {
    for (const seed of SEEDS) {
      const p = randomProject(seed)
      const H = p.settings.horizonYears

      for (const key of ['onprem', 'cloud'] as ScenarioKey[]) {
        for (const block of p.blocks) {
          const capex = p.scenarios[key].entries[block.id]?.capex
          if (!capex?.active) continue

          const investiert = capexEvents(capex, H).reduce((a, e) => a + e.amount, 0)
          const { within, unrecognized } = depreciationSlices(capex, H)
          const abgeschrieben = within.reduce((a, s) => a + s.amount, 0)

          expect(abgeschrieben + unrecognized, `Seed ${seed}, ${key}, ${block.id}`).toBeCloseTo(
            investiert,
            6,
          )
        }
      }
    }
  })

  it('legt Investitionen ausschließlich in den Betrachtungszeitraum', () => {
    for (const seed of SEEDS) {
      const p = randomProject(seed)
      const H = p.settings.horizonYears
      for (const key of ['onprem', 'cloud'] as ScenarioKey[]) {
        for (const block of p.blocks) {
          const capex = p.scenarios[key].entries[block.id]?.capex
          if (!capex?.active) continue
          for (const ev of capexEvents(capex, H)) {
            expect(ev.year, `Seed ${seed}`).toBeGreaterThanOrEqual(1)
            expect(ev.year, `Seed ${seed}`).toBeLessThanOrEqual(H)
          }
        }
      }
    }
  })
})

describe('Barwert', () => {
  it('entspricht bei Zinssatz null der undiskontierten Summe', () => {
    for (const seed of SEEDS) {
      const p = randomProject(seed)
      const s = computeScenario(p, 'onprem', 'cashflow')
      expect(npv(s.totalByYear, 0)).toBeCloseTo(s.total, 6)
    }
  })

  it('ist unabhängig von der angezeigten Sicht', () => {
    for (const seed of SEEDS) {
      const p = randomProject(seed)
      expect(compare(p, 'pnl').npvDelta).toBeCloseTo(compare(p, 'cashflow').npvDelta, 6)
    }
  })

  /**
   * Für die **Differenz** gilt nicht, dass der Barwert betragsmäßig kleiner
   * wäre als der Nominalwert: Wechselt die Jahresdifferenz das Vorzeichen,
   * wiegen frühe Jahre schwerer und der Barwert kann darüber liegen. Für ein
   * einzelnes Szenario mit nichtnegativen Jahreskosten gilt es dagegen immer.
   */
  it('senkt die Kosten eines Szenarios, je höher der Zinssatz', () => {
    for (const seed of SEEDS) {
      const p = randomProject(seed)
      for (const key of ['onprem', 'cloud'] as ScenarioKey[]) {
        const s = computeScenario(p, key, 'cashflow')
        if (!s.totalByYear.every((v) => v >= 0)) continue
        const ohne = npv(s.totalByYear, 0)
        const mittel = npv(s.totalByYear, 0.07)
        const hoch = npv(s.totalByYear, 0.15)
        expect(mittel, `Seed ${seed}, ${key}`).toBeLessThanOrEqual(ohne + 1e-6)
        expect(hoch, `Seed ${seed}, ${key}`).toBeLessThanOrEqual(mittel + 1e-6)
      }
    }
  })
})

describe('Vergleich und Break-even', () => {
  it('Differenz und kumulierte Differenz sind konsistent', () => {
    for (const seed of SEEDS) {
      const p = randomProject(seed)
      for (const view of VIEWS) {
        const r = compare(p, view)
        expect(r.delta).toBeCloseTo(r.onprem.total - r.cloud.total, 6)
        expect(r.cumulativeDeltaByYear.at(-1)).toBeCloseTo(r.delta, 6)
        r.deltaByYear.forEach((v, i) => {
          expect(v).toBeCloseTo(r.onprem.totalByYear[i] - r.cloud.totalByYear[i], 6)
        })
      }
    }
  })

  it('liegt der Break-even im gemeldeten Jahr und nirgends früher', () => {
    for (const seed of SEEDS) {
      const p = randomProject(seed)
      const r = compare(p, 'cashflow')
      const be = r.breakEvenYear
      if (be === null) {
        // Ohne Break-even darf die kumulierte Differenz nie positiv werden.
        expect(r.cumulativeDeltaByYear.every((v) => v <= 0), `Seed ${seed}`).toBe(true)
        continue
      }
      const jahr = Math.floor(be) // Index des Jahres, in dem gewechselt wird
      expect(r.cumulativeDeltaByYear[jahr], `Seed ${seed}`).toBeGreaterThan(0)
      if (jahr > 0) {
        expect(r.cumulativeDeltaByYear[jahr - 1], `Seed ${seed}`).toBeLessThanOrEqual(0)
      }
    }
  })

  it('interpoliert innerhalb des Wechseljahres', () => {
    expect(findBreakEven([-100, -50, 50])).toBeCloseTo(2.5, 10)
    expect(findBreakEven([-100, 300])).toBeCloseTo(1.25, 10)
    expect(findBreakEven([50])).toBe(0)
    expect(findBreakEven([-1, -1])).toBeNull()
    expect(findBreakEven([0, 0])).toBeNull()
  })
})

describe('Sensitivität', () => {
  it('meldet als Ausgangswert genau die Gesamtdifferenz', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const p = randomProject(seed)
      for (const view of VIEWS) {
        expect(tornado(p, view).base).toBeCloseTo(compare(p, view).delta, 6)
      }
    }
  })

  it('verändert das Projekt nicht', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const p = randomProject(seed)
      const vorher = JSON.stringify(p)
      tornado(p, 'cashflow', 2)
      expect(JSON.stringify(p)).toBe(vorher)
    }
  })

  it('skaliert den Ausschlag proportional zum Regler', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const p = randomProject(seed)
      const einfach = tornado(p, 'cashflow', 1).entries
      const doppelt = tornado(p, 'cashflow', 2).entries
      if (einfach.length === 0) continue
      const gleicherBlock = doppelt.find(
        (e) => e.blockId === einfach[0].blockId && e.scenario === einfach[0].scenario,
      )
      if (!gleicherBlock) continue
      expect(gleicherBlock.swing, `Seed ${seed}`).toBeCloseTo(einfach[0].swing * 2, 4)
    }
  })
})

describe('Speichern und Laden', () => {
  it('liefert nach Export und Import identische Ergebnisse', () => {
    for (const seed of SEEDS) {
      const p = randomProject(seed)
      const result = parseProject(JSON.parse(JSON.stringify(p)))
      expect(result.ok, `Seed ${seed}`).toBe(true)
      if (!result.ok) continue
      for (const view of VIEWS) {
        const a = compare(p, view)
        const b = compare(result.project, view)
        expect(b.delta, `Seed ${seed}, ${view}`).toBeCloseTo(a.delta, 6)
        expect(b.npvDelta).toBeCloseTo(a.npvDelta, 6)
      }
    }
  })
})
