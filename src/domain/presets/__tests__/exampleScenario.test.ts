import { describe, expect, it } from 'vitest'
import { BLOCK_GUIDANCE, createExampleProject } from '../exampleScenario'
import { createEmptyProject } from '../../defaults'
import { compare } from '../../compare'

describe('Beispielszenario', () => {
  const project = createExampleProject()

  it('erklärt in jedem Block, was dort hineingehört', () => {
    for (const block of project.blocks) {
      const onprem = project.scenarios.onprem.entries[block.id].note
      const cloud = project.scenarios.cloud.entries[block.id].note
      expect(onprem.length, `${block.id} On-Prem`).toBeGreaterThan(40)
      expect(cloud.length, `${block.id} Cloud`).toBeGreaterThan(40)
    }
  })

  it('behält die Herleitung neben der Erklärung', () => {
    const note = project.scenarios.onprem.entries.compute.note
    expect(note).toContain('Hierher gehört')
    expect(note).toContain('Hosts')
    expect(note).toContain('SOURCES.md')
  })

  it('erklärt auch die Blöcke, die bewusst leer bleiben', () => {
    // Rechenzentrum in der Cloud und Migration im Weiterbetrieb.
    expect(project.scenarios.cloud.entries.facility.note).toContain('doppelt')
    expect(project.scenarios.onprem.entries.migration.note).toContain('leer')
    expect(project.scenarios.cloud.entries.facility.opex).toBeNull()
    expect(project.scenarios.onprem.entries.migration.capex).toBeNull()
  })

  it('deckt jeden Block des Standardkatalogs ab', () => {
    for (const block of createEmptyProject().blocks) {
      expect(BLOCK_GUIDANCE[block.id], `Erklärung fehlt für ${block.id}`).toBeDefined()
    }
  })

  it('trägt Beträge in beiden Szenarien', () => {
    const r = compare(project, 'cashflow')
    expect(r.onprem.total).toBeGreaterThan(0)
    expect(r.cloud.total).toBeGreaterThan(0)
  })

  it('ist als Beispiel erkennbar', () => {
    expect(project.meta.title).toMatch(/^Beispiel/)
    expect(project.meta.notes).toContain('Beispieldaten')
  })

  it('rechnet mit denselben Koeffizienten wie die Vorbefüllung', () => {
    // Die Zahlen dürfen nicht getrennt gepflegt werden und auseinanderdriften.
    const generated = createExampleProject()
    expect(generated.scenarios.onprem.entries.compute.capex?.amount).toBe(
      project.scenarios.onprem.entries.compute.capex?.amount,
    )
  })
})
