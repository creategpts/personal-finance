// 'income', 'expense', or one of ACCOUNT_TYPES — hence a plain string
export type CategoryType = string
// The three fixed account types — the single source of truth for account grouping.
export const ACCOUNT_TYPES = ['ahorro', 'gasto', 'inversion'] as const
export type AccountCategoryType = (typeof ACCOUNT_TYPES)[number]
export type MovementStatus = 'Plan' | 'Done'

export interface Category {
  id: number
  name: string
  type: CategoryType
  visible: boolean
  initial_balance: number
  include_in_total: boolean
  es_ingreso: boolean // income categories: counts toward income KPI
  es_gasto: boolean // expense categories: counts toward expense KPI
  es_pasivo: boolean // income categories: passive (interest/dividends) vs active (salary)
}

// create/update payload: only name+type required; the rest default server-side
export type CategoryInput = { name: string; type: CategoryType } & Partial<Omit<Category, 'id' | 'name' | 'type'>>

export interface Movement {
  id: number
  concept: string
  amount: number
  status: MovementStatus
  date: string
  year: number
  month: number
  week: number
  origin: string
  destination: string
}

export type MovementInput = Omit<Movement, 'id' | 'year' | 'month' | 'week'>

export interface AccountValueItem {
  category: string
  amount: number
}

export interface AccountSnapshot {
  date: string
  items: AccountValueItem[]
  total_assets: number
}

export interface DashboardSummary {
  total_income: number
  total_income_passive: number
  total_expenses: number
  total_savings: number
  total_investments: number
  total_budget: number | null
}

export interface BudgetVsActualItem {
  category: string
  planned: number
  actual: number
}

export interface NetWorthPoint {
  month: string // "YYYY-MM"
  total: number
  by_type: Record<string, number> // account_type key -> month-end balance
}

export interface MonthlyKpiPoint {
  month: string // "YYYY-MM"
  income: number
  expense: number
  saving: number
  investment: number
  budget: number
}

export interface BudgetItem {
  category: string
  amount: number
}

export type KpiName = 'income' | 'expense' | 'saving' | 'investment'

export type RecurrenceFrequency = 'monthly' | 'quarterly' | 'yearly'

export interface RecurringExpense {
  id: number
  concept: string
  amount: number
  origin: string
  destination: string
  frequency: RecurrenceFrequency
  next_due_date: string
  active: boolean
  auto_generate: boolean
}

export type RecurringExpenseInput = Omit<RecurringExpense, 'id'>

export type GoalType = 'fixed' | 'percent_income' | 'target_date'

export interface GoalTarget {
  id: number
  eff_year: number
  eff_month: number
  amount: number | null // fixed
  percent: number | null // percent_income (0-100)
  target_amount: number | null // target_date
  target_year: number | null
  target_month: number | null
}

export type GoalTargetInput = Partial<Omit<GoalTarget, 'id'>>

export interface Goal {
  id: number
  name: string
  account: string
  type: GoalType
  active: boolean
  start_year: number
  start_month: number
  targets: GoalTarget[]
}

export interface GoalCreateInput {
  name: string
  account: string
  type: GoalType
  active: boolean
  start_year: number
  start_month: number
  target: GoalTargetInput
}

export interface GoalProgressRow {
  year: number
  month: number
  target_month: number
  actual_month: number
  cum_target: number
  cum_actual: number
  on_track: boolean
  status: 'met' | 'failed' | 'open'
}

export interface GoalProgress {
  goal_id: number
  rows: GoalProgressRow[]
  completed: boolean
  meta: number | null // target_date: total-balance target
  deadline: string | null // target_date: "YYYY-MM"
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || `${options?.method ?? 'GET'} ${path} failed: ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  categories: {
    list: () => request<Category[]>('/categories'),
    create: (data: CategoryInput) =>
      request<Category>('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: CategoryInput) =>
      request<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/categories/${id}`, { method: 'DELETE' }),
  },
  movements: {
    list: (
      params: {
        year?: number
        month?: number
        status?: MovementStatus
        origin?: string
        destination?: string
        kpi?: KpiName
      } = {},
    ) => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
      ).toString()
      return request<Movement[]>(`/movements${qs ? `?${qs}` : ''}`)
    },
    create: (data: MovementInput) =>
      request<Movement>('/movements', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: MovementInput) =>
      request<Movement>(`/movements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/movements/${id}`, { method: 'DELETE' }),
    clear: () => request<void>('/movements', { method: 'DELETE' }),
  },
  accountValues: {
    latest: () => request<AccountSnapshot | null>('/account-values/latest'),
  },
  dashboard: {
    summary: (fromDate: string, toDate: string) =>
      request<DashboardSummary>(`/dashboard/summary?from_date=${fromDate}&to_date=${toDate}`),
    budgetVsActual: (fromDate: string, toDate: string) =>
      request<BudgetVsActualItem[]>(`/dashboard/budget-vs-actual?from_date=${fromDate}&to_date=${toDate}`),
    netWorth: (months: number) => request<NetWorthPoint[]>(`/dashboard/net-worth?months=${months}`),
    monthlySeries: (months: number) => request<MonthlyKpiPoint[]>(`/dashboard/monthly-series?months=${months}`),
  },
  budgets: {
    get: (year: number, month: number) =>
      request<BudgetItem[]>(`/budgets?year=${year}&month=${month}`),
    set: (year: number, month: number, items: BudgetItem[]) =>
      request<BudgetItem[]>(`/budgets?year=${year}&month=${month}`, {
        method: 'PUT',
        body: JSON.stringify({ items }),
      }),
    clear: (year: number, month: number) =>
      request<void>(`/budgets?year=${year}&month=${month}`, { method: 'DELETE' }),
  },
  recurring: {
    list: () => request<RecurringExpense[]>('/recurring'),
    create: (data: RecurringExpenseInput) =>
      request<RecurringExpense>('/recurring', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: RecurringExpenseInput) =>
      request<RecurringExpense>(`/recurring/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/recurring/${id}`, { method: 'DELETE' }),
  },
  goals: {
    list: () => request<Goal[]>('/goals'),
    create: (data: GoalCreateInput) =>
      request<Goal>('/goals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name: string; active: boolean }) =>
      request<Goal>(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    addTarget: (id: number, data: GoalTargetInput) =>
      request<Goal>(`/goals/${id}/targets`, { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/goals/${id}`, { method: 'DELETE' }),
    progress: (id: number) => request<GoalProgress>(`/goals/${id}/progress`),
  },
  settings: {
    get: () => request<Record<string, string>>('/settings'),
    set: (data: Record<string, string>) =>
      request<Record<string, string>>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
  backup: {
    list: () => request<{ dir: string; files: string[] }>('/backup'),
    create: () => request<{ file: string; counts: Record<string, number> }>('/backup', { method: 'POST' }),
    restore: (file: string) =>
      request<{ restored: Record<string, number> }>('/backup/restore', {
        method: 'POST',
        body: JSON.stringify({ file }),
      }),
  },
}
