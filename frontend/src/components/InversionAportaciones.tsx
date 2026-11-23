import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, type Investment, type InvestmentTransaction, type InvestmentTransactionInput } from '../api'
import { parseDecimal, today } from '../pages/InvestmentLedger'
import EditInvestmentTransactionModal from './EditInvestmentTransactionModal'
import Modal from './Modal'
import { COLOR_GOOD, fmtEur, shortDate } from './inicio/format'
import { Amount, PanelHeader } from './inicio/ui'

type Row = { tx: InvestmentTransaction; inv: Investment }

export default function InversionAportaciones({ investments, hide }: { investments: Investment[]; hide: boolean }) {
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)

  const all = investments
    .flatMap((inv) => inv.transactions.filter((tx) => tx.kind === 'flow').map((tx) => ({ tx, inv })))
    .sort((a, b) => (a.tx.date === b.tx.date ? b.tx.id - a.tx.id : a.tx.date < b.tx.date ? 1 : -1))
  const funds = [...investments].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))

  async function done() {
    setCreating(false)
    setEditing(null)
    await queryClient.invalidateQueries()
  }

  return (
    <section className="card flex min-w-0 flex-col overflow-hidden" aria-label="Últimas aportaciones">
      <PanelHeader title="Últimas aportaciones">
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={funds.length === 0}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primaryfg transition hover:opacity-90 disabled:opacity-50"
        >
          + Nueva
        </button>
      </PanelHeader>

      {all.length === 0 ? (
        <div className="flex h-[264px] items-center justify-center text-sm text-faint">Sin aportaciones registradas</div>
      ) : (
        <div className="relative min-h-0 xl:min-h-[260px] xl:flex-1">
          <ul className="max-h-[260px] divide-y divide-line overflow-y-auto xl:absolute xl:inset-0 xl:max-h-none">
            {all.map(({ tx, inv }) => (
              <li key={tx.id}>
                <button
                  type="button"
                  onClick={() => setEditing({ tx, inv })}
                  className="flex h-[52px] w-full items-center gap-3 px-4 text-left transition hover:bg-surface2/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">{inv.name}</span>
                    <span className="block truncate text-[11.5px] text-faint">
                      {shortDate(tx.date)} · {tx.amount >= 0 ? 'Compra' : 'Venta'}
                      {tx.units !== 0 &&
                        ` · ${Math.abs(tx.units).toLocaleString('es-ES', { maximumFractionDigits: 3 })} part. a ${fmtEur(Math.abs(tx.amount / tx.units))}`}
                    </span>
                  </span>
                  <Amount hide={hide} className="shrink-0 whitespace-nowrap text-sm font-medium">
                    <span style={tx.amount >= 0 ? { color: COLOR_GOOD } : { color: 'var(--muted)' }}>
                      {tx.amount >= 0 ? '+' : '−'}
                      {fmtEur(Math.abs(tx.amount))}
                    </span>
                  </Amount>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto flex gap-3 border-t border-line px-4 py-2 text-[11.5px] text-faint">
        <span>{all.length} operaciones</span>
      </div>

      {creating && (
        <QuickContributionModal
          funds={funds}
          onClose={() => setCreating(false)}
          onSave={async (id, data) => {
            await api.investments.addTransaction(id, data)
            await done()
          }}
        />
      )}
      {editing && (
        <EditInvestmentTransactionModal
          tx={editing.tx}
          lumpSum={editing.inv.type === 'seguros'}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            await api.investments.updateTransaction(editing.inv.id, editing.tx.id, data)
            await done()
          }}
          onDelete={async () => {
            if (!confirm('¿Eliminar esta operación?')) return
            await api.investments.removeTransaction(editing.inv.id, editing.tx.id)
            await done()
          }}
        />
      )}
    </section>
  )
}

function QuickContributionModal({
  funds,
  onClose,
  onSave,
}: {
  funds: Investment[]
  onClose: () => void
  onSave: (investmentId: number, data: InvestmentTransactionInput) => Promise<void>
}) {
  const [kind, setKind] = useState<'buy' | 'sell'>('buy')
  const [date, setDate] = useState(today())
  const [fundId, setFundId] = useState(funds[0]?.id ?? 0)
  const [price, setPrice] = useState(() => (funds[0]?.current_price ? String(funds[0].current_price) : ''))
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const lumpSum = funds.find((f) => f.id === fundId)?.type === 'seguros'
  const parsedPrice = parseDecimal(price)
  const parsedAmount = parseDecimal(amount)
  const valid = fundId > 0 && parsedAmount > 0 && (lumpSum || parsedPrice > 0)

  function pickFund(id: number) {
    setFundId(id)
    const fund = funds.find((f) => f.id === id)
    if (fund?.current_price) setPrice(String(fund.current_price))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const sign = kind === 'buy' ? 1 : -1
    setBusy(true)
    try {
      await onSave(fundId, { date, units: lumpSum ? 0 : (sign * parsedAmount) / parsedPrice, amount: sign * parsedAmount, kind: 'flow', note: null })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Registrar aportación"
      size="sm"
      onClose={onClose}
      onSubmit={handleSubmit}
      headerAction={
        <button type="submit" disabled={busy || !valid} className="btn-primary">
          Guardar
        </button>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(['buy', 'sell'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                kind === k ? 'border-fg bg-surface2 text-fg' : 'border-line text-muted hover:text-fg'
              }`}
            >
              {k === 'buy' ? 'Compra' : 'Venta'}
            </button>
          ))}
        </div>
        <label className="block text-xs text-muted">
          Fondo
          <select required className="input mt-1" value={fundId} onChange={(e) => pickFund(Number(e.target.value))}>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.active ? f.name : `${f.name} (inactiva)`}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          Fecha
          <input required type="date" className="input mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className={`grid gap-2 ${lumpSum ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {!lumpSum && (
            <label className="block text-xs text-muted">
              Precio de {kind === 'buy' ? 'compra' : 'venta'}
              <input required type="text" inputMode="decimal" className="input mt-1" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
          )}
          <label className="block text-xs text-muted">
            Importe €
            <input required autoFocus type="text" inputMode="decimal" className="input mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
        </div>
        {valid && !lumpSum && (
          <p className="num text-[11.5px] text-faint">{(parsedAmount / parsedPrice).toLocaleString('es-ES', { maximumFractionDigits: 3 })} participaciones</p>
        )}
      </div>
    </Modal>
  )
}
