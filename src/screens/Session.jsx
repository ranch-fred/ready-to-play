import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClock, STILL } from '../logic/clock'
import { period } from '../logic/motion'

const ExerciseModel3D = lazy(() => import('../components/ExerciseModel3D'))

const READY_SECONDS = 3
const REST_SECONDS = 12

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

// Short beeps for the countdown and the end of a set, so athletes don't have to stare at the screen.
function useBeeps() {
  const ctx = useRef(null)
  return useCallback((freq = 660, ms = 120, gain = 0.08) => {
    try {
      ctx.current ??= new (window.AudioContext || window.webkitAudioContext)()
      const c = ctx.current
      if (c.state === 'suspended') c.resume()
      const o = c.createOscillator()
      const g = c.createGain()
      o.frequency.value = freq
      g.gain.value = gain
      g.gain.setTargetAtTime(0, c.currentTime + ms / 1000, 0.03)
      o.connect(g).connect(c.destination)
      o.start()
      o.stop(c.currentTime + ms / 1000 + 0.15)
    } catch {
      // No audio available: the countdown is still on screen.
    }
  }, [])
}

const fmt = (s) => {
  const v = Math.max(0, Math.ceil(s))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}

export function Session({ partId, side, today, sets, onExit, onFinish }) {
  const exercises = today.exercises
  const [idx, setIdx] = useState(0)
  const [set, setSet] = useState(1)
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
  const demoLength = Math.min(Math.max(P * 2, 5), 10)
  const t = clock.now()
  const repsTotal = ex.reps
  const rep = repsTotal ? Math.min(repsTotal, Math.floor(t / P) + 1) : null
  const switchAt = repsTotal ? Math.ceil(repsTotal / 2) * P : Infinity
  const reverse = phase === 'go' && !!ex.switchHalfway && t >= switchAt
  const showSwitch = reverse && t - switchAt < 2.5

  const go = useCallback(
    (next) => {
      clock.reset()
      lastBeep.current = null
      setPhase(next)
    },
    [clock],
  )

  const finishSet = useCallback(() => {
    beep(880, 140)
    setTimeout(() => beep(1175, 220), 170)
    if (set < sets) return go('rest')
    if (idx + 1 < exercises.length) {
      setIdx(idx + 1)
      setSet(1)
      return go('next')
    }
    clock.pause()
    setPhase('done')
  }, [beep, clock, exercises.length, go, idx, set, sets])

  // Phase timing.
  useEffect(() => {
    if (paused) return
    if (phase === 'watch' && t >= demoLength) go('ready')
    else if (phase === 'next' && t >= 2.2) go('watch')
    else if (phase === 'ready') {
      const left = Math.ceil(READY_SECONDS - t)
      if (left > 0 && lastBeep.current !== left) {
        lastBeep.current = left
        beep(660, 110)
      }
      if (t >= READY_SECONDS) {
        beep(990, 260)
        go('go')
      }
    } else if (phase === 'go' && t >= ex.duration) finishSet()
    else if (phase === 'rest' && t >= REST_SECONDS) {
      setSet(set + 1)
      go('ready')
    }
  })

  const togglePause = () => {
    if (paused) clock.resume()
    else clock.pause()
    setPaused(!paused)
  }

  const modelClock = phase === 'watch' || phase === 'go' ? clock : STILL
  const showNowTry = phase === 'ready'
  const leftReady = Math.max(1, Math.ceil(READY_SECONDS - t))

  if (phase === 'done') {
    return (
      <div className="screen session done-screen">
        <div className="done-hero">
          <div className="done-check" aria-hidden="true">✓</div>
          <h1 className="title center">Session done!</h1>
          <p className="subtitle center">
            {exercises.length} exercises · {sets} {sets === 1 ? 'round' : 'rounds'} each
          </p>
        </div>
        <div className="card">
          <ul className="done-list">
            {exercises.map((e) => (
              <li key={e.id}>
                <span className="tick-dot" aria-hidden="true">✓</span>
                <span>{e.name}</span>
                <span className="muted">{e.reps ? `${sets} × ${e.reps}` : `${sets} × ${e.seconds}s`}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="muted center">Sore is OK. Sharp pain, new swelling, or numbness is not: tell your athletic trainer.</p>
        <div className="footer">
          <button className="btn primary" onClick={() => onFinish(sets)}>Back to home</button>
        </div>
      </div>
    )
  }

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
        <span className="set-pill">
          Round {set}/{sets}
        </span>
      </header>

      <div className="session-head">
        <p className="eyebrow">
          Exercise {idx + 1} of {exercises.length}
        </p>
        <h1 className="title">{ex.name}</h1>
        <p className="muted">{ex.setup}</p>
      </div>

      <div className={`session-stage ${phase}`}>
        {no3d ? (
          <div className="no3d card">
            <p className="card-title">{ex.name}</p>
            <p>{cue || ex.setup}</p>
          </div>
        ) : (
          <Suspense fallback={<div className="model-loading">Loading 3D model…</div>}>
            <ExerciseModel3D
              region={partId}
              side={side ?? 'right'}
              exercise={ex}
              clock={modelClock}
              range={ex.range}
              reverse={reverse}
              onCue={setCue}
              onError={() => setNo3d(true)}
            />
          </Suspense>
        )}
        {phase !== 'ready' && phase !== 'next' && <div className={`cue-chip ${showSwitch ? 'flash' : ''}`}>{showSwitch ? ex.switchHalfway : cue}</div>}
        {phase === 'watch' && <span className="watch-tag">▶ Watch first</span>}
        {showNowTry && (
          <div className="stage-overlay">
            <p className="overlay-label">Now you try</p>
            <p className="overlay-count" key={leftReady}>{leftReady}</p>
          </div>
        )}
        {phase === 'next' && (
          <div className="stage-overlay">
            <p className="overlay-label">Nice work!</p>
            <p className="overlay-next">Next up: {ex.name}</p>
          </div>
        )}
        {phase === 'rest' && (
          <div className="stage-overlay soft">
            <p className="overlay-label">Rest</p>
            <p className="overlay-count">{Math.max(1, Math.ceil(REST_SECONDS - t))}</p>
            <p className="overlay-next">Round {set + 1} of {sets} next</p>
          </div>
        )}
        {paused && (
          <div className="stage-overlay soft">
            <p className="overlay-label">Paused</p>
          </div>
        )}
      </div>

      <div className="session-panel">
        {phase === 'watch' && (
          <>
            <p className="panel-big">Watch how it's done</p>
            <div className="watch-bar"><span style={{ width: `${Math.min(100, (t / demoLength) * 100)}%` }} /></div>
            <p className="muted center">{ex.why}</p>
            <button className="btn primary" onClick={() => go('ready')}>I'm ready</button>
          </>
        )}
        {phase === 'ready' && <p className="panel-big">Get in position: {ex.setup.toLowerCase().replace(/\.$/, '')}</p>}
        {phase === 'go' && (
          <>
            <div className="go-row">
              <div>
                <p className="eyebrow">{repsTotal ? 'Rep' : 'Hold'}</p>
                <p className="go-big">{repsTotal ? <>{rep}<span>/{repsTotal}</span></> : fmt(ex.duration - t)}</p>
              </div>
              <div className="go-ring" style={{ '--p': Math.min(1, t / ex.duration) }}>
                <span>{fmt(ex.duration - t)}</span>
              </div>
            </div>
            <div className="row">
              <button className="btn ghost" onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
              <button className="btn ghost" onClick={finishSet}>Done</button>
            </div>
          </>
        )}
        {phase === 'rest' && (
          <button className="btn ghost" onClick={() => { setSet(set + 1); go('ready') }}>Skip rest</button>
        )}
        <p className="disclaimer">Stop if you feel sharp pain. Mild discomfort is OK.</p>
      </div>
    </div>
  )
}
