import { useMemo } from 'react'
import { useStore } from '../../state/store'
import { confirmedBlockCount } from '../../domain/presets/generate'
import { IntegerInput, PercentInput } from '../components/fields'
import { ExportBar } from './ExportBar'

/**
 * Kopfleiste mit den globalen Rahmenparametern.
 *
 * Diese vier Werte gelten für beide Szenarien und stehen deshalb dauerhaft
 * sichtbar über der Eingabe.
 */
export function SettingsBar() {
  const settings = useStore((s) => s.project.settings)
  const title = useStore((s) => s.project.meta.title)
  const updateSettings = useStore((s) => s.updateSettings)
  const updateMeta = useStore((s) => s.updateMeta)
  const setView = useStore((s) => s.setView)
  const project = useStore((s) => s.project)
  const setProfileOpen = useStore((s) => s.setProfileOpen)
  const counts = useMemo(() => confirmedBlockCount(project), [project])

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-4 py-3">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-64 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-600">
              TCO-Vergleich
            </p>
            <input
              className="w-full border-0 bg-transparent p-0 text-lg font-semibold text-slate-900 focus:outline-none focus:ring-0"
              value={title}
              onChange={(e) => updateMeta({ title: e.target.value })}
              aria-label="Titel des Vergleichs"
            />
            {counts.total > 0 && (
              <p className="mt-0.5 text-xs text-slate-500">
                <span
                  className={
                    counts.confirmed === counts.total
                      ? 'font-medium text-emerald-700'
                      : 'font-medium text-slate-700'
                  }
                >
                  {counts.confirmed} von {counts.total}
                </span>{' '}
                {counts.total === 1 ? 'Block' : 'Blöcken'} kundenbestätigt
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Compact label="Startjahr">
              <IntegerInput
                value={settings.startYear}
                min={1990}
                max={2999}
                onChange={(v) => v !== null && updateSettings({ startYear: v })}
              />
            </Compact>
            <Compact label="Laufzeit">
              <IntegerInput
                value={settings.horizonYears}
                min={1}
                max={10}
                suffix="J."
                onChange={(v) => v !== null && updateSettings({ horizonYears: v })}
              />
            </Compact>
            <Compact label="Diskontsatz" hint="nominal">
              <PercentInput
                value={settings.discountRate}
                onChange={(v) => v !== null && updateSettings({ discountRate: v })}
              />
            </Compact>
            <Compact label="Steigerung" hint="global">
              <PercentInput
                value={settings.defaultEscalation}
                onChange={(v) => v !== null && updateSettings({ defaultEscalation: v })}
              />
            </Compact>

            <div className="flex items-end gap-2">
              <div>
                <span className="block text-xs font-medium text-slate-600">Sicht</span>
                <div className="mt-1 flex rounded-md border border-slate-300 bg-white p-0.5">
                  <ViewButton
                    active={settings.view === 'cashflow'}
                    onClick={() => setView('cashflow')}
                    title="Auszahlung im Jahr des Anfalls"
                  >
                    Cashflow
                  </ViewButton>
                  <ViewButton
                    active={settings.view === 'pnl'}
                    onClick={() => setView('pnl')}
                    title="Abgeschriebene Kosten (P&L-Sicht)"
                  >
                    P&amp;L
                  </ViewButton>
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-600">Darstellung</span>
                <div className="mt-1 flex rounded-md border border-slate-300 bg-white p-0.5">
                  <ViewButton
                    active={!settings.discounted}
                    onClick={() => updateSettings({ discounted: false })}
                  >
                    nominal
                  </ViewButton>
                  <ViewButton
                    active={settings.discounted}
                    disabled={settings.view === 'pnl'}
                    onClick={() => updateSettings({ discounted: true })}
                    title={
                      settings.view === 'pnl'
                        ? 'Barwerte setzen Zahlungsströme voraus und sind in der P&L-Sicht nicht anwendbar.'
                        : 'Barwertdarstellung mit dem eingestellten Diskontsatz'
                    }
                  >
                    Barwert
                  </ViewButton>
                </div>
              </div>
            </div>

            <div className="flex items-end gap-1.5">
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                title="Szenario aus fünf Profilmerkmalen hochrechnen. Überschreibt nur geschätzte Positionen."
                className="rounded-md border border-accent-300 bg-accent-50 px-2.5 py-1.5 text-sm font-medium text-accent-800 transition hover:bg-accent-100"
              >
                Profil
              </button>
              <ExportBar />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function Compact({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block w-28">
      <span className="block truncate text-xs font-medium text-slate-600">
        {label}
        {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function ViewButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'rounded px-2.5 py-1 text-sm transition',
        active ? 'bg-accent-600 text-white' : 'text-slate-600 hover:bg-slate-100',
        disabled ? 'cursor-not-allowed opacity-40 hover:bg-transparent' : '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
