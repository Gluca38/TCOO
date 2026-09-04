import { useStore } from '../../state/store'
import { useComparison } from '../useComparison'
import { scenarioKpis } from '../../domain/compare'
import { breakEvenLabel, eur, eurSigned, num, percentSigned } from '../../format'

/** Kennzahlenband: die fünf Zahlen, die in jeder Entscheidungsvorlage stehen. */
export function KpiBand() {
  const project = useStore((s) => s.project)
  const result = useComparison()
  const [onprem, cloud] = scenarioKpis(project, result)
  const cheaper = result.delta > 0 ? 'Cloud' : result.delta < 0 ? 'On-Prem' : null

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi
        label={onprem.name}
        value={eur(onprem.total)}
        sub={`Ø ${eur(onprem.averageAnnual)} pro Jahr · ${
          onprem.capexShare === null ? '—' : num(onprem.capexShare * 100, 0) + ' % CapEx'
        }`}
        accent="onprem"
      />
      <Kpi
        label={cloud.name}
        value={eur(cloud.total)}
        sub={`Ø ${eur(cloud.averageAnnual)} pro Jahr · ${
          cloud.capexShare === null ? '—' : num(cloud.capexShare * 100, 0) + ' % CapEx'
        }`}
        accent="cloud"
      />
      <Kpi
        label="Differenz"
        value={eurSigned(result.delta)}
        sub={
          result.deltaPercent === null
            ? 'noch keine Basis'
            : `${percentSigned(result.deltaPercent)} · ${cheaper ? `${cheaper} günstiger` : 'gleichauf'}`
        }
        tone={result.delta > 0 ? 'good' : result.delta < 0 ? 'bad' : undefined}
      />
      <Kpi
        label="Break-even"
        value={breakEvenLabel(result.breakEvenYear, project.settings.startYear)}
        sub={`Barwertbasis: ${breakEvenLabel(result.breakEvenYearDiscounted, project.settings.startYear)}`}
        small
      />
      <Kpi
        label="Barwertdifferenz"
        value={eurSigned(result.npvDelta)}
        sub={`bei ${num(project.settings.discountRate * 100)} % · Basis Cashflow`}
        tone={result.npvDelta > 0 ? 'good' : result.npvDelta < 0 ? 'bad' : undefined}
      />
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  tone,
  accent,
  small,
}: {
  label: string
  value: string
  sub: string
  tone?: 'good' | 'bad'
  accent?: 'onprem' | 'cloud'
  small?: boolean
}) {
  const valueColor =
    tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-700' : 'text-slate-900'
  const bar =
    accent === 'onprem' ? 'bg-onprem' : accent === 'cloud' ? 'bg-cloud' : 'bg-slate-300'

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-3.5">
      <span className={`absolute left-0 top-0 h-full w-1 ${bar}`} />
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold tabular ${small ? 'text-lg' : 'text-2xl'} ${valueColor}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
    </div>
  )
}
