import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClock, STILL } from '../logic/clock'
import { period } from '../logic/motion'
import { ROUNDS, WORK_SECONDS, BREAK_SECONDS } from '../logic/plan'

const ExerciseModel3D = lazy(() => import('../components/ExerciseModel3D'))

// Each exercise: watch the demo once, 3-2-1, then 30 seconds on / 5 seconds break, three times.
const READY_SECONDS = 3

function useTicker(active) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf
    let last = 0
    const loop = (t) => {
      if (t - last > 90) {
        last = t
        setTick((n) => n + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])
}

// Beeps for the countdowns, so you don't have to watch the screen.
function useBeeps() {
  const ctx = useRef(null)
  return useCallback((freq = 660, ms = 120) => {
    try {
      ctx.current ??= new (window.AudioContext || window.webkitAudioContext)()
      const c = ctx.current
      if (c.state === 'suspended') c.resume()
      const o = c.createOscillator()
      const g = c.createGain()
      o.frequency.value = freq
      g.gain.value = 0.08
      g.gain.setTargetAtTime(0, c.currentTime + ms / 1000, 0.03)
      o.connect(g).connect(c.destination)
      o.start()
      o.stop(c.currentTime + ms / 1000 + 0.15)
    } catch {
      // No audio: the countdown is still on screen.
    }
  }, [])
}

export function Session({ partId, side, today, onExit, onFinish }) {
  const exercises = today.exercises
  const [idx, setIdx] = useState(0)
  const [round, setRound] = useState(1)
  const [phase, setPhase] = useState('watch')
  const [paused, setPaused] = useState(false)
  const [cue, setCue] = useState('')
  const [no3d, setNo3d] = useState(false)
  const clock = useMemo(() => createClock(), [])
  const beep = useBeeps()
  const lastBeep = useRef(null)
  useTicker(phase !== 'done' && !paused)

  const ex = exercises[idx]
  const P = period(ex.motion)
  const demoLength = Math.min(Math.max(P, 4), 10)
  const t = clock.now()
  const reverse = phase === 'go' && !!ex.switchHalfway && t >= WORK_SECONDS / 2
  const showSwitch = reverse && t - WORK_SECONDS / 2 < 2.5

  const go = useCallback(
    (next) => {
      clock.reset()
      lastBeep.current = null
      setPhase(next)
    },
    [clock],
  )

  const countdownBeeps = (left) => {
    if (left > 0 && left <= 3 && lastBeep.current !== left) {
      lastBeep.current = left
      beep(660, 110)
    }
  }

  const endRound = useCallback(() => {
    beep(880, 160)
    if (round < ROUNDS) return go('break')
    if (idx + 1 < exercises.length) {
      setIdx(idx + 1)
      setRound(1)
      return go('next')
    }
    clock.pause()
    setPhase('done')
  }, [beep, clock, exercises.length, go, idx, round])

  useEffect(() => {
    if (paused) return
    if (phase === 'watch' && t >= demoLength) go('ready')
    else if (phase === 'next' && t >= 1.8) go('watch')
    else if (phase === 'ready') {
      countdownBeeps(Math.ceil(READY_SECONDS - t))
      if (t >= READY_SECONDS) {
        beep(990, 260)
        go('go')
      }
    } else if (phase === 'go') {
      countdownBeeps(Math.ceil(WORK_SECONDS - t))
      if (t >= WORK_SECONDS) endRound()
    } else if (phase === 'break') {
      countdownBeeps(Math.ceil(BREAK_SECONDS - t))
      if (t >= BREAK_SECONDS) {
        beep(990, 260)
        setRound(round + 1)
        go('go')
      }
    }
  })

  const togglePause = () => {
    if (paused) clock.resume()
    else clock.pause()
    setPaused(!paused)
  }

  if (phase === 'done') {
    return (
      <div className="screen session done-screen">
        <div className="done-hero">
          <div className="done-check" aria-hidden="true">✓</div>
          <h1 className="title center">Done for today</h1>
          <p className="subtitle center">{exercises.length} exercises · 3 rounds each</p>
        </div>
        <div className="card">
          <ul className="done-list">
            {exercises.map((e) => (
              <li key={e.id}>
                <span className="tick-dot" aria-hidden="true">✓</span>
                <span>{e.name}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="footer">
          <button className="btn primary" onClick={onFinish}>Back to home</button>
        </div>
      </div>
    )
  }

  const left = phase === 'go' ? WORK_SECONDS - t : phase === 'break' ? BREAK_SECONDS - t : 0
  const modelClock = phase === 'watch' || phase === 'go' ? clock : STILL

  return (
    <div className="screen session">
      <header className="session-top">
        <button className="back" onClick={onExit} aria-label="Leave session">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="ex-dots" aria-label={`Exercise ${idx + 1} of ${exercises.length}`}>
          {exercises.map((e, i) => (
            <span key={e.id} className={i < idx ? 'done' : i === idx ? 'now' : ''} />
          ))}
        </div>
        <span className="set-pill">{idx + 1}/{exercises.length}</span>
      </header>

      <div className="session-head">
        <h1 className="title">{ex.name}</h1>
        <p className="muted">{ex.setup}</p>
      </div>

      <div className={`session-stage ${phase}`}>
        {no3d ? (
          <div className="no3d card">
            <p>{cue || ex.setup}</p>
          </div>
        ) : (
          <Suspense fallback={<div className="model-loading">Loading 3D model…</div>}>
            <ExerciseModel3D region={partId} side={side ?? 'right'} exercise={ex} clock={modelClock} range={ex.range} reverse={reverse} onCue={setCue} onError={() => setNo3d(true)} />
          </Suspense>
        )}
        {(phase === 'watch' || phase === 'go') && <div className={`cue-chip ${showSwitch ? 'flash' : ''}`}>{showSwitch ? ex.switchHalfway : cue}</div>}
        {phase === 'watch' && <span className="watch-tag">▶ Watch</span>}
        {phase === 'ready' && (
          <div className="stage-overlay">
            <p className="overlay-label">Your turn</p>
            <p className="overlay-count" key={Math.ceil(READY_SECONDS - t)}>{Math.max(1, Math.ceil(READY_SECONDS - t))}</p>
          </div>
        )}
        {phase === 'next' && (
          <div className="stage-overlay">
            <p className="overlay-label">Next</p>
            <p className="overlay-next">{ex.name}</p>
          </div>
        )}
        {phase === 'break' && (
          <div className="stage-overlay soft">
            <p className="overlay-label">Break</p>
            <p className="overlay-count" key={Math.ceil(left)}>{Math.max(1, Math.ceil(left))}</p>
          </div>
        )}
        {paused && (
          <div className="stage-overlay soft">
            <p className="overlay-label">Paused</p>
          </div>
        )}
      </div>

      <div className="session-panel">
        <div className="rounds-row" aria-label={`Round ${round} of ${ROUNDS}`}>
          {Array.from({ length: ROUNDS }, (_, i) => {
            const n = i + 1
            const state = n < round || (n === round && phase === 'break') ? 'done' : n === round && phase === 'go' ? 'now' : ''
            const fill = state === 'now' ? Math.min(1, t / WORK_SECONDS) : state === 'done' ? 1 : 0
            return (
              <div key={n} className={`round-bar ${state}`}>
                <span style={{ width: `${fill * 100}%` }} />
              </div>
            )
          })}
        </div>
        {phase === 'watch' && (
          <button className="btn primary" onClick={() => go('ready')}>Got it</button>
        )}
        {phase === 'go' && (
          <div className="go-row">
            <p className="go-big">{Math.max(0, Math.ceil(left))}<span>s</span></p>
            <p className="go-label">Round {round} of {ROUNDS}</p>
            <button className="btn ghost pause" onClick={togglePause} aria-label={paused ? 'Resume' : 'Pause'}>
              {paused ? '▶' : '❚❚'}
            </button>
          </div>
        )}
        <p className="disclaimer">Stop if it's sharp pain.</p>
      </div>
    </div>
  )
}
