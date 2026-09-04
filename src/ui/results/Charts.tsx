import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useStore } from '../../state/store'
import { useComparison } from '../useComparison'
import { calendarYear, discountFactor } from '../../domain/calc'
import { tornado } from '../../domain/sensitivity'
import { eur, eurSigned, num } from '../../format'

/**
 * Farben der Szenario-Identität.
 *
 * Dieselben zwei Farben stehen app-weit für dieselbe Sache. Sie stammen aus
 * einer auf Farbfehlsichtigkeit geprüften Palette; die Zuordnung folgt dem
 * Szenario, nie dem Rang.
 */
const ONPREM = '#2a78d6'
const CLOUD = '#eb6834'
const GRID = '#e2e8f0'
const AXIS = '#64748b'

const axisProps = {
  stroke: GRID,
  tick: { fill: AXIS, fontSize: 12 },
  tickLine: false,
}

function compactEur(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${num(value / 1_000_000, 1)} Mio €`
  if (abs >= 1_000) return `${num(value / 1_000, 0)} Tsd €`
  return `${num(value, 0)} €`
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mb-3 text-xs text-slate-500">{description}</p>
      {children}
    </div>
  )
}

function TooltipBox({
  active,
  payload,
  label,
  formatLabel,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string | number
  formatLabel: (label: string | number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-700">{formatLabel(label ?? '')}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="tabular font-medium text-slate-900">{eur(p.value ?? 0)}</span>
        </p>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 1 — Kumulierte Kosten: das Bild für den Business Case
 * ------------------------------------------------------------------ */

export function CumulativeChart() {
  const project = useStore((s) => s.project)
  const result = useComparison()
  const { settings } = project
  const discounted = settings.discounted && settings.view === 'cashflow'

  const data = useMemo(() => {
    const factor = (t: number) => (discounted ? discountFactor(settings.discountRate, t) : 1)
    let on = 0
    let cl = 0
    const rows = [{ x: 0, onprem: 0, cloud: 0 }]
    result.onprem.years.forEach((t, i) => {
      on += result.onprem.totalByYear[i] * factor(t)
      cl += result.cloud.totalByYear[i] * factor(t)
      rows.push({ x: t, onprem: on, cloud: cl })
    })
    return rows
  }, [result, discounted, settings.discountRate])

  const breakEven = result.breakEvenYear

  return (
    <ChartCard
      title="Kumulierte Kosten über den Betrachtungszeitraum"
      description={`Wo sich die Kurven schneiden, liegt der Break-even.${
        discounted ? ' Barwerte.' : ''
      }`}
    >
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 26, right: 24, bottom: 4, left: 8 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            {...axisProps}
            dataKey="x"
            type="number"
            domain={[0, settings.horizonYears]}
            ticks={[0, ...result.onprem.years]}
            tickFormatter={(t: number) => (t === 0 ? 'Start' : String(calendarYear(settings, t)))}
          />
          <YAxis {...axisProps} tickFormatter={compactEur} width={80} />
          <Tooltip
            content={
              <TooltipBox
                formatLabel={(l) => (Number(l) === 0 ? 'Start' : `Ende ${calendarYear(settings, Number(l))}`)}
              />
            }
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="plainline"
            formatter={(value) => <span className="text-slate-600">{value}</span>}
          />
          {breakEven !== null && breakEven > 0 && (
            <ReferenceLine
              x={breakEven}
              stroke={AXIS}
              strokeDasharray="4 4"
              label={{
                value: `Break-even Jahr ${num(breakEven + 1, 1)}`,
                position: 'insideTopLeft',
                offset: -14,
                fill: AXIS,
                fontSize: 11,
              }}
            />
          )}
          <Line
            type="linear"
            dataKey="onprem"
            name={project.scenarios.onprem.name}
            stroke={ONPREM}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="linear"
            dataKey="cloud"
            name={project.scenarios.cloud.name}
            stroke={CLOUD}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

/* ------------------------------------------------------------------ *
 * 2 — Jahreskosten: wann trifft es das Budget
 * ------------------------------------------------------------------ */

export function AnnualChart() {
  const project = useStore((s) => s.project)
  const result = useComparison()
  const { settings } = project
  const discounted = settings.discounted && settings.view === 'cashflow'

  const data = useMemo(() => {
    const factor = (t: number) => (discounted ? discountFactor(settings.discountRate, t) : 1)
    return result.onprem.years.map((t, i) => ({
      year: calendarYear(settings, t),
      onprem: result.onprem.totalByYear[i] * factor(t),
      cloud: result.cloud.totalByYear[i] * factor(t),
    }))
  }, [result, settings, discounted])

  return (
    <ChartCard
      title="Kosten je Jahr"
      description={
        settings.view === 'cashflow'
          ? 'Auszahlungen im Jahr des Anfalls — Investitionsspitzen werden sichtbar.'
          : 'Abgeschriebene Kosten je Jahr.'
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }} barGap={2}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis {...axisProps} dataKey="year" />
          <YAxis {...axisProps} tickFormatter={compactEur} width={80} />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            content={<TooltipBox formatLabel={(l) => String(l)} />}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => <span className="text-slate-600">{value}</span>}
          />
          <Bar
            dataKey="onprem"
            name={project.scenarios.onprem.name}
            fill={ONPREM}
            radius={[4, 4, 0, 0]}
          />
          <Bar dataKey="cloud" name={project.scenarios.cloud.name} fill={CLOUD} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

/* ------------------------------------------------------------------ *
 * 3 — Tornado: woran das Ergebnis wirklich hängt
 * ------------------------------------------------------------------ */

/**
 * Eigene Legende: die Farbe trägt das Szenario, die Deckkraft die Richtung.
 * Beides muss benannt sein, damit die Zuordnung nicht allein an der Farbe hängt.
 */
function TornadoLegend({ pct }: { pct: number }) {
  const step = num(pct * 100, 0)
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 pt-3 text-xs text-slate-600">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ONPREM }} />
        On-Prem-Block
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CLOUD }} />
        Cloud-Block
      </span>
      <span className="flex items-center gap-1.5 text-slate-500">
        <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" style={{ opacity: 0.45 }} />
        hell = bei −{step} %
        <span className="ml-2 h-2.5 w-2.5 rounded-sm bg-slate-400" />
        kräftig = bei +{step} %
      </span>
    </div>
  )
}

export function TornadoChart({ pct }: { pct: number }) {
  const project = useStore((s) => s.project)
  const view = project.settings.view
  const { base, entries } = useMemo(() => tornado(project, view, pct, 5), [project, view, pct])

  const data = entries.map((e) => ({
    name: `${e.blockName} · ${e.scenarioName}`,
    scenario: e.scenario,
    low: e.low - base,
    high: e.high - base,
  }))

  if (data.length === 0) {
    return (
      <ChartCard title="Sensitivität" description="Noch keine Beträge erfasst.">
        <p className="py-8 text-center text-sm text-slate-400">
          Sobald Kosten erfasst sind, erscheint hier die Rangfolge der Einflussgrößen.
        </p>
      </ChartCard>
    )
  }

  return (
    <ChartCard
      title={`Einfluss auf die Gesamtdifferenz bei ±${num(pct * 100, 0)} %`}
      description={`Ausgangswert: ${eurSigned(base)}. Balken zeigen die Abweichung davon, farbig nach Szenario.`}
    >
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 52 + 60)}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 4, left: 8 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis {...axisProps} type="number" tickFormatter={compactEur} />
          <YAxis
            {...axisProps}
            type="category"
            dataKey="name"
            width={300}
            tick={{ fill: AXIS, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            content={<TooltipBox formatLabel={(l) => String(l)} />}
          />
          <ReferenceLine x={0} stroke={AXIS} />
          <Bar dataKey="low" name={`bei −${num(pct * 100, 0)} %`} radius={2} barSize={12}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.scenario === 'onprem' ? ONPREM : CLOUD} fillOpacity={0.45} />
            ))}
          </Bar>
          <Bar dataKey="high" name={`bei +${num(pct * 100, 0)} %`} radius={2} barSize={12}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.scenario === 'onprem' ? ONPREM : CLOUD} />
            ))}
          </Bar>
          <Legend content={<TornadoLegend pct={pct} />} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
