import recovery from '../data/recovery.json'
import { rules } from './triage'

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
export function startPlan(partId, estimate, selfTestAnswers) {
  const padded = paddedDays(estimate)
  const baseline = selfTestAnswers ? symptomScore(rules.injuries[partId].selfTests, selfTestAnswers) : null
  return { padded, projected: padded, baseline, checkIns: [], worseStreak: 0, lastResult: null }
}

export function checkInQuestions(partId) {
  return recovery.checkIns[partId] || []
}

// Applies one daily check-in. The estimate can only move earlier, never later.
export function applyCheckIn(plan, { partId, day, answers, flagged, minDays }) {
  const score = symptomScore(checkInQuestions(partId), answers)
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
    checkIns: [...plan.checkIns, { day, score, answers }],
    lastResult: result,
  }
}

export { recovery }
