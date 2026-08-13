import { useEffect, useState } from 'react'
import type { Category, Movement, MovementInput } from '../api'
import { isOrigin, isDestination } from '../categoryTypes'
import Money from './Money'
import { TrashIcon } from './Icons'

// Sum a chain of signed decimals: "+4+3+5" -> 12, "13,55 - 4,55" -> 9, "5" -> 5. null if invalid.
// Comma is the decimal separator (es-ES); spaces around operators are ignored.
function evalAmount(raw: string): number | null {
  const s = raw.replace(/\s+/g, '').replace(/,/g, '.')
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([+-](\d+(\.\d*)?|\.\d+))*$/.test(s)) return null
  const terms = s.match(/[+-]?(\d+(\.\d*)?|\.\d+)/g)
  return terms ? terms.reduce((sum, t) => sum + Number(t), 0) : null
}

interface Props {
  categories: Category[]
  initial?: Movement | null
  onClose: () => void
  onDelete?: () => void
  onSave: (data: MovementInput) => Promise<void>
}

const today = () => new Date().toISOString().slice(0, 10)

export default function MovementModal({ categories, initial, onClose, onDelete, onSave }: Props) {
  const allOrigins = categories.filter((c) => isOrigin(c.type))
  const allDestinations = categories.filter((c) => isDestination(c.type))

  const [concept, setConcept] = useState(initial?.concept ?? '')
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '')
  const [status, setStatus] = useState<Movement['status']>(initial?.status ?? 'Done')
  const [date, setDate] = useState(initial?.date ?? today())
  const [origin, setOrigin] = useState(initial?.origin ?? allOrigins[0]?.name ?? '')
  const [destination, setDestination] = useState(initial?.destination ?? allDestinations[0]?.name ?? '')
  const [saving, setSaving] = useState(false)

  // un ingreso no puede ir directo a un gasto — cada lado excluye el otro flujo
  const originType = categories.find((c) => c.name === origin)?.type
  const destinationType = categories.find((c) => c.name === destination)?.type
  const origins = allOrigins.filter((c) => !(destinationType === 'expense' && c.type === 'income'))
  const destinations = allDestinations.filter((c) => !(originType === 'income' && c.type === 'expense'))

  // the dropdowns below already hide the invalid combo from selection; this only
  // self-heals the initial default state if origin/destination land on income/expense
  useEffect(() => {
    if (originType === 'income' && destinationType === 'expense') {
      setDestination(allDestinations.find((c) => c.type !== 'expense')?.name ?? '')
    }
  }, [originType, destinationType]) // eslint-disable-line react-hooks/exhaustive-deps

  const computedAmount = evalAmount(amount)
  const showAggregate = /[+-]/.test(amount.trim()) && computedAmount !== null
  const dirty =
    concept !== (initial?.concept ?? '') ||
    amount !== (initial?.amount?.toString() ?? '') ||
    status !== (initial?.status ?? 'Done') ||
    date !== (initial?.date ?? today()) ||
    origin !== (initial?.origin ?? origins[0]?.name ?? '') ||
    destination !== (initial?.destination ?? destinations[0]?.name ?? '')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (computedAmount === null) return
    setSaving(true)
    try {
      await onSave({
        concept,
        amount: computedAmount,
        status,
        date,
        origin,
        destination,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">
            {initial ? 'Editar movimiento' : 'Nuevo movimiento'}
          </h2>
          <button
            type="submit"
            disabled={!dirty || saving || computedAmount === null}
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
              type="text"
              inputMode="decimal"
              placeholder="+4+3+5"
              className="mt-1 input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Fecha
            <input
              required
              type="date"
              className="mt-1 input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>

        {showAggregate && (
          <div className="mb-3 -mt-1 text-sm text-muted">
            Se registrará: <span className="font-semibold text-fg"><Money value={computedAmount} /></span>
          </div>
        )}

        <label className="mb-3 block text-sm">
          Estado
          <select
            className="mt-1 input"
            value={status}
            onChange={(e) => setStatus(e.target.value as Movement['status'])}
          >
            <option value="Plan">Plan</option>
            <option value="Done">Done</option>
          </select>
        </label>

        <div className="mb-4 grid grid-cols-2 gap-3">
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
