import { useRef, useState } from 'react'
import { useStore } from '../../state/store'
import { deserializeProject, downloadText, serializeProject, suggestedFileName } from '../../io/json'
import { projectToCsv } from '../../io/csv'

/**
 * Export, Import und Zurücksetzen.
 *
 * Bewusst ohne native Browserdialoge: Die App läuft auch eingebettet in einem
 * abgeschotteten Rahmen, in dem diese blockiert sind und ohne Fehlermeldung
 * einen negativen Wert liefern — der Knopf wirkt dann kaputt. Die Rückfrage
 * steht deshalb in der Seite selbst.
 */
export function ExportBar() {
  const project = useStore((s) => s.project)
  const replaceProject = useStore((s) => s.replaceProject)
  const reset = useStore((s) => s.reset)
  const fileInput = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<string[] | null>(null)
  const [askReset, setAskReset] = useState(false)

  async function handleFile(file: File) {
    const result = deserializeProject(await file.text())
    if (result.ok) {
      setErrors(null)
      replaceProject(result.project)
    } else {
      setErrors(result.errors)
    }
  }

  return (
    <div className="relative">
      <div className="flex items-end gap-1.5">
        <Action
          onClick={() => downloadText(suggestedFileName(project, 'json'), serializeProject(project), 'application/json')}
          title="Vollständiger Speicherstand, verlustfrei wieder importierbar"
        >
          JSON
        </Action>
        <Action
          onClick={() =>
            downloadText(
              suggestedFileName(project, 'csv'),
              projectToCsv(project, project.settings.view),
              'text/csv',
            )
          }
          title="Für Excel aufbereitet: Annahmen, Jahreswerte, Kennzahlen und Rohdaten"
        >
          CSV
        </Action>
        <Action onClick={() => fileInput.current?.click()} title="Zuvor exportierte JSON-Datei laden">
          Import
        </Action>
        <Action
          onClick={() => {
            setErrors(null)
            setAskReset((v) => !v)
          }}
          title="Alle Eingaben verwerfen und neu beginnen"
        >
          Neu
        </Action>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />

      {askReset && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-lg">
          <p className="font-semibold text-slate-900">Alle Eingaben verwerfen?</p>
          <p className="mt-1 text-slate-600">
            Beträge, Notizen und das Profil werden gelöscht. Danach können Sie mit dem
            Beispielszenario oder einem neuen Profil beginnen.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAskReset(false)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => {
                reset()
                setAskReset(false)
              }}
              className="rounded-md bg-accent-600 px-2.5 py-1.5 text-sm font-medium text-white transition hover:bg-accent-700"
            >
              Verwerfen
            </button>
          </div>
        </div>
      )}

      {errors && (
        <div className="absolute right-0 top-full z-40 mt-2 w-96 rounded-md border border-red-200 bg-red-50 p-3 text-sm shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-red-800">Import fehlgeschlagen</p>
            <button
              type="button"
              className="text-red-400 hover:text-red-700"
              onClick={() => setErrors(null)}
              aria-label="Meldung schließen"
            >
              ×
            </button>
          </div>
          <ul className="mt-1.5 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-4 text-red-700">
            {errors.slice(0, 12).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          {errors.length > 12 && (
            <p className="mt-1 text-xs text-red-600">… und {errors.length - 12} weitere.</p>
          )}
          <p className="mt-2 text-xs text-red-600">
            Es wurde nichts geladen — der bisherige Stand bleibt unverändert.
          </p>
        </div>
      )}
    </div>
  )
}

function Action({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 transition hover:border-accent-400 hover:text-accent-700"
    >
      {children}
    </button>
  )
}
