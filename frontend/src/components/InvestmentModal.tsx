import { useState } from 'react'
import { api, type Investment, type InvestmentInput, type InvestmentType } from '../api'
import { INVESTMENT_TYPE_LABELS } from '../investmentColors'
import Modal from './Modal'
import { TrashIcon } from './Icons'

interface Props {
  initial?: Investment | null
  onClose: () => void
  onSave: (data: InvestmentInput) => Promise<void>
  onDelete?: () => Promise<void>
  onRefreshPrice?: () => Promise<void>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

export default function InvestmentModal({ initial, onClose, onSave, onDelete, onRefreshPrice }: Props) {
  const editing = !!initial

  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<InvestmentType>(initial?.type ?? 'fondo_indexado')
  const [isin, setIsin] = useState(initial?.isin ?? '')
  const [targetWeight, setTargetWeight] = useState(initial?.target_weight?.toString() ?? '0')
  const [ftSymbol, setFtSymbol] = useState(initial?.ft_symbol ?? '')
  const [currentPrice, setCurrentPrice] = useState(initial?.current_price?.toString() ?? '0')
  const [active, setActive] = useState(initial?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  async function handleIsinBlur() {
    if (!isin) return
    setLookupBusy(true)
    setLookupError(null)
    try {
      const result = await api.investments.priceLookup(isin)
      if (result.ok && result.price != null) {
        setCurrentPrice(String(result.price))
        if (!ftSymbol) setFtSymbol(`${isin}:EUR`)
      } else {
        setLookupError(result.error ?? 'No se pudo obtener el valor liquidativo')
      }
    } catch {
      setLookupError('No se pudo obtener el valor liquidativo')
    } finally {
      setLookupBusy(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSave({
        name,
        type,
        isin: isin || null,
        target_weight: Number(targetWeight),
        ft_symbol: ftSymbol || null,
        active,
        current_price: Number(currentPrice),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={editing ? 'Editar inversión' : 'Nueva inversión'}
      size="md"
      onClose={onClose}
      onSubmit={handleSubmit}
      headerAction={
        <button type="submit" disabled={busy} className="btn-primary">
          {editing ? 'Guardar' : 'Crear inversión'}
        </button>
      }
      footer={
        onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-red-500 transition hover:text-red-700"
          >
            <TrashIcon /> Eliminar inversión
          </button>
        )
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre">
            <input required autoFocus className="input" placeholder="MSCI World Indexado…" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="ISIN">
            <input className="input" placeholder="Opcional" value={isin} onChange={(e) => setIsin(e.target.value)} onBlur={handleIsinBlur} />
            {lookupBusy && <span className="mt-1 block text-xs text-faint">Buscando valor liquidativo…</span>}
            {!lookupBusy && lookupError && <span className="mt-1 block text-xs text-red-500">{lookupError}</span>}
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">Tipo</span>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(INVESTMENT_TYPE_LABELS) as InvestmentType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  type === t ? 'border-fg bg-surface2 text-fg' : 'border-line text-muted hover:text-fg'
                }`}
              >
                {INVESTMENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Peso objetivo cartera">
            <div className="relative">
              <input type="number" step="0.1" min="0" max="100" className="input pr-8" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">%</span>
            </div>
          </Field>
          <Field label="Valor liquidativo actual">
            <input type="number" step="0.0001" min="0" className="input" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} />
          </Field>
          <Field label="Símbolo FT (s=)">
            <input className="input" placeholder="LU1234567890:EUR" value={ftSymbol} onChange={(e) => setFtSymbol(e.target.value)} />
          </Field>
        </div>

        {editing && onRefreshPrice && (ftSymbol || isin) && (
          <button type="button" disabled={busy} onClick={onRefreshPrice} className="btn text-sm">
            Actualizar precio desde FT
          </button>
        )}

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-line px-3 py-2.5 text-sm">
          <span className="font-medium text-fg">Activa (cuenta en composición de cartera)</span>
          <input type="checkbox" className="h-4 w-4 accent-fg" checked={active} onChange={(e) => setActive(e.target.checked)} />
        </label>
      </div>
    </Modal>
  )
}
