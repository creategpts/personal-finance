import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Check, Crosshair, Info } from 'lucide-react'
import { api, type PlanData } from '../../api'
import { COLOR_ACCENT, COLOR_CRITICAL, COLOR_GOOD, fmtEur0, fmtNum, fmtPct, sgn, shortDate } from './format'
import { Amount } from './ui'
import { PricesUpdatedAt } from '../../marketSync'
import { expectedToDate, monthLabel, phaseColor, schedule } from '../plan/planMath'
import { useDryPowder } from '../plan/useDryPowder'
import { useNextContribution } from '../plan/useNextContribution'
import { Breakdown, NetWorthTotal, usePatrimonio } from './Patrimonio'

const FREQ_LABEL = { monthly: 'mes', biweekly: 'quincena' }

function PhaseHero({ plan, invested, hide }: { plan: PlanData; invested: number; hide: boolean }) {
  const { index, expected, monthInPhase } = expectedToDate(plan)
  const row = index == null ? null : schedule(plan)[index]
  if (!row || index == null) return <p className="text-sm text-faint">Hoy no hay ninguna fase del plan en curso.</p>
  const diff = invested - expected
  const scale = Math.max(row.cumEnd, invested, 1)
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-fg">
          <span className="h-2 w-2 rounded-full" style={{ background: phaseColor(index) }} />
          Fase {index + 1}
          {row.phase.name && ` · ${row.phase.name}`}
        </span>
        <span className="num text-xs text-muted">
          mes {monthInPhase} de {row.end - row.start} · <Amount hide={hide}>{fmtEur0(row.phase.contribution)}</Amount>/{FREQ_LABEL[row.phase.frequency]} · hasta{' '}
          {monthLabel(plan, row.end)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
        <Amount hide={hide} className="text-[22px] font-semibold tracking-tight text-fg">
          {fmtEur0(invested)}
        </Amount>
        <span className="text-xs text-muted">
          aportados
        </span>
        <span className="num ml-auto text-sm font-medium" style={{ color: diff >= 0 ? COLOR_GOOD : COLOR_CRITICAL }}>
          {sgn(diff)}
          <Amount hide={hide}>{fmtEur0(Math.abs(diff))}</Amount> vs plan
        </span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-surface2" title={`Escala: acumulado previsto al final de la fase (${fmtEur0(row.cumEnd)})`}>
        <i className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(Math.max(0, invested) / scale) * 100}%`, background: diff >= 0 ? COLOR_GOOD : COLOR_ACCENT }} />
        <b className="absolute -inset-y-1 w-0.5 bg-fg" style={{ left: `${(expected / scale) * 100}%` }} title="Previsto a hoy" />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-faint">
        <span>0</span>
        <span>
          fin de fase <Amount hide={hide}>{fmtEur0(row.cumEnd)}</Amount>
        </span>
      </div>
    </>
  )
}

function BuyOpportunities({ hide }: { hide: boolean }) {
  const { phaseIndex, phase, shots, drawdown, peak } = useDryPowder()
  const dips = [...(phase?.dips ?? [])].sort((a, b) => a.drop - b.drop)
  const dd = drawdown ?? 0
  const scale = Math.max(dd, ...dips.map((d) => d.drop), 1) * 1.1
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h4 className="text-[13px] font-semibold text-fg">Oportunidades de compra</h4>
        <PricesUpdatedAt />
      </div>
      {phaseIndex == null || dips.length === 0 ? (
        <p className="py-4 text-sm text-faint">La fase activa no tiene disparos de pólvora seca.</p>
      ) : (
        <>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-[22px] font-semibold tracking-tight text-fg">{drawdown == null ? '—' : `−${fmtNum(dd, 1)} %`}</span>
            {drawdown != null && peak.date && <span className="text-[11.5px] text-muted">índice de la fase {phaseIndex + 1} desde máximo del {shortDate(peak.date)}</span>}
          </div>
          <div className="relative mb-5 mt-3 h-1.5 rounded-full bg-surface2" role="img" aria-label={`Caída actual ${fmtNum(dd, 1)} %`}>
            <i className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(dd / scale) * 100}%`, background: COLOR_ACCENT }} />
            {dips.map((d) => (
              <span key={d.drop} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${(d.drop / scale) * 100}%` }}>
                <b className="h-3 w-0.5 -translate-y-0.75 bg-fg" />
                <span className="num text-[10px] text-faint">−{d.drop}</span>
              </span>
            ))}
          </div>
          {dips.map((d) => {
            const fired = shots.some((x) => x.drop === d.drop)
            const reached = dd >= d.drop
            return (
              <div key={d.drop} className="flex items-center gap-3 border-t border-line py-1.5 text-sm">
                <span className={`num w-12 font-medium ${reached ? 'text-fg' : 'text-muted'}`}>−{d.drop} %</span>
                <Amount hide={hide} className="num flex-1 text-[13px] text-fg">
                  {fmtEur0(d.amount)}
                </Amount>
                {fired ? (
                  <span className="flex items-center gap-1 text-xs text-faint">
                    <Check size={12} /> hecho
                  </span>
                ) : reached ? (
                  <Link to="/inversion" className="text-xs font-medium" style={{ color: COLOR_GOOD }}>
                    Disparar →
                  </Link>
                ) : (
                  <span className="num text-xs text-faint">faltan {fmtNum(d.drop - dd, 1)} pts</span>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

const nextHelp = (tolerance: number) => `Reparto que acerca cada fondo a su peso objetivo sin vender. Barra: peso real; marca: objetivo ±${fmtNum(tolerance, 1)} pts.`

function NextContribution({ tolerance, hide }: { tolerance: number; hide: boolean }) {
  const { funds, amount, toReserves, reserveGap, drawdown, split } = useNextContribution()
  const hi = Math.max(...funds.map((c) => Math.max(c.weight_target + tolerance, c.weight_real)), 1)
  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3">
        <h4 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
          Próxima aportación
          <span
            tabIndex={0}
            role="img"
            aria-label={nextHelp(tolerance)}
            title={nextHelp(tolerance)}
            className="inline-flex cursor-help font-normal text-faint hover:text-fg"
          >
            <Info size={13} />
          </span>
        </h4>
        {amount > 0 && (
          <Amount hide={hide} className="text-sm font-semibold text-fg">
            {fmtEur0(amount)}
          </Amount>
        )}
      </div>
      {toReserves > 0 && (
        <p className="num text-[11.5px] text-muted">
          <Amount hide={hide}>{fmtEur0(toReserves)}</Amount> a reservas · índice {drawdown == null ? '—' : `−${fmtNum(drawdown, 1)} %`} · faltan <Amount hide={hide}>{fmtEur0(reserveGap)}</Amount> de fondo de emergencia y pólvora
        </p>
      )}
      {funds.length === 0 ? (
        <p className="py-4 text-sm text-faint">Sin pesos objetivo definidos en el plan.</p>
      ) : (
        funds.map((c) => {
          const dev = c.weight_real - c.weight_target
          const ok = Math.abs(dev) <= tolerance
          const put = split.get(c.investment_id) ?? 0
          return (
            <div key={c.investment_id} className="grid grid-cols-[minmax(0,1fr)_auto_72px] items-center gap-x-3 gap-y-1 border-t border-line py-2 first-of-type:border-t-0">
              <Link to={`/inversion/${c.investment_id}`} className="truncate text-sm text-fg hover:underline" title={c.name}>
                {c.name}
              </Link>
              <span className="num text-right text-[11.5px] text-muted">
                {fmtPct(c.weight_real, 1)} <span className="text-faint">/ {fmtPct(c.weight_target, 0)}</span>{' '}
                <span style={{ color: ok ? 'var(--faint)' : COLOR_CRITICAL }}>
                  {sgn(dev)}
                  {fmtNum(Math.abs(dev))}
                </span>
              </span>
              <span className="num text-right text-sm font-medium" style={{ color: put > 0.5 ? 'var(--fg)' : 'var(--faint)' }}>
                {amount > 0 ? (
                  <>
                    → <Amount hide={hide}>{fmtEur0(put)}</Amount>
                  </>
                ) : (
                  '—'
                )}
              </span>
              <div className="relative col-span-3 h-1.5 rounded-full bg-surface2">
                <div
                  className="absolute -inset-y-0.5 rounded-sm bg-fg/10"
                  style={{ left: `${(Math.max(0, c.weight_target - tolerance) / hi) * 100}%`, width: `${((2 * tolerance) / hi) * 100}%` }}
                />
                <i className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(c.weight_real / hi) * 100}%`, background: ok ? COLOR_ACCENT : COLOR_CRITICAL }} />
                <b className="absolute -inset-y-1 w-0.5 bg-fg" style={{ left: `${(c.weight_target / hi) * 100}%` }} />
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function DipAlert({ hide }: { hide: boolean }) {
  const { phaseIndex, drawdown, signal, remaining } = useDryPowder()
  if (phaseIndex == null || signal.pending.length === 0) return null
  return (
    <Link
      to="/inversion"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 text-sm transition hover:bg-surface2/60"
      style={{ background: `color-mix(in srgb, ${COLOR_GOOD} 12%, var(--surface))` }}
    >
      <Crosshair size={15} style={{ color: COLOR_GOOD }} />
      <span className="font-medium text-fg">Disparo pendiente</span>
      <span className="num text-muted">
        índice −{fmtNum(drawdown ?? 0, 1)} % · {signal.pending.map((d) => `−${d.drop} %`).join(', ')} → <Amount hide={hide}>{fmtEur0(signal.pendingAmount)}</Amount>
        {remaining < signal.pendingAmount - 0.5 && (
          <>
            {' '}
            (pólvora real <Amount hide={hide}>{fmtEur0(remaining)}</Amount>)
          </>
        )}
      </span>
      <span className="ml-auto text-xs font-medium text-muted">Ir a Oportunidades →</span>
    </Link>
  )
}

export default function PatrimonioPlan({ hide }: { hide: boolean }) {
  const { data: plan = null } = useQuery({ queryKey: ['plan'], queryFn: () => api.plan.current() })
  const { data: portfolioSummary = null } = useQuery({ queryKey: ['investments-summary'], queryFn: () => api.investments.summary() })
  const patrimonio = usePatrimonio()
  const navigate = useNavigate()

  const phaseIndex = plan ? expectedToDate(plan.data).index : null
  const phase = plan && phaseIndex != null ? plan.data.phases[phaseIndex] : null
  const tolerance = phase?.weight_tolerance ?? 2
  const empty = patrimonio.liquidity.length + patrimonio.invested.length === 0

  return (
    <section className="card min-w-0 overflow-hidden" aria-label="Patrimonio y plan">
      <DipAlert hide={hide} />
      <div className="grid divide-y divide-line lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:divide-x lg:divide-y-0">
        <div className="p-4">
          {empty ? (
            <div className="py-10 text-center text-sm text-faint">Sin datos</div>
          ) : (
            <>
              <NetWorthTotal data={patrimonio} hide={hide} />
              <Breakdown data={patrimonio} hide={hide} />
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-col divide-y divide-line">
          {plan ? (
            <Link to="/plan" className="block px-4 py-4 transition hover:bg-surface2/40">
              <PhaseHero plan={plan.data} invested={(portfolioSummary?.total_invertido ?? 0) - (plan.data.phases[0]?.initial_capital ?? 0)} hide={hide} />
            </Link>
          ) : (
            <p className="px-4 py-4 text-sm text-faint">
              Aún no hay plan guardado.{' '}
              <Link to="/plan" className="font-medium text-fg hover:underline">
                Crear el plan →
              </Link>
            </p>
          )}
          <div
            role="link"
            tabIndex={0}
            aria-label="Ir a Inversión"
            onClick={(e) => !(e.target as Element).closest('a') && navigate('/inversion')}
            onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && navigate('/inversion')}
            className="grid flex-1 cursor-pointer divide-y divide-line transition hover:bg-surface2/40 xl:grid-cols-2 xl:divide-x xl:divide-y-0"
          >
            <NextContribution tolerance={tolerance} hide={hide} />
            <BuyOpportunities hide={hide} />
          </div>
        </div>
      </div>
    </section>
  )
}
