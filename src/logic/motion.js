// Exercise motions are loops of keyframes. One loop = one rep.
// A key moves every listed joint to its pose over `move` seconds, then holds for `hold` seconds.
// Poses use degrees: flex, side, twist. `lift` and `slide` move the whole model (in model units).

const CHANNELS = ['flex', 'side', 'twist']

const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  linear: (t) => t,
  out: (t) => 1 - (1 - t) ** 2,
}

export function period(motion) {
  return motion.keys.reduce((s, k) => s + (k.move ?? 0) + (k.hold ?? 0), 0)
}

function lerpPose(a = {}, b = {}, t) {
  const out = {}
  for (const j of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const pa = a[j] ?? {}
    const pb = b[j] ?? {}
    out[j] = {}
    for (const c of CHANNELS) out[j][c] = (pa[c] ?? 0) + ((pb[c] ?? 0) - (pa[c] ?? 0)) * t
  }
  return out
}

const lerp = (a = 0, b = 0, t) => a + (b - a) * t

// Pose at time t (seconds since the motion started). `range` shrinks every angle for gentler days.
// `reverse` plays the loop backwards (circles go the other way).
export function evaluate(motion, t, { range = 1, reverse = false } = {}) {
  const P = period(motion)
  let local = ((t % P) + P) % P
  if (reverse) local = P - local
  const keys = motion.keys
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const prev = keys[(i - 1 + keys.length) % keys.length]
    const span = (k.move ?? 0) + (k.hold ?? 0)
    if (local <= span || i === keys.length - 1) {
      const m = k.move ?? 0
      const raw = m > 0 ? Math.min(1, local / m) : 1
      const f = (ease[k.ease ?? motion.ease ?? 'inOut'] ?? ease.inOut)(raw)
      const joints = lerpPose(prev.pose, k.pose, f)
      for (const j of Object.values(joints)) for (const c of CHANNELS) j[c] *= range
      return {
        joints,
        lift: lerp(prev.lift, k.lift, f),
        slide: lerp(prev.slide, k.slide, f),
        cue: (local > m && k.holdCue) || k.cue || motion.cue || '',
        pen: k.pen !== false,
        holding: local > m && (k.hold ?? 0) > 0,
        holdLeft: Math.max(0, span - local),
      }
    }
    local -= span
  }
}

// Smooth loop through an ellipse of two channels on one joint (ankle circles, pendulum, arm circles).
export function circle({ joint, a = 'flex', b = 'side', ampA, ampB, center = {}, seconds, cue, steps = 36 }) {
  const keys = []
  for (let i = 1; i <= steps; i++) {
    const th = (i / steps) * Math.PI * 2
    keys.push({
      pose: { [joint]: { ...center, [a]: (center[a] ?? 0) + ampA * Math.cos(th), [b]: (center[b] ?? 0) + ampB * Math.sin(th) } },
      move: seconds / steps,
      ease: 'linear',
      cue,
    })
  }
  return { keys }
}

// Strokes for tracing letters with the toes. x = side to side, y = up and down, in a 0..1 box.
const LETTERS = {
  A: [[[0, 0], [0.5, 1], [1, 0]], [[0.22, 0.42], [0.78, 0.42]]],
  B: [[[0, 0], [0, 1], [0.7, 1], [0.85, 0.88], [0.85, 0.62], [0.7, 0.52], [0, 0.52], [0.78, 0.52], [0.95, 0.38], [0.95, 0.14], [0.78, 0], [0, 0]]],
  C: [[[0.95, 0.85], [0.7, 1], [0.3, 1], [0.05, 0.75], [0.05, 0.25], [0.3, 0], [0.7, 0], [0.95, 0.15]]],
}

// Traces letters on one joint: `a` channel goes up/down, `b` channel goes side to side.
export function letters({ joint, word, a = 'flex', b = 'side', ampA, ampB, speed = 0.9 }) {
  const keys = []
  let last = [0.5, 0.5]
  const at = ([x, y]) => ({ [joint]: { [a]: (y - 0.5) * 2 * ampA, [b]: (x - 0.5) * 2 * ampB } })
  for (const ch of word) {
    for (const stroke of LETTERS[ch]) {
      // Pen up: travel to the start of the stroke without drawing.
      keys.push({ pose: at(stroke[0]), move: 0.35 + Math.hypot(stroke[0][0] - last[0], stroke[0][1] - last[1]) * 0.4, pen: false, cue: `Trace the letter ${ch}` })
      for (let i = 1; i < stroke.length; i++) {
        const d = Math.hypot(stroke[i][0] - stroke[i - 1][0], stroke[i][1] - stroke[i - 1][1])
        keys.push({ pose: at(stroke[i]), move: Math.max(0.12, d / speed), ease: 'linear', cue: `Trace the letter ${ch}` })
      }
      last = stroke[stroke.length - 1]
    }
    keys.push({ pose: at(last), move: 0, hold: 0.5, pen: false, cue: `Trace the letter ${ch}` })
  }
  keys.push({ pose: at([0.5, 0.5]), move: 0.6, pen: false, cue: 'Back to the middle' })
  return { keys }
}

// A simple there-and-back move with an optional hold, written as two keys.
export function swing({ from, to, out = 1.4, back = 1.4, hold = 0, rest = 0, cueOut, cueBack, holdCue, liftTo, liftFrom }) {
  return {
    keys: [
      { pose: to, move: out, hold, cue: cueOut, holdCue, lift: liftTo },
      { pose: from, move: back, hold: rest, cue: cueBack, lift: liftFrom },
    ],
  }
}

// Joint transform matching the vertex shader: p' = mix(p, pivot + R (p - pivot) + shift, weight).
export function axisAngle(axis, deg) {
  const r = (deg * Math.PI) / 180
  const [x, y, z] = axis
  const c = Math.cos(r)
  const s = Math.sin(r)
  const t = 1 - c
  // Column-major 3x3, ready for a GLSL mat3 uniform.
  return [t * x * x + c, t * x * y + s * z, t * x * z - s * y, t * x * y - s * z, t * y * y + c, t * y * z + s * x, t * x * z + s * y, t * y * z - s * x, t * z * z + c]
}

export function mul3(a, b) {
  const o = new Array(9)
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2]
  return o
}

export function apply3(m, v) {
  return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]
}

export const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]

export function jointMatrix(axes, pose = {}) {
  let m = IDENTITY
  for (const c of CHANNELS) if (pose[c]) m = mul3(m, axisAngle(axes[c], pose[c]))
  return m
}

// Moves one point through the joint chain, distal joints first (same order as the shader).
export function transformPoint(p, weights, joints) {
  let v = p
  for (let j = joints.length - 1; j >= 0; j--) {
    const w = weights[j] ?? 0
    if (!w) continue
    const { pivot, matrix } = joints[j]
    const d = [v[0] - pivot[0], v[1] - pivot[1], v[2] - pivot[2]]
    const r = apply3(matrix, d)
    v = [v[0] + (pivot[0] + r[0] - v[0]) * w, v[1] + (pivot[1] + r[1] - v[1]) * w, v[2] + (pivot[2] + r[2] - v[2]) * w]
  }
  return v
}
