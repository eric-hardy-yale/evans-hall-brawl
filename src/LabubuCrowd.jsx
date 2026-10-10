import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BRAWL } from './brawl.js'
import { addAgent, removeAgent } from './brawlSim.js'
import { poseAt } from './brawlPoses.js'
import { splatTex } from './textures.js'
import * as THREE from 'three'
import { EXPRESSIONS, G, SKIN, YALE_BLUE, faceTex, furTex, shirtTex } from './Labubu.jsx'
import { CHAIRS, DRUMS } from './layout.js'

// ~30 seated Labubu students per classroom, drawn with a handful of instanced meshes
// (one per body part) so hundreds of them stay cheap. In brawl mode each one becomes a
// brawlSim agent and is re-posed every frame from animation cycles baked per outfit.
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

// ---------- parts: the same list, in the same order, for every pose of a given outfit
// pose = null → sitting in the chair; otherwise a standing pose from brawlPoses.poseAt.
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z)
const R = (x, y, z) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x, y, z))
const Sc = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z)

function partsFor(tpl, pose) {
  const out = []
  const add = (bucket, m, color, tag) => out.push({ bucket, m, color, tag })
  const { pants, shirtBucket, plainShirt } = tpl
  const legM = pants ? 0.078 : 0.07
  const body = pose ? mul(T(0, pose.bob, 0), R(pose.lean, 0, 0), Sc(1, pose.crouch, 1)) : new THREE.Matrix4()
  const at = (m) => mul(body, m)
  for (const x of [-0.085, 0.085]) {
    if (!pose) {
      add(pants ? 'cyl' : 'furCyl', M([x, 0.15, 0.12], [Math.PI / 2, 0, 0], [legM, 0.2, legM]), pants ? 'pants' : 'fur')
      add('skin', M([x, 0.17, 0.23], [0, 0, 0], [0.065, 0.09, 0.035]))
    } else {
      const hip = mul(T(x, 0.21, 0), R(x > 0 ? pose.legL : pose.legR, 0, 0))
      add(pants ? 'cyl' : 'furCyl', at(mul(hip, T(0, -0.09, 0), Sc(legM, 0.18, legM))), pants ? 'pants' : 'fur')
      add('skin', at(mul(hip, T(0, -0.18, 0.03), Sc(0.065, 0.035, 0.09))))
    }
  }
  add('fur', at(M([0, 0.34, 0], [0, 0, 0], [0.2, 0.23, 0.18])), 'fur')
  if (pants) add('cyl', at(M([0, 0.22, 0], [0, 0, 0], [0.19, 0.12, 0.17])), 'pants')
  if (shirtBucket) add(shirtBucket, at(M([0, 0.39, 0], [0, 0, 0], [0.207, 0.22, 0.188])), 'shirt')
  for (const side of [1, -1]) {
    const arm = pose ? (side > 0 ? pose.armL : pose.armR) : null
    const shoulder = at(pose ? mul(T(0.17 * side, 0.47, 0), R(arm[0], 0, arm[1])) : M([0.17 * side, 0.47, 0], [0.25, 0, 0.35 * side]))
    add('furLimb', mul(shoulder, M([0, -0.09, 0], [0, 0, 0], [0.045, 0.06, 0.045])), 'fur')
    if (shirtBucket) add(plainShirt ? 'cyl' : 'sleeve' + shirtBucket.slice(5), mul(shoulder, M([0, -0.04, 0], [0, 0, 0], [0.056, 0.07, 0.056])), plainShirt ? 'shirt' : null)
    add('skin', mul(shoulder, M([0, -0.18, 0.01], [0, 0, 0], [0.04, 0.045, 0.035])))
    if (side < 0) {
      add('dark', mul(shoulder, M([0, -0.21, 0.02], [0, 0, 0], [0.024, 0.07, 0.024])), null, 'knife')
      add('blade', mul(shoulder, M([0, -0.32, 0.02], [0, 0, 0], [0.012, 0.15, 0.032])), null, 'knife')
    }
  }
  const head = at(M([0, 0.7, 0]))
  add('fur', mul(head, M([0, 0, 0], [0, 0, 0], [0.27, 0.25, 0.25])), 'fur')
  add('face', mul(head, M([0, -0.02, 0.012], [0, 0, 0], [0.245, 0.235, 0.255])))
  for (const side of [-1, 1]) {
    const ear = mul(head, M([0.115 * side, 0.27, -0.02], [0, 0, -0.14 * side]))
    add('fur', mul(ear, M([0, 0, 0], [0, 0, 0], [0.075, 0.17, 0.05])), 'fur')
    add('skin', mul(ear, M([0, -0.01, 0.03], [0, 0, 0], [0.042, 0.12, 0.025])))
    add('dark', mul(ear, M([0, -0.02, 0.05], [0, 0, 0], [0.012, 0.055, 0.008])))
  }
  // splatter decals (shown as the agent gets bloodier): chest, belly, face
  add('splat', at(M([0.05, 0.42, 0.195], [0, 0, 0.6], [0.2, 0.2, 1])), null, 'blood0')
  add('splat', at(M([-0.07, 0.28, 0.185], [0, 0, 2.2], [0.16, 0.16, 1])), null, 'blood1')
  add('splat', mul(head, M([-0.07, -0.04, 0.262], [0, 0, 4.1], [0.13, 0.13, 1])), null, 'blood2')
  return out
}

// baked frames per animation; more frames for faster motion so it stays smooth
const FRAMES = { idle: 8, walk: 20, run: 20, stab: 32, cower: 10, down: 16 }
const templateCache = new Map()
function template(person) {
  const shirtBucket = person.shirt === 'yale' ? 'shirtYale' : person.shirt === 'stripes' ? 'shirtStripes' : person.shirt === 'plain' ? 'shirtPlain' : null
  const tpl = { pants: !!person.pants, shirtBucket, plainShirt: person.shirt === 'plain' }
  const key = `${tpl.pants}-${shirtBucket}`
  if (!templateCache.has(key)) {
    const sit = partsFor(tpl, null)
    const anims = Object.fromEntries(
      Object.entries(FRAMES).map(([anim, n]) => [anim, Array.from({ length: n }, (_, i) => partsFor(tpl, poseAt(anim, i / n)).map((p) => p.m))]),
    )
    templateCache.set(key, { parts: sit, sit: sit.map((p) => p.m), anims })
  }
  return templateCache.get(key)
}

function buckets() {
  const std = (o) => new THREE.MeshStandardMaterial(o)
  const furM = std({ color: '#ffffff', map: furTex(), bumpMap: furTex(), bumpScale: 2, roughness: 1 })
  const plain = std({ color: '#ffffff', roughness: 0.85 })
  const sleeveGeo = G.cyl
  const splatGeo = new THREE.PlaneGeometry(1, 1)
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
    splat: [splatGeo, std({ map: splatTex(9), transparent: true, alphaTest: 0.35, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }), false],
  }
  for (const e of EXPRESSIONS) b['face-' + e] = [G.face, std({ map: faceTex(e), roughness: 0.5 }), false]
  return b
}

function Bucket({ geo, mat, count, colors, meshRef }) {
  useLayoutEffect(() => {
    if (!colors) return
    const c = new THREE.Color()
    colors.forEach((col, i) => meshRef.current.setColorAt(i, c.set(col || '#ffffff')))
    meshRef.current.instanceColor.needsUpdate = true
  }, [colors, meshRef])
  return <instancedMesh ref={meshRef} args={[geo, mat, count]} frustumCulled={false} />
}

const ROOT = new THREE.Matrix4()
const TMP = new THREE.Matrix4()
const ZERO = new Float32Array(16)
const QY = new THREE.Quaternion()
const UP = new THREE.Vector3(0, 1, 0)

export default function LabubuCrowd({ people = STUDENTS }) {
  const built = useMemo(() => {
    const defs = buckets()
    const counts = Object.fromEntries(Object.keys(defs).map((k) => [k, 0]))
    const colors = Object.fromEntries(Object.keys(defs).map((k) => [k, []]))
    const persons = people.map((s) => {
      const tpl = template(s)
      const slots = tpl.parts.map((p) => {
        const bucket = p.bucket === 'face' ? 'face-' + s.expression : p.bucket
        const color = p.color === 'fur' ? s.fur : p.color === 'pants' ? s.pants : p.color === 'shirt' ? s.shirtColor : undefined
        colors[bucket].push(color)
        return { bucket, index: counts[bucket]++, tag: p.tag }
      })
      return { s, tpl, slots }
    })
    const groups = Object.keys(defs)
      .filter((k) => counts[k])
      .map((k) => ({ k, geo: defs[k][0], mat: defs[k][1], count: counts[k], colors: defs[k][2] ? colors[k] : null, ref: { current: null } }))
    return { persons, groups }
  }, [people])

  // one brawl agent per person, starting from their seat
  useEffect(() => {
    const agents = built.persons.map(({ s }) => {
      const level = s.floorY < -2.5 ? 1 : 2
      return addAgent({ x: s.x, y: s.floorY, z: s.z, yaw: s.rot, level })
    })
    built.persons.forEach((p, i) => (p.agent = agents[i]))
    return () => agents.forEach(removeAgent)
  }, [built])

  const seated = useRef(false)
  useFrame(() => {
    const { persons, groups } = built
    if (!BRAWL.on && seated.current) return
    const arrays = Object.fromEntries(groups.map((g) => [g.k, g.ref.current?.instanceMatrix.array]))
    for (const { s, tpl, slots, agent: a } of persons) {
      let frame
      if (BRAWL.on && a) {
        const anim = tpl.anims[a.anim] || tpl.anims.idle
        frame = anim[Math.min(anim.length - 1, Math.floor(a.phase * anim.length))]
        QY.setFromAxisAngle(UP, a.yaw)
        ROOT.compose(V.set(a.x, a.y, a.z), QY, S.set(HEIGHT, HEIGHT, HEIGHT))
      } else {
        frame = tpl.sit
        ROOT.compose(V.set(s.x, s.y, s.z), QY.setFromAxisAngle(UP, s.rot), S.set(HEIGHT, HEIGHT, HEIGHT))
      }
      const armed = BRAWL.on && a?.armed
      const blood = BRAWL.on && a ? a.blood : 0
      for (let j = 0; j < slots.length; j++) {
        const { bucket, index, tag } = slots[j]
        const arr = arrays[bucket]
        if (!arr) continue
        const hidden = (tag === 'knife' && !armed) || (tag && tag.startsWith('blood') && blood <= +tag[5])
        if (hidden) arr.set(ZERO, index * 16)
        else TMP.multiplyMatrices(ROOT, frame[j]).toArray(arr, index * 16)
      }
    }
    for (const g of groups) if (g.ref.current) g.ref.current.instanceMatrix.needsUpdate = true
    seated.current = !BRAWL.on
  })

  return built.groups.map((g) => <Bucket key={g.k} geo={g.geo} mat={g.mat} count={g.count} colors={g.colors} meshRef={g.ref} />)
}
