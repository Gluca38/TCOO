import type { Origin } from '../../domain/types'

/**
 * Herkunftskennzeichen einer Betragsposition.
 *
 * Der ganze Zweck der Vorbefüllung steht und fällt damit, dass im
 * Kundengespräch sichtbar ist, was Schätzung und was Kundenangabe ist.
 * Deshalb trägt jede Kennzeichnung Text, nicht nur Farbe.
 */
export const ORIGIN_LABELS: Record<Origin, string> = {
  estimated: 'geschätzt',
  adjusted: 'angepasst',
  confirmed: 'kundenbestätigt',
}

const ORIGIN_STYLES: Record<Origin, string> = {
  estimated: 'bg-amber-100 text-amber-900 ring-amber-200',
  adjusted: 'bg-slate-100 text-slate-700 ring-slate-300',
  confirmed: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
}

const ORIGIN_TITLES: Record<Origin, string> = {
  estimated:
    'Aus dem Profil erzeugt. Wird beim erneuten Generieren überschrieben und geht mit großer Bandbreite in die Sensitivität ein.',
  adjusted: 'Von Hand angepasst. Bleibt beim Generieren unangetastet.',
  confirmed: 'Vom Kunden bestätigt. Bleibt unangetastet und wackelt in der Sensitivität kaum.',
}

export function OriginBadge({ origin, onClick }: { origin: Origin; onClick?: () => void }) {
  const className = `inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${ORIGIN_STYLES[origin]}`

  if (!onClick) {
    return (
      <span className={className} title={ORIGIN_TITLES[origin]}>
        {ORIGIN_LABELS[origin]}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} transition hover:ring-2`}
      title={`${ORIGIN_TITLES[origin]}\n\nKlicken, um den Status zu wechseln.`}
    >
      {ORIGIN_LABELS[origin]}
    </button>
  )
}
