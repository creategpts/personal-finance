import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { api } from '../../api'
import { fmtEur0, todayIso } from './format'
import { Amount } from './ui'

const MATERIALITY = 20 // € — igual que PendingAssignmentCard
const STALE_PRICE_DAYS = 7

// Solo aparece si hay algo que hacer: cada aviso lleva a donde se resuelve.
export default function Attention({ hide }: { hide: boolean }) {
  const today = todayIso()
  const now = new Date()
  const { data: movements = [] } = useQuery({ queryKey: ['movements', null], queryFn: () => api.movements.list({}) })
  const { data: accountCheck = [] } = useQuery({ queryKey: ['investments-account-check'], queryFn: () => api.investments.accountCheck() })
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => api.investments.list() })
  const { data: budget } = useQuery({
    queryKey: ['budgets', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => api.budgets.get(now.getFullYear(), now.getMonth() + 1),
  })

  const overdue = movements.filter((m) => m.status === 'Plan' && m.date <= today)
  const unassigned = accountCheck.filter((a) => a.difference > MATERIALITY)
  const staleCutoff = Date.now() - STALE_PRICE_DAYS * 86_400_000
  const stale = investments.filter((i) => i.active && i.ft_symbol && (!i.price_updated_at || new Date(i.price_updated_at).getTime() < staleCutoff))

  const items: { key: string; to: string; text: ReactNode }[] = []
  if (overdue.length)
    items.push({
      key: 'overdue',
      to: `/movimientos?status=Plan&from=${overdue.reduce((min, m) => (m.date < min ? m.date : min), today)}&to=${today}`,
      text: (
        <>
          {overdue.length} {overdue.length === 1 ? 'previsto vencido' : 'previstos vencidos'} ·{' '}
          <Amount hide={hide}>{fmtEur0(overdue.reduce((s, m) => s + m.amount, 0))}</Amount>
        </>
      ),
    })
  if (unassigned.length)
    items.push({
      key: 'unassigned',
      to: '/inversion',
      text: (
        <>
          <Amount hide={hide}>{fmtEur0(unassigned.reduce((s, a) => s + a.difference, 0))}</Amount> de inversión sin asignar
        </>
      ),
    })
  if (budget && budget.length === 0) items.push({ key: 'budget', to: '/planificacion', text: 'Este mes no tiene presupuesto' })
  if (stale.length)
    items.push({
      key: 'prices',
      to: '/inversion',
      text: `${stale.length} ${stale.length === 1 ? 'precio' : 'precios'} sin actualizar desde hace más de ${STALE_PRICE_DAYS} días`,
    })

  if (items.length === 0) return null

  return (
    <section className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 text-sm" aria-label="Requiere atención">
      <AlertCircle size={15} className="shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
      {items.map((it) => (
        <Link
          key={it.key}
          to={it.to}
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[12.5px] text-fg transition hover:border-amber-500/70"
        >
          {it.text} →
        </Link>
      ))}
    </section>
  )
}
