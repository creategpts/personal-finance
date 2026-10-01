import type { Movement } from './api'

export interface GroupRow {
  kind: 'group'
  name: string
  members: Movement[]
  total: number
  from: string // earliest member date (ISO)
  to: string // latest member date (ISO)
}
export interface SingleRow {
  kind: 'single'
  m: Movement
}
export type Row = GroupRow | SingleRow

// A group's total reflects its net cost: expenses add, incoming money (income
// categories, e.g. a Bizum reimbursement) subtracts, and account<->account moves
// (traspasos entre cuentas propias) count 0 — they're internal, not a cost.
// catType maps a category name to its Category.type ('income'/'expense'/account type).
// Destination-expense wins first so paying an expense straight from an income
// category (Pluxee) still counts as spend.
function signedAmount(m: Movement, catType: Map<string, string>): number {
  if (catType.get(m.destination) === 'expense') return m.amount
  if (catType.get(m.origin) === 'income') return -m.amount
  return 0
}

// Cluster an already-sorted movement list: movements sharing a non-empty group_name
// collapse into one GroupRow, emitted at the position of the group's first member (so
// the group sits where the current sort would place its most-relevant member).
// Ungrouped movements pass through in place. Order is otherwise preserved.
export function buildRows(sorted: Movement[], catType: Map<string, string>): Row[] {
  const byName = new Map<string, Movement[]>()
  for (const m of sorted) {
    if (!m.group_name) continue
    const arr = byName.get(m.group_name)
    if (arr) arr.push(m)
    else byName.set(m.group_name, [m])
  }

  const rows: Row[] = []
  const emitted = new Set<string>()
  for (const m of sorted) {
    if (!m.group_name) {
      rows.push({ kind: 'single', m })
      continue
    }
    if (emitted.has(m.group_name)) continue
    emitted.add(m.group_name)
    const members = byName.get(m.group_name)!
    const dates = members.map((x) => x.date)
    rows.push({
      kind: 'group',
      name: m.group_name,
      members,
      total: members.reduce((s, x) => s + signedAmount(x, catType), 0),
      from: dates.reduce((a, b) => (a < b ? a : b)),
      to: dates.reduce((a, b) => (a > b ? a : b)),
    })
  }
  return rows
}
