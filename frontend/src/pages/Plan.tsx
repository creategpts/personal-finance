import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Investment, type PlanData } from '../api'
import InversionAjustes from '../components/InversionAjustes'
import { COLOR_CRITICAL, fmtEur0, fmtNum, isoDate } from '../components/inicio/format'
import { Card } from '../components/plan/fields'
import PhasesEditor, { PhaseTimeline } from '../components/plan/PhasesEditor'
import PlanHistory, { ChangeList, TotalDelta } from '../components/plan/PlanHistory'
import { EMPTY_PHASE, diffPlans, finalTotal, offsetOf, totalMonths, weightSum, weightsOff } from '../components/plan/planMath'
import { loadSettings, useSettings } from '../settings'
import PageHeader from '../components/PageHeader'

function defaultPlan(investments: Investment[], emergencyFund: number): PlanData {
  return {
    summary: '',
    start_month: isoDate(new Date()).slice(0, 7),
    phases: [{ ...EMPTY_PHASE, emergency_fund: emergencyFund, allocation: investments.filter((i) => i.target_weight > 0).map((i) => ({ investment_id: i.id, name: i.name, weight: i.target_weight })) }],
  }
}

export default function Plan() {
  const queryClient = useQueryClient()
  const settings = useSettings()
  const { data: current, isLoading } = useQuery({ queryKey: ['plan'], queryFn: () => api.plan.current() })
  const { data: versions = [] } = useQuery({ queryKey: ['plan-versions'], queryFn: () => api.plan.versions() })
  const { data: allInvestments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => api.investments.list() })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.categories.list() })
  const investments = allInvestments.filter((i) => i.active)

  const [draft, setDraft] = useState<PlanData | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isLoading) return <div className="py-12 text-center text-sm text-faint">Cargando plan…</div>

  const base = current?.data ?? defaultPlan(investments, Number(settings.emergency_fund) || 0)
  const plan = draft ?? base
  const edit = (patch: Partial<PlanData>) => setDraft({ ...plan, ...patch })

  const toSave = plan
  const changes = diffPlans(current?.data ?? null, toSave)
  const problems = [
    ...toSave.phases.map((p, i) => weightsOff(p.allocation) && `Fase ${i + 1}: la asignación suma ${fmtNum(weightSum(p.allocation), 1)} %, debe sumar 100 %`),
    plan.phases.some((p) => !(p.months > 0)) && 'Cada fase necesita una duración mayor que 0',
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(plan.start_month) && 'Mes de inicio no válido',
  ].filter((p): p is string => !!p)
  const canSave = changes.length > 0 && reason.trim() !== '' && problems.length === 0 && !saving

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await api.plan.save(reason.trim(), toSave)
      setDraft(null)
      setReason('')
      await Promise.all([queryClient.invalidateQueries(), loadSettings()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const years = totalMonths(plan) / 12

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3.5">
      <PageHeader crumbs={[{ label: 'Inversión', to: '/inversion' }, { label: 'Plan' }]}>
        <p className="num ml-auto text-xs text-faint">
          Horizonte {fmtNum(years, years % 1 ? 1 : 0)} años · acumulado previsto {fmtEur0(finalTotal(plan))}
          {current ? ` · v${versions.length} vigente` : ' · sin guardar'}
        </p>
      </PageHeader>

      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <InversionAjustes
          savingAccounts={categories.filter((c) => c.type === 'ahorro')}
          allAccounts={categories.filter((c) => c.type === 'ahorro' || c.type === 'gasto' || c.type === 'inversion')}
          incomeCategories={categories.filter((c) => c.type === 'income')}
          expenseCategories={categories.filter((c) => c.type === 'expense')}
        />
        <Card title="Resumen" fill>
          <textarea
            className="input min-h-[84px] w-full flex-1 resize-none"
            placeholder="Estrategia en una frase: exposición, comisiones, satélites, objetivo vital…"
            aria-label="Resumen del plan"
            value={plan.summary}
            onChange={(e) => edit({ summary: e.target.value })}
          />
        </Card>
      </div>

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div className="min-w-0 xl:sticky xl:top-4">
          <Card title="Historial de versiones">
            {(!current || changes.length > 0) && (
              <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-medium text-fg">{current ? 'Cambios sin guardar' : 'Crear el plan'}</span>
                  {current && <TotalDelta before={finalTotal(current.data)} after={finalTotal(toSave)} />}
                </div>
              {changes.length > 0 && (
                <div className="max-h-64 overflow-y-auto">
                  <ChangeList changes={changes} />
                </div>
              )}
              {problems.map((p) => (
                <p key={p} className="mt-2 text-xs" style={{ color: COLOR_CRITICAL }}>
                  {p}
                </p>
              ))}
              <div className="mt-3 flex flex-col gap-2">
                <input className="input" placeholder="Motivo del cambio (obligatorio)" aria-label="Motivo del cambio" value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex justify-end gap-2">
                  {draft && (
                    <button type="button" onClick={() => setDraft(null)} className="btn">
                      Descartar
                    </button>
                  )}
                  <button type="button" onClick={save} disabled={!canSave} className="btn-primary disabled:opacity-50">
                    {saving ? 'Guardando…' : current ? 'Guardar nueva versión' : 'Crear plan'}
                  </button>
                </div>
                {error && (
                  <p className="text-xs" style={{ color: COLOR_CRITICAL }}>
                    {error}
                  </p>
                )}
              </div>
              </div>
            )}
            <PlanHistory versions={versions} />
          </Card>
        </div>
          <Card title="Fases">
            <div className="mb-4">
              <PhaseTimeline data={plan} nowOffset={offsetOf(plan)} />
            </div>
            <PhasesEditor data={plan} investments={allInvestments} onChange={edit} />
          </Card>
      </div>

    </div>
  )
}
