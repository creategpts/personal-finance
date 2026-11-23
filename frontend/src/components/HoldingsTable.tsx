import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Investment, MarketFund } from '../api'
import { REFS, dayChange, drawdown, store, stored, type RefKey } from './InversionOportunidades'
import Money from './Money'

export default function HoldingsTable({
  title,
  holdings,
  lumpSum,
  showWeights,
  showUnits = true,
  brief = false,
  hideAmounts,
  funds,
}: {
  title: string
  holdings: Investment[]
  lumpSum: boolean
  showWeights?: boolean // Peso objetivo / actual, the latter relative to this table only
  showUnits?: boolean // Participaciones column (ignored for lump-sum holdings, which have no units)
  brief?: boolean
  hideAmounts: boolean
  funds?: MarketFund[]
}) {
  const navigate = useNavigate()
  const blur = hideAmounts ? 'select-none blur-sm' : ''
  const totalValor = holdings.filter((inv) => inv.active).reduce((sum, inv) => sum + inv.stats.valor_actual, 0)
  const actualWeight = (inv: Investment) => (inv.active && totalValor > 0 ? `${((inv.stats.valor_actual / totalValor) * 100).toFixed(1)}%` : '—')
  const targetWeight = (inv: Investment) => `${inv.target_weight.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%`
  const sorted = [...holdings].sort((a, b) => b.stats.valor_actual - a.stats.valor_actual)
  const [reference, setReference] = useState<RefKey>(() => {
    const saved = stored<string>('dip_reference', 'all_time_high')
    return REFS.find((r) => r.key === saved)?.key ?? 'all_time_high'
  })
  useEffect(() => store('dip_reference', reference), [reference])
  const market = funds ? new Map(funds.map((f) => [f.investment_id, f])) : null
  const fall = (inv: Investment) => {
    const f = market?.get(inv.id)
    return f ? drawdown(f, reference) : null
  }
  const open = (inv: Investment) => navigate(`/inversion/${inv.id}`)

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {market && (
          <div className="flex items-center gap-2 text-xs text-muted">
            Caída desde
            <div className="flex rounded-lg border border-line p-0.5">
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
        )}
      </div>
      <table className="tbl hidden md:table">
        <thead>
          <tr>
            <th>Nombre</th>
            {!lumpSum && showUnits && <th className="text-right">Participaciones</th>}
            <th className="text-right">Total {lumpSum ? 'aportado' : 'invertido'}</th>
            {!lumpSum && !brief && <th className="text-right">Precio medio</th>}
            {!lumpSum && !brief && <th className="text-right">Valor liquidativo</th>}
            <th className="text-right">Valor de mercado</th>
            {showWeights && <th className="text-right">Peso objetivo</th>}
            {showWeights && <th className="text-right">Peso actual</th>}
            {!brief && <th className="text-right">Plusvalía</th>}
            <th className="text-right">Rentabilidad</th>
            {market && <th className="whitespace-nowrap text-right">Caída</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((inv) => (
            <tr key={inv.id} onClick={() => open(inv)} className={`cursor-pointer hover:bg-surface2 ${inv.active ? '' : 'opacity-50'}`}>
              <td className="font-medium text-fg">
                <Link to={`/inversion/${inv.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                  {inv.name}
                </Link>
              </td>
              {!lumpSum && showUnits && <td className="text-right num">{inv.stats.units_held.toLocaleString('es-ES', { maximumFractionDigits: 3 })}</td>}
              <td className="text-right">
                <Money value={inv.stats.total_invertido} className={blur} />
              </td>
              {!lumpSum && !brief && (
                <td className="text-right">
                  <Money value={inv.stats.avg_cost} className={blur} />
                </td>
              )}
              {!lumpSum && !brief && (
                <td className="text-right">
                  <Money value={inv.current_price} className={blur} />
                  <DayChange fund={market?.get(inv.id)} />
                </td>
              )}
              <td className="text-right">
                <Money value={inv.stats.valor_actual} className={blur} />
              </td>
              {showWeights && <td className="text-right num">{targetWeight(inv)}</td>}
              {showWeights && <td className="text-right num">{actualWeight(inv)}</td>}
              {!brief && (
                <td className={`text-right ${inv.stats.plusvalia < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  <Money value={inv.stats.plusvalia} className={blur} />
                </td>
              )}
              <td className={`text-right font-medium ${inv.stats.rentabilidad < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {inv.stats.rentabilidad.toFixed(2)}%
              </td>
              {market && <td className="num whitespace-nowrap text-right font-semibold text-fg">{fall(inv) == null ? '—' : `−${fall(inv)!.toFixed(1)} %`}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="divide-y divide-linesoft md:hidden">
        {sorted.map((inv) => (
          <div key={inv.id} onClick={() => open(inv)} className={`cursor-pointer px-4 py-3 active:bg-surface2 ${inv.active ? '' : 'opacity-50'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link to={`/inversion/${inv.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-fg">
                  {inv.name}
                </Link>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`text-right text-sm font-medium ${inv.stats.rentabilidad < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {inv.stats.rentabilidad.toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-2 text-xs">
              <div>
                <div className="text-faint">Total {lumpSum ? 'aportado' : 'invertido'}</div>
                <Money value={inv.stats.total_invertido} className={`num text-fg ${blur}`} />
              </div>
              <div>
                <div className="text-faint">Valor de mercado</div>
                <Money value={inv.stats.valor_actual} className={`num text-fg ${blur}`} />
              </div>
              {showWeights && (
                <div>
                  <div className="text-faint">Peso obj. / actual</div>
                  <span className="num text-fg">
                    {targetWeight(inv)} / {actualWeight(inv)}
                  </span>
                </div>
              )}
              {market && (
                <div>
                  <div className="text-faint">Caída</div>
                  <span className="num text-fg">{fall(inv) == null ? '—' : `−${fall(inv)!.toFixed(1)} %`}</span>
                </div>
              )}
              {!brief && (
                <div>
                  <div className="text-faint">Plusvalía</div>
                  <Money value={inv.stats.plusvalia} className={`num ${inv.stats.plusvalia < 0 ? 'text-red-600' : 'text-emerald-600'} ${blur}`} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DayChange({ fund }: { fund: MarketFund | undefined }) {
  const change = fund ? dayChange(fund) : null
  if (change == null) return null
  return (
    <div className={`num text-[11px] ${change < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
      {change > 0 ? '+' : ''}
      {change.toFixed(2)} % día
    </div>
  )
}
