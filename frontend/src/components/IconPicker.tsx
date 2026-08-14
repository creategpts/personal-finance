import { useState } from 'react'
import { icons } from 'lucide-react'
import CategoryIcon from './CategoryIcon'

const ALL_NAMES = Object.keys(icons)

// shown before the user searches — common categories for a personal finance app
const CURATED = [
  'Utensils', 'Coffee', 'ShoppingCart', 'House', 'Car', 'Bus', 'Fuel', 'Plane',
  'Wine', 'Film', 'Gamepad2', 'Music', 'PartyPopper', 'Dumbbell',
  'HeartPulse', 'Stethoscope', 'Pill', 'GraduationCap', 'BookOpen', 'Briefcase',
  'Wallet', 'Banknote', 'PiggyBank', 'TrendingUp', 'Coins', 'Percent', 'Landmark',
  'CreditCard', 'Receipt', 'Gift', 'Smartphone', 'Wifi', 'Repeat', 'Baby', 'Dog',
  'Shirt', 'Scissors', 'Wrench', 'Package', 'Plus', 'Tag',
].filter((n) => n in icons)

export default function IconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const results = q ? ALL_NAMES.filter((n) => n.toLowerCase().includes(q)).slice(0, 60) : CURATED

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center gap-2 text-left"
      >
        <CategoryIcon name={value} />
        <span className="flex-1 text-fg">{value}</span>
        <span className="text-xs text-faint">{open ? 'Cerrar' : 'Cambiar'}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-line bg-surface p-2">
          <input
            autoFocus
            className="input mb-2"
            placeholder="Buscar icono (p. ej. coffee, home, car)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto">
            {results.map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name)
                  setOpen(false)
                  setQuery('')
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface2 ${
                  name === value ? 'bg-surface2 ring-1 ring-fg/30' : ''
                }`}
              >
                <CategoryIcon name={name} />
              </button>
            ))}
            {results.length === 0 && (
              <p className="col-span-8 py-4 text-center text-xs text-faint">Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
