import { useState } from 'react'
import type { Category, RecurringExpense, RecurringExpenseInput } from '../api'
import { isOrigin, isDestination } from '../categoryTypes'
import { TrashIcon } from './Icons'
import Modal from './Modal'

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
    <Modal
      title={initial ? 'Editar movimiento recurrente' : 'Nuevo movimiento recurrente'}
      size="md"
      onClose={onClose}
      onSubmit={handleSubmit}
      headerAction={
        <button type="submit" disabled={!dirty || saving} className={`btn-primary ${dirty ? '' : 'invisible'}`}>
          Guardar
        </button>
      }
      footer={
        onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-red-500 transition hover:text-red-700"
          >
            <TrashIcon /> Eliminar recurrente
          </button>
        )
      }
    >
      <div className="space-y-5">
        <label className="block text-sm">
          Concepto
          <input
            autoFocus
            required
            className="mt-1.5 input"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            Origen
            <select className="mt-1.5 input" value={origin} onChange={(e) => setOrigin(e.target.value)}>
              {origins.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Destino
            <select className="mt-1.5 input" value={destination} onChange={(e) => setDestination(e.target.value)}>
              {destinations.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            Importe
            <input
              required
              type="number"
              step="0.01"
              className="mt-1.5 input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Próxima fecha
            <input
              required
              type="date"
              className="mt-1.5 input"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
            />
          </label>
        </div>

        <label className="block text-sm">
          Frecuencia
          <select
            className="mt-1.5 input"
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

        <div className="space-y-3 rounded-lg border border-line bg-surface2/50 p-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-fg" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Activo
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-fg"
              checked={autoGenerate}
              onChange={(e) => setAutoGenerate(e.target.checked)}
            />
            Generar movimiento automáticamente en la fecha
          </label>
          <p className="text-xs text-faint">
            Desactívalo si no tiene una fecha fija clara (corte de pelo, ITV, taller…): se planifica y
            analiza a año vista sin crear movimientos.
          </p>
        </div>
      </div>
    </Modal>
  )
}
