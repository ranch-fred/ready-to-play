import { useState } from 'react'
import { rules, redFlagsFor, isTriggered, tailoredQuestions, stopFor, scoreAnswers, buildOutcome, mergeStops, carefulEstimate, recommendation } from './logic/triage'
import { loadState, saveState } from './logic/storage'
import { Intro } from './screens/Intro'
import { PickPart, PickSide, PickLocation, RedFlag, SelfTest } from './screens/Triage'
import { Result } from './screens/Result'
import { Profile } from './screens/Profile'
import { Home } from './screens/Home'
import { CheckIn, CheckInResult } from './screens/CheckIn'
import { Care } from './screens/Care'
import { Loading } from './screens/Loading'
import { Session } from './screens/Session'
import { todayPlan, dayNumber } from './logic/plan'
import { startPlan, applyCheckIn } from './logic/recovery'

const FRESH = { screen: 'intro', partId: null, side: null, locations: [], flagIndex: 0, testIndex: 0, tests: {}, outcome: null, stops: [] }

export default function App() {
  const [saved, setSaved] = useState(() => loadState())
  const [state, setState] = useState(() => (saved?.injury ? { ...FRESH, screen: 'home' } : FRESH))
  const [history, setHistory] = useState([])
  // Which way the last move went, so new screens glide in from the right and slide back in from the left.
  const [dir, setDir] = useState('forward')

  const go = (patch) => {
    setDir('forward')
    setHistory((h) => [...h, state])
    setState((s) => ({ ...s, ...patch }))
    window.scrollTo(0, 0)
  }
  const back = () => {
    setDir('back')
    if (!history.length) return setState({ ...FRESH, screen: saved?.injury ? 'home' : 'intro' })
    setState(history[history.length - 1])
    setHistory(history.slice(0, -1))
  }
  // Jumps that aren't a step forward or back (finishing a plan, leaving a session) still glide in forward.
  const jump = (next) => {
    setDir('forward')
    setState(next)
  }
  const restart = () => {
    setHistory([])
    setState(FRESH)
  }
  const finish = (outcome) => go({ screen: 'result', outcome })
  const saveInjury = (injury) => {
    const next = { ...saved, injury }
    saveState(next)
    setSaved(next)
  }

  const { screen, partId, locations } = state
  const flags = partId ? redFlagsFor() : []

  // Warning signs never end the form early. They're saved as "stops" and applied to the result once every question is answered.
  const afterFlags = (locs = locations, extra = {}) => {
    const gated = locs.filter((l) => l.effect === 'action').map((l) => ({ action: l.action, note: l.note }))
    const stops = [...(extra.stops ?? state.stops), ...gated]
    if (partId === 'other' || extra.partId === 'other') return go({ ...extra, stops, screen: 'result', outcome: mergeStops({ action: 'see_trainer', notes: [rules.otherPain.message] }, stops) })
    go({ ...extra, stops, screen: 'test', locations: locs, testIndex: 0, tests: {} })
  }

  const renderScreen = () => {
  switch (screen) {
    case 'intro':
      return <Intro onStart={() => go({ screen: 'part' })} />

    case 'part':
      return (
        <PickPart
          onBack={back}
          onPick={(id) => {
            if (id === 'other') return flags.length || redFlagsFor().length ? go({ screen: 'flag', partId: 'other', flagIndex: 0 }) : afterFlags([], { partId: 'other' })
            go({ screen: 'side', partId: id })
          }}
        />
      )

    case 'side':
      return <PickSide partId={partId} onBack={back} onPick={(side) => go({ screen: 'location', side })} />

    case 'location':
      return (
        <PickLocation
          partId={partId}
          side={state.side}
          onBack={back}
          onDone={(locs) => {
            if (!flags.length) return afterFlags(locs)
            go({ screen: 'flag', locations: locs, flagIndex: 0 })
          }}
        />
      )

    case 'flag': {
      const flag = flags[state.flagIndex]
      return (
        <RedFlag
          key={flag.id}
          flag={flag}
          index={state.flagIndex}
          total={flags.length}
          onBack={back}
          onAnswer={(answer) => {
            const stops = isTriggered(flag, answer) ? [...state.stops, { action: flag.action, note: flag.note }] : state.stops
            if (state.flagIndex + 1 < flags.length) return go({ stops, flagIndex: state.flagIndex + 1 })
            afterFlags(locations, { stops })
          }}
        />
      )
    }

    case 'test': {
      const tests = tailoredQuestions(partId, locations.map((l) => l.id))
      const test = tests[state.testIndex]
      return (
        <SelfTest
          key={test.id}
          test={test}
          index={state.testIndex}
          total={tests.length}
          side={state.side}
          onBack={back}
          onAnswer={(answer) => {
            const answers = { ...state.tests, [test.id]: answer }
            const stop = stopFor(test, answer)
            const stops = stop ? [...state.stops, { action: stop.action, note: stop.note }] : state.stops
            if (state.testIndex + 1 < tests.length) return go({ tests: answers, stops, testIndex: state.testIndex + 1 })
            const { severity, addDays, notes, focus } = scoreAnswers(tests, answers)
            const outcome = mergeStops(buildOutcome({ partId, locationIds: locations.map((l) => l.id), severity, addDays, notes, focus }), stops)
            // A plan gets the loading screen, then goes straight to the home tabs.
            if (outcome.action === 'plan') return go({ screen: 'loading', tests: answers, outcome })
            // Serious answers still get a plan. Home opens with a care pop-up the person can close.
            const estimate = carefulEstimate(partId, severity)
            if (estimate) {
              const rec = recommendation(outcome)
              const care = { action: outcome.action, notes: outcome.notes ?? [], who: rec.who, when: rec.when }
              return go({ screen: 'loading', tests: answers, outcome: { action: 'plan', severity, notes: [], estimate, focus, care } })
            }
            finish(outcome)
          }}
        />
      )
    }

    case 'result':
      return (
        <Result
          outcome={state.outcome}
          onBack={back}
          onRestart={restart}
          onFindCare={() => go({ screen: 'care' })}
          onContinue={() => go({ screen: 'profile' })}
        />
      )

    case 'loading':
      return (
        <Loading
          onDone={() => {
            const next = {
              profile: saved?.profile ?? null,
              injury: {
                partId,
                side: state.side,
                locationIds: locations.map((l) => l.id),
                outcome: state.outcome,
                date: new Date().toISOString(),
                plan: startPlan(partId, state.outcome.estimate),
                care: state.outcome.care ?? null,
                careSeen: false,
              },
            }
            saveState(next)
            setSaved(next)
            setHistory([])
            jump({ ...FRESH, screen: 'home' })
          }}
        />
      )

    case 'profile':
      return (
        <Profile
          initial={saved?.profile}
          onBack={back}
          onSave={(profile) => {
            const next = {
              profile,
              injury: {
                partId,
                side: state.side,
                locationIds: locations.map((l) => l.id),
                outcome: state.outcome,
                date: new Date().toISOString(),
                plan: state.outcome.estimate ? startPlan(partId, state.outcome.estimate) : null,
              },
            }
            saveState(next)
            setSaved(next)
            setHistory([])
            jump({ ...FRESH, screen: 'home' })
          }}
        />
      )

    case 'home':
      return (
        <Home
          key={state.homeTab ?? 'home'}
          startTab={state.homeTab}
          profile={saved.profile}
          injury={saved.injury}
          onUpdateInjury={saveInjury}
          onStartSession={() => go({ screen: 'session', homeTab: 'today' })}
          onCheckIn={(day) => go({ screen: 'checkin', day })}
          onNewInjury={() => {
            if (!window.confirm('Start a new injury report? Your current plan will be replaced.')) return
            setHistory([])
            jump({ ...FRESH, screen: 'part' })
          }}
        />
      )

    case 'checkin': {
      const injury = saved.injury
      return (
        <CheckIn
          partId={injury.partId}
          onBack={back}
          onSubmit={({ answers, flagged }) => {
            const plan = applyCheckIn(injury.plan ?? startPlan(injury.partId, injury.outcome.estimate), {
              partId: injury.partId,
              day: state.day,
              answers,
              flagged,
              minDays: injury.outcome.estimate.minDays,
            })
            saveInjury({ ...injury, plan })
            setHistory([])
            jump({ ...FRESH, screen: 'checkinResult' })
          }}
        />
      )
    }

    case 'checkinResult':
      return (
        <CheckInResult
          injury={saved.injury}
          onDone={() => jump({ ...FRESH, screen: 'home', homeTab: 'today' })}
          onFindCare={() => go({ screen: 'care' })}
        />
      )

    case 'session': {
      const injury = saved.injury
      const plan = injury.plan ?? startPlan(injury.partId, injury.outcome.estimate)
      const day = dayNumber(injury)
      const today = todayPlan({ ...injury, plan }, day)
      return (
        <Session
          partId={injury.partId}
          side={injury.side}
          today={today}
          onExit={() => {
            setHistory([])
            jump({ ...FRESH, screen: 'home', homeTab: 'today' })
          }}
          onFinish={() => {
            saveInjury({ ...injury, plan: { ...plan, sessions: { ...plan.sessions, [day]: { rounds: today.rounds, stage: today.stage } } } })
            setHistory([])
            jump({ ...FRESH, screen: 'home', homeTab: 'home' })
          }}
        />
      )
    }

    case 'care':
      {
        const inj = saved?.injury
        const fromTriage = !!state.outcome
        return (
          <Care
            partId={fromTriage ? partId : inj?.partId}
            outcome={fromTriage ? state.outcome : inj?.outcome}
            lastResult={fromTriage ? null : inj?.plan?.lastResult}
            stage={0}
            town={saved?.profile?.town}
            onBack={back}
          />
        )
      }

    default:
      return null
  }
  }

  return <div className="view" data-dir={dir}>{renderScreen()}</div>
}
