import type { OperatingModel, RegulationLevel } from '../types'

/**
 * Koeffiziententabelle der profilbasierten Vorbefüllung.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DIESE DATEI IST EINE DATENTABELLE, KEIN PROGRAMM.
 *
 * Sie enthält bewusst keine Logik. Alle Werte dürfen geändert werden, ohne
 * dass irgendwo anders etwas angepasst werden muss. Jeder Wert trägt einen
 * Kommentar mit Herleitung und Belastbarkeit.
 *
 * Die vollständige Quellenlage steht in SOURCES.md daneben.
 *
 * Belastbarkeit:
 *   [gut]     mehrere übereinstimmende, aktuelle Quellen
 *   [mittel]  belastbare Quelle, aber Listenpreis oder breite Spanne
 *   [schwach] veraltete Quellen, Streuung über eine Größenordnung,
 *             oder begründete Modellannahme ohne Quelle
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Bezugsgröße, an der ein Blockwert hängt. */
export type Basis = 'per-vm' | 'per-tb' | 'per-host' | 'per-fte'

/**
 * Einmalige Investition.
 *
 * `unitCost` ist der **Anschaffungspreis** je Einheit — nicht der Jahreswert.
 */
export interface CapexCoefficient {
  unitCost: number
  basis: Basis
  /** Abschreibungsdauer in Jahren. */
  usefulLifeYears: number
  /** `{rechnung}` wird durch die konkrete Rechnung ersetzt. */
  noteTemplate: string
}

/**
 * Laufende Kosten.
 *
 * `unitCost` ist der **Jahresbetrag** je Einheit.
 */
export interface OpexCoefficient {
  unitCost: number
  basis: Basis
  /** Jährliche Steigerung. null = globaler Default aus den Einstellungen. */
  escalation: number | null
  noteTemplate: string
}

/**
 * Koeffizienten eines Blocks für ein Szenario.
 *
 * Bewusst höchstens eine CapEx- und eine OpEx-Zeile — genau die Struktur,
 * die das Datenmodell der Anwendung vorsieht.
 */
export interface ScenarioCoefficient {
  capex?: CapexCoefficient
  opex?: OpexCoefficient
}

export interface BlockCoefficient {
  onprem: ScenarioCoefficient | null
  cloud: ScenarioCoefficient | null
}

/* ══════════════════════════════════════════════════════════════════════ *
 * Globale Größen
 * ══════════════════════════════════════════════════════════════════════ */

export const GLOBALS = {
  /**
   * VMs je Virtualisierungshost.
   * [schwach] Belegte Spanne 3–15 aus Erhebungen 2009–2011. Bewusst höher
   * angesetzt, weil die Kernzahl je Sockel seither vielfach gestiegen ist.
   * Realistisch je nach Last 10–40. Im Profildialog überschreibbar.
   */
  vmsPerHost: 20,

  /**
   * VMs je Vollzeitkraft im On-Prem-Betrieb.
   * [schwach] Belegte Spanne 50–500 (Gartner-Zitat, 2011). Unterer Bereich
   * gewählt, weil Spitzenwerte homogene Umgebungen voraussetzen.
   * Im Profildialog überschreibbar.
   */
  vmsPerFte: 80,

  /**
   * Personalvollkosten je Vollzeitkraft und Jahr.
   * [mittel] 55.000 € brutto (StepStone/jobvector 2026) × 1,21
   * Arbeitgeberanteil ≈ 66.550 €. Arbeitsplatzkosten nicht enthalten.
   */
  fteCostPerYear: 67_000,

  /**
   * Personalbedarf in der Cloud als Faktor gegenüber On-Premises.
   * [schwach] Modellannahme. Hardwarebetreuung entfällt, Plattformsteuerung
   * kommt hinzu. Bewusst konservativ — ein zu niedriger Wert würde das
   * Ergebnis systematisch zugunsten der Cloud verzerren.
   */
  cloudStaffFactor: 0.75,

  /**
   * Storage je VM, wenn im Profil keine TB-Zahl angegeben ist.
   * [schwach] Modellannahme.
   */
  storageTbPerVm: 0.8,

  /**
   * VMs je Mitarbeiter, wenn statt der VM-Zahl die Mitarbeiterzahl
   * angegeben wird.
   * [schwach] Modellannahme, stark branchenabhängig.
   */
  vmsPerEmployee: 0.35,

  /**
   * Anschaffungspreis je Virtualisierungshost.
   * [mittel] Dell PowerEdge Listenpreise DE 14.543–30.135 €.
   * Mitte der Spanne: ein Host, der 20 VMs trägt, braucht entsprechend RAM
   * und liegt nicht am unteren Rand der Preisliste. Listenpreis ≠ Einkauf,
   * deshalb nicht das obere Ende.
   */
  hostCost: 24_000,

  /** Nutzungsdauer der Serverhardware in Jahren. [gut] Marktüblich. */
  hostUsefulLife: 5,

  /**
   * Zusätzliche Hosts als Ausfallreserve (N+1).
   * [gut] Ein Cluster ohne Reserve kann keinen Host verlieren, ohne dass
   * VMs ausfallen. Ein Reserveknoten ist gängige Praxis und gehört in den
   * Vergleich, weil die Cloud-Seite Redundanz im Preis enthält.
   */
  spareHosts: 1,
} as const

/* ══════════════════════════════════════════════════════════════════════ *
 * Aufschläge je Profilschalter
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * Rechenzentrumskosten je Host und Jahr, abhängig vom Betriebsmodell.
 * Herleitung vollständig in SOURCES.md, Abschnitt 1.
 */
export const FACILITY_PER_HOST_YEAR: Record<OperatingModel, number> = {
  /**
   * [mittel] 450 W × PUE 1,39 × 8.760 h × 0,16 €/kWh = 877 € Strom,
   * plus 600 € Fläche/USV/Klima als Modellannahme [schwach].
   */
  'own-dc': 1_480,

  /**
   * [mittel] 450 W × 8.760 h × 0,45 €/kWh = 1.774 € (Colocation-Strompreis
   * enthält Kühlung, deshalb ohne PUE), plus Rackanteil 400 €.
   */
  colocation: 2_170,

  /** [gut] Beim externen Hoster stecken diese Kosten in dessen Rechnung. */
  hoster: 0,
}

/**
 * Aufschlag auf Security & Compliance je Regulierungsgrad.
 * [schwach] Modellannahme ohne belegte Quelle.
 */
export const REGULATION_SECURITY_FACTOR: Record<RegulationLevel, number> = {
  standard: 1.0,
  elevated: 1.4,
  high: 2.0,
}

/**
 * Aufschlag auf den Personalaufwand je Regulierungsgrad.
 * [schwach] Modellannahme: Nachweispflichten binden Betriebszeit.
 */
export const REGULATION_STAFF_FACTOR: Record<RegulationLevel, number> = {
  standard: 1.0,
  elevated: 1.15,
  high: 1.35,
}

/**
 * Aufschlag auf den Migrationsaufwand je Regulierungsgrad.
 * [schwach] Modellannahme: Freigaben, Nachweise, längere Testzyklen.
 */
export const REGULATION_MIGRATION_FACTOR: Record<RegulationLevel, number> = {
  standard: 1.0,
  elevated: 1.3,
  high: 1.8,
}

/* ══════════════════════════════════════════════════════════════════════ *
 * Blockkoeffizienten
 *
 * `null` bedeutet: dieser Block entsteht in diesem Szenario nicht.
 * Das ist nur beim Rechenzentrum zulässig und wird vom Neutralitätstest
 * geprüft — überall sonst würde eine Lücke das Ergebnis verzerren.
 * ══════════════════════════════════════════════════════════════════════ */

export const BLOCK_COEFFICIENTS: Record<string, BlockCoefficient> = {
  /* ── Compute ──────────────────────────────────────────────────────── */
  compute: {
    onprem: {
      capex: {
        // [mittel] Anschaffung je Host, siehe GLOBALS.hostCost.
        unitCost: GLOBALS.hostCost,
        basis: 'per-host',
        usefulLifeYears: GLOBALS.hostUsefulLife,
        noteTemplate: 'Ersatzinvestition für die Virtualisierungshosts:',
      },
    },
    cloud: {
      opex: {
        /**
         * [schwach] 65 €/Monat je VM = 780 €/Jahr.
         *
         * Herleitung: Anhaltspunkt 4 vCPU / 16 GB on demand ≈ 137 €/Monat.
         * Eine durchschnittliche VM in einem gewachsenen Bestand ist jedoch
         * deutlich kleiner — die Verteilung wird von 2-vCPU-Maschinen
         * dominiert. Bei rund 2,5 vCPU / 10 GB im Mittel sind das ~85 €/Monat
         * on demand; mit üblichen Reservierungsrabatten von 30–40 % bleiben
         * rund 55–60 €/Monat. Der Ansatz liegt bewusst darüber.
         *
         * DIES IST DER EINZELNE WERT MIT DEM GRÖSSTEN EINFLUSS AUF DAS
         * GESAMTERGEBNIS und zugleich einer der schwächsten. Die Annahme über
         * die durchschnittliche VM-Größe ist nirgends belegt. Sobald ein
         * konkretes Angebot vorliegt, gehört dieser Wert als Erstes ersetzt.
         */
        unitCost: 780,
        basis: 'per-vm',
        escalation: null,
        noteTemplate: 'Rechenleistung inklusive Reservierungsrabatten:',
      },
    },
  },

  /* ── Datenbankservices ────────────────────────────────────────────── */
  database: {
    onprem: {
      // [schwach] Modellannahme: dedizierte Datenbankserver für einen Teil der Umgebung.
      capex: {
        unitCost: 600,
        basis: 'per-vm',
        usefulLifeYears: 5,
        noteTemplate: 'Dedizierte Datenbankserver:',
      },
      // [schwach] Modellannahme: Datenbanklizenzen und Support.
      opex: {
        unitCost: 60,
        basis: 'per-vm',
        escalation: null,
        noteTemplate: 'Datenbanklizenzen und Support:',
      },
    },
    cloud: {
      // [schwach] Modellannahme: Managed-Service-Aufschlag gegenüber Eigenbetrieb.
      opex: {
        unitCost: 340,
        basis: 'per-vm',
        escalation: null,
        noteTemplate: 'Managed-Datenbankdienste inklusive Hochverfügbarkeit:',
      },
    },
  },

  /* ── Storage ──────────────────────────────────────────────────────── */
  storage: {
    onprem: {
      capex: {
        /**
         * [schwach] 1.440 €/TB **nutzbar**.
         * Herleitung: 900 €/TB Rohkapazität (Anhaltspunkte: NetApp ASA
         * effektiv 55–130 $/TB reine Medien, Enterprise-NVMe 300–1.172 $/TB,
         * zuzüglich Controller, Redundanz, Gehäuse und Erstsupport)
         * × Faktor 1,6 für RAID-Overhead, Snapshot-Reserve und
         * Wachstumsspielraum. Wer 120 TB nutzen will, kauft deutlich mehr.
         * ACHTUNG: 2026 extrem volatil, Vorproduktkosten +300–900 %.
         * Dieser Wert veraltet schneller als jeder andere in dieser Tabelle.
         */
        unitCost: 1_440,
        basis: 'per-tb',
        usefulLifeYears: 5,
        noteTemplate: 'Speichersystem, bezogen auf nutzbare Kapazität:',
      },
    },
    cloud: {
      opex: {
        /**
         * [mittel] Mischung aus Speicherklassen, nicht alles auf Premium.
         * Premium-Block (AWS gp3 0,0928 $/GB/Monat × 0,92 = 1.049 €/TB/Jahr)
         * für 40 % der Kapazität, günstigere Objekt- und Kühlklassen
         * (rund 250 €/TB/Jahr) für die übrigen 60 %:
         *   0,4 × 1.100 + 0,6 × 250 ≈ 590 €/TB/Jahr.
         * Die Aufteilung 40/60 ist eine Modellannahme [schwach]; die reine
         * Annahme „alles auf Premium-Block" wäre jedoch nachweislich falsch
         * und würde die Cloud-Seite systematisch verteuern.
         */
        unitCost: 590,
        basis: 'per-tb',
        escalation: null,
        noteTemplate: 'Block- und Objektspeicher inklusive Snapshots:',
      },
    },
  },

  /* ── Netzwerk ─────────────────────────────────────────────────────── */
  network: {
    onprem: {
      // [schwach] Modellannahme: Switching und Anbindung.
      capex: {
        unitCost: 500,
        basis: 'per-vm',
        usefulLifeYears: 5,
        noteTemplate: 'Switching und Netzwerkanbindung:',
      },
      // [schwach] Modellannahme: laufende WAN-Kosten.
      opex: {
        unitCost: 120,
        basis: 'per-vm',
        escalation: null,
        noteTemplate: 'Laufende WAN-Anbindung:',
      },
    },
    cloud: {
      // [schwach] Modellannahme: höher wegen ausgehendem Datenverkehr.
      opex: {
        unitCost: 290,
        basis: 'per-vm',
        escalation: null,
        noteTemplate: 'Anbindung, Load Balancing und ausgehender Datenverkehr:',
      },
    },
  },

  /* ── Backup / Disaster Recovery ───────────────────────────────────── */
  backup: {
    onprem: {
      // [schwach] Modellannahme: Backup-Appliance und Medien.
      capex: {
        unitCost: 300,
        basis: 'per-tb',
        usefulLifeYears: 5,
        noteTemplate: 'Backup-Appliance und Zweitstandort:',
      },
      opex: {
        unitCost: 60,
        basis: 'per-tb',
        escalation: null,
        noteTemplate: 'Medien, Wartung und Zweitstandort:',
      },
    },
    cloud: {
      // [schwach] Modellannahme: Backup-Service und georedundante Ablage.
      opex: {
        unitCost: 150,
        basis: 'per-tb',
        escalation: null,
        noteTemplate: 'Backup-Service und georedundante Ablage:',
      },
    },
  },

  /* ── Rechenzentrum, Strom, Fläche ─────────────────────────────────── */
  facility: {
    onprem: {
      opex: {
        // Wird in generate.ts durch FACILITY_PER_HOST_YEAR ersetzt.
        unitCost: 0,
        basis: 'per-host',
        escalation: 0.06, // [mittel] Energiepreise steigen stärker als die Inflation.
        noteTemplate: 'Flächen- und Energieumlage für das Rechenzentrum:',
      },
    },
    /**
     * Einziger Block ohne Cloud-Gegenstück. Das ist strukturell korrekt:
     * Fläche und Energie sind im Cloud-Preis enthalten und stecken dort im
     * Compute-Block. Der Neutralitätstest lässt genau diese eine Ausnahme zu.
     */
    cloud: null,
  },

  /* ── Lizenzen und Software ────────────────────────────────────────── */
  licenses: {
    onprem: {
      opex: {
        /**
         * [mittel] Virtualisierung: 157 €/Core/Jahr × 32 Cores = 5.024 €/Host.
         * Bei 20 VMs/Host = 251 €/VM, plus 250 €/VM Betriebssystem und
         * Anwendungen [schwach] = rund 500 €/VM/Jahr.
         */
        unitCost: 500,
        basis: 'per-vm',
        escalation: 0.05, // [mittel] Lizenzpreise steigen stärker als die Inflation.
        noteTemplate: 'Virtualisierung, Betriebssysteme und Anwendungen:',
      },
    },
    cloud: {
      // [schwach] Modellannahme: Faktor 0,6, da ein Teil in den Diensten enthalten.
      opex: {
        unitCost: 300,
        basis: 'per-vm',
        escalation: 0.05,
        noteTemplate: 'Verbleibende Lizenzen, da ein Teil in den Diensten enthalten ist:',
      },
    },
  },

  /* ── Wartung und Support ──────────────────────────────────────────── */
  support: {
    onprem: {
      // [schwach] Modellannahme: 12 % des Hardware-Anschaffungswerts je Jahr.
      opex: {
        unitCost: GLOBALS.hostCost * 0.12,
        basis: 'per-host',
        escalation: null,
        noteTemplate: 'Hardware-Wartungsverträge und Herstellersupport:',
      },
    },
    cloud: {
      // [schwach] Modellannahme: Premium-Support des Plattformanbieters.
      opex: {
        unitCost: 90,
        basis: 'per-vm',
        escalation: null,
        noteTemplate: 'Premium-Support des Plattformanbieters:',
      },
    },
  },

  /* ── Personal / Betriebsaufwand ───────────────────────────────────── */
  staff: {
    onprem: {
      opex: {
        // [mittel] Vollkosten je Vollzeitkraft, siehe GLOBALS.fteCostPerYear.
        unitCost: GLOBALS.fteCostPerYear,
        basis: 'per-fte',
        escalation: null,
        noteTemplate: 'Betrieb, Patching und Hardwarebetreuung:',
      },
    },
    cloud: {
      // Gleicher Satz; die Entlastung steckt in GLOBALS.cloudStaffFactor.
      opex: {
        unitCost: GLOBALS.fteCostPerYear,
        basis: 'per-fte',
        escalation: null,
        noteTemplate: 'Plattformsteuerung und Betrieb, ohne Hardwarebetreuung:',
      },
    },
  },

  /* ── Security & Compliance ────────────────────────────────────────── */
  security: {
    onprem: {
      // [schwach] Modellannahme: Werkzeuge, Audits, Penetrationstests.
      opex: {
        unitCost: 180,
        basis: 'per-vm',
        escalation: null,
        noteTemplate: 'Security-Werkzeuge, Audits und Penetrationstests:',
      },
    },
    cloud: {
      // [schwach] Modellannahme: leicht niedriger, da Basisdienste enthalten.
      opex: {
        unitCost: 150,
        basis: 'per-vm',
        escalation: null,
        noteTemplate: 'Cloud-Security-Werkzeuge und Compliance-Nachweise:',
      },
    },
  },

  /* ── Migration und Einmalaufwände ─────────────────────────────────── */
  migration: {
    /** Weiterbetrieb im eigenen Rechenzentrum verursacht keinen Migrationsaufwand. */
    onprem: null,
    cloud: {
      // [schwach] Modellannahme: 900 € je VM, einmalig, über 3 Jahre aktiviert.
      capex: {
        unitCost: 900,
        basis: 'per-vm',
        usefulLifeYears: 3,
        noteTemplate: 'Einmalige Migrationsleistung:',
      },
    },
  },

  /* ── Sonstiges ────────────────────────────────────────────────────── */
  other: {
    onprem: {
      // [schwach] Modellannahme: Schulung, Verbrauchsmaterial, Kleinteiliges.
      opex: {
        unitCost: 150,
        basis: 'per-vm',
        escalation: null,
        noteTemplate: 'Schulung und Kleinteiliges:',
      },
    },
    cloud: {
      // [schwach] Modellannahme: Enablement-Aufwand in der Cloud etwas höher.
      opex: {
        unitCost: 190,
        basis: 'per-vm',
        escalation: null,
        noteTemplate: 'Schulung und Enablement des Teams:',
      },
    },
  },
}
