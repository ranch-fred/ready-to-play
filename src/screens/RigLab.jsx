import { lazy, Suspense, useMemo, useState } from 'react'
import { EXERCISES, PROGRAM, exercise } from '../data/exercises'
import { period } from '../logic/motion'

const ExerciseModel3D = lazy(() => import('../components/ExerciseModel3D'))

// Dev page for checking exercise animations: /?lab&ex=ankle_pumps&side=left&t=1.2&debug
// `t` freezes the animation at that time; `debug` colors moving parts red.
export default function RigLab() {
  const q = new URLSearchParams(window.location.search)
  const [id, setId] = useState(q.get('ex') || 'ankle_pumps')
  const [side, setSide] = useState(q.get('side') || 'right')
  const debug = q.has('debug')
  const region = Object.keys(PROGRAM).find((r) => Object.values(PROGRAM[r]).flat().includes(id))
  const ex = useMemo(() => exercise(id), [id])
  // t = seconds, or p = fraction of one loop.
  const frozen = q.get('t') ?? (q.get('p') !== null ? String(Number(q.get('p')) * period(ex.motion)) : null)
  const clock = useMemo(() => (frozen !== null ? { now: () => Number(frozen) } : null), [frozen])
  const [cue, setCue] = useState('')

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: 24 }}>{ex.name}</h1>
      <div className="session-stage">
        <Suspense fallback={null}>
          <ExerciseModel3D key={`${region}-${side}-${debug}`} region={region} side={side} exercise={ex} clock={clock} debug={debug} onCue={setCue} />
        </Suspense>
        <div className="cue-chip">{cue}</div>
      </div>
      {!q.has('bare') && (
        <>
          <div className="row" style={{ margin: '12px 0' }}>
            <button className="btn ghost" onClick={() => setSide(side === 'left' ? 'right' : 'left')}>Side: {side}</button>
          </div>
          <div className="stack">
            {Object.keys(EXERCISES).map((k) => (
              <button key={k} className={`choice ${k === id ? 'on' : ''}`} onClick={() => setId(k)}>{EXERCISES[k].name} <span className="muted">{k}</span></button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
