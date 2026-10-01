import { useState } from 'react'
import type { Investment, InvestmentTransactionInput } from '../api'
import { INVESTMENT_TYPE_LABELS } from '../investmentColors'
import Modal from './Modal'
import Money from './Money'
import { TrashIcon } from './Icons'

interface Props {
  investment: Investment
  onClose: () => void
  onAddTransaction: (data: InvestmentTransactionInput) => Promise<void>
  onRemoveTransaction: (transactionId: number) => Promise<void>
  onRefreshPrice?: () => Promise<void>
}

const today = () => new Date().toISOString().slice(0, 10)

export default function ContributionModal({ investment, onClose, onAddTransaction, onRemoveTransaction, onRefreshPrice }: Props) {
  const [txDate, setTxDate] = useState(today())
  const [txPrice, setTxPrice] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txNote, setTxNote] = useState('')
  const [txKind, setTxKind] = useState<'buy' | 'sell'>('buy')
  const [busy, setBusy] = useState(false)

  const lastFive = [...investment.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  async function handleAdd() {
    const sign = txKind === 'buy' ? 1 : -1
    const price = Math.abs(Number(txPrice))
    const amount = Math.abs(Number(txAmount))
    setBusy(true)
    try {
      await onAddTransaction({
        date: txDate,
        units: sign * (price > 0 ? amount / price : 0),
        amount: sign * amount,
        note: txNote || null,
      })
      setTxPrice('')
      setTxAmount('')
      setTxNote('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Aportación — ${investment.name}`} size="md" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-line bg-surface2/50 px-3 py-2.5 text-sm">
          <span className="text-muted">
            {INVESTMENT_TYPE_LABELS[investment.type]} · Valor liquidativo actual: <Money value={investment.current_price} />
          </span>
          {onRefreshPrice && (
            <button type="button" disabled={busy} onClick={onRefreshPrice} className="text-xs font-medium text-fg underline hover:no-underline">
              Actualizar
            </button>
          )}
        </div>

        <div>
          <div className="mb-2 grid grid-cols-2 gap-2">
            {(['buy', 'sell'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTxKind(k)}
                className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                  txKind === k ? 'border-fg bg-surface2 text-fg' : 'border-line text-muted hover:text-fg'
                }`}
              >
                {k === 'buy' ? 'Aportación (compra)' : 'Venta'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <input required type="date" className="input" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
            <input required type="number" step="0.0001" min="0" placeholder="Precio de compra" className="input" value={txPrice} onChange={(e) => setTxPrice(e.target.value)} />
            <input required type="number" step="0.01" min="0" placeholder="Importe €" className="input" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} />
            <button type="button" disabled={busy || !txPrice || !txAmount} onClick={handleAdd} className="btn">
              + Añadir
            </button>
          </div>
          <p className="mt-1 text-xs text-faint">
            Participaciones = importe ÷ precio de compra{txPrice && txAmount ? ` ≈ ${(Number(txAmount) / Number(txPrice)).toFixed(4)}` : ''}
          </p>
          <input className="input mt-2" placeholder="Nota (opcional)" value={txNote} onChange={(e) => setTxNote(e.target.value)} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-fg">Últimas aportaciones</p>
          {lastFive.length === 0 ? (
            <p className="text-sm text-faint">Sin aportaciones todavía</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {lastFive.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-surface2">
                  <span className="text-muted">
                    {tx.date} · {tx.units > 0 ? '+' : ''}
                    {tx.units.toFixed(4)} uds · <Money value={tx.amount} />
                    {tx.note ? ` · ${tx.note}` : ''}
                  </span>
                  <button type="button" onClick={() => onRemoveTransaction(tx.id)} className="shrink-0 text-faint hover:text-red-600">
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
