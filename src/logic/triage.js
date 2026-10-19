import rules from '../data/rules.json'

export const BODY_PARTS = [
  { id: 'ankle', label: 'Ankle' },
  { id: 'shoulder', label: 'Shoulder' },
  { id: 'hamstring', label: 'Hamstring', sub: 'Back of the thigh' },
  { id: 'wrist', label: 'Wrist' },
  { id: 'head', label: 'Head', sub: 'Any hit to the head' },
  { id: 'other', label: 'Somewhere else' },
]

const SEVERITY = { plan: 0, see_trainer: 1, see_care_today: 2, emergency: 3 }

export function worstAction(...actions) {
  return actions.filter(Boolean).reduce((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), 'plan')
}

export function redFlagsFor(partId) {
  const injury = rules.injuries[partId]
  const all = [...rules.globalRedFlags, ...(injury ? injury.redFlags : [])]
  // Ask the most urgent questions first so an emergency is never hidden behind a lesser flag.
  return all.sort((a, b) => SEVERITY[b.action] - SEVERITY[a.action])
}

export function isTriggered(flag, answer) {
  return answer === flag.triggerAnswer
}

export function scoreSelfTests(partId, answers) {
  const tests = rules.injuries[partId].selfTests
  const pain = answers.pain ?? 0
  let failed = false
  let difficult = false
  for (const t of tests) {
    const a = answers[t.id]
    if (t.type === 'function') {
      if (a === 'No') failed = true
      if (a === 'With difficulty') difficult = true
    }
    if (t.type === 'choice' && a === 'A lot') difficult = true
  }
  if (pain >= 7 || failed) return 'see_someone'
  if (pain >= 4 || difficult) return 'moderate'
  return 'mild'
}

// Combines body part, every painful spot, and self-test severity into one outcome.
export function buildOutcome({ partId, locationIds = [], severity }) {
  const injury = rules.injuries[partId]
  const locations = injury.locations.filter((l) => locationIds.includes(l.id))
  const override = locations.find((l) => l.effect === 'estimate_override')
  const notes = locations.map((l) => l.note).filter(Boolean)

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
    estimate: { minDays: estimate.minDays, maxDays: estimate.maxDays, label: estimate.label },
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
