import { useState } from 'react'
import { haptic } from '../logic/feedback'
import { setTheme, useTheme } from '../logic/theme'

// The little buddy that goes with you. It starts as an egg, hatches into a chick while you recover, and then
// grows from a mouse to a gorilla. Tap it and it hops.
const CHEERS = ['Yay!', 'You got this!', 'Boing!', 'Ooh, that tickles!', 'Keep going!', 'Hehe!']

export function Mascot({ emoji, size = 'md', says, ring, label }) {
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
        <span className="mascot-face" key={pokes} aria-hidden="true">{emoji}</span>
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
