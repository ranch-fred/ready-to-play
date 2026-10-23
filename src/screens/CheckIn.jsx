import { useEffect, useState } from 'react'
import { haptic } from '../logic/feedback'
import { Screen, Choice } from '../components/Screen'
import { rules, addDays, formatDate } from '../logic/triage'
import { checkInQuestions, recovery } from '../logic/recovery'
import { strengthInfo } from '../logic/journey'
import { dayNumber } from '../logic/plan'

export function CheckIn({ partId, severity, recovered, onBack, onSubmit }) {
  const questions = checkInQuestions(partId, { severity, recovered })
  const [flagged, setFlagged] = useState(null)
  const [answers, setAnswers] = useState({ pain: 3 })
  const [touchedPain, setTouchedPain] = useState(false)
  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }))
  const done = flagged !== null && touchedPain && questions.every((q) => answers[q.id] !== undefined)

  return (
    <Screen
      onBack={onBack}
      title="Daily check-in"
      subtitle={recovered ? `Strength check. Quick tests to see how strong your ${rules.injuries[partId].name.toLowerCase()} is getting.` : `About 30 seconds. These questions are just for your ${rules.injuries[partId].name.toLowerCase()}.`}
      footer={
        <button className="btn primary" disabled={!done} onClick={() => onSubmit({ answers, flagged })}>
          Save check-in
        </button>
      }
    >
      <p className="question">{recovery.safetyQuestion.question}</p>
      <div className="row">
        <button className={`btn yes ${flagged === true ? 'on' : ''}`} aria-pressed={flagged === true} onClick={() => setFlagged(true)}>Yes</button>
        <button className={`btn no ${flagged === false ? 'on' : ''}`} aria-pressed={flagged === false} onClick={() => setFlagged(false)}>No</button>
      </div>

      {questions.map((q) => (
        <div key={q.id} className="checkin-q">
          <p className="question">{q.question}</p>
          {q.type === 'scale' ? (
            <div className="pain">
              <div className={`pain-value p${answers.pain}`}>{touchedPain ? <span key={answers.pain}>{answers.pain}</span> : '–'}</div>
              <input
                type="range"
                min="0"
                max="10"
                value={answers.pain}
                onChange={(e) => {
                  setTouchedPain(true)
                  set('pain', Number(e.target.value))
                }}
                onClick={() => setTouchedPain(true)}
                aria-label="Pain from 0 to 10"
              />
              <div className="pain-scale"><span>No pain</span><span>Worst ever</span></div>
            </div>
          ) : (
            <div className="stack">
              {q.options.map((o) => (
                <Choice key={o} label={o} selected={answers[q.id] === o} onClick={() => set(q.id, o)} />
              ))}
            </div>
          )}
        </div>
      ))}
    </Screen>
  )
}

const TONE = { see_care_today: 'alert', see_trainer: 'caution', plan: 'good' }

export function CheckInResult({ injury, onDone, onFindCare, onReinjury }) {
  const { plan } = injury
  const r = plan.lastResult
  const newDate = formatDate(addDays(injury.date, plan.projected))
  const needsCare = r.action !== 'plan' || r.overdue || (r.painHigh && !r.strength)
  const improved = r.action === 'plan' && r.shrunk > 0
  useEffect(() => {
    if (improved) haptic([30, 50, 30])
  }, [improved])

  const strong = r.strength ? strengthInfo(plan, dayNumber(injury)) : null

  let badge = 'Check-in saved'
  let title = 'Keep going'
  let copy = 'Stick with today\'s plan. Your date updates every time you check in.'
  if (r.strength && r.action === 'plan') {
    if (r.painHigh) {
      badge = 'Pain is back'
      title = 'Ease off today'
      copy = 'Pain after recovering can mean you pushed too hard or it got hurt again. Rest it. If it keeps hurting, tell us and we will rebuild your plan.'
    } else {
      badge = 'Strength logged'
      title = `${strong.current.emoji} Strong work, ${strong.current.name}`
      copy = strong.next ? `${strong.daysToNext} more strength day${strong.daysToNext === 1 ? '' : 's'} to reach ${strong.next.emoji} ${strong.next.name}.` : 'You are a gorilla. Keep training to stay here.'
    }
  } else if (r.action === 'see_care_today') {
    badge = 'Stop and get help'
    title = rules.actions.see_care_today.title
    copy = 'New numbness, tingling, or a sudden jump in pain or swelling needs a real check today. Pause your exercises.'
  } else if (r.action === 'see_trainer') {
    badge = 'Get it checked'
    title = 'Worse two check-ins in a row'
    copy = 'See a doctor. Take it easy until then: rest, ice, and skip anything that hurts.'
  } else if (r.shrunk > 0) {
    badge = 'Getting better'
    title = `Your return date moved up ${r.shrunk} day${r.shrunk === 1 ? '' : 's'}`
    copy = `New estimate: ${newDate}.`
  } else if (r.worse) {
    badge = 'A bit worse today'
    title = 'Take it easier today'
    copy = 'Your date stays the same. Rest, ice, and skip anything that hurts.'
  }

  return (
    <Screen
      footer={
        <>
          {r.strength && r.painHigh && r.action === 'plan' && <button className="btn primary" onClick={() => onReinjury('after')}>I hurt it again</button>}
          {needsCare && <button className="btn primary" onClick={onFindCare}>Find care near me</button>}
          <button className={`btn ${needsCare ? 'ghost' : 'primary'}`} onClick={onDone}>Back to my plan</button>
        </>
      }
    >
      <div className={`result ${r.strength && r.painHigh && r.action === 'plan' ? 'caution' : TONE[r.action]}`}>
        <span className="result-badge">{badge}</span>
        <h1 className="result-title">{title}</h1>
        <p className="result-copy">{copy}</p>
      </div>
      {r.overdue && r.action === 'plan' && (
        <div className="card note"><p>This is taking longer than the plan expected. Have a doctor take a look.</p></div>
      )}
      {r.painHigh && !r.strength && r.action === 'plan' && (
        <div className="card note"><p>Your pain is high today. If it stays this high or gets worse, get it checked.</p></div>
      )}
    </Screen>
  )
}
