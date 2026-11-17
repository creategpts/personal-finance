import type { KpiName } from '../../api'

export const COLOR_GOOD = '#16a34a'
export const COLOR_CRITICAL = '#e5484d'
export const COLOR_ACCENT = '#0070f3'
export const COLOR_AHORRO = '#0ea5e9'

export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const eur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const fmtEur = (v: number) => eur.format(v)
export const fmtEur0 = (v: number) => eur0.format(v)
export const fmtNum = (v: number, d = 1) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
export const fmtPct = (v: number, d = 0) => `${fmtNum(v, d)} %`
export const sgn = (v: number) => (v >= 0 ? '+' : '−')

// Filtro cruzado del inicio: un KPI o una categoría de gasto acotan la lista de movimientos.
export type CrossFilter = { kind: 'kpi'; kpi: KpiName } | { kind: 'category'; name: string } | null

// ---------- fechas / periodos ----------
const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const diffDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000)
const lastDayOf = (y: number, m: number) => new Date(y, m, 0).getDate() // m 1-based
export const shortDate = (s: string) => {
  const d = parseDate(s)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}
export const todayIso = () => isoDate(new Date())

// Nº de meses naturales completos que cubre el rango (null si no empieza el día 1 o no acaba a fin de mes).
export function monthSpan(from: string, to: string): number | null {
  const f = parseDate(from)
  const t = parseDate(to)
  if (f.getDate() !== 1 || t.getDate() !== lastDayOf(t.getFullYear(), t.getMonth() + 1)) return null
  return (t.getFullYear() - f.getFullYear()) * 12 + t.getMonth() - f.getMonth() + 1
}

// "YYYY-MM" de cada mes que toca el rango.
export function monthsIn(from: string, to: string): string[] {
  const out: string[] = []
  const t = parseDate(to)
  for (let d = parseDate(from); d <= t; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
  }
  return out
}

export function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number)
  return { from: `${ym}-01`, to: `${ym}-${pad(lastDayOf(y, m))}` }
}

// Periodo con el que comparar: los mismos meses justo antes (o los mismos días, si el rango es libre).
// Si el periodo está en curso, solo el tramo ya transcurrido (1–14 nov se compara con 1–14 oct).
export function previousRange(from: string, to: string): { from: string; to: string; label: string } {
  const f = parseDate(from)
  const t = parseDate(to)
  const span = monthSpan(from, to)
  let pf: Date
  let pt: Date
  if (span) {
    pf = new Date(f.getFullYear(), f.getMonth() - span, 1)
    pt = new Date(f.getFullYear(), f.getMonth(), 0)
  } else {
    pt = addDays(f, -1)
    pf = addDays(f, -(diffDays(f, t) + 1))
  }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let partial = false
  if (today >= f && today < t) {
    const cut = addDays(pf, diffDays(f, today))
    if (cut < pt) {
      pt = cut
      partial = true
    }
  }
  const pfs = isoDate(pf)
  const pts = isoDate(pt)
  const label = partial
    ? `vs ${pf.getMonth() === pt.getMonth() && pf.getFullYear() === pt.getFullYear() ? pf.getDate() : shortDate(pfs)}–${shortDate(pts)}`
    : span === 1
      ? `vs ${MONTHS_SHORT[pf.getMonth()]} ${pf.getFullYear()}`
      : 'vs periodo anterior'
  return { from: pfs, to: pts, label }
}
