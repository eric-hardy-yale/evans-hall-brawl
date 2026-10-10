import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SPLATS, stepBrawl } from './brawlSim.js'
import { splatTex } from './textures.js'

// Runs the brawl simulation once per frame (before the figures read it) and draws the
// splatter it leaves on the floors: four texture variants, one instanced mesh each.
const VARIANTS = 4
const M4 = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const P = new THREE.Vector3()
const S = new THREE.Vector3()

export default function BrawlFx() {
  const meshes = useRef([])
  const seen = useRef(-1)
  const { geo, mats } = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.rotateX(-Math.PI / 2)
    const m = Array.from({ length: VARIANTS }, (_, i) =>
      new THREE.MeshStandardMaterial({ map: splatTex(i + 1), transparent: true, alphaTest: 0.35, roughness: 0.2, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    )
    return { geo: g, mats: m }
  }, [])

  useFrame(({ clock }, dt) => {
    stepBrawl(Math.min(dt, 0.05), clock.elapsedTime)
    if (SPLATS.version === seen.current) return
    seen.current = SPLATS.version
    const counts = new Array(VARIANTS).fill(0)
    for (const s of SPLATS.list) {
      const mesh = meshes.current[s.variant]
      if (!mesh) continue
      M4.compose(P.set(s.x, s.y + 0.015, s.z), Q.setFromEuler(E.set(0, s.rot, 0)), S.set(s.size, 1, s.size))
      mesh.setMatrixAt(counts[s.variant]++, M4)
    }
    meshes.current.forEach((m, i) => {
      if (!m) return
      m.count = counts[i]
      m.instanceMatrix.needsUpdate = true
    })
  }, -1)

  return mats.map((m, i) => (
    <instancedMesh key={i} ref={(el) => (meshes.current[i] = el)} args={[geo, m, SPLATS.max]} count={0} frustumCulled={false} />
  ))
}
