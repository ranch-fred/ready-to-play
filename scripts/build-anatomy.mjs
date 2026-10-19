// Builds the 3D body-part models in public/models from BodyParts3D
// (BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution 4.0 International).
//
// Usage: node scripts/build-anatomy.mjs <bodyparts3d-folder> <output-folder>
// The BodyParts3D folder needs partof_element_parts.txt and the unzipped partof_BP3D_4.0_obj_99 meshes.
// All regions are built for the RIGHT side; the app mirrors them for the left.
// BodyParts3D axes: x = patient's left (+), y = back (+), z = up, in millimeters.
// Zone points and fades use BodyParts3D axes; camera directions use app axes (x, y up, z front).

import fs from 'node:fs'
import path from 'node:path'

const [srcDir, outDir] = process.argv.slice(2)
if (!srcDir || !outDir) {
  console.error('Usage: node scripts/build-anatomy.mjs <bodyparts3d-folder> <output-folder>')
  process.exit(1)
}
const objDir = path.join(srcDir, 'obj', 'partof_BP3D_4.0_obj_99')

const elements = new Map()
for (const line of fs.readFileSync(path.join(srcDir, 'partof_element_parts.txt'), 'utf8').split(/\r?\n/).slice(1)) {
  const [, name, file] = line.split('\t')
  if (!name || !file) continue
  if (!elements.has(name)) elements.set(name, new Set())
  elements.get(name).add(file)
}

const REGIONS = {
  ankle: {
    bones: /^right (tibia|fibula|talus|calcaneus|cuboid bone|(medial|intermediate|lateral) cuneiform bone|(first|second|third|fourth|fifth) metatarsal bone)$|navicular.*right|right.*navicular|phalanx of right (big|second|third|fourth|little) toe$/,
    box: { min: [-175, -260, -90], max: [10, 90, 230] },
    fades: [{ axis: 'z', full: 120, zero: 225 }],
    zoom: 1.45,
    camera: [-0.9, 0.3, 0.32],
    zones: [
      { id: 'outside', label: 'Outside', at: [-118, -62, -8], normal: [-1, 0.15, 0] },
      { id: 'high', label: 'Front', at: [-72, -110, 70], normal: [0, -1, 0.1] },
      { id: 'inside', label: 'Inside', at: [-38, -82, -2], normal: [1, 0.1, 0] },
    ],
  },
  shoulder: {
    bones: /^right (humerus|scapula|clavicle|(first|second|third|fourth|fifth|sixth|seventh) rib)$|^sternum$|^(thoracic|cervical) vertebral column$/,
    box: { min: [-290, -230, 1000], max: [60, 120, 1480] },
    boneCell: 4,
    fades: [
      { axis: 'z', full: 1130, zero: 1010 },
      { axis: 'x', full: -20, zero: 55 },
      { axis: 'z', full: 1400, zero: 1475 },
    ],
    zoom: 1.3,
    camera: [-0.55, 0.12, 0.83],
    zones: [
      { id: 'outer', label: 'Outer side', at: [-240, -75, 1285], normal: [-1, 0, 0.1] },
      { id: 'front', label: 'Front', at: [-190, -120, 1285], normal: [-0.15, -1, 0] },
      { id: 'top', label: 'Top', at: [-150, -80, 1355], normal: [0, 0, 1] },
    ],
  },
  hamstring: {
    bones: /^(right|left) (femur|hip bone)$|^sacrum$/,
    box: { min: [-210, -200, 330], max: [210, 140, 1000] },
    boneCell: 3,
    fades: [
      { axis: 'z', full: 430, zero: 335 },
      { axis: 'z', full: 900, zero: 995 },
    ],
    zoom: 1.25,
    camera: [-0.25, 0.12, -0.97],
    zones: [
      { id: 'upper', label: 'Near buttock', at: [-100, 40, 745], normal: [0, 1, -0.1] },
      { id: 'middle', label: 'Middle', at: [-90, 40, 610], normal: [0, 1, 0] },
      { id: 'lower', label: 'Behind knee', at: [-90, 30, 450], normal: [0, 1, 0] },
    ],
  },
  wrist: {
    bones: /^right (radius|ulna|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|(first|second|third|fourth|fifth) metacarpal bone)$|phalanx of right (thumb|index finger|middle finger|ring finger|little finger)$/,
    box: { min: [-340, -200, 640], max: [-187, 0, 935] },
    fades: [{ axis: 'z', full: 870, zero: 932 }],
    roll: 90,
    zoom: 1.05,
    camera: [0.1, 0.55, 0.83],
    zones: [
      { id: 'thumb', label: 'Thumb side', at: [-276, -110, 812], normal: [-1, -0.1, 0] },
      { id: 'back', label: 'Back of wrist', at: [-245, -60, 828], normal: [0, 1, 0] },
      { id: 'pinky', label: 'Pinky side', at: [-206, -95, 820], normal: [1, 0, 0] },
    ],
  },
}

function readObj(file) {
  const positions = []
  const faces = []
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('v ')) positions.push(line.trim().split(/\s+/).slice(1, 4).map(Number))
    else if (line.startsWith('f ')) faces.push(line.trim().split(/\s+/).slice(1).map((t) => parseInt(t, 10) - 1))
  }
  return { positions, faces }
}

function inBox(p, box) {
  return p.every((v, i) => v >= box.min[i] && v <= box.max[i])
}

// Keeps triangles whose centre is inside the box and re-indexes the vertices they use.
function crop(meshes, box) {
  const out = []
  const idx = []
  for (const { positions, faces } of meshes) {
    const remap = new Map()
    for (const f of faces) {
      for (let k = 1; k + 1 < f.length; k++) {
        const tri = [f[0], f[k], f[k + 1]]
        const c = [0, 1, 2].map((a) => (positions[tri[0]][a] + positions[tri[1]][a] + positions[tri[2]][a]) / 3)
        if (!inBox(c, box)) continue
        for (const v of tri) {
          if (!remap.has(v)) {
            remap.set(v, out.length)
            out.push(positions[v])
          }
          idx.push(remap.get(v))
        }
      }
    }
  }
  return { positions: out, indices: idx }
}

// Vertex clustering: merges every vertex inside the same `cell` mm cube, then drops collapsed triangles.
function simplify({ positions, indices }, cell) {
  const keyOf = (p) => p.map((v) => Math.floor(v / cell)).join(',')
  const clusters = new Map()
  const map = positions.map((p) => {
    const k = keyOf(p)
    let c = clusters.get(k)
    if (!c) {
      c = { sum: [0, 0, 0], n: 0, index: clusters.size }
      clusters.set(k, c)
    }
    c.sum = c.sum.map((s, i) => s + p[i])
    c.n++
    return c.index
  })
  const out = new Array(clusters.size)
  for (const c of clusters.values()) out[c.index] = c.sum.map((s) => s / c.n)
  const seen = new Set()
  const idx = []
  for (let i = 0; i < indices.length; i += 3) {
    const t = [map[indices[i]], map[indices[i + 1]], map[indices[i + 2]]]
    if (t[0] === t[1] || t[1] === t[2] || t[0] === t[2]) continue
    const key = [...t].sort((a, b) => a - b).join(',')
    if (seen.has(key)) continue
    seen.add(key)
    idx.push(...t)
  }
  return { positions: out, indices: idx }
}

// BodyParts3D (x, y-back, z-up) -> app (x, y-up, z-front), centred and in decimetres.
const toApp = (p, c) => [(p[0] - c[0]) / 100, (p[2] - c[2]) / 100, -(p[1] - c[1]) / 100]
const dirToApp = (n) => {
  const v = [n[0], n[2], -n[1]]
  const l = Math.hypot(...v)
  return v.map((x) => x / l)
}

// Optional turn about the app's front-facing axis, e.g. to lay a hanging hand sideways.
const roll = (v, deg = 0) => {
  const r = (deg * Math.PI) / 180
  return [v[0] * Math.cos(r) - v[1] * Math.sin(r), v[0] * Math.sin(r) + v[1] * Math.cos(r), v[2]]
}

// Positions are stored as Int16 scaled by `scale` to halve the file size.
function encode({ positions, indices }, center, deg) {
  const app = positions.map((p) => roll(toApp(p, center), deg))
  const maxAbs = Math.max(...app.flat().map(Math.abs)) || 1
  const scale = maxAbs / 32767
  const pos = new Int16Array(app.length * 3)
  app.forEach((p, i) => pos.set(p.map((v) => Math.round(v / scale)), i * 3))
  const ind = positions.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)
  return {
    vertices: positions.length,
    triangles: indices.length / 3,
    scale,
    position: Buffer.from(pos.buffer).toString('base64'),
    index: Buffer.from(ind.buffer).toString('base64'),
    index32: ind instanceof Uint32Array,
  }
}

// Moves a zone anchor onto the skin: the outermost skin point near the line through it along the normal.
function snapToSkin(at, normal, skinPositions) {
  const n = normal.map((x) => x / Math.hypot(...normal))
  let best = null
  let bestT = -Infinity
  for (const p of skinPositions) {
    const d = p.map((v, i) => v - at[i])
    const t = d[0] * n[0] + d[1] * n[1] + d[2] * n[2]
    const perp = Math.hypot(d[0] - t * n[0], d[1] - t * n[1], d[2] - t * n[2])
    if (perp < 14 && t > bestT && t < 120) {
      bestT = t
      best = p
    }
  }
  return best || at
}

const skinFile = [...elements.get('skin')][0]
const skin = readObj(path.join(objDir, `${skinFile}.obj`))
fs.mkdirSync(outDir, { recursive: true })

for (const [name, region] of Object.entries(REGIONS)) {
  const boneFiles = new Set()
  for (const [n, files] of elements) if (region.bones.test(n)) files.forEach((f) => boneFiles.add(f))
  const bones = simplify(
    crop(
      [...boneFiles].filter((f) => fs.existsSync(path.join(objDir, `${f}.obj`))).map((f) => readObj(path.join(objDir, `${f}.obj`))),
      region.box,
    ),
    region.boneCell ?? 1.5,
  )
  const skinPart = simplify(crop([skin], region.box), region.skinCell ?? 0.01)
  const center = region.box.min.map((v, i) => (v + region.box.max[i]) / 2)

  const axisIndex = { x: 0, y: 1, z: 2 }
  const fades = region.fades.map((f) => {
    const k = axisIndex[f.axis]
    const axis = [0, 0, 0]
    axis[k] = 1
    const a = dirToApp(axis)
    const along = (v) => {
      const p = [...center]
      p[k] = v
      const q = toApp(p, center)
      return q[0] * a[0] + q[1] * a[1] + q[2] * a[2]
    }
    return { axis: roll(a, region.roll), full: along(f.full), zero: along(f.zero) }
  })

  const model = {
    name,
    source: 'BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution 4.0 International',
    camera: region.camera.map((v) => v / Math.hypot(...region.camera)),
    zoom: region.zoom ?? 1,
    fades,
    zones: region.zones.map((z) => ({
      id: z.id,
      label: z.label,
      at: roll(toApp(snapToSkin(z.at, z.normal, skinPart.positions), center), region.roll),
      normal: roll(dirToApp(z.normal), region.roll),
    })),
    skin: encode(skinPart, center, region.roll),
    bones: encode(bones, center, region.roll),
  }
  const file = path.join(outDir, `${name}.json`)
  fs.writeFileSync(file, JSON.stringify(model))
  console.log(`${name}: ${boneFiles.size} bone files, skin ${model.skin.triangles} tris, bones ${model.bones.triangles} tris, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
}
