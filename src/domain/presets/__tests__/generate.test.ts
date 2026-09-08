import { describe, expect, it } from 'vitest'
import { applyGenerated, confirmedBlockCount, generateScenarios } from '../generate'
import { createEmptyProject } from '../../defaults'
import { demoProfile } from '../profile'
import type { Profile, Project } from '../../types'

function profileOf(overrides: Partial<Profile> = {}): Profile {
  return { ...demoProfile(), ...overrides }
}

describe('Erzeugung', () => {
  it('markiert jede erzeugte Position als geschätzt', () => {
    const generated = generateScenarios(profileOf(), createEmptyProject().settings)
    for (const scenario of ['onprem', 'cloud'] as const) {
      for (const entry of Object.values(generated[scenario])) {
        expect(entry.capex?.origin ?? 'estimated').toBe('estimated')
        expect(entry.opex?.origin ?? 'estimated').toBe('estimated')
        expect(entry.noteOrigin).toBe('generated')
      }
    }
  })

  it('schreibt eine nachvollziehbare Herleitung in die Notiz', () => {
    const project = applyGenerated(createEmptyProject(), profileOf())
    const note = project.scenarios.onprem.entries.compute.note
    expect(note).toContain('Hosts')
    expect(note).toContain('je Einheit')
    expect(note).toContain('SOURCES.md')
    // Keine erfundene Herkunft.
    expect(note).not.toMatch(/Branchenmedian|Erfahrungswert|Vergleichsprojekt/i)
  })

  it('erzeugt ohne anstehenden Refresh keine On-Prem-Investition', () => {
    const project = applyGenerated(createEmptyProject(), profileOf({ refreshYear: 'outside' }))
    expect(project.scenarios.onprem.entries.compute.capex).toBeNull()
    expect(project.scenarios.onprem.entries.storage.capex).toBeNull()
    // Der laufende Aufwand bleibt bestehen.
    expect(project.scenarios.onprem.entries.licenses.opex?.amount).toBeGreaterThan(0)
  })

  it('legt die Migration unabhängig vom Refresh-Zyklus in Jahr 1', () => {
    const project = applyGenerated(createEmptyProject(), profileOf({ refreshYear: 4 }))
    expect(project.scenarios.cloud.entries.migration.capex?.year).toBe(1)
    expect(project.scenarios.onprem.entries.compute.capex?.year).toBe(4)
  })

  it('lässt den Rechenzentrumsblock beim externen Hoster leer', () => {
    const project = applyGenerated(createEmptyProject(), profileOf({ operatingModel: 'hoster' }))
    expect(project.scenarios.onprem.entries.facility.opex).toBeNull()
  })

  it('erhöht Security und Personal mit dem Regulierungsgrad', () => {
    const standard = applyGenerated(createEmptyProject(), profileOf({ regulation: 'standard' }))
    const streng = applyGenerated(createEmptyProject(), profileOf({ regulation: 'high' }))
    expect(streng.scenarios.onprem.entries.security.opex!.amount).toBeGreaterThan(
      standard.scenarios.onprem.entries.security.opex!.amount,
    )
    expect(streng.scenarios.onprem.entries.staff.opex!.amount).toBeGreaterThan(
      standard.scenarios.onprem.entries.staff.opex!.amount,
    )
  })

  it('merkt sich das verwendete Profil im Projekt', () => {
    const project = applyGenerated(createEmptyProject(), profileOf({ vmCount: 77 }))
    expect(project.profile?.vmCount).toBe(77)
  })
})

describe('Zusammenführung — die Kernregel', () => {
  /**
   * Der wichtigste Test der ganzen Erweiterung: ein erneutes Generieren darf
   * ausschließlich geschätzte Positionen anfassen.
   */
  function withOverrides(project: Project): Project {
    const next: Project = structuredClone(project)
    // Von Hand angepasst
    next.scenarios.onprem.entries.storage.capex!.amount = 999_999
    next.scenarios.onprem.entries.storage.capex!.origin = 'adjusted'
    // Vom Kunden bestätigt
    next.scenarios.cloud.entries.compute.opex!.amount = 111_111
    next.scenarios.cloud.entries.compute.opex!.origin = 'confirmed'
    // Eigene Notiz
    next.scenarios.onprem.entries.licenses.note = 'Angabe des Kunden vom 8.9.'
    next.scenarios.onprem.entries.licenses.noteOrigin = 'manual'
    return next
  }

  it('überschreibt geschätzte Positionen', () => {
    const first = applyGenerated(createEmptyProject(), profileOf({ vmCount: 100 }))
    const second = applyGenerated(first, profileOf({ vmCount: 300 }))
    expect(second.scenarios.cloud.entries.compute.opex!.amount).toBeGreaterThan(
      first.scenarios.cloud.entries.compute.opex!.amount,
    )
  })

  it('lässt angepasste und bestätigte Positionen unangetastet', () => {
    const edited = withOverrides(applyGenerated(createEmptyProject(), profileOf()))
    const again = applyGenerated(edited, profileOf({ vmCount: 400 }))

    expect(again.scenarios.onprem.entries.storage.capex!.amount).toBe(999_999)
    expect(again.scenarios.onprem.entries.storage.capex!.origin).toBe('adjusted')
    expect(again.scenarios.cloud.entries.compute.opex!.amount).toBe(111_111)
    expect(again.scenarios.cloud.entries.compute.opex!.origin).toBe('confirmed')
  })

  it('ersetzt selbst geschriebene Notizen nicht', () => {
    const edited = withOverrides(applyGenerated(createEmptyProject(), profileOf()))
    const again = applyGenerated(edited, profileOf({ vmCount: 400 }))
    expect(again.scenarios.onprem.entries.licenses.note).toBe('Angabe des Kunden vom 8.9.')
    expect(again.scenarios.onprem.entries.licenses.noteOrigin).toBe('manual')
  })

  it('hält die Regel über drei aufeinanderfolgende Läufe', () => {
    let project = withOverrides(applyGenerated(createEmptyProject(), profileOf({ vmCount: 50 })))

    for (const vmCount of [120, 260, 500]) {
      project = applyGenerated(project, profileOf({ vmCount }))
      expect(project.scenarios.onprem.entries.storage.capex!.amount).toBe(999_999)
      expect(project.scenarios.cloud.entries.compute.opex!.amount).toBe(111_111)
      expect(project.scenarios.onprem.entries.licenses.note).toBe('Angabe des Kunden vom 8.9.')
    }

    // Geschätzte Positionen sind trotzdem mitgewachsen.
    expect(project.scenarios.onprem.entries.licenses.opex!.amount).toBeGreaterThan(
      applyGenerated(createEmptyProject(), profileOf({ vmCount: 50 })).scenarios.onprem.entries
        .licenses.opex!.amount,
    )
  })

  it('lässt selbst angelegte Blöcke unberührt', () => {
    const project = createEmptyProject()
    project.blocks.push({ id: 'eigener', name: 'Eigener Block', enabled: true, order: 99 })
    project.scenarios.onprem.entries.eigener = {
      blockId: 'eigener',
      note: 'meins',
      noteOrigin: 'manual',
      capex: null,
      opex: {
        active: true, amount: 40_000, origin: 'adjusted', uncertainty: null,
        period: 'year', startYear: 1, endYear: null, escalation: null,
      },
    }
    const after = applyGenerated(project, profileOf())
    expect(after.scenarios.onprem.entries.eigener.opex!.amount).toBe(40_000)
    expect(after.scenarios.onprem.entries.eigener.note).toBe('meins')
  })
})

describe('Zähler der Kundenbestätigungen', () => {
  it('zählt nur Blöcke, deren sämtliche aktiven Positionen bestätigt sind', () => {
    const project = applyGenerated(createEmptyProject(), profileOf())
    expect(confirmedBlockCount(project).confirmed).toBe(0)

    // Compute hat On-Prem eine CapEx- und Cloud eine OpEx-Zeile.
    project.scenarios.onprem.entries.compute.capex!.origin = 'confirmed'
    expect(confirmedBlockCount(project).confirmed).toBe(0) // noch nicht vollständig

    project.scenarios.cloud.entries.compute.opex!.origin = 'confirmed'
    expect(confirmedBlockCount(project).confirmed).toBe(1)
  })
})
