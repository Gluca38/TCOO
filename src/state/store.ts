import { create } from 'zustand'
import type {
  Block,
  BlockEntry,
  BlockId,
  CapexLine,
  CostView,
  OpexLine,
  Project,
  ScenarioKey,
  Settings,
} from '../domain/types'
import { createEmptyProject, emptyEntry, newCapexLine, newOpexLine } from '../domain/defaults'
import { createExampleProject } from '../domain/example'
import { repairEntries } from '../domain/schema'
import { repository } from './repository'

interface StoreState {
  project: Project
  hydrated: boolean
  /** Zellauswahl für die Aufschlüsselung. null = Panel geschlossen. */
  drilldown: { scenario: ScenarioKey; year: number; blockId?: BlockId } | null

  hydrate: () => Promise<void>
  replaceProject: (project: Project) => void
  loadExample: () => void
  reset: () => void

  updateMeta: (patch: Partial<Project['meta']>) => void
  updateSettings: (patch: Partial<Settings>) => void
  setView: (view: CostView) => void

  addBlock: (name: string) => void
  updateBlock: (id: BlockId, patch: Partial<Block>) => void
  removeBlock: (id: BlockId) => void
  moveBlock: (id: BlockId, direction: -1 | 1) => void

  updateScenario: (key: ScenarioKey, patch: Partial<{ name: string; notes: string }>) => void
  updateEntry: (key: ScenarioKey, blockId: BlockId, patch: Partial<BlockEntry>) => void
  updateCapex: (key: ScenarioKey, blockId: BlockId, patch: Partial<CapexLine> | null) => void
  updateOpex: (key: ScenarioKey, blockId: BlockId, patch: Partial<OpexLine> | null) => void

  setDrilldown: (value: StoreState['drilldown']) => void
}

/** Zentrale Mutation: schreibt das Projekt fort und speichert es weg. */
function commit(set: (fn: (s: StoreState) => Partial<StoreState>) => void, mutate: (draft: Project) => void) {
  set((state) => {
    const draft: Project = structuredClone(state.project)
    mutate(draft)
    draft.meta.updatedAt = new Date().toISOString()
    void repository.save(draft)
    return { project: draft }
  })
}

export const useStore = create<StoreState>((set, get) => ({
  project: createEmptyProject(),
  hydrated: false,
  drilldown: null,

  hydrate: async () => {
    const stored = await repository.load()
    set({ project: stored ?? createEmptyProject(), hydrated: true })
  },

  replaceProject: (project) => {
    const repaired = repairEntries(project)
    void repository.save(repaired)
    set({ project: repaired, drilldown: null })
  },

  loadExample: () => get().replaceProject(createExampleProject()),

  reset: () => {
    const fresh = createEmptyProject()
    void repository.save(fresh)
    set({ project: fresh, drilldown: null })
  },

  updateMeta: (patch) => commit(set, (d) => Object.assign(d.meta, patch)),

  updateSettings: (patch) =>
    commit(set, (d) => {
      Object.assign(d.settings, patch)
      // Der Barwert setzt Zahlungsströme voraus und ist in der P&L-Sicht
      // deshalb nicht anwendbar.
      if (d.settings.view === 'pnl') d.settings.discounted = false
    }),

  setView: (view) =>
    commit(set, (d) => {
      d.settings.view = view
      if (view === 'pnl') d.settings.discounted = false
    }),

  addBlock: (name) =>
    commit(set, (d) => {
      const id = `custom-${Date.now().toString(36)}`
      d.blocks.push({ id, name, enabled: true, order: d.blocks.length })
      d.scenarios.onprem.entries[id] = emptyEntry(id)
      d.scenarios.cloud.entries[id] = emptyEntry(id)
    }),

  updateBlock: (id, patch) =>
    commit(set, (d) => {
      const block = d.blocks.find((b) => b.id === id)
      if (block) Object.assign(block, patch)
    }),

  removeBlock: (id) =>
    commit(set, (d) => {
      d.blocks = d.blocks.filter((b) => b.id !== id)
      d.blocks.forEach((b, i) => (b.order = i))
      delete d.scenarios.onprem.entries[id]
      delete d.scenarios.cloud.entries[id]
    }),

  moveBlock: (id, direction) =>
    commit(set, (d) => {
      const index = d.blocks.findIndex((b) => b.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= d.blocks.length) return
      const [block] = d.blocks.splice(index, 1)
      d.blocks.splice(target, 0, block)
      d.blocks.forEach((b, i) => (b.order = i))
    }),

  updateScenario: (key, patch) => commit(set, (d) => Object.assign(d.scenarios[key], patch)),

  updateEntry: (key, blockId, patch) =>
    commit(set, (d) => {
      const entry = d.scenarios[key].entries[blockId] ?? emptyEntry(blockId)
      d.scenarios[key].entries[blockId] = { ...entry, ...patch }
    }),

  updateCapex: (key, blockId, patch) =>
    commit(set, (d) => {
      const entry = d.scenarios[key].entries[blockId] ?? emptyEntry(blockId)
      if (patch === null) {
        entry.capex = null
      } else {
        entry.capex = { ...(entry.capex ?? newCapexLine()), ...patch }
      }
      d.scenarios[key].entries[blockId] = entry
    }),

  updateOpex: (key, blockId, patch) =>
    commit(set, (d) => {
      const entry = d.scenarios[key].entries[blockId] ?? emptyEntry(blockId)
      if (patch === null) {
        entry.opex = null
      } else {
        entry.opex = { ...(entry.opex ?? newOpexLine()), ...patch }
      }
      d.scenarios[key].entries[blockId] = entry
    }),

  setDrilldown: (value) => set({ drilldown: value }),
}))
