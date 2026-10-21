import { useState } from 'react'
import { rules, addDays, formatDate, daysBetween, currentPhase } from '../logic/triage'
import { recovery, startPlan } from '../logic/recovery'

const STATUS = {
  plan: { label: 'Recovering', tone: 'good' },
  see_trainer: { label: 'Get checked first', tone: 'caution' },
  see_care_today: { label: 'See care today', tone: 'alert' },
}

const DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')

export function Home({ profile, injury, onNewInjury, onCheckIn, onFindCare, onUpdateInjury }) {
  const { outcome } = injury
  const part = rules.injuries[injury.partId]
  const spotIds = injury.locationIds ?? (injury.locationId ? [injury.locationId] : [])
  const spots = part?.locations.filter((l) => spotIds.includes(l.id)).map((l) => l.label) ?? []
  const status = STATUS[outcome.action] || STATUS.see_trainer
  const [now] = useState(() => new Date())
  const day = daysBetween(injury.date, now) + 1 + (injury.dayOffset || 0)
  const title = part
    ? `${injury.side ? injury.side[0].toUpperCase() + injury.side.slice(1) + ' ' : ''}${part.name.toLowerCase()}`
    : 'Injury'

  // Plans saved before daily check-ins existed get one here.
  const plan = outcome.estimate ? injury.plan ?? startPlan(injury.partId, outcome.estimate) : null
  const checkedToday = plan?.checkIns.some((c) => c.day === day)
  const last = plan?.lastResult

  let phase
  let progress = 0
  if (plan) {
    phase = currentPhase(injury.partId, day, plan.projected)
    progress = Math.min(100, Math.round((day / plan.projected) * 100))
  }
  const relief = recovery.relief[injury.partId]
  const tips = relief && phase ? (phase.index <= 1 ? relief.early : relief.later) : null

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

        {plan && (
          <>
            <p className="eyebrow">Estimated back</p>
            <p className="big-date">{formatDate(addDays(injury.date, plan.projected))}</p>
            {plan.projected < plan.padded && (
              <p className="was">First estimate: {formatDate(addDays(injury.date, plan.padded))}</p>
            )}
            <div className="bar"><span style={{ width: `${progress}%` }} /></div>
            <p className="muted">
              {outcome.estimate.label} · The first date includes a 25% safety cushion, so good check-ins move it earlier.
            </p>
          </>
        )}
      </div>

      {plan && (
        checkedToday ? (
          <div className="card">
            <p className="card-title">Checked in today ✓</p>
            <p className="muted">Come back tomorrow. Each check-in updates your date.</p>
          </div>
        ) : (
          <button className="btn primary" onClick={() => onCheckIn(day)}>
            Do today's check-in
          </button>
        )
      )}

      {plan && last && (last.action !== 'plan' || last.overdue) && (
        <div className="card note">
          <p>
            {last.action === 'see_care_today'
              ? 'Your last check-in showed new numbness or a sudden jump in pain or swelling. Get it checked today.'
              : last.action === 'see_trainer'
                ? 'You were worse two check-ins in a row. Show your athletic trainer or a doctor.'
                : 'This is taking longer than the plan expected. Have your athletic trainer take a look.'}
          </p>
        </div>
      )}

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

      {tips && (
        <div className="card">
          <h3 className="card-title">Pain relief</h3>
          <ul className="list">
            {tips.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <p className="muted">{recovery.relief.medicine}</p>
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

      <div className="card">
        <h3 className="card-title">Need to get it checked?</h3>
        <p className="muted">Urgent care, sports medicine, and physical therapy near you.</p>
        <button className="btn ghost" onClick={onFindCare}>Find care near me</button>
      </div>

      <div className="card cleared">
        <p className="card-title">Before you play again</p>
        <p className="muted">Get cleared by your athletic trainer or a doctor. ReadyToPlay never clears you by itself.</p>
      </div>

      <button className="btn ghost" onClick={onNewInjury}>Report a new injury</button>

      {DEMO && plan && (
        <div className="card demo-tools">
          <p className="eyebrow">Demo tools</p>
          <button className="btn ghost" onClick={() => onUpdateInjury({ ...injury, plan, dayOffset: (injury.dayOffset || 0) + 1 })}>
            Skip to next day
          </button>
        </div>
      )}

      <p className="disclaimer">{rules.meta.disclaimer}</p>
    </div>
  )
}
