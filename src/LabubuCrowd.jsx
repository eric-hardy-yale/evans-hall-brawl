import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BRAWL } from './brawl.js'
import * as THREE from 'three'
import { EXPRESSIONS, G, SKIN, YALE_BLUE, faceTex, furTex, shirtTex } from './Labubu.jsx'
import { CHAIRS, DRUMS } from './layout.js'

// ~30 seated Labubu students per classroom, drawn with a handful of instanced meshes
// (one per body part) so hundreds of them stay cheap.
const STUDENTS_PER_ROOM = 30
const HEIGHT = 0.95
const FURS = ['#5a3d2e', '#d9c2a0', '#ff8fc7', '#9fe0c6', '#b9a5e6', '#8d8d93', '#f2efe9', '#f2a65a', '#7fb2ff', '#2b2b2e', '#c98f6b', '#e6d36b']
const SHIRTS = ['yale', 'yale', 'yale', 'stripes', 'plain', 'plain', 'plain', 'none']
const SHIRT_COLORS = ['#ffffff', YALE_BLUE, '#ff4fa3', '#7a9e7e', '#e8dcc0', '#2b2b2e', '#c94f4f']
const PANTS = ['#1d2a44', '#3d5a8a', '#d8cfc0', '#2c2c30', '#e8dcc0', null, null]

function rand(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

const V = new THREE.Vector3()
const S = new THREE.Vector3()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const EY = new THREE.Euler(0, 0, 0, 'YXZ') // yaw first, then lean in the figure's own frame
const M = (p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => new THREE.Matrix4().compose(V.set(...p), Q.setFromEuler(E.set(...r)), S.set(...s))
const mul = (...ms) => ms.reduce((a, b) => a.clone().multiply(b))

// seat Labubus in `count` randomly chosen chairs ({ x, y, z, rot } with the chair back toward rot)
export function seatPeople(chairs, count, seed) {
  const r = rand(seed)
  const pick = (a) => a[Math.floor(r() * a.length)]
  return chairs
    .map((c) => [r(), c])
    .sort((a, b) => a[0] - b[0])
    .slice(0, count)
    .map(([, c]) => {
      const shirt = pick(SHIRTS)
      return {
        x: c.x,
        y: (c.y || 0) + 0.51 - 0.11 * HEIGHT,
        z: c.z,
        rot: c.rot + Math.PI,
        floorY: c.y || 0,
        fur: pick(FURS),
        expression: pick(EXPRESSIONS),
        shirt,
        shirtColor: pick(SHIRT_COLORS),
        pants: pick(PANTS),
      }
    })
}

// pick seats + outfits once
export const STUDENTS = DRUMS.flatMap((d, di) =>
  seatPeople(
    CHAIRS.filter((c) => c.room === d.id),
    STUDENTS_PER_ROOM,
    4242 + di * 977,
  ),
)

// brawl poses (see Labubu.jsx): wind up, stab, recoil. Pose 0 is sitting nicely.
const POSES = [
  null,
  { armX: -2.8, lean: -0.12, fwd: 0 },
  { armX: -1.45, lean: 0.28, fwd: 0.06 },
  { armX: -0.6, lean: 0.05, fwd: 0 },
]
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0)

// local part transforms for a seated Labubu (same layout as Labubu.jsx).
// Every pose emits the same parts in the same order; the knife and splatter are just hidden in pose 0.
function partsFor(s, pose) {
  const out = []
  const add = (bucket, m, color) => out.push({ bucket, m, color })
  const fur = s.fur
  const legM = s.pants ? 0.078 : 0.07
  for (const x of [-0.085, 0.085]) {
    add(s.pants ? 'cyl' : 'furCyl', M([x, 0.15, 0.12], [Math.PI / 2, 0, 0], [legM, 0.2, legM]), s.pants || fur)
    add('skin', M([x, 0.17, 0.23], [0, 0, 0], [0.065, 0.09, 0.035]))
  }
  add('fur', M([0, 0.34, 0], [0, 0, 0], [0.2, 0.23, 0.18]), fur)
  if (s.pants) add('cyl', M([0, 0.22, 0], [0, 0, 0], [0.19, 0.12, 0.17]), s.pants)
  const shirtBucket = s.shirt === 'yale' ? 'shirtYale' : s.shirt === 'stripes' ? 'shirtStripes' : s.shirt === 'plain' ? 'shirtPlain' : null
  if (shirtBucket) add(shirtBucket, M([0, 0.39, 0], [0, 0, 0], [0.207, 0.22, 0.188]), s.shirtColor)
  for (const side of [1, -1]) {
    const shoulder = !pose
      ? M([0.17 * side, 0.47, 0], [0.25, 0, 0.35 * side])
      : side < 0
        ? M([0.17 * side, 0.47, 0], [pose.armX, 0, -0.3])
        : M([0.17 * side, 0.47, 0], [-0.9, 0, 0.9]) // guard up
    add('furLimb', mul(shoulder, M([0, -0.09, 0], [0, 0, 0], [0.045, 0.06, 0.045])), fur)
    if (shirtBucket) add(shirtBucket === 'shirtPlain' ? 'cyl' : 'sleeve' + shirtBucket.slice(5), mul(shoulder, M([0, -0.04, 0], [0, 0, 0], [0.056, 0.07, 0.056])), s.shirt === 'plain' ? s.shirtColor : undefined)
    add('skin', mul(shoulder, M([0, -0.18, 0.01], [0, 0, 0], [0.04, 0.045, 0.035])))
    if (side < 0) {
      add('dark', pose ? mul(shoulder, M([0, -0.21, 0.02], [0, 0, 0], [0.024, 0.07, 0.024])) : HIDE)
      add('blade', pose ? mul(shoulder, M([0, -0.32, 0.02], [0, 0, 0], [0.012, 0.15, 0.032])) : HIDE)
    }
  }
  for (const b of [[0.07, 0.4, 0.17, 0.07, 0.05], [-0.05, 0.3, 0.17, 0.04, 0.06], [-0.09, 0.66, 0.22, 0.045, 0.03]])
    add('blood', pose ? M([b[0], b[1], b[2]], [0, 0, 0], [b[3], b[4], 0.02]) : HIDE)
  const head = M([0, 0.7, 0])
  add('fur', mul(head, M([0, 0, 0], [0, 0, 0], [0.27, 0.25, 0.25])), fur)
  add('face-' + s.expression, mul(head, M([0, -0.02, 0.012], [0, 0, 0], [0.245, 0.235, 0.255])))
  for (const side of [-1, 1]) {
    const ear = mul(head, M([0.115 * side, 0.27, -0.02], [0, 0, -0.14 * side]))
    add('fur', mul(ear, M([0, 0, 0], [0, 0, 0], [0.075, 0.17, 0.05])), fur)
    add('skin', mul(ear, M([0, -0.01, 0.03], [0, 0, 0], [0.042, 0.12, 0.025])))
    add('dark', mul(ear, M([0, -0.02, 0.05], [0, 0, 0], [0.012, 0.055, 0.008])))
  }
  return out
}

function buckets() {
  const std = (o) => new THREE.MeshStandardMaterial(o)
  const furM = std({ color: '#ffffff', map: furTex(), bumpMap: furTex(), bumpScale: 2, roughness: 1 })
  const plain = std({ color: '#ffffff', roughness: 0.85 })
  const sleeveGeo = G.cyl
  const b = {
    fur: [G.sphere, furM, true],
    furLimb: [G.limb, furM, true],
    furCyl: [G.cyl, furM, true],
    skin: [G.sphere, std({ color: SKIN, roughness: 0.55 }), false],
    dark: [G.sphere, std({ color: '#3a2416', roughness: 0.6 }), false],
    cyl: [G.cyl, plain, true],
    shirtPlain: [G.shirt, plain, true],
    shirtYale: [G.shirt, std({ map: shirtTex('yale'), roughness: 0.85 }), false],
    shirtStripes: [G.shirt, std({ map: shirtTex('stripes'), roughness: 0.85 }), false],
    sleeveYale: [sleeveGeo, std({ color: YALE_BLUE, roughness: 0.85 }), false],
    sleeveStripes: [sleeveGeo, std({ map: shirtTex('stripes'), roughness: 0.85 }), false],
    blade: [G.box, std({ color: '#d7dde4', metalness: 0.9, roughness: 0.2 }), false],
    blood: [G.sphere, std({ color: '#8f0a0a', roughness: 0.25, metalness: 0.1 }), false],
    puddle: [G.cyl, std({ color: '#7a0808', roughness: 0.2, metalness: 0.1 }), false],
  }
  for (const e of EXPRESSIONS) b['face-' + e] = [G.face, std({ map: faceTex(e), roughness: 0.5 }), false]
  return b
}

const Bucket = ({ geo, mat, items, tinted, meshRef }) => {
  useLayoutEffect(() => {
    const c = new THREE.Color()
    items.forEach((it, i) => {
      meshRef.current.setMatrixAt(i, it.m)
      if (tinted) meshRef.current.setColorAt(i, c.set(it.color || '#ffffff'))
    })
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
  }, [items, tinted, meshRef])
  return <instancedMesh ref={meshRef} args={[geo, mat, items.length]} frustumCulled={false} />
}

// yaw toward the nearest neighbor (the brawl partner), or the chair's own direction if alone
function partnerYaw(people, i) {
  const s = people[i]
  let best = null
  let bd = 3
  for (let j = 0; j < people.length; j++) {
    if (j === i) continue
    const d = Math.hypot(people[j].x - s.x, people[j].z - s.z)
    if (d < bd && Math.abs(people[j].y - s.y) < 1) {
      bd = d
      best = people[j]
    }
  }
  return best ? Math.atan2(best.x - s.x, best.z - s.z) : s.rot
}

export default function LabubuCrowd({ people = STUDENTS }) {
  const built = useMemo(() => {
    const defs = buckets()
    const keys = Object.keys(defs)
    // per pose, per bucket: the instance matrices; plus where each person's parts live
    const lists = POSES.map(() => Object.fromEntries(keys.map((k) => [k, []])))
    const slots = people.map(() => [])
    const phases = []
    people.forEach((s, i) => {
      const yaw = partnerYaw(people, i)
      phases.push(((i * 0.6180339) % 1) + 0.1 * (i % 3))
      POSES.forEach((pose, p) => {
        const root = pose
          ? new THREE.Matrix4().compose(
              V.set(s.x + Math.sin(yaw) * pose.fwd, s.y, s.z + Math.cos(yaw) * pose.fwd),
              Q.setFromEuler(EY.set(pose.lean, yaw, 0)),
              S.set(HEIGHT, HEIGHT, HEIGHT),
            )
          : M([s.x, s.y, s.z], [0, s.rot, 0], [HEIGHT, HEIGHT, HEIGHT])
        for (const part of partsFor(s, pose)) {
          if (p === 0) slots[i].push([part.bucket, lists[0][part.bucket].length])
          lists[p][part.bucket].push({ m: part.m === HIDE ? HIDE : mul(root, part.m), color: part.color })
        }
        // a puddle on the floor in front of the seat
        if (p === 0) slots[i].push(['puddle', lists[0].puddle.length])
        lists[p].puddle.push({
          m: pose ? M([s.x + Math.sin(yaw) * 0.45, s.floorY + 0.012, s.z + Math.cos(yaw) * 0.45], [0, yaw, 0], [0.38, 0.004, 0.3]) : HIDE,
        })
      })
    })
    const used = keys.filter((k) => lists[0][k].length)
    const mats = POSES.map((_, p) =>
      Object.fromEntries(
        used.map((k) => {
          const arr = new Float32Array(lists[p][k].length * 16)
          lists[p][k].forEach((it, j) => it.m.toArray(arr, j * 16))
          return [k, arr]
        }),
      ),
    )
    const groups = used.map((k) => {
      const [geo, mat, tinted] = defs[k]
      return { k, geo, mat, tinted, items: lists[0][k], ref: { current: null } }
    })
    return { groups, mats, slots, phases }
  }, [people])

  // swap each person between the 4 precomputed poses; only changed people get rewritten
  const current = useRef(null)
  useFrame(({ clock }) => {
    const { groups, mats, slots, phases } = built
    if (!current.current || current.current.length !== slots.length) current.current = new Int8Array(slots.length)
    const cur = current.current
    const meshes = Object.fromEntries(groups.map((g) => [g.k, g.ref.current]))
    const dirty = new Set()
    const t = clock.elapsedTime
    for (let i = 0; i < slots.length; i++) {
      let pose = 0
      if (BRAWL.on) {
        const u = (t * 1.3 + phases[i]) % 1
        pose = u < 0.55 ? 1 : u < 0.72 ? 2 : 3
      }
      if (pose === cur[i]) continue
      cur[i] = pose
      for (const [k, j] of slots[i]) {
        const mesh = meshes[k]
        if (!mesh) continue
        mesh.instanceMatrix.array.set(mats[pose][k].subarray(j * 16, j * 16 + 16), j * 16)
        dirty.add(mesh)
      }
    }
    for (const m of dirty) m.instanceMatrix.needsUpdate = true
  })

  return built.groups.map((g) => <Bucket key={g.k} geo={g.geo} mat={g.mat} items={g.items} tinted={g.tinted} meshRef={g.ref} />)
}
