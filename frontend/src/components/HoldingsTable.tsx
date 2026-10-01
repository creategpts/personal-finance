import { useNavigate } from 'react-router-dom'
import type { Investment } from '../api'
import Money from './Money'
import { PencilIcon } from './Icons'

export default function HoldingsTable({
  title,
  holdings,
  lumpSum,
  hideAmounts,
  onEdit,
}: {
  title: string
  holdings: Investment[]
  lumpSum: boolean
  hideAmounts: boolean
  onEdit: (inv: Investment) => void
}) {
  const navigate = useNavigate()
  const blur = hideAmounts ? 'select-none blur-sm' : ''
  const sorted = [...holdings].sort((a, b) => b.stats.valor_actual - a.stats.valor_actual)

  return (
    <div className="card mb-6 overflow-hidden">
      <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-fg">{title}</h3>
      <table className="tbl">
        <thead>
          <tr>
            <th>Nombre</th>
            {!lumpSum && <th>ISIN</th>}
            {!lumpSum && <th className="text-right">Participaciones</th>}
            <th className="text-right">Total {lumpSum ? 'aportado' : 'invertido'}</th>
            {!lumpSum && <th className="text-right">Precio medio</th>}
            {!lumpSum && <th className="text-right">Valor liquidativo</th>}
            <th className="text-right">Valor de mercado</th>
            <th className="text-right">Plusvalía</th>
            <th className="text-right">Rentabilidad</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((inv) => (
            <tr
              key={inv.id}
              onClick={() => navigate(`/inversion/${inv.id}`)}
              className={`cursor-pointer hover:bg-surface2 ${inv.active ? '' : 'opacity-50'}`}
            >
              <td className="font-medium text-fg">{inv.name}</td>
              {!lumpSum && <td className="text-muted">{inv.isin ?? '—'}</td>}
              {!lumpSum && <td className="text-right num">{inv.stats.units_held}</td>}
              <td className="text-right"><Money value={inv.stats.total_invertido} className={blur} /></td>
              {!lumpSum && <td className="text-right"><Money value={inv.stats.avg_cost} className={blur} /></td>}
              {!lumpSum && <td className="text-right"><Money value={inv.current_price} className={blur} /></td>}
              <td className="text-right"><Money value={inv.stats.valor_actual} className={blur} /></td>
              <td className={`text-right ${inv.stats.plusvalia < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                <Money value={inv.stats.plusvalia} className={blur} />
              </td>
              <td className={`text-right font-medium ${inv.stats.rentabilidad < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {inv.stats.rentabilidad.toFixed(2)}%
              </td>
              <td>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(inv)
                  }}
                  aria-label="Editar inversión"
                  title="Editar inversión"
                  className="text-faint hover:text-fg"
                >
                  <PencilIcon />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
