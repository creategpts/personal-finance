import { useMemo } from 'react'
import type { AccountCheckItem, Investment, PortfolioCompositionItem, PortfolioSummary } from '../api'
import { INVESTMENT_TYPE_COLORS, INVESTMENT_TYPE_ICONS, INVESTMENT_TYPE_LABELS, colorsByInvestedDescending } from '../investmentColors'
import StatTile from './StatTile'
import DonutBreakdown, { type DonutItem } from './DonutBreakdown'
import InvestmentHistoryChart from './InvestmentHistoryChart'
import PendingAssignmentCard from './PendingAssignmentCard'

export default function InversionDashboard({
  investments,
  summary,
  composition,
  accountCheck,
  hideAmounts,
  onAssigned,
  onCreateForAccount,
}: {
  investments: Investment[]
  summary: PortfolioSummary | null
  composition: PortfolioCompositionItem[]
  accountCheck: AccountCheckItem[]
  hideAmounts: boolean
  onAssigned: () => Promise<void>
  onCreateForAccount: (account: string) => void
}) {
  const holdingColors = useMemo(() => colorsByInvestedDescending(investments), [investments])

  const donutItems: DonutItem[] = composition.map((c) => ({
    key: String(c.investment_id),
    label: c.name,
    amount: c.valor_actual,
    color: holdingColors[c.investment_id] ?? '#6b7280',
    icon: INVESTMENT_TYPE_ICONS[c.type],
    targetPercent: c.weight_target,
    group: {
      key: c.type,
      label: INVESTMENT_TYPE_LABELS[c.type],
      icon: INVESTMENT_TYPE_ICONS[c.type],
      color: INVESTMENT_TYPE_COLORS[c.type],
    },
  }))

  return (
    <div>
      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatTile label="Capital invertido" value={summary?.total_invertido ?? 0} blurred={hideAmounts} />
        <StatTile label="Valor actual" value={summary?.valor_actual ?? 0} blurred={hideAmounts} />
        <StatTile
          label="Plusvalía"
          value={summary?.plusvalia ?? 0}
          accent={summary && summary.plusvalia < 0 ? '#dc2626' : '#16a34a'}
          blurred={hideAmounts}
        />
        <div className="card block w-full overflow-hidden p-5">
          <span className="truncate text-xs font-medium text-muted">Rentabilidad</span>
          <div className={`mt-2 text-2xl font-semibold tracking-tight ${(summary?.rentabilidad ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {(summary?.rentabilidad ?? 0).toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <DonutBreakdown title="Composición real" items={donutItems} hideAmounts={hideAmounts} legendBelow />
        </div>
        <div className="col-span-2">
          <InvestmentHistoryChart hideAmounts={hideAmounts} />
        </div>
      </div>

      <PendingAssignmentCard
        items={accountCheck}
        investments={investments}
        hideAmounts={hideAmounts}
        onAssigned={onAssigned}
        onCreateForAccount={onCreateForAccount}
      />
    </div>
  )
}
