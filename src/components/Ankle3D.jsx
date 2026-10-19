import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'

// Coordinates are for a right foot: toes point +Z, the outside (lateral) of the ankle is -X.
const ZONES = [
  { id: 'outside', label: 'Outside', anchor: [-0.66, 0.9, -0.12], normal: [-1, 0.05, 0.2] },
  { id: 'high', label: 'Front', anchor: [0, 1.7, 0.6], normal: [0, 0.12, 1] },
  { id: 'inside', label: 'Inside', anchor: [0.64, 1.0, 0.0], normal: [1, 0.05, 0.15] },
]

const TARGET = new THREE.Vector3(0, 1.45, 0.75)
const ANKLE_CENTER = new THREE.Vector3(0, 1.2, 0.1)
const FIELD_SIZE = 6
const FIELD_CENTER = new THREE.Vector3(0, 2.4, 0.8)

const vertexShader = `
  varying vec3 vN;
  varying vec3 vV;
  varying float vY;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vY = world.y;
    vec4 mv = viewMatrix * world;
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uBase;
  uniform float uOpacity;
  uniform float uFadeStart;
  uniform float uFadeEnd;
  varying vec3 vN;
  varying vec3 vV;
  varying float vY;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
    float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, vY);
    float a = clamp((uBase + f) * uOpacity * fade, 0.0, 1.0);
    gl_FragColor = vec4(uColor * (0.55 + 0.9 * f), a);
  }
`

function glassMaterial(color, { power, base, opacity }) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uBase: { value: base },
      uOpacity: { value: opacity },
      uFadeStart: { value: 3.0 },
      uFadeEnd: { value: 4.4 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

function radialTexture(stops) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  stops.forEach(([at, color]) => grad.addColorStop(at, color))
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function buildSkin(material) {
  const mc = new MarchingCubes(56, material, false, false, 60000)
  mc.isolation = 80
  mc.position.copy(FIELD_CENTER)
  mc.scale.setScalar(FIELD_SIZE / 2)
  mc.frustumCulled = false
  const subtract = 12
  const ball = (x, y, z, radius) => {
    const r = radius / FIELD_SIZE
    mc.addBall(
      (x - FIELD_CENTER.x) / FIELD_SIZE + 0.5,
      (y - FIELD_CENTER.y) / FIELD_SIZE + 0.5,
      (z - FIELD_CENTER.z) / FIELD_SIZE + 0.5,
      r * r * (mc.isolation + subtract),
      subtract,
    )
  }

  mc.reset()
  for (let y = 1.25; y <= 5.1; y += 0.3) {
    const t = (y - 1.25) / 3.85
    ball(0, y, -0.04 - 0.12 * t, (0.46 + 0.26 * Math.sin(t * Math.PI * 0.85)) * 0.78)
  }
  for (let y = 3.2; y <= 4.8; y += 0.4) ball(0, y, -0.32, 0.4)
  ball(0, 0.95, 0, 0.42)
  ball(-0.4, 0.9, -0.12, 0.26)
  ball(0.38, 1.0, 0.0, 0.26)
  ball(0, 0.5, -0.6, 0.42)
  ball(0, 0.32, -0.35, 0.36)
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    const z = -0.1 + i * 0.3
    const y = 0.6 - 0.3 * t
    const r = 0.42 - 0.1 * t
    ball(0.04, y, z, r * 0.82)
    if (z >= 0.4) {
      ball(-0.3, y * 0.72, z, r * 0.66)
      ball(0.32, y * 0.88, z, r * 0.66)
    }
  }
  const toes = [
    [0.36, 2.98, 0.19],
    [0.13, 2.9, 0.13],
    [-0.07, 2.82, 0.12],
    [-0.25, 2.72, 0.11],
    [-0.41, 2.6, 0.1],
  ]
  toes.forEach(([x, tip, r]) => {
    ball(x, 0.25, 2.45, r * 1.1)
    ball(x * 1.05, 0.23, tip, r)
  })
  mc.update()
  return mc
}

function capsuleBetween(a, b, radius, material) {
  const start = new THREE.Vector3(...a)
  const end = new THREE.Vector3(...b)
  const dir = end.clone().sub(start)
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, dir.length(), 4, 10), material)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  return mesh
}

function sphere(material, radius, pos, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), material)
  mesh.position.set(...pos)
  mesh.scale.set(...scale)
  return mesh
}

function buildBones(material) {
  const g = new THREE.Group()
  const tibia = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 3.9, 20, 1, true), material)
  tibia.position.set(0.1, 3.08, 0.04)
  const fibula = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.8, 12, 1, true), material)
  fibula.position.set(-0.42, 3.0, -0.15)
  g.add(
    tibia,
    fibula,
    sphere(material, 0.34, [0.08, 1.15, 0.04], [1.15, 0.6, 1]),
    sphere(material, 0.16, [0.4, 0.98, 0.02]),
    sphere(material, 0.15, [-0.46, 0.86, -0.15], [1, 1.4, 1]),
    sphere(material, 0.34, [0, 0.78, 0.08], [1, 0.72, 1.25]),
    sphere(material, 0.38, [0, 0.45, -0.5], [0.75, 0.8, 1.45]),
    sphere(material, 0.19, [0.18, 0.62, 0.62]),
    sphere(material, 0.19, [-0.24, 0.5, 0.7]),
    sphere(material, 0.12, [0.3, 0.6, 1.0]),
    sphere(material, 0.12, [0.1, 0.62, 1.0]),
    sphere(material, 0.12, [-0.08, 0.58, 1.0]),
  )
  const toes = [
    [0.33, 2.88, 0.085],
    [0.12, 2.8, 0.06],
    [-0.06, 2.72, 0.055],
    [-0.23, 2.62, 0.05],
    [-0.38, 2.5, 0.05],
  ]
  toes.forEach(([x, tip, r]) => {
    g.add(capsuleBetween([x * 0.85, 0.56, 1.15], [x, 0.3, 2.3], r, material))
    g.add(capsuleBetween([x, 0.29, 2.42], [x * 1.03, 0.23, tip - 0.06], r * 0.8, material))
  })
  return g
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export default function Ankle3D({ side, selected, onToggle, onError }) {
  const wrapRef = useRef(null)
  const labelRefs = useRef({})
  const lineRefs = useRef({})
  const hintRef = useRef(null)
  const selectedRef = useRef(new Set(selected))
  const onErrorRef = useRef(onError)

  useEffect(() => {
    selectedRef.current = new Set(selected)
    onErrorRef.current = onError
  }, [selected, onError])

  useEffect(() => {
    const wrap = wrapRef.current
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      onErrorRef.current?.()
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.className = 'ankle-canvas'
    wrap.prepend(renderer.domElement)

    const sx = side === 'left' ? -1 : 1
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
    const startDir = new THREE.Vector3(-0.78 * sx, 0.3, 0.62).normalize()
    camera.position.copy(TARGET).addScaledVector(startDir, 10.5)

    const model = new THREE.Group()
    model.scale.x = sx
    const skinMat = glassMaterial('#3d8bff', { power: 2.2, base: 0.03, opacity: 0.95 })
    const boneMat = glassMaterial('#bfe3ff', { power: 1.5, base: 0.1, opacity: 0.7 })
    const skin = buildSkin(skinMat)
    const bones = buildBones(boneMat)
    model.add(skin, bones)
    scene.add(model)

    const floorTex = radialTexture([[0, 'rgba(70,140,255,0.55)'], [0.5, 'rgba(40,90,255,0.15)'], [1, 'rgba(0,0,0,0)']])
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0.02, 0.9)
    scene.add(floor)

    const coreTex = radialTexture([[0, 'rgba(255,240,220,1)'], [0.18, 'rgba(255,120,80,0.95)'], [0.5, 'rgba(255,30,30,0.35)'], [1, 'rgba(255,0,0,0)']])
    const haloTex = radialTexture([[0, 'rgba(255,60,40,0.6)'], [0.5, 'rgba(255,0,0,0.18)'], [1, 'rgba(255,0,0,0)']])
    const zones = ZONES.map((z) => {
      const world = new THREE.Vector3(z.anchor[0] * sx, z.anchor[1], z.anchor[2])
      const normal = new THREE.Vector3(z.normal[0] * sx, z.normal[1], z.normal[2]).normalize()
      const spriteMat = (map) =>
        new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
      const core = new THREE.Sprite(spriteMat(coreTex))
      core.scale.setScalar(0.85)
      const halo = new THREE.Sprite(spriteMat(haloTex))
      halo.scale.setScalar(1.9)
      core.position.copy(world)
      halo.position.copy(world)
      scene.add(halo, core)
      return { ...z, world, normal, core, halo }
    })

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(TARGET)
    controls.enablePan = false
    controls.enableZoom = false
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.rotateSpeed = 0.9
    controls.minPolarAngle = 0.95
    controls.maxPolarAngle = 1.85
    const hideHint = () => hintRef.current?.classList.add('gone')
    controls.addEventListener('start', hideHint)

    let width = 0
    let height = 0
    const resize = () => {
      width = wrap.clientWidth
      height = wrap.clientHeight
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()

    const toCam = new THREE.Vector3()
    const p = new THREE.Vector3()
    const center = new THREE.Vector3()
    let raf
    const tick = (time) => {
      controls.update()
      center.copy(ANKLE_CENTER).project(camera)
      const cx = (center.x * 0.5 + 0.5) * width

      const placed = []
      const facings = zones.map((z) => toCam.copy(camera.position).sub(z.world).normalize().dot(z.normal))
      const best = facings.indexOf(Math.max(...facings))
      for (const [i, z] of zones.entries()) {
        const facing = facings[i]
        const inView = i === best ? smoothstep(0.3, 0.85, facing) : 0
        const isOn = selectedRef.current.has(z.id)
        const pulse = 0.82 + 0.18 * Math.sin(time / 280)
        const k = Math.max(inView * 0.9, isOn ? pulse : 0)
        z.core.material.opacity = k
        z.halo.material.opacity = k * 0.5

        const label = labelRefs.current[z.id]
        const line = lineRefs.current[z.id]
        if (!label || !line) continue
        p.copy(z.world).project(camera)
        const px = (p.x * 0.5 + 0.5) * width
        const py = (-p.y * 0.5 + 0.5) * height
        const w = label.offsetWidth
        const onLeft = px < cx
        placed.push({
          label, line, px, py, facing, w,
          h: label.offsetHeight,
          x: onLeft ? 14 + w / 2 : width - 14 - w / 2,
          y: py - 46,
        })
      }

      // Labels sit at the left/right edges like a diagram; stack any that collide on the same side.
      for (let pass = 0; pass < 6; pass++) {
        for (let i = 0; i < placed.length; i++) {
          for (let j = i + 1; j < placed.length; j++) {
            const a = placed[i]
            const b = placed[j]
            if (Math.abs(a.x - b.x) > (a.w + b.w) / 2) continue
            const overlapY = (a.h + b.h) / 2 + 10 - Math.abs(a.y - b.y)
            if (overlapY <= 0) continue
            const dir = a.y <= b.y ? -1 : 1
            a.y += (dir * overlapY) / 2
            b.y -= (dir * overlapY) / 2
          }
        }
      }

      for (const l of placed) {
        const lx = Math.min(width - 10 - l.w / 2, Math.max(10 + l.w / 2, l.x))
        const ly = Math.min(height - 10 - l.h / 2, Math.max(10 + l.h / 2, l.y))
        l.label.style.transform = `translate(${lx - l.w / 2}px, ${ly - l.h / 2}px)`
        const hidden = l.facing < -0.15
        l.label.classList.toggle('behind', hidden)
        const ax = l.px - lx
        const ay = l.py - ly
        const alen = Math.hypot(ax, ay) || 1
        l.line.setAttribute('x1', lx)
        l.line.setAttribute('y1', ly)
        l.line.setAttribute('x2', l.px - (ax / alen) * 7)
        l.line.setAttribute('y2', l.py - (ay / alen) * 7)
        l.line.classList.toggle('behind', hidden)
      }
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
      ;[floorTex, coreTex, haloTex].forEach((t) => t.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [side])

  return (
    <div className="ankle3d" ref={wrapRef}>
      <svg className="ankle-lines" aria-hidden="true">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="rgba(255,255,255,0.85)" />
          </marker>
          <marker id="arrow-on" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="#2ee67a" />
          </marker>
        </defs>
        {ZONES.map((z) => (
          <line
            key={z.id}
            ref={(el) => (lineRefs.current[z.id] = el)}
            className={selected.includes(z.id) ? 'on' : ''}
            markerEnd={selected.includes(z.id) ? 'url(#arrow-on)' : 'url(#arrow)'}
          />
        ))}
      </svg>
      {ZONES.map((z) => (
        <button
          key={z.id}
          ref={(el) => (labelRefs.current[z.id] = el)}
          className={`zone-label ${selected.includes(z.id) ? 'on' : ''}`}
          aria-pressed={selected.includes(z.id)}
          onClick={() => onToggle(z.id)}
        >
          {selected.includes(z.id) && <span className="tick" aria-hidden="true" />}
          {z.label}
        </button>
      ))}
      <div className="ankle-hint" ref={hintRef}>Drag to spin</div>
    </div>
  )
}
