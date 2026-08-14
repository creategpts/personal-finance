import { useState } from 'react'
import type { Category, MovementInput, MovementStatus } from '../api'
import Modal from './Modal'

interface Props {
  initial: MovementInput[]
  categories: Category[]
  existingCount: number
  onClose: () => void
  onConfirm: (records: MovementInput[]) => Promise<void>
}

type Row = { date: string; concept: string; amount: string; status: MovementStatus; origin: string; destination: string }

const cell = 'w-full rounded-md border border-line bg-surface px-2 py-1 text-sm text-fg outline-none focus:border-faint'

export default function CsvPreviewModal({ initial, categories, existingCount, onClose, onConfirm }: Props) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((r) => ({ ...r, amount: String(r.amount) })))
  const [saving, setSaving] = useState(false)

  const names = categories.map((c) => c.name)
  const invalid = (r: Row) => !r.concept.trim() || r.amount.trim() === '' || Number.isNaN(Number(r.amount)) || !r.date
  const invalidCount = rows.filter(invalid).length
  const canInsert = rows.length > 0 && invalidCount === 0

  function update(i: number, key: keyof Row, val: string) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)))
  }

  async function confirm() {
    if (!canInsert) return
    setSaving(true)
    try {
      await onConfirm(
        rows.map((r) => ({
          date: r.date.trim(),
          concept: r.concept.trim(),
          amount: Number(r.amount),
          status: r.status,
          origin: r.origin.trim(),
          destination: r.destination.trim(),
        })),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Vista previa de importación"
      size="xl"
      onClose={onClose}
      bodyClassName="!py-4 overflow-y-auto"
      headerAction={
        <button onClick={confirm} disabled={saving || !canInsert} className="btn-primary">
          Insertar {rows.length}
        </button>
      }
      footer={
        <p className="text-sm text-muted">
          Se añadirán a los {existingCount} movimientos existentes.
          {invalidCount > 0 && <span className="ml-1 font-medium text-red-600">{invalidCount} fila(s) con datos inválidos.</span>}
        </p>
      }
    >
      <datalist id="csv-cats">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted">
            <th className="px-1 py-2">Fecha</th>
            <th className="px-1 py-2">Concepto</th>
            <th className="px-1 py-2">Importe</th>
            <th className="px-1 py-2">Estado</th>
            <th className="px-1 py-2">Origen</th>
            <th className="px-1 py-2">Destino</th>
            <th className="px-1 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={invalid(r) ? 'bg-red-50 dark:bg-red-500/10' : ''}>
              <td className="px-1 py-1"><input type="date" className={cell} value={r.date} onChange={(e) => update(i, 'date', e.target.value)} /></td>
              <td className="px-1 py-1"><input className={cell} value={r.concept} onChange={(e) => update(i, 'concept', e.target.value)} /></td>
              <td className="px-1 py-1"><input inputMode="decimal" className={`${cell} text-right`} value={r.amount} onChange={(e) => update(i, 'amount', e.target.value)} /></td>
              <td className="px-1 py-1">
                <select className={cell} value={r.status} onChange={(e) => update(i, 'status', e.target.value)}>
                  <option value="Done">Done</option>
                  <option value="Plan">Plan</option>
                </select>
              </td>
              <td className="px-1 py-1"><input list="csv-cats" className={cell} value={r.origin} onChange={(e) => update(i, 'origin', e.target.value)} /></td>
              <td className="px-1 py-1"><input list="csv-cats" className={cell} value={r.destination} onChange={(e) => update(i, 'destination', e.target.value)} /></td>
              <td className="px-1 py-1 text-right">
                <button
                  onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                  className="text-faint hover:text-red-600"
                  title="Quitar fila"
                  aria-label="Quitar fila"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-faint">Sin filas</td>
            </tr>
          )}
        </tbody>
      </table>
    </Modal>
  )
}
