import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Investment, type InvestmentInput, type MarketFund, type InvestmentTransaction, type InvestmentTransactionInput } from '../api'
import { FundChart, store, stored, type RefKey } from '../components/InversionOportunidades'
import Money from '../components/Money'
import { PencilIcon, TrashIcon } from '../components/Icons'
import InvestmentModal from '../components/InvestmentModal'
import EditInvestmentTransactionModal from '../components/EditInvestmentTransactionModal'
import { useHideAmounts } from '../hideAmounts'
import PageHeader from '../components/PageHeader'

export const today = () => new Date().toISOString().slice(0, 10)
export const parseDecimal = (s: string) => Math.abs(Number((s || '0').replace(/,/g, '.')))

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
          <input
            required
            type="text"
            inputMode="decimal"
            placeholder="Importe €"
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input required type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <input
            required
            type="text"
            inputMode="decimal"
            placeholder="Saldo actual nuevo"
            className="input"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
          />
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
  const hideAmounts = useHideAmounts()
  const queryClient = useQueryClient()
  const { data: investments } = useQuery({ queryKey: ['investments'], queryFn: () => api.investments.list() })
  const investment: Investment | null = investments?.find((i) => i.id === Number(id)) ?? null
  const notFound = investments !== undefined && !investment
  // divisa en la que cotiza el fondo (ISIN:USD); el precio se guarda ya convertido a euros
  const quoteCurrency = (investment?.ft_symbol ?? investment?.isin)?.split(':')[1]?.toUpperCase()
  const converted = !!quoteCurrency && quoteCurrency !== 'EUR'
  const { data: fx } = useQuery({
    queryKey: ['fx', quoteCurrency],
    enabled: converted,
    staleTime: 5 * 60 * 1000,
    queryFn: () => api.investments.fxRate(quoteCurrency!),
  })
  const [editingTx, setEditingTx] = useState<InvestmentTransaction | null>(null)
  const [editingInvestment, setEditingInvestment] = useState(false)
  const navigate = useNavigate()
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.categories.list() })
  const { data: market } = useQuery({ queryKey: ['investments-market'], queryFn: () => api.investments.market() })
  const marketFund = market?.funds.find((f) => f.investment_id === Number(id))

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['investments'] })
  }

  async function handleSaveInvestment(data: InvestmentInput) {
    if (!investment) return
    await api.investments.update(investment.id, data)
    setEditingInvestment(false)
    await queryClient.invalidateQueries()
  }

  async function handleDeleteInvestment() {
    if (!investment) return
    await api.investments.remove(investment.id)
    await queryClient.invalidateQueries()
    navigate('/inversion')
  }

  async function handleRefreshPrice() {
    if (!investment) return
    const result = await api.investments.refreshPrice(investment.id)
    if (!result.ok) {
      alert(result.error ?? 'No se pudo actualizar el precio')
      return
    }
    await queryClient.invalidateQueries()
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

  async function handleUpdateTransaction(transactionId: number, data: InvestmentTransactionInput) {
    if (!investment) return
    await api.investments.updateTransaction(investment.id, transactionId, data)
    setEditingTx(null)
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
  const blur = hideAmounts ? 'select-none blur-sm' : ''
  const gainColor = investment.stats.plusvalia < 0 ? 'text-red-600' : 'text-emerald-600'
  // Same figures as the row in the Inversión tables; actual weight is relative to the
  // active holdings of the same type, as in the table.
  const sameType = (investments ?? []).filter((i) => i.active && i.type === investment.type)
  const typeTotal = sameType.reduce((sum, i) => sum + i.stats.valor_actual, 0)
  const showWeights = investment.type === 'fondo_inversion'

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col lg:min-h-0 lg:flex-1">
      <PageHeader crumbs={[{ label: 'Inversión', to: '/inversion' }, { label: investment.name }]}>
        <div className="ml-auto flex items-center gap-3">
          {investment.isin && <span className="num text-xs text-faint">{investment.isin}</span>}
          <button type="button" onClick={() => setEditingInvestment(true)} className="btn inline-flex items-center gap-1.5">
            <PencilIcon /> Editar
          </button>
        </div>
      </PageHeader>
      <div className="h-3.5" />

      <div className="grid grid-cols-1 gap-3.5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
        <div className="card flex min-h-0 flex-col p-5 lg:row-span-2">
          <p className="mb-2 text-sm font-medium text-fg">Histórico</p>
          {sorted.length === 0 ? (
            <p className="text-sm text-faint">Sin movimientos todavía</p>
          ) : (
            <div className="relative min-h-0 lg:flex-1">
              <ul className="max-h-[420px] space-y-1.5 overflow-y-auto text-sm lg:absolute lg:inset-0 lg:max-h-none">
                {sorted.map((tx) => (
                  <li
                    key={tx.id}
                    onClick={() => setEditingTx(tx)}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 hover:bg-surface2"
                  >
                    <span className="text-muted">
                      {tx.date} ·{' '}
                      {lumpSum
                        ? tx.kind === 'adjustment'
                          ? 'Ajuste de valor'
                          : tx.amount >= 0
                            ? 'Aportación'
                            : 'Retirada'
                        : `${tx.units > 0 ? '+' : ''}${tx.units.toLocaleString('es-ES', { maximumFractionDigits: 3 })} participaciones`}{' '}
                      · <Money value={tx.amount} />
                      {tx.note ? ` · ${tx.note}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveTransaction(tx.id)
                      }}
                      className="shrink-0 text-faint hover:text-red-600"
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="card p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-fg">Ficha</p>
            {investment.info_url && (
              <a
                href={investment.info_url}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-[60%] truncate text-xs font-medium text-muted transition hover:text-fg"
                title={investment.info_url}
              >
                {new URL(investment.info_url).hostname.replace(/^www\./, '')} ↗
              </a>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {!lumpSum && <Fact label="Participaciones">{investment.stats.units_held.toLocaleString('es-ES', { maximumFractionDigits: 3 })}</Fact>}
            <Fact label={lumpSum ? 'Total aportado' : 'Total invertido'}>
              <Money value={investment.stats.total_invertido} className={blur} />
            </Fact>
            {!lumpSum && (
              <Fact label="Precio medio">
                <Money value={investment.stats.avg_cost} className={blur} />
              </Fact>
            )}
            {!lumpSum && (
              <Fact label="Valor liquidativo">
                <Money value={investment.current_price} className={blur} />
              </Fact>
            )}
            {converted && (
              <Fact label={`Cambio ${quoteCurrency} → EUR`}>
                {fx ? `1 € = ${fx.rate.toLocaleString('es-ES', { maximumFractionDigits: 4 })} ${quoteCurrency}` : '—'}
              </Fact>
            )}
            <Fact label="Valor de mercado">
              <Money value={investment.stats.valor_actual} className={blur} />
            </Fact>
            {showWeights && <Fact label="Peso objetivo">{investment.target_weight.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%</Fact>}
            {showWeights && (
              <Fact label="Peso actual">{investment.active && typeTotal > 0 ? `${((investment.stats.valor_actual / typeTotal) * 100).toFixed(1)}%` : '—'}</Fact>
            )}
            <Fact label="Plusvalía" className={gainColor}>
              <Money value={investment.stats.plusvalia} className={blur} />
            </Fact>
            <Fact label="Rentabilidad" className={gainColor}>
              {investment.stats.rentabilidad.toFixed(2)}%
            </Fact>
          </div>
          {lumpSum && (
            <div className="mt-5 border-t border-line pt-4">
              <BalanceForm investment={investment} onAdd={handleAddTransaction} />
            </div>
          )}
        </div>
        {marketFund && <FundPriceChart fund={marketFund} />}
      </div>

      {editingInvestment && (
        <InvestmentModal
          initial={investment}
          accounts={(categories ?? []).filter((c) => c.type === 'inversion')}
          onClose={() => setEditingInvestment(false)}
          onSave={handleSaveInvestment}
          onDelete={handleDeleteInvestment}
          onRefreshPrice={investment.ft_symbol || investment.isin ? handleRefreshPrice : undefined}
        />
      )}

      {editingTx && (
        <EditInvestmentTransactionModal
          tx={editingTx}
          lumpSum={lumpSum}
          onClose={() => setEditingTx(null)}
          onSave={(data) => handleUpdateTransaction(editingTx.id, data)}
          onDelete={async () => {
            await handleRemoveTransaction(editingTx.id)
            setEditingTx(null)
          }}
        />
      )}
    </div>
  )
}

function Fact({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`num mt-1 text-lg font-semibold tracking-tight ${className ?? 'text-fg'}`}>{children}</div>
    </div>
  )
}

function FundPriceChart({ fund }: { fund: MarketFund }) {
  const [shown, setShown] = useState<Record<RefKey, boolean>>(() => stored('dip_lines', { all_time_high: true, avg_cost: true }))
  const [rangeLabel, setRangeLabel] = useState<string>(() => stored('dip_range', '1A'))
  useEffect(() => store('dip_lines', shown), [shown])
  useEffect(() => store('dip_range', rangeLabel), [rangeLabel])
  return (
    <div className="card flex min-w-0 flex-col">
      <FundChart fund={fund} shown={shown} setShown={setShown} rangeLabel={rangeLabel} setRangeLabel={setRangeLabel} />
    </div>
  )
}
