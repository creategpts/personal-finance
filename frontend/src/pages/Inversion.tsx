import { useEffect, useState } from 'react'
import {
  api,
  type AccountCheckItem,
  type Category,
  type Investment,
  type InvestmentInput,
  type PortfolioCompositionItem,
  type PortfolioSummary,
} from '../api'
import InvestmentModal from '../components/InvestmentModal'
import InversionDashboard from '../components/InversionDashboard'
import InversionDetalle from '../components/InversionDetalle'
import InversionPlan from '../components/InversionPlan'
import Modal from '../components/Modal'
import { useHideAmounts } from '../hideAmounts'

export default function Inversion() {
  const hideAmounts = useHideAmounts()
  const [showPlan, setShowPlan] = useState(true)
  const [tab, setTab] = useState<'dashboard' | 'detalle'>('dashboard')
  const [investments, setInvestments] = useState<Investment[]>([])
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [composition, setComposition] = useState<PortfolioCompositionItem[]>([])
  const [investmentAccounts, setInvestmentAccounts] = useState<Category[]>([])
  const [accountCheck, setAccountCheck] = useState<AccountCheckItem[]>([])
  const [editing, setEditing] = useState<Investment | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [prefillAccount, setPrefillAccount] = useState<string | undefined>(undefined)
  const [refreshingAll, setRefreshingAll] = useState(false)

  async function refresh() {
    const [inv, sum, comp, check] = await Promise.all([
      api.investments.list(),
      api.investments.summary(),
      api.investments.composition(),
      api.investments.accountCheck(),
    ])
    setInvestments(inv)
    setSummary(sum)
    setComposition(comp)
    setAccountCheck(check)
  }

  useEffect(() => {
    refresh()
    api.categories.list().then((cats) => setInvestmentAccounts(cats.filter((c) => c.type === 'inversion')))
  }, [])

  async function handleSave(data: InvestmentInput) {
    if (editing) {
      await api.investments.update(editing.id, data)
    } else {
      await api.investments.create(data)
    }
    setShowModal(false)
    setEditing(null)
    setPrefillAccount(undefined)
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

  async function refreshPriceFor(id: number) {
    const result = await api.investments.refreshPrice(id)
    if (!result.ok) {
      alert(result.error ?? 'No se pudo actualizar el precio')
      return
    }
    await refresh()
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

  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Inversión</h1>

      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="inline-flex gap-0.5 rounded-lg border border-line bg-surface p-0.5">
          {([
            ['dashboard', 'Dashboard'],
            ['detalle', 'Detalle'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === key ? 'bg-primary text-primaryfg' : 'text-muted hover:text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {tab === 'detalle' && (
            <>
              <button onClick={handleRefreshAll} disabled={refreshingAll} className="btn">
                {refreshingAll ? 'Actualizando…' : 'Actualizar precios (FT)'}
              </button>
              <button
                onClick={() => {
                  setEditing(null)
                  setPrefillAccount(undefined)
                  setShowModal(true)
                }}
                className="btn-primary"
              >
                + Nueva inversión
              </button>
            </>
          )}
        </div>
      </div>

      {tab === 'dashboard' && (
        <InversionDashboard
          investments={investments}
          summary={summary}
          composition={composition}
          accountCheck={accountCheck}
          hideAmounts={hideAmounts}
          onAssigned={refresh}
          onCreateForAccount={(account) => {
            setEditing(null)
            setPrefillAccount(account)
            setShowModal(true)
          }}
        />
      )}
      {tab === 'detalle' && (
        <InversionDetalle
          investments={investments}
          hideAmounts={hideAmounts}
          onEditInvestment={(inv) => {
            setEditing(inv)
            setShowModal(true)
          }}
        />
      )}

      {showModal && (
        <InvestmentModal
          initial={editing}
          accounts={investmentAccounts}
          initialAccount={prefillAccount}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
            setPrefillAccount(undefined)
          }}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          onRefreshPrice={editing && (editing.ft_symbol || editing.isin) ? () => refreshPriceFor(editing.id) : undefined}
        />
      )}

      {showPlan && (
        <Modal title="Plan de inversión a largo plazo · DCA quincenal automatizado" size="xl" onClose={() => setShowPlan(false)} bodyClassName="overflow-y-auto">
          <InversionPlan hideAmounts={hideAmounts} />
        </Modal>
      )}
    </div>
  )
}
