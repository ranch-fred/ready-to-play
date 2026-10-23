import { useState } from 'react'
import { haptic } from '../logic/feedback'
import { setTheme, useTheme } from '../logic/theme'

// The little buddy that goes with you. It starts as an egg, hatches into a chick while you recover, and then
// grows from a mouse to a gorilla. Tap it and it hops.
const CHEERS = ['Yay!', 'You got this!', 'Boing!', 'Ooh, that tickles!', 'Keep going!', 'Hehe!']

// A little drawn ostrich (there is no ostrich emoji).
export function OstrichSvg() {
  return (
    <svg className="ostrich" viewBox="0 0 120 140" aria-hidden="true">
      <g stroke="#f0a48f" strokeWidth="4.5" strokeLinecap="round" fill="none">
        <path d="M54 88 L50 126 L40 130" />
        <path d="M70 88 L74 126 L84 130" />
      </g>
      <ellipse cx="34" cy="66" rx="13" ry="9" fill="#fff" transform="rotate(-20 34 66)" />
      <ellipse cx="62" cy="68" rx="34" ry="26" fill="#4c3f66" />
      <ellipse cx="60" cy="70" rx="20" ry="13" fill="#7a68a0" transform="rotate(8 60 70)" />
      <path d="M82 58 C92 50 92 34 90 24" stroke="#f5b7a5" strokeWidth="9" strokeLinecap="round" fill="none" />
      <circle cx="91" cy="18" r="10" fill="#f5b7a5" />
      <path d="M99 17 L110 20 L99 23 Z" fill="#ffb347" />
      <circle cx="93" cy="15" r="2.6" fill="#17202e" />
      <circle cx="94" cy="14" r="0.9" fill="#fff" />
      <path d="M86 9 q3 -6 7 -3" stroke="#17202e" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function Mascot({ emoji, face, size = 'md', says, ring, label }) {
  const look = face ?? { face: emoji, grow: 1 }
  const [pokes, setPokes] = useState(0)
  const [cheer, setCheer] = useState(null)
  const poke = () => {
    haptic([14, 30, 14])
    setPokes((n) => n + 1)
    setCheer(CHEERS[pokes % CHEERS.length])
    setTimeout(() => setCheer(null), 1600)
  }
  return (
    <div className={`mascot ${size}`}>
      {(cheer || says) && <p className="mascot-bubble" key={cheer ?? says}>{cheer ?? says}</p>}
      <button className="mascot-btn" onClick={poke} aria-label={label ?? 'Your buddy. Tap to say hi.'}>
        {ring !== undefined && <span className="mascot-ring" style={{ '--p': ring }} aria-hidden="true" />}
        <span className="mascot-face" key={`${pokes}-${look.face ?? look.svg}`} style={{ '--grow': look.grow ?? 1 }} aria-hidden="true">
          {look.svg === 'ostrich' ? <OstrichSvg /> : look.face}
        </span>
        {look.badge && <span className="mascot-badge" aria-hidden="true">{look.badge}</span>}
      </button>
    </div>
  )
}

// Switch between the playful look and the dark athletic one.
export function ThemeToggle() {
  const theme = useTheme()
  return (
    <div className="theme-toggle" role="group" aria-label="Look and feel">
      <button className={theme === 'play' ? 'on' : ''} aria-pressed={theme === 'play'} onClick={() => setTheme('play')}>🎈 Playful</button>
      <button className={theme === 'pro' ? 'on' : ''} aria-pressed={theme === 'pro'} onClick={() => setTheme('pro')}>🏟️ Athletic</button>
    </div>
  )
}
