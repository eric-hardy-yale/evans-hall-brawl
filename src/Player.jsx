import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { EYE, MAX_STEP, SPAWN } from './layout.js'
import { LEVELS, STAIR_DOORS, STAIR_TRIGGER_R } from './levels.js'
import { TALKABLES } from './talk.js'

const CROUCH_EYE = 1.05
const JUMP_SPEED = 4.2
const GRAVITY = 12
const LOOK_SPEED = 0.005 // radians per touch pixel

// PC controls work like a shooter: WASD move, mouse look, Shift sprint, Space jump, C crouch.
// Touch controls come in through touchRef: { active, move: [x, y], look: [dx, dy], jump }.
// Floors: walk into a stairwell opening, press 1 / 2, or set floorReq.current (the on-screen button).
// Talking: aim the crosshair at an AI avatar (talk.js) within 8 m and click; onHover/onTalk report it.
export default function Player({ lockRef, mapRef, touchRef, floorReq, onLock, onWhere, onLevel, onHover, onTalk }) {
  const { camera, gl } = useThree()
  const controls = useMemo(() => new PointerLockControls(camera, gl.domElement), [camera, gl])
  const keys = useRef({})
  const where = useRef('')
  const eye = useRef(EYE)
  const floorY = useRef(0)
  const level = useRef(2)
  const stairArmed = useRef(true) // must step away from a stair opening before it can trigger again
  const devY = useRef(null) // dev teleport can pin the camera height
  const jumpY = useRef(0)
  const vy = useRef(0)
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const ray = useMemo(() => {
    const r = new THREE.Raycaster()
    r.far = 8
    return r
  }, [])
  const center = useMemo(() => new THREE.Vector2(0, 0), [])
  const hover = useRef(null)
  const frameN = useRef(0)
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])

  useEffect(() => {
    camera.position.set(SPAWN.x, EYE, SPAWN.z)
    camera.rotation.set(0, 0, 0)
    lockRef.current = () => controls.lock()
    lockRef.unlock = () => controls.unlock()
    const on = () => onLock(true)
    const off = () => {
      keys.current = {} // keys held during Esc never get a keyup
      onLock(false)
    }
    controls.addEventListener('lock', on)
    controls.addEventListener('unlock', off)
    const typing = (e) => e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
    const down = (e) => {
      if (typing(e)) return // keys typed in the chat box don't move you
      keys.current[e.code] = true
      if (e.code === 'Space') e.preventDefault()
      if (e.code === 'Digit1' || e.code === 'Numpad1') floorReq.current = 1
      if (e.code === 'Digit2' || e.code === 'Numpad2') floorReq.current = 2
    }
    const up = (e) => (keys.current[e.code] = false)
    // click while aiming at someone (mouse locked) opens the chat
    const click = (e) => {
      if (e.button === 0 && controls.isLocked && hover.current) onTalk(hover.current)
    }
    window.addEventListener('mousedown', click)
    const blur = () => (keys.current = {})
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      controls.removeEventListener('lock', on)
      controls.removeEventListener('unlock', off)
      controls.dispose()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      window.removeEventListener('mousedown', click)
    }
  }, [camera, controls, lockRef, onLock, floorReq, onTalk])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    // dev only: teleport for screenshots by setting <body data-go="[x, z, yawDeg]">
    if (import.meta.env.DEV && document.body.dataset.go) {
      const [x, z, yaw, pitch = 0, y = null, lvl = level.current] = JSON.parse(document.body.dataset.go)
      devY.current = y
      delete document.body.dataset.go
      setLevel(lvl)
      camera.position.set(x, EYE, z)
      camera.rotation.set(pitch, (yaw * Math.PI) / 180, 0, 'YXZ')
      floorY.current = LEVELS[lvl].floorAt(x, z)
    }

    // change floors: a requested floor goes via the nearest stairwell
    if (floorReq.current && floorReq.current !== level.current) {
      takeStairs(nearestStair(camera.position.x, camera.position.z), floorReq.current)
    }
    floorReq.current = null
    const L = LEVELS[level.current]
    const touch = touchRef.current
    const active = controls.isLocked || touch.active

    // touch look: drag on the right side of the screen
    if (touch.active && (touch.look[0] || touch.look[1])) {
      euler.setFromQuaternion(camera.quaternion)
      euler.y -= touch.look[0] * LOOK_SPEED
      euler.x = Math.max(-1.45, Math.min(1.45, euler.x - touch.look[1] * LOOK_SPEED))
      camera.quaternion.setFromEuler(euler)
    }
    touch.look[0] = 0
    touch.look[1] = 0

    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()

    const k = keys.current
    let f = 0
    let s = 0
    let sprint = false
    if (active) {
      f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0)
      s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)
      sprint = k.ShiftLeft || k.ShiftRight
    }
    if (touch.active && (touch.move[0] || touch.move[1])) {
      f = -touch.move[1]
      s = touch.move[0]
      sprint = Math.hypot(f, s) > 0.95 // push the stick all the way to hurry
    }
    let mx = fwd.x * f - fwd.z * s
    let mz = fwd.z * f + fwd.x * s
    const l = Math.hypot(mx, mz)
    if (l > 0.05) {
      if (l > 1) {
        mx /= l
        mz /= l
      }
      const crouching = active && k.KeyC
      const speed = crouching ? 2.4 : sprint ? 9.5 : 5.5 // m/s; brisk walk, sprint is a jog
      const pos = { x: camera.position.x + mx * speed * dt, z: camera.position.z + mz * speed * dt }
      L.collide(pos)
      // risers: walk up one step at a time; anything taller acts like a wall
      const cur = L.floorAt(camera.position.x, camera.position.z)
      if (L.floorAt(pos.x, pos.z) - cur <= MAX_STEP) {
        camera.position.x = pos.x
        camera.position.z = pos.z
      } else if (L.floorAt(pos.x, camera.position.z) - cur <= MAX_STEP) {
        camera.position.x = pos.x // slide along the edge
      } else if (L.floorAt(camera.position.x, pos.z) - cur <= MAX_STEP) {
        camera.position.z = pos.z
      }
    }

    // stairwells: walking into an opening takes you to the other floor
    const near = STAIR_DOORS.find((d) => Math.hypot(camera.position.x - d.trigger[0], camera.position.z - d.trigger[1]) < STAIR_TRIGGER_R)
    if (near && stairArmed.current) takeStairs(near, level.current === 2 ? 1 : 2)
    else if (!near) stairArmed.current = true

    // jump + crouch
    const wantJump = (active && k.Space) || touch.jump
    touch.jump = false
    if (active && wantJump && jumpY.current === 0) vy.current = JUMP_SPEED
    vy.current -= GRAVITY * dt
    jumpY.current = Math.max(0, jumpY.current + vy.current * dt)
    if (jumpY.current === 0) vy.current = 0
    const eyeTarget = active && k.KeyC ? CROUCH_EYE : EYE
    eye.current += (eyeTarget - eye.current) * Math.min(1, dt * 12)
    const fy = LEVELS[level.current].floorAt(camera.position.x, camera.position.z)
    floorY.current += (fy - floorY.current) * Math.min(1, dt * 14) // smooth step up/down
    camera.position.y = devY.current ?? floorY.current + eye.current + jumpY.current

    // who's under the crosshair? (every ~6 frames)
    if (++frameN.current % 6 === 0) {
      let id = null
      if (TALKABLES.size) {
        ray.setFromCamera(center, camera)
        const hit = ray.intersectObjects([...TALKABLES], true)[0]
        for (let o = hit?.object; o; o = o.parent)
          if (o.userData.talkId) {
            id = o.userData.talkId
            break
          }
      }
      if (id !== hover.current) {
        hover.current = id
        onHover(id)
      }
    }
    // dev helper: document.body.dataset.talk = "zaman" opens the chat without pointer lock
    if (import.meta.env.DEV && document.body.dataset.talk) {
      const id = document.body.dataset.talk
      delete document.body.dataset.talk
      onTalk(id)
    }

    if (import.meta.env.DEV) document.body.dataset.pos = `${camera.position.x.toFixed(2)},${camera.position.z.toFixed(2)},${fwd.x.toFixed(2)},${fwd.z.toFixed(2)}|${touch.move.map((v) => v.toFixed(2))}`
    mapRef.current?.(camera.position.x, camera.position.z, fwd.x, fwd.z)
    const w = LEVELS[level.current].locate(camera.position.x, camera.position.z)
    if (w !== where.current) {
      where.current = w
      onWhere(w)
    }
  })

  function setLevel(lvl) {
    if (lvl === level.current) return
    level.current = lvl
    onLevel(lvl)
  }

  function nearestStair(x, z) {
    let best = STAIR_DOORS[0]
    for (const d of STAIR_DOORS) if (Math.hypot(x - d.exit[0], z - d.exit[1]) < Math.hypot(x - best.exit[0], z - best.exit[1])) best = d
    return best
  }

  // step out of stairwell `door` on floor `lvl`, looking away from the stairs
  function takeStairs(door, lvl) {
    setLevel(lvl)
    const [x, z] = door.exit
    camera.position.x = x
    camera.position.z = z
    camera.rotation.set(0, door.yaw, 0, 'YXZ')
    floorY.current = LEVELS[lvl].floorAt(x, z) // snap: no 5 m slide through the slab
    jumpY.current = 0
    vy.current = 0
    devY.current = null
    stairArmed.current = false
  }
  return null
}
