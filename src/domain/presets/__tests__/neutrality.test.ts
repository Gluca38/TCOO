import { describe, expect, it } from 'vitest'
import { applyGenerated, derive } from '../generate'
import { BLOCK_COEFFICIENTS } from '../coefficients'
import { createEmptyProject } from '../../defaults'
import { compare } from '../../compare'
import type { Profile } from '../../types'

/**
 * Neutralitätsprüfung.
 *
 * Die Vorbefüllung darf das Ergebnis nicht systematisch in Richtung Cloud
 * kippen. Ein Kunde, der eine Schieflage bemerkt, glaubt danach keiner Zahl
 * mehr.
 *
 * Diese Tests halten Fälle fest, in denen On-Premises gewinnen MUSS.
 * Schlagen sie fehl, sind die Koeffizienten schief — dann gehören die
 * Koeffizienten korrigiert, nicht die Schwellen hier.
 */

function profileOf(overrides: Partial<Profile>): Profile {
  return {
    vmCount: 100,
    employeeCount: null,
    storageTB: null,
    refreshYear: 3,
    operatingModel: 'own-dc',
    regulation: 'standard',
    vmsPerHost: null,
    vmsPerFte: null,
    ...overrides,
  }
}

/** Positiv = Cloud günstiger. Negativ = On-Premises günstiger. */
function deltaFor(profile: Profile): number {
  const project = applyGenerated(createEmptyProject(), profile)
  return compare(project, 'cashflow').delta
}

describe('On-Premises muss gewinnen', () => {
  it('bei kurz zurückliegendem Hardware-Refresh und kleiner Umgebung', () => {
    const delta = deltaFor(profileOf({ vmCount: 25, refreshYear: 'outside' }))
    expect(delta).toBeLessThan(0)
  })

  it('bei sehr kleiner Umgebung ohne anstehende Investition', () => {
    const delta = deltaFor(profileOf({ vmCount: 10, refreshYear: 'outside' }))
    expect(delta).toBeLessThan(0)
  })

  it('bei Colocation ohne anstehende Investition', () => {
    const delta = deltaFor(
      profileOf({ vmCount: 60, refreshYear: 'outside', operatingModel: 'colocation' }),
    )
    expect(delta).toBeLessThan(0)
  })

  it('bei hohem Standardisierungsgrad — viele VMs je Host und je Vollzeitkraft', () => {
    const delta = deltaFor(
      profileOf({ vmCount: 200, refreshYear: 'outside', vmsPerHost: 40, vmsPerFte: 200 }),
    )
    expect(delta).toBeLessThan(0)
  })
})

describe('Cloud muss gewinnen', () => {
  /**
   * Das Modell kippt nicht über die Größe der Umgebung — alle Kosten skalieren
   * annähernd linear mit der VM-Zahl, und in der Realität wird On-Premises mit
   * zunehmender Größe eher günstiger, nicht teurer.
   *
   * Was tatsächlich kippt, ist der **Wirkungsgrad des Eigenbetriebs**. Eine
   * schlecht konsolidierte Umgebung braucht viele Hosts für dieselbe Zahl an
   * VMs und trägt entsprechend Hardware-, Wartungs-, Lizenz- und
   * Rechenzentrumskosten mit.
   */
  it('bei schlecht konsolidierter Umgebung', () => {
    const delta = deltaFor(profileOf({ vmCount: 150, refreshYear: 1, vmsPerHost: 6 }))
    expect(delta).toBeGreaterThan(0)
  })

  it('bei schlechter Konsolidierung und personalintensivem Betrieb', () => {
    const delta = deltaFor(
      profileOf({ vmCount: 150, refreshYear: 1, vmsPerHost: 6, vmsPerFte: 25 }),
    )
    expect(delta).toBeGreaterThan(0)
  })
})

describe('Der Refresh-Zeitpunkt schlägt durch', () => {
  /**
   * Der Refresh kippt bei einer gut geführten Umgebung nicht das Vorzeichen —
   * dort ist On-Premises auch mit Ersatzinvestition günstiger. Er ist aber der
   * stärkste einzelne Hebel und muss das Ergebnis deutlich bewegen.
   */
  it('verschiebt das Ergebnis um mehr als ein Fünftel der On-Prem-Summe', () => {
    const base = { vmCount: 150, operatingModel: 'own-dc' as const }
    const mitInvestition = deltaFor(profileOf({ ...base, refreshYear: 1 }))
    const ohneInvestition = deltaFor(profileOf({ ...base, refreshYear: 'outside' }))

    // Ohne anstehende Investition steht On-Premises deutlich besser da.
    expect(ohneInvestition).toBeLessThan(mitInvestition)

    const project = applyGenerated(
      createEmptyProject(),
      profileOf({ ...base, refreshYear: 1 }),
    )
    const onpremTotal = compare(project, 'cashflow').onprem.total
    expect(Math.abs(mitInvestition - ohneInvestition) / onpremTotal).toBeGreaterThan(0.2)
  })

  it('kippt das Vorzeichen, wo das Ergebnis ohnehin knapp ist', () => {
    // Schlecht konsolidiert: hier entscheidet der Refresh tatsächlich.
    const base = { vmCount: 150, vmsPerHost: 8 }
    expect(deltaFor(profileOf({ ...base, refreshYear: 1 }))).toBeGreaterThan(0)
    expect(deltaFor(profileOf({ ...base, refreshYear: 'outside' }))).toBeLessThan(0)
  })
})

describe('Struktur der Koeffiziententabelle', () => {
  it('lässt nur beim Rechenzentrum ein fehlendes Cloud-Gegenstück zu', () => {
    const nurOnprem = Object.entries(BLOCK_COEFFICIENTS)
      .filter(([, c]) => c.onprem !== null && c.cloud === null)
      .map(([id]) => id)
    expect(nurOnprem).toEqual(['facility'])
  })

  it('lässt nur bei der Migration ein fehlendes On-Prem-Gegenstück zu', () => {
    const nurCloud = Object.entries(BLOCK_COEFFICIENTS)
      .filter(([, c]) => c.cloud !== null && c.onprem === null)
      .map(([id]) => id)
    expect(nurCloud).toEqual(['migration'])
  })

  it('setzt keinen Cloud-Wert auf null, wo On-Premises Kosten trägt', () => {
    for (const [id, c] of Object.entries(BLOCK_COEFFICIENTS)) {
      if (id === 'facility' || id === 'migration') continue
      const onpremCost = (c.onprem?.capex?.unitCost ?? 0) + (c.onprem?.opex?.unitCost ?? 0)
      const cloudCost = (c.cloud?.capex?.unitCost ?? 0) + (c.cloud?.opex?.unitCost ?? 0)
      expect(onpremCost, `${id}: On-Prem`).toBeGreaterThan(0)
      expect(cloudCost, `${id}: Cloud`).toBeGreaterThan(0)
    }
  })
})

describe('Mengengerüst', () => {
  it('leitet Hosts, Storage und Personal nachvollziehbar ab', () => {
    const d = derive(profileOf({ vmCount: 150, vmsPerHost: 20, vmsPerFte: 80 }))
    expect(d.hosts).toBe(9) // aufgerundet aus 150 / 20, plus ein Reserveknoten (N+1)
    expect(d.storageTB).toBeCloseTo(120, 6) // 150 × 0,8
    expect(d.fteOnprem).toBeCloseTo(1.875, 6) // 150 / 80, Regulierung standard
    expect(d.fteCloud).toBeCloseTo(1.875 * 0.75, 6)
  })

  it('rechnet die Mitarbeiterzahl um, wenn keine VM-Zahl vorliegt', () => {
    const d = derive(profileOf({ vmCount: 0, employeeCount: 400 }))
    expect(d.vmCount).toBe(140) // 400 × 0,35
  })
})
