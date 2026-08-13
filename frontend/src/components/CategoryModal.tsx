import { useEffect, useState } from 'react'
import type { Category, CategoryType } from '../api'
import { TrashIcon } from './Icons'

interface Props {
  title: string
  initial?: Category | null
  fixedType?: CategoryType
  typeOptions?: { value: CategoryType; label: string }[]
  showBalance?: boolean
  onClose: () => void
  onDelete?: () => void
  onSave: (data: { name: string; type: CategoryType; visible: boolean; initial_balance: number }) => Promise<void>
}

export default function CategoryModal({
  title,
  initial,
  fixedType,
  typeOptions,
  showBalance,
  onClose,
  onDelete,
  onSave,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<CategoryType>(initial?.type ?? fixedType ?? typeOptions?.[0]?.value ?? 'expense')
  const [initialBalance, setInitialBalance] = useState(String(initial?.initial_balance ?? 0))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const dirty =
    name !== (initial?.name ?? '') ||
    type !== (initial?.type ?? fixedType ?? typeOptions?.[0]?.value ?? 'expense') ||
    (!!showBalance && initialBalance !== String(initial?.initial_balance ?? 0))

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        type,
        visible: initial?.visible ?? true,
        initial_balance: showBalance ? Number(initialBalance || 0) : 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button
            type="submit"
            disabled={!dirty || saving || !name.trim()}
            className={`btn-primary ${dirty ? '' : 'invisible'}`}
          >
            Guardar
          </button>
        </div>

        <label className="mb-3 block text-sm">
          Nombre
          <input
            autoFocus
            required
            className="mt-1 input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        {typeOptions && (
          <label className="mb-3 block text-sm">
            Tipo
            <select
              className="mt-1 input"
              value={type}
              onChange={(e) => setType(e.target.value as CategoryType)}
            >
              {typeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {showBalance && (
          <label className="mb-3 block text-sm">
            Saldo inicial (antes de los movimientos registrados)
            <input
              type="number"
              step="0.01"
              className="mt-1 input"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
          </label>
        )}

        {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

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
