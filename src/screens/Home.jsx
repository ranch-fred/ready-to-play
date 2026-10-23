import { useEffect, useRef, useState } from 'react'
import { rules, addDays, formatDate, phaseRanges } from '../logic/triage'
import { recovery, startPlan, healProgress } from '../logic/recovery'
import { RecoveryCard } from '../components/RecoveryCard'
import { todayPlan, dayNumber, STAGES, ROUNDS, WORK_SECONDS, BREAK_SECONDS, stageGoals } from '../logic/plan'
import { EXERCISES, PROGRAM } from '../data/exercises'
import { CareView } from './Care'
import { CarePopup } from '../components/CarePopup'
import { Mascot } from '../components/Mascot'
import { Settings } from '../components/Settings'
import { useTheme } from '../logic/theme'
import { isRecovered, strengthInfo, buddyFace, TIERS, TIER_DAYS, STAGE_EMOJI } from '../logic/journey'

const STATUS = {
  plan: { label: 'Recovering', tone: 'good' },
  see_trainer: { label: 'Get checked first', tone: 'caution' },
  see_care_today: { label: 'See care today', tone: 'alert' },
}

const DAY_MS = 86400000
const CARE_DAYS = 3

const TABS = [
  { id: 'home', label: 'Home', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { id: 'today', label: 'Today', icon: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11' },
  { id: 'map', label: 'Map', icon: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
  { id: 'care', label: 'Tools', icon: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z' },
]

function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

// After recovery the countdown turns into the strength level: a big animal and a ring that fills toward the next one.
function StrengthOrb({ info }) {
  return (
    <div className="orb-wrap">
      <div className="dial" aria-hidden="true">
        <span className="dial-ticks" />
        <span className="dial-arc" style={{ '--p': info.progress }} />
      </div>
      <div className="orb strength" role="img" aria-label={`Strength level ${info.tier + 1}: ${info.current.name}`}>
        <span className="orb-emoji">{info.current.emoji}</span>
        <span className="orb-unit">{info.current.name}</span>
        <span className="orb-clock">LEVEL {info.tier + 1}{info.top ? ' · TOP' : ''}</span>
      </div>
      <p className="orb-caption">
        {info.next ? `${info.daysToNext} strength day${info.daysToNext === 1 ? '' : 's'} to ${info.next.emoji} ${info.next.name}` : 'Top of the food chain. Stay here.'}
      </p>
    </div>
  )
}

// Play look: your buddy takes the place of the countdown orb, with a ring that fills as you heal or level up.
function MascotHero({ face, says, ring, children }) {
  return (
    <div className="mascot-hero">
      <Mascot face={face} says={says} ring={ring} size="lg" />
      <div className="mascot-pill">{children}</div>
    </div>
  )
}

function CountdownText({ target, offsetDays }) {
  const now = useNow() + offsetDays * DAY_MS
  const left = Math.max(0, target - now)
  const days = Math.floor(left / DAY_MS)
  const hours = Math.floor((left % DAY_MS) / 3600000)
  const mins = Math.floor((left % 3600000) / 60000)
  const secs = Math.floor((left % 60000) / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    <>
      <b>{days}</b> {days === 1 ? 'day' : 'days'} to go
      <small>{pad(hours)}:{pad(mins)}:{pad(secs)} until you're recovered</small>
    </>
  )
}

function TierRow({ tier }) {
  return (
    <div className="tier-row" aria-hidden="true">
      {TIERS.map((t, i) => (
        <span key={t.id} className={i < tier ? 'done' : i === tier ? 'now' : ''}>{t.emoji}</span>
      ))}
    </div>
  )
}

function Orb({ target, offsetDays, heal }) {
  const now = useNow() + offsetDays * DAY_MS
  const left = Math.max(0, target - now)
  const days = Math.floor(left / DAY_MS)
  const hours = Math.floor((left % DAY_MS) / 3600000)
  const mins = Math.floor((left % 3600000) / 60000)
  const secs = Math.floor((left % 60000) / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    <div className="orb-wrap">
      <div className="dial" aria-hidden="true">
        <span className="dial-ticks" />
        <span className="dial-arc" style={{ '--p': heal }} />
      </div>
      <div className="orb" role="timer" aria-label={`${days} days, ${hours} hours until recovered`}>
        <span className="orb-days">{days}</span>
        <span className="orb-unit">{days === 1 ? 'day' : 'days'}</span>
        <span className="orb-clock">{pad(hours)}:{pad(mins)}:{pad(secs)}</span>
      </div>
      <p className="orb-caption">until you're recovered</p>
    </div>
  )
}

export function Home({ profile, injury, onNewInjury, onCheckIn, onUpdateInjury, onUpdateProfile, onStartSession, onReinjury, startTab = 'home' }) {
  const [tab, setTab] = useState(startTab)
  const theme = useTheme()
  const [doctorFirst, setDoctorFirst] = useState(false)
  const openTools = (doctor) => {
    setDoctorFirst(!!doctor)
    setTab('care')
    window.scrollTo(0, 0)
  }
  const [showSettings, setShowSettings] = useState(false)
  const { care: savedCare } = injury
  const closeCare = (toCareTab) => {
    setShowCare(false)
    if (!injury.careSeen) onUpdateInjury({ ...injury, careSeen: true })
    if (toCareTab) openTools(true)
  }
  const { outcome } = injury
  const part = rules.injuries[injury.partId]
  const spotIds = injury.locationIds ?? (injury.locationId ? [injury.locationId] : [])
  const spots = part?.locations.filter((l) => spotIds.includes(l.id)).map((l) => l.label) ?? []
  const offset = injury.dayOffset || 0
  const day = dayNumber(injury)
  // The care reminder is for the first few days. After day 3 it quietly goes away (the Tools tab still has doctors).
  const care = savedCare && day <= CARE_DAYS ? savedCare : null
  const [showCare, setShowCare] = useState(() => !!care && !injury.careSeen)
  const title = part
    ? `${injury.side ? injury.side[0].toUpperCase() + injury.side.slice(1) + ' ' : ''}${part.name.toLowerCase()}`
    : 'Injury'

  // Plans saved before daily check-ins existed get one here.
  const plan = outcome.estimate ? injury.plan ?? startPlan(injury.partId, outcome.estimate) : null
  const recovered = plan ? isRecovered(plan, day) : false
  const strong = recovered ? strengthInfo(plan, day) : null
  const status = recovered ? { label: `${strong.current.emoji} ${strong.current.name}`, tone: 'good' } : STATUS[outcome.action] || STATUS.see_trainer
  const checkedToday = plan?.checkIns.some((c) => c.day === day)
  const buddyId = profile?.buddy ?? 'classic'
  const firstName = profile?.name?.split(' ')[0]
  const says = recovered
    ? strong.current.focus
    : care && !checkedToday
      ? "Let's get that checked by a doctor too!"
      : !checkedToday
        ? firstName ? `Hi ${firstName}! Ready for today's check-in?` : "Hi! Ready for today's check-in?"
        : plan?.sessions?.[day]
          ? 'All done today! See you tomorrow 🎉'
          : "Nice check-in! Let's do today's session."
  const last = plan?.lastResult
  const today = plan ? todayPlan({ ...injury, plan }, day) : null
  const phase = today && !recovered ? { ...phaseRanges(injury.partId, plan.projected)[today.stage], index: today.stage, count: STAGES.length } : null
  const walkQ = recovery.checkIns[injury.partId]?.find((q) => q.id === 'walk')
  const cantWalk = !!walkQ && today?.lastAnswers?.walk === walkQ.options[2]
  const backDate = plan ? addDays(new Date(injury.date).setHours(0, 0, 0, 0), plan.projected) : null

  return (
    <div className="screen home tabbed">
      <header className="home-head">
        <div className="head-left">
          <button className="gear-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
          <div className="logo small">READY<span>TO</span>PLAY</div>
        </div>
        <p className="hello">{profile?.name ? `Hi ${profile.name}` : `Day ${day}`}</p>
      </header>

      {showSettings && (
        <Settings
          profile={profile}
          onSave={(p) => onUpdateProfile?.(p)}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showCare && care && <CarePopup care={care} onClose={closeCare} />}

      <div className="pane" key={tab}>
      {tab === 'home' && (
        <>
          <div className="home-title">
            <h2 className="injury-title">{title}</h2>
            <span className={`status ${status.tone}`}>{status.label}</span>
          </div>
          {spots.length > 0 && <p className="muted center">{spots.join(' · ')}</p>}
          {care && (
            <button className={`care-banner ${care.action === 'see_care_today' ? 'alert' : 'caution'}`} onClick={() => setShowCare(true)}>
              <span className="care-banner-dot" aria-hidden="true" />
              {care.action === 'see_care_today' ? 'Care recommended today' : 'Doctor visit recommended'}
              <span className="care-banner-go">Details →</span>
            </button>
          )}

          {plan ? (
            <>
              {recovered ? (
                <>
                  {theme === 'play' ? (
                    <MascotHero face={buddyFace(buddyId, 1, strong)} says={says} ring={strong.progress}>
                      <b>Level {strong.tier + 1}</b>{strong.top ? ' · top level' : ''}
                      <small>{strong.next ? `${strong.daysToNext} strength day${strong.daysToNext === 1 ? '' : 's'} to ${strong.next.emoji} ${strong.next.name}` : 'Top of the food chain. Stay here.'}</small>
                    </MascotHero>
                  ) : (
                    <StrengthOrb info={strong} />
                  )}
                  <div className="card center">
                    <p className="eyebrow">Fully recovered 🎉</p>
                    <p className="big-date">{strong.current.emoji} {strong.current.name}</p>
                    <p className="muted">{strong.current.focus}</p>
                    <TierRow tier={strong.tier} />
                  </div>
                </>
              ) : (
                <>
                  {theme === 'play' ? (
                    <MascotHero face={buddyFace(buddyId, healProgress(plan, day), null)} says={says} ring={healProgress(plan, day)}>
                      <CountdownText target={backDate.getTime()} offsetDays={offset} />
                    </MascotHero>
                  ) : (
                    <Orb target={backDate.getTime()} offsetDays={offset} heal={healProgress(plan, day)} />
                  )}
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
                </>
              )}

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

              <RecoveryCard injury={injury} plan={plan} day={day} />

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
                {recovered ? (
                  <>
                    <p className="eyebrow">Strength level {strong.tier + 1}{strong.top ? ' · top level' : ''}</p>
                    <p className="card-title">{strong.current.emoji} {strong.current.name}</p>
                  </>
                ) : (
                  <>
                    <p className="eyebrow">Stage {phase.index + 1} of {phase.count}</p>
                    <p className="card-title">{STAGE_EMOJI[phase.id]} {phase.name}</p>
                  </>
                )}
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

          <button className="btn ghost" onClick={() => openTools(true)}>Find a doctor</button>
          <button className="btn ghost" onClick={onNewInjury}>Report a new injury</button>

          {plan && (
            <div className="card demo-tools">
              <p className="eyebrow">Presenter tools · Day {day}</p>
              <div className="row">
                <button className="btn ghost" onClick={() => onUpdateInjury({ ...injury, plan, dayOffset: offset + 1 })}>
                  Next day
                </button>
                <button className="btn ghost" onClick={() => onUpdateInjury({ ...injury, plan, dayOffset: offset + 7 })}>
                  +1 week
                </button>
              </div>
              {offset > 0 && (
                <button className="link-btn" onClick={() => onUpdateInjury({ ...injury, plan, dayOffset: 0 })}>Back to today</button>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'today' && (
        <TodayTab today={today} checkedToday={checkedToday} onCheckIn={() => onCheckIn(day)} onStart={onStartSession} />
      )}

      {tab === 'care' && (
        <>
          <h1 className="title">Tools</h1>
          <CareView
            partId={injury.partId}
            outcome={savedCare ? { ...outcome, action: savedCare.action } : outcome}
            lastResult={recovered ? null : plan?.lastResult}
            stage={today?.stage ?? 0}
            cantWalk={cantWalk}
            town={profile?.town}
            doctorFirst={doctorFirst}
            onReinjury={onReinjury}
          />
        </>
      )}

      {tab === 'map' && (
        <>
          <h1 className="title">Your path</h1>
          {plan ? (
            <PathMap partId={injury.partId} total={plan.projected} current={recovered ? null : phase.index} strong={strong} startDate={injury.date} answers={today?.lastAnswers} today={today} />
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
          <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => { setDoctorFirst(false); setTab(t.id); window.scrollTo(0, 0) }}>
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
  const rounds = today.rounds ?? ROUNDS
  const minutes = Math.round((exercises.length * (rounds * WORK_SECONDS + (rounds - 1) * BREAK_SECONDS + 12)) / 60)

  return (
    <>
      <h1 className="title">Today</h1>
      <div className="today-stage">
        <span className="stage-chip">{stageInfo.name}</span>
        {moved > 0 && <span className="move-tag up">↑ Moved up</span>}
        {moved < 0 && <span className="move-tag down">↓ Easier today</span>}
      </div>

      {today.strong && <p className="muted center tight">{stageInfo.blurb}</p>}
      <div className="rhythm" aria-label={`Each exercise: ${today.rounds} rounds of 30 seconds with 5 second breaks`}>
        <div><b>{today.rounds}</b><span>rounds</span></div>
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

const STEP = 28

const FOOT_SOLE = 'M7 16C4.5 18.5 6 22 8.5 27c2 4 0 8 1 12 1 4 7.5 4.5 8-.5.5-4.5-1.5-7.5 0-12.5 1.5-5 2.5-9-.5-11.5C14 12.5 9.5 13 7 16Z'

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
            out.push({ x: x + nx * side * 8, y: y + ny * side * 8, angle, side, done: i < current })
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
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.angle}) scale(${-p.side * 0.62} 0.62) translate(-12.5 -23)`} className={p.done ? 'done' : ''}>
          <path d={FOOT_SOLE} />
          <circle cx="7.5" cy="8.5" r="3.2" />
          <circle cx="12.2" cy="6.6" r="1.9" />
          <circle cx="15.6" cy="7.6" r="1.8" />
          <circle cx="18.6" cy="9.6" r="1.6" />
          <circle cx="20.8" cy="12.6" r="1.35" />
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

// The whole journey: five recovery stages, then eight strength levels from mouse to gorilla. The gorilla level never ends.
function PathMap({ partId, total, current, strong, startDate, answers, today }) {
  const stages = phaseRanges(partId, total)
  const recoveredNow = current === null
  const [open, setOpen] = useState(-1)
  const start = new Date(startDate).setHours(0, 0, 0, 0)
  const OFFSETS = [0, 60, 0, -60, 0]
  const containerRef = useRef(null)
  const here = recoveredNow ? stages.length + strong.tier : current
  const nodes = [
    ...stages.map((s) => ({ key: s.id, emoji: STAGE_EMOJI[s.id], name: s.name, when: s.id === 'return' ? addDays(start, total) : addDays(start, Math.max(s.startDay - 1, 0)), stage: s })),
    ...TIERS.map((t, i) => ({ key: t.id, emoji: t.emoji, name: i === TIERS.length - 1 ? `${t.name} · top level` : t.name, when: addDays(start, total + i * TIER_DAYS), tier: t, tierIndex: i })),
  ]
  const nextStage = !recoveredNow && current + 1 < stages.length ? current + 1 : null
  const returnGoals = [{ label: 'Reach your return date', done: false }, { label: 'A doctor clears you to play', done: false }]
  const goalsFor = (i) => (i === stages.length - 1 ? returnGoals : stageGoals(partId, i, answers))
  const nextGoals = nextStage !== null ? goalsFor(nextStage) : []
  const doneCount = nextGoals.filter((g) => g.done).length

  return (
    <>
      {nextStage !== null && (
        <div className="card next-goal">
          <div className="next-head">
            <p className="eyebrow">To unlock {STAGE_EMOJI[stages[nextStage].id]} {stages[nextStage].name}</p>
            <span className="goal-count">{doneCount}/{nextGoals.length}</span>
          </div>
          <Goals goals={nextGoals} />
          {today?.held && <p className="muted">Unlocks {formatDate(today.unlockDate)} at the earliest, so it can heal.</p>}
          {!answers && <p className="muted">Do a check-in to see your progress.</p>}
        </div>
      )}
      {recoveredNow && (
        <div className="card next-goal">
          <div className="next-head">
            <p className="eyebrow">{strong.next ? `Next: ${strong.next.emoji} ${strong.next.name}` : `${strong.current.emoji} You made it to the top`}</p>
            {strong.next && <span className="goal-count">{strong.daysToNext}d</span>}
          </div>
          <p className="muted">
            {strong.next
              ? `Do your strength session each day. A new animal unlocks every ${TIER_DAYS} days.`
              : 'There is no finish line. Stay a gorilla by keeping up your daily training.'}
          </p>
        </div>
      )}
      <div className="path" ref={containerRef}>
        <Footsteps containerRef={containerRef} current={here} deps={[open, nodes.length]} />
        {nodes.map((n, i) => {
          const state = i < here ? 'done' : i === here ? 'now' : 'locked'
          const lastNode = i === nodes.length - 1
          return (
            <div key={n.key} className="path-stop" style={{ '--x': `${OFFSETS[i % OFFSETS.length]}px` }}>
              <button className={`path-node emoji ${state}`} onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} aria-label={n.name}>
                <span aria-hidden="true">{n.emoji}</span>
              </button>
              <p className="path-label">{n.name}</p>
              <p className="path-days">
                {state === 'done'
                  ? 'Done'
                  : state === 'now'
                    ? "You're here"
                    : lastNode
                      ? 'No finish line. Stay here.'
                      : n.stage?.id === 'return'
                        ? `Around ${formatDate(n.when)}`
                        : `About ${formatDate(n.when)}`}
              </p>
              {open === i && (
                <div className="card path-card">
                  {n.stage && state === 'locked' && i !== nextStage && (
                    <>
                      <p className="eyebrow">Unlocks when</p>
                      <Goals goals={goalsFor(i)} />
                    </>
                  )}
                  {n.stage && (
                    <>
                      <p className="eyebrow">Exercises</p>
                      <ul className="list">
                        {(PROGRAM[partId]?.[n.stage.id] ?? []).map((id) => <li key={id}>{EXERCISES[id].name}</li>)}
                      </ul>
                    </>
                  )}
                  {n.tier && (
                    <>
                      <p className="eyebrow">{n.tier.focus}</p>
                      <ul className="list">
                        {(PROGRAM[partId]?.strong ?? []).map((id) => <li key={id}>{EXERCISES[id].name}</li>)}
                      </ul>
                      <p className="muted">
                        {lastNode ? 'Top level. You stay here as long as you keep training.' : `Unlocks after ${n.tierIndex * TIER_DAYS} days of strength training.`}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
