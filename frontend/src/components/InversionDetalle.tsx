import { useQuery } from '@tanstack/react-query'
import { api, type Investment, type InvestmentType } from '../api'
import { INVESTMENT_TYPE_LABELS } from '../investmentColors'
import HoldingsTable from './HoldingsTable'

export default function InversionDetalle({ investments, hideAmounts }: { investments: Investment[]; hideAmounts: boolean }) {
  const { data: market } = useQuery({ queryKey: ['investments-market'], queryFn: () => api.investments.market() })
  const byType = new Map<InvestmentType, Investment[]>()
  for (const inv of investments) {
    const group = byType.get(inv.type) ?? []
    group.push(inv)
    byType.set(inv.type, group)
  }
  const groups = [...byType.entries()].sort(
    ([, a], [, b]) => b.reduce((sum, inv) => sum + inv.stats.total_invertido, 0) - a.reduce((sum, inv) => sum + inv.stats.total_invertido, 0),
  )

  return (
    <div className="flex flex-col gap-3.5">
      {groups.map(([type, holdings]) => (
        <HoldingsTable
          key={type}
          title={INVESTMENT_TYPE_LABELS[type]}
          holdings={holdings}
          lumpSum={type === 'seguros'}
          showWeights={type === 'fondo_inversion'}
          showUnits={type !== 'fondo_inversion'}
          brief={type === 'fondo_inversion'}
          hideAmounts={hideAmounts}
          funds={type === 'fondo_inversion' ? market?.funds : undefined}
        />
      ))}

      {investments.length === 0 && <div className="card px-4 py-10 text-center text-faint">Sin inversiones registradas</div>}
    </div>
  )
}
