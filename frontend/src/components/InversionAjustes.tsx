import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Category } from '../api'
import { saveSettings, useSettings, type Settings } from '../settings'
import { Card } from './plan/fields'

type Key = 'investment_destination_account' | 'liquidity_account' | 'investment_reval_category' | 'investment_deval_category'

function AccountSelect({ label, value, onChange, accounts }: {
  label: string
  value: string
  onChange: (v: string) => void
  accounts: Category[]
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
    </label>
  )
}

export default function InversionAjustes({
  savingAccounts,
  allAccounts,
  incomeCategories,
  expenseCategories,
}: {
  savingAccounts: Category[]
  allAccounts: Category[]
  incomeCategories: Category[]
  expenseCategories: Category[]
}) {
  const queryClient = useQueryClient()
  const settings = useSettings()
  const [draft, setDraft] = useState<Partial<Record<Key, string>>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const value = (key: Key) => draft[key] ?? settings[key]
  const set = (key: Key) => (v: string) => setDraft((d) => ({ ...d, [key]: v }))
  const dirty = (Object.keys(draft) as Key[]).some((k) => draft[k] !== settings[k])

  async function save() {
    setSaving(true)
    setError(false)
    try {
      await saveSettings(draft as Partial<Settings>)
      await queryClient.invalidateQueries({ queryKey: ['investments-market'] })
      setDraft({})
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title="Ajustes"
      fill
      aside={
        dirty && (
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-600">No se pudo guardar</span>}
            <button type="button" onClick={() => setDraft({})} className="btn px-2.5 py-1 text-xs">
              Descartar
            </button>
            <button type="button" onClick={save} disabled={saving} className="btn-primary px-2.5 py-1 text-xs disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar ajustes'}
            </button>
          </div>
        )
      }
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        <AccountSelect label="Cuenta de destino (cartera)" value={value('investment_destination_account')} onChange={set('investment_destination_account')} accounts={allAccounts} />
        <AccountSelect label="Cuenta de liquidez" value={value('liquidity_account')} onChange={set('liquidity_account')} accounts={savingAccounts} />
        <AccountSelect label="Categoría de revalorización" value={value('investment_reval_category')} onChange={set('investment_reval_category')} accounts={incomeCategories} />
        <AccountSelect label="Categoría de devaluación" value={value('investment_deval_category')} onChange={set('investment_deval_category')} accounts={expenseCategories} />
      </div>
    </Card>
  )
}
