import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type InvestmentInput } from '../api'
import InvestmentModal from '../components/InvestmentModal'
import InversionDashboard from '../components/InversionDashboard'
import InversionOportunidades from '../components/InversionOportunidades'
import InversionDetalle from '../components/InversionDetalle'
import InversionAportaciones from '../components/InversionAportaciones'
import DistributionCalculator from '../components/DistributionCalculator'
import { useHideAmounts } from '../hideAmounts'
import PageHeader from '../components/PageHeader'
import { PricesUpdatedAt } from '../marketSync'

export default function Inversion() {
  const hideAmounts = useHideAmounts()
  const queryClient = useQueryClient()
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => api.investments.list() })
  const { data: summary = null } = useQuery({ queryKey: ['investments-summary'], queryFn: () => api.investments.summary() })
  const { data: accountCheck = [] } = useQuery({ queryKey: ['investments-account-check'], queryFn: () => api.investments.accountCheck() })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.categories.list() })
  const investmentAccounts = categories.filter((c) => c.type === 'inversion')
  const [showModal, setShowModal] = useState(false)
  const [prefillAccount, setPrefillAccount] = useState<string | undefined>(undefined)

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['investments'] }),
      queryClient.invalidateQueries({ queryKey: ['investments-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['investments-composition'] }),
      queryClient.invalidateQueries({ queryKey: ['investments-account-check'] }),
    ])
  }

  async function handleSave(data: InvestmentInput) {
    await api.investments.create(data)
    setShowModal(false)
    setPrefillAccount(undefined)
    await refresh()
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3.5 xl:flex-1">
      <PageHeader crumbs={[{ label: 'Inversión' }]}>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PricesUpdatedAt className="mr-1" />
          <Link to="/plan" className="btn">
            Plan de inversión
          </Link>
          <button
            onClick={() => {
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
          setPrefillAccount(account)
          setShowModal(true)
        }}
      >
        <div className="grid gap-3.5 xl:flex-1 xl:grid-cols-4">
          <InversionAportaciones investments={investments} hide={hideAmounts} />
          <div className="flex min-w-0 flex-col gap-3.5 xl:col-span-3">
            <InversionDetalle investments={investments} hideAmounts={hideAmounts} />
            <InversionOportunidades hideAmounts={hideAmounts} />
            <DistributionCalculator hide={hideAmounts} />
          </div>
        </div>
      </InversionDashboard>

      {showModal && (
        <InvestmentModal
          initial={null}
          accounts={investmentAccounts}
          initialAccount={prefillAccount}
          onClose={() => {
            setShowModal(false)
            setPrefillAccount(undefined)
          }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
