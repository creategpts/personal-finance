import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api, type MonthlyKpiPoint, type NetWorthPoint } from '../api'
import { ACCOUNT_TYPES } from '../accountTypes'
import { useHideAmounts, toggleHideAmounts } from '../hideAmounts'
import { EyeIcon, EyeOffIcon } from '../components/Icons'

const AXIS_COLOR = '#a3a3a3'

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`
}
// "2026-08" -> ["2026-08-01", "2026-08-31"]
const monthRange = (ym: string): [string, string] => {
  const [y, m] = ym.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return [`${ym}-01`, `${ym}-${String(lastDay).padStart(2, '0')}`]
}

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const eurCompact = new Intl.NumberFormat('es-ES', { notation: 'compact', style: 'currency', currency: 'EUR' })

const COLOR_GASTO = '#f5a623'
const COLOR_PPTO = '#0070f3'
const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  color: 'var(--fg)',
  fontSize: 13,
}

// stacked account-type areas — the top of the stack is the total net worth.
// One area per account type, colored by its position in the palette.
const PALETTE = ['#0070f3', '#16a34a', '#f5a623', '#9a9a9a', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444']
const SERIES = ACCOUNT_TYPES.map((t, i) => ({ key: t.key, name: t.label, color: PALETTE[i % PALETTE.length] }))

const RANGES = [
  { label: '12 meses', months: 12 },
  { label: '24 meses', months: 24 },
  { label: 'Todo', months: 600 },
]

export default function Evolucion() {
  const navigate = useNavigate()
  const hideAmounts = useHideAmounts()
  const [months, setMonths] = useState(12)
  const [points, setPoints] = useState<NetWorthPoint[]>([])
  const [kpi, setKpi] = useState<MonthlyKpiPoint[]>([])

  useEffect(() => {
    api.dashboard.netWorth(months).then(setPoints)
    api.dashboard.monthlySeries(months).then(setKpi)
  }, [months])

  // gasto por mes + media móvil 3m
  const gastoData = kpi.map((p, i) => {
    const win = kpi.slice(Math.max(0, i - 2), i + 1)
    return {
      label: monthLabel(p.month),
      month: p.month,
      gasto: Math.round(p.expense),
      media: Math.round(win.reduce((s, x) => s + x.expense, 0) / win.length),
    }
  })

  function goToMonth(month: string) {
    const [from, to] = monthRange(month)
    navigate(`/movimientos?from=${from}&to=${to}&kpi=expense`)
  }
  const pptoData = kpi.map((p) => ({
    label: monthLabel(p.month),
    gasto: Math.round(p.expense),
    ppto: p.budget > 0 ? Math.round(p.budget) : null,
  }))
  const gastoMedio = kpi.length ? kpi.reduce((s, p) => s + p.expense, 0) / kpi.length : 0

  // flatten by_type into flat keys Recharts can stack (missing month -> 0)
  const data = useMemo(
    () =>
      points.map((p) => {
        const row: Record<string, number | string> = { label: monthLabel(p.month) }
        for (const s of SERIES) row[s.key] = p.by_type[s.key] ?? 0
        return row
      }),
    [points],
  )

  // only stack account types that actually have data
  const visibleSeries = SERIES.filter((s) => points.some((p) => Math.abs(p.by_type[s.key] ?? 0) > 0.005))

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Evolución del patrimonio</h1>
        <button
          onClick={toggleHideAmounts}
          className="btn"
          title={hideAmounts ? 'Mostrar importes' : 'Ocultar importes'}
        >
          {hideAmounts ? <EyeOffIcon /> : <EyeIcon />}
          {hideAmounts ? 'Mostrar importes' : 'Ocultar importes'}
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.months}
            onClick={() => setMonths(r.months)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              months === r.months ? 'bg-primary text-primaryfg' : 'border border-line bg-surface text-muted hover:bg-surface2'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="card p-5">
        {data.length === 0 ? (
          <div className="py-12 text-center text-sm text-faint">Sin datos</div>
        ) : (
          <div className={hideAmounts ? 'select-none blur-md' : ''}>
            <ResponsiveContainer width="100%" height={380}>
              <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                <YAxis
                  stroke={AXIS_COLOR}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v: number) => eurCompact.format(v)}
                />
                <Tooltip
                  formatter={(v) => eur.format(Number(v))}
                  itemSorter={(item) => SERIES.findIndex((s) => s.key === item.dataKey)}
                  labelFormatter={(label, payload) =>
                    `${label}  ·  ${eur.format((payload ?? []).reduce((s, p) => s + Number(p.value ?? 0), 0))}`
                  }
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    color: 'var(--fg)',
                    fontSize: 13,
                  }}
                  labelStyle={{ color: 'var(--fg)', fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ padding: 0 }}
                  cursor={{ stroke: 'var(--line)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {visibleSeries.map((s) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stackId="nw"
                    stroke={s.color}
                    strokeWidth={1.5}
                    fill={s.color}
                    fillOpacity={0.18}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight text-fg">Gasto mensual</h2>
            <span className="text-sm text-muted">
              medio <span className={`font-medium text-fg ${hideAmounts ? 'select-none blur-sm' : ''}`}>{eur.format(gastoMedio)}</span>
            </span>
          </div>
          {gastoData.length === 0 ? (
            <div className="py-12 text-center text-sm text-faint">Sin datos</div>
          ) : (
            <div className={hideAmounts ? 'select-none blur-md' : ''}>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={gastoData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                  <YAxis stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => eurCompact.format(v)} />
                  <Tooltip formatter={(v) => eur.format(Number(v))} contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'var(--line)' }} />
                  <Bar
                    dataKey="gasto"
                    name="Gasto"
                    fill={COLOR_GASTO}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                    cursor="pointer"
                    onClick={(entry) => {
                      const month = (entry?.payload as { month?: string } | undefined)?.month
                      if (month) goToMonth(month)
                    }}
                  />
                  <Line dataKey="media" name="Media 3m" stroke={COLOR_PPTO} strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-base font-semibold tracking-tight text-fg">Gasto vs presupuesto</h2>
          {pptoData.length === 0 ? (
            <div className="py-12 text-center text-sm text-faint">Sin datos</div>
          ) : (
            <div className={hideAmounts ? 'select-none blur-md' : ''}>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={pptoData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                  <YAxis stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => eurCompact.format(v)} />
                  <Tooltip formatter={(v) => eur.format(Number(v))} contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'var(--line)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line dataKey="ppto" name="Presupuesto" stroke={COLOR_PPTO} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                  <Line dataKey="gasto" name="Gasto" stroke={COLOR_GASTO} strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
