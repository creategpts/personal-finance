import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, type Category, type KpiName, type Movement, type MovementInput, type MovementStatus } from '../api'
import MovementModal from '../components/MovementModal'
import BulkEditModal, { type BulkOverrides } from '../components/BulkEditModal'
import CsvPreviewModal from '../components/CsvPreviewModal'
import AccountBar from '../components/AccountBar'
import Money from '../components/Money'
import { EyeIcon, EyeOffIcon } from '../components/Icons'
import { toCsv, parseCsv } from '../csv'
import { isOrigin, isDestination } from '../categoryTypes'
import { useHideAmounts, toggleHideAmounts } from '../hideAmounts'
import PeriodSelector from '../components/PeriodSelector'

const CSV_COLUMNS = ['date', 'concept', 'amount', 'status', 'origin', 'destination'] as const

// "2026-08-09" -> "09/08/2026" (no TZ shift)
const formatDate = (iso: string) => iso.split('-').reverse().join('/')

const KPI_LABELS: Record<KpiName, string> = {
  income: 'Ingresos',
  expense: 'Gastos',
  saving: 'Ahorro',
  investment: 'Inversión',
}

// round checkbox: soft-green fill + tick when checked, subtle ring when not
function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={`inline-grid h-[18px] w-[18px] place-items-center rounded-full border align-middle transition ${
        checked
          ? 'border-emerald-500/70 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : 'border-line text-transparent hover:border-faint'
      }`}
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 6.2l2.3 2.3L9.5 3.8" />
      </svg>
    </button>
  )
}

export default function Movimientos() {
  const [searchParams, setSearchParams] = useSearchParams()
  // KPI filter (income/expense/saving/investment): aggregates several origins/destinations,
  // so it can't be a single-field bar control -> lives in the URL, applied server-side, shown as a chip.
  const kpi = searchParams.get('kpi') as KpiName | null
  const hideAmounts = useHideAmounts()

  const [movements, setMovements] = useState<Movement[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [editing, setEditing] = useState<Movement | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [accountsKey, setAccountsKey] = useState(0) // bump to remount AccountBar -> refetch balances
  const [busy, setBusy] = useState(false) // CSV export/import in progress
  const [menuOpen, setMenuOpen] = useState(false) // ⋯ menu
  const [selected, setSelected] = useState<Set<number>>(new Set()) // row selection (bulk actions)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [csvPreview, setCsvPreview] = useState<MovementInput[] | null>(null) // parsed CSV awaiting review
  const fileInputRef = useRef<HTMLInputElement>(null)

  // The filter bar is the single source of truth. kpi is the ONLY server-side
  // filter (needs backend category logic); everything else filters client-side.
  const [fStatus, setFStatus] = useState<MovementStatus | 'All'>('All')
  const [fOrigin, setFOrigin] = useState('All')
  const [fDestination, setFDestination] = useState('All')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  const [fMin, setFMin] = useState('')
  const [fMax, setFMax] = useState('')

  // Drill-down from the Panel/Evolución arrives as URL params -> load them into the
  // bar. Origin/destination just set state directly; from/to are owned by
  // PeriodSelector below (seeded from the same params, keyed to reseed on a new link).
  useEffect(() => {
    setFOrigin(searchParams.get('origin') ?? 'All')
    setFDestination(searchParams.get('destination') ?? 'All')
  }, [searchParams])

  async function refresh() {
    setAccountsKey((k) => k + 1)
    const [m, c] = await Promise.all([
      api.movements.list({ ...(kpi && { kpi }) }),
      api.categories.list(),
    ])
    setMovements(m)
    setCategories(c)
  }

  useEffect(() => {
    refresh()
  }, [kpi])

  const origins = categories.filter((c) => isOrigin(c.type))
  const destinations = categories.filter((c) => isDestination(c.type))

  // Destino puede ser una categoría principal (p. ej. "Vivienda", agregada en Análisis)
  // cuyos movimientos reales están etiquetados con sus subcategorías ("Renting/Leasing"...).
  // Filtrar por igualdad estricta dejaría esos movimientos fuera — se incluyen también.
  const destinationMatchSet = useMemo(() => {
    if (fDestination === 'All') return null
    const parent = categories.find((c) => c.name === fDestination)
    const childNames = parent ? categories.filter((c) => c.parent_id === parent.id).map((c) => c.name) : []
    return new Set([fDestination, ...childNames])
  }, [fDestination, categories])

  const sorted = useMemo(() => {
    const min = fMin === '' ? -Infinity : Number(fMin)
    const max = fMax === '' ? Infinity : Number(fMax)
    return movements
      .filter((m) => fStatus === 'All' || m.status === fStatus)
      .filter((m) => fOrigin === 'All' || m.origin === fOrigin)
      .filter((m) => !destinationMatchSet || destinationMatchSet.has(m.destination))
      .filter((m) => (!fFrom || m.date >= fFrom) && (!fTo || m.date <= fTo))
      .filter((m) => m.amount >= min && m.amount <= max)
      .sort((a, b) => (sortDir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)))
  }, [movements, sortDir, fStatus, fOrigin, destinationMatchSet, fFrom, fTo, fMin, fMax])

  // Periodo is a baseline view control (always applies a range, has its own "Hoy"
  // reset), not an optional filter — it doesn't count toward hasFilters/Limpiar.
  const hasFilters =
    fStatus !== 'All' ||
    fOrigin !== 'All' ||
    fDestination !== 'All' ||
    fMin !== '' ||
    fMax !== '' ||
    kpi !== null

  function clearFilters() {
    setFStatus('All')
    setFOrigin('All')
    setFDestination('All')
    setFMin('')
    setFMax('')
    setSearchParams({})
  }

  async function handleSave(data: MovementInput) {
    if (editing) {
      await api.movements.update(editing.id, data)
    } else {
      await api.movements.create(data)
    }
    setShowModal(false)
    setEditing(null)
    await refresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este movimiento?')) return
    await api.movements.remove(id)
    await refresh()
  }

  // ---- CSV download of the selected rows ----
  function exportCsv(list: Movement[]) {
    const rows = list.map((m) => [m.date, m.concept, m.amount, m.status, m.origin, m.destination])
    const csv = toCsv([...CSV_COLUMNS], rows)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `movimientos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---- CSV import (append to existing) ----
  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    const rows = parseCsv(await file.text()).filter((r) => r.some((c) => c.trim() !== ''))
    if (rows.length < 2) return alert('CSV vacío o sin datos.')

    const header = rows[0].map((h) => h.trim().toLowerCase())
    if (header.length !== CSV_COLUMNS.length || !CSV_COLUMNS.every((c, i) => header[i] === c)) {
      return alert(
        `CSV no válido. Se esperan exactamente ${CSV_COLUMNS.length} columnas en este orden:\n${CSV_COLUMNS.join(', ')}`,
      )
    }

    const records: MovementInput[] = []
    for (const r of rows.slice(1)) {
      const amount = Number(r[2])
      if (!r[1]?.trim() || Number.isNaN(amount)) continue
      records.push({
        date: r[0]?.trim(),
        concept: r[1].trim(),
        amount,
        status: r[3]?.trim() === 'Plan' ? 'Plan' : 'Done',
        origin: r[4]?.trim() ?? '',
        destination: r[5]?.trim() ?? '',
      })
    }
    if (!records.length) return alert('No se encontraron filas válidas.')
    setCsvPreview(records) // open editable preview before inserting
  }

  async function doImport(records: MovementInput[]) {
    setBusy(true)
    let ok = 0
    try {
      for (const rec of records) {
        try {
          await api.movements.create(rec)
          ok++
        } catch {
          /* skip invalid row, keep going */
        }
      }
    } finally {
      setBusy(false)
    }
    setCsvPreview(null)
    alert(`Importados ${ok} de ${records.length}.`)
    await refresh()
  }

  // ---- row selection ----
  const allSelected = sorted.length > 0 && sorted.every((m) => selected.has(m.id))
  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected((prev) => {
      if (sorted.every((m) => prev.has(m.id))) {
        const next = new Set(prev)
        sorted.forEach((m) => next.delete(m.id))
        return next
      }
      return new Set([...prev, ...sorted.map((m) => m.id)])
    })
  }

  async function applyBulk(o: BulkOverrides) {
    for (const id of selected) {
      const m = movements.find((x) => x.id === id)
      if (!m) continue
      await api.movements.update(id, {
        concept: m.concept,
        amount: m.amount,
        status: m.status,
        date: m.date,
        origin: m.origin,
        destination: m.destination,
        ...o,
      })
    }
    setBulkOpen(false)
    setSelected(new Set())
    await refresh()
  }

  async function deleteBulk() {
    if (!confirm(`¿Eliminar ${selected.size} movimientos? Acción irreversible.`)) return
    for (const id of selected) await api.movements.remove(id)
    setSelected(new Set())
    await refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-5 flex shrink-0 items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleHideAmounts}
            className="btn"
            aria-label={hideAmounts ? 'Mostrar importes' : 'Ocultar importes'}
            title={hideAmounts ? 'Mostrar importes' : 'Ocultar importes'}
          >
            {hideAmounts ? <EyeOffIcon /> : <EyeIcon />}
            {hideAmounts ? 'Mostrar importes' : 'Ocultar importes'}
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />

      <AccountBar key={accountsKey} />

      <div className="mb-3 flex shrink-0 flex-wrap items-end gap-3">
        <div className="text-xs font-medium text-muted">
          Periodo
          <div className="mt-0.5">
            <PeriodSelector
              key={`${searchParams.get('from')}_${searchParams.get('to')}`}
              initialFrom={searchParams.get('from') ?? undefined}
              initialTo={searchParams.get('to') ?? undefined}
              onChange={(from, to) => {
                setFFrom(from)
                setFTo(to)
              }}
            />
          </div>
        </div>

        <div className="text-xs font-medium text-muted">
          Importe
          <div className="mt-0.5 flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 transition focus-within:border-faint focus-within:ring-4 focus-within:ring-fg/10">
            <input
              type="number"
              step="0.01"
              placeholder="mín"
              aria-label="Importe mín"
              className="w-16 text-sm text-fg outline-none placeholder:text-faint [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={fMin}
              onChange={(e) => setFMin(e.target.value)}
            />
            <span className="text-faint">–</span>
            <input
              type="number"
              step="0.01"
              placeholder="máx"
              aria-label="Importe máx"
              className="w-16 text-sm text-fg outline-none placeholder:text-faint [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={fMax}
              onChange={(e) => setFMax(e.target.value)}
            />
          </div>
        </div>

        <label className="text-xs font-medium text-muted">
          Estado
          <select
            className="mt-0.5 block rounded-lg border border-line px-2.5 py-1.5 text-sm text-fg outline-none transition focus:border-faint focus:ring-4 focus:ring-fg/10"
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value as MovementStatus | 'All')}
          >
            <option value="All">Todos</option>
            <option value="Plan">Plan</option>
            <option value="Done">Done</option>
          </select>
        </label>

        <label className="text-xs font-medium text-muted">
          Origen
          <select
            className="mt-0.5 block rounded-lg border border-line px-2.5 py-1.5 text-sm text-fg outline-none transition focus:border-faint focus:ring-4 focus:ring-fg/10"
            value={fOrigin}
            onChange={(e) => setFOrigin(e.target.value)}
          >
            <option value="All">Todos</option>
            {origins.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-muted">
          Destino
          <select
            className="mt-0.5 block rounded-lg border border-line px-2.5 py-1.5 text-sm text-fg outline-none transition focus:border-faint focus:ring-4 focus:ring-fg/10"
            value={fDestination}
            onChange={(e) => setFDestination(e.target.value)}
          >
            <option value="All">Todos</option>
            {destinations.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </label>

        {kpi && (
          <span className="inline-flex items-center gap-1.5 self-end rounded-lg bg-surface2 px-3 py-1.5 text-sm text-muted">
            {KPI_LABELS[kpi]}
            <button
              type="button"
              aria-label="Quitar filtro de tipo"
              onClick={() => {
                const p = new URLSearchParams(searchParams)
                p.delete('kpi')
                setSearchParams(p)
              }}
              className="text-faint hover:text-fg"
            >
              ✕
            </button>
          </span>
        )}

        {hasFilters && (
          <button onClick={clearFilters} className="btn">
            Limpiar
          </button>
        )}

        <div className="relative ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              setEditing(null)
              setShowModal(true)
            }}
            className="btn-primary"
          >
            + Nuevo movimiento
          </button>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="btn px-2"
            aria-label="Más opciones"
            title="Más opciones"
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-max overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-lg">
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    fileInputRef.current?.click()
                  }}
                  disabled={busy}
                  className="block w-full whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-muted transition hover:bg-surface2 hover:text-fg disabled:opacity-50"
                >
                  Cargar datos desde CSV
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="card min-h-0 flex-1 overflow-auto">
        <table className="tbl">
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                className="cursor-pointer select-none"
                onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
              >
                Fecha {sortDir === 'asc' ? '↑' : '↓'}
              </th>
              <th>Concepto</th>
              <th className="text-right">Importe</th>
              <th>Estado</th>
              <th>Origen</th>
              <th>Destino</th>
              <th className="w-8 text-right">
                {selected.size > 0 && <Check checked={allSelected} onChange={toggleAll} label="Seleccionar todo" />}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr
                key={m.id}
                onClick={() => {
                  setEditing(m)
                  setShowModal(true)
                }}
                className={`cursor-pointer hover:bg-surface2 ${selected.has(m.id) ? 'bg-surface2' : ''}`}
              >
                <td className="num text-muted">{formatDate(m.date)}</td>
                <td className="font-medium text-fg">{m.concept}</td>
                <td className="text-right"><Money value={m.amount} className={hideAmounts ? 'select-none blur-sm' : ''} /></td>
                <td>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.status === 'Done' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${m.status === 'Done' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {m.status}
                  </span>
                </td>
                <td>{m.origin}</td>
                <td>{m.destination}</td>
                <td className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Check checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} label="Seleccionar fila" />
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-faint">
                  Sin movimientos
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        {selected.size > 0 && (
          <aside className="w-56 shrink-0 self-start rounded-xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-fg">{selected.size} seleccionados</span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-faint transition hover:text-fg"
                aria-label="Quitar selección"
                title="Quitar selección"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => setBulkOpen(true)} className="btn w-full">
                Editar
              </button>
              <button onClick={() => exportCsv(movements.filter((m) => selected.has(m.id)))} className="btn w-full">
                Descargar CSV
              </button>
              <button onClick={deleteBulk} className="btn w-full text-red-600">
                Eliminar
              </button>
            </div>
          </aside>
        )}
      </div>

      {showModal && (
        <MovementModal
          categories={categories}
          initial={editing}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
          onDelete={
            editing
              ? async () => {
                  await handleDelete(editing.id)
                  setShowModal(false)
                  setEditing(null)
                }
              : undefined
          }
          onSave={handleSave}
        />
      )}

      {bulkOpen && (
        <BulkEditModal
          count={selected.size}
          categories={categories}
          onClose={() => setBulkOpen(false)}
          onApply={applyBulk}
        />
      )}

      {csvPreview && (
        <CsvPreviewModal
          initial={csvPreview}
          categories={categories}
          existingCount={movements.length}
          onClose={() => setCsvPreview(null)}
          onConfirm={doImport}
        />
      )}
    </div>
  )
}
