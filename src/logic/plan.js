import { rules, addDays, daysBetween } from './triage'
import { allCheckInQuestions } from './recovery'
import { isRecovered, strengthInfo, TIER_DAYS } from './journey'
import { PROGRAM, exercise } from '../data/exercises'

// Today's stage comes from how the athlete answered their latest check-in, not just the calendar.
// Going from "can't put weight on it" to "walking with a limp" moves the plan up right away; a worse day
// moves it back down. Two safety gates keep it from racing ahead of healing time:
// strength work waits until about a quarter of the shortest expected recovery, sport drills until half.

export const STAGES = rules.phaseTemplate
export const ROUNDS = 3
export const WORK_SECONDS = 30
export const BREAK_SECONDS = 5

const STAGE = { protect: 0, motion: 1, strength: 2, sport: 3, return: 4 }

// Option position for an answer: 0 = best, 1 = middle, 2 = worst.
function level(partId, answers, id) {
  const q = allCheckInQuestions(partId).find((x) => x.id === id)
  if (!q || answers?.[id] === undefined) return 0
  return Math.max(0, q.options.indexOf(answers[id]))
}

// What it takes to reach each stage, checked against the latest check-in answers. GOALS[part][n] are the
// goals for stage n (1 = Gentle movement, 2 = Build strength, 3 = Sport drills). The athlete is at the highest
// stage whose goals, and every earlier stage's goals, are all met. The Map shows these as a checklist.
// L(id) is the answer's position: 0 = best, 1 = middle, 2 = worst.
const GOALS = {
  ankle: {
    1: [['Put weight on it', (L) => L('walk') < 2], ['Swelling going down', (L) => L('swelling') < 2], ['Pain below 7', (L, p) => p < 7]],
    2: [['Walk without a limp', (L) => L('walk') === 0], ['Ankle moves partway', (L) => L('rom') < 2], ['Pain below 4', (L, p) => p < 4]],
    3: [['Steady on one foot', (L) => L('balance') === 0], ['Ankle moves all the way', (L) => L('rom') === 0], ['No swelling', (L) => L('swelling') === 0], ['Pain 0-1', (L, p) => p < 2]],
  },
  shoulder: {
    1: [['Everyday things possible', (L) => L('daily') < 2], ['Arm lifts partway', (L) => L('overhead') < 2], ['Sleeping through the night', (L) => L('night') < 2], ['Pain below 7', (L, p) => p < 7]],
    2: [['Arm overhead, no pain', (L) => L('overhead') === 0], ['Can reach behind back', (L) => L('reach_back') < 2], ['Pain below 4', (L, p) => p < 4]],
    3: [['Reach back, no pain', (L) => L('reach_back') === 0], ['Everyday things, no pain', (L) => L('daily') === 0], ['No pain at night', (L) => L('night') === 0], ['Pain 0-1', (L, p) => p < 2]],
  },
  hamstring: {
    1: [['Walking, even with a limp', (L) => L('walk') < 2], ['Can bend the knee', (L) => L('bend_knee') < 2], ['Pain below 7', (L, p) => p < 7]],
    2: [['Walk without a limp', (L) => L('walk') === 0], ['Gentle stretch is OK', (L) => L('stretch') < 2], ['Pain below 4', (L, p) => p < 4]],
    3: [['Ready to jog', (L) => L('jog') === 0], ['Stretch feels easy', (L) => L('stretch') === 0], ['Knee bend, no pain', (L) => L('bend_knee') === 0], ['Pain 0-1', (L, p) => p < 2]],
  },
  wrist: {
    1: [['Wrist bends', (L) => L('bend') < 2], ['Swelling going down', (L) => L('swelling') < 2], ['Pain below 7', (L, p) => p < 7]],
    2: [['Bends without pain', (L) => L('bend') === 0], ['Can grip a bottle', (L) => L('grip') < 2], ['Pain below 4', (L, p) => p < 4]],
    3: [['Grip without pain', (L) => L('grip') === 0], ['Weight on the hand', (L) => L('weight') === 0], ['No swelling', (L) => L('swelling') === 0], ['Pain 0-1', (L, p) => p < 2]],
  },
}

// Goals for one stage, each marked done or not from these answers (null answers = nothing done yet).
export function stageGoals(partId, stage, answers) {
  const list = GOALS[partId]?.[stage] ?? []
  const L = (id) => level(partId, answers, id)
  return list.map(([label, test]) => ({ label, done: !!answers && test(L, answers.pain ?? 0) }))
}

function stageFromAnswers(partId, answers) {
  let s = STAGE.protect
  for (const n of [1, 2, 3]) {
    if (!stageGoals(partId, n, answers).every((g) => g.done)) break
    s = n
  }
  return s
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
  // Past the projected return day with sport-level answers: time for a doctor to clear them.
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
  calf: 'Calf raises',
  hop: 'Hopping',
  plank: 'Push-up hold',
  curl: 'Wrist curls',
  pushup: 'Wall push-ups',
  lift: 'Side raises',
  bridge: 'Glute bridges',
  knees: 'High knees',
}

// The answers that changed the most between two check-ins, in words (biggest first, at most two).
// Function (walking, grip...) counts more than the pain number.
function biggestChanges(partId, before, after) {
  if (!before || !after) return []
  const out = []
  for (const q of allCheckInQuestions(partId)) {
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

  // Fully recovered: the daily plan turns into strength training, and it gets bigger as the animal level goes up.
  if (isRecovered(plan, day)) {
    const info = strengthInfo(plan, day)
    const rounds = ROUNDS + (info.tier >= 3 ? 1 : 0) + (info.tier >= 6 ? 1 : 0)
    return {
      stage: 5,
      stageInfo: { id: 'strong', name: `${info.current.emoji} ${info.current.name} strength`, blurb: info.current.focus },
      strong: info,
      previous: null,
      moved: 0,
      changes: [],
      held: false,
      unlockDate: null,
      pain: last?.answers.pain,
      easy: false,
      checkedToday: checks.some((c) => c.day === day),
      exercises: PROGRAM[partId].strong.map((id) => ({ ...exercise(id), range: 1, duration: WORK_SECONDS })),
      rounds,
      lastAnswers: last?.answers ?? null,
      doneToday: plan.sessions?.[day] ?? null,
    }
  }

  const raw = last ? stageFromAnswers(partId, last.answers) : startingStage(outcome)
  const { stage, held, unlockDay } = gate(raw, day, outcome.estimate, plan.projected)
  const before = prev ? gate(stageFromAnswers(partId, prev.answers), last.day, outcome.estimate, plan.projected).stage : last ? gate(startingStage(outcome), last.day, outcome.estimate, plan.projected).stage : null
  const changes = last ? biggestChanges(partId, prev?.answers, last.answers) : []

  // Every exercise: 3 rounds of 30 seconds. On painful days the moves are smaller.
  const pain = last?.answers.pain
  const easy = pain >= 6 ? 0.65 : pain >= 4 ? 0.8 : 1
  const exercises = PROGRAM[partId][STAGES[stage].id].map((id) => ({ ...exercise(id), range: easy, duration: WORK_SECONDS }))

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
    rounds: ROUNDS,
    lastAnswers: last?.answers ?? null,
    doneToday: plan.sessions?.[day] ?? null,
  }
}

export { TIER_DAYS }

export function dayNumber(injury, now = new Date()) {
  return daysBetween(injury.date, now) + 1 + (injury.dayOffset || 0)
}
