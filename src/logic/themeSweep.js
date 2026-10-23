import { getTheme, setTheme } from './theme'

let running = false

// Darkness creeps out from where you tapped, slowly swallows the whole screen, the look changes underneath it,
// then the dark melts away to show the new style.
export function sweepTheme(x, y) {
  if (running) return
  const next = getTheme() === 'play' ? 'pro' : 'play'
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduce || !document.body.animate) {
    setTheme(next)
    return
  }
  running = true
  const veil = document.createElement('div')
  veil.setAttribute('aria-hidden', 'true')
  Object.assign(veil.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '9999',
    pointerEvents: 'all',
    background: 'radial-gradient(circle at ' + x + 'px ' + y + 'px, #1b1233 0%, #07060d 38%, #000 100%)',
    clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)',
  })
  document.body.appendChild(veil)
  const reach = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 40
  const grow = veil.animate(
    [{ clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' }, { clipPath: 'circle(' + reach + 'px at ' + x + 'px ' + y + 'px)' }],
    { duration: 1700, easing: 'cubic-bezier(0.55, 0, 0.35, 1)', fill: 'forwards' },
  )
  const done = () => {
    veil.remove()
    running = false
  }
  grow.onfinish = () => {
    setTheme(next)
    // Let the new look paint underneath before the dark lifts.
    setTimeout(() => {
      const fade = veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease-out', fill: 'forwards' })
      fade.onfinish = done
      fade.oncancel = done
    }, 160)
  }
  grow.oncancel = done
}
