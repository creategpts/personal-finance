import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { api, type InvestmentType } from '../api'
import { isAccount } from '../categoryTypes'
import { INVESTMENT_TYPE_COLORS, INVESTMENT_TYPE_ICONS, INVESTMENT_TYPE_LABELS } from '../investmentColors'
import CategoryIcon from './CategoryIcon'
import InfoHint from './InfoHint'
import Money from './Money'

const COLOR_AHORRO = '#0ea5e9'
const COLOR_GOOD = '#16a34a'
const COLOR_CRITICAL = '#e5484d'
const INFO_PATRIMONIO = 'Saldo actual de tus cuentas de Ahorro (fondo de emergencia) y valor actual de tus inversiones, agrupado por tipo de activo, con el desglose de cada inversión. Solo cuentas incluidas en el patrimonio total.'

interface Holding {
  id: number
  name: string
  value: number
  plusvalia: number
  rentabilidad: number
  target: number
}

interface Slice {
  key: string
  label: string
  color: string
  icon?: string
  amount: number
  holdings: Holding[]
}

const sign = (v: number) => (v > 0 ? '+' : '')
const pct = (v: number, digits = 0) => `${v.toLocaleString('es-ES', { maximumFractionDigits: digits })}%`

// Patrimonio (ahorro + inversión): donut por tipo de activo y, al lado, el desglose de cada inversión.
export default function InicioPatrimonio({ hideAmounts }: { hideAmounts: boolean }) {
  const { data: snapshot = null } = useQuery({ queryKey: ['account-values', 'latest'], queryFn: () => api.accountValues.latest() })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.categories.list() })
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => api.investments.list() })
  const { data: composition = [] } = useQuery({ queryKey: ['investments-composition'], queryFn: () => api.investments.composition() })

  const balanceOf = (name: string) => snapshot?.items.find((i) => i.category === name)?.amount ?? 0
  const ahorro = categories
    .filter((c) => isAccount(c.type) && c.include_in_total && c.type === 'ahorro')
    .reduce((s, c) => s + balanceOf(c.name), 0)

  const slices = useMemo(() => {
    const byId = new Map(investments.map((i) => [i.id, i]))
    const byType = new Map<InvestmentType, Slice>()
    for (const c of composition) {
      if (c.valor_actual <= 0) continue
      const inv = byId.get(c.investment_id)
      const slice = byType.get(c.type) ?? {
        key: c.type,
        label: INVESTMENT_TYPE_LABELS[c.type],
        color: INVESTMENT_TYPE_COLORS[c.type],
        icon: INVESTMENT_TYPE_ICONS[c.type],
        amount: 0,
        holdings: [],
      }
      slice.amount += c.valor_actual
      slice.holdings.push({
        id: c.investment_id,
        name: c.name,
        value: c.valor_actual,
        plusvalia: inv?.stats.plusvalia ?? 0,
        rentabilidad: inv?.stats.rentabilidad ?? 0,
        target: c.weight_target,
      })
      byType.set(c.type, slice)
    }
    const result = [...byType.values()]
    for (const s of result) s.holdings.sort((a, b) => b.value - a.value)
    if (ahorro > 0) result.push({ key: 'ahorro', label: 'Fondo de emergencia', color: COLOR_AHORRO, amount: ahorro, holdings: [] })
    return result.sort((a, b) => b.amount - a.amount)
  }, [investments, composition, ahorro])

  const total = slices.reduce((s, x) => s + x.amount, 0)
  const share = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)
  const blur = hideAmounts ? 'select-none blur-sm' : ''

  return (
    <div className="card flex h-full flex-col p-5">
      <div className="mb-4 flex shrink-0 items-center gap-1.5">
        <h3 className="text-sm font-semibold text-fg">Patrimonio</h3>
        <InfoHint text={INFO_PATRIMONIO} />
      </div>

      {slices.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-faint">Sin datos</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="amount" nameKey="label" innerRadius="72%" outerRadius="100%" paddingAngle={slices.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
                  {slices.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-faint">Total</span>
              {hideAmounts ? (
                <span className="h-[18px] w-16 rounded bg-surface2" />
              ) : (
                <span className="text-base font-semibold text-fg">
                  <Money value={total} />
                </span>
              )}
            </div>
          </div>

          <div className="w-full min-w-0 space-y-4 sm:flex-1">
            {slices.map((s) => (
              <div key={s.key}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="shrink-0" style={{ color: s.color }}>
                    {s.icon ? <CategoryIcon name={s.icon} size={14} /> : <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-fg">{s.label}</span>
                  <span className={`num shrink-0 text-fg ${blur}`}>
                    <Money value={s.amount} />
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs text-faint">{share(s.amount)}%</span>
                </div>
                {s.holdings.map((h) => (
                  <div key={h.id} className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pl-6 text-xs">
                    <span className="min-w-0 flex-1 basis-40 truncate text-muted">{h.name}</span>
                    <span className={`num text-fg ${blur}`}>
                      <Money value={h.value} />
                    </span>
                    <span className="w-9 text-right text-faint">{share(h.value)}%</span>
                    <span className={`num w-28 text-right ${blur}`} style={{ color: h.plusvalia >= 0 ? COLOR_GOOD : COLOR_CRITICAL }}>
                      {sign(h.plusvalia)}
                      <Money value={h.plusvalia} /> ({sign(h.rentabilidad)}
                      {pct(h.rentabilidad, 1)})
                    </span>
                    <span className="w-14 text-right text-faint">{h.target > 0 ? `obj. ${pct(h.target)}` : ''}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
