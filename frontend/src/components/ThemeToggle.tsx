import { useState } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.theme = next ? 'dark' : 'light'
  }

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-fg"
    >
      Modo oscuro
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
          dark ? 'bg-primary' : 'bg-line'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow transition ${
            dark ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}
