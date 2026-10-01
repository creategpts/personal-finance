import { useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type InvestmentType, type PortfolioHistoryPoint } from '../api'
import { INVESTMENT_TYPE_LABELS } from '../investmentColors'

const AXIS_COLOR = '#a3a3a3'
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const eurCompact = new Intl.NumberFormat('es-ES', { notation: 'compact', style: 'currency', currency: 'EUR' })

function dateLabel(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

const FILTERS: { label: string; type?: InvestmentType }[] = [
  { label: 'Todas' },
  ...(Object.keys(INVESTMENT_TYPE_LABELS) as InvestmentType[]).map((type) => ({ label: INVESTMENT_TYPE_LABELS[type], type })),
]

export default function InvestmentHistoryChart({ hideAmounts }: { hideAmounts: boolean }) {
  const [filter, setFilter] = useState<InvestmentType | undefined>(undefined)
  const [points, setPoints] = useState<PortfolioHistoryPoint[]>([])

  useEffect(() => {
    api.investments.history(filter).then(setPoints)
  }, [filter])

  const data = points.map((p) => ({ label: dateLabel(p.date), invertido: p.total_invertido, actual: p.valor_actual }))

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-fg">Evolución: capital invertido vs. valor actual</h3>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilter(f.type)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                filter === f.type ? 'bg-primary text-primaryfg' : 'border border-line bg-surface text-muted hover:bg-surface2'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="py-12 text-center text-sm text-faint">Sin datos todavía</div>
      ) : (
        <div className={hideAmounts ? 'select-none blur-md' : ''}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
              <YAxis stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => eurCompact.format(v)} />
              <Tooltip
                formatter={(v) => eur.format(Number(v))}
                contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 13 }}
                labelStyle={{ color: 'var(--fg)', fontWeight: 600, marginBottom: 4 }}
                itemStyle={{ padding: 0 }}
                cursor={{ stroke: 'var(--line)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="stepAfter" dataKey="invertido" name="Capital invertido" stroke="#6b7280" strokeWidth={2} dot={false} />
              <Line type="stepAfter" dataKey="actual" name="Valor actual" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
