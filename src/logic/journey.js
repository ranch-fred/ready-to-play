// The whole journey: five recovery stages, then endless strength levels that go from a weak animal to a gorilla.
// Once you reach the gorilla you stay there.

// Egg to chick while you recover, then mouse to gorilla once you're strong: one growing buddy the whole way.
export const STAGE_EMOJI = { protect: '🥚', motion: '🐣', strength: '🐥', sport: '🐤', return: '🐔' }

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

// How far along the recovery is for the buddy's growing: days passing and feeling better both count.
export const HATCH_AT = [0, 0.15, 0.4, 0.65, 0.85]

// Pick the buddy you want in Settings. Every buddy grows through five steps while you recover (the ladder), and once
// you're recovered it is fully grown and wears a badge for your strength level. "Hatchling" is the original:
// an egg that hatches, then turns into a mouse, then bigger and bigger animals up to a gorilla.
// Each ladder step: face = emoji, or svg = a drawn character; grow = how big it is, from 0.6 to 1.1.
const step = (face, grow) => ({ face, grow })
const draw = (svg, grow) => ({ svg, grow })
export const BUDDIES = [
  { id: 'classic', name: 'Hatchling', blurb: 'Hatches, then mouse to gorilla', preview: step('🐣', 1), ladder: [step('🥚', 0.9), step('🐣', 0.85), step('🐥', 0.9), step('🐤', 0.95), step('🐔', 1)] },
  { id: 'ostrich', name: 'Ostrich', blurb: 'Starts as an egg, grows tall', preview: draw('ostrich', 0.85), ladder: [step('🥚', 0.9), draw('ostrich', 0.55), draw('ostrich', 0.7), draw('ostrich', 0.85), draw('ostrich', 1)] },
  { id: 'dog', name: 'Dog', blurb: 'Puppy to big dog', preview: step('🐶', 1), ladder: [step('🐶', 0.6), step('🐶', 0.72), step('🐶', 0.85), step('🐕', 0.95), step('🐕', 1.05)] },
  { id: 'cat', name: 'Cat', blurb: 'Kitten to big cat', preview: step('🐱', 1), ladder: [step('🐱', 0.6), step('🐱', 0.72), step('🐱', 0.85), step('🐈', 0.95), step('🐈', 1.05)] },
  { id: 'penguin', name: 'Penguin', blurb: 'Egg to cool penguin', preview: step('🐧', 1), ladder: [step('🥚', 0.9), step('🐧', 0.6), step('🐧', 0.75), step('🐧', 0.9), step('🐧', 1.05)] },
  { id: 'dino', name: 'Dino', blurb: 'Egg to T. rex', preview: step('🦖', 1), ladder: [step('🥚', 0.9), step('🦎', 0.65), step('🦎', 0.85), step('🦕', 0.95), step('🦖', 1.05)] },
]

// What the buddy looks like right now: its growth step while recovering, fully grown (with a strength badge) after.
export function buddyFace(buddyId, progress, strong) {
  const buddy = BUDDIES.find((b) => b.id === buddyId) ?? BUDDIES[0]
  if (strong) {
    if (buddy.id === 'classic') return { face: strong.current.emoji, grow: 1 }
    const grown = buddy.ladder[buddy.ladder.length - 1]
    return { ...grown, badge: strong.current.emoji }
  }
  let i = 0
  HATCH_AT.forEach((t, k) => {
    if (progress >= t) i = k
  })
  return buddy.ladder[i]
}
