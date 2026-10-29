import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Category } from '../api'
import { saveSettings, useSettings } from '../settings'
import { parseLevels } from './InversionOportunidades'
import Modal from './Modal'

function AccountSelect({ label, value, onChange, accounts, hint }: {
  label: string
  value: string
  onChange: (v: string) => void
  accounts: Category[]
  hint?: string
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Ninguna —</option>
        {accounts.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

// savingAccounts feeds the liquidity pick (Cuentas de ahorro); allAccounts the revalorization account.
export default function InversionAjustes({
  savingAccounts,
  allAccounts,
  incomeCategories,
  expenseCategories,
  onClose,
}: {
  savingAccounts: Category[]
  allAccounts: Category[]
  incomeCategories: Category[]
  expenseCategories: Category[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const settings = useSettings()
  const [liquidity, setLiquidity] = useState(settings.liquidity_account)
  const [emergency, setEmergency] = useState(settings.emergency_fund)
  const [levels, setLevels] = useState(settings.dip_levels)
  const [destination, setDestination] = useState(settings.investment_destination_account)
  const [revalCategory, setRevalCategory] = useState(
    settings.investment_reval_category || incomeCategories.find((c) => c.name === 'Revalorización')?.name || '',
  )
  const [devalCategory, setDevalCategory] = useState(
    settings.investment_deval_category || expenseCategories.find((c) => c.name === 'Devaluación')?.name || '',
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await saveSettings({
      liquidity_account: liquidity,
      emergency_fund: String(parseFloat(emergency.replace(',', '.')) || 0),
      dip_levels: parseLevels(levels).join(','),
      investment_destination_account: destination,
      investment_reval_category: revalCategory,
      investment_deval_category: devalCategory,
    })
    await queryClient.invalidateQueries({ queryKey: ['investments-market'] })
    onClose()
  }

  return (
    <Modal
      title="Ajustes de inversión"
      size="sm"
      onClose={onClose}
      onSubmit={handleSubmit}
      headerAction={
        <button type="submit" className="btn-primary">
          Guardar
        </button>
      }
    >
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-fg">Revalorización mensual</h3>
        <AccountSelect
          label="Cuenta de destino"
          value={destination}
          onChange={setDestination}
          accounts={allAccounts}
          hint="Cuenta donde se anota la plusvalía de la cartera: un Movimiento mensual fechado el día 29 (o el último día del mes). Las aportaciones las registras tú como Movimientos y el panel te las ofrece para asignarlas a los fondos. Sin cuenta y categorías no se crea."
        />
        <AccountSelect
          label="Categoría de revalorización (ingreso)"
          value={revalCategory}
          onChange={setRevalCategory}
          accounts={incomeCategories}
        />
        <AccountSelect
          label="Categoría de devaluación (gasto)"
          value={devalCategory}
          onChange={setDevalCategory}
          accounts={expenseCategories}
          hint="Cada mes se registra también la revalorización o devaluación que falta para que el saldo de la cuenta de destino coincida con el Valor actual del panel. Necesita las dos categorías."
        />

        <h3 className="pt-2 text-sm font-semibold text-fg">Oportunidades de compra</h3>
        <AccountSelect label="Cuenta de liquidez" value={liquidity} onChange={setLiquidity} accounts={savingAccounts} />
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Fondo de emergencia (€ que no se toca)</span>
          <input className="input" inputMode="decimal" value={emergency} onChange={(e) => setEmergency(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Niveles de caída (%), de menor a mayor</span>
          <input className="input" value={levels} onChange={(e) => setLevels(e.target.value)} placeholder="5, 10, 20" />
          <span className="mt-1 block text-xs text-faint">Atención → Comprar → Comprar fuerte, según la referencia elegida.</span>
        </label>
      </div>
    </Modal>
  )
}
