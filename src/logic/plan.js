import { rules, addDays, daysBetween } from './triage'
import { checkInQuestions } from './recovery'
import { PROGRAM, exercise } from '../data/exercises'
import { period } from './motion'

// Today's stage comes from how the athlete answered their latest check-in, not just the calendar.
// Going from "can't put weight on it" to "walking with a limp" moves the plan up right away; a worse day
// moves it back down. Two safety gates keep it from racing ahead of healing time:
// strength work waits until about a quarter of the shortest expected recovery, sport drills until half.

export const STAGES = rules.phaseTemplate

const STAGE = { protect: 0, motion: 1, strength: 2, sport: 3, return: 4 }

// Option position for an answer: 0 = best, 1 = middle, 2 = worst.
function level(partId, answers, id) {
  const q = checkInQuestions(partId).find((x) => x.id === id)
  if (!q || answers?.[id] === undefined) return 0
  return Math.max(0, q.options.indexOf(answers[id]))
}

// What the athlete can do today, as a stage, from one set of check-in answers.
function stageFromAnswers(partId, answers) {
  const L = (id) => level(partId, answers, id)
  const pain = answers.pain ?? 0
  if (partId === 'ankle') {
    if (L('walk') === 2 || pain >= 7 || L('swelling') === 2) return STAGE.protect
    if (L('walk') === 1 || L('rom') === 2 || pain >= 4) return STAGE.motion
    if (L('balance') > 0 || L('rom') > 0 || L('swelling') > 0 || pain >= 2) return STAGE.strength
    return STAGE.sport
  }
  if (partId === 'shoulder') {
    if (L('daily') === 2 || L('overhead') === 2 || L('night') === 2 || pain >= 7) return STAGE.protect
    if (L('overhead') === 1 || L('reach_back') === 2 || pain >= 4) return STAGE.motion
    if (L('reach_back') > 0 || L('daily') > 0 || L('night') > 0 || pain >= 2) return STAGE.strength
    return STAGE.sport
  }
  if (partId === 'hamstring') {
    if (L('walk') === 2 || L('bend_knee') === 2 || pain >= 7) return STAGE.protect
    if (L('walk') === 1 || L('stretch') === 2 || pain >= 4) return STAGE.motion
    if (L('jog') > 0 || L('stretch') > 0 || L('bend_knee') > 0 || pain >= 2) return STAGE.strength
    return STAGE.sport
  }
  if (partId === 'wrist') {
    if (L('bend') === 2 || L('swelling') === 2 || pain >= 7) return STAGE.protect
    if (L('bend') === 1 || L('grip') === 2 || pain >= 4) return STAGE.motion
    if (L('grip') > 0 || L('weight') > 0 || L('swelling') > 0 || pain >= 2) return STAGE.strength
    return STAGE.sport
  }
  return STAGE.protect
}

// Earliest day each stage can start, so a great day 2 doesn't jump straight to hops.
export function stageGates(estimate) {
  const min = estimate?.minDays ?? 14
  return [1, 2, Math.max(3, Math.round(min * 0.25)), Math.max(5, Math.round(min * 0.5)), Infinity]
}

function gate(stage, day, estimate, projected) {
  const gates = stageGates(estimate)
  let s = stage
  while (s > 0 && day < gates[s]) s--
  // Past the projected return day with sport-level answers: time for the trainer to clear them.
  if (stage >= STAGE.sport && projected && day >= projected) return { stage: STAGE.return, held: false }
  return { stage: s, held: s < stage, unlockDay: s < stage ? gates[s + 1] : null }
}

function startingStage(outcome) {
  return outcome?.severity === 'mild' ? STAGE.motion : STAGE.protect
}

const LABELS = {
  walk: 'Walking',
  rom: 'Moving the ankle',
  swelling: 'Swelling',
  balance: 'Balance',
  overhead: 'Arm overhead',
  reach_back: 'Reaching back',
  daily: 'Everyday things',
  night: 'Sleep',
  bend_knee: 'Bending the knee',
  stretch: 'Stretching',
  jog: 'Jogging',
  bend: 'Bending the wrist',
  grip: 'Grip',
  weight: 'Weight on the hand',
}

// The answers that changed the most between two check-ins, in words (biggest first, at most two).
// Function (walking, grip...) counts more than the pain number.
function biggestChanges(partId, before, after) {
  if (!before || !after) return []
  const out = []
  for (const q of checkInQuestions(partId)) {
    if (q.type === 'scale') {
      const d = Math.abs((before.pain ?? 0) - (after.pain ?? 0))
      if (d >= 2) out.push({ size: d / 4, text: `Pain ${before.pain} → ${after.pain}` })
      continue
    }
    const a = q.options.indexOf(before[q.id])
    const b = q.options.indexOf(after[q.id])
    if (a < 0 || b < 0 || a === b) continue
    out.push({ size: Math.abs(a - b) + 0.01, text: `${LABELS[q.id] ?? q.id}: ${before[q.id]} → ${after[q.id]}` })
  }
  return out.sort((x, y) => y.size - x.size).slice(0, 2)
}

export function todayPlan(injury, day) {
  const { partId, outcome, plan } = injury
  if (!plan || !PROGRAM[partId]) return null
  const checks = plan.checkIns ?? []
  const last = checks[checks.length - 1]
  const prev = checks[checks.length - 2]

  const raw = last ? stageFromAnswers(partId, last.answers) : startingStage(outcome)
  const { stage, held, unlockDay } = gate(raw, day, outcome.estimate, plan.projected)
  const before = prev ? gate(stageFromAnswers(partId, prev.answers), last.day, outcome.estimate, plan.projected).stage : last ? gate(startingStage(outcome), last.day, outcome.estimate, plan.projected).stage : null
  const changes = last ? biggestChanges(partId, prev?.answers, last.answers) : []

  // Gentler on painful days: smaller range of motion and fewer reps.
  const pain = last?.answers.pain
  const easy = pain >= 6 ? 0.6 : pain >= 4 ? 0.8 : 1
  const exercises = PROGRAM[partId][STAGES[stage].id].map((id) => {
    const ex = exercise(id)
    const reps = ex.reps ? Math.max(Math.min(ex.reps, 3), Math.round(ex.reps * easy)) : null
    const seconds = ex.seconds ? Math.round(ex.seconds * (easy < 1 ? 0.7 : 1)) : null
    return { ...ex, reps, seconds, range: easy < 1 ? Math.max(0.7, easy) : 1, duration: seconds ?? reps * period(ex.motion) }
  })

  return {
    stage,
    stageInfo: STAGES[stage],
    previous: before,
    moved: before === null ? 0 : stage - before,
    changes,
    held,
    unlockDate: held ? addDays(new Date(injury.date).setHours(0, 0, 0, 0), unlockDay - 1) : null,
    pain,
    easy: easy < 1,
    checkedToday: checks.some((c) => c.day === day),
    exercises,
    suggestedSets: stage === STAGE.protect ? 2 : 3,
    doneToday: plan.sessions?.[day] ?? null,
  }
}

export function dayNumber(injury, now = new Date()) {
  return daysBetween(injury.date, now) + 1 + (injury.dayOffset || 0)
}
