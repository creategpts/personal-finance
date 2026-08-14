import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type AccountSnapshot, type Category, type NetWorthPoint } from '../api'
import { isAccount } from '../categoryTypes'
import DonutBreakdown, { type DonutItem } from './DonutBreakdown'

const AXIS_COLOR = '#a3a3a3'
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`
}
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const eurCompact = new Intl.NumberFormat('es-ES', { notation: 'compact', style: 'currency', currency: 'EUR' })

// Patrimonio = riqueza acumulada (Ahorro e Inversión) — a propósito deja fuera
// "Efectivo/gasto" (eso es liquidez para gastar, no patrimonio; ya se ve en Inicio).
const WEALTH_TYPES = [
  { key: 'ahorro', label: 'Ahorro', color: '#0ea5e9' },
  { key: 'inversion', label: 'Inversión', color: '#8b5cf6' },
]

const RANGES = [
  { label: '12 meses', months: 12 },
  { label: '24 meses', months: 24 },
  { label: 'Todo', months: 600 },
]

const INFO_TODAY = 'Saldo actual de tus cuentas de Ahorro e Inversión. Solo cuentas incluidas en el patrimonio total.'

export default function AnalisisPatrimonio({ hideAmounts }: { hideAmounts: boolean }) {
  const [months, setMonths] = useState(12)
  const [points, setPoints] = useState<NetWorthPoint[]>([])
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null)
  const [accountCategories, setAccountCategories] = useState<Category[]>([])

  useEffect(() => {
    api.dashboard.netWorth(months).then(setPoints)
  }, [months])

  useEffect(() => {
    api.accountValues.latest().then(setSnapshot)
    api.categories.list().then((cats) => setAccountCategories(cats.filter((c) => isAccount(c.type) && c.include_in_total)))
  }, [])

  const data = useMemo(
    () =>
      points.map((p) => {
        const row: Record<string, number | string> = { label: monthLabel(p.month) }
        for (const t of WEALTH_TYPES) row[t.key] = p.by_type[t.key] ?? 0
        return row
      }),
    [points],
  )
  const visibleSeries = WEALTH_TYPES.filter((t) => points.some((p) => Math.abs(p.by_type[t.key] ?? 0) > 0.005))

  const balanceOf = (name: string) => snapshot?.items.find((i) => i.category === name)?.amount ?? 0
  const todayDonut: DonutItem[] = WEALTH_TYPES.map((t) => ({
    key: t.key,
    label: t.label,
    amount: accountCategories.filter((c) => c.type === t.key).reduce((s, c) => s + balanceOf(c.name), 0),
    color: t.color,
  })).filter((it) => it.amount !== 0)

  return (
    <div>
      <h2 className="mb-4 text-base font-semibold tracking-tight text-fg">Hoy</h2>
      <div className="max-w-2xl">
        <DonutBreakdown title="Dónde está el dinero" info={INFO_TODAY} items={todayDonut} hideAmounts={hideAmounts} />
      </div>

      <div className="mb-4 mt-8 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold tracking-tight text-fg">Evolución del patrimonio</h2>
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
                  itemSorter={(item) => WEALTH_TYPES.findIndex((t) => t.key === item.dataKey)}
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
