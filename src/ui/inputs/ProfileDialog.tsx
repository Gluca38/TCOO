import { useEffect, useState } from 'react'
import { useStore } from '../../state/store'
import {
  OPERATING_MODEL_LABELS,
  REGULATION_LABELS,
  demoProfile,
  emptyProfile,
} from '../../domain/presets/profile'
import { GLOBALS } from '../../domain/presets/coefficients'
import { derive } from '../../domain/presets/generate'
import { AmountInput, Field, IntegerInput, inputClass } from '../components/fields'
import { num } from '../../format'
import type { Profile } from '../../domain/types'

/**
 * Profildialog.
 *
 * Fünf Merkmale, die sich im Erstgespräch erfragen lassen. Alles Weitere
 * liegt eingeklappt unter „Annahmen" — dort stehen die beiden Werte, die das
 * Ergebnis am stärksten bewegen und am schlechtesten belegt sind.
 */
export function ProfileDialog() {
  const open = useStore((s) => s.profileOpen)
  const setOpen = useStore((s) => s.setProfileOpen)
  const stored = useStore((s) => s.project.profile)
  const horizonYears = useStore((s) => s.project.settings.horizonYears)
  const startYear = useStore((s) => s.project.settings.startYear)
  const generate = useStore((s) => s.generateFromProfile)

  const [profile, setProfile] = useState<Profile>(stored ?? emptyProfile())
  const [showAssumptions, setShowAssumptions] = useState(false)

  // Beim Öffnen den gespeicherten Stand übernehmen.
  useEffect(() => {
    if (open) setProfile(stored ?? emptyProfile())
  }, [open, stored])

  if (!open) return null

  const patch = (p: Partial<Profile>) => setProfile((prev) => ({ ...prev, ...p }))
  const derived = derive(profile)
  const usable = derived.vmCount > 0

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/30"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label="Szenario aus Profil erzeugen"
        className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(44rem,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-accent-600">
              Vorbefüllung
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-slate-900">
              Szenario aus Profil erzeugen
            </h2>
            <p className="mt-1 max-w-lg text-sm text-slate-500">
              Aus diesen Merkmalen werden alle Blöcke hochgerechnet — als
              Gesprächsgrundlage, nicht als Ergebnis. Jede erzeugte Position wird als
              „geschätzt" gekennzeichnet.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Anzahl VMs">
              <IntegerInput
                value={profile.vmCount || null}
                min={0}
                max={100_000}
                allowEmpty
                placeholder="z. B. 150"
                onChange={(v) => patch({ vmCount: v ?? 0 })}
              />
            </Field>

            <Field label="oder Mitarbeiterzahl" hint="wird umgerechnet">
              <IntegerInput
                value={profile.employeeCount}
                min={0}
                max={1_000_000}
                allowEmpty
                placeholder={`× ${num(GLOBALS.vmsPerEmployee)} VMs je Person`}
                onChange={(v) => patch({ employeeCount: v })}
              />
            </Field>

            <Field label="Storage" hint="optional">
              <AmountInput
                value={profile.storageTB ?? 0}
                suffix="TB"
                onChange={(v) => patch({ storageTB: v === 0 ? null : v })}
              />
            </Field>

            <Field label="Nächster Hardware-Refresh">
              <select
                className={inputClass}
                value={profile.refreshYear === 'outside' ? 'outside' : String(profile.refreshYear)}
                onChange={(e) =>
                  patch({
                    refreshYear: e.target.value === 'outside' ? 'outside' : Number(e.target.value),
                  })
                }
              >
                {Array.from({ length: horizonYears }, (_, i) => i + 1).map((t) => (
                  <option key={t} value={t}>
                    {startYear + t - 1}
                  </option>
                ))}
                <option value="outside">liegt außerhalb der Laufzeit</option>
              </select>
            </Field>

            <Field label="Betriebsmodell heute">
              <select
                className={inputClass}
                value={profile.operatingModel}
                onChange={(e) =>
                  patch({ operatingModel: e.target.value as Profile['operatingModel'] })
                }
              >
                {Object.entries(OPERATING_MODEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Regulierungsgrad">
              <select
                className={inputClass}
                value={profile.regulation}
                onChange={(e) => patch({ regulation: e.target.value as Profile['regulation'] })}
              >
                {Object.entries(REGULATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* ── Annahmen ──────────────────────────────────────────────── */}
          <div className="rounded-md border border-slate-200">
            <button
              type="button"
              onClick={() => setShowAssumptions((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <span>
                Annahmen
                <span className="ml-2 font-normal text-slate-500">
                  {profile.vmsPerHost || profile.vmsPerFte ? 'angepasst' : 'Standardwerte'}
                </span>
              </span>
              <span className="text-slate-400">{showAssumptions ? '▾' : '▸'}</span>
            </button>

            {showAssumptions && (
              <div className="border-t border-slate-200 px-3 py-3">
                <p className="mb-3 rounded bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                  Diese beiden Werte bewegen das Ergebnis am stärksten und sind zugleich
                  am schwächsten belegt: die verfügbaren Erhebungen stammen aus 2009–2011
                  und streuen um den Faktor 10. Wenn der Kunde eigene Zahlen nennt,
                  gehören sie hierher.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="VMs je Host" hint={`Standard ${GLOBALS.vmsPerHost}`}>
                    <IntegerInput
                      value={profile.vmsPerHost}
                      min={1}
                      max={200}
                      allowEmpty
                      placeholder={String(GLOBALS.vmsPerHost)}
                      onChange={(v) => patch({ vmsPerHost: v })}
                    />
                  </Field>
                  <Field label="VMs je Vollzeitkraft" hint={`Standard ${GLOBALS.vmsPerFte}`}>
                    <IntegerInput
                      value={profile.vmsPerFte}
                      min={1}
                      max={1000}
                      allowEmpty
                      placeholder={String(GLOBALS.vmsPerFte)}
                      onChange={(v) => patch({ vmsPerFte: v })}
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* ── Vorschau des Mengengerüsts ────────────────────────────── */}
          {usable && (
            <div className="rounded-md bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              <span className="font-medium text-slate-700">Daraus wird gerechnet:</span>{' '}
              {num(derived.vmCount, 0)} VMs · {num(derived.hosts, 0)} Hosts (inkl. einem
              Reserveknoten) · {num(derived.storageTB, 0)} TB ·{' '}
              {num(derived.fteOnprem, 1)} Vollzeitkräfte On-Prem gegenüber{' '}
              {num(derived.fteCloud, 1)} in der Cloud
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={() => setProfile(demoProfile())}
            className="text-sm text-slate-500 hover:text-accent-700"
          >
            Demowerte einsetzen
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={!usable}
              onClick={() => generate(profile)}
              className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Szenario erzeugen
            </button>
          </div>
        </div>

        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
          Bereits angepasste und kundenbestätigte Positionen bleiben unangetastet — es
          werden ausschließlich geschätzte Werte überschrieben.
        </p>
      </div>
    </>
  )
}
