// The two floors the player can be on, and the stairwells that connect them.
import { COLLIDERS, STAIRS, SPAWN, collide, floorAt, locate } from './layout.js'
import { COLLIDERS1, SPAWN1, collide1, floorAt1, locate1 } from './ground.js'

export const LEVELS = {
  1: { collide: collide1, floorAt: floorAt1, locate: locate1, spawn: SPAWN1, colliders: COLLIDERS1 },
  2: { collide, floorAt, locate, spawn: SPAWN, colliders: COLLIDERS },
}

// each stair core has one opening (with the painting above it) facing `face`.
// Walk into the opening to take the stairs; you come out of the same stairwell on the other floor.
export const STAIR_DOORS = STAIRS.map((s) => {
  const ext = s.face[0] !== 0 ? s.w / 2 : s.d / 2
  const at = (d) => [s.c[0] + s.face[0] * (ext + d), s.c[1] + s.face[1] * (ext + d)]
  return {
    id: s.id,
    trigger: at(0.4), // just in front of the opening
    exit: at(1.5), // where you step out on the other floor
    yaw: Math.atan2(-s.face[0], -s.face[1]), // camera yaw that looks straight out of the stairwell
  }
})
export const STAIR_TRIGGER_R = 0.75
