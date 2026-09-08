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
    refreshYear: 3,
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
 * Hardware in Jahr 3 ersetzt werden müsste. Damit entsteht ein echter
 * Break-even statt eines trivialen Ergebnisses.
 */
export function demoProfile(): Profile {
  return {
    vmCount: 150,
    employeeCount: null,
    storageTB: 120,
    refreshYear: 3,
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
