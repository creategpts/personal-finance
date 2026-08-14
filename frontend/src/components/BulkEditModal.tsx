import { useState } from 'react'
import type { Category, MovementStatus } from '../api'
import { isOrigin, isDestination } from '../categoryTypes'
import Modal from './Modal'

export interface BulkOverrides {
  status?: MovementStatus
  origin?: string
  destination?: string
  date?: string
}

interface Props {
  count: number
  categories: Category[]
  onClose: () => void
  onApply: (o: BulkOverrides) => Promise<void>
}

const KEEP = '__keep__' // "sin cambios" sentinel

export default function BulkEditModal({ count, categories, onClose, onApply }: Props) {
  const origins = categories.filter((c) => isOrigin(c.type))
  const destinations = categories.filter((c) => isDestination(c.type))

  const [status, setStatus] = useState(KEEP)
  const [origin, setOrigin] = useState(KEEP)
  const [destination, setDestination] = useState(KEEP)
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  const overrides: BulkOverrides = {
    ...(status !== KEEP && { status: status as MovementStatus }),
    ...(origin !== KEEP && { origin }),
    ...(destination !== KEEP && { destination }),
    ...(date && { date }),
  }
  const nChanges = Object.keys(overrides).length

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nChanges) return
    setSaving(true)
    try {
      await onApply(overrides)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Editar ${count} movimientos`}
      size="sm"
      onClose={onClose}
      onSubmit={submit}
      headerAction={
        <button type="submit" disabled={saving || !nChanges} className={`btn-primary ${nChanges ? '' : 'invisible'}`}>
          Aplicar
        </button>
      }
    >
      <p className="mb-5 text-sm text-muted">Solo se cambian los campos que ajustes. «Sin cambios» los deja igual.</p>

      <div className="space-y-5">
        <label className="block text-sm">
          Estado
          <select className="mt-1.5 input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value={KEEP}>Sin cambios</option>
            <option value="Plan">Plan</option>
            <option value="Done">Done</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            Origen
            <select className="mt-1.5 input" value={origin} onChange={(e) => setOrigin(e.target.value)}>
              <option value={KEEP}>Sin cambios</option>
              {origins.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Destino
            <select className="mt-1.5 input" value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value={KEEP}>Sin cambios</option>
              {destinations.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          Fecha
          <input type="date" className="mt-1.5 input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
    </Modal>
  )
}
