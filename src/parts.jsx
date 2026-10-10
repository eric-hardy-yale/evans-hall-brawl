import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { slideTex } from './slides.js'

// shared building blocks for World.jsx (floor 2) and GroundFloor.jsx (floor 1)
export function Instanced({ items, material, geometry }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    items.forEach((it, i) => {
      p.set(...it.p)
      e.set(0, it.r || 0, 0)
      q.setFromEuler(e)
      s.set(...(it.s || [1, 1, 1]))
      m.compose(p, q, s)
      ref.current.setMatrixAt(i, m)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} />
}

export const BOX = new THREE.BoxGeometry(1, 1, 1)
const slideMats = new Map()
export const slideMat = (course, kind) => {
  const k = `${course}-${kind}`
  if (!slideMats.has(k)) slideMats.set(k, new THREE.MeshBasicMaterial({ map: slideTex(course, kind), toneMapped: false }))
  return slideMats.get(k)
}

export function wallItems(walls, mat) {
  return walls.filter((w) => w.mat === mat).map((w) => {
    const dx = w.b[0] - w.a[0]
    const dz = w.b[1] - w.a[1]
    return {
      p: [(w.a[0] + w.b[0]) / 2, w.y0 + w.h / 2, (w.a[1] + w.b[1]) / 2],
      r: -Math.atan2(dz, dx),
      s: [Math.max(Math.hypot(dx, dz), 0.01) + 0.02, w.h, w.t],
    }
  })
}

// vertical strip along a closed polyline
export function ribbon(points, y0, y1, uPerMeter = 0.25) {
  const pts = [...points, points[0]]
  const pos = []
  const uv = []
  const idx = []
  let u = 0
  pts.forEach((p, i) => {
    if (i > 0) u += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) * uPerMeter
    pos.push(p[0], y0, p[1], p[0], y1, p[1])
    uv.push(u, 0, u, 1)
    if (i > 0) {
      const a = (i - 1) * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export const SPHERE = new THREE.SphereGeometry(1, 14, 10)

export function Plane({ p, rot = 0, w, h, material }) {
  return (
    <mesh position={p} rotation={[0, rot, 0]} material={material}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

