import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { decode, decodePositions, loadModel, radialTexture } from './anatomy'
import { RIGS } from '../logic/rigs'
import { evaluate, jointMatrix, transformPoint, period, IDENTITY } from '../logic/motion'

// The same glass anatomy model as the injury check, rigged at its joints and animated to demonstrate
// an exercise. The part that moves glows green, the rest dims, and the moving tip leaves a trail.

const MAX_JOINTS = 4

const vertexShader = `
  attribute vec4 aW;
  uniform vec3 uPivot[${MAX_JOINTS}];
  uniform mat3 uRot[${MAX_JOINTS}];
  uniform vec4 uActive;
  uniform vec3 uOffset;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vLocal;
  varying float vMove;
  void main() {
    vLocal = position;
    vec3 p = position;
    vec3 n = normal;
    for (int j = ${MAX_JOINTS - 1}; j >= 0; j--) {
      float w = aW[j];
      if (w <= 0.0) continue;
      vec3 q = uPivot[j] + uRot[j] * (p - uPivot[j]);
      p = mix(p, q, w);
      n = normalize(mix(n, uRot[j] * n, w));
    }
    p += uOffset;
    vMove = clamp(dot(aW, uActive), 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * n);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = `
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uHotAmt;
  uniform float uDim;
  uniform float uPower;
  uniform float uBase;
  uniform float uOpacity;
  uniform float uLit;
  uniform vec3 uFadeAxis[3];
  uniform vec2 uFadeRange[3];
  uniform int uFadeCount;
  uniform float uDebug;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vLocal;
  varying float vMove;
  void main() {
    vec3 n = normalize(vN);
    float f = pow(1.0 - abs(dot(n, normalize(vV))), uPower);
    float fade = 1.0;
    for (int i = 0; i < 3; i++) {
      if (i >= uFadeCount) break;
      float s = dot(vLocal, uFadeAxis[i]);
      float t = clamp((s - uFadeRange[i].x) / (uFadeRange[i].y - uFadeRange[i].x), 0.0, 1.0);
      fade *= 1.0 - t * t * (3.0 - 2.0 * t);
    }
    float light = mix(1.0, 0.55 + 0.6 * max(dot(n, normalize(vec3(0.3, 0.6, 0.8))), 0.0), uLit);
    vec3 color = mix(uColor, uHot, vMove * uHotAmt);
    if (uDebug > 0.5) color = mix(vec3(0.25, 0.4, 1.0), vec3(1.0, 0.2, 0.2), vMove);
    float a = clamp((uBase + f) * uOpacity * fade * mix(uDim, 1.0, vMove), 0.0, 1.0);
    gl_FragColor = vec4(color * (0.5 + 0.9 * f) * light, a);
  }
`

const HOT = new THREE.Color('#2ee67a')

function glassMaterial(color, { power, base, opacity, lit = 0, hot = 0.75 }, fades, debug) {
  const axes = [0, 1, 2].map((i) => new THREE.Vector3(...(fades[i]?.axis ?? [0, 1, 0])))
  const ranges = [0, 1, 2].map((i) => new THREE.Vector2(fades[i]?.full ?? 0, fades[i]?.zero ?? 1))
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uHot: { value: HOT },
      uHotAmt: { value: hot },
      uDim: { value: 0.5 },
      uPower: { value: power },
      uBase: { value: base },
      uOpacity: { value: opacity },
      uLit: { value: lit },
      uFadeAxis: { value: axes },
      uFadeRange: { value: ranges },
      uFadeCount: { value: Math.min(fades.length, 3) },
      uPivot: { value: Array.from({ length: MAX_JOINTS }, () => new THREE.Vector3()) },
      uRot: { value: Array.from({ length: MAX_JOINTS }, () => new THREE.Matrix3()) },
      uActive: { value: new THREE.Vector4() },
      uOffset: { value: new THREE.Vector3() },
      uDebug: { value: debug ? 1 : 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

function addWeights(geometry, rig, kind, fixed) {
  const pos = geometry.getAttribute('position').array
  const nor = geometry.getAttribute('normal')?.array
  const n = pos.length / 3
  const w = new Float32Array(n * 4)
  const ctx = fixed ? [] : rig.joints.map((j) => j.prepare?.(kind, pos, geometry.index?.array) ?? null)
  for (let i = 0; i < n; i++) {
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]
    const nn = nor ? [nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]] : null
    rig.joints.forEach((j, k) => {
      w[i * 4 + k] = fixed ? fixed[k] ?? 0 : j.weight(p, nn, kind, i, ctx[k])
    })
  }
  geometry.setAttribute('aW', new THREE.BufferAttribute(w, 4))
  // Drop triangles that join a fully moving vertex to a fully still one: where two surfaces touch (arm against
  // the side of the chest) they would stretch into slivers when the limb moves.
  if (!fixed && geometry.index) {
    const idx = geometry.index.array
    const keep = []
    for (let t = 0; t < idx.length; t += 3) {
      let torn = false
      for (let k = 0; k < 4 && !torn; k++) {
        const a = w[idx[t] * 4 + k]
        const b = w[idx[t + 1] * 4 + k]
        const c = w[idx[t + 2] * 4 + k]
        torn = Math.max(a, b, c) - Math.min(a, b, c) > 0.75
      }
      if (!torn) keep.push(idx[t], idx[t + 1], idx[t + 2])
    }
    geometry.setIndex(keep)
  }
}

// A tapered glass tube for parts the scan doesn't include, built straight in model space.
function limbGeometry({ from, dir, length, r0, r1 }, radiusScale = 1) {
  const g = new THREE.CylinderGeometry(r1 * radiusScale, r0 * radiusScale, length, 24, 12, true)
  g.translate(0, -length / 2, 0)
  // Round the top so it blends into the scanned limb.
  const cap = new THREE.SphereGeometry(r0 * radiusScale, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)
  const end = new THREE.SphereGeometry(r1 * radiusScale, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
  end.translate(0, -length, 0)
  const merged = mergeGeometries([g, cap, end])
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(...dir).normalize())
  merged.applyQuaternion(q)
  merged.translate(...from)
  merged.computeVertexNormals()
  return merged
}

function mergeGeometries(list) {
  const positions = []
  const indices = []
  let offset = 0
  for (const g of list) {
    const ng = g.index ? g : g.toNonIndexed()
    const p = ng.getAttribute('position').array
    positions.push(...p)
    if (ng.index) for (const i of ng.index.array) indices.push(i + offset)
    offset += p.length / 3
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  out.setIndex(indices)
  return out
}

const TRAIL = 140

export default function ExerciseModel3D({ region, side = 'right', exercise, clock, range = 1, reverse = false, debug = false, onError, onCue }) {
  const wrapRef = useRef(null)
  const live = useRef({ exercise, clock, range, reverse, onCue, onError })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    live.current = { exercise, clock, range, reverse, onCue, onError }
  }, [exercise, clock, range, reverse, onCue, onError])

  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    loadModel(region)
      .then((model) => {
        if (disposed) return
        cleanup = mount(model)
        setReady(true)
      })
      .catch(() => live.current.onError?.())

    function mount(model) {
      const rig = RIGS[region]
      const wrap = wrapRef.current
      let renderer
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      } catch {
        live.current.onError?.()
        return () => {}
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.domElement.className = 'ex-canvas'
      wrap.prepend(renderer.domElement)

      const sx = side === 'left' ? -1 : 1
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200)
      const fades = rig.exerciseFades ? rig.exerciseFades(model.fades) : model.fades
      const materials = []
      const mat = (...args) => {
        const m = glassMaterial(...args, debug)
        materials.push(m)
        return m
      }

      const body = new THREE.Group()
      const skinGeo = decode(model.skin)
      addWeights(skinGeo, rig, 'skin')
      const boneGeo = decode(model.bones)
      addWeights(boneGeo, rig, 'bones')
      body.add(new THREE.Mesh(skinGeo, mat('#3d8bff', { power: 2.4, base: 0.02, opacity: 0.95, hot: 0.55 }, fades)))
      body.add(new THREE.Mesh(boneGeo, mat('#d6ecff', { power: 1.3, base: 0.16, opacity: 0.75, lit: 1, hot: 0.35 }, fades)))
      for (const m of model.muscles ?? []) {
        const g = decode(m.mesh)
        addWeights(g, rig, 'muscle')
        body.add(new THREE.Mesh(g, mat('#ff8a3d', { power: 1.4, base: 0.18, opacity: 0.45, lit: 1, hot: 0.2 }, fades)))
      }
      for (const l of model.ligaments ?? []) {
        const a = new THREE.Vector3(...l.a)
        const b = new THREE.Vector3(...l.b)
        const dir = b.clone().sub(a)
        const g = new THREE.CapsuleGeometry(l.r, Math.max(dir.length() - l.r * 2, 0.001), 4, 12)
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()))
        g.translate(...a.clone().add(b).multiplyScalar(0.5).toArray())
        addWeights(g, rig, 'ligament')
        body.add(new THREE.Mesh(g, mat('#ffc061', { power: 1.2, base: 0.4, opacity: 0.6, lit: 1, hot: 0.2 }, fades)))
      }
      for (const ext of rig.extensions ?? []) {
        const dir = new THREE.Vector3(...ext.dir).normalize().toArray()
        const along = dir
        const start = ext.from
        // Fade the tube in where it overlaps the scan and out toward its end.
        const s0 = along[0] * start[0] + along[1] * start[1] + along[2] * start[2]
        const extFades = [
          { axis: along.map((v) => -v), full: -(s0 + ext.fadeIn), zero: -s0 },
          { axis: along, full: s0 + ext.fadeOut[0], zero: s0 + ext.fadeOut[1] },
        ]
        const skin = limbGeometry({ ...ext, dir })
        addWeights(skin, rig, 'ext', ext.weights)
        body.add(new THREE.Mesh(skin, mat('#3d8bff', { power: 2.4, base: 0.02, opacity: 0.95, hot: 0.55 }, extFades)))
        const bone = limbGeometry({ ...ext, dir, r0: ext.bone, r1: ext.bone * 0.8 })
        addWeights(bone, rig, 'ext', ext.weights)
        body.add(new THREE.Mesh(bone, mat('#d6ecff', { power: 1.3, base: 0.16, opacity: 0.75, lit: 1, hot: 0.35 }, extFades)))
      }
      body.scale.x = sx
      scene.add(body)

      // Named points (toe, fingertip, hand...) with their joint weights, for the trail and anchors.
      const skinPos = decodePositions(model.skin)
      const points = {}
      for (const [name, find] of Object.entries(rig.points ?? {})) {
        const found = find(skinPos)
        const p = found.p ?? found
        const weights = found.weights ?? rig.joints.map((j) => j.weight(p, null, 'skin'))
        points[name] = { p, weights }
      }

      // Trail of glowing dots behind the moving tip.
      const trailPos = new Float32Array(TRAIL * 3)
      const trailCol = new Float32Array(TRAIL * 3)
      const trailGeo = new THREE.BufferGeometry()
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3))
      trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3))
      const dotTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']])
      skinGeo.computeBoundingSphere()
      const radius = skinGeo.boundingSphere.radius
      const trailMat = new THREE.PointsMaterial({ size: radius * 0.06, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })
      const trail = new THREE.Points(trailGeo, trailMat)
      trail.frustumCulled = false
      body.add(trail)
      const history = []

      // Tip marker: a bright dot riding on the moving tip.
      const tipMat = new THREE.SpriteMaterial({ map: dotTex, color: HOT, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
      const tip = new THREE.Sprite(tipMat)
      tip.scale.setScalar(radius * 0.14)
      body.add(tip)

      // Band line from the tip to an anchor point (resistance-band exercises).
      const bandGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
      const band = new THREE.Line(bandGeo, new THREE.LineBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.9 }))
      band.frustumCulled = false
      body.add(band)

      // Glowing floor for standing and lying exercises, so lifting off it reads clearly.
      const floorTex = (() => {
        const c = document.createElement('canvas')
        c.width = c.height = 256
        const g = c.getContext('2d')
        const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
        grad.addColorStop(0, 'rgba(46,230,122,0.55)')
        grad.addColorStop(0.55, 'rgba(46,230,122,0.18)')
        grad.addColorStop(1, 'rgba(46,230,122,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, 256, 256)
        g.globalCompositeOperation = 'destination-in'
        g.fillStyle = '#000'
        for (let i = 0; i <= 256; i += 16) {
          g.fillRect(i, 0, 1.5, 256)
          g.fillRect(0, i, 256, 1.5)
        }
        g.globalCompositeOperation = 'source-over'
        const ring = g.createRadialGradient(128, 128, 0, 128, 128, 60)
        ring.addColorStop(0, 'rgba(46,230,122,0.35)')
        ring.addColorStop(1, 'rgba(46,230,122,0)')
        g.fillStyle = ring
        g.fillRect(0, 0, 256, 256)
        const tex = new THREE.CanvasTexture(c)
        tex.colorSpace = THREE.SRGBColorSpace
        return tex
      })()
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      )
      floor.rotation.x = -Math.PI / 2
      floor.visible = false
      scene.add(floor)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enablePan = false
      controls.enableZoom = false
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.rotateSpeed = 0.8

      // Frame the camera around every pose the exercise passes through, not just the resting pose.
      const sampleIdx = []
      for (let i = 0; i < skinPos.length / 3; i += 23) sampleIdx.push(i)
      const skinW = skinGeo.getAttribute('aW').array
      const fadeOf = (p) => {
        let f = 1
        for (const fd of fades) {
          const s = p[0] * fd.axis[0] + p[1] * fd.axis[1] + p[2] * fd.axis[2]
          const t = Math.min(1, Math.max(0, (s - fd.full) / (fd.zero - fd.full)))
          f *= 1 - t * t * (3 - 2 * t)
        }
        return f
      }
      const visible = sampleIdx.filter((i) => fadeOf([skinPos[i * 3], skinPos[i * 3 + 1], skinPos[i * 3 + 2]]) > 0.35)
      let framedFor = null
      let width = 0
      let height = 0

      const frame = (ex) => {
        const o = (ex.orient ?? [0, 0, 0]).map((d) => (d * Math.PI) / 180)
        body.rotation.set(o[0], o[1], o[2])
        body.updateMatrixWorld(true)
        const toWorld = (p, offset) => new THREE.Vector3(p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]).applyMatrix4(body.matrixWorld)
        const box = new THREE.Box3()
        const P = period(ex.motion)
        const extPts = (rig.extensions ?? []).flatMap((e) => [0.2, 0.45, 0.7].map((f) => ({ p: e.from.map((v, k) => v + e.dir[k] * e.length * f), w: e.weights })))
        for (let s = 0; s < 32; s++) {
          const joints = jointsAt(ex, (s / 32) * P)
          const offset = offsetFor(ex, joints.state, joints.list)
          for (const i of visible) {
            const p = transformPoint([skinPos[i * 3], skinPos[i * 3 + 1], skinPos[i * 3 + 2]], [skinW[i * 4], skinW[i * 4 + 1], skinW[i * 4 + 2], skinW[i * 4 + 3]], joints.list)
            box.expandByPoint(toWorld(p, offset))
          }
          for (const e of extPts) box.expandByPoint(toWorld(transformPoint(e.p, e.w, joints.list), offset))
        }
        floor.visible = !!ex.floor
        if (ex.floor) {
          const c = box.getCenter(new THREE.Vector3())
          const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 2) * 2.2
          floor.scale.set(span, span, 1)
          floor.position.set(c.x, box.min.y, c.z)
          box.expandByPoint(new THREE.Vector3(c.x, box.min.y - 0.05, c.z))
        }
        const target = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const view = new THREE.Vector3(...(ex.view ?? model.camera)).normalize()
        view.x *= sx
        // Fit the box's extent across the screen for this viewing direction.
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), view).normalize()
        const up = new THREE.Vector3().crossVectors(view, right).normalize()
        const half = size.clone().multiplyScalar(0.5)
        const extent = (axis) => Math.abs(axis.x) * half.x + Math.abs(axis.y) * half.y + Math.abs(axis.z) * half.z
        const depth = extent(view)
        const vHalf = THREE.MathUtils.degToRad(camera.fov / 2)
        const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect)
        const dist = Math.max(extent(right) / Math.tan(hHalf), extent(up) / Math.tan(vHalf)) * 1.06 + depth
        camera.position.copy(target).addScaledVector(view, dist)
        controls.target.copy(target)
        camera.lookAt(target)
        controls.update()
        history.length = 0
      }

      function jointsAt(ex, t) {
        const { range: r, reverse: rev } = live.current
        const state = evaluate(ex.motion, t, { range: r, reverse: rev })
        const list = rig.joints.map((j) => ({ pivot: j.pivot, matrix: state.joints[j.name] ? jointMatrix(j.axes, state.joints[j.name]) : IDENTITY }))
        return { state, list }
      }

      function offsetFor(ex, state, list) {
        let o = [0, 0, 0]
        if (ex.anchor && points[ex.anchor]) {
          const a = points[ex.anchor]
          const moved = transformPoint(a.p, a.weights, list)
          o = [a.p[0] - moved[0], a.p[1] - moved[1], a.p[2] - moved[2]]
        }
        return [o[0] + (state.slide ?? 0), o[1] + (state.lift ?? 0), o[2]]
      }

      const resize = () => {
        width = wrap.clientWidth
        height = wrap.clientHeight
        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        framedFor = null
      }
      const ro = new ResizeObserver(resize)
      ro.observe(wrap)
      resize()

      let raf
      let lastCue = null
      const tick = () => {
        const { exercise: ex, clock: c } = live.current
        if (ex) {
          if (framedFor !== ex) {
            frame(ex)
            framedFor = ex
          }
          const t = c ? c.now() : performance.now() / 1000
          const { state, list } = jointsAt(ex, t)
          const offset = offsetFor(ex, state, list)
          const active = new THREE.Vector4(...rig.joints.map((j) => (ex.moves ?? Object.keys(state.joints)).includes(j.name) ? 1 : 0))
          for (const m of materials) {
            list.forEach((j, k) => {
              m.uniforms.uPivot.value[k].set(...j.pivot)
              m.uniforms.uRot.value[k].fromArray(j.matrix)
            })
            m.uniforms.uActive.value.copy(active)
            m.uniforms.uOffset.value.set(...offset)
          }

          const tp = ex.trail && points[ex.trail]
          if (tp) {
            const q = transformPoint(tp.p, tp.weights, list)
            const pos = [q[0] + offset[0], q[1] + offset[1], q[2] + offset[2]]
            tip.visible = true
            tip.position.set(...pos)
            history.unshift(state.pen ? pos : null)
            if (history.length > TRAIL) history.length = TRAIL
            for (let i = 0; i < TRAIL; i++) {
              const h = history[i]
              const k = h ? (1 - i / TRAIL) ** 1.4 : 0
              trailPos.set(h ?? pos, i * 3)
              trailCol.set([HOT.r * k, HOT.g * k, HOT.b * k], i * 3)
            }
            trailGeo.attributes.position.needsUpdate = true
            trailGeo.attributes.color.needsUpdate = true
            band.visible = !!ex.band
            if (ex.band) {
              const b = bandGeo.attributes.position
              b.setXYZ(0, ...pos)
              b.setXYZ(1, ...ex.band)
              b.needsUpdate = true
            }
          } else {
            tip.visible = false
            band.visible = false
          }
          if (state.cue !== lastCue) {
            lastCue = state.cue
            live.current.onCue?.(state.cue)
          }
        }
        controls.update()
        renderer.render(scene, camera)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)

      return () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        controls.dispose()
        scene.traverse((o) => {
          o.geometry?.dispose()
          o.material?.dispose()
        })
        dotTex.dispose()
        floorTex.dispose()
        renderer.dispose()
        renderer.domElement.remove()
      }
    }

    return () => {
      disposed = true
      cleanup()
    }
  }, [region, side, debug])

  return (
    <div className="ex3d" ref={wrapRef}>
      {!ready && <div className="model-loading">Loading 3D model…</div>}
    </div>
  )
}
