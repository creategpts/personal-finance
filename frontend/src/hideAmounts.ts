import { useSyncExternalStore } from 'react'

// Global "hide/blur amounts" preference, persisted. One toggle blurs money everywhere.
const KEY = 'hideAmounts'
let value = localStorage.getItem(KEY) === '1'
const subs = new Set<() => void>()

export function toggleHideAmounts() {
  value = !value
  localStorage.setItem(KEY, value ? '1' : '0')
  subs.forEach((f) => f())
}

export function useHideAmounts() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => value,
  )
}
