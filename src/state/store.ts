import { create } from 'zustand'
import type {
  Block,
  BlockEntry,
  BlockId,
  CapexLine,
  CostView,
  OpexLine,
  Origin,
  Profile,
  Project,
  ScenarioKey,
  Settings,
} from '../domain/types'
import { createEmptyProject, emptyEntry, newCapexLine, newOpexLine } from '../domain/defaults'
import { applyGenerated } from '../domain/presets/generate'
import { demoProfile } from '../domain/presets/profile'
import { repairEntries } from '../domain/schema'
import { repository } from './repository'

interface StoreState {
  project: Project
  hydrated: boolean
  /** Zellauswahl für die Aufschlüsselung. null = Panel geschlossen. */
  drilldown: { scenario: ScenarioKey; year: number; blockId?: BlockId } | null

  /** Profildialog offen? */
  profileOpen: boolean

  hydrate: () => Promise<void>
  replaceProject: (project: Project) => void
  reset: () => void

  setProfileOpen: (open: boolean) => void
  /** Erzeugt beide Szenarien aus dem Profil und führt sie zusammen. */
  generateFromProfile: (profile: Profile) => void
  /** Öffnet den Dialog mit dem Demo-Profil, ohne schon zu erzeugen. */
  loadDemoProfile: () => void
  /** Setzt den Herkunftsstatus aller aktiven Zeilen eines Blocks. */
  setBlockOrigin: (blockId: BlockId, origin: Origin) => void

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

export const useStore = create<StoreState>((set) => ({
  project: createEmptyProject(),
  hydrated: false,
  drilldown: null,
  profileOpen: false,

  hydrate: async () => {
    const stored = await repository.load()
    set({ project: stored ?? createEmptyProject(), hydrated: true })
  },

  replaceProject: (project) => {
    const repaired = repairEntries(project)
    void repository.save(repaired)
    set({ project: repaired, drilldown: null })
  },

  setProfileOpen: (open) => set({ profileOpen: open }),

  generateFromProfile: (profile) => {
    set((state) => {
      const next = applyGenerated(state.project, profile)
      void repository.save(next)
      return { project: next, profileOpen: false, drilldown: null }
    })
  },

  loadDemoProfile: () =>
    set((state) => ({ project: { ...state.project, profile: demoProfile() }, profileOpen: true })),

  setBlockOrigin: (blockId, origin) =>
    commit(set, (d) => {
      for (const scenario of ['onprem', 'cloud'] as ScenarioKey[]) {
        const entry = d.scenarios[scenario].entries[blockId]
        if (!entry) continue
        if (entry.capex?.active) entry.capex.origin = origin
        if (entry.opex?.active) entry.opex.origin = origin
      }
    }),

  reset: () => {
    const fresh = createEmptyProject()
    void repository.save(fresh)
    set({ project: fresh, drilldown: null, profileOpen: false })
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
      // Eine selbst geschriebene Notiz wird beim Generieren nie ersetzt.
      const noteOrigin = patch.note !== undefined ? ('manual' as const) : entry.noteOrigin
      d.scenarios[key].entries[blockId] = { ...entry, ...patch, noteOrigin }
    }),

  updateCapex: (key, blockId, patch) =>
    commit(set, (d) => {
      const entry = d.scenarios[key].entries[blockId] ?? emptyEntry(blockId)
      if (patch === null) {
        entry.capex = null
      } else {
        const base = entry.capex ?? newCapexLine()
        // Ein geänderter Betrag macht aus einer Schätzung eine eigene Angabe.
        const origin: Origin =
          patch.amount !== undefined && patch.amount !== base.amount && base.origin === 'estimated'
            ? 'adjusted'
            : (patch.origin ?? base.origin)
        entry.capex = { ...base, ...patch, origin }
      }
      d.scenarios[key].entries[blockId] = entry
    }),

  updateOpex: (key, blockId, patch) =>
    commit(set, (d) => {
      const entry = d.scenarios[key].entries[blockId] ?? emptyEntry(blockId)
      if (patch === null) {
        entry.opex = null
      } else {
        const base = entry.opex ?? newOpexLine()
        const origin: Origin =
          patch.amount !== undefined && patch.amount !== base.amount && base.origin === 'estimated'
            ? 'adjusted'
            : (patch.origin ?? base.origin)
        entry.opex = { ...base, ...patch, origin }
      }
      d.scenarios[key].entries[blockId] = entry
    }),

  setDrilldown: (value) => set({ drilldown: value }),
}))
