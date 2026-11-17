import { useMemo, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, type BudgetVsActualItem, type Category } from '../../api'
import CategoryIcon from '../CategoryIcon'
import BudgetDonut, { type Period } from './BudgetDonut'
import { COLOR_CRITICAL, COLOR_GOOD, MONTHS_LONG, MONTHS_SHORT, fmtEur, fmtEur0, fmtNum, fmtPct, monthRange, monthsIn, sgn } from './format'
import { Amount, PanelHeader } from './ui'

const SCALE = 1.6 // la barra llega al 160 % del presupuesto; la marca vertical es el 100 %
const HEAT_MAX_MONTHS = 24

interface Props {
  range: { from: string; to: string }
  month: { year: number; month: number } | null // el periodo es un único mes natural
  categories: Category[] // categorías principales de gasto
  hide: boolean
  selected: string | null
  onSelect: (category: string) => void
}

// Gasto real de cada categoría frente a su presupuesto. Un mes: editable en línea. Varios meses: + mapa de cumplimiento.
export default function CategorySpend({ range, month, categories, hide, selected, onSelect }: Props) {
  const queryClient = useQueryClient()
  const ready = !!range.from && !!range.to
  const { data: items = [] } = useQuery({
    queryKey: ['dashboard-budget-vs-actual', range.from, range.to],
    queryFn: () => api.dashboard.budgetVsActual(range.from, range.to),
    enabled: ready,
  })

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const catByName = useMemo(() => new Map(categories.map((c) => [c.name, c])), [categories])
  const hasBudget = items.some((i) => i.planned > 0)

  // en edición se listan todas las categorías principales, también las que aún no tienen gasto ni presupuesto
  const rows: BudgetVsActualItem[] = useMemo(() => {
    const base = editing
      ? categories.map((c) => items.find((i) => i.category === c.name) ?? { category: c.name, planned: 0, actual: 0 })
      : items.filter((i) => i.actual > 0 || i.planned > 0)
    return [...base].sort((a, b) => b.planned - a.planned || b.actual - a.actual)
  }, [items, categories, editing])

  const totalActual = rows.reduce((s, r) => s + r.actual, 0)
  const budgeted = rows.filter((r) => r.planned > 0)
  const maxActual = Math.max(1, ...rows.map((r) => r.actual))

  function startEdit() {
    setDraft(Object.fromEntries(items.filter((i) => i.planned > 0).map((i) => [i.category, String(i.planned)])))
    setEditing(true)
  }

  async function saveBudget(next: Record<string, string>) {
    if (!month) return
    setSaving(true)
    try {
      const payload = categories
        .map((c) => ({ category: c.name, amount: Number(String(next[c.name] ?? '').replace(',', '.')) || 0 }))
        .filter((it) => it.amount > 0)
      await api.budgets.set(month.year, month.month, payload)
      setEditing(false)
      await Promise.all(
        ['dashboard-budget-vs-actual', 'dashboard-summary', 'budgets', 'dashboard-monthly-series'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })),
      )
    } finally {
      setSaving(false)
    }
  }

  async function copyPrevious() {
    if (!month) return
    const py = month.month === 1 ? month.year - 1 : month.year
    const pm = month.month === 1 ? 12 : month.month - 1
    const prev = await api.budgets.get(py, pm)
    setDraft(Object.fromEntries(prev.map((p) => [p.category, String(p.amount)])))
    setEditing(true)
  }

  // ---------- mapa de cumplimiento (varios meses) ----------
  const periodMonths = month ? 1 : monthsIn(range.from || '2000-01-01', range.to || '2000-01-01').length
  const months = month ? [] : monthsIn(range.from || '2000-01-01', range.to || '2000-01-01').slice(-HEAT_MAX_MONTHS)
  const perMonth = useQueries({
    queries: months.map((ym) => {
      const r = monthRange(ym)
      return {
        queryKey: ['dashboard-budget-vs-actual', r.from, r.to],
        queryFn: () => api.dashboard.budgetVsActual(r.from, r.to),
        enabled: ready && !month,
      }
    }),
  })

  const periods: Period[] =
    months.length > 1
      ? months.map((ym, i) => ({
          key: ym,
          label: `${MONTHS_SHORT[Number(ym.slice(5)) - 1]}${months[0].slice(0, 4) !== months.at(-1)?.slice(0, 4) && (i === 0 || ym.endsWith('-01')) ? ` ${ym.slice(2, 4)}` : ''}`,
          ratio: (name: string | null) => {
            const pick = (perMonth[i].data ?? []).filter((it) => name == null || it.category === name)
            const planned = pick.reduce((s, it) => s + it.planned, 0)
            return planned > 0 ? pick.reduce((s, it) => s + it.actual, 0) / planned : null
          },
        }))
      : []

  const title = month ? `Gasto por categoría · ${MONTHS_LONG[month.month - 1]} ${month.year}` : 'Gasto por categoría'

  function renderRow(r: BudgetVsActualItem) {
    const cat = catByName.get(r.category)
    const hasPlan = r.planned > 0
    const over = hasPlan && r.actual > r.planned
    const d = r.actual - r.planned
    const fill = hasPlan ? Math.min(100, ((r.actual / r.planned) * 100) / SCALE) : (r.actual / maxActual) * 100
    const isSel = selected === r.category
    const clickable = !editing
    return (
      <div
        key={r.category}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? () => onSelect(r.category) : undefined}
        onKeyDown={clickable ? (e) => e.key === 'Enter' && onSelect(r.category) : undefined}
        title={clickable ? 'Ver sus movimientos en la lista' : undefined}
        className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-2 min-h-[52px] md:grid-cols-[170px_minmax(0,1fr)_170px_110px] ${clickable ? 'cursor-pointer transition hover:bg-surface2/60' : ''} ${isSel ? 'bg-surface2 shadow-[inset_2px_0_0_var(--color-accent)]' : ''}`}
      >
        <div className="min-w-0">
          <div className={`flex items-center gap-2 truncate text-sm font-medium text-fg`}>
            {cat && (
              <span style={{ color: cat.color }} className="shrink-0">
                <CategoryIcon name={cat.icon} size={14} />
              </span>
            )}
            <span className="truncate">{r.category}</span>
          </div>
          <div className="text-[11.5px] text-faint">
            {totalActual > 0 ? `${fmtPct((r.actual / totalActual) * 100)} del gasto` : '—'}
          </div>
        </div>

        <div className="relative order-3 col-span-2 h-1.5 bg-surface2 md:order-none md:col-span-1">
          <i className="absolute inset-y-0 left-0" style={{ width: `${fill}%`, background: hasPlan ? (over ? COLOR_CRITICAL : COLOR_GOOD) : 'var(--faint)' }} />
          {hasPlan && <b className="absolute -inset-y-1.5 w-px bg-fg/70" style={{ left: `${100 / SCALE}%` }} />}
        </div>

        <div className="num text-right text-sm text-fg">
          <Amount hide={hide}>{fmtEur(r.actual)}</Amount>{' '}
          {editing ? (
            <input
              inputMode="decimal"
              placeholder="0"
              aria-label={`Presupuesto de ${r.category}`}
              value={draft[r.category] ?? ''}
              onChange={(e) => setDraft({ ...draft, [r.category]: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && saveBudget(draft)}
              className="num ml-1 h-7 w-20 rounded-md border border-line bg-canvas px-2 text-right text-[12.5px] outline-none focus:border-faint"
            />
          ) : (
            hasPlan && (
              <span className="text-xs text-muted">
                de <Amount hide={hide}>{fmtEur0(r.planned)}</Amount>
              </span>
            )
          )}
        </div>

        <div className="num hidden text-right text-sm font-medium md:block" style={{ color: hasPlan ? (over ? COLOR_CRITICAL : COLOR_GOOD) : undefined }}>
          {hasPlan ? (
            <>
              {sgn(d)}
              <Amount hide={hide}>{fmtEur0(Math.abs(d))}</Amount>{' '}
              <span className="text-[11.5px] font-normal">
                · {sgn(d)}
                {fmtNum(Math.abs(d / r.planned) * 100, 0)} %
              </span>
            </>
          ) : (
            <span className="text-faint">—</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="card flex min-w-0 flex-col overflow-hidden" aria-label="Gasto por categoría">
      <PanelHeader title={title}>
        {!month && periodMonths > 1 && (
          <span className="num text-xs text-muted" title={`Gasto total del periodo entre ${periodMonths} meses`}>
            Media mensual{' '}
            <Amount hide={hide} className="text-sm font-semibold text-fg">
              {fmtEur0(totalActual / periodMonths)}
            </Amount>
          </span>
        )}
        {month &&
          (editing ? (
            <>
              <button type="button" onClick={() => setEditing(false)} className="text-xs font-medium text-muted hover:text-fg">
                Cancelar
              </button>
              <button type="button" disabled={saving} onClick={() => saveBudget(draft)} className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primaryfg disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          ) : (
            <>
              {!hasBudget && (
                <button type="button" onClick={copyPrevious} className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-fg hover:border-faint">
                  Copiar mes anterior
                </button>
              )}
              <button type="button" onClick={startEdit} className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-fg hover:border-faint">
                {hasBudget ? 'Editar presupuesto' : 'Fijar presupuesto'}
              </button>
            </>
          ))}
      </PanelHeader>

      <div className="h-[264px] overflow-y-auto">
        {editing ? (
          <div className="divide-y divide-line">{rows.map((r) => renderRow(r))}</div>
        ) : budgeted.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-faint">Sin categorías presupuestadas en este periodo</div>
        ) : (
          <BudgetDonut items={budgeted} catByName={catByName} hide={hide} selected={selected} onSelect={onSelect} periods={periods} />
        )}
      </div>

      <div className="mt-auto flex justify-between gap-3 border-t border-line px-4 py-2 text-[11.5px] text-faint">
        <span>{editing ? `${rows.length} categorías` : `${budgeted.length} categorías presupuestadas`}</span>
        <Link to="/planificacion" className="font-medium text-muted transition hover:text-fg">
          Planificación →
        </Link>
      </div>
    </section>
  )
}
