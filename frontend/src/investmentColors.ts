import type { Investment, InvestmentType } from './api'

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  fondo_indexado: 'Fondo indexado',
  fondo_inversion: 'Fondo de inversión',
  criptomoneda: 'Criptomoneda',
  mmpp: 'Metales preciosos',
}

export const INVESTMENT_TYPE_COLORS: Record<InvestmentType, string> = {
  fondo_indexado: '#2563eb',
  fondo_inversion: '#7c3aed',
  criptomoneda: '#f59e0b',
  mmpp: '#ca8a04',
}

export const INVESTMENT_TYPE_ICONS: Record<InvestmentType, string> = {
  fondo_indexado: 'TrendingUp',
  fondo_inversion: 'PieChart',
  criptomoneda: 'Bitcoin',
  mmpp: 'Gem',
}

const MAX_LIGHTEN = 0.65

function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * t)
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

export function colorsByInvestedDescending(investments: Investment[]): Record<number, string> {
  const byType = new Map<InvestmentType, Investment[]>()
  for (const inv of investments) {
    const group = byType.get(inv.type) ?? []
    group.push(inv)
    byType.set(inv.type, group)
  }

  const colors: Record<number, string> = {}
  for (const [type, group] of byType) {
    const sorted = [...group].sort((a, b) => b.stats.total_invertido - a.stats.total_invertido)
    sorted.forEach((inv, i) => {
      const t = sorted.length > 1 ? (i / (sorted.length - 1)) * MAX_LIGHTEN : 0
      colors[inv.id] = lighten(INVESTMENT_TYPE_COLORS[type], t)
    })
  }
  return colors
}
