import { useStore } from '../../state/store'
import { calendarYear, discountFactor, explainCell } from '../../domain/calc'
import { eurPrecise, num } from '../../format'

/**
 * Aufschlüsselung einer einzelnen Ergebniszelle.
 *
 * Zeigt jede angewandte Rechenoperation mit Zwischenergebnis. Was hier nicht
 * steht, passiert auch in der Berechnung nicht.
 */
export function DrilldownPanel() {
  const project = useStore((s) => s.project)
  const drilldown = useStore((s) => s.drilldown)
  const setDrilldown = useStore((s) => s.setDrilldown)

  if (!drilldown) return null

  const { scenario, year, blockId } = drilldown
  const { settings } = project
  const contributions = explainCell(project, scenario, year, settings.view, blockId)
  const block = project.blocks.find((b) => b.id === blockId)
  const discounted = settings.discounted && settings.view === 'cashflow'
  const df = discountFactor(settings.discountRate, year)

  const subtotal = contributions.reduce((a, c) => a + c.value, 0)
  const total = discounted ? subtotal * df : subtotal

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/20"
        onClick={() => setDrilldown(null)}
        aria-hidden
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-accent-600">Herleitung</p>
            <h3 className="mt-0.5 text-base font-semibold text-slate-900">
              {project.scenarios[scenario].name}
              {block && ` · ${block.name}`}
            </h3>
            <p className="text-sm text-slate-500">
              {calendarYear(settings, year)} ·{' '}
              {settings.view === 'cashflow' ? 'Cashflow-Sicht' : 'P&L-Sicht'}
              {discounted && ' · Barwert'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrilldown(null)}
            className="rounded p-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {contributions.length === 0 && (
            <p className="text-sm text-slate-500">
              In diesem Jahr fallen hier keine Kosten an.
            </p>
          )}

          <ul className="space-y-4">
            {contributions.map((c, i) => (
              <li key={i} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-slate-800">{c.blockName}</p>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      c.kind === 'capex' ? 'bg-slate-200 text-slate-700' : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    {c.kind === 'capex' ? 'CapEx' : 'OpEx'}
                  </span>
                </div>

                <ol className="mt-2 space-y-1.5">
                  {c.steps.map((step, j) => (
                    <li key={j} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-slate-600">
                        <span className="font-medium text-slate-700">{step.label}</span>
                        {step.detail && <span className="text-slate-500"> · {step.detail}</span>}
                      </span>
                      <span className="shrink-0 tabular text-slate-800">{eurPrecise(step.value)}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-2 flex items-baseline justify-between border-t border-slate-150 pt-2 text-sm font-medium">
                  <span className="text-slate-700">Beitrag</span>
                  <span className="tabular text-slate-900">{eurPrecise(c.value)}</span>
                </div>
              </li>
            ))}
          </ul>

          {contributions.length > 0 && (
            <div className="mt-5 rounded-md bg-slate-50 p-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-slate-600">Zwischensumme</span>
                <span className="tabular text-slate-800">{eurPrecise(subtotal)}</span>
              </div>
              {discounted && (
                <div className="mt-1 flex items-baseline justify-between text-sm">
                  <span className="text-slate-600">
                    Diskontfaktor · 1 / (1 + {num(settings.discountRate * 100)} %)
                    <sup>{year}</sup> = {num(df, 4)}
                  </span>
                  <span className="tabular text-slate-800">× {num(df, 4)}</span>
                </div>
              )}
              <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                <span className="text-slate-800">Ergebnis</span>
                <span className="tabular text-slate-900">{eurPrecise(total)}</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
