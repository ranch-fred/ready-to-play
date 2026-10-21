import { lazy, Suspense, useState } from 'react'
import { Screen, Choice } from '../components/Screen'
import { BODY_PARTS, rules } from '../logic/triage'

const BodyModel3D = lazy(() => import('../components/BodyModel3D'))
const MODEL_PARTS = ['ankle', 'shoulder', 'hamstring', 'wrist']

const STEPS = 5

export function PickPart({ onPick, onBack }) {
  return (
    <Screen step={1} totalSteps={STEPS} onBack={onBack} title="What did you hurt?" subtitle="Pick the spot that hurts most.">
      <div className="grid">
        {BODY_PARTS.map((p) => (
          <button key={p.id} className="tile" onClick={() => onPick(p.id)}>
            <span className="tile-label">{p.label}</span>
            {p.sub && <span className="tile-sub">{p.sub}</span>}
          </button>
        ))}
      </div>
    </Screen>
  )
}

export function PickSide({ partId, onPick, onBack }) {
  const name = rules.injuries[partId].name.split(' ')[0].toLowerCase()
  return (
    <Screen step={2} totalSteps={STEPS} onBack={onBack} title={`Which ${name}?`}>
      <div className="row">
        <button className="tile big" onClick={() => onPick('left')}><span className="tile-label">Left</span></button>
        <button className="tile big" onClick={() => onPick('right')}><span className="tile-label">Right</span></button>
      </div>
    </Screen>
  )
}

export function PickLocation({ partId, side, onDone, onBack }) {
  const injury = rules.injuries[partId]
  const [selected, setSelected] = useState([])
  const [use3d, setUse3d] = useState(MODEL_PARTS.includes(partId))
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const picked = injury.locations.filter((l) => selected.includes(l.id))

  return (
    <Screen
      step={3}
      totalSteps={STEPS}
      onBack={onBack}
      title={injury.locationQuestion}
      subtitle={use3d ? 'Spin it with your finger. Tap every spot that hurts.' : 'Tap every spot that hurts.'}
      stickyFooter
      footer={
        <div className="done-row">
          <span className="muted">{selected.length ? `${selected.length} selected` : 'Pick at least one'}</span>
          <button className="btn primary done" disabled={!selected.length} onClick={() => onDone(picked)}>
            Done
          </button>
        </div>
      }
    >
      {use3d ? (
        <>
          <Suspense fallback={<div className="ankle3d" />}>
            <BodyModel3D region={partId} side={side} selected={selected} onToggle={toggle} onError={() => setUse3d(false)} />
          </Suspense>
          {picked.length > 0 && (
            <div className="picked">
              {picked.map((l) => (
                <p key={l.id}><b>{l.label}.</b> {l.hint}</p>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="stack">
          {injury.locations.map((l) => (
            <Choice key={l.id} label={l.label} hint={l.hint} selected={selected.includes(l.id)} onClick={() => toggle(l.id)} />
          ))}
        </div>
      )}
    </Screen>
  )
}

export function RedFlag({ flag, index, total, onAnswer, onBack }) {
  return (
    <Screen step={4} totalSteps={STEPS} onBack={onBack} title="Warning-sign check" subtitle={`Question ${index + 1} of ${total}`}>
      <p className="question">{flag.question}</p>
      <div className="row">
        <button className="btn yes" onClick={() => onAnswer(true)}>Yes</button>
        <button className="btn no" onClick={() => onAnswer(false)}>No</button>
      </div>
    </Screen>
  )
}

export function SelfTest({ test, index, total, side, onAnswer, onBack }) {
  const [pain, setPain] = useState(3)
  return (
    <Screen step={5} totalSteps={STEPS} onBack={onBack} title="About your injury" subtitle={`Question ${index + 1} of ${total}`}>
      <p className="question">{test.question}</p>
      {test.compare && side && (
        <p className="tip">Tip: try it on your {side === 'left' ? 'right' : 'left'} side first to compare.</p>
      )}
      {test.type === 'scale' ? (
        <div className="pain">
          <div className={`pain-value p${Math.min(pain, 10)}`}>{pain}</div>
          <input
            type="range"
            min="0"
            max="10"
            value={pain}
            onChange={(e) => setPain(Number(e.target.value))}
            aria-label="Pain from 0 to 10"
          />
          <div className="pain-scale"><span>No pain</span><span>Worst ever</span></div>
          <button className="btn primary" onClick={() => onAnswer(pain)}>Next</button>
        </div>
      ) : (
        <div className="stack">
          {test.options.map((o) => (
            <Choice key={o.label} label={o.label} onClick={() => onAnswer(o.label)} />
          ))}
        </div>
      )}
    </Screen>
  )
}
