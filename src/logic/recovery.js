import recovery from '../data/recovery.json'

// Symptom score from 0 (no symptoms) to 1 (worst). Works for both the first self-test and daily check-ins:
// pain is 0-10, and every multiple-choice answer is scored by its position (first option = best).
export function symptomScore(questions, answers) {
  let total = 0
  let count = 0
  for (const q of questions) {
    const a = answers?.[q.id]
    if (a === undefined) continue
    if (q.type === 'scale') total += a / 10
    else {
      const i = q.options.indexOf(a)
      if (i < 0) continue
      total += i / (q.options.length - 1)
    }
    count++
  }
  return count ? total / count : 0
}

export function paddedDays(estimate) {
  return Math.ceil(estimate.maxDays * recovery.policy.cushion)
}

// Called once when the plan is saved. The first estimate is the safe end of the range plus the cushion.
// The first daily check-in becomes the baseline that later check-ins are compared to.
export function startPlan(partId, estimate, baseline = null) {
  const padded = paddedDays(estimate)
  return { padded, projected: padded, baseline, checkIns: [], worseStreak: 0, lastResult: null }
}

// How healed the injury looks, 0 to 1. It blends how far through the plan you are with how much better your
// daily check-ins say you feel than on your first one, so it moves when you improve, not just when days pass.
export function healProgress(plan, day) {
  const time = Math.min(1, Math.max(0, (day - 1) / Math.max(1, plan.projected)))
  const last = plan.checkIns[plan.checkIns.length - 1]
  if (!last || !(plan.baseline > 0)) return time
  const symptoms = Math.min(1, Math.max(0, 1 - last.score / plan.baseline))
  // Days passing always count. Feeling better than the calendar says pulls it ahead.
  return Math.min(1, Math.max(time, 0.4 * time + 0.6 * symptoms))
}

// Pain (0-10) from each daily check-in, for the trend line.
export function painSeries(plan) {
  return plan.checkIns.filter((c) => typeof c.answers?.pain === 'number').map((c) => ({ day: c.day, pain: c.answers.pain }))
}

// Every question that can ever be asked for this injury (used to look answers up).
export function allCheckInQuestions(partId) {
  return [...(recovery.checkIns[partId] || []), ...(recovery.performance?.[partId] || [])]
}

// The daily questions depend on how the first self-test went and where you are in recovery:
// - started feeling pretty good (mild): the usual symptom questions plus real performance tests
//   (single-leg calf raises, hops, and so on)
// - started rougher (moderate): the gentler symptom questions
// - fully recovered: pain, plus the performance tests, to track getting stronger
export function checkInQuestions(partId, { severity, recovered } = {}) {
  const base = recovery.checkIns[partId] || []
  const perf = recovery.performance?.[partId] || []
  if (recovered) return [...base.filter((q) => q.id === 'pain'), ...perf]
  return severity === 'mild' ? [...base, ...perf] : base
}

// Applies one daily check-in. The estimate can only move earlier, never later.
export function applyCheckIn(plan, { partId, day, answers, flagged, minDays, severity, recovered: strengthMode }) {
  if (strengthMode) {
    // Once recovered the date doesn't move. We just log how strong you are and watch for pain coming back.
    const result = { day, shrunk: 0, worse: false, action: flagged ? 'see_care_today' : 'plan', overdue: false, painHigh: (answers.pain ?? 0) >= 4, strength: true }
    return { ...plan, checkIns: [...plan.checkIns, { day, score: 0, answers }], lastResult: result }
  }
  const score = symptomScore(checkInQuestions(partId, { severity }), answers)
  const baseline = plan.baseline ?? score
  const previous = plan.checkIns.length ? plan.checkIns[plan.checkIns.length - 1].score : baseline

  const worse = score > previous + recovery.policy.worseBy
  const worseStreak = worse ? plan.worseStreak + 1 : 0

  const recovered = baseline > 0 ? Math.min(1, Math.max(0, 1 - score / baseline)) : 1
  const candidate = Math.max(minDays, day + Math.ceil((1 - recovered) * plan.padded))
  const projected = Math.min(plan.projected, candidate)

  const result = {
    day,
    shrunk: plan.projected - projected,
    worse,
    action: flagged ? 'see_care_today' : worseStreak >= recovery.policy.worseStreakForTrainer ? 'see_trainer' : 'plan',
    overdue: day >= projected && score > 0.1,
    painHigh: (answers.pain ?? 0) >= 7,
  }

  return {
    ...plan,
    baseline,
    projected,
    worseStreak,
    checkIns: [...plan.checkIns, { day, score, answers, projected }],
    lastResult: result,
  }
}

export { recovery }
