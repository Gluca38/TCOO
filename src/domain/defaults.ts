import type { Block, BlockEntry, BlockId, Project, Scenario, Settings } from './types'
import { SCHEMA_VERSION } from './types'

/**
 * Default-Blockkatalog. Alle Blöcke sind umbenennbar, deaktivierbar und
 * ergänzbar — diese Liste ist nur der Startpunkt.
 */
export const DEFAULT_BLOCKS: ReadonlyArray<Omit<Block, 'order'>> = [
  { id: 'compute', name: 'Compute / Server', enabled: true },
  { id: 'database', name: 'Datenbankservices', enabled: true },
  { id: 'storage', name: 'Storage', enabled: true },
  { id: 'network', name: 'Netzwerk (inkl. Traffic/Egress)', enabled: true },
  { id: 'backup', name: 'Backup / Disaster Recovery', enabled: true },
  { id: 'facility', name: 'Rechenzentrum, Strom, Fläche', enabled: true, hint: 'onprem-typical' },
  { id: 'licenses', name: 'Lizenzen und Software', enabled: true },
  { id: 'support', name: 'Wartung und Support', enabled: true },
  { id: 'staff', name: 'Personal / Betriebsaufwand', enabled: true },
  { id: 'security', name: 'Security & Compliance', enabled: true },
  { id: 'migration', name: 'Migration und Einmalaufwände', enabled: true },
  { id: 'other', name: 'Sonstiges', enabled: true },
]

export const DEFAULT_SETTINGS: Settings = {
  startYear: new Date().getFullYear(),
  horizonYears: 5,
  discountRate: 0.07,
  defaultEscalation: 0.03,
  view: 'cashflow',
  discounted: false,
}

export const SCENARIO_NAMES: Record<'onprem' | 'cloud', string> = {
  onprem: 'On-Premises',
  cloud: 'T Cloud Public',
}

export function emptyEntry(blockId: BlockId): BlockEntry {
  return { blockId, note: '', capex: null, opex: null }
}

export function newCapexLine(startYearIndex = 1) {
  return {
    active: true,
    amount: 0,
    year: startYearIndex,
    usefulLifeYears: 5,
    refreshEveryYears: null,
  }
}

export function newOpexLine(startYearIndex = 1) {
  return {
    active: true,
    amount: 0,
    period: 'year' as const,
    startYear: startYearIndex,
    endYear: null,
    escalation: null,
  }
}

function emptyScenario(key: 'onprem' | 'cloud', blocks: Block[]): Scenario {
  const entries: Record<BlockId, BlockEntry> = {}
  for (const b of blocks) entries[b.id] = emptyEntry(b.id)
  return { key, name: SCENARIO_NAMES[key], notes: '', entries }
}

/** Frisches, leeres Projekt mit vollständigem Blockkatalog. */
export function createEmptyProject(): Project {
  const blocks: Block[] = DEFAULT_BLOCKS.map((b, i) => ({ ...b, order: i }))
  const now = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { title: 'Unbenannter TCO-Vergleich', notes: '', createdAt: now, updatedAt: now },
    settings: { ...DEFAULT_SETTINGS },
    blocks,
    scenarios: {
      onprem: emptyScenario('onprem', blocks),
      cloud: emptyScenario('cloud', blocks),
    },
  }
}
