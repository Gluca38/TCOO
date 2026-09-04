import { describe, expect, it } from 'vitest'
import { parseProject, repairEntries } from '../schema'
import { createEmptyProject } from '../defaults'
import { createExampleProject } from '../example'
import { SCHEMA_VERSION } from '../types'

describe('Import', () => {
  it('akzeptiert ein unverändert exportiertes Projekt', () => {
    const original = createExampleProject()
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
      blockId: 'geloescht', note: '', capex: null, opex: null,
    }
    expect(repairEntries(p).scenarios.onprem.entries.geloescht).toBeUndefined()
  })
})
