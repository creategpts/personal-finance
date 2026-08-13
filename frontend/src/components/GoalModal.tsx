import { useEffect, useState } from 'react'
import type { Category, Goal, GoalCreateInput, GoalTargetInput, GoalType } from '../api'
import { TrashIcon } from './Icons'

interface Props {
  accounts: Category[] // saving/investment accounts only
  initial?: Goal | null
  onClose: () => void
  onCreate: (data: GoalCreateInput) => Promise<void>
  onUpdate: (data: { name: string; active: boolean }) => Promise<void>
  onAddTarget: (data: GoalTargetInput) => Promise<void>
  onDelete?: () => Promise<void>
}

const TYPE_LABELS: Record<GoalType, string> = {
  fixed: 'Cantidad fija',
  percent_income: '% de ingresos',
  target_date: 'Meta con fecha',
}
const TYPE_HINTS: Record<GoalType, string> = {
  fixed: 'Aporta un importe fijo cada mes.',
  percent_income: 'Aporta un porcentaje de tus ingresos del mes.',
  target_date: 'Alcanza un saldo total en una fecha. Tu saldo actual ya cuenta.',
}

const pad = (n: number) => String(n).padStart(2, '0')
const thisMonth = () => new Date().toISOString().slice(0, 7) // "YYYY-MM"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

// input with a trailing unit (€ / %)
function Adorned({ suffix, children }: { suffix: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">{suffix}</span>
    </div>
  )
}

function buildTarget(type: GoalType, f: { amount: string; percent: string; targetAmount: string; targetMonth: string }): GoalTargetInput {
  if (type === 'fixed') return { amount: Number(f.amount) }
  if (type === 'percent_income') return { percent: Number(f.percent) }
  const [ty, tm] = f.targetMonth.split('-').map(Number)
  return { target_amount: Number(f.targetAmount), target_year: ty, target_month: tm }
}

export default function GoalModal({ accounts, initial, onClose, onCreate, onUpdate, onAddTarget, onDelete }: Props) {
  const editing = !!initial
  const last = initial?.targets[initial.targets.length - 1]

  const [name, setName] = useState(initial?.name ?? '')
  const [account, setAccount] = useState(initial?.account ?? accounts[0]?.name ?? '')
  const [type, setType] = useState<GoalType>(initial?.type ?? 'fixed')
  const [active, setActive] = useState(initial?.active ?? true)
  const [startMonth, setStartMonth] = useState(initial ? `${initial.start_year}-${pad(initial.start_month)}` : thisMonth())

  // target params — prefilled from the latest target when editing
  const [amount, setAmount] = useState(last?.amount?.toString() ?? '')
  const [percent, setPercent] = useState(last?.percent?.toString() ?? '')
  const [targetAmount, setTargetAmount] = useState(last?.target_amount?.toString() ?? '')
  const [targetMonth, setTargetMonth] = useState(last?.target_year ? `${last.target_year}-${pad(last.target_month!)}` : thisMonth())

  const [changeMonth, setChangeMonth] = useState(thisMonth())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const paramFields = { amount, percent, targetAmount, targetMonth }

  function targetInputs() {
    if (type === 'fixed')
      return (
        <Field label="Importe mensual">
          <Adorned suffix="€">
            <input required type="number" step="0.01" min="0" className="input pr-8" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Adorned>
        </Field>
      )
    if (type === 'percent_income')
      return (
        <Field label="Porcentaje de ingresos">
          <Adorned suffix="%">
            <input required type="number" step="0.1" min="0" className="input pr-8" value={percent} onChange={(e) => setPercent(e.target.value)} />
          </Adorned>
        </Field>
      )
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Meta total">
          <Adorned suffix="€">
            <input required type="number" step="0.01" min="0" className="input pr-8" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
          </Adorned>
        </Field>
        <Field label="Fecha límite">
          <input required type="month" className="input" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} />
        </Field>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (editing) {
        await onUpdate({ name, active })
      } else {
        const [sy, sm] = startMonth.split('-').map(Number)
        await onCreate({ name, account, type, active, start_year: sy, start_month: sm, target: buildTarget(type, paramFields) })
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleAddTarget() {
    setBusy(true)
    try {
      const [ey, em] = changeMonth.split('-').map(Number)
      await onAddTarget({ ...buildTarget(type, paramFields), eff_year: ey, eff_month: em })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight">{editing ? 'Editar objetivo' : 'Nuevo objetivo'}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-xl leading-none text-faint hover:text-fg">
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Field label="Nombre">
            <input required autoFocus className="input" placeholder="Entrada piso, Fondo emergencia…" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          {editing ? (
            <div className="rounded-lg border border-line bg-surface2/50 px-3 py-2 text-sm text-muted">
              <span className="font-medium text-fg">{account}</span> · {TYPE_LABELS[type]} · desde {startMonth}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cuenta">
                  <select className="input" value={account} onChange={(e) => setAccount(e.target.value)}>
                    {accounts.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Desde">
                  <input required type="month" className="input" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
                </Field>
              </div>

              <div>
                <span className="mb-1 block text-sm font-medium text-muted">Tipo de objetivo</span>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(TYPE_LABELS) as GoalType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                        type === t ? 'border-fg bg-surface2 text-fg' : 'border-line text-muted hover:text-fg'
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-faint">{TYPE_HINTS[type]}</p>
              </div>

              {targetInputs()}
            </>
          )}

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-line px-3 py-2.5 text-sm">
            <span className="font-medium text-fg">Activo</span>
            <input type="checkbox" className="h-4 w-4 accent-fg" checked={active} onChange={(e) => setActive(e.target.checked)} />
          </label>

          {editing && (
            <div className="rounded-lg border border-line bg-surface2/50 p-3">
              <p className="text-sm font-medium text-fg">Cambiar objetivo</p>
              <p className="mb-3 text-xs text-muted">No reescribe el pasado: los meses anteriores mantienen el objetivo vigente entonces.</p>
              {targetInputs()}
              <div className="mt-3 grid grid-cols-2 items-end gap-3">
                <Field label="A partir de">
                  <input type="month" className="input" value={changeMonth} onChange={(e) => setChangeMonth(e.target.value)} />
                </Field>
                <button type="button" disabled={busy} onClick={handleAddTarget} className="btn">
                  Aplicar cambio
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          {onDelete ? (
            <button type="button" onClick={onDelete} title="Eliminar objetivo" aria-label="Eliminar objetivo" className="inline-flex text-red-500 hover:text-red-700">
              <TrashIcon />
            </button>
          ) : (
            <span />
          )}
          <button type="submit" disabled={busy} className="btn-primary">
            {editing ? 'Guardar' : 'Crear objetivo'}
          </button>
        </div>
      </form>
    </div>
  )
}
