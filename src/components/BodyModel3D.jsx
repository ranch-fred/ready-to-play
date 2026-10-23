import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { decode, loadModel, radialTexture } from './anatomy'

// Models are built for a right-side injury by scripts/build-anatomy.mjs and mirrored for the left.

const vertexShader = `
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
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
  uniform float uLit;
  uniform vec3 uFadeAxis[3];
  uniform vec2 uFadeRange[3];
  uniform int uFadeCount;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vLocal;
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
    float a = clamp((uBase + f) * uOpacity * fade, 0.0, 1.0);
    gl_FragColor = vec4(uColor * (0.5 + 0.9 * f) * light, a);
  }
`

export function glassMaterial(color, { power, base, opacity, lit = 0 }, fades) {
  const axes = [0, 1, 2].map((i) => new THREE.Vector3(...(fades[i]?.axis ?? [0, 1, 0])))
  const ranges = [0, 1, 2].map((i) => new THREE.Vector2(fades[i]?.full ?? 0, fades[i]?.zero ?? 1))
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uBase: { value: base },
      uOpacity: { value: opacity },
      uLit: { value: lit },
      uFadeAxis: { value: axes },
      uFadeRange: { value: ranges },
      uFadeCount: { value: Math.min(fades.length, 3) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export default function BodyModel3D({ region, side, selected, onToggle, onError }) {
  const wrapRef = useRef(null)
  const labelRefs = useRef({})
  const lineRefs = useRef({})
  const hintRef = useRef(null)
  const selectedRef = useRef(new Set(selected))
  const onErrorRef = useRef(onError)
  const [zones, setZones] = useState([])

  useEffect(() => {
    selectedRef.current = new Set(selected)
    onErrorRef.current = onError
  }, [selected, onError])

  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    loadModel(region)
      .then((model) => {
        if (disposed) return
        setZones(model.zones)
        cleanup = mount(model)
      })
      .catch(() => onErrorRef.current?.())

    function mount(model) {
      const wrap = wrapRef.current
      let renderer
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      } catch {
        onErrorRef.current?.()
        return () => {}
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.domElement.className = 'ankle-canvas'
      wrap.prepend(renderer.domElement)

      const sx = side === 'left' ? -1 : 1
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100)

      const skinGeo = decode(model.skin)
      const boneGeo = decode(model.bones)
      const skin = new THREE.Mesh(skinGeo, glassMaterial('#3d8bff', { power: 2.4, base: 0.02, opacity: 0.95 }, model.fades))
      const bones = new THREE.Mesh(boneGeo, glassMaterial('#d6ecff', { power: 1.3, base: 0.16, opacity: 0.75, lit: 1 }, model.fades))
      const body = new THREE.Group()
      body.add(skin, bones)

      // Muscles and ligaments glow red when their pain spot is facing the viewer or selected.
      const hot = new THREE.Color('#ff3b2f')
      const structures = []
      for (const m of model.muscles ?? []) {
        const mat = glassMaterial('#ff8a3d', { power: 1.4, base: 0.22, opacity: 0.6, lit: 1 }, model.fades)
        body.add(new THREE.Mesh(decode(m.mesh), mat))
        structures.push({ zone: m.zone, mat, base: new THREE.Color('#ff8a3d'), baseOpacity: 0.6 })
      }
      for (const l of model.ligaments ?? []) {
        const a = new THREE.Vector3(...l.a)
        const b = new THREE.Vector3(...l.b)
        const dir = b.clone().sub(a)
        const mat = glassMaterial('#ffc061', { power: 1.2, base: 0.45, opacity: 0.75, lit: 1 }, model.fades)
        const band = new THREE.Mesh(new THREE.CapsuleGeometry(l.r, Math.max(dir.length() - l.r * 2, 0.001), 4, 12), mat)
        band.position.copy(a).add(b).multiplyScalar(0.5)
        band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
        body.add(band)
        structures.push({ zone: l.zone, mat, base: new THREE.Color('#ffc061'), baseOpacity: 0.75 })
      }
      body.scale.x = sx
      scene.add(body)

      skinGeo.computeBoundingSphere()
      const box = new THREE.Box3().setFromBufferAttribute(skinGeo.getAttribute('position'))
      const anchorsCenter = model.zones
        .reduce((acc, z) => acc.add(new THREE.Vector3(z.at[0] * sx, z.at[1], z.at[2])), new THREE.Vector3())
        .divideScalar(model.zones.length)
      const target = box.getCenter(new THREE.Vector3()).multiply(new THREE.Vector3(sx, 1, 1)).lerp(anchorsCenter, 0.5)
      const radius = skinGeo.boundingSphere.radius
      const mirroredBox = box.clone().applyMatrix4(new THREE.Matrix4().makeScale(sx, 1, 1))
      const reach = Math.max(
        ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
          new THREE.Vector3(
            i & 1 ? mirroredBox.max.x : mirroredBox.min.x,
            i & 2 ? mirroredBox.max.y : mirroredBox.min.y,
            i & 4 ? mirroredBox.max.z : mirroredBox.min.z,
          ).distanceTo(target),
        ),
      )
      const camDir = new THREE.Vector3(model.camera[0] * sx, model.camera[1], model.camera[2]).normalize()
      camera.position.copy(target).addScaledVector(camDir, radius * 3)
      // Fit the model to whichever of the screen's width or height is tighter.
      const fit = () => {
        const vHalf = THREE.MathUtils.degToRad(camera.fov / 2)
        const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect)
        const dist = (reach / Math.sin(Math.min(vHalf, hHalf))) * 0.9 / (model.zoom ?? 1)
        const dir = camera.position.clone().sub(target).normalize()
        camera.position.copy(target).addScaledVector(dir, dist)
      }

      const coreTex = radialTexture([[0, 'rgba(255,240,220,1)'], [0.18, 'rgba(255,120,80,0.95)'], [0.5, 'rgba(255,30,30,0.35)'], [1, 'rgba(255,0,0,0)']])
      const haloTex = radialTexture([[0, 'rgba(255,60,40,0.6)'], [0.5, 'rgba(255,0,0,0.18)'], [1, 'rgba(255,0,0,0)']])
      const spots = model.zones.map((z) => {
        const world = new THREE.Vector3(z.at[0] * sx, z.at[1], z.at[2])
        const normal = new THREE.Vector3(z.normal[0] * sx, z.normal[1], z.normal[2]).normalize()
        const mat = (map) =>
          new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
        const core = new THREE.Sprite(mat(coreTex))
        core.scale.setScalar(radius * 0.32)
        const halo = new THREE.Sprite(mat(haloTex))
        halo.scale.setScalar(radius * 0.7)
        core.position.copy(world)
        halo.position.copy(world)
        scene.add(halo, core)
        return { id: z.id, world, normal, core, halo }
      })

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.target.copy(target)
      controls.enablePan = false
      controls.enableZoom = false
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.rotateSpeed = 0.9
      controls.minPolarAngle = 0.6
      controls.maxPolarAngle = 2.3
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
        fit()
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
        center.copy(anchorsCenter).project(camera)
        const cx = (center.x * 0.5 + 0.5) * width

        const facings = spots.map((s) => toCam.copy(camera.position).sub(s.world).normalize().dot(s.normal))
        const best = facings.indexOf(Math.max(...facings))
        const placed = []
        const heat = {}
        for (const [i, s] of spots.entries()) {
          const facing = facings[i]
          const inView = i === best ? smoothstep(0.3, 0.85, facing) : 0
          const isOn = selectedRef.current.has(s.id)
          const pulse = 0.82 + 0.18 * Math.sin(time / 280)
          const k = Math.max(inView * 0.9, isOn ? pulse : 0)
          heat[s.id] = k
          s.core.material.opacity = k
          s.halo.material.opacity = k * 0.5

          const label = labelRefs.current[s.id]
          const line = lineRefs.current[s.id]
          if (!label || !line) continue
          p.copy(s.world).project(camera)
          const px = (p.x * 0.5 + 0.5) * width
          const py = (-p.y * 0.5 + 0.5) * height
          const w = label.offsetWidth
          const onLeft = px < cx
          placed.push({ label, line, px, py, facing, w, h: label.offsetHeight, x: onLeft ? 14 + w / 2 : width - 14 - w / 2, y: py - 46 })
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
        for (const st of structures) {
          const k = heat[st.zone] ?? 0
          st.mat.uniforms.uColor.value.lerpColors(st.base, hot, k)
          st.mat.uniforms.uOpacity.value = st.baseOpacity + (1.4 - st.baseOpacity) * k
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
        coreTex.dispose()
        haloTex.dispose()
        renderer.dispose()
        renderer.domElement.remove()
      }
    }

    return () => {
      disposed = true
      cleanup()
    }
  }, [region, side])

  return (
    <div className="ankle3d" ref={wrapRef}>
      {!zones.length && <div className="model-loading">Loading 3D model…</div>}
      <svg className="ankle-lines" aria-hidden="true">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="rgba(255,255,255,0.85)" />
          </marker>
          <marker id="arrow-on" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="#2ee67a" />
          </marker>
        </defs>
        {zones.map((z) => (
          <line
            key={z.id}
            ref={(el) => (lineRefs.current[z.id] = el)}
            className={selected.includes(z.id) ? 'on' : ''}
            markerEnd={selected.includes(z.id) ? 'url(#arrow-on)' : 'url(#arrow)'}
          />
        ))}
      </svg>
      {zones.map((z) => (
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
      <p className="model-credit">3D anatomy: BodyParts3D © DBCLS, CC BY 4.0</p>
    </div>
  )
}
