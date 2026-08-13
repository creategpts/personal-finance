import { useEffect, useRef, useState } from 'react'
import { api, type Category } from '../api'

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

interface Props {
  year: number
  month: number
  categories: Category[] // expense categories
  onSaved: () => void
}

// Always-visible budget editor (left of the chart). Rows sorted by saved budget, desc.
export default function BudgetPanel({ year, month, categories, onSaved }: Props) {
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, number>>({}) // sort key; set on load only (no reorder while typing)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setLoading(true)
    api.budgets.get(year, month).then((items) => {
      const strs: Record<string, string> = {}
      const nums: Record<string, number> = {}
      for (const it of items) {
        strs[it.category] = String(it.amount)
        nums[it.category] = it.amount
      }
      setAmounts(strs)
      setSaved(nums)
      setLoading(false)
    })
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [year, month])

  async function doSave(next: Record<string, string>) {
    setSaving(true)
    try {
      const items = categories
        .map((c) => ({ category: c.name, amount: Number(next[c.name] || 0) }))
        .filter((it) => it.amount > 0)
      await api.budgets.set(year, month, items)
      // refresh sort key so the list re-orders mayor→menor by saved budget
      setSaved(Object.fromEntries(items.map((it) => [it.category, it.amount])))
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  // autosave 600ms after the last keystroke
  function update(name: string, value: string) {
    const next = { ...amounts, [name]: value }
    setAmounts(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(next), 600)
  }

  async function copyPreviousMonth() {
    const { year: py, month: pm } = prevMonth(year, month)
    const items = await api.budgets.get(py, pm)
    const next: Record<string, string> = {}
    for (const it of items) next[it.category] = String(it.amount)
    setAmounts(next)
    doSave(next)
  }

  const sorted = [...categories].sort((a, b) => (saved[b.name] ?? 0) - (saved[a.name] ?? 0))
  const hasBudget = Object.values(amounts).some((v) => Number(v) > 0)

  return (
    <div>
      {loading ? (
        <div className="py-8 text-center text-sm text-faint">Cargando…</div>
      ) : (
        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {sorted.map((c) => (
            <label key={c.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-muted">{c.name}</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                className="num w-24 shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1 text-right text-fg outline-none transition focus:border-faint focus:ring-4 focus:ring-fg/10"
                value={amounts[c.name] ?? ''}
                onChange={(e) => update(c.name, e.target.value)}
              />
            </label>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!loading && !hasBudget && (
          <button type="button" onClick={copyPreviousMonth} className="btn">
            Copiar mes anterior
          </button>
        )}
        {saving && <span className="text-xs text-faint">Guardando…</span>}
      </div>
    </div>
  )
}
