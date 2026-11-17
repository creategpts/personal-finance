import { Trash2 } from 'lucide-react'
import type { Investment, PlanData, PlanPhase } from '../../api'
import { fmtEur0, fmtNum } from '../inicio/format'
import { Field, NumberInput } from './fields'
import PhaseStrategy from './PhaseStrategy'
import { EMPTY_PHASE, monthIso, monthLabel, phaseColor, schedule, totalMonths } from './planMath'

export function PhaseTimeline({ data, nowOffset }: { data: PlanData; nowOffset?: number }) {
  const total = totalMonths(data)
  if (total <= 0) return null
  const years = Math.floor(total / 12)
  return (
    <div>
      <div className="relative flex h-7 w-full overflow-hidden rounded-md">
        {data.phases.map((p, i) => (
          <div
            key={i}
            className="flex items-center justify-center truncate px-1 text-[11px] font-medium text-white"
            style={{ width: `${(p.months / total) * 100}%`, background: phaseColor(i) }}
            title={`Fase ${i + 1} · ${p.name} · ${fmtNum(p.months, p.months % 1 ? 1 : 0)} meses`}
          >
            {(p.months / total) * 100 > 10 && `Fase ${i + 1}`}
          </div>
        ))}
        {nowOffset != null && nowOffset >= 0 && nowOffset <= total && (
          <b className="absolute -inset-y-0 w-0.5 bg-fg" style={{ left: `${(nowOffset / total) * 100}%` }} title="Hoy" />
        )}
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-faint">
        {Array.from({ length: years + 1 }, (_, y) => (
          <span key={y} className="absolute -translate-x-1/2" style={{ left: `${((y * 12) / total) * 100}%` }}>
            {y}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function PhasesEditor({ data, investments, onChange }: { data: PlanData; investments: Investment[]; onChange: (patch: Partial<PlanData>) => void }) {
  const rows = schedule(data)
  const setPhases = (phases: PlanPhase[]) => onChange({ phases })
  const set = (i: number, patch: Partial<PlanPhase>) => setPhases(data.phases.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  function moveStart(i: number, iso: string) {
    if (!/^\d{4}-\d{2}$/.test(iso)) return
    if (i === 0) return onChange({ start_month: iso })
    const [y, m] = iso.split('-').map(Number)
    const [sy, sm] = data.start_month.split('-').map(Number)
    const months = y * 12 + m - (sy * 12 + sm) - rows[i - 1].start
    if (months > 0) set(i - 1, { months })
  }

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: phaseColor(i) }} />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Fase {i + 1}</span>
            <span className="text-xs text-faint">
              {monthLabel(data, r.start)} → {monthLabel(data, r.end)}
            </span>
            <span className="num ml-auto text-xs text-muted">
              {fmtEur0(r.monthly)}/mes · acumulado <b className="font-medium text-fg">{fmtEur0(r.cumEnd)}</b>
            </span>
            <button
              type="button"
              onClick={() => setPhases(data.phases.filter((_, j) => j !== i))}
              disabled={data.phases.length === 1}
              aria-label={`Quitar fase ${i + 1}`}
              className="text-faint transition hover:text-fg disabled:opacity-30"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,2fr)_90px_120px_120px]">
            <input className="input col-span-2 md:col-span-1" placeholder="Nombre" aria-label="Nombre de la fase" value={r.phase.name} onChange={(e) => set(i, { name: e.target.value })} />
            <label className="flex items-center gap-1 text-xs text-faint">
              <NumberInput value={r.phase.months} onChange={(v) => set(i, { months: v ?? 0 })} />
              meses
            </label>
            <NumberInput value={r.phase.contribution} onChange={(v) => set(i, { contribution: v ?? 0 })} placeholder="Aportación €" />
            <select className="input" aria-label="Frecuencia" value={r.phase.frequency} onChange={(e) => set(i, { frequency: e.target.value as PlanPhase['frequency'] })}>
              <option value="monthly">mensual</option>
              <option value="biweekly">quincenal</option>
            </select>
            <textarea
              className="input col-span-2 min-h-[56px] md:col-span-4"
              placeholder="Nota (contexto, supuestos…)"
              aria-label="Nota de la fase"
              value={r.phase.note}
              onChange={(e) => set(i, { note: e.target.value })}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 md:grid-cols-4">
            <Field label="Mes de inicio" className="col-span-2 md:col-span-1">
              <input type="month" className="input" value={monthIso(data, r.start)} onChange={(e) => moveStart(i, e.target.value)} />
            </Field>
            <Field label="Capital inicial (€)">
              <NumberInput value={r.phase.initial_capital} onChange={(v) => set(i, { initial_capital: v ?? 0 })} />
            </Field>
            <Field label="Ingresos/mes (€)">
              <NumberInput value={r.phase.monthly_income} onChange={(v) => set(i, { monthly_income: v })} />
            </Field>
            <Field label="Gastos/mes (€)">
              <NumberInput value={r.phase.monthly_expense} onChange={(v) => set(i, { monthly_expense: v })} />
            </Field>
          </div>
          <PhaseStrategy phase={r.phase} investments={investments} onChange={(patch) => set(i, patch)} />
        </div>
      ))}
      <button type="button" onClick={() => setPhases([...data.phases, { ...(data.phases.at(-1) ?? EMPTY_PHASE), name: '', note: '', initial_capital: 0 }])} className="btn">
        + Añadir fase
      </button>
    </div>
  )
}
