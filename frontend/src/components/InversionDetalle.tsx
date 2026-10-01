import type { Investment, InvestmentType } from '../api'
import { INVESTMENT_TYPE_LABELS } from '../investmentColors'
import HoldingsTable from './HoldingsTable'

export default function InversionDetalle({
  investments,
  hideAmounts,
  onEditInvestment,
}: {
  investments: Investment[]
  hideAmounts: boolean
  onEditInvestment: (inv: Investment) => void
}) {
  const byType = new Map<InvestmentType, Investment[]>()
  for (const inv of investments) {
    const group = byType.get(inv.type) ?? []
    group.push(inv)
    byType.set(inv.type, group)
  }
  const groups = [...byType.entries()].sort(
    ([, a], [, b]) =>
      b.reduce((sum, inv) => sum + inv.stats.total_invertido, 0) - a.reduce((sum, inv) => sum + inv.stats.total_invertido, 0)
  )

  return (
    <div>
      {groups.map(([type, holdings]) => (
        <HoldingsTable
          key={type}
          title={INVESTMENT_TYPE_LABELS[type]}
          holdings={holdings}
          lumpSum={type === 'seguros'}
          hideAmounts={hideAmounts}
          onEdit={onEditInvestment}
        />
      ))}

      {investments.length === 0 && <div className="card px-4 py-10 text-center text-faint">Sin inversiones registradas</div>}
    </div>
  )
}
