import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Investment, type InvestmentInput } from '../api'
import InvestmentModal from '../components/InvestmentModal'
import InversionDashboard from '../components/InversionDashboard'
import InversionDetalle from '../components/InversionDetalle'
import InversionPlan from '../components/InversionPlan'
import Modal from '../components/Modal'
import { useHideAmounts } from '../hideAmounts'

export default function Inversion() {
  const hideAmounts = useHideAmounts()
  const queryClient = useQueryClient()
  const [showPlan, setShowPlan] = useState(false)
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => api.investments.list() })
  const { data: summary = null } = useQuery({ queryKey: ['investments-summary'], queryFn: () => api.investments.summary() })
  const { data: accountCheck = [] } = useQuery({ queryKey: ['investments-account-check'], queryFn: () => api.investments.accountCheck() })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.categories.list() })
  const investmentAccounts = categories.filter((c) => c.type === 'inversion')
  const [editing, setEditing] = useState<Investment | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [prefillAccount, setPrefillAccount] = useState<string | undefined>(undefined)
  const [refreshingAll, setRefreshingAll] = useState(false)

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['investments'] }),
      queryClient.invalidateQueries({ queryKey: ['investments-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['investments-composition'] }),
      queryClient.invalidateQueries({ queryKey: ['investments-account-check'] }),
    ])
  }

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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="hidden text-2xl font-semibold tracking-tight md:block">Inversión</h1>

        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <button onClick={() => setShowPlan(true)} className="btn">
            Plan de inversión
          </button>
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
        </div>
      </div>

      <InversionDashboard
        investments={investments}
        summary={summary}
        accountCheck={accountCheck}
        hideAmounts={hideAmounts}
        onAssigned={refresh}
        onCreateForAccount={(account) => {
          setEditing(null)
          setPrefillAccount(account)
          setShowModal(true)
        }}
      />

      <div className="mt-8">
        <InversionDetalle
          investments={investments}
          hideAmounts={hideAmounts}
          onEditInvestment={(inv) => {
            setEditing(inv)
            setShowModal(true)
          }}
        />
      </div>

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
