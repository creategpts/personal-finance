export interface Holding {
  id: number
  value: number
  target: number
}

export function splitContribution(holdings: Holding[], amount: number): Map<number, number> {
  const total = holdings.reduce((s, h) => s + h.value, 0) + amount
  const gaps = holdings.map((h) => Math.max(0, (total * h.target) / 100 - h.value))
  const sum = gaps.reduce((s, g) => s + g, 0)
  return new Map(holdings.map((h, i) => [h.id, sum > 0 ? (amount * gaps[i]) / sum : (amount * h.target) / 100]))
}

export function rebalance(holdings: Holding[]): Map<number, number> {
  const total = holdings.reduce((s, h) => s + h.value, 0)
  const targetSum = holdings.reduce((s, h) => s + h.target, 0)
  return new Map(holdings.map((h) => [h.id, targetSum > 0 ? (total * h.target) / targetSum - h.value : 0]))
}
