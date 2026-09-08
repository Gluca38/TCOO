import type {
  BlockEntry,
  BlockId,
  CapexLine,
  OpexLine,
  Profile,
  Project,
  ScenarioKey,
  Settings,
} from '../types'
import {
  BLOCK_COEFFICIENTS,
  FACILITY_PER_HOST_YEAR,
  GLOBALS,
  REGULATION_MIGRATION_FACTOR,
  REGULATION_SECURITY_FACTOR,
  REGULATION_STAFF_FACTOR,
  type Basis,
  type CapexCoefficient,
  type OpexCoefficient,
} from './coefficients'

/**
 * Erzeugung eines Szenariopaars aus wenigen Profilmerkmalen.
 *
 * Rein funktional und ohne Seiteneffekte. Alle Zahlen stammen aus
 * `coefficients.ts`; hier steht nur, wie sie verrechnet werden.
 */

/* ------------------------------------------------------------------ *
 * Abgeleitete Mengengerüste
 * ------------------------------------------------------------------ */

export interface Derived {
  vmCount: number
  vmsPerHost: number
  hosts: number
  storageTB: number
  vmsPerFte: number
  fteOnprem: number
  fteCloud: number
}

/** Rechnet die Profilmerkmale in die Mengen um, an denen die Kosten hängen. */
export function derive(profile: Profile): Derived {
  const vmCount =
    profile.vmCount > 0
      ? profile.vmCount
      : Math.round((profile.employeeCount ?? 0) * GLOBALS.vmsPerEmployee)

  const vmsPerHost = profile.vmsPerHost ?? GLOBALS.vmsPerHost
  const vmsPerFte = profile.vmsPerFte ?? GLOBALS.vmsPerFte
  const storageTB = profile.storageTB ?? vmCount * GLOBALS.storageTbPerVm

  // Die Regulierung bindet Betriebszeit und wirkt deshalb auf den Personalbedarf.
  const fteOnprem = (vmCount / vmsPerFte) * REGULATION_STAFF_FACTOR[profile.regulation]

  return {
    vmCount,
    vmsPerHost,
    hosts: vmCount > 0 ? Math.ceil(vmCount / vmsPerHost) + GLOBALS.spareHosts : 0,
    storageTB,
    vmsPerFte,
    fteOnprem,
    fteCloud: fteOnprem * GLOBALS.cloudStaffFactor,
  }
}

function quantityFor(basis: Basis, derived: Derived, scenario: ScenarioKey): number {
  switch (basis) {
    case 'per-vm':
      return derived.vmCount
    case 'per-tb':
      return derived.storageTB
    case 'per-host':
      return derived.hosts
    case 'per-fte':
      return scenario === 'onprem' ? derived.fteOnprem : derived.fteCloud
  }
}

function unitLabel(basis: Basis): string {
  switch (basis) {
    case 'per-vm':
      return 'VMs'
    case 'per-tb':
      return 'TB'
    case 'per-host':
      return 'Hosts'
    case 'per-fte':
      return 'Vollzeitkräfte'
  }
}

/* ------------------------------------------------------------------ *
 * Aufschläge, die nicht in der Stückkostentabelle stehen
 * ------------------------------------------------------------------ */

/**
 * Blockspezifische Faktoren aus den Profilschaltern.
 *
 * Bewusst hier und nicht in der Koeffiziententabelle: es sind
 * Verrechnungsregeln, keine Werte.
 */
function modifierFor(blockId: BlockId, profile: Profile): number {
  if (blockId === 'security') return REGULATION_SECURITY_FACTOR[profile.regulation]
  if (blockId === 'migration') return REGULATION_MIGRATION_FACTOR[profile.regulation]
  return 1
}

/** Der Rechenzentrumsblock hängt am Betriebsmodell, nicht an einer Stückkostenzeile. */
function facilityUnitCost(profile: Profile): number {
  return FACILITY_PER_HOST_YEAR[profile.operatingModel]
}

/* ------------------------------------------------------------------ *
 * Zahlenformatierung für die Herleitungstexte
 * ------------------------------------------------------------------ */

function eur(value: number): string {
  return `${Math.round(value).toLocaleString('de-DE')} €`
}

function qty(value: number): string {
  return value % 1 === 0
    ? value.toLocaleString('de-DE')
    : value.toLocaleString('de-DE', { maximumFractionDigits: 1 })
}

/**
 * Baut den Herleitungstext.
 *
 * Formuliert ausdrücklich als recherchierte Größenordnung. Es wird kein
 * Branchenmedian und kein Erfahrungswert behauptet — die Zahlen stammen aus
 * einer Recherche, und genau das steht da.
 */
function buildNote(
  template: string,
  total: number,
  quantity: number,
  unitCost: number,
  basis: Basis,
  suffix: string,
): string {
  return (
    `${template} ${eur(total)}${suffix} = ${qty(quantity)} ${unitLabel(basis)} × ` +
    `${eur(unitCost)}${suffix} je Einheit. ` +
    `Recherchierte Größenordnung, Herleitung und Belastbarkeit in SOURCES.md.`
  )
}

/* ------------------------------------------------------------------ *
 * Erzeugung
 * ------------------------------------------------------------------ */

/**
 * Jahresindex, in dem die Hardware-Investitionen anfallen.
 *
 * `'outside'` bedeutet: der Refresh liegt außerhalb des Betrachtungszeitraums
 * — typischerweise weil er gerade erst stattgefunden hat. Dann entsteht im
 * On-Prem-Szenario **gar keine** Investition, nur laufender Aufwand. Das ist
 * der stärkste einzelne Hebel im Modell und der Hauptgrund, warum ein Kunde
 * mit frisch erneuerter Hardware nicht in die Cloud gehört.
 */
function capexYearFor(profile: Profile): number | null {
  return profile.refreshYear === 'outside' ? null : profile.refreshYear
}

function makeCapex(
  coefficient: CapexCoefficient,
  derived: Derived,
  scenario: ScenarioKey,
  year: number,
  modifier: number,
): { line: CapexLine; note: string } | null {
  const quantity = quantityFor(coefficient.basis, derived, scenario)
  const unitCost = coefficient.unitCost * modifier
  const amount = quantity * unitCost
  if (amount <= 0) return null

  return {
    line: {
      active: true,
      amount,
      origin: 'estimated',
      uncertainty: null,
      year,
      usefulLifeYears: coefficient.usefulLifeYears,
      refreshEveryYears: null,
    },
    note: buildNote(coefficient.noteTemplate, amount, quantity, unitCost, coefficient.basis, ''),
  }
}

function makeOpex(
  coefficient: OpexCoefficient,
  derived: Derived,
  scenario: ScenarioKey,
  modifier: number,
  unitCostOverride?: number,
): { line: OpexLine; note: string } | null {
  const quantity = quantityFor(coefficient.basis, derived, scenario)
  const unitCost = (unitCostOverride ?? coefficient.unitCost) * modifier
  const amount = quantity * unitCost
  if (amount <= 0) return null

  return {
    line: {
      active: true,
      amount,
      origin: 'estimated',
      uncertainty: null,
      period: 'year',
      startYear: 1,
      endYear: null,
      escalation: coefficient.escalation,
    },
    note: buildNote(
      coefficient.noteTemplate,
      amount,
      quantity,
      unitCost,
      coefficient.basis,
      '/Jahr',
    ),
  }
}

export type GeneratedEntries = Record<ScenarioKey, Record<BlockId, BlockEntry>>

/**
 * Erzeugt für beide Szenarien alle Blockeinträge aus dem Profil.
 *
 * Alle erzeugten Positionen tragen `origin: 'estimated'` und
 * `noteOrigin: 'generated'` — nur solche dürfen später überschrieben werden.
 */
export function generateScenarios(profile: Profile, settings: Settings): GeneratedEntries {
  const derived = derive(profile)
  const rawCapexYear = capexYearFor(profile)
  // Ein Anfalljahr hinter dem Betrachtungszeitraum ist wirkungslos.
  const capexYear =
    rawCapexYear !== null && rawCapexYear >= 1 && rawCapexYear <= settings.horizonYears
      ? rawCapexYear
      : null

  const result: GeneratedEntries = { onprem: {}, cloud: {} }

  for (const [blockId, coefficient] of Object.entries(BLOCK_COEFFICIENTS)) {
    for (const scenario of ['onprem', 'cloud'] as ScenarioKey[]) {
      const spec = coefficient[scenario]
      const entry: BlockEntry = {
        blockId,
        note: '',
        noteOrigin: 'generated',
        capex: null,
        opex: null,
      }

      if (spec) {
        const modifier = modifierFor(blockId, profile)
        const notes: string[] = []

        if (spec.capex) {
          // Migration ist keine Hardware und hängt nicht am Refresh-Zyklus.
          const year = blockId === 'migration' ? 1 : capexYear
          if (year !== null) {
            const made = makeCapex(spec.capex, derived, scenario, year, modifier)
            if (made) {
              entry.capex = made.line
              notes.push(made.note)
            }
          }
        }

        if (spec.opex) {
          const override = blockId === 'facility' ? facilityUnitCost(profile) : undefined
          const made = makeOpex(spec.opex, derived, scenario, modifier, override)
          if (made) {
            entry.opex = made.line
            notes.push(made.note)
          }
        }

        entry.note = notes.join('\n')
      }

      result[scenario][blockId] = entry
    }
  }

  return result
}

/* ------------------------------------------------------------------ *
 * Zusammenführung — die Kernregel
 * ------------------------------------------------------------------ */

/**
 * Übernimmt ein erzeugtes Szenariopaar in ein bestehendes Projekt.
 *
 * **Zentrale Regel:** Ersetzt wird ausschließlich, was den Status
 * `'estimated'` trägt. Von Hand angepasste und vom Kunden bestätigte Werte
 * bleiben unangetastet — auch wenn das Profil mehrfach nachjustiert wird.
 * Dasselbe gilt für Notizen: eine selbst geschriebene Notiz
 * (`noteOrigin: 'manual'`) wird nie überschrieben.
 */
export function applyGenerated(project: Project, profile: Profile): Project {
  const generated = generateScenarios(profile, project.settings)
  const next: Project = structuredClone(project)
  next.profile = structuredClone(profile)

  for (const scenario of ['onprem', 'cloud'] as ScenarioKey[]) {
    const entries = next.scenarios[scenario].entries

    for (const block of next.blocks) {
      const fresh = generated[scenario][block.id]
      // Blöcke, die der Nutzer selbst angelegt hat, kennt die Tabelle nicht.
      if (!fresh) continue

      const current = entries[block.id] ?? {
        blockId: block.id,
        note: '',
        noteOrigin: 'generated' as const,
        capex: null,
        opex: null,
      }

      entries[block.id] = {
        blockId: block.id,
        capex: current.capex && current.capex.origin !== 'estimated' ? current.capex : fresh.capex,
        opex: current.opex && current.opex.origin !== 'estimated' ? current.opex : fresh.opex,
        note: current.noteOrigin === 'manual' ? current.note : fresh.note,
        noteOrigin: current.noteOrigin === 'manual' ? 'manual' : 'generated',
      }
    }
  }

  next.meta.updatedAt = new Date().toISOString()
  return next
}

/** Zählt, wie viele aktive Blöcke vollständig kundenbestätigt sind. */
export function confirmedBlockCount(project: Project): { confirmed: number; total: number } {
  let confirmed = 0
  let total = 0

  for (const block of project.blocks) {
    if (!block.enabled) continue
    const lines = (['onprem', 'cloud'] as ScenarioKey[]).flatMap((scenario) => {
      const entry = project.scenarios[scenario].entries[block.id]
      return [entry?.capex, entry?.opex].filter((l) => l?.active)
    })
    if (lines.length === 0) continue

    total++
    if (lines.every((l) => l!.origin === 'confirmed')) confirmed++
  }

  return { confirmed, total }
}
