import { z } from 'zod'
import type { Project } from './types'
import { SCHEMA_VERSION } from './types'

/**
 * Schema für importierte Projektdateien.
 *
 * Der Import ist die einzige Stelle, an der Daten von außen ins Modell
 * gelangen. Fehler werden im Klartext gemeldet, statt still zu scheitern
 * oder halb zu laden.
 */

const originSchema = z.enum(['estimated', 'adjusted', 'confirmed'])

const capexSchema = z.object({
  active: z.boolean(),
  amount: z.number().finite(),
  origin: originSchema,
  uncertainty: z.number().min(0).max(5).nullable(),
  year: z.number().int().min(1),
  usefulLifeYears: z.number().int().min(1),
  refreshEveryYears: z.number().int().min(1).nullable(),
})

const opexSchema = z.object({
  active: z.boolean(),
  amount: z.number().finite(),
  origin: originSchema,
  uncertainty: z.number().min(0).max(5).nullable(),
  period: z.enum(['month', 'year']),
  startYear: z.number().int().min(1),
  endYear: z.number().int().min(1).nullable(),
  escalation: z.number().finite().nullable(),
})

const entrySchema = z.object({
  blockId: z.string().min(1),
  note: z.string(),
  noteOrigin: z.enum(['generated', 'manual']),
  capex: capexSchema.nullable(),
  opex: opexSchema.nullable(),
})

const scenarioSchema = z.object({
  key: z.enum(['onprem', 'cloud']),
  name: z.string(),
  notes: z.string(),
  entries: z.record(z.string(), entrySchema),
})

const blockSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  enabled: z.boolean(),
  order: z.number().int(),
  hint: z.literal('onprem-typical').optional(),
})

const settingsSchema = z.object({
  startYear: z.number().int().min(1900).max(2999),
  horizonYears: z.number().int().min(1).max(10),
  discountRate: z.number().min(-1).max(1),
  defaultEscalation: z.number().min(-1).max(1),
  view: z.enum(['cashflow', 'pnl']),
  discounted: z.boolean(),
})

const profileSchema = z.object({
  vmCount: z.number().min(0),
  employeeCount: z.number().min(0).nullable(),
  storageTB: z.number().min(0).nullable(),
  refreshYear: z.union([z.number().int().min(1), z.literal('outside')]),
  operatingModel: z.enum(['own-dc', 'colocation', 'hoster']),
  regulation: z.enum(['standard', 'elevated', 'high']),
  vmsPerHost: z.number().positive().nullable(),
  vmsPerFte: z.number().positive().nullable(),
})

export const projectSchema = z.object({
  schemaVersion: z.number().int().min(1),
  profile: profileSchema.nullable(),
  meta: z.object({
    title: z.string(),
    notes: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  settings: settingsSchema,
  blocks: z.array(blockSchema).min(1),
  scenarios: z.object({
    onprem: scenarioSchema,
    cloud: scenarioSchema,
  }),
})

export type ParseResult =
  | { ok: true; project: Project; migratedFrom?: number }
  | { ok: false; errors: string[] }

/**
 * Migriert ältere Speicherstände auf die aktuelle Schema-Version.
 */
function migrate(raw: unknown): { data: unknown; from: number } {
  const version =
    typeof raw === 'object' && raw !== null && 'schemaVersion' in raw
      ? Number((raw as { schemaVersion: unknown }).schemaVersion)
      : 0

  let data = raw
  if (version === 1) data = migrateV1toV2(data)
  return { data, from: version }
}

/**
 * Version 1 kannte weder Herkunftsstatus noch Profil.
 *
 * Alle vorhandenen Positionen werden als **angepasst** eingestuft und alle
 * Notizen als **selbst geschrieben**. Das ist die sichere Richtung: von Hand
 * erfasste Werte dürfen von einem Generierungslauf nie überschrieben werden.
 */
function migrateV1toV2(raw: unknown): unknown {
  const data = structuredClone(raw) as {
    schemaVersion: number
    profile?: unknown
    scenarios?: Record<string, { entries?: Record<string, Record<string, unknown>> }>
  }

  data.schemaVersion = 2
  data.profile = null

  for (const scenario of Object.values(data.scenarios ?? {})) {
    for (const entry of Object.values(scenario.entries ?? {})) {
      entry.noteOrigin = 'manual'
      for (const key of ['capex', 'opex'] as const) {
        const line = entry[key] as Record<string, unknown> | null | undefined
        if (line) {
          line.origin = 'adjusted'
          line.uncertainty = null
        }
      }
    }
  }

  return data
}

function formatIssue(issue: z.ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.join('.') : '(Wurzel)'
  return `Feld „${path}": ${issue.message}`
}

/** Prüft und lädt ein Projekt aus unbekannten Daten. */
export function parseProject(raw: unknown): ParseResult {
  const { data, from } = migrate(raw)

  if (from > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        `Die Datei wurde mit einer neueren Version des Rechners erstellt (Schema ${from}, unterstützt bis ${SCHEMA_VERSION}).`,
      ],
    }
  }

  const parsed = projectSchema.safeParse(data)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map(formatIssue) }
  }

  const project = parsed.data as Project

  // Referenzielle Integrität: jeder Block braucht in beiden Szenarien einen
  // Eintrag, sonst würde stillschweigend mit Lücken gerechnet.
  const repaired = repairEntries(project)

  return from < SCHEMA_VERSION && from > 0
    ? { ok: true, project: repaired, migratedFrom: from }
    : { ok: true, project: repaired }
}

/** Ergänzt fehlende Blockeinträge, damit keine stillen Lücken entstehen. */
export function repairEntries(project: Project): Project {
  const out: Project = structuredClone(project)
  out.schemaVersion = SCHEMA_VERSION
  for (const scenarioKey of ['onprem', 'cloud'] as const) {
    const scenario = out.scenarios[scenarioKey]
    for (const block of out.blocks) {
      if (!scenario.entries[block.id]) {
        scenario.entries[block.id] = {
          blockId: block.id,
          note: '',
          noteOrigin: 'manual',
          capex: null,
          opex: null,
        }
      }
    }
    // Einträge ohne zugehörigen Block entfernen.
    for (const id of Object.keys(scenario.entries)) {
      if (!out.blocks.some((b) => b.id === id)) delete scenario.entries[id]
    }
  }
  return out
}
