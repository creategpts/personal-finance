import { useEffect, useState } from 'react'
import { api, type Category, type Goal, type GoalCreateInput, type GoalProgress, type GoalTargetInput, type GoalType } from '../api'
import GoalModal from './GoalModal'
import Money from './Money'

const TYPE_LABELS: Record<GoalType, string> = {
  fixed: 'Cantidad fija',
  percent_income: '% de ingresos',
  target_date: 'Meta con fecha',
}
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const deadlineLabel = (d: string) => {
  const [y, m] = d.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

// Progress bar with the percentage rendered inside the bar itself.
function Bar({ pct, tone }: { pct: number; tone: 'ok' | 'warn' }) {
  return (
    <div className="relative h-5 w-full overflow-hidden rounded-full bg-surface2">
      <div className={`h-full rounded-full ${tone === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-fg">{pct.toFixed(0)}%</span>
    </div>
  )
}

// OK / NOK chip for the "Este mes" line (on track vs behind).
function StatusChip({ ok }: { ok: boolean }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs ${
        ok ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'
      }`}
      title={ok ? 'Al día' : 'Por debajo'}
    >
      {ok ? '✓' : '✗'}
    </span>
  )
}

// Balance-target view for "meta con fecha": progress toward the meta.
function TargetProgress({ progress }: { progress: GoalProgress }) {
  const rows = progress.rows
  const last = rows[rows.length - 1]
  if (!last) return <div className="flex-1 px-4 py-6 text-center text-faint">Sin datos aún</div>

  const meta = progress.meta ?? 0
  const saldo = last.cum_actual
  const pace = last.target_month
  const pct = meta > 0 ? Math.min(100, Math.max(0, (saldo / meta) * 100)) : 0
  const falta = Math.max(0, meta - saldo)
  const monthDelta = last.cum_actual - last.cum_target

  return (
    <div className="flex flex-1 flex-col px-4 py-4">
      <div className="mb-1 flex items-start justify-between gap-2 text-sm">
        <p className="text-fg">
          Este mes: <Money value={last.actual_month} className="font-medium" /> (objetivo <Money value={pace} />) →{' '}
          <span className={monthDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
            {Math.abs(monthDelta).toFixed(0)} € por {monthDelta >= 0 ? 'encima' : 'debajo'}
          </span>
        </p>
        <StatusChip ok={last.on_track} />
      </div>
      <p className="text-sm text-muted">
        Te faltan <Money value={falta} className="font-medium" /> · necesitas <Money value={pace} className="font-medium" />/mes
        {progress.deadline && ` hasta ${deadlineLabel(progress.deadline)}`}
      </p>
      <div className="mt-auto pt-3">
        <div className="mb-1 flex items-baseline justify-between text-sm text-muted">
          <span>Saldo <Money value={saldo} className="font-medium text-fg" /></span>
          <span>Meta <Money value={meta} className="font-medium text-fg" /></span>
        </div>
        <Bar pct={pct} tone={monthDelta < 0 ? 'warn' : 'ok'} />
      </div>
    </div>
  )
}

// Flow view for "cantidad fija" / "% ingresos": month streak + cumulative compliance bar.
function FlowProgress({ progress }: { progress: GoalProgress }) {
  const rows = progress.rows
  const last = rows[rows.length - 1]
  if (!last) return <div className="flex-1 px-4 py-6 text-center text-faint">Sin datos aún</div>

  const pct = last.cum_target > 0 ? Math.min(100, Math.max(0, (last.cum_actual / last.cum_target) * 100)) : 100
  const closed = rows.filter((r) => r.status !== 'open')
  const met = closed.filter((r) => r.status === 'met').length

  return (
    <div className="flex flex-1 flex-col px-4 py-4">
      <div className="mb-2 flex items-start justify-between gap-2 text-sm">
        <p className="text-fg">
          Este mes: <Money value={last.actual_month} className="font-medium" /> / objetivo <Money value={last.target_month} />
        </p>
        <StatusChip ok={last.on_track} />
      </div>
      {closed.length > 0 && <p className="text-sm text-muted">{met}/{closed.length} meses cumplidos</p>}
      <div className="mt-auto pt-3">
        <Bar pct={pct} tone={last.on_track ? 'ok' : 'warn'} />
      </div>
    </div>
  )
}

function GoalCard({ goal, progress, onEdit }: { goal: Goal; progress?: GoalProgress; onEdit: () => void }) {
  const dimmed = !goal.active || progress?.completed
  return (
    <div
      onClick={onEdit}
      className={`card flex cursor-pointer flex-col overflow-hidden transition-colors hover:bg-surface2/40 ${dimmed ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-medium text-fg">{goal.name}</div>
          <div className="truncate text-xs text-muted">{goal.account} · {TYPE_LABELS[goal.type]}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {progress?.completed && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              Cumplido
            </span>
          )}
          {!goal.active && (
            <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs font-medium text-muted">Pausado</span>
          )}
        </div>
      </div>

      {!progress ? (
        <div className="flex-1 px-4 py-6 text-center text-faint">Cargando…</div>
      ) : goal.type === 'target_date' ? (
        <TargetProgress progress={progress} />
      ) : (
        <FlowProgress progress={progress} />
      )}
    </div>
  )
}

export default function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [progress, setProgress] = useState<Record<number, GoalProgress>>({})
  const [accounts, setAccounts] = useState<Category[]>([])
  const [editing, setEditing] = useState<Goal | null>(null)
  const [showModal, setShowModal] = useState(false)

  async function refresh() {
    const [gs, cats] = await Promise.all([api.goals.list(), api.categories.list()])
    setAccounts(cats.filter((c) => ['ahorro', 'inversion'].includes(c.type)))
    setGoals(gs)
    const progs = await Promise.all(gs.map((g) => api.goals.progress(g.id)))
    setProgress(Object.fromEntries(progs.map((p) => [p.goal_id, p])))
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreate(data: GoalCreateInput) {
    await api.goals.create(data)
    setShowModal(false)
    await refresh()
  }

  async function handleUpdate(data: { name: string; active: boolean }) {
    if (!editing) return
    await api.goals.update(editing.id, data)
    setShowModal(false)
    setEditing(null)
    await refresh()
  }

  async function handleAddTarget(data: GoalTargetInput) {
    if (!editing) return
    await api.goals.addTarget(editing.id, data)
    setShowModal(false)
    setEditing(null)
    await refresh()
  }

  async function handleDelete() {
    if (!editing) return
    if (!confirm('¿Eliminar este objetivo?')) return
    await api.goals.remove(editing.id)
    setShowModal(false)
    setEditing(null)
    await refresh()
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold tracking-tight text-fg">Objetivos de ahorro e inversión</h2>
        <button
          onClick={() => {
            setEditing(null)
            setShowModal(true)
          }}
          className="btn-primary"
        >
          + Nuevo objetivo
        </button>
      </div>

      <p className="mb-4 text-sm text-muted">
        Sigue mes a mes tus aportaciones a cada cuenta frente al objetivo; la evaluación es acumulada,
        así que un mes flojo se compensa con uno fuerte.
      </p>

      {goals.length === 0 ? (
        <div className="card px-4 py-8 text-center text-faint">Sin objetivos. Crea uno para seguir tu ahorro/inversión mes a mes.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              progress={progress[g.id]}
              onEdit={() => {
                setEditing(g)
                setShowModal(true)
              }}
            />
          ))}
        </div>
      )}

      {showModal && (
        <GoalModal
          accounts={accounts}
          initial={editing}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onAddTarget={handleAddTarget}
          onDelete={editing ? handleDelete : undefined}
        />
      )}
    </section>
  )
}
