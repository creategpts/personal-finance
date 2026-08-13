import { useEffect, useState } from 'react'
import type { Category, MovementStatus } from '../api'
import { isOrigin, isDestination } from '../categoryTypes'

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

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-2xl"
      >
        <div className="mb-1 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Editar {count} movimientos</h2>
          <button type="submit" disabled={saving || !nChanges} className={`btn-primary ${nChanges ? '' : 'invisible'}`}>
            Aplicar
          </button>
        </div>
        <p className="mb-4 text-xs text-muted">Solo se cambian los campos que ajustes. «Sin cambios» los deja igual.</p>

        <label className="mb-3 block text-sm">
          Estado
          <select className="mt-1 input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value={KEEP}>Sin cambios</option>
            <option value="Plan">Plan</option>
            <option value="Done">Done</option>
          </select>
        </label>

        <label className="mb-3 block text-sm">
          Origen
          <select className="mt-1 input" value={origin} onChange={(e) => setOrigin(e.target.value)}>
            <option value={KEEP}>Sin cambios</option>
            {origins.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="mb-3 block text-sm">
          Destino
          <select className="mt-1 input" value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value={KEEP}>Sin cambios</option>
            {destinations.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="mb-1 block text-sm">
          Fecha
          <input type="date" className="mt-1 input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </form>
    </div>
  )
}
