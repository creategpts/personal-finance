import { useEffect, useState } from 'react'
import { api, type Category, type CategoryType } from '../api'
import { isAccount } from '../categoryTypes'
import { ACCOUNT_TYPES, typeLabel as typeLabelOf } from '../accountTypes'
import InfoHint from '../components/InfoHint'
import CategoryModal from '../components/CategoryModal'
import { useSettings, saveSettings } from '../settings'

function SimpleCategoryList({
  title,
  columnLabel,
  info,
  type,
  categories,
  onChanged,
}: {
  title: string
  columnLabel: string
  info: string
  type: CategoryType
  categories: Category[]
  onChanged: () => void
}) {
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const items = categories.filter((c) => c.type === type)
  const countKey = type === 'income' ? 'es_ingreso' : 'es_gasto'
  const countHeader = type === 'income' ? 'Es ingreso' : 'Es gasto'
  const isIncome = type === 'income'

  async function save(data: { name: string; type: CategoryType; visible: boolean; initial_balance: number }) {
    if (editing && editing !== 'new') {
      // merge over existing: the modal only edits name/type/visible/balance; spreading
      // keeps the toggle flags (es_ingreso/es_gasto/es_pasivo/include_in_total) intact.
      await api.categories.update(editing.id, { ...editing, ...data })
    } else {
      await api.categories.create(data)
    }
    setEditing(null)
    onChanged()
  }

  async function togglePasivo(c: Category) {
    await api.categories.update(c.id, { ...c, es_pasivo: !c.es_pasivo })
    onChanged()
  }

  async function remove(id: number) {
    if (!confirm('¿Eliminar esta categoría?')) return
    await api.categories.remove(id)
    onChanged()
  }

  async function toggleCount(c: Category) {
    await api.categories.update(c.id, { ...c, [countKey]: !c[countKey] })
    onChanged()
  }

  return (
    <div>
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>
                <span className="inline-flex items-center gap-1">
                  {columnLabel}
                  <InfoHint text={info} />
                </span>
              </th>
              {isIncome && <th>Tipo</th>}
              <th>{countHeader}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr
                key={c.id}
                onClick={() => setEditing(c)}
                className="cursor-pointer hover:bg-surface2"
              >
                <td className="font-medium text-fg">{c.name}</td>
                {isIncome && (
                  <td>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePasivo(c)
                      }}
                      title="Ingreso pasivo (intereses, dividendos, alquiler) vs activo (trabajo)"
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.es_pasivo
                          ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400'
                          : 'bg-surface2 text-muted'
                      }`}
                    >
                      {c.es_pasivo ? 'Pasivo' : 'Activo'}
                    </button>
                  </td>
                )}
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleCount(c)
                    }}
                    title={`${countHeader}: click para cambiar`}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c[countKey] ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-surface2 text-muted'
                    }`}
                  >
                    {c[countKey] ? 'Sí' : 'No'}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={isIncome ? 3 : 2} className="px-4 py-10 text-center text-faint">
                  Sin categorías
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex justify-end">
        <button onClick={() => setEditing('new')} className="btn-primary">
          + Añadir
        </button>
      </div>

      {editing && (
        <CategoryModal
          title={editing === 'new' ? `Nueva categoría de ${title.toLowerCase()}` : 'Editar categoría'}
          initial={editing === 'new' ? null : editing}
          fixedType={type}
          onClose={() => setEditing(null)}
          onDelete={
            editing !== 'new'
              ? async () => {
                  await remove(editing.id)
                  setEditing(null)
                }
              : undefined
          }
          onSave={save}
        />
      )}
    </div>
  )
}

function CuentasSection({ categories, onChanged }: { categories: Category[]; onChanged: () => void }) {
  const items = categories.filter((c) => isAccount(c.type))
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  async function save(data: { name: string; type: CategoryType; visible: boolean; initial_balance: number }) {
    if (editing && editing !== 'new') {
      // merge over existing so include_in_total/visible survive a rename (see SimpleCategoryList)
      await api.categories.update(editing.id, { ...editing, ...data })
    } else {
      await api.categories.create(data)
    }
    setEditing(null)
    onChanged()
  }

  async function remove(id: number) {
    if (!confirm('¿Eliminar esta cuenta?')) return
    await api.categories.remove(id)
    onChanged()
  }

  async function toggleVisible(c: Category) {
    await api.categories.update(c.id, { ...c, visible: !c.visible })
    onChanged()
  }

  async function toggleIncludeInTotal(c: Category) {
    await api.categories.update(c.id, { ...c, include_in_total: !c.include_in_total })
    onChanged()
  }

  const typeLabel = (t: CategoryType) => typeLabelOf(t)
  const typeOptions = ACCOUNT_TYPES.map((t) => ({ value: t.key, label: t.label }))

  return (
    <div>
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>Cuenta</th>
              <th>Tipo</th>
              <th>
                <span className="inline-flex items-center gap-1">
                  En patrimonio total
                  <InfoHint text="Si está activo, el saldo de esta cuenta suma al «Valor total de activos» del Inicio. No = no cuenta en ese total." />
                </span>
              </th>
              <th>
                <span className="inline-flex items-center gap-1">
                  Mostrar
                  <InfoHint text="Si está oculta, no aparece en la fila de saldos por cuenta. No afecta al saldo, los movimientos, ni a los desplegables de Origen/Destino." />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr
                key={c.id}
                onClick={() => setEditing(c)}
                className={`cursor-pointer hover:bg-surface2 ${c.visible ? '' : 'opacity-50'}`}
              >
                <td className="font-medium text-fg">{c.name}</td>
                <td className="text-faint">{typeLabel(c.type)}</td>
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleIncludeInTotal(c)
                    }}
                    title="Incluir/excluir del valor total de activos"
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.include_in_total ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-surface2 text-muted'
                    }`}
                  >
                    {c.include_in_total ? 'Sí' : 'No'}
                  </button>
                </td>
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleVisible(c)
                    }}
                    title={c.visible ? 'Ocultar en Inicio' : 'Mostrar en Inicio'}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.visible ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-surface2 text-muted'
                    }`}
                  >
                    {c.visible ? 'Sí' : 'No'}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-faint">
                  Sin cuentas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex justify-end">
        <button onClick={() => setEditing('new')} className="btn-primary">
          + Nueva cuenta
        </button>
      </div>

      {editing && (
        <CategoryModal
          title={editing === 'new' ? 'Nueva cuenta' : 'Editar cuenta'}
          initial={editing === 'new' ? null : editing}
          typeOptions={typeOptions}
          showBalance
          onClose={() => setEditing(null)}
          onDelete={
            editing !== 'new'
              ? async () => {
                  await remove(editing.id)
                  setEditing(null)
                }
              : undefined
          }
          onSave={save}
        />
      )}
    </div>
  )
}

function BackupSection() {
  const [dir, setDir] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  function load() {
    api.backup.list().then((r) => {
      setDir(r.dir)
      setFiles(r.files)
    })
  }
  useEffect(load, [])

  async function create() {
    setBusy(true)
    try {
      const r = await api.backup.create()
      const n = Object.values(r.counts).reduce((a, b) => a + b, 0)
      alert(`Copia creada: ${r.file} (${n} registros)`)
      load()
    } finally {
      setBusy(false)
    }
  }

  async function restore(file: string) {
    if (
      !confirm(
        `Restaurar «${file}»?\n\nSe REEMPLAZARÁN todos los datos actuales (cuentas, categorías, movimientos, presupuestos y recurrentes). Acción irreversible.`,
      )
    )
      return
    setBusy(true)
    try {
      await api.backup.restore(file)
      alert('Copia restaurada. Se recargará la app.')
      window.location.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-4">
        <p className="text-sm text-muted">
          Copia completa de la base de datos: cuentas, categorías, movimientos, presupuestos y
          gastos recurrentes.
        </p>
        <button onClick={create} disabled={busy} className="btn-primary shrink-0">
          Crear copia
        </button>
      </div>
      <p className="mb-3 text-xs text-faint">
        Carpeta: <span className="num">{dir || '…'}</span>
      </p>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>Copia de seguridad</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f}>
                <td className="num font-medium text-fg">{f}</td>
                <td className="text-right">
                  <button onClick={() => restore(f)} disabled={busy} className="btn">
                    Restaurar
                  </button>
                </td>
              </tr>
            ))}
            {files.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-faint">
                  Sin copias todavía
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GeneralSection() {
  const settings = useSettings()
  const [appName, setAppName] = useState(settings.app_name)
  const [userName, setUserName] = useState(settings.user_name)
  const [favicon, setFavicon] = useState(settings.favicon)
  const [saving, setSaving] = useState(false)

  // settings load async on startup; resync the form once they arrive (and after save)
  useEffect(() => {
    setAppName(settings.app_name)
    setUserName(settings.user_name)
    setFavicon(settings.favicon)
  }, [settings])

  const dirty =
    appName !== settings.app_name || userName !== settings.user_name || favicon !== settings.favicon

  async function save() {
    setSaving(true)
    try {
      await saveSettings({ app_name: appName.trim(), user_name: userName.trim(), favicon: favicon.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md">
      <div className="card p-6">
        <label className="mb-4 block text-sm">
          Nombre de la aplicación
          <input className="mt-1 input" value={appName} onChange={(e) => setAppName(e.target.value)} />
        </label>
        <label className="mb-4 block text-sm">
          Nombre de usuario
          <input className="mt-1 input" value={userName} onChange={(e) => setUserName(e.target.value)} />
        </label>
        <label className="block text-sm">
          Favicon (un emoji)
          <div className="mt-1 flex items-center gap-3">
            <input
              className="input w-20 text-center text-lg"
              value={favicon}
              maxLength={4}
              onChange={(e) => setFavicon(e.target.value)}
            />
            <span className="text-2xl">{favicon}</span>
          </div>
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={save} disabled={!dirty || saving} className="btn-primary">
          Guardar
        </button>
      </div>
    </div>
  )
}

export default function Configuracion() {
  const [categories, setCategories] = useState<Category[]>([])
  const [tab, setTab] = useState<'general' | 'cuentas' | 'categorias' | 'backup'>('general')

  function refresh() {
    api.categories.list().then(setCategories)
  }

  useEffect(refresh, [])

  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Configuración</h1>

      <div className="mb-5 inline-flex gap-0.5 rounded-lg border border-line bg-surface p-0.5">
        {([
          ['general', 'General'],
          ['cuentas', 'Cuentas'],
          ['categorias', 'Categorías'],
          ['backup', 'Copia de seguridad'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === key ? 'bg-primary text-primaryfg' : 'text-muted hover:text-fg'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralSection />}

      {tab === 'cuentas' && <CuentasSection categories={categories} onChanged={refresh} />}

      {tab === 'categorias' && (
        <div className="grid grid-cols-2 gap-4">
          <SimpleCategoryList
            title="Ingresos"
            columnLabel="Orígenes"
            info="Categorías de ingreso: solo pueden ser Origen de un movimiento, nunca Destino. El dinero entra a una cuenta desde aquí."
            type="income"
            categories={categories}
            onChanged={refresh}
          />
          <SimpleCategoryList
            title="Gastos"
            columnLabel="Destinos"
            info="Categorías de gasto: solo pueden ser Destino de un movimiento, nunca Origen. El dinero sale de una cuenta hacia aquí."
            type="expense"
            categories={categories}
            onChanged={refresh}
          />
        </div>
      )}

      {tab === 'backup' && <BackupSection />}
    </div>
  )
}
