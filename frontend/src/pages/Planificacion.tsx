import { Fragment, useEffect, useMemo, useState } from 'react'
import { api, type Category, type RecurringExpense, type RecurringExpenseInput } from '../api'
import RecurringModal from '../components/RecurringModal'
import GoalsPanel from '../components/GoalsPanel'
import Money from '../components/Money'
import { ExpandIcon, ShrinkIcon } from '../components/Icons'

// "2026-08-09" -> "09/08/2026" (no TZ shift)
const formatDate = (iso: string) => iso.split('-').reverse().join('/')

const FREQUENCY_LABELS: Record<RecurringExpense['frequency'], string> = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
}

const OCCURRENCES_PER_YEAR: Record<RecurringExpense['frequency'], number> = { monthly: 12, quarterly: 4, yearly: 1 }
const annualCost = (p: RecurringExpense) => p.amount * OCCURRENCES_PER_YEAR[p.frequency]

// One table: plans grouped by `groupField` (destination for gastos, origin for ingresos).
// The group total is active-only (forecast); the expandable detail lists every plan
// (active + paused) in that group, showing the OTHER endpoint as its secondary line.
function RecurringTable({
  title,
  addLabel,
  emptyLabel,
  description,
  plans,
  groupField,
  onNew,
  onEdit,
  onToggleActive,
}: {
  title: string
  addLabel: string
  emptyLabel: string
  description: string
  plans: RecurringExpense[]
  groupField: 'origin' | 'destination'
  onNew: () => void
  onEdit: (p: RecurringExpense) => void
  onToggleActive: (p: RecurringExpense) => void
}) {
  const otherField = groupField === 'destination' ? 'origin' : 'destination'
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const grouped = useMemo(() => {
    const map = new Map<string, { plans: RecurringExpense[]; activeAnnual: number }>()
    for (const p of plans) {
      const key = p[groupField]
      const g = map.get(key) ?? { plans: [], activeAnnual: 0 }
      g.plans.push(p)
      if (p.active) g.activeAnnual += annualCost(p)
      map.set(key, g)
    }
    return [...map].map(([category, g]) => ({ category, ...g })).sort((a, b) => b.activeAnnual - a.activeAnnual)
  }, [plans, groupField])
  const annualTotal = grouped.reduce((s, x) => s + x.activeAnnual, 0)
  const allExpanded = grouped.length > 0 && grouped.every((g) => expanded.has(g.category))

  function toggleAll() {
    setExpanded(allExpanded ? new Set() : new Set(grouped.map((g) => g.category)))
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>
        <button onClick={onNew} className="btn-primary">
          {addLabel}
        </button>
      </div>
      <p className="mb-4 text-sm text-muted">{description}</p>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-6">
                <button
                  type="button"
                  onClick={toggleAll}
                  aria-label={allExpanded ? 'Contraer todo' : 'Expandir todo'}
                  title={allExpanded ? 'Contraer todo' : 'Expandir todo'}
                  className="inline-flex text-faint hover:text-fg"
                >
                  {allExpanded ? <ShrinkIcon /> : <ExpandIcon />}
                </button>
              </th>
              <th>Categoría</th>
              <th className="text-right">Anual</th>
              <th className="text-right">Mensual</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => {
              const open = expanded.has(g.category)
              return (
                <Fragment key={g.category}>
                  <tr onClick={() => toggleExpand(g.category)} className="cursor-pointer hover:bg-surface2">
                    <td className="text-center text-faint">{open ? '▾' : '▸'}</td>
                    <td className="font-medium text-fg">
                      {g.category}
                      <span className="ml-2 text-xs text-faint">({g.plans.length})</span>
                    </td>
                    <td className="text-right"><Money value={g.activeAnnual} /></td>
                    <td className="text-right"><Money value={g.activeAnnual / 12} /></td>
                  </tr>
                  {open &&
                    g.plans.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => onEdit(p)}
                        className={`cursor-pointer bg-surface2/40 hover:bg-surface2 ${p.active ? '' : 'opacity-50'}`}
                      >
                        <td></td>
                        <td className="pl-6">
                          <span className="font-medium text-fg">{p.concept}</span>
                          <span className="ml-2 text-xs text-muted">
                            {p[otherField]} · {FREQUENCY_LABELS[p.frequency]} · {formatDate(p.next_due_date)}
                          </span>
                          {!p.auto_generate && (
                            <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                              Solo análisis
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleActive(p)
                            }}
                            className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              p.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-surface2 text-muted'
                            }`}
                          >
                            {p.active ? 'Activo' : 'Pausado'}
                          </button>
                        </td>
                        <td className="text-right text-muted"><Money value={annualCost(p)} /></td>
                        <td className="text-right text-muted"><Money value={annualCost(p) / 12} /></td>
                      </tr>
                    ))}
                </Fragment>
              )
            })}
            {grouped.length > 0 && (
              <tr className="border-t-2 border-line font-semibold">
                <td></td>
                <td className="text-fg">
                  Total <span className="text-xs font-normal text-faint">(solo activos)</span>
                </td>
                <td className="text-right text-fg"><Money value={annualTotal} /></td>
                <td className="text-right text-fg"><Money value={annualTotal / 12} /></td>
              </tr>
            )}
            {plans.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-faint">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Planificacion() {
  const [plans, setPlans] = useState<RecurringExpense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [editing, setEditing] = useState<RecurringExpense | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [newKind, setNewKind] = useState<'gasto' | 'ingreso'>('gasto')

  async function refresh() {
    const [p, c] = await Promise.all([api.recurring.list(), api.categories.list()])
    setPlans(p)
    setCategories(c)
  }

  useEffect(() => {
    refresh()
  }, [])

  const typeOf = useMemo(() => new Map(categories.map((c) => [c.name, c.type])), [categories])
  // an income-recurring plan has an income category as origin; everything else is
  // treated as gasto-recurrente (matches every plan created before this split existed).
  const incomePlans = plans.filter((p) => typeOf.get(p.origin) === 'income')
  const expensePlans = plans.filter((p) => typeOf.get(p.origin) !== 'income')
  const firstIncomeCategory = categories.find((c) => c.type === 'income')?.name

  function openNew(kind: 'gasto' | 'ingreso') {
    setNewKind(kind)
    setEditing(null)
    setShowModal(true)
  }

  async function handleSave(data: RecurringExpenseInput) {
    if (editing) {
      await api.recurring.update(editing.id, data)
    } else {
      await api.recurring.create(data)
    }
    setShowModal(false)
    setEditing(null)
    await refresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este movimiento recurrente?')) return
    await api.recurring.remove(id)
    await refresh()
  }

  async function toggleActive(plan: RecurringExpense) {
    await api.recurring.update(plan.id, { ...plan, active: !plan.active })
    await refresh()
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Planificación</h1>

      <GoalsPanel />

      <div className="grid grid-cols-2 gap-6">
        <RecurringTable
          title="Gastos recurrentes"
          addLabel="+ Nuevo gasto recurrente"
          emptyLabel="Sin gastos recurrentes"
          description="Los gastos marcados para generación automática entran en Movimientos como Plan al llegar la fecha. El resto solo se planifica y analiza a año vista (sin fecha fija: corte de pelo, ITV, taller…)."
          plans={expensePlans}
          groupField="destination"
          onNew={() => openNew('gasto')}
          onEdit={(p) => {
            setEditing(p)
            setShowModal(true)
          }}
          onToggleActive={toggleActive}
        />
        <RecurringTable
          title="Ingresos recurrentes"
          addLabel="+ Nuevo ingreso recurrente"
          emptyLabel="Sin ingresos recurrentes"
          description="Los ingresos marcados para generación automática entran en Movimientos como Plan al llegar la fecha. El resto solo se planifica y analiza a año vista."
          plans={incomePlans}
          groupField="origin"
          onNew={() => openNew('ingreso')}
          onEdit={(p) => {
            setEditing(p)
            setShowModal(true)
          }}
          onToggleActive={toggleActive}
        />
      </div>

      {showModal && (
        <RecurringModal
          categories={categories}
          initial={editing}
          defaultOrigin={!editing && newKind === 'ingreso' ? firstIncomeCategory : undefined}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
          onDelete={
            editing
              ? async () => {
                  await handleDelete(editing.id)
                  setShowModal(false)
                  setEditing(null)
                }
              : undefined
          }
          onSave={handleSave}
        />
      )}
    </div>
  )
}
