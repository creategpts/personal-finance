import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type NetWorthGranularity } from '../api'
import { isAccount } from '../categoryTypes'
import { INVESTMENT_TYPE_COLORS, INVESTMENT_TYPE_ICONS, INVESTMENT_TYPE_LABELS, colorsByInvestedDescending } from '../investmentColors'
import DonutBreakdown, { type DonutItem } from './DonutBreakdown'
import PeriodSelector from './PeriodSelector'

const AXIS_COLOR = '#a3a3a3'
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const pointLabel = (iso: string, granularity: NetWorthGranularity) => {
  const [y, m, d] = iso.split('-').map(Number)
  if (granularity === 'month') return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`
  return `${String(d).padStart(2, '0')} ${MONTHS_SHORT[m - 1]}`
}
const daysBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
const granularityFor = (from: string, to: string): NetWorthGranularity => {
  const span = daysBetween(from, to)
  if (span <= 31) return 'day'
  if (span <= 100) return 'week'
  return 'month'
}
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const eurCompact = new Intl.NumberFormat('es-ES', { notation: 'compact', style: 'currency', currency: 'EUR' })

// Patrimonio = riqueza acumulada (Ahorro e Inversión) — a propósito deja fuera
// "Efectivo/gasto" (eso es liquidez para gastar, no patrimonio; ya se ve en Inicio).
const WEALTH_TYPES = [
  { key: 'ahorro', label: 'Fondo de emergencia', color: '#0ea5e9' },
  { key: 'inversion', label: 'Inversión', color: '#8b5cf6' },
]

const EVOLUTION_SERIES = [
  { key: 'ahorro', label: 'Fondo de emergencia', color: '#0ea5e9' },
  { key: 'aportaciones', label: 'Aportaciones', color: '#8b5cf6' },
  { key: 'plusvalia', label: 'Plusvalía', color: '#16a34a' },
]

const INFO_TODAY = 'Saldo actual de tus cuentas de Ahorro e Inversión. Solo cuentas incluidas en el patrimonio total.'

const currentYearRange = (): { from: string; to: string } => {
  const year = new Date().getFullYear()
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

export default function AnalisisPatrimonio({ hideAmounts }: { hideAmounts: boolean }) {
  const [range, setRange] = useState(currentYearRange)
  const rangeReady = !!range.from && !!range.to
  const granularity = granularityFor(range.from, range.to)
  const { data: points = [] } = useQuery({
    queryKey: ['dashboard-net-worth', range.from, range.to, granularity],
    queryFn: () => api.dashboard.netWorth(range.from, range.to, granularity),
    enabled: rangeReady,
  })
  const { data: snapshot = null } = useQuery({
    queryKey: ['account-values', 'latest'],
    queryFn: () => api.accountValues.latest(),
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories.list(),
  })
  const accountCategories = categories.filter((c) => isAccount(c.type) && c.include_in_total)

  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => api.investments.list() })
  const { data: composition = [] } = useQuery({ queryKey: ['investments-composition'], queryFn: () => api.investments.composition() })
  const { data: investmentsSummary = null } = useQuery({ queryKey: ['investments-summary'], queryFn: () => api.investments.summary() })
  const holdingColors = useMemo(() => colorsByInvestedDescending(investments), [investments])
  const compositionDonut: DonutItem[] = composition.map((c) => ({
    key: String(c.investment_id),
    label: c.name,
    amount: c.valor_actual,
    color: holdingColors[c.investment_id] ?? '#6b7280',
    icon: INVESTMENT_TYPE_ICONS[c.type],
    targetPercent: c.weight_target,
    group: {
      key: c.type,
      label: INVESTMENT_TYPE_LABELS[c.type],
      icon: INVESTMENT_TYPE_ICONS[c.type],
      color: INVESTMENT_TYPE_COLORS[c.type],
    },
  }))

  const data = useMemo(
    () =>
      points.map((p) => ({
        label: pointLabel(p.date, granularity),
        ahorro: p.by_type.ahorro ?? 0,
        aportaciones: p.investment_invertido,
        plusvalia: p.investment_valor_actual - p.investment_invertido,
      })),
    [points, granularity],
  )
  const seriesValue = (key: string, p: (typeof points)[number]) => {
    if (key === 'ahorro') return p.by_type.ahorro ?? 0
    if (key === 'aportaciones') return p.investment_invertido
    return p.investment_valor_actual - p.investment_invertido
  }
  const visibleSeries = EVOLUTION_SERIES.filter((t) => points.some((p) => Math.abs(seriesValue(t.key, p)) > 0.005))

  const balanceOf = (name: string) => snapshot?.items.find((i) => i.category === name)?.amount ?? 0
  const todayDonut: DonutItem[] = WEALTH_TYPES.map((t) => ({
    key: t.key,
    label: t.label,
    amount:
      t.key === 'inversion'
        ? investmentsSummary?.valor_actual ?? 0
        : accountCategories.filter((c) => c.type === t.key).reduce((s, c) => s + balanceOf(c.name), 0),
    color: t.color,
  })).filter((it) => it.amount !== 0)

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DonutBreakdown title="Distribución" info={INFO_TODAY} items={todayDonut} hideAmounts={hideAmounts} />
        <DonutBreakdown title="Inversión" items={compositionDonut} hideAmounts={hideAmounts} />
      </div>

      <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-fg">Evolución del patrimonio</h2>
        <PeriodSelector
          fullWidth="mobile"
          initialFrom={range.from}
          initialTo={range.to}
          onChange={(from, to) => setRange({ from, to })}
        />
      </div>

      <div className="card p-5">
        {data.length === 0 ? (
          <div className="py-12 text-center text-sm text-faint">Sin datos</div>
        ) : (
          <div className={hideAmounts ? 'select-none blur-md' : ''}>
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                <YAxis stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => eurCompact.format(v)} />
                <Tooltip
                  formatter={(v) => eur.format(Number(v))}
                  itemSorter={(item) => -EVOLUTION_SERIES.findIndex((t) => t.key === item.dataKey)}
                  labelFormatter={(label, payload) =>
                    `${label}  ·  ${eur.format((payload ?? []).reduce((s, p) => s + Number(p.value ?? 0), 0))}`
                  }
                  contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 13 }}
                  labelStyle={{ color: 'var(--fg)', fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ padding: 0 }}
                  cursor={{ stroke: 'var(--line)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {visibleSeries.map((t) => (
                  <Area
                    key={t.key}
                    type="monotone"
                    dataKey={t.key}
                    name={t.label}
                    stackId="nw"
                    stroke={t.color}
                    strokeWidth={1.5}
                    fill={t.color}
                    fillOpacity={0.18}
                    dot={{ r: 3, stroke: t.color, strokeWidth: 1, fill: 'var(--surface)' }}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
