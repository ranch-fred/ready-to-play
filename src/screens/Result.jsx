import { useState } from 'react'
import { Screen } from '../components/Screen'
import { rules, addDays, formatDate } from '../logic/triage'

const TONE = { emergency: 'danger', see_care_today: 'alert', see_trainer: 'caution', plan: 'good' }

export function Result({ outcome, onContinue, onRestart, onBack }) {
  const action = rules.actions[outcome.action]
  const tone = TONE[outcome.action]
  const [today] = useState(() => new Date())

  return (
    <Screen
      onBack={onBack}
      footer={
        outcome.action === 'emergency' ? (
          <>
            <a className="btn danger-btn" href="tel:911">Call 911</a>
            <button className="btn ghost" onClick={onRestart}>Back to start</button>
          </>
        ) : (
          <button className="btn primary" onClick={onContinue}>
            {outcome.action === 'plan' ? 'Save my plan' : 'Save and track my recovery'}
          </button>
        )
      }
    >
      <div className={`result ${tone}`}>
        <span className="result-badge">
          {outcome.action === 'plan' ? 'No warning signs' : outcome.action === 'see_trainer' ? 'Get it checked' : 'Stop and get help'}
        </span>
        <h1 className="result-title">{action.title}</h1>
        <p className="result-copy">{action.message}</p>
      </div>

      {outcome.notes?.map((n) => (
        <div key={n} className="card note"><p>{n}</p></div>
      ))}

      {outcome.estimate && (
        <div className="card estimate">
          <p className="eyebrow">Estimated return</p>
          <p className="big-date">{formatDate(addDays(today, outcome.estimate.maxDays))}</p>
          <p className="muted">
            Could be as early as {formatDate(addDays(today, outcome.estimate.minDays))}. We start at the safe end and move it up as you improve.
          </p>
          <p className="chip">{outcome.estimate.label}</p>
        </div>
      )}

      {outcome.action !== 'plan' && outcome.action !== 'emergency' && (
        <div className="card">
          <p className="card-title">Until you're checked: RICE</p>
          <ul className="list">
            <li><b>Rest.</b> {rules.rice.rest}</li>
            <li><b>Ice.</b> {rules.rice.ice}</li>
            <li><b>Compression.</b> {rules.rice.compression}</li>
            <li><b>Elevation.</b> {rules.rice.elevation}</li>
          </ul>
        </div>
      )}
    </Screen>
  )
}
