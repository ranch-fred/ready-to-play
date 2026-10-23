import { useEffect, useRef, useState } from 'react'
import { rules, addDays, formatDate, phaseRanges } from '../logic/triage'
import { recovery, startPlan } from '../logic/recovery'
import { todayPlan, dayNumber, STAGES, ROUNDS, WORK_SECONDS, BREAK_SECONDS, stageGoals } from '../logic/plan'
import { EXERCISES, PROGRAM } from '../data/exercises'
import { CareView } from './Care'

const STATUS = {
  plan: { label: 'Recovering', tone: 'good' },
  see_trainer: { label: 'Get checked first', tone: 'caution' },
  see_care_today: { label: 'See care today', tone: 'alert' },
}

const DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')
const DAY_MS = 86400000

const TABS = [
  { id: 'home', label: 'Home', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { id: 'today', label: 'Today', icon: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11' },
  { id: 'map', label: 'Map', icon: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
  { id: 'care', label: 'Care', icon: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM12 9v5M9.5 11.5h5' },
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

export function Home({ profile, injury, onNewInjury, onCheckIn, onUpdateInjury, onStartSession, startTab = 'home' }) {
  const [tab, setTab] = useState(startTab)
  const { outcome } = injury
  const part = rules.injuries[injury.partId]
  const spotIds = injury.locationIds ?? (injury.locationId ? [injury.locationId] : [])
  const spots = part?.locations.filter((l) => spotIds.includes(l.id)).map((l) => l.label) ?? []
  const status = STATUS[outcome.action] || STATUS.see_trainer
  const offset = injury.dayOffset || 0
  const [day] = useState(() => dayNumber(injury))
  const title = part
    ? `${injury.side ? injury.side[0].toUpperCase() + injury.side.slice(1) + ' ' : ''}${part.name.toLowerCase()}`
    : 'Injury'

  // Plans saved before daily check-ins existed get one here.
  const plan = outcome.estimate ? injury.plan ?? startPlan(injury.partId, outcome.estimate) : null
  const checkedToday = plan?.checkIns.some((c) => c.day === day)
  const last = plan?.lastResult
  const today = plan ? todayPlan({ ...injury, plan }, day) : null
  const phase = today ? { ...phaseRanges(injury.partId, plan.projected)[today.stage], index: today.stage, count: STAGES.length } : null
  const walkQ = recovery.checkIns[injury.partId]?.find((q) => q.id === 'walk')
  const cantWalk = !!walkQ && today?.lastAnswers?.walk === walkQ.options[2]
  const backDate = plan ? addDays(new Date(injury.date).setHours(0, 0, 0, 0), plan.projected) : null

  return (
    <div className="screen home tabbed">
      <header className="home-head">
        <div className="logo small">READY<span>TO</span>PLAY</div>
        <p className="hello">{profile?.name ? `Hi ${profile.name}` : `Day ${day}`}</p>
      </header>

      <div className="pane" key={tab}>
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

              {!checkedToday ? (
                <>
                  <button className="btn primary" onClick={() => onCheckIn(day)}>Do today's check-in</button>
                  <p className="muted center tight">Check in first so today's exercises match how you feel.</p>
                </>
              ) : today?.doneToday ? (
                <div className="card center">
                  <p className="card-title">All done for today ✓</p>
                  <p className="muted">Checked in and finished your session. Come back tomorrow.</p>
                </div>
              ) : (
                <button className="btn primary" onClick={() => setTab('today')}>Start today's session</button>
              )}
              {!checkedToday && today?.doneToday && <p className="muted center tight">Today's session done ✓</p>}

              {last && (last.action !== 'plan' || last.overdue) && (
                <div className="card note">
                  <p>
                    {last.action === 'see_care_today'
                      ? 'Your last check-in showed new numbness or a sudden jump in pain or swelling. Get it checked today.'
                      : last.action === 'see_trainer'
                        ? 'You were worse two check-ins in a row. See a doctor.'
                        : 'This is taking longer than the plan expected. Have a doctor take a look.'}
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

          <button className="btn ghost" onClick={() => setTab('care')}>Find care</button>
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

      {tab === 'today' && (
        <TodayTab today={today} checkedToday={checkedToday} onCheckIn={() => onCheckIn(day)} onStart={onStartSession} />
      )}

      {tab === 'care' && (
        <>
          <h1 className="title">Care</h1>
          <CareView partId={injury.partId} outcome={outcome} lastResult={plan?.lastResult} stage={today?.stage ?? 0} cantWalk={cantWalk} town={profile?.town} />
        </>
      )}

      {tab === 'map' && (
        <>
          <h1 className="title">Your path</h1>
          {plan ? (
            <PathMap partId={injury.partId} total={plan.projected} current={phase.index} startDate={injury.date} answers={today?.lastAnswers} today={today} />
          ) : (
            <div className="card empty"><p>Your path appears once your plan starts.</p></div>
          )}
        </>
      )}
      </div>

      <p className="disclaimer">{rules.meta.disclaimer}</p>

      <nav className="tabbar" aria-label="Sections" style={{ '--tab': Math.max(0, TABS.findIndex((t) => t.id === tab)) }}>
        <span className="tab-pill" aria-hidden="true" />
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

function TodayTab({ today, checkedToday, onCheckIn, onStart }) {
  if (!today) {
    return (
      <>
        <h1 className="title">Today</h1>
        <div className="card empty"><p>Your exercises start once a doctor has checked the injury.</p></div>
      </>
    )
  }
  const { moved, stageInfo, exercises } = today
  const minutes = Math.round((exercises.length * (ROUNDS * WORK_SECONDS + (ROUNDS - 1) * BREAK_SECONDS + 12)) / 60)

  return (
    <>
      <h1 className="title">Today</h1>
      <div className="today-stage">
        <span className="stage-chip">{stageInfo.name}</span>
        {moved > 0 && <span className="move-tag up">↑ Moved up</span>}
        {moved < 0 && <span className="move-tag down">↓ Easier today</span>}
      </div>

      <div className="rhythm" aria-label="Each exercise: 3 rounds of 30 seconds with 5 second breaks">
        <div><b>3</b><span>rounds</span></div>
        <div><b>30s</b><span>on</span></div>
        <div><b>5s</b><span>break</span></div>
      </div>

      <ol className="ex-list plain">
        {exercises.map((e, i) => (
          <li className="ex-item" key={e.id}>
            <span className="ex-num">{i + 1}</span>
            <span className="ex-name">{e.name}</span>
          </li>
        ))}
      </ol>

      <button className="btn primary" onClick={onStart}>
        ▶ {today.doneToday ? 'Go again' : 'Start'} · {minutes} min
      </button>
      {today.doneToday && <p className="muted center tight">Done today ✓</p>}
      {!checkedToday && (
        <button className="link-btn" onClick={onCheckIn}>Check in first so this matches how you feel →</button>
      )}
    </>
  )
}

// Footprints walking from stage to stage. Each hop between two stage circles is a curve; prints are placed
// along it at even spacing, alternating left and right foot, turned to face the direction of travel.
function bezier(a, b, t) {
  const midY = (a.y + b.y) / 2
  const p = [a, { x: a.x, y: midY }, { x: b.x, y: midY }, b]
  const u = 1 - t
  return {
    x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
    y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
  }
}

const STEP = 17

function Footsteps({ containerRef, current, deps }) {
  const [prints, setPrints] = useState([])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const measure = () => {
      const base = container.getBoundingClientRect()
      // Walk from just under one stage (below its label and any open card) to just above the next circle.
      const stops = Array.from(container.querySelectorAll('.path-stop')).map((stop) => {
        const node = stop.querySelector('.path-node').getBoundingClientRect()
        const whole = stop.getBoundingClientRect()
        return { x: node.left + node.width / 2 - base.left, top: node.top - base.top, bottom: whole.bottom - base.top }
      })
      const out = []
      let foot = 0
      for (let i = 0; i + 1 < stops.length; i++) {
        const a = { x: stops[i].x, y: stops[i].bottom + 6 }
        const b = { x: stops[i + 1].x, y: stops[i + 1].top - 8 }
        const samples = Array.from({ length: 80 }, (_, k) => bezier(a, b, k / 79))
        let dist = 0
        let next = STEP / 2
        for (let k = 1; k < samples.length; k++) {
          const p0 = samples[k - 1]
          const p1 = samples[k]
          const seg = Math.hypot(p1.x - p0.x, p1.y - p0.y)
          while (dist + seg >= next) {
            const f = (next - dist) / seg
            const x = p0.x + (p1.x - p0.x) * f
            const y = p0.y + (p1.y - p0.y) * f
            next += STEP
            const angle = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI + 90
            const side = foot++ % 2 === 0 ? -1 : 1
            const nx = -(p1.y - p0.y) / seg
            const ny = (p1.x - p0.x) / seg
            out.push({ x: x + nx * side * 7, y: y + ny * side * 7, angle, side, done: i < current })
          }
          dist += seg
        }
      }
      setPrints(out)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, ...deps])

  return (
    <svg className="footsteps" aria-hidden="true">
      {prints.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.angle}) scale(${p.side} 1)`} className={p.done ? 'done' : ''}>
          <ellipse cx="0" cy="1.5" rx="3.6" ry="5.6" />
          <ellipse cx="0.4" cy="-6.6" rx="2.6" ry="2.2" />
          <circle cx="-2.6" cy="-9.4" r="1" />
          <circle cx="-0.6" cy="-10.4" r="1" />
          <circle cx="1.6" cy="-10.2" r="0.95" />
          <circle cx="3.3" cy="-9" r="0.85" />
        </g>
      ))}
    </svg>
  )
}

function Goals({ goals }) {
  return (
    <ul className="goals">
      {goals.map((g) => (
        <li key={g.label} className={g.done ? 'done' : ''}>
          <span className="goal-box" aria-hidden="true">{g.done ? '✓' : ''}</span>
          {g.label}
        </li>
      ))}
    </ul>
  )
}

function PathMap({ partId, total, current, startDate, answers, today }) {
  const stages = phaseRanges(partId, total)
  const [open, setOpen] = useState(-1)
  const start = new Date(startDate).setHours(0, 0, 0, 0)
  const OFFSETS = [0, 60, 0, -60, 0]
  const containerRef = useRef(null)
  const next = current + 1 < stages.length ? current + 1 : null
  const returnGoals = [{ label: 'Reach your return date', done: false }, { label: 'A doctor clears you to play', done: false }]
  const goalsFor = (i) => (i === stages.length - 1 ? returnGoals : stageGoals(partId, i, answers))
  const nextGoals = next !== null ? goalsFor(next) : []
  const doneCount = nextGoals.filter((g) => g.done).length

  return (
    <>
      {next !== null && (
        <div className="card next-goal">
          <div className="next-head">
            <p className="eyebrow">To unlock {stages[next].name}</p>
            <span className="goal-count">{doneCount}/{nextGoals.length}</span>
          </div>
          <Goals goals={nextGoals} />
          {today?.held && <p className="muted">Unlocks {formatDate(today.unlockDate)} at the earliest, so it can heal.</p>}
          {!answers && <p className="muted">Do a check-in to see your progress.</p>}
        </div>
      )}
      <div className="path" ref={containerRef}>
        <Footsteps containerRef={containerRef} current={current} deps={[open, stages.length]} />
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
                {state === 'done'
                  ? 'Done'
                  : state === 'now'
                    ? "You're here"
                    : last
                      ? `Around ${formatDate(addDays(start, total))}`
                      : `About ${formatDate(addDays(start, Math.max(s.startDay - 1, 0)))}`}
              </p>
              {open === i && (
                <div className="card path-card">
                  {state === 'locked' && i !== next && (
                    <>
                      <p className="eyebrow">Unlocks when</p>
                      <Goals goals={goalsFor(i)} />
                    </>
                  )}
                  <p className="eyebrow">Exercises</p>
                  <ul className="list">
                    {(PROGRAM[partId]?.[s.id] ?? []).map((id) => <li key={id}>{EXERCISES[id].name}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
