import { useState } from 'react'
import Modal from './Modal'

interface Props {
  count: number
  existingGroups: string[] // for the datalist: reuse an existing umbrella name
  initialName?: string // prefilled when all selected already share one group
  onClose: () => void
  onApply: (groupName: string | null) => Promise<void> // null = ungroup (empty input)
}

// Assign a shared umbrella name to the selected movements (e.g. "Vacaciones con
// Nerea 2026"). Empty input clears the group. Datalist offers existing names.
export default function GroupModal({ count, existingGroups, initialName, onClose, onApply }: Props) {
  const [name, setName] = useState(initialName ?? '')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onApply(name.trim() || null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Agrupar ${count} movimientos`}
      size="sm"
      onClose={onClose}
      onSubmit={submit}
      headerAction={
        <button type="submit" disabled={saving} className="btn-primary">
          Aplicar
        </button>
      }
    >
      <p className="mb-5 text-sm text-muted">
        Aparecerán juntos bajo un nombre común, plegables en una sola fila (importes sumados, rango de
        fechas). Deja el campo vacío para desagrupar.
      </p>
      <label className="block text-sm">
        Nombre del grupo
        <input
          autoFocus
          list="group-names"
          className="mt-1.5 input"
          placeholder="Vacaciones con Nerea 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <datalist id="group-names">
          {existingGroups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </label>
    </Modal>
  )
}
