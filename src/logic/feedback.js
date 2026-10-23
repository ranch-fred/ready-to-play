// Small physical feedback: a light buzz on taps and a stronger one for moments that matter.
// Works where the browser allows vibration (most Android phones); quietly does nothing elsewhere.
export function haptic(pattern = 8) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not supported: the on-screen feedback is still there.
  }
}

const TAPPABLE = '.btn, .choice, .tile, .tabbar button, .seg button, .zone-label, .path-node, .back'

export function installTapHaptics() {
  if (typeof document === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = e.target instanceof Element ? e.target.closest(TAPPABLE) : null
      if (el && !el.disabled) haptic(6)
    },
    { passive: true },
  )
}
