import { Link, NavLink, Route, Routes } from 'react-router-dom'
import Panel from './pages/Panel'
import Movimientos from './pages/Movimientos'
import Planificacion from './pages/Planificacion'
import Evolucion from './pages/Evolucion'
import Configuracion from './pages/Configuracion'
import UserMenu from './components/UserMenu'
import { useSettings } from './settings'

const navItems = [
  { to: '/movimientos', label: 'Movimientos', end: false },
  { to: '/planificacion', label: 'Planificación', end: false },
  { to: '/evolucion', label: 'Evolución', end: false },
]

function App() {
  const { app_name, favicon } = useSettings()
  return (
    <div className="flex h-screen overflow-hidden text-fg">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
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
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex h-full max-w-[1600px] flex-col px-8 py-8">
          <Routes>
            <Route path="/" element={<Panel />} />
            <Route path="/movimientos" element={<Movimientos />} />
            <Route path="/planificacion" element={<Planificacion />} />
            <Route path="/evolucion" element={<Evolucion />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
