// The whole journey: five recovery stages, then endless strength levels that go from a weak animal to a gorilla.
// Once you reach the gorilla you stay there.

export const STAGE_EMOJI = { protect: '🧊', motion: '🚶', strength: '💪', sport: '⚡', return: '🏁' }

export const TIER_DAYS = 3 // strength days per level

export const TIERS = [
  { id: 'mouse', emoji: '🐭', name: 'Mouse', focus: 'Build the habit. Light and steady.' },
  { id: 'rabbit', emoji: '🐇', name: 'Rabbit', focus: 'Springy and quick off the ground.' },
  { id: 'dog', emoji: '🐕', name: 'Dog', focus: 'Steady strength, every day.' },
  { id: 'wolf', emoji: '🐺', name: 'Wolf', focus: 'Longer sets. Stronger landings.' },
  { id: 'cheetah', emoji: '🐆', name: 'Cheetah', focus: 'Explosive push-off.' },
  { id: 'tiger', emoji: '🐅', name: 'Tiger', focus: 'Power with control.' },
  { id: 'bear', emoji: '🐻', name: 'Bear', focus: 'Heavy, solid, hard to knock over.' },
  { id: 'gorilla', emoji: '🦍', name: 'Gorilla', focus: 'Top level. Stay here and keep it up.' },
]

// Recovered once the return date arrives, unless the latest check-in before it still shows real pain.
// After that, check-ins don't undo it. Pain just points you to the "hurt it again" option.
export function isRecovered(plan, day) {
  if (!plan || day < plan.projected) return false
  const last = plan.checkIns?.[plan.checkIns.length - 1]
  if (!last) return true
  return last.day >= plan.projected || (last.answers?.pain ?? 0) < 4
}

export function strengthInfo(plan, day) {
  const days = Math.max(0, day - plan.projected)
  const tier = Math.min(TIERS.length - 1, Math.floor(days / TIER_DAYS))
  const top = tier === TIERS.length - 1
  return {
    days,
    tier,
    top,
    current: TIERS[tier],
    next: top ? null : TIERS[tier + 1],
    daysToNext: top ? 0 : (tier + 1) * TIER_DAYS - days,
    // How far through the current level, 0 to 1 (full at the top).
    progress: top ? 1 : (days - tier * TIER_DAYS) / TIER_DAYS,
  }
}
