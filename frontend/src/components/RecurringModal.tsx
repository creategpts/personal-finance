import { useEffect, useState } from 'react'
import type { Category, RecurringExpense, RecurringExpenseInput } from '../api'
import { isOrigin, isDestination } from '../categoryTypes'
import { TrashIcon } from './Icons'

interface Props {
  categories: Category[]
  initial?: RecurringExpense | null
  defaultOrigin?: string // preselected origin when creating a new plan (e.g. an income category)
  onClose: () => void
  onDelete?: () => void
  onSave: (data: RecurringExpenseInput) => Promise<void>
}

const today = () => new Date().toISOString().slice(0, 10)

const FREQUENCY_LABELS: Record<RecurringExpense['frequency'], string> = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
}

export default function RecurringModal({ categories, initial, defaultOrigin, onClose, onDelete, onSave }: Props) {
  const origins = categories.filter((c) => isOrigin(c.type))
  const destinations = categories.filter((c) => isDestination(c.type))

  const [concept, setConcept] = useState(initial?.concept ?? '')
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '')
  const [frequency, setFrequency] = useState<RecurringExpense['frequency']>(initial?.frequency ?? 'monthly')
  const [nextDueDate, setNextDueDate] = useState(initial?.next_due_date ?? today())
  const [origin, setOrigin] = useState(initial?.origin ?? defaultOrigin ?? origins[0]?.name ?? '')
  const [destination, setDestination] = useState(initial?.destination ?? destinations[0]?.name ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [autoGenerate, setAutoGenerate] = useState(initial?.auto_generate ?? true)
  const [saving, setSaving] = useState(false)

  const dirty =
    concept !== (initial?.concept ?? '') ||
    amount !== (initial?.amount?.toString() ?? '') ||
    frequency !== (initial?.frequency ?? 'monthly') ||
    nextDueDate !== (initial?.next_due_date ?? today()) ||
    origin !== (initial?.origin ?? defaultOrigin ?? origins[0]?.name ?? '') ||
    destination !== (initial?.destination ?? destinations[0]?.name ?? '') ||
    active !== (initial?.active ?? true) ||
    autoGenerate !== (initial?.auto_generate ?? true)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        concept,
        amount: Number(amount),
        origin,
        destination,
        frequency,
        next_due_date: nextDueDate,
        active,
        auto_generate: autoGenerate,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">
            {initial ? 'Editar movimiento recurrente' : 'Nuevo movimiento recurrente'}
          </h2>
          <button
            type="submit"
            disabled={!dirty || saving}
            className={`btn-primary ${dirty ? '' : 'invisible'}`}
          >
            Guardar
          </button>
        </div>

        <label className="mb-3 block text-sm">
          Concepto
          <input
            required
            className="mt-1 input"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
          />
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Importe
            <input
              required
              type="number"
              step="0.01"
              className="mt-1 input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Próxima fecha
            <input
              required
              type="date"
              className="mt-1 input"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
            />
          </label>
        </div>

        <label className="mb-3 block text-sm">
          Frecuencia
          <select
            className="mt-1 input"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as RecurringExpense['frequency'])}
          >
            {(Object.keys(FREQUENCY_LABELS) as RecurringExpense['frequency'][]).map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Origen
            <select
              className="mt-1 input"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            >
              {origins.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Destino
            <select
              className="mt-1 input"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              {destinations.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mb-2 flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-fg" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Activo
        </label>

        <label className="mb-1 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-fg"
            checked={autoGenerate}
            onChange={(e) => setAutoGenerate(e.target.checked)}
          />
          Generar movimiento automáticamente en la fecha
        </label>
        <p className="mb-4 text-xs text-muted">
          Desactívalo si no tiene una fecha fija clara (corte de pelo, ITV, taller…): se planifica y
          analiza a año vista sin crear movimientos.
        </p>

        {onDelete && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={onDelete}
              title="Eliminar"
              aria-label="Eliminar"
              className="inline-flex text-red-500 hover:text-red-700"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
