import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AuthView, SignedIn, SignedOut } from '@neondatabase/auth/react/ui'
import { ArrowLeftRight, ChartPie, Home, TrendingUp } from 'lucide-react'
import Panel from './pages/Panel'
import Movimientos from './pages/Movimientos'
import Analisis from './pages/Analisis'
import Planificacion from './pages/Planificacion'
import Inversion from './pages/Inversion'
import InvestmentLedger from './pages/InvestmentLedger'
import Configuracion from './pages/Configuracion'
import UserMenu from './components/UserMenu'
import { loadSettings, useSettings } from './settings'

const navItems = [
  { to: '/', label: 'Inicio', end: true, icon: Home },
  { to: '/movimientos', label: 'Movimientos', end: false, icon: ArrowLeftRight },
  { to: '/inversion', label: 'Inversión', end: false, icon: TrendingUp },
  { to: '/analisis', label: 'Análisis', end: false, icon: ChartPie },
]

function AuthPage() {
  const { pathname } = useParams()
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <AuthView pathname={pathname} />
    </div>
  )
}

function Shell() {
  const { app_name, favicon } = useSettings()
  const { pathname } = useLocation()
  useEffect(() => {
    loadSettings()
  }, [])
  useEffect(() => {
    document.querySelector('main')?.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className="flex h-dvh flex-col overflow-hidden text-fg md:flex-row">
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <span className="flex items-center gap-2">
          <span className="text-lg leading-none">{favicon}</span>
          <span className="text-lg font-semibold tracking-tight">{app_name}</span>
        </span>
        <UserMenu openDown avatarOnly />
      </header>

      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <span className="flex items-center gap-2 px-5 py-5">
          <span className="text-lg leading-none">{favicon}</span>
          <span className="text-lg font-semibold tracking-tight">{app_name}</span>
        </span>
        <nav className="flex flex-col gap-0.5 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-surface2 font-medium text-fg'
                    : 'text-muted hover:bg-surface2 hover:text-fg'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-line px-3 py-3">
          <UserMenu />
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1600px] flex-col px-4 py-5 pb-28 sm:px-6 md:h-full md:px-8 md:py-8 md:pb-8">
          <Routes>
            <Route path="/" element={<Panel />} />
            <Route path="/movimientos" element={<Movimientos />} />
            <Route path="/analisis" element={<Analisis />} />
            <Route path="/planificacion" element={<Planificacion />} />
            <Route path="/inversion" element={<Inversion />} />
            <Route path="/inversion/:id" element={<InvestmentLedger />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Routes>
        </div>
      </main>

      <nav className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-30 flex items-center gap-1 rounded-full border border-line bg-surface/90 p-1.5 shadow-lg backdrop-blur-lg backdrop-saturate-150 md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-2 text-center transition active:scale-95 ${
                  isActive ? 'bg-surface2 text-fg' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.3 : 1.8} />
                  <span className={`text-[10px] leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/auth/:pathname" element={<AuthPage />} />
      <Route
        path="/*"
        element={
          <>
            <SignedOut>
              <Navigate to="/auth/sign-in" replace />
            </SignedOut>
            <SignedIn>
              <Shell />
            </SignedIn>
          </>
        }
      />
    </Routes>
  )
}

export default App
