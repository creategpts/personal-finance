import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type KpiName } from '../api'
import PeriodSelector from '../components/PeriodSelector'
import PageHeader from '../components/PageHeader'
import Accounts from '../components/inicio/Accounts'
import Attention from '../components/inicio/Attention'
import CategorySpend from '../components/inicio/CategorySpend'
import Kpis from '../components/inicio/Kpis'
import PatrimonioPlan from '../components/inicio/PatrimonioPlan'
import RecentMovements from '../components/inicio/RecentMovements'
import { type CrossFilter, monthSpan, previousRange } from '../components/inicio/format'
import { useHideAmounts } from '../hideAmounts'

// Nuevo inicio de escritorio (en pruebas, convive con /): sin sidebar. Cada panel es la puerta a su sección
// (Movimientos, Planificación, Inversión) y Configuración vive en el menú del avatar.
export default function InicioNuevo() {
  const hide = useHideAmounts()
  const [range, setRange] = useState({ from: '', to: '' })
  const [filter, setFilter] = useState<CrossFilter>(null)
  const ready = !!range.from && !!range.to
  const prev = ready ? previousRange(range.from, range.to) : null
  const month = ready && monthSpan(range.from, range.to) === 1 ? { year: Number(range.from.slice(0, 4)), month: Number(range.from.slice(5, 7)) } : null

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.categories.list() })
  const expenseCategories = categories.filter((c) => c.type === 'expense' && c.parent_id === null)

  const { data: summary = null } = useQuery({
    queryKey: ['dashboard-summary', range.from, range.to],
    queryFn: () => api.dashboard.summary(range.from, range.to),
    enabled: ready,
  })
  const { data: prevSummary = null } = useQuery({
    queryKey: ['dashboard-summary', prev?.from, prev?.to],
    queryFn: () => api.dashboard.summary(prev!.from, prev!.to),
    enabled: !!prev,
  })

  // pulsar dos veces el mismo filtro lo quita
  const toggleKpi = (kpi: KpiName) => setFilter((f) => (f?.kind === 'kpi' && f.kpi === kpi ? null : { kind: 'kpi', kpi }))
  const toggleCategory = (name: string) => setFilter((f) => (f?.kind === 'category' && f.name === name ? null : { kind: 'category', name }))

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3.5">
      <PageHeader>
        <Attention hide={hide} />
        <div className="ml-auto">
          <PeriodSelector onChange={(from, to) => setRange({ from, to })} />
        </div>
      </PageHeader>

      <Accounts hide={hide} />
      <Kpis summary={summary} prev={prevSummary} prevLabel={prev?.label ?? ''} hide={hide} filter={filter} onKpi={toggleKpi} />

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
        <RecentMovements range={range} filter={filter} onClearFilter={() => setFilter(null)} categories={categories} hide={hide} />
        <CategorySpend
          range={range}
          month={month}
          categories={expenseCategories}
          hide={hide}
          selected={filter?.kind === 'category' ? filter.name : null}
          onSelect={toggleCategory}
        />
      </div>

      <PatrimonioPlan hide={hide} />
    </div>
  )
}
