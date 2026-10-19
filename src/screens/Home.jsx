import { useState } from 'react'
import { rules, addDays, formatDate, daysBetween, currentPhase } from '../logic/triage'

const STATUS = {
  plan: { label: 'Recovering', tone: 'good' },
  see_trainer: { label: 'Get checked first', tone: 'caution' },
  see_care_today: { label: 'See care today', tone: 'alert' },
}

export function Home({ profile, injury, onNewInjury }) {
  const { outcome } = injury
  const part = rules.injuries[injury.partId]
  const spotIds = injury.locationIds ?? (injury.locationId ? [injury.locationId] : [])
  const spots = part?.locations.filter((l) => spotIds.includes(l.id)).map((l) => l.label) ?? []
  const status = STATUS[outcome.action] || STATUS.see_trainer
  const [now] = useState(() => new Date())
  const day = daysBetween(injury.date, now) + 1
  const title = part
    ? `${injury.side ? injury.side[0].toUpperCase() + injury.side.slice(1) + ' ' : ''}${part.name.toLowerCase()}`
    : injury.partId === 'head' ? 'Head injury' : 'Injury'

  let phase
  let progress = 0
  if (outcome.estimate) {
    phase = currentPhase(injury.partId, day, outcome.estimate.maxDays)
    progress = Math.min(100, Math.round((day / outcome.estimate.maxDays) * 100))
  }

  return (
    <div className="screen home">
      <header className="home-head">
        <div className="logo small">READY<span>TO</span>PLAY</div>
        <p className="hello">Hi {profile.name}</p>
      </header>

      <div className={`card injury ${status.tone}`}>
        <div className="injury-top">
          <div>
            <p className="eyebrow">Day {day}</p>
            <h2 className="injury-title">{title}</h2>
            {spots.length > 0 && <p className="muted">{spots.join(' · ')}</p>}
          </div>
          <span className={`status ${status.tone}`}>{status.label}</span>
        </div>

        {outcome.estimate && (
          <>
            <p className="eyebrow">Estimated back</p>
            <p className="big-date">{formatDate(addDays(injury.date, outcome.estimate.maxDays))}</p>
            <div className="bar"><span style={{ width: `${progress}%` }} /></div>
            <p className="muted">
              Range: {outcome.estimate.minDays}-{outcome.estimate.maxDays} days · {outcome.estimate.label}
            </p>
          </>
        )}
      </div>

      {outcome.confirmWithTrainer && (
        <div className="card note"><p>Have your athletic trainer or a doctor confirm this is a high ankle sprain.</p></div>
      )}

      {phase && (
        <div className="card">
          <p className="eyebrow">Phase {phase.index + 1} of {phase.count}</p>
          <h3 className="card-title">{phase.name}</h3>
          <ul className="list">
            {phase.steps.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      )}

      {!outcome.estimate && (
        <div className="card">
          <h3 className="card-title">What to do now</h3>
          <ul className="list">
            {outcome.notes?.map((n) => <li key={n}>{n}</li>)}
            <li>{rules.actions[outcome.action]?.message}</li>
            <li><b>RICE until you're seen:</b> rest, ice 20 min a few times a day, wrap it, keep it raised.</li>
          </ul>
        </div>
      )}

      <div className="card cleared">
        <p className="card-title">Before you play again</p>
        <p className="muted">Get cleared by your athletic trainer or a doctor. ReadyToPlay never clears you by itself.</p>
      </div>

      <button className="btn ghost" onClick={onNewInjury}>Report a new injury</button>
      <p className="disclaimer">{rules.meta.disclaimer}</p>
    </div>
  )
}
