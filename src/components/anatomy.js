import * as THREE from 'three'

// Shared loading helpers for the BodyParts3D models in public/models.

export function decodePositions(part) {
  const bytes = Uint8Array.from(atob(part.position), (c) => c.charCodeAt(0))
  const q = new Int16Array(bytes.buffer)
  const pos = new Float32Array(q.length)
  for (let i = 0; i < q.length; i++) pos[i] = q[i] * part.scale
  return pos
}

export function decode(part) {
  const pos = decodePositions(part)
  const ib = Uint8Array.from(atob(part.index), (c) => c.charCodeAt(0))
  const index = part.index32 ? new Uint32Array(ib.buffer) : new Uint16Array(ib.buffer)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setIndex(new THREE.BufferAttribute(index, 1))
  g.computeVertexNormals()
  return g
}

const cache = new Map()
export function loadModel(region) {
  if (!cache.has(region)) {
    cache.set(
      region,
      fetch(`/models/${region}.json`).then((r) => {
        if (!r.ok) throw new Error(`model ${region} ${r.status}`)
        return r.json()
      }),
    )
  }
  return cache.get(region)
}

export function radialTexture(stops) {
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
