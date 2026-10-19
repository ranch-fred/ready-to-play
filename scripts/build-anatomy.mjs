// Builds the 3D body-part models in public/models from BodyParts3D
// (BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution 4.0 International).
//
// Usage: node scripts/build-anatomy.mjs <bodyparts3d-folder> <output-folder>
// The folder needs partof_element_parts.txt, isa_element_parts.txt and the unzipped
// obj/partof_BP3D_4.0_obj_99 and obj/isa_BP3D_4.0_obj_99 meshes.
//
// Everything is built for the RIGHT side; the app mirrors it for the left.
// BodyParts3D axes: x = patient's left (+), y = back (+), z = up, in millimetres.
// Camera directions are in app axes (x, y up, z front).
// BodyParts3D has no models of the commonly sprained ligaments, so those are drawn as bands
// between attachment points found on the real bones (see `landmarks`).

import fs from 'node:fs'
import path from 'node:path'

const [srcDir, outDir] = process.argv.slice(2)
if (!srcDir || !outDir) {
  console.error('Usage: node scripts/build-anatomy.mjs <bodyparts3d-folder> <output-folder>')
  process.exit(1)
}

function readElements(listFile, objFolder) {
  const map = new Map()
  for (const line of fs.readFileSync(path.join(srcDir, listFile), 'utf8').split(/\r?\n/).slice(1)) {
    const [, name, file] = line.split('\t')
    if (!name || !file) continue
    if (!map.has(name)) map.set(name, new Set())
    map.get(name).add(path.join(srcDir, 'obj', objFolder, `${file}.obj`))
  }
  return map
}
const partOf = readElements('partof_element_parts.txt', 'partof_BP3D_4.0_obj_99')
const isA = readElements('isa_element_parts.txt', 'isa_BP3D_4.0_obj_99')

const objCache = new Map()
function readObj(file) {
  if (objCache.has(file)) return objCache.get(file)
  const positions = []
  const faces = []
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('v ')) positions.push(line.trim().split(/\s+/).slice(1, 4).map(Number))
    else if (line.startsWith('f ')) faces.push(line.trim().split(/\s+/).slice(1).map((t) => parseInt(t, 10) - 1))
  }
  const mesh = { positions, faces }
  objCache.set(file, mesh)
  return mesh
}

function meshesFor(test, map = partOf) {
  const files = new Set()
  for (const [name, f] of map) if (typeof test === 'string' ? name === test : test.test(name)) f.forEach((x) => files.add(x))
  return [...files].filter((f) => fs.existsSync(f)).map(readObj)
}
const verts = (name, map) => {
  const list = meshesFor(name, map).flatMap((m) => m.positions)
  if (!list.length) throw new Error(`No mesh for "${name}"`)
  return list
}

// --- small vector helpers (millimetres, BodyParts3D axes) ---
const add = (a, b) => a.map((v, i) => v + b[i])
const sub = (a, b) => a.map((v, i) => v - b[i])
const scl = (a, s) => a.map((v) => v * s)
const mid = (a, b) => scl(add(a, b), 0.5)
const dist = (a, b) => Math.hypot(...sub(a, b))
const centroid = (ps) => scl(ps.reduce(add, [0, 0, 0]), 1 / ps.length)
const extreme = (ps, score) => ps.reduce((best, p) => (score(p) > score(best) ? p : best))
const near = (ps, z, tol) => ps.filter((p) => Math.abs(p[2] - z) < tol)

// Landmarks are computed from the real bones so ligaments and pain spots sit where they belong anatomically.
function landmarks(region) {
  if (region === 'ankle') {
    const fib = verts('right fibula')
    const tib = verts('right tibia')
    const tal = verts('right talus')
    const cal = verts('right calcaneus')
    const nav = verts(/navicular/i).filter((p) => p[0] < 0)
    const lmTip = extreme(fib, (p) => -p[2])
    const lmFront = extreme(fib.filter((p) => p[2] < lmTip[2] + 18), (p) => -p[1])
    const talusTop = extreme(tal, (p) => p[2])
    const talC = centroid(tal)
    const talusNeckLat = extreme(tal.filter((p) => p[2] > talC[2] - 4), (p) => -p[1] - 0.6 * p[0])
    const calC = centroid(cal)
    const cflTarget = add(lmTip, [3, 14, -24])
    const calcLat = extreme(cal.filter((p) => p[0] < calC[0]), (p) => -dist(p, cflTarget))
    const tibC = centroid(tib)
    const mmTip = extreme(tib.filter((p) => p[0] > tibC[0] + 5), (p) => -p[2])
    const talMed = extreme(tal.filter((p) => p[2] < mmTip[2] + 5), (p) => p[0])
    const navMed = extreme(nav, (p) => p[0])
    const sustent = extreme(cal.filter((p) => p[2] > calC[2]), (p) => p[0])
    const h = talusTop[2] + 14
    const tibAntLat = extreme(near(tib, h, 5), (p) => -p[1] - 0.7 * p[0])
    const fibAntMed = extreme(near(fib, h - 6, 6), (p) => -p[1] + 0.7 * p[0])
    const atfl = [lmFront, talusNeckLat]
    const aitfl = [fibAntMed, tibAntLat]
    return {
      ligaments: [
        { name: 'Anterior talofibular ligament', zone: 'outside', a: atfl[0], b: atfl[1], r: 2.6 },
        { name: 'Calcaneofibular ligament', zone: 'outside', a: lmTip, b: calcLat, r: 2.4 },
        { name: 'Deltoid ligament', zone: 'inside', a: mmTip, b: talMed, r: 3 },
        { name: 'Deltoid ligament', zone: 'inside', a: mmTip, b: navMed, r: 2.4 },
        { name: 'Deltoid ligament', zone: 'inside', a: mmTip, b: sustent, r: 2.6 },
        { name: 'Anterior inferior tibiofibular ligament', zone: 'high', a: aitfl[0], b: aitfl[1], r: 2.6 },
      ],
      zones: {
        outside: { at: mid(...atfl), normal: [-1, -0.6, 0] },
        inside: { at: add(mmTip, [0, 0, -8]), normal: [1, -0.1, 0] },
        high: { at: add(mid(...aitfl), [0, 0, 18]), normal: [-0.35, -1, 0] },
      },
    }
  }

  if (region === 'shoulder') {
    const cla = verts('right clavicle')
    const sca = verts('right scapula')
    const hum = verts('right humerus')
    const claLat = extreme(cla, (p) => -p[0])
    const acromion = extreme(sca.filter((p) => dist(p, claLat) < 28 && p[0] < claLat[0]), (p) => p[2])
    const scaC = centroid(sca)
    const coracoid = extreme(sca.filter((p) => p[2] > scaC[2]), (p) => -p[1])
    const claUnder = extreme(cla.filter((p) => Math.abs(p[0] - coracoid[0]) < 14), (p) => -p[2])
    const humTopZ = extreme(hum, (p) => p[2])[2]
    const head = hum.filter((p) => p[2] > humTopZ - 45)
    const greaterTub = extreme(head, (p) => -p[0])
    const headFront = extreme(head, (p) => -p[1])
    return {
      ligaments: [
        { name: 'Acromioclavicular ligament', zone: 'top', a: claLat, b: acromion, r: 3 },
        { name: 'Coracoclavicular ligament', zone: 'top', a: coracoid, b: claUnder, r: 3 },
      ],
      muscles: [
        { name: 'right supraspinatus', zone: 'outer' },
        { name: 'right infraspinatus muscle', zone: 'outer' },
        { name: 'right teres minor', zone: 'outer' },
        { name: 'acromial part of right deltoid', zone: 'outer' },
        { name: 'right subscapularis', zone: 'front' },
        { name: 'clavicular part of right deltoid', zone: 'front' },
      ],
      zones: {
        outer: { at: greaterTub, normal: [-1, 0, 0.15] },
        front: { at: headFront, normal: [-0.2, -1, 0] },
        top: { at: mid(claLat, acromion), normal: [-0.15, 0, 1] },
      },
    }
  }

  if (region === 'hamstring') {
    const hip = verts('right hip bone')
    const fem = verts('right femur')
    const ischialTuberosity = extreme(hip, (p) => -p[2])
    const kneeZ = extreme(fem, (p) => -p[2])[2]
    const hams = verts(/^(long head of right biceps femoris|right semitendinosus|right semimembranosus)$/, isA)
    const midZ = (ischialTuberosity[2] + kneeZ) / 2
    const midBelly = centroid(near(hams, midZ, 25))
    const lowZ = kneeZ + 55
    const behindKnee = centroid(near(hams, lowZ, 15))
    return {
      muscles: [
        { name: 'long head of right biceps femoris', zone: 'middle' },
        { name: 'short head of right biceps femoris', zone: 'lower' },
        { name: 'right semitendinosus', zone: 'middle' },
        { name: 'right semimembranosus', zone: 'middle' },
        { name: 'long head of left biceps femoris' },
        { name: 'short head of left biceps femoris' },
        { name: 'left semitendinosus' },
        { name: 'left semimembranosus' },
      ],
      zones: {
        upper: { at: add(ischialTuberosity, [-28, 0, 18]), normal: [0, 1, -0.2] },
        middle: { at: midBelly, normal: [0, 1, 0] },
        lower: { at: behindKnee, normal: [0, 1, 0] },
      },
    }
  }

  if (region === 'wrist') {
    const rad = verts('right radius')
    const uln = verts('right ulna')
    const scaph = verts('right scaphoid')
    const lun = verts('right lunate')
    const tri = verts('right triquetral')
    const radMinZ = extreme(rad, (p) => -p[2])[2]
    const radialStyloid = extreme(rad.filter((p) => p[2] < radMinZ + 14), (p) => -p[0])
    const ulnarStyloid = extreme(uln, (p) => -p[2])
    const scaphLat = extreme(scaph, (p) => -p[0])
    const scaphToLun = extreme(scaph, (p) => p[1] + 0.6 * p[0])
    const lunToScaph = extreme(lun, (p) => p[1] - 0.6 * p[0])
    const triNear = extreme(tri, (p) => -dist(p, ulnarStyloid))
    const ulnHead = centroid(uln.filter((p) => p[2] < ulnarStyloid[2] + 12))
    const lunMed = extreme(lun, (p) => p[0])
    return {
      ligaments: [
        { name: 'Radial collateral ligament', zone: 'thumb', a: radialStyloid, b: scaphLat, r: 2.2 },
        { name: 'Scapholunate ligament', zone: 'back', a: scaphToLun, b: lunToScaph, r: 2.4 },
        { name: 'Triangular fibrocartilage complex', zone: 'pinky', a: ulnarStyloid, b: triNear, r: 2.6 },
        { name: 'Triangular fibrocartilage complex', zone: 'pinky', a: ulnHead, b: lunMed, r: 2.4 },
      ],
      zones: {
        thumb: { at: mid(radialStyloid, scaphLat), normal: [-1, 0.35, 0] },
        back: { at: mid(scaphToLun, lunToScaph), normal: [0, 1, 0] },
        pinky: { at: mid(ulnarStyloid, triNear), normal: [1, 0.15, 0] },
      },
    }
  }
  throw new Error(region)
}

const REGIONS = {
  ankle: {
    bones: /^right (tibia|fibula|talus|calcaneus|cuboid bone|(medial|intermediate|lateral) cuneiform bone|(first|second|third|fourth|fifth) metatarsal bone)$|navicular|phalanx of right (big|second|third|fourth|little) toe$/,
    box: { min: [-175, -260, -90], max: [10, 90, 230] },
    fades: [{ axis: 'z', full: 120, zero: 225 }],
    zoom: 1.45,
    camera: [-0.9, 0.3, 0.32],
    labels: { outside: 'Outside', high: 'Front', inside: 'Inside' },
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
    labels: { outer: 'Outer side', front: 'Front', top: 'Top' },
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
    labels: { upper: 'Near buttock', middle: 'Middle', lower: 'Behind knee' },
  },
  wrist: {
    bones: /^right (radius|ulna|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|(first|second|third|fourth|fifth) metacarpal bone)$|phalanx of right (thumb|index finger|middle finger|ring finger|little finger)$/,
    box: { min: [-340, -200, 640], max: [-187, 0, 935] },
    fades: [{ axis: 'z', full: 870, zero: 932 }],
    roll: 90,
    zoom: 1.15,
    camera: [0.15, -0.4, -0.9],
    labels: { thumb: 'Thumb side', back: 'Back of wrist', pinky: 'Pinky side' },
  },
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

// Moves a pain spot onto the skin: the outermost skin point near the line through it along the normal.
function snapToSkin(at, normal, skinPositions) {
  const n = normal.map((x) => x / Math.hypot(...normal))
  let best = null
  let bestT = -Infinity
  for (const p of skinPositions) {
    const d = sub(p, at)
    const t = d[0] * n[0] + d[1] * n[1] + d[2] * n[2]
    const perp = Math.hypot(d[0] - t * n[0], d[1] - t * n[1], d[2] - t * n[2])
    if (perp < 10 && t > bestT && t > -5 && t < 90) {
      bestT = t
      best = p
    }
  }
  if (!best) throw new Error(`Could not find skin above ${at.map(Math.round)}`)
  return best
}

const skin = readObj([...partOf.get('skin')][0])
fs.mkdirSync(outDir, { recursive: true })

for (const [name, region] of Object.entries(REGIONS)) {
  const center = region.box.min.map((v, i) => (v + region.box.max[i]) / 2)
  const app = (p) => roll(toApp(p, center), region.roll)
  const appDir = (n) => roll(dirToApp(n), region.roll)
  const lm = landmarks(name)

  const bones = simplify(crop(meshesFor(region.bones), region.box), region.boneCell ?? 1.5)
  const skinPart = simplify(crop([skin], region.box), 0.01)

  const muscles = (lm.muscles ?? []).map((m) => ({
    name: m.name,
    zone: m.zone ?? null,
    mesh: encode(simplify(crop(meshesFor(m.name, isA), region.box), 2), center, region.roll),
  }))
  const ligaments = (lm.ligaments ?? []).map((l) => ({
    name: l.name,
    zone: l.zone,
    a: app(l.a),
    b: app(l.b),
    r: l.r / 100,
  }))

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

  const zones = Object.entries(region.labels).map(([id, label]) => {
    const z = lm.zones[id]
    const onSkin = snapToSkin(z.at, z.normal, skinPart.positions)
    console.log(`  ${name}/${id}: landmark ${z.at.map(Math.round)} -> skin ${onSkin.map(Math.round)} (${dist(z.at, onSkin).toFixed(0)} mm out)`)
    return { id, label, at: app(onSkin), normal: appDir(z.normal) }
  })

  const model = {
    name,
    source: 'BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution 4.0 International',
    camera: region.camera.map((v) => v / Math.hypot(...region.camera)),
    zoom: region.zoom ?? 1,
    fades,
    zones,
    skin: encode(skinPart, center, region.roll),
    bones: encode(bones, center, region.roll),
    muscles,
    ligaments,
  }
  const file = path.join(outDir, `${name}.json`)
  fs.writeFileSync(file, JSON.stringify(model))
  console.log(
    `${name}: skin ${model.skin.triangles} tris, bones ${model.bones.triangles} tris, ${muscles.length} muscles, ${ligaments.length} ligaments, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`,
  )
}
