import { useMemo, useState } from 'react'
import { useStore } from '../../state/store'
import { compare } from '../../domain/compare'
import { withParameters } from '../../domain/sensitivity'
import { TornadoChart } from './Charts'
import { breakEvenLabel, eurSigned, num } from '../../format'

/**
 * Sensitivitätsabschnitt.
 *
 * Die Schieberegler verändern nur die Anzeige, nicht die gespeicherten
 * Einstellungen — der Ausgangswert bleibt daneben sichtbar.
 */
export function Sensitivity() {
  const project = useStore((s) => s.project)
  const [rate, setRate] = useState<number | null>(null)
  const [horizon, setHorizon] = useState<number | null>(null)
  const [pct, setPct] = useState(0.2)

  const effectiveRate = rate ?? project.settings.discountRate
  const effectiveHorizon = horizon ?? project.settings.horizonYears
  const touched = rate !== null || horizon !== null

  const baseline = useMemo(() => compare(project, project.settings.view), [project])
  const variant = useMemo(
    () =>
      compare(
        withParameters(project, { discountRate: effectiveRate, horizonYears: effectiveHorizon }),
        project.settings.view,
      ),
    [project, effectiveRate, effectiveHorizon],
  )

  return (
    <section id="sensitivitaet" className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">Sensitivität</h2>
        <p className="text-sm text-slate-500">
          Wie stabil ist das Ergebnis, wenn sich Annahmen verschieben?
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <TornadoChart pct={pct} />

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Parameter verschieben</h3>
            <p className="mb-4 text-xs text-slate-500">
              Wirkt nur auf diese Ansicht. Die gespeicherten Einstellungen bleiben unverändert.
            </p>

            <Slider
              label="Diskontierungssatz"
              value={effectiveRate * 100}
              min={0}
              max={15}
              step={0.5}
              suffix=" %"
              baseline={`Ausgangswert ${num(project.settings.discountRate * 100)} %`}
              onChange={(v) => setRate(v / 100)}
            />
            <Slider
              label="Betrachtungszeitraum"
              value={effectiveHorizon}
              min={1}
              max={10}
              step={1}
              suffix=" Jahre"
              baseline={`Ausgangswert ${project.settings.horizonYears} Jahre`}
              onChange={setHorizon}
            />
            <Slider
              label="Variation im Tornado"
              value={pct * 100}
              min={5}
              max={50}
              step={5}
              suffix=" %"
              baseline="Standard 20 %"
              onChange={(v) => setPct(v / 100)}
            />

            {touched && (
              <button
                type="button"
                onClick={() => {
                  setRate(null)
                  setHorizon(null)
                }}
                className="mt-1 text-sm text-accent-700 hover:underline"
              >
                Auf Ausgangswerte zurücksetzen
              </button>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Wirkung</h3>
            <Comparison
              label="Differenz gesamt"
              baseline={eurSigned(baseline.delta)}
              variant={eurSigned(variant.delta)}
              changed={touched}
            />
            <Comparison
              label="Barwertdifferenz"
              baseline={eurSigned(baseline.npvDelta)}
              variant={eurSigned(variant.npvDelta)}
              changed={touched}
            />
            <Comparison
              label="Break-even"
              baseline={breakEvenLabel(baseline.breakEvenYear, project.settings.startYear)}
              variant={breakEvenLabel(variant.breakEvenYear, project.settings.startYear)}
              changed={touched}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  baseline,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  baseline: string
  onChange: (value: number) => void
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="tabular text-sm font-semibold text-slate-900">
          {num(value, 1)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-accent-600"
      />
      <p className="text-[11px] text-slate-400">{baseline}</p>
    </div>
  )
}

function Comparison({
  label,
  baseline,
  variant,
  changed,
}: {
  label: string
  baseline: string
  variant: string
  changed: boolean
}) {
  const differs = changed && baseline !== variant
  return (
    <div className="mb-2.5 last:mb-0">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`tabular text-sm font-semibold ${differs ? 'text-accent-700' : 'text-slate-900'}`}>
          {variant}
        </span>
        {differs && <span className="tabular text-xs text-slate-400 line-through">{baseline}</span>}
      </div>
    </div>
  )
}
