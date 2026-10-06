import { useState } from 'react'
import AnalisisGasto, { AnalisisGastoDonut } from '../components/AnalisisGasto'
import AnalisisIngreso from '../components/AnalisisIngreso'
import AnalisisPatrimonio from '../components/AnalisisPatrimonio'
import InversionPlan from '../components/InversionPlan'
import Modal from '../components/Modal'
import PeriodSelector from '../components/PeriodSelector'
import { useHideAmounts } from '../hideAmounts'

export default function Analisis() {
  const hideAmounts = useHideAmounts()
  const [tab, setTab] = useState<'flujo' | 'patrimonio'>('flujo')
  const [range, setRange] = useState({ from: '', to: '' })
  const [showPlan, setShowPlan] = useState(false)

  return (
    <div>
      <h1 className="mb-5 hidden text-2xl font-semibold tracking-tight md:block">Análisis</h1>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-0.5 rounded-lg border border-line bg-surface p-0.5">
          {([
            ['flujo', 'Gasto e ingreso'],
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
        {tab === 'patrimonio' && (
          <button onClick={() => setShowPlan(true)} className="btn">
            Plan de inversión
          </button>
        )}
      </div>

      {tab === 'flujo' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AnalisisIngreso hideAmounts={hideAmounts} range={range} />
            <AnalisisGastoDonut hideAmounts={hideAmounts} range={range} />
          </div>
          <div className="mt-8">
            <AnalisisGasto hideAmounts={hideAmounts} />
          </div>
        </>
      )}
      {tab === 'patrimonio' && <AnalisisPatrimonio hideAmounts={hideAmounts} />}

      {showPlan && (
        <Modal title="Plan de inversión a largo plazo · DCA quincenal automatizado" size="xl" onClose={() => setShowPlan(false)} bodyClassName="overflow-y-auto">
          <InversionPlan hideAmounts={hideAmounts} />
        </Modal>
      )}
    </div>
  )
}
