import { Info } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { BudgetVsActualItem, Category } from '../../api'
import CategoryIcon from '../CategoryIcon'
import { COLOR_CRITICAL, COLOR_GOOD, fmtEur0, fmtNum, fmtPct } from './format'
import { Amount } from './ui'

interface Props {
  items: BudgetVsActualItem[]
  catByName: Map<string, Category>
  hide: boolean
  selected: string | null
  onSelect: (category: string) => void
  periods?: Period[]
}

export interface Period {
  key: string
  label: string
  ratio: (category: string | null) => number | null
}

interface Slice extends BudgetVsActualItem {
  color: string
}

interface Arc {
  key: string
  slice: Slice | null
  value: number
  strong: boolean
}

function arcsOf(slices: Slice[], planned: number): Arc[] {
  const gap = planned * 0.008
  return slices.flatMap((s) => {
    const spent = Math.min(s.actual, s.planned)
    return [
      { key: `${s.category}-spent`, slice: s, value: spent, strong: true },
      { key: `${s.category}-left`, slice: s, value: s.planned - spent, strong: false },
      { key: `${s.category}-gap`, slice: null, value: slices.length > 1 ? gap : 0, strong: false },
    ]
  })
}

function SliceTooltip({ active, payload, hide }: { active?: boolean; payload?: { payload: Arc }[]; hide: boolean }) {
  const s = active ? payload?.[0]?.payload.slice : undefined
  if (!s) return null
  return (
    <div className="whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg">
      <div className="font-medium text-fg">{s.category}</div>
      <div className="num text-muted">
        <Amount hide={hide}>{fmtEur0(s.actual)}</Amount> de <Amount hide={hide}>{fmtEur0(s.planned)}</Amount> · {fmtPct((s.actual / s.planned) * 100)}
      </div>
    </div>
  )
}

const HEAT_HELP = 'Cada celda: gasto del mes en % de su presupuesto. Verde ≤ 100 (dentro), rojo > 100 (por encima). 0 = presupuesto sin gasto; · = sin presupuesto ese mes. Total = todo el periodo.'

function heatBg(r: number) {
  return r > 1
    ? `color-mix(in srgb, ${COLOR_CRITICAL} ${Math.min(62, 30 + (r - 1) * 130)}%, var(--surface))`
    : `color-mix(in srgb, ${COLOR_GOOD} ${Math.round(12 + r * 26)}%, var(--surface))`
}

function HeatCell({ ratio, title }: { ratio: number | null; title: string }) {
  return (
    <span
      className="num flex h-6 items-center justify-center rounded-sm text-[11px] text-fg"
      style={{ background: ratio == null ? 'transparent' : heatBg(ratio) }}
      title={ratio == null ? 'Sin presupuesto' : `${title}: ${fmtPct(ratio * 100)}`}
    >
      {ratio == null ? <span className="text-faint">·</span> : fmtNum(ratio * 100, 0)}
    </span>
  )
}

function Totals({ actual, planned, hide }: { actual: number; planned: number; hide: boolean }) {
  const used = actual / planned
  return (
    <>
      <span className="num whitespace-nowrap text-right text-xs text-muted">
        <Amount hide={hide}>{fmtEur0(actual)}</Amount> / <Amount hide={hide}>{fmtEur0(planned)}</Amount>
      </span>
      <span className="num text-right text-xs font-medium" style={{ color: used > 1 ? COLOR_CRITICAL : COLOR_GOOD }}>
        {fmtPct(used * 100)}
      </span>
    </>
  )
}

export default function BudgetDonut({ items, catByName, hide, selected, onSelect, periods = [] }: Props) {
  const slices: Slice[] = items.map((i) => ({ ...i, color: catByName.get(i.category)?.color ?? 'var(--faint)' }))
  const spent = slices.reduce((s, i) => s + i.actual, 0)
  const planned = slices.reduce((s, i) => s + i.planned, 0)
  const arcs = arcsOf(slices, planned)
  const dim = (category: string) => selected != null && selected !== category
  const wide = periods.length > 0
  const ring = periods.length < 12
  const row = `grid items-center px-2 text-sm ${wide ? 'gap-x-1' : 'gap-x-2'}`
  const cols = wide ? `minmax(96px,1.6fr) 112px 44px repeat(${periods.length}, minmax(26px, ${ring ? '48px' : '1fr'}))` : 'minmax(110px,1fr) auto 44px'

  return (
    <div className={`flex h-full items-center px-4 ${wide ? 'gap-3' : 'gap-5'}`}>
      {ring && (
      <div className={`relative shrink-0 ${wide ? 'h-[136px] w-[136px]' : 'h-[184px] w-[184px]'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={arcs}
              dataKey="value"
              nameKey="key"
              innerRadius="74%"
              outerRadius="100%"
              stroke="none"
              isAnimationActive={false}
            >
              {arcs.map(({ key, slice, strong }) => (
                <Cell
                  key={key}
                  fill={slice?.color ?? 'transparent'}
                  fillOpacity={(strong ? 1 : 0.28) * (slice && dim(slice.category) ? 0.35 : 1)}
                  cursor={slice ? 'pointer' : undefined}
                  onClick={() => slice && onSelect(slice.category)}
                />
              ))}
            </Pie>
            <Tooltip content={<SliceTooltip hide={hide} />} isAnimationActive={false} wrapperStyle={{ zIndex: 20 }} allowEscapeViewBox={{ x: true, y: true }} />
          </PieChart>
        </ResponsiveContainer>
        <div className={`num pointer-events-none absolute inset-0 grid grid-rows-[1fr_auto_1fr] justify-items-center gap-1 whitespace-nowrap ${wide ? 'text-sm' : 'text-lg'}`}>
          <Amount hide={hide} className="self-end font-semibold text-fg">
            {fmtEur0(spent)}
          </Amount>
          <span className="leading-none text-muted">-</span>
          <Amount hide={hide} className="self-start text-muted">
            {fmtEur0(planned)}
          </Amount>
        </div>
      </div>
      )}
      <div className="max-h-full min-w-0 flex-1 overflow-auto">
        {periods.length > 0 && (
          <div className={`${row} sticky top-0 z-10 bg-surface py-1 text-[10.5px] uppercase tracking-wider text-faint`} style={{ gridTemplateColumns: cols }}>
            <span
              tabIndex={0}
              role="img"
              aria-label={HEAT_HELP}
              title={HEAT_HELP}
              className="inline-flex w-fit cursor-help text-faint hover:text-fg"
            >
              <Info size={13} />
            </span>
            <span className="col-span-2 text-right">Total</span>
            {periods.map((p) => (
              <span key={p.key} className="text-center">
                {p.label}
              </span>
            ))}
          </div>
        )}
        <ul className="divide-y divide-line">
          {slices.map((s) => {
            const cat = catByName.get(s.category)
            return (
              <li key={s.category}>
                <button
                  type="button"
                  onClick={() => onSelect(s.category)}
                  title="Ver sus movimientos en la lista"
                  className={`${row} w-full py-1.5 text-left transition hover:bg-surface2/60 ${selected === s.category ? 'bg-surface2' : ''} ${dim(s.category) ? 'opacity-50' : ''}`}
                  style={{ gridTemplateColumns: cols }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0" style={{ color: s.color }}>
                      {cat?.icon ? <CategoryIcon name={cat.icon} size={14} /> : <i className="block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />}
                    </span>
                    <span className="truncate text-fg">{s.category}</span>
                  </span>
                  <Totals actual={s.actual} planned={s.planned} hide={hide} />
                  {periods.map((p) => (
                    <HeatCell key={p.key} ratio={p.ratio(s.category)} title={`${s.category} · ${p.key}`} />
                  ))}
                </button>
              </li>
            )
          })}
          {periods.length > 0 && (
            <li className={`${row} sticky bottom-0 bg-surface py-1.5 font-semibold`} style={{ gridTemplateColumns: cols }}>
              <span className="text-fg">Total</span>
              <Totals actual={spent} planned={planned} hide={hide} />
              {periods.map((p) => (
                <HeatCell key={p.key} ratio={p.ratio(null)} title={`Total · ${p.key}`} />
              ))}
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
