// Joints for animating the BodyParts3D models (all built for the RIGHT side; the left is a mirror).
// App axes: x = toward the body's left, y = up, z = forward. 1 unit = 10 cm.
//
// Each joint has a pivot, three rotation axes (flex / side / twist) and a weight function that says how
// much each vertex follows the joint (0 = stays still, 1 = moves fully). Weights blend smoothly across the
// joint so the skin bends instead of tearing. Joints are listed root first: later joints ride on earlier ones.
//
// `extensions` add simple glass limb segments where the scanned model was cropped (lower leg, forearm).

const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a) => Math.hypot(a[0], a[1], a[2])
const norm = (a) => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

// Distance along and away from the line from `a` toward `b`.
function alongLine(p, a, b) {
  const dir = norm(sub(b, a))
  const d = sub(p, a)
  const t = dot(d, dir)
  const perp = [d[0] - dir[0] * t, d[1] - dir[1] * t, d[2] - dir[2] * t]
  return { t, r: len(perp), perp }
}

// ---------- Ankle ----------
const ANKLE = [0.06, -0.8, -0.04]
const TOE_JOINT = [-0.2, -1.33, 1.12]

// ---------- Wrist ----------
const WRIST = [-0.12, 0.04, 0.17]
const KNUCKLE = [0.62, 0.05, 0.5]
const FINGER_MID = [0.98, 0.05, 0.66]

// ---------- Shoulder ----------
const HUMERAL_HEAD = [-0.62, 0.72, 0.15]
const ELBOW = [-1.0, -2.0, 0.12]
const ARMPIT_T = 0.8 // distance down the arm below which the arm and torso skin are separate sheets

// ---------- Hip / knee ----------
const HIP = [-1.0, 1.48, 0.7]
const KNEE = [-0.8, -2.7, 0.72]

// Below the armpit the arm's skin touches the torso's, so position alone can't tell them apart. They are
// separate surfaces there, though: flood-fill the mesh from the outside of the arm to find the arm's skin.
function armSheet(pos, index) {
  const n = pos.length / 3
  const adj = Array.from({ length: n }, () => [])
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i]
    const b = index[i + 1]
    const c = index[i + 2]
    adj[a].push(b, c)
    adj[b].push(a, c)
    adj[c].push(a, b)
  }
  const info = new Array(n)
  for (let i = 0; i < n; i++) info[i] = alongLine([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], HUMERAL_HEAD, ELBOW)
  // Grow the arm (1) and the torso (2) at the same time, one ring of neighbours per step, so a vertex where
  // the two sheets touch goes to whichever side reaches it first.
  const allowed = (i) => info[i].t > ARMPIT_T - 0.05
  const label = new Uint8Array(n)
  let frontier = []
  for (let i = 0; i < n; i++) {
    const { t, r, perp } = info[i]
    if (t > 1.7 && r < 0.75 && perp[0] < -0.15) label[i] = 1
    else if (t > ARMPIT_T && r > 1.0) label[i] = 2
    if (label[i]) frontier.push(i)
  }
  while (frontier.length) {
    const next = []
    for (const i of frontier) {
      for (const j of adj[i]) {
        if (!label[j] && allowed(j)) {
          label[j] = label[i]
          next.push(j)
        }
      }
    }
    frontier = next
  }
  const arm = Uint8Array.from(label, (v) => (v === 1 ? 1 : 0))
  return { arm }
}

function armWeight(p, n, kind, i, ctx) {
  const { t, r } = alongLine(p, HUMERAL_HEAD, ELBOW)
  const armLength = len(sub(ELBOW, HUMERAL_HEAD))
  if (kind === 'bones') {
    const head = len(sub(p, HUMERAL_HEAD)) < 0.28 && p[0] < HUMERAL_HEAD[0] + 0.12
    const shaftR = t > armLength - 0.4 ? 0.34 : 0.17
    return head || (t > 0.1 && r < shaftR) ? 1 : 0
  }
  // Around the shoulder cap the skin blends from torso to arm.
  const blend = ss(-0.05, 0.55, t) * ss(-0.42, -0.72, p[0])
  if (kind === 'skin' && ctx?.arm) {
    const k = ss(ARMPIT_T, ARMPIT_T + 0.25, t)
    return ctx.arm[i] ? Math.max(blend, k) : blend * (1 - k)
  }
  return r < 0.7 ? blend : 0
}

function legWeight(p, n, kind) {
  if (p[0] > -0.02) return 0
  const fromHip = len(sub(p, HIP))
  if (kind === 'bones') {
    const head = fromHip < 0.3
    const femur = p[1] < HIP[1] - 0.35 && p[0] < -0.62
    const shaft = p[1] < 0.6 && p[0] < -0.3
    return head || femur || shaft ? 1 : 0
  }
  const side = ss(-0.04, -0.3, p[0])
  const below = ss(HIP[1] + 0.2, HIP[1] - 0.8, p[1])
  return side * below
}

export const RIGS = {
  ankle: {
    joints: [
      {
        name: 'ankle',
        pivot: ANKLE,
        // flex + = toes up (dorsiflexion), side + = sole turns in (inversion), twist + = toes turn in.
        axes: { flex: [-1, 0, 0], side: [0, 0, 1], twist: norm([0, 1, 0.5]) },
        weight: (p, n, kind) => (kind === 'bones' ? ss(ANKLE[1] + 0.05, ANKLE[1] - 0.07, p[1]) : ss(ANKLE[1] + 0.16, ANKLE[1] - 0.14, p[1])),
      },
      {
        name: 'toes',
        pivot: TOE_JOINT,
        // flex + = toes bend up (they stay flat on the floor when you rise onto the ball of your foot).
        axes: { flex: [-1, 0, 0], side: [0, 0, 1], twist: [0, 1, 0] },
        weight: (p, n, kind) => ss(TOE_JOINT[2] - 0.05, TOE_JOINT[2] + (kind === 'bones' ? 0.05 : 0.14), p[2]) * ss(-0.95, -1.1, p[1]),
      },
    ],
    // Points found on the skin when the model loads.
    points: {
      toe: (skin) => maxBy(skin, (p) => p[2]),
      heel: (skin) => maxBy(skin, (p) => -p[2] - (p[1] < -1.25 ? 0 : 9)),
      ball: (skin) => maxBy(skin, (p) => -p[1] - Math.abs(p[2] - 1.05) * 3),
      sole: (skin) => maxBy(skin, (p) => -p[1] - Math.abs(p[2] - 0.35) * 3),
    },
    exerciseFades: null,
  },

  wrist: {
    joints: [
      {
        name: 'forearm',
        pivot: WRIST,
        // twist + = palm turns up (supination for a right hand).
        axes: { flex: [0, -1, 0], side: [0, 0, -1], twist: [-1, 0, 0] },
        weight: (p, n, kind) => (kind === 'bones' ? ss(-1.45, WRIST[0] + 0.05, p[0]) : ss(-1.5, WRIST[0] + 0.05, p[0])),
      },
      {
        name: 'wrist',
        pivot: WRIST,
        // flex + = bend toward the palm, side + = tilt toward the thumb.
        axes: { flex: [0, -1, 0], side: [0, 0, -1], twist: [-1, 0, 0] },
        weight: (p, n, kind) => (kind === 'bones' ? ss(WRIST[0] - 0.03, WRIST[0] + 0.07, p[0]) : ss(WRIST[0] - 0.12, WRIST[0] + 0.14, p[0])),
      },
      {
        name: 'knuckles',
        pivot: KNUCKLE,
        axes: { flex: [0, -1, 0], side: [0, 0, -1], twist: [-1, 0, 0] },
        weight: (p) => ss(KNUCKLE[0] - 0.04, KNUCKLE[0] + 0.1, p[0]) * ss(-0.3, -0.18, p[1]),
      },
      {
        name: 'fingers',
        pivot: FINGER_MID,
        axes: { flex: [0, -1, 0], side: [0, 0, -1], twist: [-1, 0, 0] },
        weight: (p) => ss(FINGER_MID[0] - 0.04, FINGER_MID[0] + 0.08, p[0]) * ss(-0.3, -0.18, p[1]),
      },
    ],
    points: {
      fingertip: (skin) => maxBy(skin, (p) => p[0] - Math.abs(p[1] - 0.05) * 0.6),
      palm: () => [0.25, 0.05, 0.5],
    },
    exerciseFades: null,
  },

  shoulder: {
    joints: [
      {
        name: 'shoulder',
        pivot: HUMERAL_HEAD,
        // flex + = arm forward/up, side + = arm out to the side, twist + = rotate outward.
        axes: { flex: [-1, 0, 0], side: [0, 0, -1], twist: [0, -1, 0] },
        weight: armWeight,
        prepare: (kind, pos, index) => (kind === 'skin' ? armSheet(pos, index) : null),
      },
      {
        name: 'elbow',
        pivot: ELBOW,
        // flex + = bend the elbow (forearm comes forward).
        axes: { flex: [-1, 0, 0], side: [0, 0, -1], twist: [0, -1, 0] },
        // The scan includes a little forearm below the elbow; it bends with the add-on forearm.
        weight: (p, n, kind) => {
          if (kind === 'ext') return 1
          const { t, r } = alongLine(p, HUMERAL_HEAD, ELBOW)
          const below = t - len(sub(ELBOW, HUMERAL_HEAD))
          return r < 0.7 ? ss(-0.08, 0.1, below) : 0
        },
      },
    ],
    extensions: [
      // Forearm and hand, hanging straight down from the elbow. Weights: shoulder 1, elbow 1.
      { from: ELBOW, dir: [0.0, -1, 0.04], length: 2.7, r0: 0.34, r1: 0.24, bone: 0.09, weights: [1, 1], fadeIn: 0.3, fadeOut: [2.0, 2.7] },
    ],
    points: {
      hand: () => ({ p: [ELBOW[0], ELBOW[1] - 2.45, ELBOW[2] + 0.1], weights: [1, 1] }),
      elbow: () => ({ p: ELBOW, weights: [1, 0] }),
    },
    // Show the whole upper arm down to the elbow (the triage view fades it out halfway).
    exerciseFades: (fades) => fades.map((f) => (f.axis[1] === 1 && f.full < 0 ? { ...f, full: -1.95, zero: -2.35 } : f)),
  },

  hamstring: {
    joints: [
      {
        name: 'hip',
        pivot: HIP,
        // flex + = leg swings forward, side + = leg out to the side, twist + = turns out.
        axes: { flex: [-1, 0, 0], side: [0, 0, -1], twist: [0, -1, 0] },
        weight: legWeight,
      },
      {
        name: 'knee',
        pivot: KNEE,
        // flex + = bend the knee (heel toward the buttock).
        axes: { flex: [1, 0, 0], side: [0, 0, -1], twist: [0, -1, 0] },
        weight: (p, n, kind) => (kind === 'ext' ? 1 : p[0] > -0.02 ? 0 : ss(KNEE[1] + 0.12, KNEE[1] - 0.12, p[1])),
      },
    ],
    extensions: [
      // Lower leg below the knee (the scan stops at the knee). Weights: hip 1, knee 1.
      { from: [KNEE[0] + 0.02, KNEE[1] - 0.05, KNEE[2] - 0.12], dir: [0.03, -1, -0.04], length: 4.1, r0: 0.52, r1: 0.3, bone: 0.15, weights: [1, 1], fadeIn: 0.5, fadeOut: [3.0, 4.1] },
    ],
    points: {
      heel: () => ({ p: [KNEE[0] + 0.1, KNEE[1] - 3.7, KNEE[2] - 0.25], weights: [1, 1] }),
      knee: () => ({ p: [KNEE[0], KNEE[1], KNEE[2] + 0.45], weights: [1, 0] }),
    },
    exerciseFades: (fades) => fades.map((f) => (f.full < 0 ? { ...f, full: -2.75, zero: -3.2 } : f)),
  },
}

function maxBy(skin, score) {
  let best = null
  let bestS = -Infinity
  for (let i = 0; i < skin.length; i += 3) {
    const p = [skin[i], skin[i + 1], skin[i + 2]]
    const s = score(p)
    if (s > bestS) {
      bestS = s
      best = p
    }
  }
  return best
}
