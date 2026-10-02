import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Investment, type InvestmentTransactionInput } from '../api'
import { INVESTMENT_TYPE_LABELS } from '../investmentColors'
import Money from '../components/Money'
import { TrashIcon } from '../components/Icons'
import HoldingHistoryChart from '../components/HoldingHistoryChart'
import { useHideAmounts } from '../hideAmounts'

const today = () => new Date().toISOString().slice(0, 10)
const parseDecimal = (s: string) => Math.abs(Number((s || '0').replace(/,/g, '.')))

function FundForm({ onAdd }: { onAdd: (data: InvestmentTransactionInput) => Promise<void> }) {
  const [kind, setKind] = useState<'buy' | 'sell'>('buy')
  const [date, setDate] = useState(today())
  const [price, setPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const parsedPrice = parseDecimal(price)
  const parsedAmount = parseDecimal(amount)

  async function handleAdd() {
    const sign = kind === 'buy' ? 1 : -1
    setBusy(true)
    try {
      await onAdd({
        date,
        units: sign * (parsedPrice > 0 ? parsedAmount / parsedPrice : 0),
        amount: sign * parsedAmount,
        kind: 'flow',
        note: note || null,
      })
      setPrice('')
      setAmount('')
      setNote('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        {(['buy', 'sell'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
              kind === k ? 'border-fg bg-surface2 text-fg' : 'border-line text-muted hover:text-fg'
            }`}
          >
            {k === 'buy' ? 'Aportación (compra)' : 'Venta'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input required type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        <input required type="text" inputMode="decimal" placeholder="Precio de compra" className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input required type="text" inputMode="decimal" placeholder="Importe €" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <input className="input mt-2" placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" disabled={busy || !(parsedPrice > 0) || !(parsedAmount > 0)} onClick={handleAdd} className="btn-primary mt-2 w-full">
        + Añadir
      </button>
    </div>
  )
}

function BalanceForm({ investment, onAdd }: { investment: Investment; onAdd: (data: InvestmentTransactionInput) => Promise<void> }) {
  const [mode, setMode] = useState<'flow' | 'adjustment'>('flow')
  const [flowKind, setFlowKind] = useState<'buy' | 'sell'>('buy')
  const [date, setDate] = useState(today())
  const [amount, setAmount] = useState('')
  const [newBalance, setNewBalance] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const parsedAmount = parseDecimal(amount)
  const parsedBalance = Number((newBalance || '').replace(/,/g, '.'))
  const delta = parsedBalance - investment.stats.valor_actual
  const valid = mode === 'flow' ? parsedAmount > 0 : newBalance !== '' && !Number.isNaN(parsedBalance)

  async function handleAdd() {
    setBusy(true)
    try {
      if (mode === 'flow') {
        const sign = flowKind === 'buy' ? 1 : -1
        await onAdd({ date, units: 0, amount: sign * parsedAmount, kind: 'flow', note: note || null })
        setAmount('')
      } else {
        await onAdd({ date, units: 0, amount: delta, kind: 'adjustment', note: note || null })
        setNewBalance('')
      }
      setNote('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-2">
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

      {mode === 'flow' ? (
        <div className="grid grid-cols-3 gap-2">
          <select className="input" value={flowKind} onChange={(e) => setFlowKind(e.target.value as 'buy' | 'sell')}>
            <option value="buy">Aportación</option>
            <option value="sell">Retirada</option>
          </select>
          <input required type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <input required type="text" inputMode="decimal" placeholder="Importe €" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input required type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <input required type="text" inputMode="decimal" placeholder="Saldo actual nuevo" className="input" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} />
        </div>
      )}
      {mode === 'adjustment' && newBalance !== '' && !Number.isNaN(parsedBalance) && (
        <p className="mt-1.5 text-xs text-muted">
          Ajuste: <Money value={delta} /> frente al valor actual
        </p>
      )}
      <input className="input mt-2" placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" disabled={busy || !valid} onClick={handleAdd} className="btn-primary mt-2 w-full">
        + Añadir
      </button>
    </div>
  )
}

export default function InvestmentLedger() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const hideAmounts = useHideAmounts()
  const queryClient = useQueryClient()
  const { data: investments } = useQuery({ queryKey: ['investments'], queryFn: () => api.investments.list() })
  const investment: Investment | null = investments?.find((i) => i.id === Number(id)) ?? null
  const notFound = investments !== undefined && !investment

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['investments'] })
  }

  async function handleAddTransaction(data: InvestmentTransactionInput) {
    if (!investment) return
    await api.investments.addTransaction(investment.id, data)
    await refresh()
  }

  async function handleRemoveTransaction(transactionId: number) {
    if (!investment) return
    await api.investments.removeTransaction(investment.id, transactionId)
    await refresh()
  }

  async function handleRefreshPrice() {
    if (!investment) return
    await api.investments.refreshPrice(investment.id)
    await refresh()
  }

  if (notFound) {
    return (
      <div>
        <p className="text-sm text-muted">Inversión no encontrada.</p>
        <Link to="/inversion" className="text-sm font-medium underline">
          Volver a Inversión
        </Link>
      </div>
    )
  }
  if (!investment) return null

  const lumpSum = investment.type === 'seguros'
  const sorted = [...investment.transactions].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div>
      <button type="button" onClick={() => navigate('/inversion')} className="mb-4 text-sm font-medium text-muted hover:text-fg">
        ← Volver a Inversión
      </button>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">{investment.name}</h1>

      <div className="mb-5 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <div className="card h-full space-y-5 p-5">
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface2/50 px-3 py-2.5 text-sm">
            <span className="text-muted">
              {INVESTMENT_TYPE_LABELS[investment.type]}
              {!lumpSum && (
                <>
                  {' '}· Valor liquidativo actual: <Money value={investment.current_price} />
                </>
              )}
            </span>
            {!lumpSum && (investment.ft_symbol || investment.isin) && (
              <button type="button" onClick={handleRefreshPrice} className="text-xs font-medium text-fg underline hover:no-underline">
                Actualizar
              </button>
            )}
          </div>

          {lumpSum ? (
            <BalanceForm investment={investment} onAdd={handleAddTransaction} />
          ) : (
            <FundForm onAdd={handleAddTransaction} />
          )}
        </div>

        <HoldingHistoryChart investmentId={investment.id} transactionCount={investment.transactions.length} hideAmounts={hideAmounts} />
      </div>

      <div className="card p-5">
        <p className="mb-2 text-sm font-medium text-fg">Histórico</p>
        {sorted.length === 0 ? (
          <p className="text-sm text-faint">Sin movimientos todavía</p>
        ) : (
          <ul className="max-h-96 space-y-1.5 overflow-y-auto text-sm">
            {sorted.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-surface2">
                <span className="text-muted">
                  {tx.date} ·{' '}
                  {lumpSum
                    ? tx.kind === 'adjustment'
                      ? 'Ajuste de valor'
                      : tx.amount >= 0
                        ? 'Aportación'
                        : 'Retirada'
                    : `${tx.units > 0 ? '+' : ''}${tx.units.toFixed(4)} participaciones`}{' '}
                  · <Money value={tx.amount} />
                  {tx.note ? ` · ${tx.note}` : ''}
                </span>
                <button type="button" onClick={() => handleRemoveTransaction(tx.id)} className="shrink-0 text-faint hover:text-red-600">
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
