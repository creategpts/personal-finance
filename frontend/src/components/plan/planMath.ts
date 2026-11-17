import type { PlanAllocation, PlanData, PlanPhase } from '../../api'
import { MONTHS_SHORT, fmtEur0, fmtNum } from '../inicio/format'

const PHASE_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#db2777']
export const phaseColor = (i: number) => PHASE_COLORS[i % PHASE_COLORS.length]

export const EMPTY_PHASE: PlanPhase = { name: '', months: 12, contribution: 0, frequency: 'monthly', emergency_fund: 0, note: '', weight_tolerance: 2, allocation: [], dry_powder: 0, dips: [], reserve_tiers: [], initial_capital: 0, monthly_income: null, monthly_expense: null }

export interface PhaseRow {
  phase: PlanPhase
  start: number
  end: number
  monthly: number
  cumEnd: number
}

export const monthlyOf = (p: PlanPhase) => p.contribution * (p.frequency === 'biweekly' ? 2 : 1)

export function schedule(data: PlanData): PhaseRow[] {
  let at = 0
  let cum = 0
  return data.phases.map((phase) => {
    const monthly = monthlyOf(phase)
    cum += monthly * phase.months
    const row = { phase, start: Math.floor(at), end: Math.floor(at + phase.months), monthly, cumEnd: cum }
    at += phase.months
    return row
  })
}

export const totalMonths = (data: PlanData) => data.phases.reduce((s, p) => s + p.months, 0)
export const finalTotal = (data: PlanData) => schedule(data).at(-1)?.cumEnd ?? 0

export function offsetOf(data: PlanData, date = new Date()): number {
  const [y, m] = data.start_month.split('-').map(Number)
  return (date.getFullYear() - y) * 12 + (date.getMonth() + 1 - m)
}

export function monthLabel(data: PlanData, offset: number): string {
  const [y, m] = data.start_month.split('-').map(Number)
  const idx = y * 12 + (m - 1) + offset
  return `${MONTHS_SHORT[idx % 12]} ${Math.floor(idx / 12)}`
}

export function monthIso(data: PlanData, offset: number): string {
  const [y, m] = data.start_month.split('-').map(Number)
  const idx = y * 12 + (m - 1) + offset
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

export function expectedToDate(data: PlanData, date = new Date()): { index: number | null; expected: number; monthInPhase: number } {
  const now = offsetOf(data, date)
  let expected = 0
  let index: number | null = null
  let monthInPhase = 0
  for (const [i, r] of schedule(data).entries()) {
    expected += r.monthly * Math.max(0, Math.min(now, r.end) - r.start)
    if (now >= r.start && now < r.end) {
      index = i
      monthInPhase = now - r.start + 1
    }
  }
  return { index, expected, monthInPhase }
}

export interface Change {
  label: string
  before: string
  after: string
}

const money = (v: number | null) => (v == null ? '—' : fmtEur0(v))
const pct = (v: number | null) => (v == null ? '—' : `${fmtNum(v, v % 1 ? 2 : 0)} %`)
const text = (v: string) => v || '—'
const FREQ = { monthly: 'mensual', biweekly: 'quincenal' }

function flatten(data: PlanData): Map<string, string> {
  const f = new Map<string, string>([
    ['Resumen', text(data.summary)],
    ['Mes de inicio', data.start_month],
  ])
  data.phases.forEach((p, i) => {
    const k = `Fase ${i + 1}`
    f.set(`${k} · nombre`, text(p.name))
    f.set(`${k} · duración`, `${fmtNum(p.months, p.months % 1 ? 1 : 0)} meses`)
    f.set(`${k} · aportación`, `${fmtEur0(p.contribution)} ${FREQ[p.frequency]}`)
    f.set(`${k} · fondo de emergencia`, money(p.emergency_fund))
    f.set(`${k} · nota`, text(p.note))
    f.set(`${k} · capital inicial`, money(p.initial_capital))
    f.set(`${k} · ingresos mensuales`, money(p.monthly_income))
    f.set(`${k} · gastos mensuales`, money(p.monthly_expense))
    f.set(`${k} · tolerancia de pesos`, `±${fmtNum(p.weight_tolerance, 1)} pts`)
    f.set(`${k} · pólvora seca`, money(p.dry_powder ?? 0))
    f.set(`${k} · disparos`, (p.dips ?? []).length ? [...p.dips].sort((x, y) => x.drop - y.drop).map((d) => `−${fmtNum(d.drop, d.drop % 1 ? 1 : 0)} % → ${fmtEur0(d.amount)}`).join(', ') : '—')
    f.set(`${k} · ahorro a reservas`, (p.reserve_tiers ?? []).length ? [...p.reserve_tiers].sort((x, y) => x.below - y.below).map((t) => `<${fmtNum(t.below, t.below % 1 ? 1 : 0)} % → ${fmtEur0(t.amount)}/mes`).join(', ') : '—')
    for (const a of p.allocation) f.set(`${k} · peso ${a.name}`, pct(a.weight))
  })
  return f
}

export function diffPlans(before: PlanData | null, after: PlanData): Change[] {
  const a = before ? flatten(before) : new Map<string, string>()
  const b = flatten(after)
  const keys = [...new Set([...a.keys(), ...b.keys()])]
  return keys
    .map((label) => ({ label, before: a.get(label) ?? '—', after: b.get(label) ?? '—' }))
    .filter((c) => c.before !== c.after)
}

export const weightSum = (allocation: PlanAllocation[]) => allocation.reduce((s, a) => s + a.weight, 0)
export const weightsOff = (allocation: PlanAllocation[]) => allocation.length > 0 && Math.abs(weightSum(allocation) - 100) > 0.01
