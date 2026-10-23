import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { decode, loadModel, radialTexture } from './anatomy'
import { glassMaterial } from './BodyModel3D'

// The injured area, glowing red when it's fresh and shifting through amber to green as it heals.
// Same BodyParts3D models as the injury picker, shown read-only and slowly turning.

const RED = new THREE.Color('#ff3b2f')
const AMBER = new THREE.Color('#ffb020')
const GREEN = new THREE.Color('#2ee67a')

function healColor(k, out) {
  return k < 0.5 ? out.lerpColors(RED, AMBER, k / 0.5) : out.lerpColors(AMBER, GREEN, (k - 0.5) / 0.5)
}

export default function HealingModel3D({ region, side, spotIds, heal, onError }) {
  const wrapRef = useRef(null)
  const healRef = useRef(heal)
  const spotsRef = useRef(new Set(spotIds))
  const onErrorRef = useRef(onError)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    healRef.current = heal
    spotsRef.current = new Set(spotIds)
    onErrorRef.current = onError
  }, [heal, spotIds, onError])

  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    loadModel(region)
      .then((model) => {
        if (disposed) return
        cleanup = mount(model)
        setReady(true)
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
      renderer.domElement.className = 'heal-canvas'
      wrap.prepend(renderer.domElement)

      const sx = side === 'left' ? -1 : 1
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100)

      const skinGeo = decode(model.skin)
      const boneGeo = decode(model.bones)
      const body = new THREE.Group()
      body.add(
        new THREE.Mesh(skinGeo, glassMaterial('#3d8bff', { power: 2.4, base: 0.02, opacity: 0.95 }, model.fades)),
        new THREE.Mesh(boneGeo, glassMaterial('#d6ecff', { power: 1.3, base: 0.16, opacity: 0.75, lit: 1 }, model.fades)),
      )

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
      const fit = () => {
        const vHalf = THREE.MathUtils.degToRad(camera.fov / 2)
        const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect)
        const dist = ((reach / Math.sin(Math.min(vHalf, hHalf))) * 0.9) / (model.zoom ?? 1)
        const dir = camera.position.clone().sub(target).normalize()
        camera.position.copy(target).addScaledVector(dir, dist)
      }

      // White glows, tinted per frame so the same sprite can go from red to green.
      const coreTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,255,255,0.9)'], [0.5, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']])
      const haloTex = radialTexture([[0, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0)']])
      const glows = model.zones.map((z) => {
        const world = new THREE.Vector3(z.at[0] * sx, z.at[1], z.at[2])
        const mk = (map, size) => {
          const s = new THREE.Sprite(
            new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
          )
          s.scale.setScalar(radius * size)
          s.position.copy(world)
          scene.add(s)
          return s
        }
        return { id: z.id, core: mk(coreTex, 0.34), halo: mk(haloTex, 0.75) }
      })

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.target.copy(target)
      controls.enablePan = false
      controls.enableZoom = false
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.autoRotate = true
      controls.autoRotateSpeed = 1.6
      controls.minPolarAngle = 0.9
      controls.maxPolarAngle = 2.0
      // OrbitControls claims every touch; let vertical swipes still scroll the page past the model.
      renderer.domElement.style.touchAction = 'pan-y'

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

      const color = new THREE.Color()
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduce) controls.autoRotate = false
      const t0 = performance.now()
      let shown = reduce ? healRef.current : 0
      let raf
      const tick = (time) => {
        // Ease up to the real value on first view so you watch it heal.
        shown += (healRef.current - shown) * 0.035
        if (Math.abs(healRef.current - shown) < 0.0005) shown = healRef.current
        const k = shown
        const pulse = reduce ? 1 : 0.85 + 0.15 * Math.sin((time - t0) / 420)
        healColor(k, color)
        for (const g of glows) {
          const on = spotsRef.current.has(g.id)
          const fade = (1 - k * 0.55) * pulse
          g.core.material.color.copy(color)
          g.halo.material.color.copy(color)
          g.core.material.opacity = on ? 0.95 * fade : 0
          g.halo.material.opacity = on ? 0.55 * fade : 0
        }
        for (const st of structures) {
          const on = spotsRef.current.has(st.zone)
          st.mat.uniforms.uColor.value.copy(on ? color : st.base)
          st.mat.uniforms.uOpacity.value = on ? 1.2 : st.baseOpacity
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
    <div className="heal-stage" ref={wrapRef}>
      {!ready && <div className="model-loading">Loading 3D model…</div>}
    </div>
  )
}
