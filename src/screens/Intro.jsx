import { rules } from '../logic/triage'
import { Mascot, ThemeToggle } from '../components/Mascot'

export function Intro({ onStart }) {
  return (
    <div className="screen intro">
      <div className="intro-hero">
        <div className="intro-mascot play-only"><Mascot emoji="🐣" says="Hi! Hurt? I'll help you bounce back." size="lg" /></div>
        <div className="logo">
          READY<span>TO</span>PLAY
        </div>
        <h1 className="intro-headline">Hurt? Know what to do next.</h1>
        <p className="intro-copy">
          Find out if you need a doctor, how to recover, and roughly when you'll be back. Takes about 2 minutes.
        </p>
        <ul className="intro-points">
          <li>Quick check of how bad it is</li>
          <li>Day-by-day recovery plan</li>
          <li>Return date that's honest, not hopeful</li>
        </ul>
      </div>
      <div className="footer">
        <button className="btn primary" onClick={onStart}>I got hurt</button>
      </div>
      <ThemeToggle />
      <p className="disclaimer">{rules.meta.disclaimer}</p>
    </div>
  )
}
