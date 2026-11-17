import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { reserveShare } from './dips'
import { splitContribution } from './split'
import { useDryPowder } from './useDryPowder'

export function useNextContribution() {
  const { phase, planned, drawdown, liquidity } = useDryPowder()
  const { data: composition = [] } = useQuery({ queryKey: ['investments-composition'], queryFn: () => api.investments.composition() })
  const funds = composition.filter((c) => c.weight_target > 0)
  const contribution = phase?.contribution ?? 0
  const reserveGap = Math.max(0, (phase?.emergency_fund ?? 0) + planned - (liquidity?.balance ?? Infinity))
  const toReserves = phase ? reserveShare(phase.reserve_tiers ?? [], drawdown, reserveGap, contribution, phase.frequency === 'biweekly' ? 2 : 1) : 0
  const amount = contribution - toReserves
  const split = splitContribution(
    funds.map((c) => ({ id: c.investment_id, value: c.valor_actual, target: c.weight_target })),
    amount,
  )
  return { funds, amount, toReserves, reserveGap, drawdown, split }
}
