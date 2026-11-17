export interface Dip {
  drop: number
  amount: number
}

export interface FiredShot {
  drop: number
  amount: number
}

export interface WeightedSeries {
  weight: number
  points: { date: string; price: number }[]
}

export const assignedAmount = (dips: Dip[]) => dips.reduce((s, d) => s + d.amount, 0)

export function syntheticIndex(funds: WeightedSeries[]): { date: string; value: number }[] {
  const used = funds.filter((f) => f.weight > 0 && f.points.length > 0)
  const totalWeight = used.reduce((s, f) => s + f.weight, 0)
  if (totalWeight <= 0) return []
  const start = used.map((f) => f.points[0].date).reduce((a, b) => (a > b ? a : b))
  const prices = used.map((f) => new Map(f.points.map((p) => [p.date, p.price])))
  const dates = [...new Set(used.flatMap((f) => f.points.map((p) => p.date)))].filter((d) => d >= start).sort()
  const last = used.map((f) => [...f.points].reverse().find((p) => p.date <= start)?.price ?? f.points[0].price)
  const out = [{ date: dates[0], value: 100 }]
  for (const date of dates.slice(1)) {
    let r = 0
    used.forEach((f, i) => {
      const p = prices[i].get(date) ?? last[i]
      r += (f.weight / totalWeight) * (p / last[i] - 1)
      last[i] = p
    })
    out.push({ date, value: out[out.length - 1].value * (1 + r) })
  }
  return out
}

export function drawdownOf(index: { value: number }[]): number | null {
  if (index.length === 0) return null
  const peak = Math.max(...index.map((p) => p.value))
  return Math.max(0, (1 - index[index.length - 1].value / peak) * 100)
}

export interface PhaseSignal {
  pending: Dip[]
  pendingAmount: number
  next: Dip | null
}

export function phaseSignal(dips: Dip[], drawdown: number | null, fired: FiredShot[]): PhaseSignal {
  const sorted = [...dips].sort((a, b) => a.drop - b.drop)
  const dd = drawdown ?? 0
  const pending = sorted.filter((d) => dd >= d.drop && !fired.some((f) => f.drop === d.drop))
  return { pending, pendingAmount: pending.reduce((s, d) => s + d.amount, 0), next: sorted.find((d) => d.drop > dd) ?? null }
}

export interface ReserveTier {
  below: number
  amount: number
}

export function reserveShare(tiers: ReserveTier[], drawdown: number | null, gap: number, payment: number, paymentsPerMonth: number): number {
  if (drawdown == null) return 0
  const tier = [...tiers].sort((a, b) => a.below - b.below).find((t) => drawdown < t.below)
  return tier ? Math.max(0, Math.min(tier.amount / paymentsPerMonth, gap, payment)) : 0
}
