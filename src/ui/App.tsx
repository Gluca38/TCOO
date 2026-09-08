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
  const loadDemoProfile = useStore((s) => s.loadDemoProfile)

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
              Entweder Sie tragen die Beträge je Kostenblock selbst ein — oder Sie lassen aus
              fünf Merkmalen aus dem Erstgespräch ein Szenario hochrechnen und arbeiten von
              dort aus weiter. Jede erzeugte Position wird als „geschätzt" gekennzeichnet und
              lässt sich einzeln überschreiben oder vom Kunden bestätigen.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-700"
              >
                Szenario aus Profil erzeugen
              </button>
              <button
                type="button"
                onClick={loadDemoProfile}
                className="rounded-md border border-accent-300 bg-white px-3 py-1.5 text-sm font-medium text-accent-800 transition hover:bg-accent-50"
              >
                Demo-Profil laden
              </button>
            </div>
            <p className="mt-2 text-xs text-accent-900/60">
              Die Koeffizienten sind recherchierte Größenordnungen für den deutschen Markt,
              keine Angebotspreise. Herleitung und Belastbarkeit stehen in SOURCES.md.
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
