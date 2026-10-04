import { useState } from 'react'
import AnalisisGasto from '../components/AnalisisGasto'
import AnalisisIngreso from '../components/AnalisisIngreso'
import AnalisisPatrimonio from '../components/AnalisisPatrimonio'
import PeriodSelector from '../components/PeriodSelector'
import { useHideAmounts } from '../hideAmounts'

export default function Analisis() {
  const hideAmounts = useHideAmounts()
  const [tab, setTab] = useState<'gasto' | 'ingreso' | 'patrimonio'>('gasto')
  const [range, setRange] = useState({ from: '', to: '' })

  return (
    <div>
      <h1 className="mb-5 hidden text-2xl font-semibold tracking-tight md:block">Análisis</h1>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-0.5 rounded-lg border border-line bg-surface p-0.5">
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

        {tab !== 'patrimonio' && <PeriodSelector fullWidth="mobile" onChange={(from, to) => setRange({ from, to })} />}
      </div>

      {tab === 'gasto' && <AnalisisGasto hideAmounts={hideAmounts} range={range} />}
      {tab === 'ingreso' && <AnalisisIngreso hideAmounts={hideAmounts} range={range} />}
      {tab === 'patrimonio' && <AnalisisPatrimonio hideAmounts={hideAmounts} />}
    </div>
  )
}
