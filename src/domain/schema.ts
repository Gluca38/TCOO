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

const capexSchema = z.object({
  active: z.boolean(),
  amount: z.number().finite(),
  year: z.number().int().min(1),
  usefulLifeYears: z.number().int().min(1),
  refreshEveryYears: z.number().int().min(1).nullable(),
})

const opexSchema = z.object({
  active: z.boolean(),
  amount: z.number().finite(),
  period: z.enum(['month', 'year']),
  startYear: z.number().int().min(1),
  endYear: z.number().int().min(1).nullable(),
  escalation: z.number().finite().nullable(),
})

const entrySchema = z.object({
  blockId: z.string().min(1),
  note: z.string(),
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

export const projectSchema = z.object({
  schemaVersion: z.number().int().min(1),
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
 * Aktuell existiert nur Version 1 — die Funktion ist der vorgesehene Ort
 * für künftige Migrationen.
 */
function migrate(raw: unknown): { data: unknown; from: number } {
  const version =
    typeof raw === 'object' && raw !== null && 'schemaVersion' in raw
      ? Number((raw as { schemaVersion: unknown }).schemaVersion)
      : 0
  return { data: raw, from: version }
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
        scenario.entries[block.id] = { blockId: block.id, note: '', capex: null, opex: null }
      }
    }
    // Einträge ohne zugehörigen Block entfernen.
    for (const id of Object.keys(scenario.entries)) {
      if (!out.blocks.some((b) => b.id === id)) delete scenario.entries[id]
    }
  }
  return out
}
