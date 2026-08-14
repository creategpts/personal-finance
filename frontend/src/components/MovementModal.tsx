import { useEffect, useState } from 'react'
import { ACCOUNT_TYPES, type Category, type Movement, type MovementInput } from '../api'
import { isOrigin, isDestination } from '../categoryTypes'
import Money from './Money'
import { TrashIcon } from './Icons'
import CategoryPicker, { type PickerItem } from './CategoryPicker'
import Modal from './Modal'

const ACCOUNT_TYPE_SET = new Set<string>(ACCOUNT_TYPES)
const isAccountCategory = (c: Category) => ACCOUNT_TYPE_SET.has(c.type)

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

  // ---- Origen: categorías de Ingreso planas + grupo "Cuenta" con todas las cuentas ----
  const originAccounts = allOrigins.filter(isAccountCategory)
  const originCategories = allOrigins.filter(
    (c) => !isAccountCategory(c) && !(destinationType === 'expense' && c.type === 'income'),
  )

  // ---- Destino: cada categoría de Gasto de nivel superior es su propio grupo (con sus
  // subcategorías dentro, si tiene); las cuentas van en su propio grupo "Cuenta" ----
  const destinationAccounts = allDestinations.filter(isAccountCategory)
  const destinationTopCategories = allDestinations.filter(
    (c) => !isAccountCategory(c) && !(originType === 'income' && c.type === 'expense') && c.parent_id === null,
  )
  const subcategoriesOf = (parentId: number) => categories.filter((c) => c.parent_id === parentId)

  const originItems: PickerItem[] = [
    ...originCategories.map((c) => ({ kind: 'leaf' as const, value: c.name, label: c.name })),
    ...(originAccounts.length > 0
      ? [{ kind: 'group' as const, label: 'Cuenta', flat: true, children: originAccounts.map((c) => ({ value: c.name, label: c.name })) }]
      : []),
  ]

  const destinationItems: PickerItem[] = [
    ...destinationTopCategories.map((c) => {
      const subs = subcategoriesOf(c.id)
      if (subs.length === 0) return { kind: 'leaf' as const, value: c.name, label: c.name }
      return {
        kind: 'group' as const,
        label: c.name,
        selfValue: c.name,
        children: subs.map((s) => ({ value: s.name, label: s.name })),
      }
    }),
    ...(destinationAccounts.length > 0
      ? [{ kind: 'group' as const, label: 'Cuenta', flat: true, children: destinationAccounts.map((c) => ({ value: c.name, label: c.name })) }]
      : []),
  ]

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
    origin !== (initial?.origin ?? allOrigins[0]?.name ?? '') ||
    destination !== (initial?.destination ?? allDestinations[0]?.name ?? '')

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
    <Modal
      title={initial ? 'Editar movimiento' : 'Nuevo movimiento'}
      onClose={onClose}
      onSubmit={handleSubmit}
      headerAction={
        <button
          type="submit"
          disabled={!dirty || saving || computedAmount === null}
          className={`btn-primary ${dirty ? '' : 'invisible'}`}
        >
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
            <TrashIcon /> Eliminar movimiento
          </button>
        )
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-[0.67fr_1.6fr] gap-4">
          <label className="block text-sm">
            Importe
            <input
              autoFocus
              required
              type="text"
              inputMode="decimal"
              placeholder="+4+3+5"
              className="mt-1.5 input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {showAggregate && (
              <span className="mt-1.5 block text-xs text-muted">
                Se registrará: <span className="font-semibold text-fg"><Money value={computedAmount} /></span>
              </span>
            )}
          </label>
          <label className="block text-sm">
            Concepto
            <input
              required
              className="mt-1.5 input"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            Origen
            <div className="mt-1.5">
              <CategoryPicker items={originItems} value={origin} onChange={setOrigin} />
            </div>
          </label>
          <label className="block text-sm">
            Destino
            <div className="mt-1.5">
              <CategoryPicker items={destinationItems} value={destination} onChange={setDestination} />
            </div>
          </label>
        </div>

        <div className="flex items-start justify-end gap-8">
          <label className="block text-sm">
            <span className="mb-1.5 block">Fecha</span>
            <input
              required
              type="date"
              className="input !w-auto"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <div className="text-sm">
            <span className="mb-1.5 block">Estado</span>
            <div className="inline-flex gap-0.5 rounded-lg border border-line bg-surface2 p-0.5">
              {(['Plan', 'Done'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                    status === s ? 'bg-primary text-primaryfg' : 'text-muted hover:text-fg'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
