import { useEffect } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AuthView, SignedIn, SignedOut } from '@neondatabase/auth/react/ui'
import { ArrowLeftRight, ChartPie, Target, TrendingUp } from 'lucide-react'
import Panel from './pages/Panel'
import Movimientos from './pages/Movimientos'
import Analisis from './pages/Analisis'
import Planificacion from './pages/Planificacion'
import Inversion from './pages/Inversion'
import InvestmentLedger from './pages/InvestmentLedger'
import Configuracion from './pages/Configuracion'
import UserMenu from './components/UserMenu'
import { loadSettings, useSettings } from './settings'
import { authClient } from './lib/auth-client'

const navItems = [
  { to: '/movimientos', label: 'Movimientos', end: false, icon: ArrowLeftRight },
  { to: '/analisis', label: 'Análisis', end: false, icon: ChartPie },
  { to: '/planificacion', label: 'Planificación', end: false, icon: Target },
  { to: '/inversion', label: 'Inversión', end: false, icon: TrendingUp },
]

function AuthPage() {
  const { pathname } = useParams()
  return (
    <div className="flex min-h-screen items-center justify-center">
      <AuthView pathname={pathname} />
    </div>
  )
}

let shellMountCount = 0

function Shell() {
  const { app_name, favicon } = useSettings()
  useEffect(() => {
    loadSettings()
    shellMountCount += 1
    console.log('SHELL MOUNT #', shellMountCount)
    return () => console.log('SHELL UNMOUNT')
  }, [])
  const session = authClient.useSession()
  console.log('RENDER session.isPending=', session.isPending, 'hasData=', !!session.data)
  return (
    <div className="flex h-screen flex-col overflow-hidden text-fg md:flex-row">
      <div className="fixed bottom-0 left-0 z-50 bg-red-600 p-1 text-xs text-white">
        mounts: {shellMountCount} / isPending: {String(session.isPending)} / hasData: {String(!!session.data)}
      </div>
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80">
          <span className="text-lg leading-none">{favicon}</span>
          <span className="text-lg font-semibold tracking-tight">{app_name}</span>
        </Link>
        <div className="w-44">
          <UserMenu openDown />
        </div>
      </header>

      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <Link to="/" className="flex items-center gap-2 px-5 py-5 hover:opacity-80">
          <span className="text-lg leading-none">{favicon}</span>
          <span className="text-lg font-semibold tracking-tight">{app_name}</span>
        </Link>
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
        <div className="mx-auto flex h-full max-w-[1600px] flex-col px-4 py-5 pb-20 sm:px-6 md:px-8 md:py-8 md:pb-8">
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

      <nav className="fixed inset-x-0 bottom-0 z-30 flex shrink-0 border-t border-line bg-surface/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg backdrop-saturate-150 md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 pt-2 text-center transition-transform active:scale-95 ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={24} strokeWidth={isActive ? 2.3 : 1.8} />
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
