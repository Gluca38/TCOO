/**
 * Datenmodell des TCO-Rechners.
 *
 * Diese Datei ist bewusst frei von jeder UI- und Framework-Abhängigkeit.
 * Sie beschreibt das gesamte fachliche Modell und ist damit die verbindliche
 * Dokumentation dessen, was gerechnet wird.
 */

/** Version des Speicherformats. Wird beim Import geprüft und ggf. migriert. */
export const SCHEMA_VERSION = 1

/** Stabile Kennung eines Kostenblocks. Über Export/Import hinweg unverändert. */
export type BlockId = string

/** Die beiden Szenarien sind fest: Bestand (On-Prem) und Ziel (Cloud). */
export type ScenarioKey = 'onprem' | 'cloud'

/** Sicht auf die Kosten: Auszahlung im Anfalljahr oder abgeschriebene Kosten. */
export type CostView = 'cashflow' | 'pnl'

/** Laufende Kosten werden pro Monat oder pro Jahr erfasst. */
export type OpexPeriod = 'month' | 'year'

export interface Settings {
  /** Kalenderjahr, das Jahresindex 1 entspricht. */
  startYear: number
  /** Länge des Betrachtungszeitraums in Jahren (1..10). */
  horizonYears: number
  /** Nominaler Diskontierungssatz als Dezimalzahl, z.B. 0.07 für 7 %. */
  discountRate: number
  /** Globale jährliche Steigerungsrate, je Position überschreibbar. */
  defaultEscalation: number
  /** Aktuell gewählte Kostensicht. */
  view: CostView
  /** Barwertdarstellung. Nur in der Cashflow-Sicht wirksam. */
  discounted: boolean
}

export interface Block {
  id: BlockId
  name: string
  /** Deaktivierte Blöcke fließen in keine Berechnung ein. */
  enabled: boolean
  order: number
  /** Reiner UI-Hinweis, keine Sperre. */
  hint?: 'onprem-typical'
}

/**
 * Einmalige Investition.
 *
 * Der Betrag ist immer nominal im Anfalljahr zu verstehen. CapEx wird
 * grundsätzlich nicht indexiert — auch Wiederholungen laufen mit demselben
 * Nominalbetrag. Damit gibt es zu CapEx keine Rechenannahme, die nicht direkt
 * aus der Eingabe ablesbar ist.
 */
export interface CapexLine {
  active: boolean
  amount: number
  /** Jahresindex 1..H, in dem die Investition anfällt. */
  year: number
  /** Abschreibungsdauer in Jahren. Bestimmt die Scheiben in der P&L-Sicht. */
  usefulLifeYears: number
  /** Wiederholung alle N Jahre (Refresh). null = keine Wiederholung. */
  refreshEveryYears: number | null
}

/**
 * Laufende Kosten.
 *
 * Der Betrag ist der Wert **im Startjahr der Position**, nicht in Jahr 1.
 * Die Steigerung wirkt ab dem Startjahr.
 */
export interface OpexLine {
  active: boolean
  amount: number
  period: OpexPeriod
  /** Jahresindex 1..H, ab dem die Kosten anfallen. */
  startYear: number
  /** Jahresindex, bis zu dem die Kosten anfallen. null = bis Zeitraumende. */
  endYear: number | null
  /** Steigerungsrate der Position. null = globaler Wert aus den Settings. */
  escalation: number | null
}

export interface BlockEntry {
  blockId: BlockId
  /** Begründung/Herleitung. Wandert unverändert in den Export. */
  note: string
  capex: CapexLine | null
  opex: OpexLine | null
}

export interface Scenario {
  key: ScenarioKey
  name: string
  notes: string
  entries: Record<BlockId, BlockEntry>
}

export interface ProjectMeta {
  title: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Project {
  schemaVersion: number
  meta: ProjectMeta
  settings: Settings
  /** Gemeinsamer Blockkatalog. Identische IDs in beiden Szenarien. */
  blocks: Block[]
  scenarios: Record<ScenarioKey, Scenario>
}
