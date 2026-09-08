import { describe, expect, it } from 'vitest'
import { parseProject, repairEntries } from '../schema'
import { createEmptyProject } from '../defaults'
import { createReferenceProject } from './referenceProject'
import { SCHEMA_VERSION } from '../types'

describe('Import', () => {
  it('akzeptiert ein unverändert exportiertes Projekt', () => {
    const original = createReferenceProject()
    const roundTrip = JSON.parse(JSON.stringify(original))
    const result = parseProject(roundTrip)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.project.meta.title).toBe(original.meta.title)
  })

  it('meldet fehlende Felder im Klartext statt still zu scheitern', () => {
    const broken = JSON.parse(JSON.stringify(createEmptyProject()))
    delete broken.settings.discountRate
    const result = parseProject(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('settings.discountRate')
    }
  })

  it('lehnt Dateien neuerer Schema-Versionen ab', () => {
    const future = JSON.parse(JSON.stringify(createEmptyProject()))
    future.schemaVersion = SCHEMA_VERSION + 1
    const result = parseProject(future)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toContain('neueren Version')
  })

  it('weist unplausible Einstellungen zurück', () => {
    const bad = JSON.parse(JSON.stringify(createEmptyProject()))
    bad.settings.horizonYears = 42
    expect(parseProject(bad).ok).toBe(false)
  })

  it('ergänzt fehlende Blockeinträge, statt still mit Lücken zu rechnen', () => {
    const p = createEmptyProject()
    delete p.scenarios.cloud.entries.storage
    const repaired = repairEntries(p)
    expect(repaired.scenarios.cloud.entries.storage).toBeDefined()
    expect(repaired.scenarios.cloud.entries.storage.capex).toBeNull()
  })

  it('entfernt Einträge ohne zugehörigen Block', () => {
    const p = createEmptyProject()
    p.scenarios.onprem.entries.geloescht = {
      blockId: 'geloescht', note: '', noteOrigin: 'manual', capex: null, opex: null,
    }
    expect(repairEntries(p).scenarios.onprem.entries.geloescht).toBeUndefined()
  })
})

describe('Migration von Version 1', () => {
  /**
   * Ein Speicherstand aus Version 1 enthält ausschließlich von Hand erfasste
   * Werte. Sie müssen als „angepasst" ankommen, damit ein Generierungslauf
   * sie niemals überschreibt.
   */
  function v1Project() {
    return {
      schemaVersion: 1,
      meta: { title: 'Alt', notes: '', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      settings: {
        startYear: 2026, horizonYears: 5, discountRate: 0.07,
        defaultEscalation: 0.03, view: 'cashflow', discounted: false,
      },
      blocks: [{ id: 'compute', name: 'Compute / Server', enabled: true, order: 0 }],
      scenarios: {
        onprem: {
          key: 'onprem', name: 'On-Premises', notes: '',
          entries: {
            compute: {
              blockId: 'compute',
              note: 'Angebot der Firma Meier',
              capex: {
                active: true, amount: 500_000, year: 1,
                usefulLifeYears: 5, refreshEveryYears: null,
              },
              opex: null,
            },
          },
        },
        cloud: {
          key: 'cloud', name: 'T Cloud Public', notes: '',
          entries: { compute: { blockId: 'compute', note: '', capex: null, opex: null } },
        },
      },
    }
  }

  it('stuft übernommene Positionen als angepasst ein', () => {
    const result = parseProject(v1Project())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const capex = result.project.scenarios.onprem.entries.compute.capex!
    expect(capex.origin).toBe('adjusted')
    expect(capex.uncertainty).toBeNull()
    expect(capex.amount).toBe(500_000)
  })

  it('schützt vorhandene Notizen vor dem Überschreiben', () => {
    const result = parseProject(v1Project())
    if (!result.ok) throw new Error('Migration fehlgeschlagen')
    const entry = result.project.scenarios.onprem.entries.compute
    expect(entry.noteOrigin).toBe('manual')
    expect(entry.note).toBe('Angebot der Firma Meier')
  })

  it('hebt die Schema-Version an und meldet die Herkunft', () => {
    const result = parseProject(v1Project())
    if (!result.ok) throw new Error('Migration fehlgeschlagen')
    expect(result.project.schemaVersion).toBe(SCHEMA_VERSION)
    expect(result.migratedFrom).toBe(1)
    expect(result.project.profile).toBeNull()
  })
})
