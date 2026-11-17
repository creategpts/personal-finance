import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type InvestmentType } from '../../api'
import { INVESTMENT_TYPE_COLORS, INVESTMENT_TYPE_LABELS } from '../../investmentColors'
import { useSettings } from '../../settings'
import { splitSavings, useDryPowder } from '../plan/useDryPowder'
import { COLOR_CRITICAL, COLOR_GOOD, fmtEur, fmtEur0, fmtPct } from './format'
import { Amount } from './ui'

interface Slice {
  key: string
  label: string
  color: string
  amount: number
  plusvalia: number | null
  note?: ReactNode
}

const LIQUIDITY_COLORS = { reserve: '#0369a1', powder: '#0ea5e9', free: '#7dd3fc' }

export const paymentsCovered = (free: number, contribution: number) => (contribution > 0 ? Math.floor(free / contribution) : null)

export function usePatrimonio() {
  const { data: snapshot = null } = useQuery({ queryKey: ['account-values', 'latest'], queryFn: () => api.accountValues.latest() })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.categories.list() })
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => api.investments.list() })
  const { data: composition = [] } = useQuery({ queryKey: ['investments-composition'], queryFn: () => api.investments.composition() })

  const ahorro = categories
    .filter((c) => c.type === 'ahorro' && c.include_in_total)
    .reduce((s, c) => s + (snapshot?.items.find((i) => i.category === c.name)?.amount ?? 0), 0)

  const settings = useSettings()
  const { phaseIndex, phase, planned } = useDryPowder()
  const reserveTarget = Number(settings.emergency_fund) || 0
  const split = splitSavings(ahorro, reserveTarget, planned)

  const { liquidity, invested } = useMemo(() => {
    const byId = new Map(investments.map((i) => [i.id, i]))
    const byType = new Map<InvestmentType, Slice>()
    for (const c of composition) {
      if (c.valor_actual <= 0) continue
      const s = byType.get(c.type) ?? { key: c.type, label: INVESTMENT_TYPE_LABELS[c.type], color: INVESTMENT_TYPE_COLORS[c.type], amount: 0, plusvalia: 0 }
      s.amount += c.valor_actual
      s.plusvalia = (s.plusvalia ?? 0) + (byId.get(c.investment_id)?.stats.plusvalia ?? 0)
      byType.set(c.type, s)
    }
    const reserveOk = split.reserve >= reserveTarget
    const payments = paymentsCovered(split.free, phase?.contribution ?? 0)
    const liquiditySlices: Slice[] = [
      {
        key: 'reserve',
        label: 'Fondo de emergencia',
        color: LIQUIDITY_COLORS.reserve,
        amount: split.reserve,
        plusvalia: null,
        note:
          reserveTarget > 0 ? (
            <>
              objetivo {fmtEur0(reserveTarget)} ·{' '}
              <span style={{ color: reserveOk ? COLOR_GOOD : COLOR_CRITICAL }}>{reserveOk ? 'cubierta' : `faltan ${fmtEur0(reserveTarget - split.reserve)}`}</span>
            </>
          ) : (
            'sin objetivo en el plan'
          ),
      },
      {
        key: 'powder',
        label: 'Pólvora seca',
        color: LIQUIDITY_COLORS.powder,
        amount: split.powder,
        plusvalia: null,
        note: phase && phase.dry_powder > 0 ? `pendiente de disparar · de ${fmtEur0(phase.dry_powder)} en fase ${(phaseIndex ?? 0) + 1}` : 'sin pólvora en la fase activa',
      },
      {
        key: 'free',
        label: 'Por desplegar',
        color: LIQUIDITY_COLORS.free,
        amount: split.free,
        plusvalia: null,
        note: payments != null ? `cubre ${payments} aportaciones de la fase` : 'sin aportación en la fase activa',
      },
    ]
    return {
      liquidity: liquiditySlices.filter((s) => s.amount > 0.5),
      invested: [...byType.values()].sort((a, b) => b.amount - a.amount),
    }
  }, [investments, composition, split.reserve, split.powder, split.free, reserveTarget, phase, phaseIndex])

  const total = [...liquidity, ...invested].reduce((s, x) => s + x.amount, 0)
  return { liquidity, invested, total }
}

type PatrimonioData = ReturnType<typeof usePatrimonio>

export function NetWorthTotal({ data, hide }: { data: PatrimonioData; hide: boolean }) {
  const { total } = data
  return (
    <>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">Patrimonio</div>
      <div className="num mt-0.5 text-[26px] font-semibold tracking-tight text-fg">
        <Amount hide={hide}>{fmtEur(total)}</Amount>
      </div>
    </>
  )
}

const CELL = 'num flex items-center justify-end self-stretch border-t border-line py-2 pl-3 text-[13px]'

function SliceRow({ s, total, hide }: { s: Slice; total: number; hide: boolean }) {
  return (
    <div className="contents">
      <span className="flex min-w-0 items-center gap-2 self-stretch border-t border-line py-2 text-fg">
        <i className="mt-1.5 h-2 w-2 shrink-0 self-start" style={{ background: s.color }} />
        <span className="min-w-0">
          <span className="block truncate">{s.label}</span>
          {s.note && <span className={`block truncate text-[11px] text-faint ${hide ? 'select-none blur-sm' : ''}`}>{s.note}</span>}
        </span>
      </span>
      <span className={CELL}>
        <Amount hide={hide}>{fmtEur(s.amount)}</Amount>
      </span>
      <span className={`${CELL} text-muted`}>{fmtPct((s.amount / total) * 100, 1)}</span>
      <span className={CELL} style={{ color: s.plusvalia == null ? undefined : s.plusvalia >= 0 ? COLOR_GOOD : COLOR_CRITICAL }}>
        {s.plusvalia == null ? (
          <span className="text-faint">—</span>
        ) : (
          <Amount hide={hide}>
            {s.plusvalia >= 0 ? '+' : '−'}
            {fmtEur0(Math.abs(s.plusvalia))}
          </Amount>
        )}
      </span>
    </div>
  )
}

export function Breakdown({ data, hide }: { data: PatrimonioData; hide: boolean }) {
  const { liquidity, invested, total } = data
  return (
    <>
      <div className="mb-1 mt-3 flex h-2 gap-0.5" role="img" aria-label="Reparto del patrimonio">
        {[...liquidity, ...invested].map((s) => (
          <div key={s.key} className="min-w-1" style={{ flex: s.amount, background: s.color }} title={s.label} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_4.25rem_5.25rem] items-center text-sm">
        <span className="py-1 text-[10.5px] uppercase tracking-wider text-faint" />
        <span className="py-1 pl-3 text-right text-[10.5px] uppercase tracking-wider text-faint">Valor</span>
        <span className="py-1 pl-3 text-right text-[10.5px] uppercase tracking-wider text-faint">Peso</span>
        <span className="py-1 pl-3 text-right text-[10.5px] uppercase tracking-wider text-faint">Plusvalía</span>
        {[...liquidity, ...invested].map((s) => (
          <SliceRow key={s.key} s={s} total={total} hide={hide} />
        ))}
      </div>
    </>
  )
}
