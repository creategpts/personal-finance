import { useState } from 'react'
import { api, type AccountCheckItem, type Investment } from '../api'
import Modal from './Modal'
import Money from './Money'

const today = () => new Date().toISOString().slice(0, 10)
const parseDecimal = (s: string) => Math.abs(Number((s || '0').replace(/,/g, '.')))

export default function AssignPendingModal({
  item,
  activeHoldings,
  onClose,
  onAssigned,
}: {
  item: AccountCheckItem
  activeHoldings: Investment[]
  onClose: () => void
  onAssigned: () => Promise<void>
}) {
  const pending = item.difference
  const [date, setDate] = useState(today())
  const [amounts, setAmounts] = useState<Record<number, string>>(() =>
    activeHoldings.length === 1 ? { [activeHoldings[0].id]: pending.toFixed(2) } : {}
  )
  const [prices, setPrices] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allocatedTotal = activeHoldings.reduce((sum, h) => sum + parseDecimal(amounts[h.id] ?? ''), 0)
  const remaining = pending - allocatedTotal
  const matches = Math.abs(remaining) <= 0.01
  const pricesOk = activeHoldings.every((h) => {
    const amount = parseDecimal(amounts[h.id] ?? '')
    return amount <= 0 || h.type === 'seguros' || parseDecimal(prices[h.id] ?? '') > 0
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const allocations = activeHoldings
        .filter((h) => parseDecimal(amounts[h.id] ?? '') > 0)
        .map((h) => ({
          investment_id: h.id,
          amount: parseDecimal(amounts[h.id] ?? ''),
          price: h.type === 'seguros' ? undefined : parseDecimal(prices[h.id] ?? ''),
        }))
      await api.investments.assignPending(item.account, { date, allocations })
      await onAssigned()
      onClose()
    } catch {
      setError('No se pudo asignar — revisa los importes')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Asignar pendiente — ${item.account}`}
      size="md"
      onClose={onClose}
      onSubmit={handleSubmit}
      headerAction={
        <button type="submit" disabled={busy || !matches || !pricesOk} className="btn-primary">
          Asignar
        </button>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-muted">Fecha</span>
          <input required type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <div className="space-y-2">
          {activeHoldings.map((h) => (
            <div key={h.id} className="grid grid-cols-[1fr_7rem_6rem] items-center gap-2">
              <span className="truncate text-sm text-fg">{h.name}</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Importe"
                className="input"
                value={amounts[h.id] ?? ''}
                onChange={(e) => setAmounts((a) => ({ ...a, [h.id]: e.target.value }))}
              />
              {h.type !== 'seguros' ? (
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Precio"
                  className="input"
                  value={prices[h.id] ?? ''}
                  onChange={(e) => setPrices((p) => ({ ...p, [h.id]: e.target.value }))}
                />
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>

        <div className={`text-sm font-medium ${matches ? 'text-emerald-600' : 'text-amber-600'}`}>
          Pendiente: <Money value={pending} /> · Restante: <Money value={remaining} />
        </div>
        {!matches && <p className="text-xs text-faint">El reparto debe cuadrar exacto con el importe pendiente.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
