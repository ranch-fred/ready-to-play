import { useState } from 'react'
import { Screen } from '../components/Screen'
import { rules, addDays, formatDate, recommendation } from '../logic/triage'
import { paddedDays } from '../logic/recovery'

const TONE = { see_care_today: 'alert', see_trainer: 'caution', plan: 'good' }

export function Result({ outcome, onContinue, onBack, onFindCare }) {
  const action = rules.actions[outcome.action]
  const tone = TONE[outcome.action]
  const [today] = useState(() => new Date())

  return (
    <Screen
      onBack={onBack}
      footer={
        (
          <>
            {outcome.action !== 'plan' && <button className="btn primary" onClick={onFindCare}>Find care near me</button>}
            <button className={`btn ${outcome.action === 'plan' ? 'primary' : 'ghost'}`} onClick={onContinue}>
              {outcome.action === 'plan' ? 'Save my plan' : 'Save and track my recovery'}
            </button>
          </>
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

      {outcome.action !== 'plan' && (() => {
        const rec = recommendation(outcome)
        return (
          <div className={`card recommend ${tone === 'alert' ? 'alert' : ''}`}>
            <p className="recommend-label">Our recommendation</p>
            <p className="recommend-who">See: {rec.who}</p>
            <p className="recommend-when">{rec.when}</p>
          </div>
        )
      })()}

      {outcome.notes?.map((n) => (
        <div key={n} className="card note"><p>{n}</p></div>
      ))}

      {outcome.focus?.length > 0 && (
        <div className="card">
          <p className="card-title">Your plan's focus</p>
          <ul className="list">
            {outcome.focus.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}

      {outcome.estimate && (
        <div className="card estimate">
          <p className="eyebrow">Estimated return</p>
          <p className="big-date">{formatDate(addDays(today, paddedDays(outcome.estimate)))}</p>
          <p className="muted">
            Could be as early as {formatDate(addDays(today, outcome.estimate.minDays))}. We start at the safe end plus a 25% cushion, then move it up as your daily check-ins improve.
          </p>
          <p className="chip">{outcome.estimate.label}</p>
        </div>
      )}

      {outcome.action !== 'plan' && (
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
