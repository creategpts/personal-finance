import type { AccountCategoryType } from './api'

// The three fixed account types and their display label. Category.type IS the
// account type — no separate table, no behavior indirection.
export interface AccountTypeMeta {
  key: AccountCategoryType
  label: string
}

export const ACCOUNT_TYPES: AccountTypeMeta[] = [
  { key: 'gasto', label: 'Efectivo' },
  { key: 'ahorro', label: 'Ahorro' },
  { key: 'inversion', label: 'Inversión' },
]

// label for a category type ('income'/'expense' fall back to a fixed label)
export function typeLabel(key: string): string {
  if (key === 'income') return 'Ingreso'
  if (key === 'expense') return 'Gasto'
  return ACCOUNT_TYPES.find((t) => t.key === key)?.label ?? key
}
