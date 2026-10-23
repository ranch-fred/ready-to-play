import { useSyncExternalStore } from 'react'

// Two looks for the same app: "play" (light, bubbly, a mascot) and "pro" (dark sports-broadcast).
// The choice is saved on this device only.
const KEY = 'readytoplay:theme'
const listeners = new Set()

function read() {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'play' || v === 'pro') return v
  } catch {
    // storage can be blocked; fall back to the default
  }
  return 'play'
}

let current = read()

export function applyTheme() {
  document.documentElement.dataset.theme = current
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', current === 'play' ? '#8fd3ff' : '#000000')
}

export function setTheme(next) {
  current = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // ignore
  }
  applyTheme()
  listeners.forEach((l) => l())
}

export function getTheme() {
  return current
}

export function useTheme() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}
