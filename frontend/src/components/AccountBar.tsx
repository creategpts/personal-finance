import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { isAccount } from '../categoryTypes'
import StatTile from './StatTile'
import { useHideAmounts } from '../hideAmounts'

// Account balances bar, same as the Panel one. Self-fetching so any page can drop it in.
export default function AccountBar() {
  const hideAmounts = useHideAmounts()
  const { data: snapshot = null } = useQuery({
    queryKey: ['account-values', 'latest'],
    queryFn: () => api.accountValues.latest(),
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories.list(),
  })
  const accountCategories = categories.filter((c) => isAccount(c.type) && c.visible)

  const accountRows = accountCategories
    .map((c) => ({
      category: c.name,
      amount: snapshot?.items.find((i) => i.category === c.name)?.amount ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  if (accountRows.length === 0) return null

  return (
    <div
      className="mb-6 grid gap-3 sm:gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}
    >
      {accountRows.map((item) => (
        <StatTile key={item.category} label={item.category} value={item.amount} blurred={hideAmounts} />
      ))}
    </div>
  )
}
