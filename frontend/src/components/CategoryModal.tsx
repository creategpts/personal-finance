import { useState } from 'react'
import type { Category, CategoryType } from '../api'
import { TrashIcon } from './Icons'
import IconPicker from './IconPicker'
import Modal from './Modal'

const DEFAULT_ICON = 'Tag'

interface Props {
  title: string
  initial?: Category | null
  fixedType?: CategoryType
  typeOptions?: { value: CategoryType; label: string }[]
  // expense categories only: pick a top-level category to nest under ("— Ninguna —" = top-level itself)
  parentOptions?: { value: number; label: string }[]
  showBalance?: boolean
  onClose: () => void
  onDelete?: () => void
  onSave: (data: {
    name: string
    type: CategoryType
    visible: boolean
    initial_balance: number
    parent_id: number | null
    icon: string
    color: string
  }) => Promise<void>
}

export default function CategoryModal({
  title,
  initial,
  fixedType,
  typeOptions,
  parentOptions,
  showBalance,
  onClose,
  onDelete,
  onSave,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<CategoryType>(initial?.type ?? fixedType ?? typeOptions?.[0]?.value ?? 'expense')
  const [parentId, setParentId] = useState<number | null>(initial?.parent_id ?? null)
  const [initialBalance, setInitialBalance] = useState(String(initial?.initial_balance ?? 0))
  const [icon, setIcon] = useState(initial?.icon ?? DEFAULT_ICON)
  const [color, setColor] = useState(initial?.color ?? '#6b7280')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // a subcategory has no icon/color of its own — the UI always shows its parent's
  const isSubcategory = !!parentOptions && parentId !== null

  const dirty =
    name !== (initial?.name ?? '') ||
    type !== (initial?.type ?? fixedType ?? typeOptions?.[0]?.value ?? 'expense') ||
    parentId !== (initial?.parent_id ?? null) ||
    (!!showBalance && initialBalance !== String(initial?.initial_balance ?? 0)) ||
    (!isSubcategory && (icon !== (initial?.icon ?? DEFAULT_ICON) || color !== (initial?.color ?? '#6b7280')))

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
        parent_id: parentOptions ? parentId : null,
        icon: isSubcategory ? (initial?.icon ?? DEFAULT_ICON) : icon,
        color: isSubcategory ? (initial?.color ?? '#6b7280') : color,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      onSubmit={handleSubmit}
      headerAction={
        <button
          type="submit"
          disabled={!dirty || saving || !name.trim()}
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
            <TrashIcon /> Eliminar categoría
          </button>
        )
      }
    >
      <div className="space-y-5">
        <label className="block text-sm">
          Nombre
          <input
            autoFocus
            required
            className="mt-1.5 input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        {typeOptions && (
          <label className="block text-sm">
            Tipo
            <select
              className="mt-1.5 input"
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

        {parentOptions && (
          <label className="block text-sm">
            Categoría principal
            <select
              className="mt-1.5 input"
              value={parentId ?? ''}
              onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Ninguna (categoría principal) —</option>
              {parentOptions.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {!isSubcategory && (
          <div className="flex gap-3">
            <label className="flex-1 text-sm">
              Icono
              <div className="mt-1.5">
                <IconPicker value={icon} onChange={setIcon} />
              </div>
            </label>
            <label className="w-20 text-sm">
              Color
              <input
                type="color"
                className="mt-1.5 h-[38px] w-full cursor-pointer rounded-lg border border-line bg-surface p-1"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
          </div>
        )}

        {showBalance && (
          <label className="block text-sm">
            Saldo inicial (antes de los movimientos registrados)
            <input
              type="number"
              step="0.01"
              className="mt-1.5 input"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
          </label>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </Modal>
  )
}
