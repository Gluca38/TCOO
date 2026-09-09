import { useState } from 'react'
import { useStore } from '../../state/store'
import { useComparison } from '../useComparison'
import { calendarYear, discountFactor } from '../../domain/calc'
import { eur, eurSigned } from '../../format'
import type { ScenarioKey } from '../../domain/types'

type TableMode = ScenarioKey | 'delta'

/**
 * Jahrestabelle: Zeilen sind Blöcke, Spalten sind Jahre.
 *
 * Jede Zelle ist anklickbar und öffnet die Aufschlüsselung. Damit ist jede
 * Zahl bis auf die Eingaben rückverfolgbar.
 */
export function YearTable() {
  const project = useStore((s) => s.project)
  const setDrilldown = useStore((s) => s.setDrilldown)
  const result = useComparison()
  const [mode, setMode] = useState<TableMode>('delta')

  const { settings, blocks } = project
  const years = result.onprem.years
  const discounted = settings.discounted && settings.view === 'cashflow'
  const factor = (t: number) => (discounted ? discountFactor(settings.discountRate, t) : 1)

  function seriesFor(blockId: string): number[] {
    const on = result.onprem.byBlock[blockId] ?? []
    const cl = result.cloud.byBlock[blockId] ?? []
    if (mode === 'onprem') return on.map((v, i) => v * factor(i + 1))
    if (mode === 'cloud') return cl.map((v, i) => v * factor(i + 1))
    return on.map((v, i) => (v - cl[i]) * factor(i + 1))
  }

  /**
   * Summenzeile in der gewählten Ansicht.
   *
   * Die kumulierte Zeile entsteht bewusst nicht hier, sondern durch
   * Aufsummieren der Gesamtzeile — nur so stimmt sie auch in der
   * Differenzansicht mit den darüberstehenden Werten überein.
   */
  function summaryRow(pick: 'capex' | 'opex' | 'total'): number[] {
    const on = result.onprem
    const cl = result.cloud
    const get = (s: typeof on) =>
      pick === 'capex' ? s.capexByYear : pick === 'opex' ? s.opexByYear : s.totalByYear

    if (mode === 'onprem') return get(on).map((v, i) => v * factor(i + 1))
    if (mode === 'cloud') return get(cl).map((v, i) => v * factor(i + 1))
    return get(on).map((v, i) => (v - get(cl)[i]) * factor(i + 1))
  }

  const visibleBlocks = blocks.filter((b) => {
    if (!b.enabled) return false
    const s = seriesFor(b.id)
    return s.some((v) => v !== 0)
  })

  const fmt = mode === 'delta' ? eurSigned : eur

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Jahreswerte</h3>
          <p className="text-xs text-slate-500">
            {settings.view === 'cashflow' ? 'Cashflow-Sicht' : 'P&L-Sicht (abgeschriebene Kosten)'}
            {discounted && ' · Barwerte'}
            {mode === 'delta'
              ? ' · für die Herleitung einer Zahl auf ein Szenario umschalten'
              : ' · Klick auf eine Zelle zeigt die Herleitung'}
          </p>
        </div>
        <div className="flex rounded-md border border-slate-300 bg-white p-0.5">
          {(['onprem', 'cloud', 'delta'] as TableMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded px-2.5 py-1 text-sm transition ${
                mode === m ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {m === 'onprem' ? project.scenarios.onprem.name : m === 'cloud' ? project.scenarios.cloud.name : 'Differenz'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-semibold">Block</th>
              {years.map((t) => (
                <th key={t} className="px-3 py-2 text-right font-semibold">
                  {calendarYear(settings, t)}
                </th>
              ))}
              <th className="px-4 py-2 text-right font-semibold">Gesamt</th>
            </tr>
          </thead>

          <tbody>
            {visibleBlocks.map((block) => {
              const series = seriesFor(block.id)
              return (
                <tr key={block.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-1.5 text-slate-700 hover:bg-slate-50">
                    {block.name}
                  </td>
                  {series.map((v, i) => (
                    <td key={i} className="px-3 py-1.5 text-right tabular">
                      <button
                        type="button"
                        disabled={v === 0 || mode === 'delta'}
                        onClick={() =>
                          setDrilldown({
                            scenario: mode === 'delta' ? 'onprem' : mode,
                            year: i + 1,
                            blockId: block.id,
                          })
                        }
                        className={
                          v === 0
                            ? 'text-slate-300'
                            : mode === 'delta'
                              ? v > 0 ? 'text-emerald-700' : 'text-red-700'
                              : 'text-slate-700 underline decoration-slate-300 decoration-dotted underline-offset-4 hover:text-accent-700 hover:decoration-accent-500'
                        }
                      >
                        {v === 0 ? '—' : fmt(v)}
                      </button>
                    </td>
                  ))}
                  <td className="px-4 py-1.5 text-right font-medium tabular text-slate-800">
                    {fmt(series.reduce((a, b) => a + b, 0))}
                  </td>
                </tr>
              )
            })}

            {visibleBlocks.length === 0 && (
              <tr>
                <td colSpan={years.length + 2} className="px-4 py-8 text-center text-sm text-slate-400">
                  Noch keine Beträge erfasst.
                </td>
              </tr>
            )}
          </tbody>

          <tfoot className="border-t-2 border-slate-300">
            <SummaryRow label="Summe CapEx" values={summaryRow('capex')} fmt={fmt} />
            <SummaryRow label="Summe OpEx" values={summaryRow('opex')} fmt={fmt} />
            <SummaryRow label="Gesamt" values={summaryRow('total')} fmt={fmt} strong />
            <SummaryRow label="Kumuliert" values={cumulate(summaryRow('total'))} fmt={fmt} muted noTotal />
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  values,
  fmt,
  strong,
  muted,
  noTotal,
}: {
  label: string
  values: number[]
  fmt: (v: number) => string
  strong?: boolean
  muted?: boolean
  noTotal?: boolean
}) {
  return (
    <tr className={strong ? 'bg-slate-50 font-semibold text-slate-900' : muted ? 'text-slate-500' : 'text-slate-700'}>
      <td className={`sticky left-0 z-10 px-4 py-1.5 ${strong ? 'bg-slate-50' : 'bg-white'}`}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-3 py-1.5 text-right tabular">
          {fmt(v)}
        </td>
      ))}
      <td className="px-4 py-1.5 text-right tabular">
        {noTotal ? '' : fmt(values.reduce((a, b) => a + b, 0))}
      </td>
    </tr>
  )
}

function cumulate(values: number[]): number[] {
  let running = 0
  return values.map((v) => (running += v))
}
