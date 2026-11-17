import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import type { Investment, PlanAllocation, PlanDip, PlanPhase, ReserveTier } from '../../api'
import { COLOR_ACCENT, COLOR_CRITICAL, COLOR_GOOD, fmtEur0, fmtNum } from '../inicio/format'
import { assignedAmount } from './dips'
import { Field, NumberInput } from './fields'
import { weightSum, weightsOff } from './planMath'

function Affixed({ prefix, suffix, children }: { prefix?: string; suffix: string; children: ReactNode }) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-faint">{prefix}</span>}
      {children}
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-faint">{suffix}</span>
    </div>
  )
}

function DipsEditor({ dips, powder, onChange }: { dips: PlanDip[]; powder: number; onChange: (dips: PlanDip[]) => void }) {
  const assigned = assignedAmount(dips)
  const over = assigned > powder + 0.5
  const full = !over && powder > 0 && Math.abs(assigned - powder) <= 0.5
  const scale = Math.max(powder, assigned, 1)
  const set = (i: number, patch: Partial<PlanDip>) => onChange(dips.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  return (
    <div className="mt-3 rounded-lg border border-line">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line px-3 py-2">
        <div>
          <h5 className="text-xs font-semibold text-fg">Disparos de pólvora seca</h5>
          <p className="text-[11px] text-faint">Caída del índice ponderado de la fase desde su máximo</p>
        </div>
        <span className="num text-xs" style={{ color: over ? COLOR_CRITICAL : full ? COLOR_GOOD : 'var(--muted)' }}>
          {fmtEur0(assigned)} de {fmtEur0(powder)} asignados{over && ' · se pasa'}
        </span>
      </div>
      {dips.length > 0 && (
        <div className="px-3 pt-2.5">
          <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-surface2" role="img" aria-label="Reparto de la pólvora por disparo">
            {dips.map((d, i) => (
              <i key={i} style={{ width: `${(d.amount / scale) * 100}%`, background: over ? COLOR_CRITICAL : COLOR_ACCENT, opacity: 0.35 + (0.65 * (i + 1)) / dips.length }} />
            ))}
          </div>
        </div>
      )}
      <div className="px-3 py-2">
        {dips.length > 0 && (
          <div className="mb-1 grid grid-cols-[96px_minmax(0,140px)_56px_24px] gap-2 text-[10.5px] uppercase tracking-wider text-faint">
            <span>Caída</span>
            <span>Inyectar</span>
            <span className="text-right">Pólvora</span>
            <span />
          </div>
        )}
        {dips.map((d, i) => (
          <div key={i} className="grid grid-cols-[96px_minmax(0,140px)_56px_24px] items-center gap-2 py-0.5">
            <Affixed prefix="−" suffix="%">
              <NumberInput className="pl-6 pr-7 text-right" value={d.drop} onChange={(v) => set(i, { drop: v ?? 0 })} />
            </Affixed>
            <Affixed suffix="€">
              <NumberInput className="pr-7 text-right" value={d.amount} onChange={(v) => set(i, { amount: v ?? 0 })} />
            </Affixed>
            <span className="num text-right text-xs text-muted">{powder > 0 ? `${fmtNum((d.amount / powder) * 100, 0)} %` : '—'}</span>
            <button type="button" onClick={() => onChange(dips.filter((_, j) => j !== i))} aria-label={`Quitar disparo de −${d.drop} %`} className="text-faint transition hover:text-fg">
              <X size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...dips, { drop: (dips.at(-1)?.drop ?? 0) + 5, amount: Math.max(0, powder - assigned) }])}
          className="mt-1.5 text-xs font-medium text-muted transition hover:text-fg"
        >
          + Añadir disparo
        </button>
      </div>
    </div>
  )
}

function ReserveTiersEditor({ tiers, onChange }: { tiers: ReserveTier[]; onChange: (tiers: ReserveTier[]) => void }) {
  const set = (i: number, patch: Partial<ReserveTier>) => onChange(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  const deepest = Math.max(0, ...tiers.map((t) => t.below))
  return (
    <div className="mt-3 rounded-lg border border-line">
      <div className="border-b border-line px-3 py-2">
        <h5 className="text-xs font-semibold text-fg">Ahorro a reservas según el mercado</h5>
        <p className="text-[11px] text-faint">Parte de la aportación mensual que va al fondo de emergencia y a reponer pólvora, hasta completarlos</p>
      </div>
      <div className="px-3 py-2">
        {tiers.length > 0 && (
          <div className="mb-1 grid grid-cols-[110px_minmax(0,140px)_24px] gap-2 text-[10.5px] uppercase tracking-wider text-faint">
            <span>Caída menor de</span>
            <span>A reservas / mes</span>
            <span />
          </div>
        )}
        {tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-[110px_minmax(0,140px)_24px] items-center gap-2 py-0.5">
            <Affixed prefix="<" suffix="%">
              <NumberInput className="pl-6 pr-7 text-right" value={t.below} onChange={(v) => set(i, { below: v ?? 0 })} />
            </Affixed>
            <Affixed suffix="€">
              <NumberInput className="pr-7 text-right" value={t.amount} onChange={(v) => set(i, { amount: v ?? 0 })} />
            </Affixed>
            <button type="button" onClick={() => onChange(tiers.filter((_, j) => j !== i))} aria-label={`Quitar tramo de ${t.below} %`} className="text-faint transition hover:text-fg">
              <X size={14} />
            </button>
          </div>
        ))}
        {tiers.length > 0 && <p className="mt-1 text-[11px] text-faint">Con una caída de {fmtNum(deepest, deepest % 1 ? 1 : 0)} % o más, todo a la cartera.</p>}
        <button
          type="button"
          onClick={() => onChange([...tiers, { below: (tiers.at(-1)?.below ?? 0) + 5, amount: 0 }])}
          className="mt-1.5 text-xs font-medium text-muted transition hover:text-fg"
        >
          + Añadir tramo
        </button>
      </div>
    </div>
  )
}

export default function PhaseStrategy({ phase, investments, onChange }: { phase: PlanPhase; investments: Investment[]; onChange: (patch: Partial<PlanPhase>) => void }) {
  const allocation = phase.allocation
  const available = investments.filter((inv) => !allocation.some((a) => a.investment_id === inv.id))
  const setAllocation = (next: PlanAllocation[]) => onChange({ allocation: next })
  const setFund = (id: number, patch: Partial<PlanAllocation>) => setAllocation(allocation.map((x) => (x.investment_id === id ? { ...x, ...patch } : x)))

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Fondo de emergencia (€)">
          <NumberInput value={phase.emergency_fund} onChange={(v) => onChange({ emergency_fund: v ?? 0 })} />
        </Field>
        <Field label="Tolerancia (± pts)">
          <NumberInput value={phase.weight_tolerance} onChange={(v) => onChange({ weight_tolerance: v ?? 0 })} />
        </Field>
        <Field label="Pólvora seca (€)">
          <NumberInput value={phase.dry_powder} onChange={(v) => onChange({ dry_powder: v ?? 0 })} />
        </Field>
      </div>
      <DipsEditor dips={phase.dips ?? []} powder={phase.dry_powder} onChange={(dips) => onChange({ dips })} />
      <ReserveTiersEditor tiers={phase.reserve_tiers ?? []} onChange={(reserve_tiers) => onChange({ reserve_tiers })} />

      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="font-medium text-muted">Fondos de la fase · peso objetivo</span>
          <span className="num" style={{ color: weightsOff(allocation) ? COLOR_CRITICAL : 'var(--faint)' }}>
            Suma {fmtNum(weightSum(allocation), 1)} %
          </span>
        </div>
        {allocation.length === 0 && <p className="py-1 text-sm text-faint">Sin fondos: la fase no cambia los pesos objetivo.</p>}
        <ul className="divide-y divide-line">
          {allocation.map((a) => (
            <li key={a.investment_id} className="py-1">
              <div className="flex items-center gap-3">
                <Link to={`/inversion/${a.investment_id}`} className="min-w-0 flex-1 truncate text-sm text-fg hover:underline">
                  {a.name}
                </Link>
                <NumberInput className="w-24 text-right" value={a.weight} onChange={(v) => setFund(a.investment_id, { weight: v ?? 0 })} />
                <span className="text-xs text-faint">%</span>
                <button
                  type="button"
                  onClick={() => setAllocation(allocation.filter((x) => x.investment_id !== a.investment_id))}
                  aria-label={`Quitar ${a.name} de la fase`}
                  className="text-faint transition hover:text-fg"
                >
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {available.length > 0 && (
          <select
            className="input mt-2"
            aria-label="Añadir fondo a la fase"
            value=""
            onChange={(e) => {
              const inv = investments.find((i) => i.id === Number(e.target.value))
              if (inv) setAllocation([...allocation, { investment_id: inv.id, name: inv.name, weight: 0 }])
            }}
          >
            <option value="">+ Añadir fondo…</option>
            {available.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name}
                {inv.active ? '' : ' (inactivo)'}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
