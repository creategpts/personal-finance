import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { isAccount } from '../../categoryTypes'
import { COLOR_CRITICAL, fmtEur } from './format'
import { Amount } from './ui'

// Saldo de hoy de cada cuenta visible y el total de activos.
export default function Accounts({ hide }: { hide: boolean }) {
  const { data: snapshot = null } = useQuery({ queryKey: ['account-values', 'latest'], queryFn: () => api.accountValues.latest() })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.categories.list() })
  const rows = categories
    .filter((c) => isAccount(c.type) && c.visible)
    .map((c) => ({ name: c.name, amount: snapshot?.items.find((i) => i.category === c.name)?.amount ?? 0 }))
    .sort((a, b) => b.amount - a.amount)
  if (rows.length === 0) return null

  return (
    <section className="card flex overflow-x-auto" aria-label="Saldo de las cuentas">
      <div className="min-w-[160px] flex-1 border-r border-line bg-accent/5 px-4 py-2.5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted">Total activos</div>
        <div className="num mt-0.5 whitespace-nowrap text-base font-semibold">
          <Amount hide={hide}>{fmtEur(snapshot?.total_assets ?? 0)}</Amount>
        </div>
      </div>
      {rows.map((r) => (
        <div key={r.name} className="min-w-[150px] flex-1 border-r border-line px-4 last:border-r-0 py-2.5">
          <div className="truncate text-[11px] font-medium uppercase tracking-wider text-muted">{r.name}</div>
          <div className="num mt-0.5 whitespace-nowrap text-base font-medium" style={r.amount < 0 ? { color: COLOR_CRITICAL } : undefined}>
            <Amount hide={hide}>{fmtEur(r.amount)}</Amount>
          </div>
        </div>
      ))}
    </section>
  )
}
