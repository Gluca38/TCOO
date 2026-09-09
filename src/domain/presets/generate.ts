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

function round2(value: number): number {
  return Math.round(value * 100) / 100
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
  // Auf zwei Nachkommastellen festgelegt, damit die im Notizfeld ausgewiesene
  // Rechnung exakt den Betrag ergibt und nicht nur ungefähr.
  const fteOnprem = round2((vmCount / vmsPerFte) * REGULATION_STAFF_FACTOR[profile.regulation])

  return {
    vmCount,
    vmsPerHost,
    hosts: vmCount > 0 ? Math.ceil(vmCount / vmsPerHost) + GLOBALS.spareHosts : 0,
    storageTB,
    vmsPerFte,
    fteOnprem,
    fteCloud: round2(fteOnprem * GLOBALS.cloudStaffFactor),
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
    : value.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

/**
 * Vorbehalt, der einmal je Block unter der Herleitung steht.
 *
 * Bewusst in der Sprache des Anwenders und ohne Verweis auf Dateien: Die
 * Notiz wird im Kundengespräch vorgelesen.
 */
const RICHTWERT_HINWEIS = 'Richtwert aus Marktdaten — keine Angebotsauskunft.'

/**
 * Erklärt, wie die Menge zustande kommt.
 *
 * Nur dort, wo die Menge nicht schon im Profil steht: Hostzahl und
 * Personalbedarf werden gerechnet, und genau danach wird im Kundengespräch
 * als Erstes gefragt.
 */
function quantityDerivation(
  basis: Basis,
  derived: Derived,
  profile: Profile,
  scenario: ScenarioKey,
): string {
  switch (basis) {
    case 'per-host':
      return (
        `So kommt die Hostzahl zustande: ${qty(derived.vmCount)} VMs bei ` +
        `${qty(derived.vmsPerHost)} VMs je Host, aufgerundet, plus ein Reserveknoten.`
      )
    case 'per-fte': {
      const basisSatz =
        `So kommt der Personalbedarf zustande: ${qty(derived.vmCount)} VMs bei ` +
        `${qty(derived.vmsPerFte)} VMs je Vollzeitkraft`
      const reguliert =
        profile.regulation === 'standard'
          ? ''
          : ', erhöht um den Aufwand für Nachweispflichten'
      const cloudZusatz =
        scenario === 'cloud'
          ? `. Für die Cloud ist der Bedarf um ein Viertel niedriger angesetzt`
          : ''
      return `${basisSatz}${reguliert}${cloudZusatz}.`
    }
    case 'per-tb':
      return profile.storageTB === null
        ? `Der Speicherbedarf ist aus der VM-Zahl abgeleitet, da im Profil keine Größe angegeben war.`
        : ''
    case 'per-vm':
      return ''
  }
}

/**
 * Baut den Herleitungstext für das Notizfeld.
 *
 * Der Text soll im Kundengespräch vorlesbar sein. Deshalb: keine Dateinamen,
 * keine Abkürzungen, und ausdrücklich benannt, dass es sich um einen Richtwert
 * handelt und nicht um eine Preisauskunft.
 */
function buildNote(
  template: string,
  total: number,
  quantity: number,
  unitCost: number,
  basis: Basis,
  suffix: string,
  derivation: string,
  modifierNote: string,
): string {
  const kopf = `${template} ${eur(total)}${suffix}`
  const rechnung = `${qty(quantity)} ${unitLabel(basis)} × ${eur(unitCost)}${suffix}.`
  return [kopf, [rechnung, derivation, modifierNote].filter(Boolean).join(' ')].join('\n')
}

/**
 * Benennt den Aufschlag aus dem Regulierungsgrad.
 *
 * Ohne diesen Satz stünde im Notizfeld ein Stückpreis, der sich nicht aus der
 * Koeffiziententabelle erklären lässt — genau die Art versteckter Annahme,
 * die das Werkzeug vermeiden soll.
 */
function modifierExplanation(blockId: BlockId, modifier: number): string {
  if (modifier === 1) return ''
  const prozent = Math.round((modifier - 1) * 100)
  const was = blockId === 'security' ? 'Security-Aufwand' : 'Migrationsaufwand'
  return `Der Regulierungsgrad erhöht den ${was} um ${prozent} %.`
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
  blockId: BlockId,
  derived: Derived,
  profile: Profile,
  scenario: ScenarioKey,
  year: number,
  modifier: number,
): { line: CapexLine; note: string } | null {
  const quantity = quantityFor(coefficient.basis, derived, scenario)
  const unitCost = coefficient.unitCost * modifier
  const amount = Math.round(quantity * unitCost)
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
    note: buildNote(
      coefficient.noteTemplate,
      amount,
      quantity,
      unitCost,
      coefficient.basis,
      '',
      quantityDerivation(coefficient.basis, derived, profile, scenario),
      modifierExplanation(blockId, modifier),
    ),
  }
}

function makeOpex(
  coefficient: OpexCoefficient,
  blockId: BlockId,
  derived: Derived,
  profile: Profile,
  scenario: ScenarioKey,
  modifier: number,
  unitCostOverride?: number,
): { line: OpexLine; note: string } | null {
  const quantity = quantityFor(coefficient.basis, derived, scenario)
  const unitCost = (unitCostOverride ?? coefficient.unitCost) * modifier
  const amount = Math.round(quantity * unitCost)
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
      ' pro Jahr',
      quantityDerivation(coefficient.basis, derived, profile, scenario),
      modifierExplanation(blockId, modifier),
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
            const made = makeCapex(spec.capex, blockId, derived, profile, scenario, year, modifier)
            if (made) {
              entry.capex = made.line
              notes.push(made.note)
            }
          }
        }

        if (spec.opex) {
          const override = blockId === 'facility' ? facilityUnitCost(profile) : undefined
          const made = makeOpex(spec.opex, blockId, derived, profile, scenario, modifier, override)
          if (made) {
            entry.opex = made.line
            notes.push(made.note)
          }
        }

        // Leerzeile zwischen Einmal- und laufenden Kosten: sonst laufen zwei
        // Herleitungen ineinander und man sieht nicht, welche Zahl wozu gehört.
        // Der Vorbehalt steht einmal am Ende, nicht hinter jeder Zeile.
        if (notes.length > 0) notes.push(RICHTWERT_HINWEIS)
        entry.note = notes.join('\n\n')
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
