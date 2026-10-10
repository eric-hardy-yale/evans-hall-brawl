// Brawl simulation: when brawl mode turns on, every Labubu stands up and becomes an agent.
// Hunters carry knives and chase the nearest victim; runners wander until a hunter gets close,
// then sprint away (some fight back when caught). A catch turns into a short knife fight that
// leaves splatter on the victim and the floor. Three accepted (unparried) stabs and the victim is
// down: they fall on their back in a pool of blood for at least 10 s, then get up and run.
// Otherwise the victim breaks free when the fight ends and the hunter moves on.
// Agents stay on their own floor and use that floor's walls and step heights (levels.js).
import { MAX_STEP, R_PLAYER } from './layout.js'
import { LEVELS } from './levels.js'
import { BRAWL } from './brawl.js'
import { CYCLE, STAB_HIT } from './brawlPoses.js'

export const AGENTS = new Set()
let nextId = 1

const HUNTER_SHARE = 0.35
const FIGHT_BACK_SHARE = 0.3
const SPEED = { walk: 1.25, run: 3.9, flee: 4.3 }
const SIGHT = 14 // hunters notice victims this far away
const PANIC = 7.5 // runners bolt when a hunter is this close
const REACH = 0.8 // close enough to stab
const FIGHT_TIME = 2.6
const STAB_RATE = 1.15 // stab cycles per second
const STABS_TO_DROP = 3 // accepted stabs before a Labubu goes down
const PARRY = 0.45 // chance a victim who fights back blocks a stab
const DOWN_TIME = [10, 15] // seconds on the ground (min, max)
const FALL_TIME = 0.6
const RISE_TIME = 1.0

const hash = (n, k) => {
  const x = Math.sin(n * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}

// home = { x, y, z, yaw, level } where the figure sits/stands when brawl is off
export function addAgent(home) {
  const id = nextId++
  const a = {
    id,
    home,
    role: hash(id, 1) < HUNTER_SHARE ? 'hunter' : 'runner',
    fightsBack: hash(id, 2) < FIGHT_BACK_SHARE,
    walkSpeed: SPEED.walk * (0.8 + hash(id, 3) * 0.4),
    runSpeed: (hash(id, 1) < HUNTER_SHARE ? SPEED.run : SPEED.flee) * (0.85 + hash(id, 4) * 0.3),
    x: home.x,
    y: home.y,
    z: home.z,
    yaw: home.yaw,
    level: home.level,
    vx: 0,
    vz: 0,
    state: 'home',
    desired: [0, 0],
    unstick: 0,
    unstickTurn: 0,
    stuck: 0,
    anim: 'idle',
    phase: hash(id, 5),
    blood: 0,
    armed: false,
  }
  AGENTS.add(a)
  return a
}
export const removeAgent = (a) => AGENTS.delete(a)

// ---------- ground splatter: a ring buffer the renderer redraws when `version` changes
export const SPLATS = { list: [], next: 0, version: 0, max: 600 }
function splat(x, y, z, size = 1) {
  const s = { x, y, z, rot: Math.random() * Math.PI * 2, size: size * (0.55 + Math.random() * 0.6), variant: Math.floor(Math.random() * 4) }
  if (SPLATS.list.length < SPLATS.max) SPLATS.list.push(s)
  else SPLATS.list[SPLATS.next] = s
  SPLATS.next = (SPLATS.next + 1) % SPLATS.max
  SPLATS.version++
}

// ---------- walls bucketed into a grid per floor, so each agent only tests nearby walls
const WCELL = 3
const wallGrid = { 1: null, 2: null }
function wallsFor(level) {
  if (wallGrid[level]) return wallGrid[level]
  const g = new Map()
  for (const w of LEVELS[level].colliders) {
    const m = R_PLAYER + w.t / 2
    for (let cx = Math.floor((w.minx - m) / WCELL); cx <= Math.floor((w.maxx + m) / WCELL); cx++)
      for (let cz = Math.floor((w.minz - m) / WCELL); cz <= Math.floor((w.maxz + m) / WCELL); cz++) {
        const k = cx * 100000 + cz
        if (!g.has(k)) g.set(k, [])
        g.get(k).push(w)
      }
  }
  return (wallGrid[level] = g)
}
// same push-out as layout.collideWith, against only the walls in this cell
function collideNear(level, pos) {
  const list = wallsFor(level).get(Math.floor(pos.x / WCELL) * 100000 + Math.floor(pos.z / WCELL))
  if (!list) return pos
  for (let it = 0; it < 2; it++)
    for (const s of list) {
      const rr = R_PLAYER + s.t / 2
      if (pos.x < s.minx - rr || pos.x > s.maxx + rr || pos.z < s.minz - rr || pos.z > s.maxz + rr) continue
      const dx = s.b[0] - s.a[0]
      const dz = s.b[1] - s.a[1]
      const l2 = dx * dx + dz * dz
      let u = l2 > 0 ? ((pos.x - s.a[0]) * dx + (pos.z - s.a[1]) * dz) / l2 : 0
      u = Math.max(0, Math.min(1, u))
      const ex = pos.x - (s.a[0] + dx * u)
      const ez = pos.z - (s.a[1] + dz * u)
      const d = Math.hypot(ex, ez)
      if (d < rr && d > 1e-6) {
        pos.x += (ex / d) * (rr - d)
        pos.z += (ez / d) * (rr - d)
      }
    }
  return pos
}

// ---------- spatial grid for neighbor queries
const CELL = 4
let grid = new Map()
const key = (lvl, cx, cz) => lvl * 1e8 + cx * 10000 + cz
function buildGrid() {
  grid = new Map()
  for (const a of AGENTS) {
    const k = key(a.level, Math.floor(a.x / CELL), Math.floor(a.z / CELL))
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k).push(a)
  }
}
function near(a, r, fn) {
  const c0 = Math.floor((a.x - r) / CELL)
  const c1 = Math.floor((a.x + r) / CELL)
  const d0 = Math.floor((a.z - r) / CELL)
  const d1 = Math.floor((a.z + r) / CELL)
  for (let cx = c0; cx <= c1; cx++)
    for (let cz = d0; cz <= d1; cz++) {
      const list = grid.get(key(a.level, cx, cz))
      if (!list) continue
      for (const b of list) {
        if (b === a) continue
        const d = Math.hypot(b.x - a.x, b.z - a.z)
        if (d < r) fn(b, d)
      }
    }
}

function reset(a, on) {
  Object.assign(a, { x: a.home.x, y: a.home.y, z: a.home.z, yaw: a.home.yaw, vx: 0, vz: 0, blood: 0, hits: 0, target: null, threat: null, ignore: null })
  a.armed = on && (a.role === 'hunter' || a.fightsBack)
  a.state = !on ? 'home' : a.role === 'hunter' ? 'seek' : 'wander'
  a.timer = Math.random() * 1.5
  a.heading = a.home.yaw
  a.stuck = 0
  a.unstick = 0
  a.unstickTurn = 0
  a.strolling = false
  a.anim = 'idle'
}

let wasOn = false
export function stepBrawl(dt, t) {
  if (BRAWL.on !== wasOn) {
    wasOn = BRAWL.on
    for (const a of AGENTS) reset(a, BRAWL.on)
    if (!BRAWL.on) {
      SPLATS.list = []
      SPLATS.next = 0
      SPLATS.version++
    }
  }
  if (!BRAWL.on) return
  buildGrid()
  for (const a of AGENTS) think(a, dt, t)
  for (const a of AGENTS) move(a, dt)
}

function startFight(h, v) {
  h.faceYaw = Math.atan2(v.x - h.x, v.z - h.z)
  v.faceYaw = Math.atan2(h.x - v.x, h.z - v.z)
  h.state = 'fight'
  h.target = v
  h.timer = FIGHT_TIME
  v.state = v.fightsBack ? 'fight' : 'caught'
  v.target = h
  v.timer = FIGHT_TIME
  v.threat = h
}

// three accepted stabs: fall on your back in a pool of blood
function knockDown(v, by) {
  const partner = v.target
  v.state = 'down'
  v.timer = DOWN_TIME[0] + Math.random() * (DOWN_TIME[1] - DOWN_TIME[0])
  v.phase = 0
  v.target = null
  v.threat = by
  v.vx = 0
  v.vz = 0
  // the body ends up lying behind where they stood, so the pool goes there
  splat(v.x - Math.sin(v.yaw) * 0.45, v.y, v.z - Math.cos(v.yaw) * 0.45, 2.4)
  splat(v.x - Math.sin(v.yaw) * 0.2 + (Math.random() - 0.5) * 0.4, v.y, v.z - Math.cos(v.yaw) * 0.2, 1.3)
  if (partner && partner.target === v) {
    if (partner.role === 'hunter' && partner.state === 'fight') endFight(partner)
    else {
      partner.state = 'flee' // a runner who just dropped their hunter bolts
      partner.timer = 3
      partner.target = null
    }
  }
}

function endFight(h) {
  const v = h.target
  h.state = 'seek'
  h.timer = 1.2 + Math.random()
  h.ignore = v
  h.ignoreT = 6
  h.target = null
  if (v && (v.state === 'caught' || v.state === 'fight') && v.target === h) {
    v.state = 'flee'
    v.timer = 3.5
    v.threat = h
    v.target = null
  }
}

function think(a, dt, t) {
  a.desired = [0, 0]
  if (a.ignoreT > 0) a.ignoreT -= dt
  const toward = (b, speed) => {
    const dx = b.x - a.x
    const dz = b.z - a.z
    const d = Math.hypot(dx, dz) || 1
    a.desired = [(dx / d) * speed, (dz / d) * speed]
    return d
  }

  if (a.state === 'down') {
    a.phase = Math.min(1, a.phase + dt / FALL_TIME)
    if ((a.timer -= dt) <= 0) a.state = 'rising'
    return
  }
  if (a.state === 'rising') {
    a.phase -= dt / RISE_TIME
    if (a.phase <= 0) {
      a.phase = 0
      a.hits = 0
      if (a.role === 'hunter') {
        a.state = 'seek'
        a.timer = 1
      } else {
        a.state = 'flee'
        a.timer = 3
      }
    }
    return
  }

  if (a.state === 'fight' || a.state === 'caught') {
    const b = a.target
    if (!b || !AGENTS.has(b) || b.state === 'down' || b.state === 'rising') return a.role === 'hunter' ? endFight(a) : void (a.state = 'flee')
    a.faceYaw = Math.atan2(b.x - a.x, b.z - a.z)
    // keep a little distance so the two don't overlap
    const d = Math.hypot(b.x - a.x, b.z - a.z)
    if (d > REACH * 1.4) toward(b, a.walkSpeed)
    if (a.state === 'fight') {
      const before = a.phase
      a.phase = (a.phase + dt * STAB_RATE) % 1
      const crossed = before < STAB_HIT ? a.phase >= STAB_HIT || a.phase < before : a.phase >= STAB_HIT && a.phase < before
      // a stab only counts if it isn't parried (cowering victims can't parry)
      if (crossed && !(b.state === 'fight' && Math.random() < PARRY)) {
        b.blood = Math.min(3, b.blood + 1)
        b.hits = (b.hits || 0) + 1
        const k = 0.35 + Math.random() * 0.3
        splat(b.x + (b.x - a.x) * k, b.y, b.z + (b.z - a.z) * k, 0.8 + b.blood * 0.25)
        if (b.hits >= STABS_TO_DROP) return knockDown(b, a)
      }
    } else a.phase = (a.phase + dt * 2.2) % 1
    if (a.role === 'hunter' && (a.timer -= dt) <= 0) endFight(a)
    return
  }

  if (a.role === 'hunter') {
    if (a.state === 'chase') {
      const b = a.target
      a.chaseT += dt
      if (!b || !AGENTS.has(b) || b.level !== a.level || a.chaseT > 12 || (b.state !== 'flee' && b.state !== 'wander')) {
        a.ignore = b
        a.ignoreT = 5
        a.state = 'seek'
        a.timer = 0.5
        return
      }
      const d = toward(b, a.runSpeed)
      if (d < REACH) startFight(a, b)
      return
    }
    // seek: prowl around, then lock onto the nearest free victim in sight
    if ((a.timer -= dt) <= 0) {
      let best = null
      let bd = SIGHT
      near(a, SIGHT, (b, d) => {
        if (b === a.ignore && a.ignoreT > 0) return
        if (b.state !== 'wander' && b.state !== 'flee') return
        const score = b.role === 'hunter' ? d * 2.5 : d // prefer runners
        if (score < bd) {
          bd = score
          best = b
        }
      })
      if (best) {
        a.state = 'chase'
        a.target = best
        a.chaseT = 0
        return
      }
      a.timer = 0.6 + Math.random() * 0.8
      a.heading += (Math.random() - 0.5) * 2
    }
    a.desired = [Math.sin(a.heading) * a.walkSpeed * 1.2, Math.cos(a.heading) * a.walkSpeed * 1.2]
    return
  }

  // runners: run from every hunter that's close, weighted by how close
  let ax = 0
  let az = 0
  let threat = false
  near(a, PANIC, (b, d) => {
    if (b.role !== 'hunter' || b.state === 'down' || b.state === 'rising') return
    const w = (PANIC - d) / PANIC + (b.target === a ? 1 : 0)
    ax += ((a.x - b.x) / (d || 1)) * w
    az += ((a.z - b.z) / (d || 1)) * w
    threat = true
  })
  if (threat) {
    a.state = 'flee'
    a.timer = 2
  }
  if (a.state === 'flee') {
    a.timer -= dt
    if (!threat && a.threat) {
      const d = Math.hypot(a.threat.x - a.x, a.threat.z - a.z)
      ax = (a.x - a.threat.x) / (d || 1)
      az = (a.z - a.threat.z) / (d || 1)
    }
    const l = Math.hypot(ax, az)
    if (l > 1e-3) a.heading = Math.atan2(ax, az)
    if (a.timer <= 0 && !threat) {
      a.state = 'wander'
      a.timer = 1
    }
    const h = a.heading + a.unstickTurn * (a.unstick > 0 ? 1 : 0)
    a.desired = [Math.sin(h) * a.runSpeed, Math.cos(h) * a.runSpeed]
    return
  }
  // wander: stroll, pause, look around
  if ((a.timer -= dt) <= 0) {
    a.timer = 1.5 + Math.random() * 3
    a.strolling = Math.random() < 0.65
    a.heading += (Math.random() - 0.5) * 2.5
  }
  if (a.strolling) a.desired = [Math.sin(a.heading) * a.walkSpeed, Math.cos(a.heading) * a.walkSpeed]
}

function move(a, dt) {
  const L = LEVELS[a.level]
  // ease velocity toward what the agent wants (no instant starts/stops)
  const acc = Math.min(1, dt * 7)
  let [dx, dz] = a.desired
  if (a.unstick > 0 && a.state !== 'flee') {
    const c = Math.cos(a.unstickTurn)
    const s = Math.sin(a.unstickTurn)
    ;[dx, dz] = [dx * c + dz * s, -dx * s + dz * c]
  }
  a.vx += (dx - a.vx) * acc
  a.vz += (dz - a.vz) * acc
  if (a.state === 'down' || a.state === 'rising') a.vx = a.vz = 0 // bodies on the ground stay put
  const speed = Math.hypot(a.vx, a.vz)
  const ox = a.x
  const oz = a.z
  if (speed > 0.02) {
    const pos = { x: a.x + a.vx * dt, z: a.z + a.vz * dt }
    // personal space
    near(a, 0.6, (b, d) => {
      const push = (0.6 - d) * 0.5
      pos.x += ((a.x - b.x) / (d || 1)) * push
      pos.z += ((a.z - b.z) / (d || 1)) * push
    })
    collideNear(a.level, pos)
    const cur = L.floorAt(a.x, a.z)
    if (L.floorAt(pos.x, pos.z) - cur <= MAX_STEP) {
      a.x = pos.x
      a.z = pos.z
    } else if (L.floorAt(pos.x, a.z) - cur <= MAX_STEP) a.x = pos.x
    else if (L.floorAt(a.x, pos.z) - cur <= MAX_STEP) a.z = pos.z
  }
  // stuck against a wall: turn for a moment
  const moved = Math.hypot(a.x - ox, a.z - oz)
  if (speed > 0.6 && moved < speed * dt * 0.3) a.stuck += dt
  else a.stuck = Math.max(0, a.stuck - dt)
  if (a.unstick > 0) a.unstick -= dt
  if (a.stuck > 0.35) {
    a.stuck = 0
    a.unstick = 0.7 + Math.random() * 0.6
    a.unstickTurn = (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2 + Math.random() * 0.6)
    a.heading += a.unstickTurn * 0.5
  }
  const fy = L.floorAt(a.x, a.z)
  a.y += (fy - a.y) * Math.min(1, dt * 12)

  // face where you're going (or your opponent), turning smoothly
  const lying = a.state === 'down' || a.state === 'rising'
  const want = lying ? a.yaw : (a.state === 'fight' || a.state === 'caught') && a.faceYaw !== undefined ? a.faceYaw : speed > 0.25 ? Math.atan2(a.vx, a.vz) : a.yaw
  let diff = want - a.yaw
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  a.yaw += diff * Math.min(1, dt * 9)

  // animation state + phase (down/rising phase is the fall progress, set in think)
  if (a.state === 'down' || a.state === 'rising') a.anim = 'down'
  else if (a.state === 'fight') a.anim = 'stab'
  else if (a.state === 'caught') a.anim = 'cower'
  else if (speed > 2.2) a.anim = 'run'
  else if (speed > 0.25) a.anim = 'walk'
  else a.anim = 'idle'
  if (a.anim === 'run' || a.anim === 'walk') a.phase = (a.phase + (speed * dt) / CYCLE[a.anim]) % 1
  else if (a.anim === 'idle') a.phase = (a.phase + dt * 0.5) % 1
}
