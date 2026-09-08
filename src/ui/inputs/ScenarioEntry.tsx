import type { BlockId, ScenarioKey } from '../../domain/types'
import { useStore } from '../../state/store'
import { AmountInput, Checkbox, Field, IntegerInput, PercentInput, YearSelect } from '../components/fields'
import { capexEvents } from '../../domain/calc'
import { OriginBadge } from '../components/OriginBadge'
import { eur } from '../../format'

/**
 * Eingabemaske eines Blocks für ein Szenario.
 *
 * CapEx- und OpEx-Zeile sind immer beide sichtbar und werden per Häkchen
 * aktiviert. Kein Umschalter versteckt eine der beiden — sonst lägen Daten im
 * Modell, die man nicht sieht.
 */
export function ScenarioEntry({ scenario, blockId }: { scenario: ScenarioKey; blockId: BlockId }) {
  const settings = useStore((s) => s.project.settings)
  const scenarioName = useStore((s) => s.project.scenarios[scenario].name)
  const entry = useStore((s) => s.project.scenarios[scenario].entries[blockId])
  const updateCapex = useStore((s) => s.updateCapex)
  const updateOpex = useStore((s) => s.updateOpex)
  const updateEntry = useStore((s) => s.updateEntry)

  const capex = entry?.capex ?? null
  const opex = entry?.opex ?? null
  const accent = scenario === 'onprem' ? 'border-l-onprem' : 'border-l-cloud'

  const refreshYears =
    capex && capex.active && capex.refreshEveryYears
      ? capexEvents(capex, settings.horizonYears)
          .filter((e) => e.isRefresh)
          .map((e) => settings.startYear + e.year - 1)
      : []

  return (
    <div className={`rounded-md border border-slate-200 border-l-3 ${accent} bg-white p-3`}>
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {scenarioName}
      </p>

      {/* --- CapEx ------------------------------------------------------ */}
      <div className="rounded border border-slate-150 bg-slate-50/60 p-2.5">
        <Checkbox
          checked={!!capex?.active}
          onChange={(checked) =>
            checked ? updateCapex(scenario, blockId, { active: true }) : updateCapex(scenario, blockId, null)
          }
          label={
            <span className="flex items-center gap-2">
              <span>
                Einmalig <span className="font-normal text-slate-500">(CapEx)</span>
              </span>
              {capex?.active && (
                <OriginBadge
                  origin={capex.origin}
                  onClick={() =>
                    updateCapex(scenario, blockId, {
                      origin: capex.origin === 'confirmed' ? 'adjusted' : 'confirmed',
                    })
                  }
                />
              )}
            </span>
          }
        />
        {capex?.active && (
          <>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <Field label="Betrag">
                <AmountInput
                  value={capex.amount}
                  onChange={(v) => updateCapex(scenario, blockId, { amount: v })}
                />
              </Field>
              <Field label="Anfalljahr">
                <YearSelect
                  value={capex.year}
                  startYear={settings.startYear}
                  horizonYears={settings.horizonYears}
                  onChange={(v) => v !== null && updateCapex(scenario, blockId, { year: v })}
                />
              </Field>
              <Field label="Nutzungsdauer">
                <IntegerInput
                  value={capex.usefulLifeYears}
                  min={1}
                  max={30}
                  suffix="J."
                  onChange={(v) => v !== null && updateCapex(scenario, blockId, { usefulLifeYears: v })}
                />
              </Field>
              <Field label="Wiederholung" hint="optional">
                <IntegerInput
                  value={capex.refreshEveryYears}
                  min={1}
                  max={30}
                  suffix="J."
                  allowEmpty
                  placeholder="keine"
                  onChange={(v) => updateCapex(scenario, blockId, { refreshEveryYears: v })}
                />
              </Field>
            </div>
            {refreshYears.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Reinvestition in {refreshYears.join(', ')} — jeweils {eur(capex.amount)}, nominal
                unverändert.
              </p>
            )}
          </>
        )}
      </div>

      {/* --- OpEx ------------------------------------------------------- */}
      <div className="mt-2.5 rounded border border-slate-150 bg-slate-50/60 p-2.5">
        <Checkbox
          checked={!!opex?.active}
          onChange={(checked) =>
            checked ? updateOpex(scenario, blockId, { active: true }) : updateOpex(scenario, blockId, null)
          }
          label={
            <span className="flex items-center gap-2">
              <span>
                Laufend <span className="font-normal text-slate-500">(OpEx)</span>
              </span>
              {opex?.active && (
                <OriginBadge
                  origin={opex.origin}
                  onClick={() =>
                    updateOpex(scenario, blockId, {
                      origin: opex.origin === 'confirmed' ? 'adjusted' : 'confirmed',
                    })
                  }
                />
              )}
            </span>
          }
        />
        {opex?.active && (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <Field label="Betrag">
              <AmountInput
                value={opex.amount}
                onChange={(v) => updateOpex(scenario, blockId, { amount: v })}
              />
            </Field>
            <Field label="je">
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
                value={opex.period}
                onChange={(e) =>
                  updateOpex(scenario, blockId, { period: e.target.value as 'month' | 'year' })
                }
              >
                <option value="year">Jahr</option>
                <option value="month">Monat</option>
              </select>
            </Field>
            <Field label="von">
              <YearSelect
                value={opex.startYear}
                startYear={settings.startYear}
                horizonYears={settings.horizonYears}
                onChange={(v) => v !== null && updateOpex(scenario, blockId, { startYear: v })}
              />
            </Field>
            <Field label="bis" hint="optional">
              <YearSelect
                value={opex.endYear}
                startYear={settings.startYear}
                horizonYears={settings.horizonYears}
                emptyLabel="Ende Laufzeit"
                onChange={(v) => updateOpex(scenario, blockId, { endYear: v })}
              />
            </Field>
            <div className="col-span-2">
              <Field label="Steigerung p. a." hint="leer = global">
                <PercentInput
                  value={opex.escalation}
                  allowEmpty
                  placeholder={`${(settings.defaultEscalation * 100).toLocaleString('de-DE')} (global)`}
                  onChange={(v) => updateOpex(scenario, blockId, { escalation: v })}
                />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* --- Notiz ------------------------------------------------------ */}
      <div className="mt-2.5">
        <Field label="Notiz / Herleitung">
          <textarea
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
            // Erklärung und Herleitung stehen untereinander — zwei Zeilen
            // hätten die Rechnung unsichtbar unter den Rand geschoben.
            rows={5}
            value={entry?.note ?? ''}
            placeholder="Woraus setzt sich der Betrag zusammen?"
            onChange={(e) => updateEntry(scenario, blockId, { note: e.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}
