import { useEffect, useState } from 'react'
import { api, type AccountSnapshot, type Category } from '../api'
import { isAccount } from '../categoryTypes'
import StatTile from './StatTile'
import { useHideAmounts } from '../hideAmounts'

// Account balances bar, same as the Panel one. Self-fetching so any page can drop it in.
export default function AccountBar() {
  const hideAmounts = useHideAmounts()
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null)
  const [accountCategories, setAccountCategories] = useState<Category[]>([])

  useEffect(() => {
    api.accountValues.latest().then(setSnapshot)
    api.categories
      .list()
      .then((cats) => setAccountCategories(cats.filter((c) => isAccount(c.type) && c.visible)))
  }, [])

  const accountRows = accountCategories
    .map((c) => ({
      category: c.name,
      amount: snapshot?.items.find((i) => i.category === c.name)?.amount ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  if (accountRows.length === 0) return null

  return (
    <div
      className="mb-6 grid gap-4"
      style={{ gridTemplateColumns: `repeat(${accountRows.length}, minmax(0, 1fr))` }}
    >
      {accountRows.map((item) => (
        <StatTile key={item.category} label={item.category} value={item.amount} blurred={hideAmounts} />
      ))}
    </div>
  )
}
