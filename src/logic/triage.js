import rules from '../data/rules.json'
import questions from '../data/questions.json'

export const BODY_PARTS = [
  { id: 'ankle', label: 'Ankle' },
  { id: 'shoulder', label: 'Shoulder' },
  { id: 'hamstring', label: 'Hamstring', sub: 'Back of the thigh' },
  { id: 'wrist', label: 'Wrist' },
  { id: 'other', label: 'Somewhere else' },
]

const SEVERITY = { plan: 0, see_trainer: 1, see_care_today: 2, emergency: 3 }

export function worstAction(...actions) {
  return actions.filter(Boolean).reduce((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), 'plan')
}

// Only the head-injury check is asked before the injury questions.
// Everything else is asked by tailoredQuestions, specific to the injury and the spot that hurts.
export function redFlagsFor() {
  return [...rules.globalRedFlags].sort((a, b) => SEVERITY[b.action] - SEVERITY[a.action])
}

// Pain first, then questions for the whole injury, then questions for each spot that hurts.
export function tailoredQuestions(partId, locationIds = []) {
  const set = questions[partId]
  if (!set) return []
  const seen = new Set()
  return [questions.painQuestion, ...set.all, ...locationIds.flatMap((id) => set[id] || [])].filter((q) => {
    if (seen.has(q.id)) return false
    seen.add(q.id)
    return true
  })
}

function pickOption(q, answer) {
  if (q.type === 'scale') {
    if (q.stopAt !== undefined && answer >= q.stopAt) return { stop: q.stop }
    const tier = q.points.find((t) => answer >= t.atLeast)
    return { points: tier ? tier.points : 0 }
  }
  return q.options.find((o) => o.label === answer) || {}
}

// Returns the stop (send to care) for one answer, or null to keep going.
export function stopFor(q, answer) {
  return pickOption(q, answer).stop || null
}

// Turns all the answers into a severity plus what tailors the plan: extra days, notes, and focus items.
export function scoreAnswers(qs, answers) {
  let points = 0
  let max = 0
  let addDays = 0
  const notes = []
  const focus = []
  for (const q of qs) {
    max += q.type === 'scale' ? q.maxPoints : Math.max(...q.options.map((o) => o.points ?? 0))
    if (answers[q.id] === undefined) continue
    const o = pickOption(q, answers[q.id])
    points += o.points ?? 0
    addDays += o.addDays ?? 0
    if (o.note) notes.push(o.note)
    if (o.focus) focus.push(o.focus)
  }
  const ratio = max ? points / max : 0
  const severity = ratio >= 0.75 ? 'see_someone' : ratio >= 0.3 ? 'moderate' : 'mild'
  return { severity, ratio, addDays, notes, focus }
}

export function isTriggered(flag, answer) {
  return answer === flag.triggerAnswer
}

// Combines body part, every painful spot, and self-test severity into one outcome.
export function buildOutcome({ partId, locationIds = [], severity, addDays = 0, notes: extraNotes = [], focus = [] }) {
  const injury = rules.injuries[partId]
  const locations = injury.locations.filter((l) => locationIds.includes(l.id))
  const override = locations.find((l) => l.effect === 'estimate_override')
  const notes = [...locations.map((l) => l.note).filter(Boolean), ...extraNotes]

  if (severity === 'see_someone') {
    const est = injury.estimates.see_someone
    if (est.note) notes.push(est.note)
    return { action: 'see_care_today', severity, notes }
  }

  const estimate = override ? override.estimates[severity] : injury.estimates[severity]

  if (estimate.action) {
    if (estimate.note) notes.push(estimate.note)
    return { action: estimate.action, severity, notes }
  }

  return {
    action: 'plan',
    severity,
    notes,
    estimate: { minDays: estimate.minDays + addDays, maxDays: estimate.maxDays + addDays, label: estimate.label },
    focus,
    confirmWithTrainer: locations.some((l) => l.alsoAction === 'see_trainer'),
  }
}

export function currentPhase(partId, dayNumber, totalDays) {
  const template = rules.phaseTemplate
  let start = 0
  for (let i = 0; i < template.length; i++) {
    const p = template[i]
    const end = start + Math.round(p.shareOfTimeline * totalDays)
    if (dayNumber <= end || i === template.length - 1) {
      return { ...p, index: i, count: template.length, steps: rules.injuries[partId].phases[p.id] || [] }
    }
    start = end
  }
}

// Day ranges for every phase, matching how currentPhase splits the timeline.
export function phaseRanges(partId, totalDays) {
  let start = 0
  return rules.phaseTemplate.map((p, i, all) => {
    const last = i === all.length - 1
    const end = last ? totalDays : Math.min(totalDays, start + Math.round(p.shareOfTimeline * totalDays))
    const range = { ...p, index: i, startDay: last ? totalDays : start + 1, endDay: end, steps: rules.injuries[partId].phases[p.id] || [] }
    start = end
    return range
  })
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function daysBetween(a, b) {
  const ms = new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)
  return Math.round(ms / 86400000)
}

export { rules }
