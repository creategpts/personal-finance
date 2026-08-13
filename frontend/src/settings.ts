import { useSyncExternalStore } from 'react'
import { api } from './api'

// App-wide settings (app name, user name, favicon emoji), backed by /api/settings.
// One store, live-updates every subscriber. Favicon + title applied to <head> on change.
export interface Settings {
  app_name: string
  user_name: string
  favicon: string // an emoji
}

const DEFAULTS: Settings = { app_name: 'Life Track', user_name: 'Usuario', favicon: '🏛️' }

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
