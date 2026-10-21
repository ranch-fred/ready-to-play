import { useState } from 'react'
import { Screen, Choice } from '../components/Screen'
import { rules, addDays, formatDate } from '../logic/triage'
import { checkInQuestions, recovery } from '../logic/recovery'

export function CheckIn({ partId, onBack, onSubmit }) {
  const questions = checkInQuestions(partId)
  const [flagged, setFlagged] = useState(null)
  const [answers, setAnswers] = useState({ pain: 3 })
  const [touchedPain, setTouchedPain] = useState(false)
  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }))
  const done = flagged !== null && touchedPain && questions.every((q) => answers[q.id] !== undefined)

  return (
    <Screen
      onBack={onBack}
      title="Daily check-in"
      subtitle={`About 30 seconds. These questions are just for your ${rules.injuries[partId].name.toLowerCase()}.`}
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
              <div className={`pain-value p${answers.pain}`}>{touchedPain ? answers.pain : '–'}</div>
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

export function CheckInResult({ injury, onDone, onFindCare }) {
  const { plan } = injury
  const r = plan.lastResult
  const newDate = formatDate(addDays(injury.date, plan.projected))
  const needsCare = r.action !== 'plan' || r.overdue || r.painHigh

  let badge = 'Check-in saved'
  let title = 'Keep going'
  let copy = 'Stick with today\'s plan. Your date updates every time you check in.'
  if (r.action === 'see_care_today') {
    badge = 'Stop and get help'
    title = rules.actions.see_care_today.title
    copy = 'New numbness, tingling, or a sudden jump in pain or swelling needs a real check today. Pause your exercises.'
  } else if (r.action === 'see_trainer') {
    badge = 'Get it checked'
    title = 'Worse two check-ins in a row'
    copy = 'Show your athletic trainer or a doctor. Take it easy until then: rest, ice, and skip anything that hurts.'
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
          {needsCare && <button className="btn primary" onClick={onFindCare}>Find care near me</button>}
          <button className={`btn ${needsCare ? 'ghost' : 'primary'}`} onClick={onDone}>Back to my plan</button>
        </>
      }
    >
      <div className={`result ${TONE[r.action]}`}>
        <span className="result-badge">{badge}</span>
        <h1 className="result-title">{title}</h1>
        <p className="result-copy">{copy}</p>
      </div>
      {r.overdue && r.action === 'plan' && (
        <div className="card note"><p>This is taking longer than the plan expected. Have your athletic trainer or a doctor take a look.</p></div>
      )}
      {r.painHigh && r.action === 'plan' && (
        <div className="card note"><p>Your pain is high today. If it stays this high or gets worse, get it checked.</p></div>
      )}
    </Screen>
  )
}
