import type { AccountCheckItem, Investment, PortfolioSummary } from '../api'
import StatTile from './StatTile'
import PendingAssignmentCard from './PendingAssignmentCard'

export default function InversionDashboard({
  investments,
  summary,
  accountCheck,
  hideAmounts,
  onAssigned,
  onCreateForAccount,
}: {
  investments: Investment[]
  summary: PortfolioSummary | null
  accountCheck: AccountCheckItem[]
  hideAmounts: boolean
  onAssigned: () => Promise<void>
  onCreateForAccount: (account: string) => void
}) {
  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
