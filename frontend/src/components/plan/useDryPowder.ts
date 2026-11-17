import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { drawdownOf, phaseSignal, syntheticIndex } from './dips'
import { expectedToDate } from './planMath'

export function useDryPowder() {
  const { data: plan = null } = useQuery({ queryKey: ['plan'], queryFn: () => api.plan.current() })
  const { data: market } = useQuery({ queryKey: ['investments-market'], queryFn: () => api.investments.market() })
  const phaseIndex = plan ? expectedToDate(plan.data).index : null
  const phase = plan && phaseIndex != null ? plan.data.phases[phaseIndex] : null
  const { data: shots = [] } = useQuery({ queryKey: ['dip-shots', phaseIndex], queryFn: () => api.plan.shots(phaseIndex ?? 0), enabled: phaseIndex != null })

  const planned = Math.max(0, (phase?.dry_powder ?? 0) - shots.reduce((s, x) => s + x.amount, 0))
  const free = market?.liquidity.available
  const remaining = free == null ? planned : Math.min(planned, Math.max(0, free))

  const funds = market?.funds ?? []
  const members = (phase?.allocation ?? []).filter((a) => a.weight > 0).map((a) => ({ ...a, fund: funds.find((f) => f.investment_id === a.investment_id) }))
  const index = syntheticIndex(members.flatMap((m) => (m.fund ? [{ weight: m.weight, points: m.fund.series }] : [])))
  const drawdown = drawdownOf(index)
  const peak = index.reduce((best, p) => (p.value > best.value ? p : best), index[0] ?? { date: '', value: 0 })
  const signal = phaseSignal(phase?.dips ?? [], drawdown, shots)

  return { phaseIndex, phase, shots, planned, remaining, members, drawdown, peak, signal, liquidity: market?.liquidity ?? null }
}

export function splitSavings(savings: number, reserve: number, powder: number) {
  const r = Math.min(Math.max(0, savings), reserve)
  const p = Math.min(savings - r, powder)
  return { reserve: r, powder: p, free: savings - r - p }
}
