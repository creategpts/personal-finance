import type { ReactNode } from 'react'
import type { DashboardSummary, KpiName } from '../../api'
import { COLOR_CRITICAL, COLOR_GOOD, type CrossFilter, fmtEur0, fmtNum, fmtPct, sgn } from './format'
import { Amount } from './ui'

interface Props {
  summary: DashboardSummary | null
  prev: DashboardSummary | null
  prevLabel: string
  hide: boolean
  filter: CrossFilter
  onKpi: (kpi: KpiName) => void
}

const rateOf = (s: DashboardSummary | null) => (s && s.total_income > 0 ? (s.total_income - s.total_expenses) / s.total_income : null)

function Delta({ text, good, label }: { text: string; good: boolean; label: string }) {
  return (
    <div className="num flex flex-wrap gap-x-2 text-[11.5px]">
      <span style={{ color: good ? COLOR_GOOD : COLOR_CRITICAL }}>{text}</span>
      <span className="text-faint">{label}</span>
    </div>
  )
}

function Tile({ label, delta, active, onClick, children }: { label: string; delta?: ReactNode; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
      aria-pressed={active}
      title="Filtrar los movimientos por este concepto"
      className={`min-w-0 cursor-pointer border-line border-b last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 px-4 pb-3 pt-3.5 text-left transition hover:bg-surface2/60 ${active ? 'bg-surface2 shadow-[inset_0_-2px_0_var(--color-accent)]' : ''}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
        {delta}
      </div>
      {children}
    </div>
  )
}

const arrow = (v: number, unit: string) => `${v >= 0 ? '▲' : '▼'} ${fmtNum(Math.abs(v))}${unit}`
const dpct = (c: number, p: number | undefined) => (p ? ((c - p) / p) * 100 : null)

export default function Kpis({ summary, prev, prevLabel, hide, filter, onKpi }: Props) {
  const income = summary?.total_income ?? 0
  const expenses = summary?.total_expenses ?? 0
  const budget = summary?.total_budget ?? null
  const rate = rateOf(summary)
  const prevRate = rateOf(prev)
  const dI = dpct(income, prev?.total_income)
  const dE = dpct(expenses, prev?.total_expenses)
  const isKpi = (k: KpiName) => filter?.kind === 'kpi' && filter.kpi === k


  const over = budget != null && expenses > budget
  const used = budget ? expenses / budget : 0

  const big = 'num mt-1.5 whitespace-nowrap text-2xl font-semibold tracking-tight text-fg'

  return (
    <section className="card grid grid-cols-1 overflow-hidden sm:grid-cols-3" aria-label="Cifras del periodo">
      <Tile label="Ingresos" delta={dI != null && <Delta text={arrow(dI, ' %')} good={dI >= 0} label={prevLabel} />} active={isKpi('income')} onClick={() => onKpi('income')}>
        <div className={big}>
          <Amount hide={hide}>{fmtEur0(income)}</Amount>
        </div>
        <div className="mt-1 text-[11.5px] text-faint">
          Activo <Amount hide={hide}>{fmtEur0(income - (summary?.total_income_passive ?? 0))}</Amount> · Pasivo{' '}
          <Amount hide={hide}>{fmtEur0(summary?.total_income_passive ?? 0)}</Amount>
        </div>
      </Tile>

      <Tile label="Gastos" delta={dE != null && <Delta text={arrow(dE, ' %')} good={dE <= 0} label={prevLabel} />} active={isKpi('expense')} onClick={() => onKpi('expense')}>
        <div className={big}>
          <Amount hide={hide}>{fmtEur0(expenses)}</Amount>
          {budget != null && (
            <span className="text-sm font-normal text-muted">
              {' '}/ <Amount hide={hide}>{fmtEur0(budget)}</Amount>
            </span>
          )}
        </div>
        {budget == null ? (
          <div className="mt-1 text-[11.5px] text-faint">Sin presupuesto en este periodo</div>
        ) : (
          <div className="num mt-1 flex flex-wrap gap-x-2 text-[11.5px]">
            <span style={{ color: over ? COLOR_CRITICAL : COLOR_GOOD }}>
              {sgn(expenses - budget)}
              <Amount hide={hide}>{fmtEur0(Math.abs(expenses - budget))}</Amount> · {fmtPct(used * 100)}
            </span>
            <span className="text-faint">{over ? 'por encima del presupuesto' : 'por debajo del presupuesto'}</span>
          </div>
        )}
      </Tile>

      <Tile
        label="Tasa de ahorro"
        delta={rate != null && prevRate != null && <Delta text={arrow((rate - prevRate) * 100, ' pts')} good={rate >= prevRate} label={prevLabel} />}
        active={isKpi('saving') || isKpi('investment')} onClick={() => onKpi('saving')}>
        <div className={big}>{rate == null ? '—' : fmtPct(rate * 100, 1)}</div>
        <div className="mt-1 flex flex-wrap gap-x-1 text-[11.5px] text-faint">
          <button
            type="button"
            onClick={(e) => (e.stopPropagation(), onKpi('saving'))}
            className={`hover:text-fg ${isKpi('saving') ? 'font-medium text-fg' : ''}`}
          >
            Ahorro <Amount hide={hide}>{fmtEur0(summary?.total_savings ?? 0)}</Amount>
          </button>
          ·
          <button
            type="button"
            onClick={(e) => (e.stopPropagation(), onKpi('investment'))}
            className={`hover:text-fg ${isKpi('investment') ? 'font-medium text-fg' : ''}`}
          >
            Inversión <Amount hide={hide}>{fmtEur0(summary?.total_investments ?? 0)}</Amount>
          </button>
        </div>
      </Tile>
    </section>
  )
}
