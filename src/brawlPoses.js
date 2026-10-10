// Pose curves for brawl animations, shared by Labubu.jsx (one figure, posed every frame)
// and LabubuCrowd.jsx (keyframes baked per outfit). u is the cycle phase in [0, 1).
// Angles: arm/leg x < 0 swings forward/up; arm z swings out (left +, right -).
const TAU = Math.PI * 2
const ease = (k) => k * k * (3 - 2 * k)
const lerp = (a, b, k) => a + (b - a) * k

export const CYCLE = { walk: 0.85, run: 1.45 } // meters per stride cycle

export function poseAt(anim, u) {
  const s = Math.sin(u * TAU)
  const c = Math.cos(u * TAU)
  switch (anim) {
    case 'walk':
      return { legL: 0.5 * s, legR: -0.5 * s, armL: [-0.45 * s, 0.25], armR: [0.45 * s, -0.25], lean: 0.05, bob: 0.02 * Math.abs(c), crouch: 1 }
    case 'run':
      return { legL: 0.95 * s, legR: -0.95 * s, armL: [-1.0 * s - 0.3, 0.3], armR: [1.0 * s - 0.3, -0.3], lean: 0.22, bob: 0.05 * Math.abs(c), crouch: 1 }
    case 'stab': {
      // wind up overhead (ease in), snap the thrust (fast), recover (ease out); body follows the arm
      let arm
      let lean
      if (u < 0.5) {
        const k = ease(u / 0.5)
        arm = lerp(-0.5, -2.8, k)
        lean = lerp(0.05, -0.12, k)
      } else if (u < 0.62) {
        const k = 1 - (1 - (u - 0.5) / 0.12) ** 3
        arm = lerp(-2.8, -1.3, k)
        lean = lerp(-0.12, 0.3, k)
      } else {
        const k = ease((u - 0.62) / 0.38)
        arm = lerp(-1.3, -0.5, k)
        lean = lerp(0.3, 0.05, k)
      }
      return { legL: 0.3, legR: -0.25, armL: [-1.0, 0.7], armR: [arm, -0.25], lean, bob: 0, crouch: 1 }
    }
    case 'cower':
      // arms over the head, knees bent, trembling
      return { legL: 0.35, legR: 0.35, armL: [-2.6, 0.55], armR: [-2.6, -0.55], lean: 0.18 + 0.03 * Math.sin(u * TAU * 3), bob: -0.04, crouch: 0.9 }
    default:
      return { legL: 0, legR: 0, armL: [0, 0.55], armR: [0, -0.55], lean: 0, bob: 0.01 * s, crouch: 1 }
  }
}

// the stab lands at this point in the cycle (end of the thrust)
export const STAB_HIT = 0.6
