import { useEffect, useMemo, useState } from 'react'
import {
  api,
  type Investment,
  type InvestmentInput,
  type InvestmentTransactionInput,
  type PortfolioCompositionItem,
  type PortfolioSummary,
} from '../api'
import { INVESTMENT_TYPE_ICONS, INVESTMENT_TYPE_LABELS, colorsByInvestedDescending } from '../investmentColors'
import InvestmentModal from '../components/InvestmentModal'
import ContributionModal from '../components/ContributionModal'
import InvestmentHistoryChart from '../components/InvestmentHistoryChart'
import StatTile from '../components/StatTile'
import Money from '../components/Money'
import DonutBreakdown, { type DonutItem } from '../components/DonutBreakdown'
import CategoryIcon from '../components/CategoryIcon'
import { useHideAmounts, toggleHideAmounts } from '../hideAmounts'
import { EyeIcon, EyeOffIcon, PencilIcon } from '../components/Icons'

export default function Inversion() {
  const hideAmounts = useHideAmounts()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [composition, setComposition] = useState<PortfolioCompositionItem[]>([])
  const [editing, setEditing] = useState<Investment | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [contributing, setContributing] = useState<Investment | null>(null)
  const [refreshingAll, setRefreshingAll] = useState(false)

  async function refresh() {
    const [inv, sum, comp] = await Promise.all([api.investments.list(), api.investments.summary(), api.investments.composition()])
    setInvestments(inv)
    setSummary(sum)
    setComposition(comp)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleSave(data: InvestmentInput) {
    if (editing) {
      await api.investments.update(editing.id, data)
    } else {
      await api.investments.create(data)
    }
    setShowModal(false)
    setEditing(null)
    await refresh()
  }

  async function handleDelete() {
    if (!editing) return
    if (!confirm('¿Eliminar esta inversión y sus aportaciones?')) return
    await api.investments.remove(editing.id)
    setShowModal(false)
    setEditing(null)
    await refresh()
  }

  async function handleAddTransaction(data: InvestmentTransactionInput) {
    if (!contributing) return
    const updated = await api.investments.addTransaction(contributing.id, data)
    setContributing(updated)
    await refresh()
  }

  async function handleRemoveTransaction(transactionId: number) {
    if (!contributing) return
    const updated = await api.investments.removeTransaction(contributing.id, transactionId)
    setContributing(updated)
    await refresh()
  }

  async function refreshPriceFor(id: number) {
    const result = await api.investments.refreshPrice(id)
    if (!result.ok) {
      alert(result.error ?? 'No se pudo actualizar el precio')
      return
    }
    await refresh()
    const updated = await api.investments.list()
    const found = updated.find((i) => i.id === id) ?? null
    if (editing?.id === id) setEditing(found)
    if (contributing?.id === id) setContributing(found)
  }

  async function handleRefreshAll() {
    setRefreshingAll(true)
    try {
      await api.investments.refreshAllPrices()
      await refresh()
    } finally {
      setRefreshingAll(false)
    }
  }

  const holdingColors = useMemo(() => colorsByInvestedDescending(investments), [investments])

  const donutItems: DonutItem[] = composition.map((c) => ({
    key: String(c.investment_id),
    label: c.name,
    amount: c.valor_actual,
    color: holdingColors[c.investment_id] ?? '#6b7280',
    icon: INVESTMENT_TYPE_ICONS[c.type],
    targetPercent: c.weight_target,
  }))

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Inversión</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleHideAmounts()}
            aria-label={hideAmounts ? 'Mostrar importes' : 'Ocultar importes'}
            title={hideAmounts ? 'Mostrar importes' : 'Ocultar importes'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-fg"
          >
            {hideAmounts ? <EyeOffIcon /> : <EyeIcon />}
          </button>
          <button onClick={handleRefreshAll} disabled={refreshingAll} className="btn">
            {refreshingAll ? 'Actualizando…' : 'Actualizar precios (FT)'}
          </button>
          <button
            onClick={() => {
              setEditing(null)
              setShowModal(true)
            }}
            className="btn-primary"
          >
            + Nueva inversión
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatTile label="Capital invertido" value={summary?.total_invertido ?? 0} blurred={hideAmounts} />
        <StatTile label="Valor actual" value={summary?.valor_actual ?? 0} blurred={hideAmounts} />
        <StatTile
          label="Plusvalía"
          value={summary?.plusvalia ?? 0}
          accent={summary && summary.plusvalia < 0 ? '#dc2626' : '#16a34a'}
          blurred={hideAmounts}
        />
        <div className="card block w-full overflow-hidden p-5">
          <span className="truncate text-xs font-medium text-muted">Rentabilidad</span>
          <div className={`mt-2 text-2xl font-semibold tracking-tight ${(summary?.rentabilidad ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {(summary?.rentabilidad ?? 0).toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <DonutBreakdown title="Composición real" items={donutItems} hideAmounts={hideAmounts} legendBelow />
        </div>
        <div className="col-span-2">
          <InvestmentHistoryChart hideAmounts={hideAmounts} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Nombre</th>
              <th>ISIN</th>
              <th className="text-right">Participaciones</th>
              <th className="text-right">Total invertido</th>
              <th className="text-right">Precio medio</th>
              <th className="text-right">Valor liquidativo</th>
              <th className="text-right">Valor de mercado</th>
              <th className="text-right">Plusvalía</th>
              <th className="text-right">Rentabilidad</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {investments.map((inv) => (
              <tr
                key={inv.id}
                onClick={() => setContributing(inv)}
                className={`cursor-pointer hover:bg-surface2 ${inv.active ? '' : 'opacity-50'}`}
              >
                <td>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: holdingColors[inv.id] }}>
                    <CategoryIcon name={INVESTMENT_TYPE_ICONS[inv.type]} size={14} />
                    {INVESTMENT_TYPE_LABELS[inv.type]}
                  </span>
                </td>
                <td className="font-medium text-fg">{inv.name}</td>
                <td className="text-muted">{inv.isin ?? '—'}</td>
                <td className="text-right num">{inv.stats.units_held}</td>
                <td className="text-right"><Money value={inv.stats.total_invertido} className={hideAmounts ? 'select-none blur-sm' : ''} /></td>
                <td className="text-right"><Money value={inv.stats.avg_cost} className={hideAmounts ? 'select-none blur-sm' : ''} /></td>
                <td className="text-right"><Money value={inv.current_price} className={hideAmounts ? 'select-none blur-sm' : ''} /></td>
                <td className="text-right"><Money value={inv.stats.valor_actual} className={hideAmounts ? 'select-none blur-sm' : ''} /></td>
                <td className={`text-right ${inv.stats.plusvalia < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  <Money value={inv.stats.plusvalia} className={hideAmounts ? 'select-none blur-sm' : ''} />
                </td>
                <td className={`text-right font-medium ${inv.stats.rentabilidad < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {inv.stats.rentabilidad.toFixed(2)}%
                </td>
                <td>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditing(inv)
                      setShowModal(true)
                    }}
                    aria-label="Editar inversión"
                    title="Editar inversión"
                    className="text-faint hover:text-fg"
                  >
                    <PencilIcon />
                  </button>
                </td>
              </tr>
            ))}
            {investments.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-faint">
                  Sin inversiones registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <InvestmentModal
          initial={editing}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          onRefreshPrice={editing && (editing.ft_symbol || editing.isin) ? () => refreshPriceFor(editing.id) : undefined}
        />
      )}

      {contributing && (
        <ContributionModal
          investment={contributing}
          onClose={() => setContributing(null)}
          onAddTransaction={handleAddTransaction}
          onRemoveTransaction={handleRemoveTransaction}
          onRefreshPrice={contributing.ft_symbol || contributing.isin ? () => refreshPriceFor(contributing.id) : undefined}
        />
      )}
    </div>
  )
}
