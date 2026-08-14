import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  api,
  type AccountSnapshot,
  type BudgetVsActualItem,
  type Category,
  type DashboardSummary,
  type KpiName,
} from '../api'
import { isAccount } from '../categoryTypes'
import PeriodSelector from '../components/PeriodSelector'
import StatTile from '../components/StatTile'
import BudgetPanel from '../components/BudgetPanel'
import Money from '../components/Money'
import InfoHint from '../components/InfoHint'
import { EyeIcon, EyeOffIcon } from '../components/Icons'
import { useSettings, firstNameOf } from '../settings'
import { useHideAmounts, toggleHideAmounts } from '../hideAmounts'

const COLOR_PLANNED = '#0070f3'
const COLOR_ACTUAL = '#f5a623'
const COLOR_GOOD = '#16a34a'
const COLOR_CRITICAL = '#e5484d'
// theme-agnostic greys (work on light + dark card surfaces)
const GRID_COLOR = 'rgba(128,128,128,0.18)'
const AXIS_COLOR = '#9a9a9a'
const TRACK_COLOR = 'rgba(128,128,128,0.22)'

const MONTH_NAMES_LOWER = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const KPI_INFO = {
  income: 'Suma de movimientos desde una categoría de Ingreso hacia cualquier cuenta, en el periodo seleccionado. Solo cuenta si la categoría está marcada «Es ingreso». Solo movimientos Realizados (Done).',
  expense: 'Suma de movimientos desde cualquier cuenta hacia una categoría de Gasto — incluye pagos hechos directamente desde Ahorro o Inversión. Solo cuenta si la categoría está marcada «Es gasto». Solo movimientos Realizados (Done).',
  saving: 'Aportaciones menos retiradas de las cuentas con comportamiento Ahorro: suma cuando el dinero entra, resta cuando sale (a cualquier destino). Solo movimientos Realizados (Done).',
  investment: 'Aportaciones menos retiradas de las cuentas con comportamiento Inversión: suma cuando el dinero entra, resta cuando sale (a cualquier destino). Solo movimientos Realizados (Done).',
}

function GastosVsPresupuestoTile({
  expenses,
  budget,
  info,
  onClick,
}: {
  expenses: number
  budget: number
  info?: string
  onClick?: () => void
}) {
  const gastosColor = expenses <= budget ? COLOR_GOOD : COLOR_CRITICAL
  return (
    <button
      onClick={onClick}
      className="card p-5 text-left transition hover:border-faint hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-center gap-1.5">
        <span className="truncate text-xs font-medium text-muted">Gastos / Presupuesto</span>
        {info && <InfoHint text={info} />}
      </div>
      <div className="mt-2 break-words text-2xl font-semibold tracking-tight">
        <span style={{ color: gastosColor }}>
          <Money value={expenses} />
        </span>
        <span className="mx-1 text-faint">/</span>
        <span style={{ color: COLOR_PLANNED }}>
          <Money value={budget} />
        </span>
      </div>
    </button>
  )
}

export default function Panel() {
  const navigate = useNavigate()
  const hideAmounts = useHideAmounts()
  const { user_name } = useSettings()
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null)
  const [range, setRange] = useState({ from: '', to: '' })
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [items, setItems] = useState<BudgetVsActualItem[]>([])
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([])
  const [accountCategories, setAccountCategories] = useState<Category[]>([])

  function refreshAccounts() {
    api.accountValues.latest().then(setSnapshot)
  }

  useEffect(() => {
    refreshAccounts()
    api.categories.list().then((cats) => {
      // top-level only — subcategory spend rolls up into its parent's budget (backend does the same)
      setExpenseCategories(cats.filter((c) => c.type === 'expense' && c.parent_id === null))
      // aggregates count only accounts tagged "En total" (include_in_total), matching total_assets
      setAccountCategories(cats.filter((c) => isAccount(c.type) && c.include_in_total))
    })
  }, [])

  function refreshDashboard() {
    if (!range.from || !range.to) return
    api.dashboard.summary(range.from, range.to).then(setSummary)
    api.dashboard.budgetVsActual(range.from, range.to).then(setItems)
  }

  useEffect(refreshDashboard, [range])

  // budgets/account values are per calendar month — manage whichever month the selected period ends in
  const [targetYear, targetMonth] = range.to ? range.to.split('-').map(Number) : [0, 0]

  const balanceOf = (name: string) => snapshot?.items.find((i) => i.category === name)?.amount ?? 0
  // sum account balances grouped by account type ('ahorro'/'gasto'/'inversion')
  const sumByType = (type: string) =>
    accountCategories.filter((c) => c.type === type).reduce((s, c) => s + balanceOf(c.name), 0)

  function goToCategory(field: 'origin' | 'destination', category: string) {
    if (!range.from || !range.to) return
    navigate(`/movimientos?from=${range.from}&to=${range.to}&${field}=${encodeURIComponent(category)}`)
  }

  function goToKpi(kpi: KpiName) {
    if (!range.from || !range.to) return
    navigate(`/movimientos?from=${range.from}&to=${range.to}&kpi=${kpi}`)
  }

  const today = new Date()

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Hola {firstNameOf(user_name)}</h1>
        <button
          onClick={toggleHideAmounts}
          className="btn"
          aria-label={hideAmounts ? 'Mostrar importes' : 'Ocultar importes'}
          title={hideAmounts ? 'Mostrar importes' : 'Ocultar importes'}
        >
          {hideAmounts ? <EyeOffIcon /> : <EyeIcon />}
          {hideAmounts ? 'Mostrar importes' : 'Ocultar importes'}
        </button>
      </div>

      <p className="mb-6 mt-1 text-[15px] text-muted">
        A día {today.getDate()} de {MONTH_NAMES_LOWER[today.getMonth()]}, el valor total de tus
        activos monetarios es de:{' '}
        <span className="text-fg">
          <Money
            value={snapshot?.total_assets ?? 0}
            className={`text-lg font-semibold ${hideAmounts ? 'select-none blur-sm' : ''}`}
          />
        </span>
      </p>
      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatTile label="Disponible para gasto" value={sumByType('gasto')} blurred={hideAmounts} />
        <StatTile label="Ahorro" value={sumByType('ahorro')} blurred={hideAmounts} />
        <StatTile label="Inversión" value={sumByType('inversion')} blurred={hideAmounts} />
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold tracking-tight text-fg">En el periodo</h2>
        <PeriodSelector onChange={(from, to) => setRange({ from, to })} />
      </div>

      <div className="mb-8 grid grid-cols-4 items-start gap-4">
        <div>
          <StatTile
            label="Ingresos"
            value={summary?.total_income ?? 0}
            accent={COLOR_PLANNED}
            info={KPI_INFO.income}
            onClick={() => goToKpi('income')}
          />
          <p className="mt-1.5 px-1 text-xs text-faint">
            Activo <Money value={(summary?.total_income ?? 0) - (summary?.total_income_passive ?? 0)} /> · Pasivo{' '}
            <Money value={summary?.total_income_passive ?? 0} />
          </p>
        </div>
        {summary?.total_budget != null ? (
          <GastosVsPresupuestoTile
            expenses={summary.total_expenses}
            budget={summary.total_budget}
            info={KPI_INFO.expense}
            onClick={() => goToKpi('expense')}
          />
        ) : (
          <StatTile
            label="Gastos"
            value={summary?.total_expenses ?? 0}
            accent={COLOR_ACTUAL}
            info={KPI_INFO.expense}
            onClick={() => goToKpi('expense')}
          />
        )}
        <StatTile label="Ahorro" value={summary?.total_savings ?? 0} info={KPI_INFO.saving} onClick={() => goToKpi('saving')} />
        <StatTile label="Inversión" value={summary?.total_investments ?? 0} info={KPI_INFO.investment} onClick={() => goToKpi('investment')} />
      </div>

      <h2 className="mb-3 text-base font-semibold tracking-tight text-fg">Gasto por categoría</h2>
      <div className="card p-5">
        <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
          {targetYear > 0 && (
            <>
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted md:col-span-2">
                Presupuesto · {MONTH_NAMES_LOWER[targetMonth - 1]} {targetYear}
              </h3>
              <BudgetPanel
                year={targetYear}
                month={targetMonth}
                categories={expenseCategories}
                onSaved={refreshDashboard}
              />
            </>
          )}
          <div>
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-faint">Sin datos para este periodo</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(240, items.length * 44)}>
            <BarChart data={items} layout="vertical" barGap={2} barCategoryGap="30%">
              <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
              <YAxis
                type="category"
                dataKey="category"
                stroke={AXIS_COLOR}
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
                width={110}
                tick={(props) => {
                  const { x, y, payload } = props
                  return (
                    <text
                      x={x}
                      y={y}
                      dy={4}
                      textAnchor="end"
                      fontSize={12}
                      fill={AXIS_COLOR}
                      cursor="pointer"
                      onClick={() => goToCategory('destination', payload.value)}
                    >
                      {payload.value}
                    </text>
                  )
                }}
              />
              {/* hidden twin axis so the gasto bar overlaps the presupuesto track instead of grouping beside it */}
              <YAxis yAxisId="fg" type="category" dataKey="category" hide width={0} />
              <Tooltip
                cursor={false}
                formatter={(v: number) => v.toFixed(2)}
                contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
                labelStyle={{ color: 'var(--fg)' }}
                itemStyle={{ color: 'var(--fg)' }}
              />
              <Bar
                dataKey="planned"
                name="Presupuesto"
                fill={TRACK_COLOR}
                radius={[0, 4, 4, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />
              <Bar
                yAxisId="fg"
                dataKey="actual"
                name="Gasto"
                radius={[0, 4, 4, 0]}
                maxBarSize={12}
                cursor="pointer"
                onClick={(data: BudgetVsActualItem) => goToCategory('destination', data.category)}
              >
                {items.map((entry) => (
                  <Cell
                    key={entry.category}
                    fill={
                      summary?.total_budget != null
                        ? entry.actual <= entry.planned
                          ? COLOR_GOOD
                          : COLOR_CRITICAL
                        : COLOR_ACTUAL
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
          </div>
        </div>
      </div>
    </div>
  )
}
