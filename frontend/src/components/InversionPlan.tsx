import Money from './Money'

const FASES = [
  {
    id: 'fase1',
    label: 'Fase 1',
    descripcion: 'Despliegue de liquidez',
    meses: 16.5,
    color: '#2563eb',
    prosa:
      'Despliegue de liquidez hacia la cartera a un ritmo de 2.000 € quincenales (75% world / 15% emergentes / 10% small-caps), reservando 6.000 € para el fondo de emergencia, hasta sumar cerca de 63.500 € acumulados en cartera.',
  },
  {
    id: 'fase2',
    label: 'Fase 2',
    descripcion: 'Ahorro regular',
    meses: 19.5,
    color: '#7c3aed',
    prosa:
      'Asumiendo mejora salarial ~2.000 €/mes subo el ritmo a 1.400 € mensuales mientras siga en casa, reservando otros 10.000 € para el fondo de emergencia, hasta cerca de 80.800 € acumulados en cartera.',
  },
  {
    id: 'fase3',
    label: 'Fase 3',
    descripcion: 'Emancipación',
    meses: 84,
    color: '#059669',
    prosa:
      'Ya emancipado, bajo a mi aportación de crucero de 1.000 € mensuales durante el grueso del plan (~7 años), sumando otros ~84.000 € y cerrando mi horizonte de 10 años con unos 164.800 € acumulados en cartera.',
  },
]

const TOTAL_MESES = FASES.reduce((s, f) => s + f.meses, 0)

const HITOS = [
  { hito: 'Año 5', totalAportado: 104800, esc4: 119600, esc7: 132400, esc10: 146800, plusvalia: 27600 },
  { hito: 'Año 10', totalAportado: 164800, esc4: 212400, esc7: 259400, esc10: 319000, plusvalia: 94600 },
  { hito: 'Año 20', totalAportado: 284800, esc4: 463900, esc7: 694300, esc10: 1068400, plusvalia: 409500 },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-fg">{title}</h3>
      {children}
    </div>
  )
}

function MoneyCell({ value, hideAmounts }: { value: number; hideAmounts: boolean }) {
  return (
    <td className="text-right">
      <Money value={value} className={hideAmounts ? 'select-none blur-sm' : ''} />
    </td>
  )
}

export default function InversionPlan({ hideAmounts }: { hideAmounts: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <dl className="space-y-2 text-sm">
          <p className="text-fg">
            Exposición al mercado global (100% RV) buscando minimizar comisiones (indexado · TER 0.14%). Introducir gestión
            activa/BTC/MMPP si la oportunidad lo merece, en pequeña proporción. Quito el foco de comprar vivienda, siendo el
            objetivo vivir de alquiler hasta que pueda pignorar la entrada.
          </p>
          <div>
            <dt className="inline text-muted">Edad de inicio</dt>
            <dd className="inline text-fg"> · 25</dd>
          </div>
          <div>
            <dt className="inline text-muted">Ingresos / gastos actuales</dt>
            <dd className={`inline text-fg ${hideAmounts ? 'select-none blur-sm' : ''}`}> · 1.600 €/mes (vivo con mis padres) · gasto 600 €/mes · invierto 1.000 €/mes</dd>
          </div>
          <div>
            <dt className="inline text-muted">Fondo de emergencia</dt>
            <dd className={`inline text-fg ${hideAmounts ? 'select-none blur-sm' : ''}`}> · 6.000 €</dd>
          </div>
          <div>
            <dt className="inline text-muted">Capital inicial a desplegar en RV</dt>
            <dd className={`inline text-fg ${hideAmounts ? 'select-none blur-sm' : ''}`}> · 3.500 € ya en Cartera Metal + 40.000 € en cuenta remunerada y ~10.000 € en Occident</dd>
          </div>
        </dl>
      </div>

      <Section title="Fases del plan">
        <div className="flex h-8 w-full overflow-hidden rounded-lg">
          {FASES.map((f) => (
            <div
              key={f.id}
              style={{ width: `${(f.meses / TOTAL_MESES) * 100}%`, backgroundColor: f.color }}
              className="flex items-center justify-center text-xs font-medium text-white"
              title={`${f.label} · ${f.meses} meses`}
            >
              {(f.meses / TOTAL_MESES) * 100 > 12 && f.label}
            </div>
          ))}
        </div>
        <div className="relative mb-5 h-5 w-full">
          {Array.from({ length: Math.round(TOTAL_MESES / 12) + 1 }, (_, year) => (
            <div
              key={year}
              className="absolute flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${(year / (TOTAL_MESES / 12)) * 100}%` }}
            >
              <span className="mt-1 h-1 w-1 rounded-full bg-faint" />
              {year % 5 === 0 && <span className="mt-0.5 text-[10px] text-faint">{year}</span>}
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {FASES.map((f) => (
            <div key={f.id} className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.color }} />
              <div>
                <p className="text-sm font-medium text-fg">
                  {f.label} — {f.descripcion} <span className="font-normal text-faint">({f.meses} meses)</span>
                </p>
                <p className={`text-sm text-muted ${hideAmounts ? 'select-none blur-sm' : ''}`}>{f.prosa}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Hito</th>
              <th className="text-right">Total aportado real</th>
              <th className="text-right">4%</th>
              <th className="text-right">7% (base)</th>
              <th className="text-right">10%</th>
              <th className="text-right">Plusvalía base</th>
            </tr>
          </thead>
          <tbody>
            {HITOS.map((h) => (
              <tr key={h.hito}>
                <td className="font-medium text-fg">{h.hito}</td>
                <MoneyCell value={h.totalAportado} hideAmounts={hideAmounts} />
                <MoneyCell value={h.esc4} hideAmounts={hideAmounts} />
                <MoneyCell value={h.esc7} hideAmounts={hideAmounts} />
                <MoneyCell value={h.esc10} hideAmounts={hideAmounts} />
                <td className="text-right text-emerald-600">
                  <Money value={h.plusvalia} className={hideAmounts ? 'select-none blur-sm' : ''} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
