import { useStore } from '../../state/store'
import { useComparison, useWarnings } from '../useComparison'
import { OPERATING_MODEL_LABELS, REGULATION_LABELS } from '../../domain/presets/profile'
import { calendarYear } from '../../domain/calc'
import { eur, num } from '../../format'

/**
 * Annahmenkasten.
 *
 * Alles, was das Ergebnis beeinflusst, steht hier zusammen — einschließlich
 * der Abschreibung, die aus dem Zeitraum herausfällt. Der Kasten ist die
 * Antwort auf „welche Annahmen stecken in dieser Zahl".
 */
export function Assumptions() {
  const project = useStore((s) => s.project)
  const result = useComparison()
  const warnings = useWarnings().filter((w) => !w.blockId)
  const { settings } = project
  const pnl = settings.view === 'pnl'

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Annahmen und Lesehinweise</h3>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Item label="Betrachtungszeitraum">
          {settings.horizonYears} Jahre ({settings.startYear}–
          {settings.startYear + settings.horizonYears - 1})
        </Item>
        <Item label="Sicht">
          {pnl ? 'P&L — abgeschriebene Kosten' : 'Cashflow — Auszahlung im Anfalljahr'}
        </Item>
        <Item label="Diskontierungssatz">
          {num(settings.discountRate * 100)} % nominal, Jahresende-Konvention
        </Item>
        <Item label="Globale Steigerungsrate">
          {num(settings.defaultEscalation * 100)} % p. a., je Position überschreibbar
        </Item>
        <Item label="Darstellung">
          {settings.discounted && !pnl ? 'Barwerte' : 'nominale Beträge'}
        </Item>
        <Item label="Vorzeichen">Positive Differenz bedeutet: Cloud ist günstiger</Item>
      </dl>

      {project.profile && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">Aus einem Profil vorbefüllt</p>
          <p className="mt-1">
            {num(project.profile.vmCount, 0)} VMs ·{' '}
            {project.profile.storageTB === null
              ? 'Storage aus der VM-Zahl abgeleitet'
              : `${num(project.profile.storageTB, 0)} TB`}{' '}
            · Hardware-Refresh{' '}
            {project.profile.refreshYear === 'outside'
              ? 'außerhalb der Laufzeit'
              : calendarYear(settings, project.profile.refreshYear)}{' '}
            · {OPERATING_MODEL_LABELS[project.profile.operatingModel]} ·{' '}
            {REGULATION_LABELS[project.profile.regulation]}
          </p>
          <p className="mt-1.5">
            Als „geschätzt" gekennzeichnete Positionen sind recherchierte Größenordnungen
            für den deutschen Markt, <strong>keine Angebotspreise</strong>. Herleitung und
            Belastbarkeit je Wert stehen in SOURCES.md. Die beiden Werte mit dem größten
            Einfluss — VMs je Host und je Vollzeitkraft — beruhen auf Erhebungen von
            2009–2011 und sind entsprechend unsicher.
          </p>
        </div>
      )}

      <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
        <li>
          CapEx wird nicht indexiert. Beträge gelten nominal im Anfalljahr; Wiederholungen
          laufen mit demselben Betrag.
        </li>
        <li>
          Laufende Kosten sind der Wert im <em>Startjahr der Position</em>; die Steigerung
          wirkt ab diesem Jahr.
        </li>
        <li>
          Barwerte werden immer aus den Zahlungsströmen gebildet, auch wenn die P&amp;L-Sicht
          angezeigt wird.
        </li>
        <li>Es gibt keine Restwerte, keine Altbestände und keine kalkulatorischen Zinsen.</li>
        <li>
          Die Bandbreite in der Sensitivität folgt der Herkunft je Position: geschätzt
          ±35 %, angepasst ±15 %, kundenbestätigt ±5 %.
        </li>
      </ul>

      {pnl && (
        <div className="mt-4 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">Nicht erfasste Restabschreibung</p>
          <p className="mt-1">
            Abschreibungsscheiben, die hinter das Ende des Betrachtungszeitraums fallen, gehen
            nicht in die P&amp;L-Summe ein. Deshalb weicht sie bewusst von der Cashflow-Summe ab.
          </p>
          <p className="mt-1.5 tabular">
            {project.scenarios.onprem.name}: {eur(result.onprem.unrecognizedDepreciation)} ·{' '}
            {project.scenarios.cloud.name}: {eur(result.cloud.unrecognizedDepreciation)}
          </p>
        </div>
      )}

      {result.migrationPayback && (
        <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
          <p className="font-semibold">Amortisation der Migrationsvorleistung</p>
          {result.migrationPayback.years === null ? (
            <p className="mt-1">
              <span className="tabular">{eur(result.migrationPayback.upfront)}</span> Vorleistung,
              der aber keine laufende Einsparung gegenübersteht — im Gegenteil, der
              Cloud-Betrieb liegt um{' '}
              <span className="tabular">
                {eur(Math.abs(result.migrationPayback.annualSaving))}
              </span>{' '}
              pro Jahr höher. Die Vorleistung amortisiert sich in diesem Szenario nicht.
            </p>
          ) : (
            <p className="mt-1 tabular">
              {eur(result.migrationPayback.upfront)} Vorleistung ÷{' '}
              {eur(result.migrationPayback.annualSaving)} Einsparung pro Jahr ={' '}
              {num(result.migrationPayback.years, 1)} Jahre
            </p>
          )}
          <p className="mt-1 text-slate-500">
            Vorleistung sind die Cloud-Kosten im Block „Migration und Einmalaufwände". Die
            Einsparung wird ohne diesen Block gerechnet, damit sie nicht gegen sich selbst läuft.
          </p>
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {warnings.map((w, i) => (
            <li
              key={i}
              className={`rounded px-2.5 py-1.5 text-xs ${
                w.level === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-sky-50 text-sky-900'
              }`}
            >
              {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{children}</dd>
    </div>
  )
}
