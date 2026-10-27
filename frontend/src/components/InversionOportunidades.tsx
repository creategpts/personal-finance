import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type MarketFund } from '../api'
import { useSettings } from '../settings'
import Money from './Money'

const AXIS_COLOR = '#a3a3a3'
const REFRESH_MS = 5 * 60 * 1000

type RefKey = 'high_52w' | 'all_time_high' | 'avg_cost'
const REFS: { key: RefKey; label: string; color: string }[] = [
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
const LEVEL_LABELS = ['Atención', 'Comprar', 'Comprar fuerte']
const LEVEL_STYLES = [
  'bg-amber-500/15 text-amber-600',
  'bg-emerald-500/15 text-emerald-600',
  'bg-emerald-600 text-white',
]

const price = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function stored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // private window / blocked storage: the preference just doesn't stick
  }
}

export function parseLevels(raw: string): number[] {
  const levels = raw
    .split(',')
    .map((s) => parseFloat(s.trim().replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
  return levels.length ? levels : [5, 10, 20]
}

function drawdown(fund: MarketFund, ref: RefKey): number | null {
  const base = fund[ref]
  if (!base || base <= 0) return null
  return Math.max(0, ((base - fund.current_price) / base) * 100)
}

// 0 = no alert; 1..3 index into LEVEL_LABELS. With fewer than 3 thresholds the top
// ones are used, so a single threshold still reads as "Comprar fuerte".
function alertLevel(dd: number | null, levels: number[]): number {
  if (dd === null) return 0
  const reached = levels.filter((l) => dd >= l).length
  return reached === 0 ? 0 : Math.min(3, reached + Math.max(0, 3 - levels.length))
}

function dayChange(fund: MarketFund): number | null {
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
  const settings = useSettings()
  const levels = parseLevels(settings.dip_levels)
  const [reference, setReference] = useState<RefKey>(() => stored('dip_reference', 'high_52w'))
  const [shown, setShown] = useState<Record<RefKey, boolean>>(() => stored('dip_lines', { high_52w: true, all_time_high: true, avg_cost: true }))
  const [rangeLabel, setRangeLabel] = useState<string>(() => stored('dip_range', '1A'))
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: market } = useQuery({ queryKey: ['investments-market'], queryFn: () => api.investments.market() })

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

  useEffect(() => store('dip_reference', reference), [reference])
  useEffect(() => store('dip_lines', shown), [shown])
  useEffect(() => store('dip_range', rangeLabel), [rangeLabel])

  const funds = market?.funds ?? []
  const rows = funds
    .map((f) => {
      const dd = drawdown(f, reference)
      return { fund: f, dd, level: alertLevel(dd, levels) }
    })
    .sort((a, b) => (b.dd ?? -1) - (a.dd ?? -1))
  const selected = rows.find((r) => r.fund.investment_id === selectedId)?.fund ?? rows[0]?.fund
  const liquidity = market?.liquidity
  const blur = hideAmounts ? 'select-none blur-sm' : ''

  return (
    <div className="card mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">Oportunidades de compra</h3>
          <p className="text-xs text-muted">
            {syncing ? 'Actualizando precios…' : dataUpdatedAt ? `Precios al ${new Date(dataUpdatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}
            {' · '}los fondos publican un valor liquidativo al día
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px border-b border-line bg-line sm:grid-cols-3">
        <div className="bg-surface px-4 py-3">
          <div className="text-xs text-muted">{liquidity?.account ? `Liquidez · ${liquidity.account}` : 'Liquidez'}</div>
          <div className={`mt-1 text-lg font-semibold ${blur}`}>{liquidity?.balance != null ? <Money value={liquidity.balance} /> : '—'}</div>
        </div>
        <div className="bg-surface px-4 py-3">
          <div className="text-xs text-muted">Fondo de emergencia (intocable)</div>
          <div className={`mt-1 text-lg font-semibold ${blur}`}>
            <Money value={liquidity?.emergency_fund ?? 0} />
          </div>
        </div>
        <div className="bg-surface px-4 py-3">
          <div className="text-xs text-muted">Pull disponible para comprar</div>
          <div className={`mt-1 text-lg font-semibold text-emerald-600 ${blur}`}>
            {liquidity?.available != null ? <Money value={liquidity.available} /> : <span className="text-sm font-normal text-faint">Elige la cuenta en Ajustes</span>}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-faint">
          {syncing ? 'Descargando histórico de precios…' : 'Ningún fondo con ISIN o símbolo FT para seguir'}
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="border-b border-line lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="flex rounded-lg border border-line p-0.5 text-xs">
            {REFS.map((r) => (
              <button
                key={r.key}
                onClick={() => setReference(r.key)}
                className={`rounded-md px-2.5 py-1 font-medium transition ${reference === r.key ? 'bg-primary text-primaryfg' : 'text-muted hover:text-fg'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
          <ul className="divide-y divide-linesoft">
            {rows.map(({ fund, dd, level }) => {
              const change = dayChange(fund)
              return (
                <li key={fund.investment_id}>
                  <button
                    onClick={() => setSelectedId(fund.investment_id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface2 ${selected?.investment_id === fund.investment_id ? 'bg-surface2' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-fg">{fund.name}</div>
                      <div className="num mt-0.5 text-xs text-muted">
                        {price.format(fund.current_price)} €
                        {change !== null && (
                          <span className={`ml-2 ${change < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {change > 0 ? '+' : ''}
                            {change.toFixed(2)}% día
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num text-sm font-semibold text-fg">{dd === null ? '—' : `-${dd.toFixed(1)}%`}</div>
                      {level > 0 ? (
                        <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${LEVEL_STYLES[level - 1]}`}>{LEVEL_LABELS[level - 1]}</span>
                      ) : (
                        <span className="text-[11px] text-faint">Sin caída</span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
          </div>

          {selected && <FundChart fund={selected} shown={shown} setShown={setShown} rangeLabel={rangeLabel} setRangeLabel={setRangeLabel} />}
        </div>
      )}
    </div>
  )
}

function FundChart({
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
