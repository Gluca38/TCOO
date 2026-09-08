import type { BlockEntry, Project } from '../types'
import { createEmptyProject } from '../defaults'

/**
 * Referenzszenario für den Golden-Master-Test.
 *
 * Dies ist bewusst kein Bestandteil der Anwendung mehr — die Vorbefüllung
 * läuft über das Profil. Das Szenario bleibt hier als eingefrorene Fixture
 * erhalten, damit jede Änderung an der Berechnungslogik sofort auffällt.
 *
 * Ursprünglich: mittelgroße IT-Landschaft vor dem Hardware-Refresh.
 *
 * Bewusst so gewählt, dass der typische Entscheidungsfall abgebildet wird —
 * die bestehende Hardware läuft aus und müsste in Jahr 3 ersetzt werden,
 * während der Cloud-Weg Migrationsvorleistungen in den ersten beiden Jahren
 * erfordert. Dadurch entsteht ein echter Break-even statt eines trivialen
 * Ergebnisses.
 *
 * Alle Zahlen sind frei erfundene Größenordnungen zu Demonstrationszwecken
 * und ausdrücklich keine Preisempfehlung.
 */

type CapexInput = { amount: number; year: number; life: number; refresh?: number }
type OpexInput = {
  amount: number
  period?: 'month' | 'year'
  from?: number
  to?: number
  escalation?: number
}

function entry(blockId: string, note: string, capex?: CapexInput, opex?: OpexInput): BlockEntry {
  return {
    blockId,
    note,
    noteOrigin: 'manual',
    capex: capex
      ? {
          active: true,
          amount: capex.amount,
          origin: 'adjusted',
          uncertainty: null,
          year: capex.year,
          usefulLifeYears: capex.life,
          refreshEveryYears: capex.refresh ?? null,
        }
      : null,
    opex: opex
      ? {
          active: true,
          amount: opex.amount,
          origin: 'adjusted',
          uncertainty: null,
          period: opex.period ?? 'year',
          startYear: opex.from ?? 1,
          endYear: opex.to ?? null,
          escalation: opex.escalation ?? null,
        }
      : null,
  }
}

export function createReferenceProject(): Project {
  const p = createEmptyProject()
  p.meta.title = 'Beispiel: Hardware-Refresh vs. Migration in die Public Cloud'
  p.meta.notes =
    'Demonstrationsdaten. Die bestehende Serverlandschaft erreicht in Jahr 3 das Ende der Nutzungsdauer. ' +
    'Verglichen wird die Ersatzinvestition gegen eine Migration in die Public Cloud.'
  p.settings.horizonYears = 5
  p.settings.discountRate = 0.07
  p.settings.defaultEscalation = 0.03

  p.scenarios.onprem.notes =
    'Weiterbetrieb im eigenen Rechenzentrum mit Ersatzinvestition in Jahr 3.'
  p.scenarios.onprem.entries = {
    compute: entry(
      'compute',
      'Ersatz von 24 Hosts am Ende der Nutzungsdauer, Beschaffung in Jahr 3.',
      { amount: 900_000, year: 3, life: 5 },
    ),
    database: entry('database', 'Dedizierte Datenbankserver, gleicher Refresh-Zyklus.', {
      amount: 160_000,
      year: 3,
      life: 5,
    }),
    storage: entry('storage', 'SAN-Erneuerung, rund 400 TB nutzbar.', {
      amount: 420_000,
      year: 3,
      life: 5,
    }),
    network: entry(
      'network',
      'Core-Switching-Erneuerung in Jahr 2, laufende WAN-Anbindung.',
      { amount: 180_000, year: 2, life: 5 },
      { amount: 3_500, period: 'month' },
    ),
    backup: entry(
      'backup',
      'Backup-Appliance in Jahr 4, laufende Medien- und Zweitstandortkosten.',
      { amount: 210_000, year: 4, life: 5 },
      { amount: 24_000 },
    ),
    facility: entry(
      'facility',
      'Flächenumlage, Strom und Klimatisierung. Erhöhte Steigerungsrate wegen Energiepreisen.',
      undefined,
      { amount: 168_000, escalation: 0.06 },
    ),
    licenses: entry(
      'licenses',
      'Virtualisierung, Betriebssysteme, Datenbanklizenzen.',
      undefined,
      { amount: 240_000, escalation: 0.05 },
    ),
    support: entry('support', 'Hardware-Wartungsverträge und Herstellersupport.', undefined, {
      amount: 145_000,
    }),
    staff: entry(
      'staff',
      'Rund 4 Vollzeitkräfte für Betrieb, Patching und Hardwarebetreuung.',
      undefined,
      { amount: 480_000 },
    ),
    security: entry(
      'security',
      'Security-Tooling, jährliches Audit, Penetrationstests.',
      undefined,
      { amount: 65_000 },
    ),
    migration: entry('migration', '', undefined, undefined),
    other: entry('other', 'Kleinteiliges, Schulungen, Verbrauchsmaterial.', undefined, {
      amount: 30_000,
    }),
  }

  p.scenarios.cloud.notes =
    'Migration in die Public Cloud mit Parallelbetrieb in den ersten beiden Jahren.'
  p.scenarios.cloud.entries = {
    compute: entry('compute', 'Rechenleistung inklusive Reservierungsrabatten.', undefined, {
      amount: 31_000,
      period: 'month',
    }),
    database: entry('database', 'Managed-Datenbankdienste inklusive Hochverfügbarkeit.', undefined, {
      amount: 9_500,
      period: 'month',
    }),
    storage: entry('storage', 'Block- und Objektspeicher inklusive Snapshots.', undefined, {
      amount: 6_200,
      period: 'month',
    }),
    network: entry(
      'network',
      'Anbindung, Load Balancing und ausgehender Datenverkehr.',
      undefined,
      { amount: 4_100, period: 'month' },
    ),
    backup: entry('backup', 'Backup-Service und georedundante Ablage.', undefined, {
      amount: 3_400,
      period: 'month',
    }),
    facility: entry('facility', '', undefined, undefined),
    licenses: entry(
      'licenses',
      'Verbleibende Lizenzen; ein Teil ist in den Diensten enthalten.',
      undefined,
      { amount: 96_000, escalation: 0.05 },
    ),
    support: entry('support', 'Premium-Support des Plattformanbieters.', undefined, {
      amount: 54_000,
    }),
    staff: entry(
      'staff',
      'Rund 2,5 Vollzeitkräfte; Hardwarebetreuung entfällt, Plattformsteuerung kommt hinzu.',
      undefined,
      { amount: 300_000 },
    ),
    security: entry(
      'security',
      'Cloud-Security-Werkzeuge und angepasstes Compliance-Regime.',
      undefined,
      { amount: 48_000 },
    ),
    migration: entry(
      'migration',
      'Aktivierte Migrationsleistung über 3 Jahre abgeschrieben, dazu Parallelbetrieb und externe Unterstützung in den Jahren 1 und 2.',
      { amount: 380_000, year: 1, life: 3 },
      { amount: 120_000, from: 1, to: 2 },
    ),
    other: entry('other', 'Schulung und Enablement des Teams.', undefined, { amount: 24_000 }),
  }

  return p
}
