import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import HideAmountsToggle from './HideAmountsToggle'
import { useSettings, initialsOf } from '../settings'

export default function UserMenu({ openDown, avatarOnly }: { openDown?: boolean; avatarOnly?: boolean }) {
  const [open, setOpen] = useState(false)
  const { user_name } = useSettings()

  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}

      {open && (
        <div
          className={`absolute z-20 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-lg ${
            openDown ? 'right-0 top-full mt-2 w-56' : 'bottom-full left-0 mb-2 w-full'
          }`}
        >
          <NavLink
            to="/configuracion"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm transition ${
                isActive ? 'bg-surface2 font-medium text-fg' : 'text-muted hover:bg-surface2 hover:text-fg'
              }`
            }
          >
            Configuración
          </NavLink>
          <ThemeToggle />
          <HideAmountsToggle />
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2.5 rounded-lg text-sm transition hover:bg-surface2 ${avatarOnly ? 'p-1' : 'w-full px-2 py-1.5'}`}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primaryfg">
          {initialsOf(user_name)}
        </span>
        {!avatarOnly && <span className="truncate font-medium text-fg">{user_name}</span>}
      </button>
    </div>
  )
}
