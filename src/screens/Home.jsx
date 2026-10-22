import { useEffect, useRef, useState } from 'react'
import { rules, addDays, formatDate, phaseRanges } from '../logic/triage'
import { recovery, startPlan } from '../logic/recovery'
import { todayPlan, dayNumber, STAGES } from '../logic/plan'
import { EXERCISES, PROGRAM } from '../data/exercises'

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

export function Home({ profile, injury, onNewInjury, onCheckIn, onFindCare, onUpdateInjury, onStartSession, startTab = 'home' }) {
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

      {tab === 'today' && (
        <TodayTab
          today={today}
          outcome={outcome}
          tips={tips}
          checkedToday={checkedToday}
          onCheckIn={() => onCheckIn(day)}
          onStart={(sets) => onStartSession(sets)}
        />
      )}

      {tab === 'map' && (
        <>
          <h1 className="title">Your path</h1>
          {plan && <p className="subtitle">{phase.count}-stage plan · your check-ins move you along it</p>}
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

function TodayTab({ today, outcome, tips, checkedToday, onCheckIn, onStart }) {
  const [sets, setSets] = useState(today?.suggestedSets ?? 2)
  const [showTips, setShowTips] = useState(false)

  if (!today) {
    return (
      <>
        <h1 className="title">Today</h1>
        <div className="card"><p>Your exercises start once your athletic trainer or a doctor has checked the injury.</p></div>
        {outcome.confirmWithTrainer && <div className="card note"><p>Have your athletic trainer or a doctor confirm what this injury is.</p></div>}
      </>
    )
  }

  const minutes = Math.max(1, Math.round((today.exercises.reduce((s, e) => s + e.duration + 12, 0) * sets + today.exercises.length * 20) / 60))
  const { moved, changes, stageInfo } = today

  return (
    <>
      <h1 className="title">Today's plan</h1>
      <p className="subtitle">
        Stage {today.stage + 1} of {STAGES.length} · {stageInfo.name}
      </p>

      {moved !== 0 && (
        <div className={`card change ${moved > 0 ? 'up' : 'down'}`}>
          <p className="eyebrow">{moved > 0 ? 'Your plan moved up' : 'Easier plan today'}</p>
          <p className="card-title">
            {STAGES[today.previous].name} → {stageInfo.name}
          </p>
          {changes.length > 0 && (
            <div className="because">
              <p className="muted">Because of your check-in:</p>
              {changes.map((c) => <p key={c.text} className="change-what">{c.text}</p>)}
            </div>
          )}
        </div>
      )}
      {moved === 0 && changes.length > 0 && (
        <div className="card change same">
          <p className="muted">Since last time: <b className="change-what">{changes[0].text}</b>. Your exercises adjust every time you check in.</p>
        </div>
      )}
      {today.held && (
        <div className="card note">
          <p>
            You're feeling great! The next stage unlocks on <b>{formatDate(today.unlockDate)}</b> so the injury has time to heal underneath.
          </p>
        </div>
      )}
      {!checkedToday && (
        <div className="card note">
          <p>Check in first so today's exercises match how you feel today.</p>
          <button className="btn ghost small" onClick={onCheckIn}>Do today's check-in</button>
        </div>
      )}
      {today.easy && (
        <div className="card note">
          <p>Pain was {today.pain}/10 at your last check-in, so moves are smaller and there are fewer reps.</p>
        </div>
      )}

      <div className="ex-list">
        {today.exercises.map((e, i) => (
          <div className="ex-item" key={e.id}>
            <span className="ex-num">{i + 1}</span>
            <div className="ex-text">
              <p className="ex-name">{e.name}</p>
              <p className="muted">{e.why}</p>
            </div>
            <span className="ex-amount">{e.reps ? `${e.reps} reps` : `${e.seconds}s`}</span>
          </div>
        ))}
      </div>

      {today.doneToday ? (
        <div className="card center">
          <p className="card-title">Done for today ✓</p>
          <p className="muted">You did {today.doneToday.sets} {today.doneToday.sets === 1 ? 'round' : 'rounds'}. Want more? You can go again.</p>
        </div>
      ) : null}

      <div className="rounds">
        <p className="rounds-label">How many rounds?</p>
        <div className="seg" role="radiogroup" aria-label="Rounds">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} role="radio" aria-checked={sets === n} className={sets === n ? 'on' : ''} onClick={() => setSets(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <button className="btn primary" onClick={() => onStart(sets)}>
        ▶ {today.doneToday ? 'Go again' : 'Start session'} · about {minutes} min
      </button>
      <p className="muted center tight">Each exercise: watch the demo, then do it with the countdown.</p>

      {tips && (
        <div className="card">
          <button className="tips-toggle" onClick={() => setShowTips(!showTips)} aria-expanded={showTips}>
            <span className="card-title">Pain relief tips</span>
            <span aria-hidden="true">{showTips ? '−' : '+'}</span>
          </button>
          {showTips && (
            <>
              <ul className="list">
                {tips.map((t) => <li key={t}>{t}</li>)}
              </ul>
              <p className="muted">{recovery.relief.medicine}</p>
            </>
          )}
        </div>
      )}

      <div className="card cleared">
        <p className="card-title">Before you play again</p>
        <p className="muted">Get cleared by your athletic trainer or a doctor. ReadyToPlay never clears you by itself.</p>
      </div>
    </>
  )
}

function smoothPath(pts) {
  if (pts.length < 2) return ''
  let path = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const cur = pts[i]
    const midY = (prev.y + cur.y) / 2
    path += ` C ${prev.x} ${midY}, ${cur.x} ${midY}, ${cur.x} ${cur.y}`
  }
  return path
}

function PathLine({ containerRef, current, deps }) {
  const [paths, setPaths] = useState(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const measure = () => {
      const base = container.getBoundingClientRect()
      const nodes = container.querySelectorAll('.path-node')
      const pts = Array.from(nodes).map((n) => {
        const r = n.getBoundingClientRect()
        return { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top }
      })
      if (pts.length < 2) return setPaths(null)
      const doneEnd = Math.min(Math.max(current, 0), pts.length - 1)
      setPaths({
        track: smoothPath(pts),
        done: doneEnd > 0 ? smoothPath(pts.slice(0, doneEnd + 1)) : '',
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, ...deps])

  if (!paths) return null
  return (
    <svg className="path-line" aria-hidden="true">
      <path d={paths.track} className="path-line-track" />
      {paths.done && (
        <>
          <path d={paths.done} className="path-line-glow" />
          <path d={paths.done} className="path-line-done" />
        </>
      )}
    </svg>
  )
}

function PathMap({ partId, total, current, startDate }) {
  const stages = phaseRanges(partId, total)
  const [open, setOpen] = useState(current)
  const start = new Date(startDate).setHours(0, 0, 0, 0)
  const OFFSETS = [0, 60, 0, -60, 0]
  const containerRef = useRef(null)

  return (
    <div className="path" ref={containerRef}>
      <PathLine containerRef={containerRef} current={current} deps={[open, stages.length]} />
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
                {state === 'locked' && <p className="eyebrow">Unlocks when your check-ins are ready for it</p>}
                <ul className="list">
                  {(PROGRAM[partId]?.[s.id] ?? []).map((id) => <li key={id}>{EXERCISES[id].name}</li>)}
                  {last && <li>Your athletic trainer or a doctor clears you to play</li>}
                </ul>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
