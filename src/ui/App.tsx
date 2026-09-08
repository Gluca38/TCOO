import { useEffect } from 'react'
import { useStore } from '../state/store'
import { SettingsBar } from './inputs/SettingsBar'
import { BlockList } from './inputs/BlockList'
import { KpiBand } from './results/KpiBand'
import { YearTable } from './results/YearTable'
import { DrilldownPanel } from './results/DrilldownPanel'
import { AnnualChart, CumulativeChart } from './results/Charts'
import { Sensitivity } from './results/Sensitivity'
import { Assumptions } from './results/Assumptions'
import { ProfileDialog } from './inputs/ProfileDialog'
import { compare } from '../domain/compare'

export function App() {
  const hydrate = useStore((s) => s.hydrate)
  const hydrated = useStore((s) => s.hydrated)
  const project = useStore((s) => s.project)
  const setProfileOpen = useStore((s) => s.setProfileOpen)
  const loadExample = useStore((s) => s.loadExample)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!hydrated) {
    return <div className="p-8 text-sm text-slate-400">Lade …</div>
  }

  // „Leer" heißt: in beiden Szenarien ist noch nichts erfasst.
  const result = compare(project, 'cashflow')
  const isEmpty = result.onprem.total === 0 && result.cloud.total === 0

  return (
    <div className="min-h-screen pb-16">
      <SettingsBar />

      {isEmpty && (
        <div className="mx-auto max-w-[1600px] px-4 pt-6">
          <div className="rounded-lg border border-accent-200 bg-accent-50 p-4">
            <h2 className="text-sm font-semibold text-accent-900">Noch keine Beträge erfasst</h2>
            <p className="mt-1 max-w-3xl text-sm text-accent-900/80">
              Tragen Sie die Beträge je Kostenblock selbst ein — oder starten Sie mit einer
              der beiden Vorlagen.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-accent-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-900">Zum Kennenlernen</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Ein vollständig ausgefülltes Beispiel. Jeder Block erklärt in der Notiz,
                  was dort hineingehört und woran man Doppelzählungen erkennt.
                </p>
                <button
                  type="button"
                  onClick={loadExample}
                  className="mt-3 rounded-md border border-accent-300 px-3 py-1.5 text-sm font-medium text-accent-800 transition hover:bg-accent-50"
                >
                  Beispielszenario laden
                </button>
              </div>

              <div className="rounded-md border border-accent-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-900">Für einen echten Fall</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Fünf Merkmale aus dem Erstgespräch, daraus werden alle Blöcke
                  hochgerechnet. Jede Position wird als „geschätzt" gekennzeichnet.
                </p>
                <button
                  type="button"
                  onClick={() => setProfileOpen(true)}
                  className="mt-3 rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-700"
                >
                  Szenario aus Profil erzeugen
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-accent-900/60">
              Beide Vorlagen rechnen mit denselben Koeffizienten: recherchierte
              Größenordnungen für den deutschen Markt, keine Angebotspreise. Herleitung und
              Belastbarkeit je Wert stehen in SOURCES.md.
            </p>
          </div>
        </div>
      )}

      <BlockList />

      <section id="ergebnis" className="mx-auto max-w-[1600px] space-y-4 px-4 py-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Ergebnis</h2>
          <p className="text-sm text-slate-500">
            Jede Zahl lässt sich bis auf die eingegebenen Blöcke aufschlüsseln.
          </p>
        </div>

        <KpiBand />
        <YearTable />

        <div className="grid gap-4 xl:grid-cols-2">
          <CumulativeChart />
          <AnnualChart />
        </div>

        <Assumptions />
      </section>

      <Sensitivity />

      <footer className="mx-auto max-w-[1600px] px-4 pt-2 text-xs text-slate-400">
        Alle Eingaben bleiben in diesem Browser. Sichern über „JSON" — der Export lässt sich
        unverändert wieder importieren.
      </footer>

      <DrilldownPanel />
      <ProfileDialog />
    </div>
  )
}
