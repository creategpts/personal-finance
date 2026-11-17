import type { PlanVersion } from '../../api'
import { COLOR_CRITICAL, COLOR_GOOD, fmtEur0, sgn } from '../inicio/format'
import { type Change, diffPlans, finalTotal } from './planMath'

export function ChangeList({ changes }: { changes: Change[] }) {
  return (
    <ul className="space-y-0.5 text-[12.5px]">
      {changes.map((c) => (
        <li key={c.label} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] gap-x-3">
          <span className="truncate text-muted">{c.label}</span>
          <span className="min-w-0 break-words text-fg">
            <span className="text-faint line-through">{c.before}</span> → {c.after}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function TotalDelta({ before, after }: { before: number; after: number }) {
  const d = after - before
  if (Math.abs(d) < 0.5) return null
  return (
    <span className="num text-xs font-medium" style={{ color: d > 0 ? COLOR_GOOD : COLOR_CRITICAL }}>
      {sgn(d)}
      {fmtEur0(Math.abs(d))} al final del plan
    </span>
  )
}

const when = (iso: string) => new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

export default function PlanHistory({ versions }: { versions: PlanVersion[] }) {
  if (versions.length === 0) return <p className="text-sm text-faint">Aún no hay versiones guardadas.</p>
  return (
    <ol className="divide-y divide-line">
      {versions.map((v, i) => {
        const prev = versions[i + 1]
        const changes = diffPlans(prev?.data ?? null, v.data)
        return (
          <li key={v.id} className="py-3 first:pt-0 last:pb-0">
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-medium text-fg">{v.reason}</span>
              <span className="text-xs text-faint">
                v{versions.length - i} · {when(v.created_at)}
                {i === 0 && ' · vigente'}
              </span>
              {prev && <TotalDelta before={finalTotal(prev.data)} after={finalTotal(v.data)} />}
            </div>
            {prev ? (
              changes.length ? <ChangeList changes={changes} /> : <p className="text-xs text-faint">Sin cambios en las variables.</p>
            ) : (
              <p className="text-xs text-faint">Versión inicial · acumulado previsto {fmtEur0(finalTotal(v.data))}</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
