import { useEffect, useState } from 'react'
import { rules, addDays, formatDate, daysBetween, currentPhase, phaseRanges } from '../logic/triage'
import { recovery, startPlan } from '../logic/recovery'

const STATUS = {
  plan: { label: 'Recovering', tone: 'good' },
  see_trainer: { label: 'Get checked first', tone: 'caution' },
  see_care_today: { label: 'See care today', tone: 'alert' },
}

const DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')
const DAY_MS = 86400000

const TABS = [
  { id: 'home', label: 'Home', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { id: 'plan', label: 'Recovery plan', icon: 'M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01' },
  { id: 'map', label: 'Map', icon: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
]

function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function Orb({ target, offsetDays }) {
  const now = useNow() + offsetDays * DAY_MS
  const left = Math.max(0, target - now)
  const days = Math.floor(left / DAY_MS)
  const hours = Math.floor((left % DAY_MS) / 3600000)
  const mins = Math.floor((left % 3600000) / 60000)
  const secs = Math.floor((left % 60000) / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    <div className="orb-wrap">
      <div className="orb" role="timer" aria-label={`${days} days, ${hours} hours until recovered`}>
        <span className="orb-days">{days}</span>
        <span className="orb-unit">{days === 1 ? 'day' : 'days'}</span>
        <span className="orb-clock">{pad(hours)}:{pad(mins)}:{pad(secs)}</span>
      </div>
      <p className="orb-caption">until you're recovered</p>
    </div>
  )
}

export function Home({ profile, injury, onNewInjury, onCheckIn, onFindCare, onUpdateInjury }) {
  const [tab, setTab] = useState('home')
  const { outcome } = injury
  const part = rules.injuries[injury.partId]
  const spotIds = injury.locationIds ?? (injury.locationId ? [injury.locationId] : [])
  const spots = part?.locations.filter((l) => spotIds.includes(l.id)).map((l) => l.label) ?? []
  const status = STATUS[outcome.action] || STATUS.see_trainer
  const [today] = useState(() => new Date())
  const offset = injury.dayOffset || 0
  const day = daysBetween(injury.date, today) + 1 + offset
  const title = part
    ? `${injury.side ? injury.side[0].toUpperCase() + injury.side.slice(1) + ' ' : ''}${part.name.toLowerCase()}`
    : 'Injury'

  // Plans saved before daily check-ins existed get one here.
  const plan = outcome.estimate ? injury.plan ?? startPlan(injury.partId, outcome.estimate) : null
  const checkedToday = plan?.checkIns.some((c) => c.day === day)
  const last = plan?.lastResult
  const phase = plan ? currentPhase(injury.partId, day, plan.projected) : null
  const relief = recovery.relief[injury.partId]
  const tips = relief && phase ? (phase.index <= 1 ? relief.early : relief.later) : null
  const backDate = plan ? addDays(new Date(injury.date).setHours(0, 0, 0, 0), plan.projected) : null

  return (
    <div className="screen home tabbed">
      <header className="home-head">
        <div className="logo small">READY<span>TO</span>PLAY</div>
        <p className="hello">{profile?.name ? `Hi ${profile.name}` : `Day ${day}`}</p>
      </header>

      {tab === 'home' && (
        <>
          <div className="home-title">
            <h2 className="injury-title">{title}</h2>
            <span className={`status ${status.tone}`}>{status.label}</span>
          </div>
          {spots.length > 0 && <p className="muted center">{spots.join(' · ')}</p>}

          {plan ? (
            <>
              <Orb target={backDate.getTime()} offsetDays={offset} />
              <div className="card center">
                <p className="eyebrow">Our best guess</p>
                <p className="big-date">{formatDate(backDate)}</p>
                {plan.projected < plan.padded && (
                  <p className="was">First guess: {formatDate(addDays(new Date(injury.date).setHours(0, 0, 0, 0), plan.padded))}</p>
                )}
                <p className="muted">
                  {outcome.estimate.label}. This guess includes a 25% safety cushion, so good check-ins make it shorter.
                </p>
              </div>

              {checkedToday ? (
                <div className="card center">
                  <p className="card-title">Checked in today ✓</p>
                  <p className="muted">Come back tomorrow. Each check-in updates your countdown.</p>
                </div>
              ) : (
                <button className="btn primary" onClick={() => onCheckIn(day)}>Do today's check-in</button>
              )}

              {last && (last.action !== 'plan' || last.overdue) && (
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

              <button className="card phase-peek" onClick={() => setTab('map')}>
                <p className="eyebrow">Stage {phase.index + 1} of {phase.count}</p>
                <p className="card-title">{phase.name}</p>
                <p className="go">See your path →</p>
              </button>
            </>
          ) : (
            <div className="card">
              <h3 className="card-title">What to do now</h3>
              <ul className="list">
                {outcome.notes?.map((n) => <li key={n}>{n}</li>)}
                <li>{rules.actions[outcome.action]?.message}</li>
                <li><b>RICE until you're seen:</b> rest, ice 20 min a few times a day, wrap it, keep it raised.</li>
              </ul>
            </div>
          )}

          <button className="btn ghost" onClick={onFindCare}>Find care near me</button>
          <button className="btn ghost" onClick={onNewInjury}>Report a new injury</button>

          {DEMO && plan && (
            <div className="card demo-tools">
              <p className="eyebrow">Demo tools</p>
              <button className="btn ghost" onClick={() => onUpdateInjury({ ...injury, plan, dayOffset: offset + 1 })}>
                Skip to next day
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'plan' && (
        <>
          <h1 className="title">Recovery plan</h1>
          {phase ? (
            <div className="card">
              <p className="eyebrow">Today · Stage {phase.index + 1} of {phase.count}</p>
              <h3 className="card-title">{phase.name}</h3>
              <ul className="list">
                {phase.steps.map((s) => <li key={s}>{s}</li>)}
              </ul>
              <p className="muted">Stop anything that causes sharp pain. Mild discomfort is OK.</p>
            </div>
          ) : (
            <div className="card"><p>Your plan starts once your athletic trainer or a doctor has checked the injury.</p></div>
          )}

          {outcome.confirmWithTrainer && (
            <div className="card note"><p>Have your athletic trainer or a doctor confirm what this injury is.</p></div>
          )}

          {(outcome.focus?.length > 0 || outcome.notes?.length > 0) && (
            <div className="card">
              <p className="eyebrow">Based on your answers</p>
              <h3 className="card-title">Your plan's focus</h3>
              <ul className="list">
                {outcome.focus?.map((f) => <li key={f}><b>{f}</b></li>)}
                {outcome.notes?.map((n) => <li key={n}>{n}</li>)}
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

          <div className="card cleared">
            <p className="card-title">Before you play again</p>
            <p className="muted">Get cleared by your athletic trainer or a doctor. ReadyToPlay never clears you by itself.</p>
          </div>
        </>
      )}

      {tab === 'map' && (
        <>
          <h1 className="title">Your path</h1>
          {plan ? (
            <PathMap partId={injury.partId} total={plan.projected} current={phase.index} startDate={injury.date} />
          ) : (
            <div className="card"><p>Your path appears once your plan starts.</p></div>
          )}
        </>
      )}

      <p className="disclaimer">{rules.meta.disclaimer}</p>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => { setTab(t.id); window.scrollTo(0, 0) }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t.icon} /></svg>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function PathMap({ partId, total, current, startDate }) {
  const stages = phaseRanges(partId, total)
  const [open, setOpen] = useState(current)
  const start = new Date(startDate).setHours(0, 0, 0, 0)
  const OFFSETS = [0, 60, 0, -60, 0]

  return (
    <div className="path">
      {stages.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'locked'
        const last = i === stages.length - 1
        return (
          <div key={s.id} className="path-stop" style={{ '--x': `${OFFSETS[i % OFFSETS.length]}px` }}>
            <button className={`path-node ${state}`} onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
              {state === 'done' ? '✓' : last ? '★' : i + 1}
            </button>
            <p className="path-label">{s.name}</p>
            <p className="path-days">
              {last ? `Around ${formatDate(addDays(start, total))}` : `${formatDate(addDays(start, s.startDay - 1))} – ${formatDate(addDays(start, s.endDay - 1))}`}
            </p>
            {open === i && (
              <div className="card path-card">
                {state === 'locked' && <p className="eyebrow">Unlocks later</p>}
                <ul className="list">
                  {s.steps.map((step) => <li key={step}>{step}</li>)}
                </ul>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
