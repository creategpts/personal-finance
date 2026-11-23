import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import DecimalInput from './DecimalInput'
import { COLOR_CRITICAL, fmtEur, fmtNum } from './inicio/format'
import { Amount } from './inicio/ui'
import { rebalance, splitContribution } from './plan/split'
import { useNextContribution } from './plan/useNextContribution'

export default function DistributionCalculator({ hide }: { hide: boolean }) {
  const { data: composition = [] } = useQuery({ queryKey: ['investments-composition'], queryFn: () => api.investments.composition() })
  const next = useNextContribution()
  const [mode, setMode] = useState<'contribute' | 'rebalance'>('contribute')
  const [input, setInput] = useState<string | null>(null)
  const value = input ?? (next.amount > 0 ? String(Math.round(next.amount)) : '')
  const amount = mode === 'contribute' ? Math.max(0, Number(value) || 0) : 0

  const funds = composition.filter((c) => c.weight_target > 0)
  const holdings = funds.map((c) => ({ id: c.investment_id, value: c.valor_actual, target: c.weight_target }))
  const split = mode === 'contribute' ? splitContribution(holdings, amount) : rebalance(holdings)
  const totalAfter = funds.reduce((s, c) => s + c.valor_actual, 0) + amount

  return (
    <section className="card overflow-hidden" aria-label="Calculadora de distribución">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">Calculadora de distribución</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-line p-0.5 text-xs" role="group" aria-label="Modo">
            {(
              [
                ['contribute', 'Aportar'],
                ['rebalance', 'Redistribuir'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={() => setMode(key)}
                className={`rounded-md px-2.5 py-1 font-medium transition ${mode === key ? 'bg-primary text-primaryfg' : 'text-muted hover:text-fg'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'contribute' && (
            <div className="relative">
              <DecimalInput className="input w-32 py-1 pr-7 text-right" value={value} onChange={setInput} aria-label="Importe a aportar" />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-faint">€</span>
            </div>
          )}
        </div>
      </div>
      {funds.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-faint">Ningún fondo con peso objetivo.</p>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Fondo</th>
              <th className="text-right">Peso actual → {mode === 'contribute' ? 'tras aportar' : 'tras redistribuir'}</th>
              <th className="text-right">Objetivo</th>
              <th className="text-right">{mode === 'contribute' ? 'Aportar' : 'Comprar / vender'}</th>
            </tr>
          </thead>
          <tbody>
            {funds.map((c) => {
              const put = split.get(c.investment_id) ?? 0
              const after = totalAfter > 0 ? ((c.valor_actual + put) / totalAfter) * 100 : 0
              return (
                <tr key={c.investment_id}>
                  <td className="font-medium text-fg">{c.name}</td>
                  <td className="num whitespace-nowrap text-right text-muted">
                    {fmtNum(c.weight_real, 1)} % → <span className="text-fg">{fmtNum(after, 1)} %</span>
                  </td>
                  <td className="num whitespace-nowrap text-right text-muted">{fmtNum(c.weight_target, 1)} %</td>
                  <td
                    className="whitespace-nowrap text-right font-semibold"
                    style={{ color: put < -0.5 ? COLOR_CRITICAL : put > 0.5 ? 'var(--fg)' : 'var(--faint)' }}
                  >
                    <Amount hide={hide}>{mode === 'rebalance' && put > 0.5 ? `+${fmtEur(put)}` : fmtEur(put)}</Amount>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
