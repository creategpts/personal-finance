import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type MarketFund } from '../api'
import { useDryPowder } from './plan/useDryPowder'
import PortfolioDips from './PortfolioDips'

const AXIS_COLOR = '#a3a3a3'
const REFRESH_MS = 5 * 60 * 1000

export type RefKey = 'high_52w' | 'all_time_high' | 'avg_cost'
export const REFS: { key: RefKey; label: string; color: string }[] = [
  { key: 'high_52w', label: 'Máx. 52 sem.', color: '#2563eb' },
  { key: 'all_time_high', label: 'Máx. histórico', color: '#9333ea' },
  { key: 'avg_cost', label: 'Coste medio', color: '#d97706' },
]
const RANGES = [
  { label: '3M', days: 91 },
  { label: '1A', days: 365 },
  { label: '5A', days: 1826 },
  { label: 'Todo', days: Infinity },
]
export const price = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function stored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
export function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // private window / blocked storage: the preference just doesn't stick
  }
}

export function drawdown(fund: MarketFund, ref: RefKey): number | null {
  const base = fund[ref]
  if (!base || base <= 0) return null
  return Math.max(0, ((base - fund.current_price) / base) * 100)
}

export function dayChange(fund: MarketFund): number | null {
  const s = fund.series
  if (s.length < 2) return null
  const prev = s[s.length - 2]!.price
  return prev > 0 ? ((s[s.length - 1]!.price - prev) / prev) * 100 : null
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y!.slice(2)}`
}

export default function InversionOportunidades({
  syncIds,
  hideAmounts,
}: {
  syncIds: number[]
  hideAmounts: boolean
}) {
  const queryClient = useQueryClient()

  const { data: market } = useQuery({ queryKey: ['investments-market'], queryFn: () => api.investments.market() })
  const { phaseIndex, phase } = useDryPowder()

  // Pull fresh prices (and top up history) on entering, then every few minutes while
  // the page stays open. The server throttles per fund, so extra calls are cheap.
  const syncKey = syncIds.join(',')
  const { isFetching: syncing, dataUpdatedAt } = useQuery({
    queryKey: ['investments-market-sync', syncKey],
    enabled: syncIds.length > 0,
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const results = await Promise.all(syncIds.map((id) => api.investments.syncMarket(id).catch(() => null)))
      await queryClient.invalidateQueries({ queryKey: ['investments-market'] })
      return results
    },
  })


  const funds = market?.funds ?? []

  return (
    <div className="card overflow-hidden">
      {funds.length === 0 ? (
        <p className="px-4 py-3 text-sm text-faint">
          <span className="mr-3 font-semibold text-fg">Oportunidades de compra</span>
          {syncing ? 'Descargando histórico de precios…' : 'Ningún fondo con ISIN o símbolo FT para seguir'}
        </p>
      ) : phase && phaseIndex != null ? (
        <PortfolioDips
          hideAmounts={hideAmounts}
          status={`${syncing ? 'Actualizando precios…' : dataUpdatedAt ? `Precios al ${new Date(dataUpdatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''} · los fondos publican un valor liquidativo al día`}
        />
      ) : (
        <p className="px-4 py-3 text-sm text-faint">
          <span className="mr-3 font-semibold text-fg">Oportunidades de compra</span>
          Sin fase del plan en curso.
        </p>
      )}
    </div>
  )
}

export function FundChart({
  fund,
  shown,
  setShown,
  rangeLabel,
  setRangeLabel,
}: {
  fund: MarketFund
  shown: Record<RefKey, boolean>
  setShown: (s: Record<RefKey, boolean>) => void
  rangeLabel: string
  setRangeLabel: (l: string) => void
}) {
  const days = RANGES.find((r) => r.label === rangeLabel)?.days ?? 365
  const cutoff = days === Infinity ? '' : new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const data = fund.series.filter((p) => p.date >= cutoff).map((p) => ({ label: shortDate(p.date), price: p.price }))
  const lines = REFS.filter((r) => shown[r.key] && fund[r.key] != null)
  const values = [...data.map((d) => d.price), ...lines.map((r) => fund[r.key]!)]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = (hi - lo) * 0.05 || 1

  return (
    <div className="flex min-w-0 flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-3">
          {REFS.map((r) => (
            <label key={r.key} className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={shown[r.key]} onChange={(e) => setShown({ ...shown, [r.key]: e.target.checked })} />
              <span className="inline-block h-0.5 w-3" style={{ background: r.color }} />
              {r.label}
              <span className="num text-faint">{fund[r.key] != null ? price.format(fund[r.key]!) : 'n/d'}</span>
            </label>
          ))}
        </div>
        <div className="flex rounded-lg border border-line p-0.5 text-xs">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRangeLabel(r.label)}
              className={`rounded-md px-2 py-1 font-medium transition ${rangeLabel === r.label ? 'bg-primary text-primaryfg' : 'text-muted hover:text-fg'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={{ stroke: 'var(--line)' }} minTickGap={48} />
            <YAxis stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} width={56} domain={[lo - pad, hi + pad]} tickFormatter={(v: number) => v.toFixed(0)} />
            <Tooltip
              formatter={(v) => `${price.format(Number(v))} €`}
              contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 13 }}
              labelStyle={{ color: 'var(--fg)', fontWeight: 600, marginBottom: 4 }}
              cursor={{ stroke: 'var(--line)' }}
            />
            {lines.map((r) => (
              <ReferenceLine key={r.key} y={fund[r.key]!} stroke={r.color} strokeDasharray="5 4" strokeWidth={1.5} />
            ))}
            <Line type="monotone" dataKey="price" name="Valor liquidativo" stroke="#16a34a" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
