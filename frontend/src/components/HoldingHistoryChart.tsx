import { useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type PortfolioHistoryPoint } from '../api'

const AXIS_COLOR = '#a3a3a3'
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const eurCompact = new Intl.NumberFormat('es-ES', { notation: 'compact', style: 'currency', currency: 'EUR' })

function dateLabel(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

export default function HoldingHistoryChart({
  investmentId,
  transactionCount,
  hideAmounts,
}: {
  investmentId: number
  transactionCount: number
  hideAmounts: boolean
}) {
  const [points, setPoints] = useState<PortfolioHistoryPoint[]>([])

  useEffect(() => {
    api.investments.historyFor(investmentId).then(setPoints)
  }, [investmentId, transactionCount])

  const data = points.map((p) => ({ label: dateLabel(p.date), invertido: p.total_invertido, actual: p.valor_actual }))

  return (
    <div className="card flex h-80 flex-col p-5 lg:h-full">
      <h3 className="mb-4 shrink-0 text-sm font-semibold text-fg">Evolución: aportado vs. valor real</h3>
      {data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-faint">Sin datos todavía</div>
      ) : (
        <div className={`min-h-0 flex-1 ${hideAmounts ? 'select-none blur-md' : ''}`}>
          <ResponsiveContainer width="100%" height="100%">
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
              <Line type="stepAfter" dataKey="invertido" name="Total aportado" stroke="#6b7280" strokeWidth={2} dot={false} />
              <Line type="stepAfter" dataKey="actual" name="Valor real" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
