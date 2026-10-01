import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import Money from './Money'
import CategoryIcon from './CategoryIcon'
import InfoHint from './InfoHint'

export interface DonutItem {
  key: string
  label: string
  amount: number
  color: string
  icon?: string // lucide name; omit for items with no category (e.g. account types)
  badge?: string // small annotation next to the label (e.g. "pasivo")
  targetPercent?: number
  group?: { key: string; label: string; icon?: string; color: string }
}

interface LegendRow {
  key: string
  label: string
  icon?: string
  color: string
  amount: number
  targetPercent?: number
  badge?: string
  ungroupedItemKey?: string
}

function buildLegendRows(items: DonutItem[]): LegendRow[] {
  if (!items.some((it) => it.group)) {
    return items
      .map((it) => ({
        key: it.key,
        ungroupedItemKey: it.key,
        label: it.label,
        icon: it.icon,
        color: it.color,
        amount: it.amount,
        targetPercent: it.targetPercent,
        badge: it.badge,
      }))
      .sort((a, b) => b.amount - a.amount)
  }
  const rows = new Map<string, LegendRow>()
  for (const it of items) {
    const g = it.group
    const key = g?.key ?? it.key
    const existing = rows.get(key)
    if (existing) {
      existing.amount += it.amount
      if (it.targetPercent !== undefined) existing.targetPercent = (existing.targetPercent ?? 0) + it.targetPercent
    } else {
      rows.set(key, {
        key,
        label: g?.label ?? it.label,
        icon: g?.icon ?? it.icon,
        color: g?.color ?? it.color,
        amount: it.amount,
        targetPercent: it.targetPercent,
      })
    }
  }
  return [...rows.values()].sort((a, b) => b.amount - a.amount)
}

const RADIAN = Math.PI / 180
// matches the fixed h-40 w-40 (160px) chart box below — donut center + its radius
const CENTER = 80
const OUTER_RADIUS = 80
const TOOLTIP_GAP = 14 // how far past the ring edge the tooltip sits

// Donut + legend, shared by every "breakdown" card in Análisis: a total in the
// center, one row per item with its share of that total. Color always follows
// the category/entity (never rank), so the same category reads the same
// everywhere in the app.
export default function DonutBreakdown({
  title,
  info,
  items,
  hideAmounts,
  onItemClick,
  legendBelow,
}: {
  title: string
  info?: string
  items: DonutItem[]
  hideAmounts?: boolean
  onItemClick?: (key: string) => void
  legendBelow?: boolean
}) {
  const total = items.reduce((s, i) => s + i.amount, 0)
  const blur = hideAmounts ? 'select-none blur-sm' : ''

  // hover tooltip position: projected outward from the ring, past its outer edge,
  // so it never sits over the center TOTAL — never toward the middle.
  const [hover, setHover] = useState<{ x: number; y: number; item: DonutItem } | null>(null)
  function handleEnter(sector: { midAngle?: number }, index: number) {
    const midAngle = sector.midAngle ?? 0
    const r = OUTER_RADIUS + TOOLTIP_GAP
    setHover({
      x: CENTER + r * Math.cos(-midAngle * RADIAN),
      y: CENTER + r * Math.sin(-midAngle * RADIAN),
      item: items[index],
    })
  }

  return (
    <div className="card flex h-full flex-col p-5">
      <div className="mb-4 flex shrink-0 items-center gap-1.5">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {info && <InfoHint text={info} />}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-faint">Sin datos para este periodo</div>
      ) : (
        <div className={`flex min-h-0 flex-1 gap-6 ${legendBelow ? 'flex-col items-center' : 'items-center'}`}>
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={items}
                  dataKey="amount"
                  nameKey="label"
                  innerRadius="72%"
                  outerRadius="100%"
                  paddingAngle={items.length > 1 ? 2 : 0}
                  stroke="none"
                  isAnimationActive={false}
                  onMouseEnter={(sector, index) => handleEnter(sector, index)}
                  onMouseLeave={() => setHover(null)}
                >
                  {items.map((it) => (
                    <Cell key={it.key} fill={it.color} cursor={onItemClick ? 'pointer' : undefined} onClick={() => onItemClick?.(it.key)} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-faint">Total</span>
              {/* CSS blur on this small overlay renders as fully invisible in some
              browsers (tested: filter:blur alone, not a stacking/z-index issue) —
              a solid placeholder sidesteps it instead of fighting the filter. */}
              {hideAmounts ? (
                <span className="h-[18px] w-16 rounded bg-surface2" />
              ) : (
                <span className="text-base font-semibold text-fg">
                  <Money value={total} />
                </span>
              )}
            </div>
            {/* projected outward from the ring (see handleEnter) so it never covers the center */}
            {hover && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg"
                style={{ left: hover.x, top: hover.y }}
              >
                <div className="font-medium text-fg">{hover.item.label}</div>
                <div className={`flex items-center gap-2 text-muted ${hideAmounts ? 'select-none blur-sm' : ''}`}>
                  <Money value={hover.item.amount} />
                  <span>{total > 0 ? Math.round((hover.item.amount / total) * 100) : 0}%</span>
                  {hover.item.targetPercent !== undefined && <span>obj. {hover.item.targetPercent.toFixed(0)}%</span>}
                </div>
              </div>
            )}
          </div>

          <div className={`min-w-0 space-y-2.5 overflow-y-auto ${legendBelow ? 'w-full' : 'flex-1'}`}>
            {buildLegendRows(items).map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => row.ungroupedItemKey && onItemClick?.(row.ungroupedItemKey)}
                disabled={!onItemClick || !row.ungroupedItemKey}
                className={`flex w-full items-center gap-2 text-left text-sm ${onItemClick && row.ungroupedItemKey ? 'transition hover:opacity-70' : ''}`}
              >
                {row.icon && (
                  <span className="shrink-0" style={{ color: row.color }}>
                    <CategoryIcon name={row.icon} size={14} />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-fg">
                  {row.label}
                  {row.badge && <span className="ml-1.5 text-xs font-normal text-faint">· {row.badge}</span>}
                </span>
                <span className={`num shrink-0 text-fg ${blur}`}>
                  <Money value={row.amount} />
                </span>
                <span className="w-10 shrink-0 text-right text-xs text-faint">
                  {total > 0 ? Math.round((row.amount / total) * 100) : 0}%
                </span>
                {row.targetPercent !== undefined && (
                  <span className="w-16 shrink-0 text-right text-xs text-faint">obj. {row.targetPercent.toFixed(0)}%</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
