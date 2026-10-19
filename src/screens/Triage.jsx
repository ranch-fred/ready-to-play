import { useState } from 'react'
import { Screen, Choice } from '../components/Screen'
import { BODY_PARTS, rules } from '../logic/triage'

const STEPS = 5

export function PickPart({ onPick, onBack }) {
  return (
    <Screen step={1} totalSteps={STEPS} onBack={onBack} title="What did you hurt?" subtitle="Pick the spot that hurts most.">
      <div className="grid">
        {BODY_PARTS.map((p) => (
          <button key={p.id} className={`tile ${p.id === 'head' ? 'warn' : ''}`} onClick={() => onPick(p.id)}>
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

export function PickLocation({ partId, onPick, onBack }) {
  const injury = rules.injuries[partId]
  return (
    <Screen step={3} totalSteps={STEPS} onBack={onBack} title={injury.locationQuestion} subtitle="Where it hurts changes how long recovery takes.">
      <div className="stack">
        {injury.locations.map((l) => (
          <Choice key={l.id} label={l.label} hint={l.hint} onClick={() => onPick(l)} />
        ))}
      </div>
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
    <Screen step={5} totalSteps={STEPS} onBack={onBack} title="Quick self-test" subtitle={`Test ${index + 1} of ${total}`}>
      <p className="question">{test.question}</p>
      {test.type === 'function' && side && (
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
            <Choice key={o} label={o} onClick={() => onAnswer(o)} />
          ))}
        </div>
      )}
    </Screen>
  )
}

export function HeadInjury({ onAnswer, onBack }) {
  const head = rules.headInjury
  return (
    <Screen onBack={onBack} title="Head injury" subtitle={head.message}>
      <div className="card danger">
        <p className="card-title">Do you have ANY of these right now?</p>
        <ul className="list">
          {head.emergencySigns.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <p className="source">Source: CDC HEADS UP</p>
      </div>
      <div className="row">
        <button className="btn yes" onClick={() => onAnswer(true)}>Yes</button>
        <button className="btn no" onClick={() => onAnswer(false)}>No</button>
      </div>
    </Screen>
  )
}
