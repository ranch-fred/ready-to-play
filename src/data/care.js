// Where to go and what to buy, picked from the injury, how bad it is, and today's stage.

// stage: 0 protect, 1 motion, 2 strength, 3 sport, 4 return (5 = fully recovered and getting stronger)
const early = (c) => c.stage <= 1
// `tool: true` marks workout tools that build strength. The rest protect and calm things down.
const PRODUCTS = {
  ankle: [
    { name: 'Crutches', why: "Until you can walk without limping.", search: 'adjustable crutches', show: (c) => c.cantWalk },
    { name: 'Reusable ice pack', why: 'Ice 20 minutes to calm swelling.', search: 'reusable ice pack ankle wrap', show: early },
    { name: 'Compression ankle sleeve', why: 'Keeps swelling down.', search: 'ankle compression sleeve', show: (c) => c.stage <= 2 },
    { name: 'Lace-up ankle brace', why: 'Support for walking and sports.', search: 'lace up ankle brace', show: (c) => c.severity === 'moderate' || c.stage >= 3 },
    { name: 'Resistance bands', why: 'For your band exercises.', search: 'resistance bands set', show: (c) => c.stage >= 1, tool: true },
    { name: 'Balance pad', why: 'Makes balance training harder.', search: 'foam balance pad', show: (c) => c.stage >= 2, tool: true },
    { name: 'Calf raise slant board', why: 'Deeper calf raises, more strength.', search: 'slant board calf stretcher', show: (c) => c.stage >= 2, tool: true },
    { name: 'Ankle weights', why: 'Adds load to every single-leg move.', search: 'adjustable ankle weights', show: (c) => c.stage >= 3, tool: true },
    { name: 'Jump rope', why: 'Teaches quick, springy landings.', search: 'speed jump rope', show: (c) => c.stage >= 3, tool: true },
    { name: 'Agility ladder', why: 'Fast feet and cutting drills.', search: 'agility ladder speed training', show: (c) => c.stage >= 4, tool: true },
    { name: 'Plyo box', why: 'Box jumps for power.', search: 'plyo box jump', show: (c) => c.stage >= 5, tool: true },
  ],
  wrist: [
    { name: 'Wrist brace', why: 'Rests the wrist while it heals.', search: 'wrist brace splint', show: (c) => c.stage <= 1 || c.severity === 'moderate' },
    { name: 'Reusable ice pack', why: 'Ice 20 minutes to calm swelling.', search: 'reusable ice pack wrist wrap', show: early },
    { name: 'Therapy putty', why: 'Gentle grip and finger strength.', search: 'therapy putty hand exercise', show: (c) => c.stage >= 1, tool: true },
    { name: 'Grip strengthener', why: 'For your grip exercises.', search: 'hand grip strengthener ball', show: (c) => c.stage >= 1, tool: true },
    { name: 'Light dumbbells (1-3 lb)', why: 'For wrist curls.', search: '2 lb dumbbells pair', show: (c) => c.stage === 2, tool: true },
    { name: 'Wrist roller', why: 'Builds forearm and wrist strength.', search: 'wrist roller forearm trainer', show: (c) => c.stage >= 3, tool: true },
    { name: 'Dumbbells (5-10 lb)', why: 'Heavier curls as you get stronger.', search: '8 lb dumbbells pair', show: (c) => c.stage >= 4, tool: true },
    { name: 'Athletic tape', why: 'Support when you play again.', search: 'athletic tape wrist', show: (c) => c.stage >= 3 },
  ],
  shoulder: [
    { name: 'Arm sling', why: 'Rests the shoulder for the first days.', search: 'arm sling shoulder', show: (c) => c.stage === 0 },
    { name: 'Shoulder ice wrap', why: 'Ice 20 minutes after exercises.', search: 'shoulder ice pack wrap', show: (c) => c.stage <= 2 },
    { name: 'Heating pad', why: 'Loosens it up before exercises.', search: 'heating pad shoulder', show: (c) => c.stage >= 1 },
    { name: 'Resistance bands', why: 'For your band exercises.', search: 'resistance bands set', show: (c) => c.stage >= 2, tool: true },
    { name: 'Light dumbbells (2-5 lb)', why: 'For side raises.', search: '3 lb dumbbells pair', show: (c) => c.stage === 2, tool: true },
    { name: 'Dumbbells (5-15 lb)', why: 'Heavier raises and rows.', search: '10 lb dumbbells pair', show: (c) => c.stage >= 3, tool: true },
    { name: 'Suspension trainer', why: 'Rows and push-ups that build the shoulder.', search: 'suspension trainer straps', show: (c) => c.stage >= 4, tool: true },
    { name: 'Medicine ball', why: 'Throwing power for sport.', search: 'medicine ball 6 lb', show: (c) => c.stage >= 4, tool: true },
  ],
  hamstring: [
    { name: 'Crutches', why: 'Until you can walk without limping.', search: 'adjustable crutches', show: (c) => c.cantWalk },
    { name: 'Reusable ice pack', why: 'Ice 20 minutes to calm it down.', search: 'reusable ice pack thigh wrap', show: early },
    { name: 'Compression thigh sleeve', why: 'Supports the muscle and limits swelling.', search: 'thigh compression sleeve hamstring', show: (c) => c.stage <= 2 },
    { name: 'Stretching strap', why: 'For your lying stretch.', search: 'stretching strap', show: (c) => c.stage === 1 || c.stage === 2, tool: true },
    { name: 'Resistance bands', why: 'Band curls and bridges.', search: 'resistance bands set loop', show: (c) => c.stage >= 2, tool: true },
    { name: 'Foam roller', why: 'Loosens the muscle before running.', search: 'foam roller', show: (c) => c.stage >= 2, tool: true },
    { name: 'Stability ball', why: 'Hamstring curls that build strength.', search: 'stability ball 65cm', show: (c) => c.stage >= 3, tool: true },
    { name: 'Sliders', why: 'Sliding curls for hard hamstring work.', search: 'core sliders gliding discs', show: (c) => c.stage >= 4, tool: true },
    { name: 'Kettlebell', why: 'Swings and deadlifts for power.', search: 'kettlebell 15 lb', show: (c) => c.stage >= 5, tool: true },
  ],
}

// stage 0-4 while recovering, 5 once fully recovered and strengthening.
export function productsFor({ partId, severity, stage, cantWalk }) {
  const ctx = { severity, stage: stage ?? 0, cantWalk }
  const list = (PRODUCTS[partId] ?? []).filter((p) => p.show(ctx))
  const tools = list.filter((p) => p.tool)
  const gear = list.filter((p) => !p.tool)
  return (ctx.stage >= 2 ? [...tools, ...gear] : [...gear, ...tools]).slice(0, 6)
}

export const shopLink = (search) => `https://www.amazon.com/s?k=${encodeURIComponent(search)}`

export function mapLink(search, town) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${search} near ${town || 'me'}`)}`
}

const PLACES = {
  urgent: { name: 'Urgent care', search: 'urgent care', when: 'Go today', tone: 'alert', why: 'Get it checked today. They can X-ray it.' },
  ortho: { name: 'Orthopedic walk-in', search: 'orthopedic urgent care', when: 'See someone soon', tone: 'caution', why: 'Bone and joint experts. Walk in, no appointment.' },
  sports: { name: 'Sports medicine doctor', search: 'sports medicine doctor', when: 'See someone soon', tone: 'caution', why: 'Checks that it heals right and you return safely.' },
  regular: { name: 'Your regular doctor', search: 'primary care doctor', when: 'Only if not improving', tone: 'good', why: "Only if it's not getting better in a week." },
}

// One place, chosen from the injury and how it's going.
export function pickPlace({ partId, outcome, lastResult }) {
  const action = lastResult && lastResult.action !== 'plan' ? lastResult.action : outcome?.action
  if (action === 'see_care_today') return PLACES.urgent
  const bone = partId === 'ankle' || partId === 'wrist'
  if (action === 'see_trainer' || lastResult?.overdue) return bone ? PLACES.ortho : PLACES.sports
  if (outcome?.severity === 'moderate') return bone ? PLACES.ortho : PLACES.sports
  return PLACES.regular
}
