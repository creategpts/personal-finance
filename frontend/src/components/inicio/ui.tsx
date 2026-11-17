import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { COLOR_ACCENT } from './format'

// ---------- piezas de UI ----------
export function Sparkline({ values, color = COLOR_ACCENT, height = 24 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return <div style={{ height }} />
  const w = 200
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, height - 3 - ((v - min) / (max - min || 1)) * (height - 6)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
      <path d={`M${last[0]} ${last[1]} h0.01`} stroke={color} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// Cabecera de panel: el enlace de la derecha es la puerta a la sección completa (no hay sidebar).
export function PanelHeader({ title, to, linkLabel, children }: { title: ReactNode; to?: string; linkLabel?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-line px-4 py-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
      <div className="flex items-center gap-3">
        {children}
        {to && (
          <Link to={to} className="text-xs font-medium text-muted transition hover:text-fg">
            {linkLabel} →
          </Link>
        )}
      </div>
    </div>
  )
}

export function Amount({ children, hide, className = '' }: { children: ReactNode; hide: boolean; className?: string }) {
  return <span className={`num ${hide ? 'select-none blur-sm' : ''} ${className}`}>{children}</span>
}
