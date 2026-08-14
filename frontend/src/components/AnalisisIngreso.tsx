import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type CategoryBreakdownItem } from '../api'
import PeriodSelector from './PeriodSelector'
import DonutBreakdown, { type DonutItem } from './DonutBreakdown'

const INFO_INCOME = 'Ingreso por categoría en el periodo. Solo cuenta si la categoría está marcada «Es ingreso». Solo movimientos Realizados (Done).'

export default function AnalisisIngreso({ hideAmounts }: { hideAmounts: boolean }) {
  const navigate = useNavigate()
  const [range, setRange] = useState({ from: '', to: '' })
  const [incomeItems, setIncomeItems] = useState<CategoryBreakdownItem[]>([])

  useEffect(() => {
    if (!range.from || !range.to) return
    api.dashboard.breakdown(range.from, range.to, 'income').then(setIncomeItems)
  }, [range])

  function goToCategory(category: string) {
    if (!range.from || !range.to) return
    navigate(`/movimientos?from=${range.from}&to=${range.to}&origin=${encodeURIComponent(category)}`)
  }

  const incomeDonut: DonutItem[] = incomeItems.map((it) => ({
    key: it.category,
    label: it.category,
    amount: it.amount,
    color: it.color,
    icon: it.icon,
    badge: it.es_pasivo ? 'pasivo' : undefined,
  }))

  return (
    <div>
      <div className="mb-5">
        <PeriodSelector onChange={(from, to) => setRange({ from, to })} />
      </div>

      <div className="max-w-2xl">
        <DonutBreakdown
          title="De dónde viene el dinero"
          info={INFO_INCOME}
          items={incomeDonut}
          hideAmounts={hideAmounts}
          onItemClick={goToCategory}
        />
      </div>
    </div>
  )
}
