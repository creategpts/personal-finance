import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Investment, type InvestmentInput } from '../api'
import InvestmentModal from '../components/InvestmentModal'
import InversionDashboard from '../components/InversionDashboard'
import InversionOportunidades from '../components/InversionOportunidades'
import InversionDetalle from '../components/InversionDetalle'
import InversionPlan from '../components/InversionPlan'
import InversionAjustes from '../components/InversionAjustes'
import Modal from '../components/Modal'
import { useHideAmounts } from '../hideAmounts'

export default function Inversion() {
  const hideAmounts = useHideAmounts()
  const queryClient = useQueryClient()
  const [showPlan, setShowPlan] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => api.investments.list() })
  const { data: summary = null } = useQuery({ queryKey: ['investments-summary'], queryFn: () => api.investments.summary() })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.categories.list() })
  const investmentAccounts = categories.filter((c) => c.type === 'inversion')
  const allAccounts = categories.filter((c) => c.type === 'ahorro' || c.type === 'gasto' || c.type === 'inversion')
  const [editing, setEditing] = useState<Investment | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [refreshingAll, setRefreshingAll] = useState(false)

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['investments'] }),
      queryClient.invalidateQueries({ queryKey: ['investments-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['investments-composition'] }),
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
    await refresh()
  }

  async function handleDelete() {
    if (!editing) return
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
          <button onClick={() => setShowSettings(true)} className="btn">
            Ajustes
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

      <InversionDashboard summary={summary} hideAmounts={hideAmounts} />

      <div className="mt-8">
        <InversionOportunidades
          syncIds={investments.filter((i) => i.active && i.type !== 'seguros' && i.type !== 'roboadvisor' && (i.ft_symbol || i.isin)).map((i) => i.id)}
          hideAmounts={hideAmounts}
        />
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
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          onRefreshPrice={editing && (editing.ft_symbol || editing.isin) ? () => refreshPriceFor(editing.id) : undefined}
        />
      )}

      {showSettings && (
        <InversionAjustes
          savingAccounts={categories.filter((c) => c.type === 'ahorro')}
          allAccounts={allAccounts}
          incomeCategories={categories.filter((c) => c.type === 'income')}
          expenseCategories={categories.filter((c) => c.type === 'expense')}
          onClose={() => setShowSettings(false)}
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
