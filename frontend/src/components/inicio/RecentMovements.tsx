import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, type Category, type KpiName, type Movement, type MovementInput } from '../../api'
import MovementModal from '../MovementModal'
import { COLOR_GOOD, type CrossFilter, fmtEur, shortDate, todayIso } from './format'
import { Amount, PanelHeader } from './ui'

const KPI_LABELS: Record<KpiName, string> = { income: 'Ingresos', expense: 'Gastos', saving: 'Ahorro', investment: 'Inversión' }
const LIMIT = 5

interface Props {
  range: { from: string; to: string }
  filter: CrossFilter
  onClearFilter: () => void
  categories: Category[]
  hide: boolean
}

export default function RecentMovements({ range, filter, onClearFilter, categories, hide }: Props) {
  const queryClient = useQueryClient()
  const kpi = filter?.kind === 'kpi' ? filter.kpi : null
  // misma clave que la página Movimientos: comparten caché
  const { data: movements = [] } = useQuery({
    queryKey: ['movements', kpi],
    queryFn: () => api.movements.list({ ...(kpi && { kpi }) }),
  })
  const [editing, setEditing] = useState<Movement | null>(null)
  const [creating, setCreating] = useState(false)

  const typeOf = useMemo(() => new Map(categories.map((c) => [c.name, c.type])), [categories])

  // una categoría principal incluye sus subcategorías (los movimientos reales suelen ir contra estas)
  const categorySet = useMemo(() => {
    if (filter?.kind !== 'category') return null
    const parent = categories.find((c) => c.name === filter.name)
    return new Set([filter.name, ...(parent ? categories.filter((c) => c.parent_id === parent.id).map((c) => c.name) : [])])
  }, [filter, categories])

  const today = todayIso()
  const inPeriod = useMemo(
    () =>
      movements
        .filter((m) => m.status === 'Done' && m.date >= range.from && m.date <= range.to && m.date <= today)
        .filter((m) => !categorySet || categorySet.has(m.destination))
        .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1)),
    [movements, range, today, categorySet],
  )
  const rows = inPeriod.slice(0, LIMIT)

  const params = new URLSearchParams({ from: range.from, to: range.to })
  if (kpi) params.set('kpi', kpi)
  if (filter?.kind === 'category') params.set('destination', filter.name)

  async function save(data: MovementInput) {
    if (editing) await api.movements.update(editing.id, data)
    else await api.movements.create(data)
    close()
    // un movimiento mueve casi todo el inicio (saldos, KPIs, presupuesto, patrimonio)
    await queryClient.invalidateQueries()
  }

  async function remove() {
    if (!editing || !confirm('¿Eliminar este movimiento?')) return
    await api.movements.remove(editing.id)
    close()
    await queryClient.invalidateQueries()
  }

  function close() {
    setEditing(null)
    setCreating(false)
  }

  function sign(m: Movement) {
    const o = typeOf.get(m.origin)
    const d = typeOf.get(m.destination)
    if (o === 'income' && d !== 'expense') return { text: `+${fmtEur(m.amount)}`, color: COLOR_GOOD }
    if (d === 'expense') return { text: `−${fmtEur(m.amount)}`, color: undefined }
    return { text: `⇄ ${fmtEur(m.amount)}`, color: 'var(--muted)' }
  }

  return (
    <section className="card flex min-w-0 flex-col overflow-hidden" aria-label="Últimos movimientos">
      <PanelHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            Últimos movimientos
            {filter && (
              <span className="flex items-center gap-2 text-xs font-normal normal-case tracking-normal text-muted">
                Filtrado por
                <button
                  type="button"
                  onClick={onClearFilter}
                  className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-0.5 font-medium text-fg transition hover:border-faint"
                >
                  {filter.kind === 'kpi' ? KPI_LABELS[filter.kpi] : filter.name}
                  <X size={12} />
                </button>
              </span>
            )}
          </span>
        }
      >
        <button type="button" onClick={() => setCreating(true)} className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primaryfg transition hover:opacity-90">
          + Nuevo
        </button>
      </PanelHeader>

      <div className="h-[264px] overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-faint">Sin movimientos en este periodo</div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((m) => {
              const s = sign(m)
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => setEditing(m)} className="flex h-[52px] w-full items-center gap-3 px-4 text-left transition hover:bg-surface2/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-fg">{m.concept || '—'}</span>
                      <span className="block truncate text-[11.5px] text-faint">
                        {shortDate(m.date)} · {m.destination}
                      </span>
                    </span>
                    <Amount hide={hide} className="shrink-0 whitespace-nowrap text-sm font-medium">
                      <span style={s.color ? { color: s.color } : undefined}>{s.text}</span>
                    </Amount>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="mt-auto flex justify-between gap-3 border-t border-line px-4 py-2 text-[11.5px] text-faint">
        <span>
          {rows.length} de {inPeriod.length} en el periodo
        </span>
        <Link to={`/movimientos?${params}`} className="font-medium text-muted transition hover:text-fg">
          Ver todos →
        </Link>
      </div>

      {(editing || creating) && <MovementModal categories={categories} initial={editing} onClose={close} onDelete={editing ? remove : undefined} onSave={save} />}
    </section>
  )
}
