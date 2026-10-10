// Evans Hall, floor 1 (courtyard level). Same axes and footprint as layout.js; everything sits
// 5 m lower, so the floor is level with the Shen Courtyard lawn.
// Real spaces: Zhang Auditorium (350 seats), Bekenstein Atrium, Shen Courtyard. The dining commons,
// café, student commons and kitchen placement is a plausible guess, not from a floor plan.

import { BOUNDS, COURTYARD, EAST, H, STAIRS, arc, collideWith, inPoly, toColliders } from './layout.js'
import { rng } from './textures.js'

export const G = -5 // floor 1 level (floor 2 is at 0)
export const H1 = 4.6 // floor 1 ceiling height; the slab above runs from G + H1 up to 0
export const SPAWN1 = { x: -36, z: 0 } // just inside the main entrance, facing east

const TAU = Math.PI * 2
const { xMin, xMax, zMin, zMax } = BOUNDS

// ---------- Zhang Auditorium (south): stage on the courtyard side, seats rake up toward the south wall
export const AUD = {
  x0: -27,
  x1: 9,
  z0: 23.5, // north wall (doors at both front corners)
  z1: zMax,
  F: [-9, 24.5], // seating focus, center of the stage
  front: 27.5, // flat cross aisle in front of the first row
  stage: { x0: -18, x1: 0, z0: 23.7, z1: 26.2, h: 0.35 },
  A0: 6, // first riser starts this far from the focus
  STEP: 1.1,
  RISE: 0.2,
  NB: 11, // risers; the last one is the flat back landing
  FAN: 0.95, // seats fill +-0.95 rad of the fan
  AISLE: 0.42, // two radial aisles at +-0.42 rad
}
const bandA = (k) => AUD.A0 + (k - 1) * AUD.STEP

// ---------- courtyard doors (gaps in the glass) at the middle of each side
export const COURT_DOORS = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([sx, sz]) => {
  // the glass point straight out from the center on this side
  let best = null
  for (const p of COURTYARD) {
    if (p[0] * sx + p[1] * sz <= 0) continue
    if (!best || Math.abs(p[0] * sz - p[1] * sx) < Math.abs(best[0] * sz - best[1] * sx)) best = p
  }
  return { p: best, n: [-sx, -sz] } // n points from the door into the courtyard
})
const DOOR_HALF = 1.1
const nearCourtDoor = (p) => COURT_DOORS.some((d) => Math.hypot(p[0] - d.p[0], p[1] - d.p[1]) < DOOR_HALF)

// lawn furniture shared with World.jsx (trees + café tables were already drawn from floor 2)
export const COURT_TREES = [[-10, -9], [0, -11.5], [10, -8.5], [-12, 3], [12, 4], [-5, 11], [7, 11.5], [-2, 1]]
export const COURT_TABLES = (() => {
  const r = rng(4)
  return Array.from({ length: 14 }, () => {
    const a = r() * TAU
    return [Math.sin(a) * 12, Math.cos(a) * 14]
  })
})()
export const HAGRID = [-10.5, -2]

// ---------- walls: same format as layout.js WALLS, but y0 is absolute
export const WALLS1 = []
export const CHAIRS1 = [] // { x, y, z, rot } y absolute
export const AUD_SEATS = [] // auditorium seats (Yale blue), same shape as chairs
export const TABLES1 = [] // { x, z, w, d, h, round? }
export const PLANTS1 = []
const W = (a, b, mat, o = {}) =>
  WALLS1.push({ a, b, mat, h: o.h ?? H1, y0: G + (o.y0 ?? 0), t: o.t ?? 0.2, collide: o.collide ?? true })
const P = (pts, mat, o = {}) => {
  for (let i = 0; i < pts.length - 1; i++) W(pts[i], pts[i + 1], mat, o)
}
const dot = (p, t = 0.7) => W(p, [p[0] + 0.01, p[1]], 'none', { t })

// perimeter glass, with the main entrance on the west (Whitney Ave) side
export const ENTRANCE = { x: xMin, z0: -2.5, z1: 2.5 }
W([xMin, zMin], [xMin, ENTRANCE.z0], 'exterior')
W([xMin, ENTRANCE.z1], [xMin, zMax], 'exterior')
W([xMin, ENTRANCE.z0], [xMin, ENTRANCE.z1], 'none') // the doors are drawn, but you can't leave
W([xMin, zMin], [xMax, zMin], 'exterior')
W([xMin, zMax], [xMax, zMax], 'exterior')
W([xMax, zMin], [xMax, zMax], 'exterior')
// dark slab edge between floors 1 and 2
for (const [a, b] of [[[xMin, zMin], [xMin, zMax]], [[xMin, zMin], [xMax, zMin]], [[xMin, zMax], [xMax, zMax]], [[xMax, zMin], [xMax, zMax]]])
  W(a, b, 'dark', { y0: H1, h: -G - H1, collide: false })

// courtyard glass with four doors out to the lawn
for (let i = 0; i < COURTYARD.length; i++) {
  const a = COURTYARD[i]
  const b = COURTYARD[(i + 1) % COURTYARD.length]
  if (nearCourtDoor(a) || nearCourtDoor(b)) continue
  W(a, b, 'none', { t: 0.15 })
}

// stair cores go straight through both floors
for (const s of STAIRS) {
  const [cx, cz] = s.c
  const hw = s.w / 2
  const hd = s.d / 2
  P([[cx - hw, cz - hd], [cx + hw, cz - hd], [cx + hw, cz + hd], [cx - hw, cz + hd], [cx - hw, cz - hd]], 'white')
}

// ---------- Zhang Auditorium
{
  const { x0, x1, z0, z1, F, stage, NB, RISE, FAN, AISLE } = AUD
  const door = [[-26.6, -24.6], [6.6, 8.6]]
  W([x0, z0], [door[0][0], z0], 'slats')
  W([door[0][1], z0], [door[1][0], z0], 'slats')
  W([door[1][1], z0], [x1, z0], 'slats')
  for (const [a, b] of door) W([a, z0], [b, z0], 'slats', { y0: 2.5, h: H1 - 2.5, collide: false }) // header over each door
  W([x0, z0], [x0, z1], 'slats')
  W([x1, z0], [x1, z1], 'slats')
  // stage edge: you can hop up (0.35 m) but it reads as a platform
  AUD.doors = door
  // rows: seats on arcs around the focus, two radial aisles, rows step up toward the back
  for (let k = 1; k < NB; k++) {
    const r = bandA(k) + 0.55
    const y = G + k * RISE
    const step = 0.58 / r
    const aisleHalf = 0.7 / r
    const blocks = [[], [], []]
    for (let phi = -FAN; phi <= FAN + 1e-9; phi += step) {
      const x = F[0] + r * Math.sin(phi)
      const z = F[1] + r * Math.cos(phi)
      if (z < AUD.front + 0.6 || x < x0 + 1.2 || x > x1 - 1.2) continue
      if (Math.abs(Math.abs(phi) - AISLE) < aisleHalf) continue
      const b = phi < -AISLE ? 0 : phi > AISLE ? 2 : 1
      blocks[b].push({ x, z, phi })
    }
    for (const seats of blocks) {
      if (!seats.length) continue
      for (const s of seats) AUD_SEATS.push({ x: s.x, y, z: s.z, rot: s.phi }) // backs face away from the stage
      const a0 = seats[0].phi - 0.25 / r
      const a1 = seats[seats.length - 1].phi + 0.25 / r
      P(arc(F, r, r, a0, a1, Math.max(2, seats.length >> 1)), 'none', { t: 0.75 })
    }
  }
  // lectern on the stage
  dot([stage.x1 - 3, 25], 0.6)
}

// ---------- Dining Commons (north) + kitchen (northwest corner, staff only)
export const DINING = { x0: -28, x1: 20, z0: zMin, z1: -23.5, servery: { x0: -24, x1: 6, z: -44.8 } }
export const KITCHEN = { x0: xMin, x1: -28, z0: zMin, z1: -24 }
{
  W([KITCHEN.x1, KITCHEN.z0], [KITCHEN.x1, KITCHEN.z1], 'white')
  W([KITCHEN.x0, KITCHEN.z1], [KITCHEN.x1, KITCHEN.z1], 'white')
  const { x0, x1, z } = DINING.servery
  W([x0, z], [x1, z], 'steel', { h: 0.95, t: 0.9 })
  W([x0, z - 0.1], [x1, z - 0.1], 'meetGlass', { y0: 0.95, h: 0.45, t: 0.04, collide: false }) // sneeze guard
  W([x0 - 1, zMin + 0.15], [x1 + 1, zMin + 0.15], 'white', { collide: false }) // solid wall behind the servery
  W([x0, zMin + 0.55], [x1, zMin + 0.55], 'steel', { h: 0.95, t: 0.6 }) // back counter
  for (let x = -24.5; x <= 16; x += 3.6)
    for (let zz = -40.5; zz <= -27; zz += 3.3) {
      TABLES1.push({ x, z: zz, w: 1.6, d: 0.8, h: 0.75 })
      W([x - 0.8, zz], [x + 0.8, zz], 'none', { t: 1.05 })
      for (const dx of [-0.4, 0.4]) for (const dz of [-0.7, 0.7]) CHAIRS1.push({ x: x + dx, y: G, z: zz + dz, rot: dz > 0 ? 0 : Math.PI })
    }
}

// ---------- Bekenstein Atrium (west, main entrance): welcome desk, sofas
export const ATRIUM = { x0: xMin, x1: -28, z0: -24, z1: 24 }
{
  W([-32.5, -3], [-32.5, 3], 'desk', { h: 1.1, t: 0.8 })
  W([-38.6, -11], [-38.6, -7], 'orange', { h: 0.55, t: 0.9 })
  W([-38.6, 7], [-38.6, 11], 'orange', { h: 0.55, t: 0.9 })
  W([-36, -12.6], [-33, -12.6], 'leather', { h: 0.45, t: 0.7 })
  W([-36, 12.6], [-33, 12.6], 'leather', { h: 0.45, t: 0.7 })
  PLANTS1.push([-39.6, -4.2], [-39.6, 4.2], [-29, -20], [-29, 20])
}

// ---------- Café (east cloister, under the Beinecke Terrace Room)
export const CAFE = { x0: 20, x1: xMax, z0: -14, z1: 14, counter: { x: xMax - 1.2, z0: -6, z1: 6 } }
{
  const { counter } = CAFE
  W([xMax - 0.15, counter.z0 - 2], [xMax - 0.15, counter.z1 + 2], 'white', { collide: false }) // wall behind the coffee bar
  W([counter.x, counter.z0], [counter.x, counter.z1], 'desk', { h: 1.05, t: 0.8 })
  for (const z of [-11, -6.5, 6.5, 11]) {
    TABLES1.push({ x: 23.6, z, w: 0.9, d: 0.9, h: 1.05, round: true })
    dot([23.6, z], 1.1)
    for (const a of [0, TAU / 3, (2 * TAU) / 3]) CHAIRS1.push({ x: 23.6 + Math.sin(a) * 0.75, y: G, z: z + Math.cos(a) * 0.75, rot: a, stool: true })
  }
}

// ---------- Student Commons (southeast): sofas, ping-pong, a TV on the auditorium wall
export const COMMONS = { x0: AUD.x1, x1: xMax, z0: 28, z1: zMax, pingpong: [15, 38.5] }
{
  W([12, 30.5], [12, 35.5], 'orange', { h: 0.55, t: 0.9 })
  W([13.5, 45.5], [19.5, 45.5], 'orange', { h: 0.55, t: 0.9 })
  W([18, 30.5], [21, 30.5], 'leather', { h: 0.45, t: 0.7 })
  const [px, pz] = COMMONS.pingpong
  W([px - 1.37, pz], [px + 1.37, pz], 'none', { t: 1.6 })
  PLANTS1.push([10, 46.8], [21.5, 46.8])
}

// ---------- Zhang foyer (southwest): benches outside the auditorium
{
  W([-38.5, 28], [-38.5, 32], 'leather', { h: 0.45, t: 0.7 })
  W([-30, 36], [-30, 40], 'leather', { h: 0.45, t: 0.7 })
  PLANTS1.push([-28.2, 25], [-39.8, 39])
}

// ---------- details: fixtures, signage spots, and who is standing where
export const DETAIL = {
  // dining
  columns: [-19.1, -8.3, 2.5, 13.3].flatMap((x) => [-38.85, -32.25].map((z) => [x, z])),
  cooler: { x: 10, z: zMin + 0.55, w: 2.4, d: 0.8, h: 2.1 },
  bins: [[16.6, -24.4, '#2b2b2e'], [17.4, -24.4, '#2f6bff'], [18.2, -24.4, '#3f8f4a']],
  trays: [DINING.servery.x0 - 0.9, DINING.servery.z],
  // café (on the counter top)
  espresso: [CAFE.counter.x, -2.6],
  pastry: [CAFE.counter.x, 2.8],
  // atrium
  kiosk: [-30.2, 8.5],
  rugs: [[-37.2, -9, 3.6, 5], [-37.2, 9, 3.6, 5], [16.5, 33.5, 9, 5.5]],
  // auditorium
  booth: { x0: -12, x1: -6, z0: 46.2, z1: zMax - 0.1 },
  // commons
  foosball: [21.5, 37.2],
  vending: [[xMax - 0.55, 33.6], [xMax - 0.55, 34.9]],
  beanbags: [[11.2, 41], [11.6, 43.3], [13.4, 42.1]],
  // foyer: restroom doors on the auditorium's west wall, a water fountain
  restrooms: [31.5, 34.5],
  fountain: [AUD.x0 - 0.25, 38],
  // courtyard lamp posts (dropped if a café table is in the way)
  lamps: [[-15.5, -11.5], [15.5, -11.5], [-15.5, 11.5], [15.5, 11.5]].filter(
    (p) => !COURT_TABLES.some((t) => Math.hypot(t[0] - p[0], t[1] - p[1]) < 2),
  ),
}
for (const p of DETAIL.columns) dot(p, 0.6)
{
  const { cooler, bins, trays, kiosk, booth, foosball, vending, fountain, lamps } = DETAIL
  W([cooler.x - cooler.w / 2, cooler.z], [cooler.x + cooler.w / 2, cooler.z], 'none', { t: cooler.d })
  W([bins[0][0], bins[0][1]], [bins[2][0], bins[2][1]], 'none', { t: 0.7 })
  dot(trays, 0.6)
  dot(kiosk, 0.6)
  P([[booth.x0, booth.z1], [booth.x0, booth.z0], [booth.x1, booth.z0], [booth.x1, booth.z1]], 'none', { t: 0.2 })
  W([foosball[0] - 0.7, foosball[1]], [foosball[0] + 0.7, foosball[1]], 'none', { t: 0.9 })
  W([vending[0][0], vending[0][1] - 0.6], [vending[1][0], vending[1][1] + 0.6], 'none', { t: 0.9 })
  dot(fountain, 0.4)
  for (const p of lamps) dot(p, 0.35)
  for (const p of DETAIL.beanbags) dot(p, 0.8)
}

// courtyard lawn: tree trunks, café tables, Hagrid
for (const p of COURT_TREES) dot(p, 0.6)
for (const p of COURT_TABLES) dot(p, 1.3)
for (const p of COURT_TABLES) for (const s of [-1, 1]) CHAIRS1.push({ x: p[0] + s * 0.7, y: G, z: p[1], rot: s > 0 ? Math.PI / 2 : -Math.PI / 2 })
dot(HAGRID, 1.2)
for (const p of PLANTS1) dot(p)

export const COLLIDERS1 = toColliders(WALLS1)
export const collide1 = (pos) => collideWith(COLLIDERS1, pos)

const inRect = (x, z, r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1

// absolute floor height: the stage and the auditorium risers, flat everywhere else
export function floorAt1(x, z) {
  const { stage, F, A0, STEP, RISE, NB } = AUD
  if (inRect(x, z, stage)) return G + stage.h
  if (x > AUD.x0 && x < AUD.x1 && z > AUD.front && z < AUD.z1) {
    const d = Math.hypot(x - F[0], z - F[1])
    if (d < A0) return G
    return G + Math.min(Math.floor((d - A0) / STEP) + 1, NB) * RISE
  }
  return G
}

export function locate1(x, z) {
  if (inPoly(x, z, COURTYARD)) return 'Shen Courtyard'
  if (x > AUD.x0 && x < AUD.x1 && z > AUD.z0) return inRect(x, z, AUD.stage) ? 'Zhang Auditorium · on stage' : 'Zhang Auditorium'
  if (inRect(x, z, KITCHEN)) return 'Kitchen (staff only)'
  if (inRect(x, z, DINING)) return z < DINING.servery.z + 0.6 ? 'Dining Commons · servery' : 'Dining Commons'
  if (inRect(x, z, ATRIUM)) return Math.abs(z) < 6 && x < -31 ? 'Bekenstein Atrium · main entrance' : 'Bekenstein Atrium'
  if (x < AUD.x0 && z > 24) return 'Zhang Auditorium foyer'
  if (inRect(x, z, CAFE)) return 'Café'
  if (inRect(x, z, COMMONS)) return 'Student Commons'
  if (x > 20) return 'East corridor'
  return z < 0 ? 'North cloister · floor 1' : 'South cloister · floor 1'
}

// outline of auditorium riser k (k >= 1): the part of the seating area at least bandA(k) from the focus
export function audTierOutline(k, n = 96) {
  const { x0, x1, z1, F, front } = AUD
  const a = bandA(k)
  const phiC = Math.atan2(x1 - F[0], front - F[1]) // rays past the front corners miss the seating area
  const phiL = -Math.atan2(F[0] - x0, front - F[1])
  const phis = Array.from({ length: n + 1 }, (_, i) => phiL + ((phiC - phiL) * i) / n)
  phis.push(Math.atan2(x0 - F[0], z1 - F[1]), Math.atan2(x1 - F[0], z1 - F[1]))
  phis.sort((p, q) => p - q)
  const inner = []
  const outer = []
  for (const phi of phis) {
    const sx = Math.sin(phi)
    const cz = Math.cos(phi)
    if (cz <= 1e-6) continue
    const enter = (front - F[1]) / cz
    let exit = (z1 - F[1]) / cz
    if (sx > 1e-9) exit = Math.min(exit, (x1 - F[0]) / sx)
    if (sx < -1e-9) exit = Math.min(exit, (x0 - F[0]) / sx)
    const from = Math.max(a, enter)
    if (exit - from < 0.05) continue
    inner.push([F[0] + sx * from, F[1] + cz * from])
    outer.push([F[0] + sx * exit, F[1] + cz * exit])
  }
  return inner.length < 2 ? null : [...inner, ...outer.reverse()]
}

export { EAST, H }
