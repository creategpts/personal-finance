import { useState } from 'react'
import type { AccountCheckItem, Investment } from '../api'
import Money from './Money'
import AssignPendingModal from './AssignPendingModal'

const MATERIALITY_THRESHOLD = 20

export default function PendingAssignmentCard({
  items,
  investments,
  hideAmounts,
  onAssigned,
  onCreateForAccount,
}: {
  items: AccountCheckItem[]
  investments: Investment[]
  hideAmounts: boolean
  onAssigned: () => Promise<void>
  onCreateForAccount: (account: string) => void
}) {
  const [assigning, setAssigning] = useState<AccountCheckItem | null>(null)
  const unassigned = items.filter((it) => it.difference > MATERIALITY_THRESHOLD)
  if (unassigned.length === 0) return null

  const blur = hideAmounts ? 'select-none blur-sm' : ''

  return (
    <div className="card mt-6 overflow-hidden border-amber-500/30 bg-amber-500/10">
      <div className="divide-y divide-amber-500/20">
        {unassigned.map((it) => {
          const activeHoldings = investments.filter((inv) => inv.account === it.account && inv.active)
          return (
            <button
              key={it.account}
              type="button"
              onClick={() => (activeHoldings.length === 0 ? onCreateForAccount(it.account) : setAssigning(it))}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-3 text-left text-sm transition hover:bg-white/5"
            >
              <span className="font-semibold text-fg">Movimiento de inversión registrado</span>
              <div className="ml-auto flex flex-wrap items-center gap-x-8 gap-y-1">
                <span className="font-medium text-fg">{it.account}</span>
                <span className={`text-muted ${blur}`}>
                  <Money value={it.net_moved} /> movido · <Money value={it.contributed} /> aportado
                </span>
                <span className={`font-medium text-amber-600 ${blur}`}>
                  <Money value={it.difference} /> sin asignar
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {assigning && (
        <AssignPendingModal
          item={assigning}
          activeHoldings={investments.filter((inv) => inv.account === assigning.account && inv.active)}
          onClose={() => setAssigning(null)}
          onAssigned={onAssigned}
        />
      )}
    </div>
  )
}
