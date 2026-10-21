import { useEffect, useRef, useState } from 'react'

const STEPS = [
  'Reading your answers',
  'Finding the best recovery methods',
  'Creating your timeline',
  'Adding a safety cushion',
]
const DURATION = 6500

export function Loading({ onDone }) {
  const [step, setStep] = useState(0)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), DURATION / STEPS.length)
    const done = setTimeout(() => doneRef.current(), DURATION)
    return () => {
      clearInterval(tick)
      clearTimeout(done)
    }
  }, [])

  return (
    <div className="screen loading">
      <div className="loading-center">
        <div className="loading-orb" aria-hidden="true" />
        <p className="loading-text" aria-live="polite" key={step}>{STEPS[step]}…</p>
        <div className="loading-bar"><span style={{ animationDuration: `${DURATION}ms` }} /></div>
        <ul className="loading-steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
