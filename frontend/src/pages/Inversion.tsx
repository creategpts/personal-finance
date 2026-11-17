import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Investment, type InvestmentInput } from '../api'
import InvestmentModal from '../components/InvestmentModal'
import InversionDashboard from '../components/InversionDashboard'
import InversionOportunidades from '../components/InversionOportunidades'
import InversionDetalle from '../components/InversionDetalle'
import { useHideAmounts } from '../hideAmounts'
import PageHeader from '../components/PageHeader'

export default function Inversion() {
  const hideAmounts = useHideAmounts()
  const queryClient = useQueryClient()
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
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3.5">
      <PageHeader crumbs={[{ label: 'Inversión' }]}>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link to="/plan" className="btn">
            Plan de inversión
          </Link>
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
      </PageHeader>

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
      >
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
      </InversionDashboard>

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


    </div>
  )
}
