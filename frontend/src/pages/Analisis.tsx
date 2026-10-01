import { useState } from 'react'
import AnalisisGasto from '../components/AnalisisGasto'
import AnalisisIngreso from '../components/AnalisisIngreso'
import AnalisisPatrimonio from '../components/AnalisisPatrimonio'
import { useHideAmounts } from '../hideAmounts'

export default function Analisis() {
  const hideAmounts = useHideAmounts()
  const [tab, setTab] = useState<'gasto' | 'ingreso' | 'patrimonio'>('gasto')

  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Análisis</h1>

      <div className="mb-5 inline-flex gap-0.5 rounded-lg border border-line bg-surface p-0.5">
        {([
          ['gasto', 'Gasto'],
          ['ingreso', 'Ingreso'],
          ['patrimonio', 'Patrimonio'],
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

      {tab === 'gasto' && <AnalisisGasto hideAmounts={hideAmounts} />}
      {tab === 'ingreso' && <AnalisisIngreso hideAmounts={hideAmounts} />}
      {tab === 'patrimonio' && <AnalisisPatrimonio hideAmounts={hideAmounts} />}
    </div>
  )
}
