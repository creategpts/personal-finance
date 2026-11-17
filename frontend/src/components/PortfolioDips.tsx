import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api } from '../api'
import { useDryPowder } from './plan/useDryPowder'
import { splitContribution } from './plan/split'
import Money from './Money'

const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })

export default function PortfolioDips({ hideAmounts, status }: { hideAmounts: boolean; status?: string }) {
  const { phaseIndex, phase, shots, planned, remaining, members, drawdown: dd, peak, signal } = useDryPowder()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const { data: composition = [] } = useQuery({ queryKey: ['investments-composition'], queryFn: () => api.investments.composition() })
  const blur = hideAmounts ? 'select-none blur-sm' : ''

  const missing = members.filter((m) => !m.fund)
  const nextShot = signal.pending[0]
  const split = nextShot
    ? splitContribution(
        members.map((m) => ({ id: m.investment_id, value: composition.find((c) => c.investment_id === m.investment_id)?.valor_actual ?? 0, target: m.weight })),
        nextShot.amount,
      )
    : null

  if (!phase || phaseIndex == null) return null

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      await queryClient.invalidateQueries({ queryKey: ['dip-shots'] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="text-sm font-semibold text-fg" title={[`Índice de la fase ${phaseIndex + 1}: ${members.map((m) => `${m.name} ${m.weight} %`).join(' · ')}`, status].filter(Boolean).join('\n')}>
          Oportunidades de compra
        </h3>
        {(phase.dips ?? []).length === 0 ? (
          <span className="text-xs text-faint">La fase activa no tiene disparos. Defínelos en el Plan.</span>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {[...phase.dips]
              .sort((a, b) => a.drop - b.drop)
              .map((d) => {
                const fired = shots.find((s) => s.drop === d.drop)
                const reached = (dd ?? 0) >= d.drop
                return (
                  <li key={d.drop} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm ${reached && !fired ? 'border-emerald-600' : 'border-line'}`}>
                    <span className={`num font-medium ${reached ? 'text-fg' : 'text-faint'}`}>−{d.drop} %</span>
                    <span className={`num text-xs text-muted ${blur}`}>
                      <Money value={d.amount} />
                    </span>
                    {fired ? (
                      <span className="flex items-center gap-1 text-xs text-faint">
                        hecho {day(fired.created_at)}
                        <button type="button" disabled={busy} onClick={() => run(() => api.plan.undoShot(fired.id))} aria-label="Deshacer disparo" className="hover:text-fg">
                          <X size={12} />
                        </button>
                      </span>
                    ) : reached ? (
                      <button
                        type="button"
                        disabled={busy || remaining < d.amount - 0.5}
                        onClick={() => run(() => api.plan.fire({ phase_index: phaseIndex, drop: d.drop, amount: d.amount }))}
                        className="btn-primary px-2 py-0.5 text-xs disabled:opacity-50"
                      >
                        Disparar
                      </button>
                    ) : (
                      <span className="text-xs text-faint">esperando</span>
                    )}
                  </li>
                )
              })}
          </ul>
        )}
        <span className="num ml-auto text-lg font-semibold text-fg" title={dd != null ? `Caída del índice de la fase desde su máximo del ${day(peak.date)}` : undefined}>
          {dd == null ? '—' : `−${dd.toFixed(1)} %`}
        </span>
      </div>

      {missing.length > 0 && <p className="mt-2 text-xs text-red-600">Sin precios: {missing.map((m) => m.name).join(', ')}</p>}
      {remaining < planned - 0.5 && (
        <p className="mt-2 text-xs text-amber-600">
          Pólvora real <span className={blur}><Money value={remaining} /></span> de <span className={blur}><Money value={planned} /></span> del plan: la liquidez libre no cubre el resto.
        </p>
      )}

      {nextShot && split && (
        <div className="mt-3 rounded-lg bg-surface2 px-3 py-2">
          <p className="mb-1 text-xs text-muted">
            Reparto sugerido del disparo de −{nextShot.drop} % para volver a los pesos objetivo (más al que más ha caído):
          </p>
          <ul className="space-y-0.5 text-sm">
            {members.map((m) => {
              const own = m.fund?.all_time_high ? (1 - m.fund.current_price / m.fund.all_time_high) * 100 : null
              return (
                <li key={m.investment_id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-fg">{m.name}</span>
                  <span className="num text-xs text-faint">{own == null ? '' : `−${own.toFixed(1)} % propio`}</span>
                  <span className={`num w-24 text-right font-medium text-fg ${blur}`}>
                    <Money value={split.get(m.investment_id) ?? 0} />
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
