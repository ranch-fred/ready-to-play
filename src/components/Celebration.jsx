import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../logic/feedback'

const COLORS = ['#ff7a45', '#ffd23f', '#3ddc97', '#4cc9f0', '#b388ff', '#ff6b9d']

// Confetti drops from the top, and a small card says you're done and it's time to get stronger.
export function Celebration({ onStrengthen }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.6,
        dur: 2.6 + Math.random() * 2.2,
        size: 7 + Math.random() * 7,
        color: COLORS[i % COLORS.length],
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
        sway: (Math.random() - 0.5) * 120,
        round: i % 3 === 0,
      })),
    [],
  )
  useEffect(() => {
    haptic([30, 50, 30, 50, 60])
  }, [])

  return createPortal(
    <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title">
      <div className="confetti" aria-hidden="true">
        {pieces.map((p, i) => (
          <i
            key={i}
            style={{
              left: p.left + '%',
              width: p.size,
              height: p.round ? p.size : p.size * 0.5,
              borderRadius: p.round ? '50%' : '2px',
              background: p.color,
              animationDelay: p.delay + 's',
              animationDuration: p.dur + 's',
              '--spin': p.spin + 'deg',
              '--sway': p.sway + 'px',
            }}
          />
        ))}
      </div>
      <div className="celebrate-card">
        <p className="celebrate-emoji" aria-hidden="true">🎉</p>
        <h2 id="celebrate-title">You're done. Yay!</h2>
        <p>You're fully recovered. Now it's time to strengthen it.</p>
        <button className="btn primary" onClick={onStrengthen}>Let's get strong</button>
      </div>
    </div>,
    document.body,
  )
}
