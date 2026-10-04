import { useState } from 'react'
import type { InvestmentTransaction, InvestmentTransactionInput } from '../api'
import { parseDecimal, today } from '../pages/InvestmentLedger'
import Modal from './Modal'
import { TrashIcon } from './Icons'

interface Props {
  tx: InvestmentTransaction
  lumpSum: boolean
  onClose: () => void
  onSave: (data: InvestmentTransactionInput) => Promise<void>
  onDelete: () => Promise<void>
}

export default function EditInvestmentTransactionModal({ tx, lumpSum, onClose, onSave, onDelete }: Props) {
  const initialKind: 'buy' | 'sell' = tx.amount >= 0 ? 'buy' : 'sell'
  const [mode, setMode] = useState<'flow' | 'adjustment'>(tx.kind)
  const [kind, setKind] = useState<'buy' | 'sell'>(initialKind)
  const [date, setDate] = useState(tx.date || today())
  const [price, setPrice] = useState(tx.units !== 0 ? String(Math.abs(tx.amount / tx.units)) : '')
  const [amount, setAmount] = useState(String(Math.abs(tx.amount)))
  const [adjustment, setAdjustment] = useState(String(tx.amount))
  const [note, setNote] = useState(tx.note ?? '')
  const [busy, setBusy] = useState(false)

  const parsedPrice = parseDecimal(price)
  const parsedAmount = parseDecimal(amount)
  const parsedAdjustment = Number((adjustment || '0').replace(/,/g, '.'))
  const valid = lumpSum
    ? mode === 'flow'
      ? parsedAmount > 0
      : adjustment !== '' && !Number.isNaN(parsedAdjustment)
    : parsedPrice > 0 && parsedAmount > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (lumpSum) {
        if (mode === 'flow') {
          const sign = kind === 'buy' ? 1 : -1
          await onSave({ date, units: 0, amount: sign * parsedAmount, kind: 'flow', note: note || null })
        } else {
          await onSave({ date, units: 0, amount: parsedAdjustment, kind: 'adjustment', note: note || null })
        }
      } else {
        const sign = kind === 'buy' ? 1 : -1
        await onSave({
          date,
          units: sign * (parsedPrice > 0 ? parsedAmount / parsedPrice : 0),
          amount: sign * parsedAmount,
          kind: 'flow',
          note: note || null,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await onDelete()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Editar movimiento"
      size="sm"
      onClose={onClose}
      onSubmit={handleSubmit}
      headerAction={
        <button type="submit" disabled={busy || !valid} className="btn-primary">
          Guardar
        </button>
      }
      footer={
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-red-500 transition hover:text-red-700"
        >
          <TrashIcon /> Eliminar
        </button>
      }
    >
      <div className="space-y-3">
        {lumpSum && (
          <div className="grid grid-cols-2 gap-2">
            {(['flow', 'adjustment'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                  mode === m ? 'border-fg bg-surface2 text-fg' : 'border-line text-muted hover:text-fg'
                }`}
              >
                {m === 'flow' ? 'Aportación / Retirada' : 'Ajuste de valor'}
              </button>
            ))}
          </div>
        )}

        {(!lumpSum || mode === 'flow') && (
          <div className="grid grid-cols-2 gap-2">
            {(['buy', 'sell'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                  kind === k ? 'border-fg bg-surface2 text-fg' : 'border-line text-muted hover:text-fg'
                }`}
              >
                {lumpSum ? (k === 'buy' ? 'Aportación' : 'Retirada') : k === 'buy' ? 'Aportación (compra)' : 'Venta'}
              </button>
            ))}
          </div>
        )}

        <input required type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />

        {!lumpSum && (
          <div className="grid grid-cols-2 gap-2">
            <input required type="text" inputMode="decimal" placeholder="Precio de compra" className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
            <input required type="text" inputMode="decimal" placeholder="Importe €" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        )}
        {lumpSum && mode === 'flow' && (
          <input required type="text" inputMode="decimal" placeholder="Importe €" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        )}
        {lumpSum && mode === 'adjustment' && (
          <input required type="text" inputMode="decimal" placeholder="Ajuste (+/-)" className="input" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} />
        )}

        <input className="input" placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  )
}
