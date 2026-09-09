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

  it('schreibt eine im Gespräch vorlesbare Herleitung in die Notiz', () => {
    const project = applyGenerated(createEmptyProject(), profileOf())
    const note = project.scenarios.onprem.entries.compute.note
    expect(note).toContain('Hosts')
    expect(note).toContain('Richtwert aus Marktdaten')
    // Keine erfundene Herkunft.
    expect(note).not.toMatch(/Branchenmedian|Erfahrungswert|Vergleichsprojekt/i)
    // Keine Entwickler-Artefakte im Text, den der Kunde zu hören bekommt.
    expect(note).not.toMatch(/SOURCES\.md|\.ts\b|coefficients/i)
  })

  it('erklärt, wie die Hostzahl zustande kommt', () => {
    const project = applyGenerated(createEmptyProject(), profileOf({ vmCount: 150 }))
    const note = project.scenarios.onprem.entries.compute.note
    expect(note).toContain('VMs je Host')
    expect(note).toContain('Reserveknoten')
  })

  it('erklärt den Personalbedarf und den Unterschied zur Cloud', () => {
    const project = applyGenerated(createEmptyProject(), profileOf())
    expect(project.scenarios.onprem.entries.staff.note).toContain('je Vollzeitkraft')
    expect(project.scenarios.cloud.entries.staff.note).toContain('Hardwarebetreuung')
  })

  it('weist aus, wenn der Speicherbedarf nur abgeleitet ist', () => {
    const abgeleitet = applyGenerated(createEmptyProject(), profileOf({ storageTB: null }))
    const angegeben = applyGenerated(createEmptyProject(), profileOf({ storageTB: 200 }))
    expect(abgeleitet.scenarios.onprem.entries.storage.note).toContain('abgeleitet')
    expect(angegeben.scenarios.onprem.entries.storage.note).not.toContain('abgeleitet')
  })

  /**
   * Die Notiz ist das Versprechen, dass jede Zahl nachrechenbar ist. Wenn die
   * dort ausgewiesene Multiplikation nicht exakt den Betrag im Feld ergibt,
   * ist das Versprechen gebrochen — auch bei kleinen Rundungsabweichungen.
   */
  it('weist eine Rechnung aus, die exakt den Betrag im Feld ergibt', () => {
    const project = applyGenerated(createEmptyProject(), profileOf())
    let geprueft = 0

    const parse = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'))

    for (const scenario of ['onprem', 'cloud'] as const) {
      for (const entry of Object.values(project.scenarios[scenario].entries)) {
        // Je aktiver Zeile ein durch Leerzeile getrennter Abschnitt,
        // in der Reihenfolge CapEx, dann OpEx.
        const aktive = [entry.capex, entry.opex].filter((l) => l?.active)
        if (aktive.length === 0) continue
        const abschnitte = entry.note.split('\n\n').filter((a) => a.includes('×'))
        expect(abschnitte, `${entry.blockId}/${scenario}`).toHaveLength(aktive.length)

        aktive.forEach((line, i) => {
          const rechnung = abschnitte[i].split('\n')[1]
          const zahlen = rechnung.match(/([\d.]+(?:,\d+)?)/g)!
          expect(
            Math.round(parse(zahlen[0]) * parse(zahlen[1])),
            `${entry.blockId}/${scenario}: ${rechnung}`,
          ).toBe(Math.round(line!.amount))
          geprueft++
        })
      }
    }

    expect(geprueft).toBeGreaterThan(10)
  })

  it('verzichtet in allen Notizen auf Entwicklerbegriffe', () => {
    const project = applyGenerated(createEmptyProject(), profileOf())
    for (const scenario of ['onprem', 'cloud'] as const) {
      for (const entry of Object.values(project.scenarios[scenario].entries)) {
        expect(entry.note, entry.blockId).not.toMatch(/SOURCES\.md|CapEx-Share|null|undefined/i)
      }
    }
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

  /**
   * Eine abgewählte Kostenzeile ist eine Entscheidung des Beraters, kein
   * fehlender Wert. Sie darf ein erneutes Generieren überstehen — sonst
   * taucht die gerade entfernte Investition beim nächsten Lauf wieder auf.
   */
  it('bringt eine bewusst abgewählte Zeile nicht zurück', () => {
    const project = applyGenerated(createEmptyProject(), profileOf())
    expect(project.scenarios.onprem.entries.compute.capex?.active).toBe(true)

    // So wirkt das Abwählen im UI: inaktiv, und damit eine eigene Angabe.
    project.scenarios.onprem.entries.compute.capex = {
      ...project.scenarios.onprem.entries.compute.capex!,
      active: false,
      origin: 'adjusted',
    }

    const danach = applyGenerated(project, profileOf({ vmCount: 400 }))
    expect(danach.scenarios.onprem.entries.compute.capex?.active).toBe(false)
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
