import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import UserMenu from './UserMenu'
import { useSettings } from '../settings'

export default function PageHeader({ crumbs = [], children }: { crumbs?: { label: string; to?: string }[]; children?: ReactNode }) {
  const { app_name, favicon } = useSettings()
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line pb-3">
      <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1.5">
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-80">
          <span className="text-lg leading-none">{favicon}</span>
          <span className="text-base font-semibold tracking-tight">{app_name}</span>
        </Link>
        {crumbs.map((c, i) => (
          <span key={c.label} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight size={15} className="shrink-0 text-faint" aria-hidden />
            {c.to && i < crumbs.length - 1 ? (
              <Link to={c.to} className="truncate text-base text-muted hover:text-fg">
                {c.label}
              </Link>
            ) : (
              <span className="truncate text-base font-medium text-fg" aria-current="page">
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      {children ?? <span className="flex-1" />}
      <UserMenu openDown avatarOnly />
    </header>
  )
}
