import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type CategoryBreakdownItem, type MonthlyKpiPoint, type TopDestinationItem } from '../api'
import PeriodSelector from './PeriodSelector'
import DonutBreakdown, { type DonutItem } from './DonutBreakdown'

const GRID_COLOR = 'rgba(128,128,128,0.18)'
const AXIS_COLOR = '#9a9a9a'
const COLOR_GASTO = '#f5a623'
const COLOR_PPTO = '#0070f3'
const COLOR_MEDIA = '#9a9a9a'
const COLOR_GOOD = '#16a34a'
const COLOR_OVER = '#e5484d'
const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const currencyCompact = new Intl.NumberFormat('es-ES', { notation: 'compact', style: 'currency', currency: 'EUR' })
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`
}
const monthRange = (ym: string): [string, string] => {
  const [y, m] = ym.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return [`${ym}-01`, `${ym}-${String(lastDay).padStart(2, '0')}`]
}

const RANGES = [
  { label: '12 meses', months: 12 },
  { label: '24 meses', months: 24 },
  { label: 'Todo', months: 600 },
]

const INFO_EXPENSE = 'Gasto por categoría principal en el periodo — el gasto de una subcategoría se agrega en su categoría principal. Solo movimientos Realizados (Done).'

interface MonthlyRow {
  label: string
  month: string
  gasto: number
  ppto: number | null
  media: number
}

// custom content: "Gasto" needs to match that month's own bar color (red/green),
// which the default Tooltip can't do since color varies per-Cell, not per-series.
function MonthlyTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: MonthlyRow }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const gastoColor = row.ppto != null ? (row.gasto > row.ppto ? COLOR_OVER : COLOR_GOOD) : COLOR_GASTO
  return (
    <div
      style={{
        borderRadius: 10,
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        color: 'var(--fg)',
        fontSize: 13,
        padding: '8px 12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ color: gastoColor }}>Gasto : {currency.format(row.gasto)}</div>
      <div style={{ color: COLOR_MEDIA }}>Media del periodo : {currency.format(row.media)}</div>
      {row.ppto != null && <div style={{ color: COLOR_PPTO }}>Presupuesto : {currency.format(row.ppto)}</div>}
    </div>
  )
}

export default function AnalisisGasto({ hideAmounts }: { hideAmounts: boolean }) {
  const navigate = useNavigate()
  const [range, setRange] = useState({ from: '', to: '' })
  const [expenseItems, setExpenseItems] = useState<CategoryBreakdownItem[]>([])
  const [topDestinations, setTopDestinations] = useState<TopDestinationItem[]>([])

  const [months, setMonths] = useState(12)
  const [kpi, setKpi] = useState<MonthlyKpiPoint[]>([])

  useEffect(() => {
    if (!range.from || !range.to) return
    api.dashboard.breakdown(range.from, range.to, 'expense').then(setExpenseItems)
    api.dashboard.topDestinations(range.from, range.to, 10).then(setTopDestinations)
  }, [range])

  useEffect(() => {
    api.dashboard.monthlySeries(months).then(setKpi)
  }, [months])

  function goToCategory(field: 'origin' | 'destination', category: string) {
    if (!range.from || !range.to) return
    navigate(`/movimientos?from=${range.from}&to=${range.to}&${field}=${encodeURIComponent(category)}`)
  }

  function goToMonth(month: string) {
    const [from, to] = monthRange(month)
    navigate(`/movimientos?from=${from}&to=${to}&kpi=expense`)
  }

  const expenseDonut: DonutItem[] = expenseItems.map((it) => ({
    key: it.category,
    label: it.category,
    amount: it.amount,
    color: it.color,
    icon: it.icon,
  }))

  const gastoMedio = kpi.length ? kpi.reduce((s, p) => s + p.expense, 0) / kpi.length : 0
  const monthlyData = kpi.map((p) => ({
    label: monthLabel(p.month),
    month: p.month,
    gasto: Math.round(p.expense),
    ppto: p.budget > 0 ? Math.round(p.budget) : null,
    media: Math.round(gastoMedio),
  }))

  return (
    <div>
      <div className="mb-5">
        <PeriodSelector onChange={(from, to) => setRange({ from, to })} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DonutBreakdown
          title="En qué se va el dinero"
          info={INFO_EXPENSE}
          items={expenseDonut}
          hideAmounts={hideAmounts}
          onItemClick={(category) => goToCategory('destination', category)}
        />

        <div className="card flex h-full flex-col p-5">
          <h3 className="mb-4 shrink-0 text-sm font-semibold text-fg">Los 10 destinos que más gastan</h3>
          {topDestinations.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-faint">Sin datos para este periodo</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, topDestinations.length * 34)}>
              <BarChart data={topDestinations} layout="vertical" barCategoryGap="25%">
                <XAxis type="number" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
                <YAxis type="category" dataKey="destination" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} width={130} />
                <Tooltip
                  cursor={{ fill: 'rgba(128,128,128,0.08)' }}
                  formatter={(v) => currency.format(Number(v))}
                  contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
                  labelStyle={{ color: 'var(--fg)' }}
                  itemStyle={{ color: 'var(--fg)' }}
                />
                <Bar
                  dataKey="amount"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  cursor="pointer"
                  isAnimationActive={false}
                  onClick={(data) => {
                    const destination = (data as unknown as { payload?: TopDestinationItem })?.payload?.destination
                    if (destination) goToCategory('destination', destination)
                  }}
                >
                  {topDestinations.map((it) => (
                    <Cell key={it.destination} fill={it.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="mb-4 mt-8 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold tracking-tight text-fg">Tendencia mensual</h2>
        <div className="flex gap-2">
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
      </div>

      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-fg">Gasto mensual</h3>
        {monthlyData.length === 0 ? (
          <div className="py-12 text-center text-sm text-faint">Sin datos</div>
        ) : (
          <div className={hideAmounts ? 'select-none blur-md' : ''}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={monthlyData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                <YAxis stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => currencyCompact.format(v)} />
                <Tooltip content={<MonthlyTooltip />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ppto" name="Presupuesto" fill={COLOR_PPTO} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                <Bar
                  dataKey="gasto"
                  name="Gasto"
                  legendType="none"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                  cursor="pointer"
                  onClick={(entry) => {
                    const month = (entry?.payload as { month?: string } | undefined)?.month
                    if (month) goToMonth(month)
                  }}
                >
                  {monthlyData.map((d) => (
                    <Cell key={d.month} fill={d.ppto != null ? (d.gasto > d.ppto ? COLOR_OVER : COLOR_GOOD) : COLOR_GASTO} />
                  ))}
                </Bar>
                <Line dataKey="media" name="Media del periodo" stroke={COLOR_MEDIA} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
