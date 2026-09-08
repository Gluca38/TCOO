/**
 * Datenmodell des TCO-Rechners.
 *
 * Diese Datei ist bewusst frei von jeder UI- und Framework-Abhängigkeit.
 * Sie beschreibt das gesamte fachliche Modell und ist damit die verbindliche
 * Dokumentation dessen, was gerechnet wird.
 */

/** Version des Speicherformats. Wird beim Import geprüft und ggf. migriert. */
export const SCHEMA_VERSION = 2

/** Stabile Kennung eines Kostenblocks. Über Export/Import hinweg unverändert. */
export type BlockId = string

/** Die beiden Szenarien sind fest: Bestand (On-Prem) und Ziel (Cloud). */
export type ScenarioKey = 'onprem' | 'cloud'

/** Sicht auf die Kosten: Auszahlung im Anfalljahr oder abgeschriebene Kosten. */
export type CostView = 'cashflow' | 'pnl'

/** Laufende Kosten werden pro Monat oder pro Jahr erfasst. */
export type OpexPeriod = 'month' | 'year'

/**
 * Herkunft einer Betragsposition.
 *
 * Trennt im Kundengespräch die eigene Schätzung von der Kundenangabe.
 * Steuert zugleich die Bandbreite in der Sensitivitätsanalyse und
 * entscheidet, ob ein erneuter Generierungslauf die Position überschreibt.
 */
export type Origin =
  /** Aus dem Profil erzeugt. Wird bei erneutem Generieren überschrieben. */
  | 'estimated'
  /** Von Hand überschrieben. Bleibt beim Generieren unangetastet. */
  | 'adjusted'
  /** Vom Kunden bestätigt. Bleibt beim Generieren unangetastet. */
  | 'confirmed'

/** Herkunft des Notiztextes. Manuelle Notizen werden nie überschrieben. */
export type NoteOrigin = 'generated' | 'manual'

/** Betriebsmodell der heutigen Umgebung. Steuert den Rechenzentrumsblock. */
export type OperatingModel = 'own-dc' | 'colocation' | 'hoster'

/** Regulierungsgrad. Wirkt auf Security & Compliance sowie Personal. */
export type RegulationLevel = 'standard' | 'elevated' | 'high'

/**
 * Merkmale, die im Erstgespräch erfragt werden.
 *
 * Aus ihnen erzeugt `generateScenarios()` alle zwölf Blöcke. Bewusst so
 * wenige Felder, dass sie in einem Telefonat abfragbar sind.
 */
export interface Profile {
  /** Anzahl virtueller Maschinen. Führende Bezugsgröße. */
  vmCount: number
  /** Alternativ: Mitarbeiterzahl, umgerechnet über einen Koeffizienten. */
  employeeCount: number | null
  /** Nutzbarer Storage in TB. null = aus der VM-Zahl abgeleitet. */
  storageTB: number | null
  /** Jahresindex des nächsten Hardware-Refresh, oder außerhalb der Laufzeit. */
  refreshYear: number | 'outside'
  operatingModel: OperatingModel
  regulation: RegulationLevel
  /** Annahme, überschreibbar. null = Wert aus der Koeffiziententabelle. */
  vmsPerHost: number | null
  /** Annahme, überschreibbar. null = Wert aus der Koeffiziententabelle. */
  vmsPerFte: number | null
}

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
  /** Herkunft des Betrags. Siehe {@link Origin}. */
  origin: Origin
  /**
   * Bandbreite für die Sensitivität als Dezimalzahl (0.2 = ±20 %).
   * null = aus der Herkunft ableiten.
   */
  uncertainty: number | null
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
  /** Herkunft des Betrags. Siehe {@link Origin}. */
  origin: Origin
  /**
   * Bandbreite für die Sensitivität als Dezimalzahl (0.2 = ±20 %).
   * null = aus der Herkunft ableiten.
   */
  uncertainty: number | null
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
  /** Manuelle Notizen werden beim Generieren nicht ersetzt. */
  noteOrigin: NoteOrigin
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
  /** Zuletzt verwendete Profileingabe. null = noch nie generiert. */
  profile: Profile | null
}
