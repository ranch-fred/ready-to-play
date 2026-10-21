import { useState } from 'react'
import { rules, redFlagsFor, isTriggered, scoreSelfTests, buildOutcome, worstAction } from './logic/triage'
import { loadState, saveState } from './logic/storage'
import { Intro } from './screens/Intro'
import { PickPart, PickSide, PickLocation, RedFlag, SelfTest } from './screens/Triage'
import { Result } from './screens/Result'
import { Profile } from './screens/Profile'
import { Home } from './screens/Home'
import { CheckIn, CheckInResult } from './screens/CheckIn'
import { Care } from './screens/Care'
import { startPlan, applyCheckIn } from './logic/recovery'

const FRESH = { screen: 'intro', partId: null, side: null, locations: [], flagIndex: 0, testIndex: 0, tests: {}, outcome: null }

export default function App() {
  const [saved, setSaved] = useState(() => loadState())
  const [state, setState] = useState(() => (saved?.injury ? { ...FRESH, screen: 'home' } : FRESH))
  const [history, setHistory] = useState([])

  const go = (patch) => {
    setHistory((h) => [...h, state])
    setState((s) => ({ ...s, ...patch }))
    window.scrollTo(0, 0)
  }
  const back = () => {
    if (!history.length) return setState({ ...FRESH, screen: saved?.injury ? 'home' : 'intro' })
    setState(history[history.length - 1])
    setHistory(history.slice(0, -1))
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
  const flags = partId ? redFlagsFor(partId) : []

  const afterFlags = () => {
    if (partId === 'other') return finish({ action: 'see_trainer', notes: [rules.otherPain.message] })
    const gated = locations.filter((l) => l.effect === 'action')
    if (gated.length) return finish({ action: worstAction(...gated.map((l) => l.action)), notes: gated.map((l) => l.note) })
    go({ screen: 'test', testIndex: 0, tests: {} })
  }

  switch (screen) {
    case 'intro':
      return <Intro onStart={() => go({ screen: 'part' })} />

    case 'part':
      return (
        <PickPart
          onBack={back}
          onPick={(id) => {
            if (id === 'other') return go({ screen: 'flag', partId: 'other', flagIndex: 0 })
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
            const urgent = locs.filter((l) => l.effect === 'action' && l.action === 'see_care_today')
            if (urgent.length) {
              return go({ screen: 'result', locations: locs, outcome: { action: 'see_care_today', notes: urgent.map((l) => l.note) } })
            }
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
            if (isTriggered(flag, answer)) return finish({ action: flag.action, notes: flag.note ? [flag.note] : [] })
            if (state.flagIndex + 1 < flags.length) return go({ flagIndex: state.flagIndex + 1 })
            afterFlags()
          }}
        />
      )
    }

    case 'test': {
      const tests = rules.injuries[partId].selfTests
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
            if (state.testIndex + 1 < tests.length) return go({ tests: answers, testIndex: state.testIndex + 1 })
            const severity = scoreSelfTests(partId, answers)
            finish(buildOutcome({ partId, locationIds: locations.map((l) => l.id), severity }))
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
                plan: state.outcome.estimate ? startPlan(partId, state.outcome.estimate, state.tests) : null,
              },
            }
            saveState(next)
            setSaved(next)
            setHistory([])
            setState({ ...FRESH, screen: 'home' })
          }}
        />
      )

    case 'home':
      return (
        <Home
          profile={saved.profile}
          injury={saved.injury}
          onUpdateInjury={saveInjury}
          onCheckIn={(day) => go({ screen: 'checkin', day })}
          onFindCare={() => go({ screen: 'care' })}
          onNewInjury={() => {
            if (!window.confirm('Start a new injury report? Your current plan will be replaced.')) return
            setHistory([])
            setState({ ...FRESH, screen: 'part' })
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
            setState({ ...FRESH, screen: 'checkinResult' })
          }}
        />
      )
    }

    case 'checkinResult':
      return (
        <CheckInResult
          injury={saved.injury}
          onDone={() => setState({ ...FRESH, screen: 'home' })}
          onFindCare={() => go({ screen: 'care' })}
        />
      )

    case 'care':
      return <Care town={saved?.profile?.town} onBack={back} />

    default:
      return null
  }
}
