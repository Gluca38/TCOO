import type { Profile } from '../types'

/**
 * Profil-Defaults und Demo-Profil.
 */

/**
 * Leeres Profil als Ausgangspunkt für den Dialog.
 *
 * `vmsPerHost` und `vmsPerFte` bleiben null — dann gelten die Werte aus der
 * Koeffiziententabelle. Sie sind nur zu füllen, wenn der Kunde eigene Zahlen
 * nennt.
 */
export function emptyProfile(): Profile {
  return {
    vmCount: 0,
    employeeCount: null,
    storageTB: null,
    refreshYear: 1,
    operatingModel: 'own-dc',
    regulation: 'standard',
    vmsPerHost: null,
    vmsPerFte: null,
  }
}

/**
 * Demo-Profil für den ersten Eindruck.
 *
 * Bewusst der typische Entscheidungsfall: mittelgroße Umgebung, deren
 * Hardware jetzt ersetzt werden müsste. Genau dieser Anlass — der
 * anstehende Refresh — ist im Kundengespräch der Grund, warum überhaupt
 * verglichen wird. On-Prem-Ersatzinvestition und Cloud-Migration fallen
 * damit im selben Jahr an, statt dass On-Prem einen strukturellen
 * Zeitvorsprung bekommt.
 */
export function demoProfile(): Profile {
  return {
    vmCount: 150,
    employeeCount: null,
    storageTB: 120,
    refreshYear: 1,
    operatingModel: 'own-dc',
    regulation: 'elevated',
    vmsPerHost: null,
    vmsPerFte: null,
  }
}

export const OPERATING_MODEL_LABELS: Record<Profile['operatingModel'], string> = {
  'own-dc': 'Eigenes Rechenzentrum',
  colocation: 'Colocation',
  hoster: 'Externer Hoster',
}

export const REGULATION_LABELS: Record<Profile['regulation'], string> = {
  standard: 'Standard',
  elevated: 'Erhöht',
  high: 'Stark reguliert',
}
