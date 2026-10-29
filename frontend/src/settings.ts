import { useSyncExternalStore } from 'react'
import { api } from './api'

// App-wide settings (app name, user name, favicon emoji), backed by /api/settings.
// One store, live-updates every subscriber. Favicon + title applied to <head> on change.
export interface Settings {
  app_name: string
  user_name: string
  favicon: string // an emoji
  default_origin: string // Category.name preselected as Origen in a new movement ('' = first available)
  default_destination: string // Category.name preselected as Destino in a new movement ('' = first available)
  liquidity_account: string // Cuenta (Ahorro) whose balance minus emergency_fund is the pull for buying dips ('' = none)
  emergency_fund: string // € of that account reserved and never touched
  dip_levels: string // comma-separated % drawdown thresholds for the buy alerts, ascending (e.g. '5,10,20')
  investment_destination_account: string // Cuenta they land in
  investment_reval_category: string // Categoría de ingreso que origina el movimiento mensual de revalorización
  investment_deval_category: string // Categoría de gasto que recibe el de devaluación
}

const DEFAULTS: Settings = {
  app_name: 'Life Track',
  user_name: 'Usuario',
  favicon: '🏛️',
  default_origin: '',
  default_destination: '',
  liquidity_account: '',
  emergency_fund: '0',
  dip_levels: '5,10,20',
  investment_destination_account: '',
  investment_reval_category: '',
  investment_deval_category: '',
}

let value: Settings = { ...DEFAULTS }
const subs = new Set<() => void>()

function applyToHead(s: Settings) {
  document.title = s.app_name
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${s.favicon}</text></svg>`
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function set(next: Settings) {
  value = next
  applyToHead(value)
  subs.forEach((f) => f())
}

// fire-and-forget on startup; UI renders with defaults then updates
export async function loadSettings() {
  const s = await api.settings.get().catch(() => ({}))
  set({ ...DEFAULTS, ...s })
}

export async function saveSettings(patch: Partial<Settings>) {
  set({ ...value, ...patch })
  await api.settings.set(patch)
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => value,
  )
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || ''
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?'
}
