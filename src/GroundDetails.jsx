import { useMemo } from 'react'
import * as THREE from 'three'
import { COURTYARD, inPoly } from './layout.js'
import { AUD, AUD_SEATS, CAFE, CHAIRS1, COMMONS, COURT_DOORS, DETAIL, DINING, G, H1, TABLES1 } from './ground.js'
import { BOX, Instanced, Plane, SPHERE } from './parts.jsx'
import Labubu, { TossBall, YALE_BLUE } from './Labubu.jsx'
import LabubuCrowd, { seatPeople } from './LabubuCrowd.jsx'
import Professor from './Professor.jsx'
import * as T from './textures.js'

// Floor 1 details: people, fixtures, and signage on top of the GroundFloor.jsx shell.
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
const glowing = (color, intensity = 1.2) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5 })
const basic = (map, side = THREE.FrontSide) => new THREE.MeshBasicMaterial({ map, side })

export default function GroundDetails({ M }) {
  const L = useMemo(
    () => ({
      warm: glowing('#fff1d6', 1.4),
      heat: glowing('#ff7a2a', 1.6),
      exitGlow: basic(T.exitTex()),
      cooler: new THREE.MeshStandardMaterial({ map: T.coolerTex(), emissive: '#ffffff', emissiveMap: T.coolerTex(), emissiveIntensity: 0.5 }),
      vending: [1, 2].map((s) => new THREE.MeshStandardMaterial({ map: T.vendingTex(s), emissive: '#ffffff', emissiveMap: T.vendingTex(s), emissiveIntensity: 0.45 })),
      kiosk: basic(T.kioskTex()),
      restroom: basic(T.restroomTex()),
      door: new THREE.MeshStandardMaterial({ color: '#6b5a48', roughness: 0.7 }),
      rug: new THREE.MeshStandardMaterial({ map: T.carpetTex([1, 1], '#7a2f3a'), roughness: 1 }),
      rugBlue: new THREE.MeshStandardMaterial({ map: T.carpetTex([1, 1], '#2f4a7a'), roughness: 1 }),
      felt: new THREE.MeshStandardMaterial({ color: '#2f7a3a', roughness: 0.9 }),
      pans: ['#c8a15a', '#7a4a2a', '#d8d0b0', '#a83a2a', '#5a8a3a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })),
      pastry: new THREE.MeshStandardMaterial({ color: '#d99a4e', roughness: 0.6 }),
      cup: new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.4 }),
      bins: DETAIL.bins.map(([, , c]) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })),
      beanbag: ['#ff4fa3', '#ffd76a', '#7fb2ff'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 })),
      signs: Object.fromEntries(
        [
          ['dining', 'Dining Commons ↑'],
          ['atrium', 'Bekenstein Atrium ↑'],
          ['zhang', 'Zhang Auditorium ↑'],
          ['cafe', 'Café ↑'],
          ['commons', 'Student Commons ↑'],
          ['court', 'Shen Courtyard'],
        ].map(([k, t]) => [k, basic(T.bannerTex(t, '', { h: 128, bg: '#0b0b0d', fg: '#ffd6ea' }))]),
      ),
    }),
    [],
  )
  return (
    <group>
      <People />
      <Dining M={M} L={L} />
      <Cafe M={M} L={L} />
      <Atrium M={M} L={L} />
      <AuditoriumDetails M={M} L={L} />
      <Commons M={M} L={L} />
      <Foyer M={M} L={L} />
      <CourtyardDetails M={M} L={L} />
      <Wayfinding L={L} />
    </group>
  )
}

// ---------- people: an instanced seated crowd plus a few animated Labubus
function People() {
  const crowd = useMemo(() => {
    const dining = CHAIRS1.filter((c) => !c.stool && c.z < DINING.z1)
    const lawn = CHAIRS1.filter((c) => inPoly(c.x, c.z, COURTYARD))
    const stools = CHAIRS1.filter((c) => c.stool).map((c) => ({ ...c, y: c.y + 0.27 }))
    return [
      ...seatPeople(AUD_SEATS, 140, 7001), // an afternoon talk in Zhang
      ...seatPeople(dining, 52, 7002),
      ...seatPeople(stools, 5, 7003),
      ...seatPeople(lawn, 9, 7004),
    ]
  }, [])
  const { servery } = DINING
  const [px, pz] = COMMONS.pingpong
  const ppY = G + 0.0
  return (
    <>
      <LabubuCrowd people={crowd} />
      {/* keynote on the Zhang stage */}
      <Professor who="dumbledore" position={[AUD.F[0], G + AUD.stage.h, AUD.F[1] + 0.8]} rotation={0} phase={0.7} />
      {/* barista behind the café counter, front-desk greeter in the atrium */}
      <Labubu fur="#f2efe9" expression="happy" shirt="#2b2b2e" pants="#2c2c30" anim="wave" position={[CAFE.counter.x + 0.75, G, 0.4]} rotation={-Math.PI / 2} height={1.25} />
      <Labubu fur="#5a3d2e" expression="grin" shirt="yale" pants="#1d2a44" anim="wave" position={[-31.6, G, 0]} rotation={-Math.PI / 2} height={1.25} phase={1.2} />
      {/* visitors chatting by the entrance */}
      <Labubu fur="#ff8fc7" expression="mischief" shirt="stripes" pants="#e8dcc0" hat="bucket" position={[-35.6, G, 4.2]} rotation={2.1} height={1.2} />
      <Labubu fur="#9fe0c6" expression="surprised" shirt={YALE_BLUE} pants="#d8cfc0" anim="wave" position={[-34.4, G, 5]} rotation={-1.0} height={1.2} phase={2} />
      {/* lunch line at the servery */}
      {[0, 1.2, 2.4].map((dx, i) => (
        <Labubu key={i} fur={['#d9c2a0', '#7fb2ff', '#c98f6b'][i]} expression={['happy', 'grin', 'sleepy'][i]} shirt={['yale', '#ffffff', 'stripes'][i]} pants="#3d5a8a" position={[servery.x0 + 5 + dx, G, servery.z + 1.3]} rotation={Math.PI} height={1.2} phase={i} />
      ))}
      {/* ping-pong in the commons */}
      <Labubu fur="#f2a65a" expression="grin" shirt="#ffffff" pants={YALE_BLUE} anim="catch" position={[px - 1.9, G, pz]} rotation={Math.PI / 2} height={1.2} />
      <Labubu fur="#b9a5e6" expression="surprised" shirt="yale" anim="catch" position={[px + 1.9, G, pz]} rotation={-Math.PI / 2} height={1.2} phase={1.6} />
      <TossBall from={[px - 1.5, pz]} to={[px + 1.5, pz]} y={ppY} height={1.2} color="#ffffff" />
      <Labubu fur="#2b2b2e" expression="happy" shirt="#ff4fa3" anim="dance" position={[13.2, G, 43.6]} rotation={Math.PI} height={1.1} />
    </>
  )
}

// ---------- dining: columns, pendant lights, food on the servery, drinks cooler, bins
function Dining({ M, L }) {
  const { servery } = DINING
  const { cooler, bins, trays } = DETAIL
  const tables = TABLES1.filter((t) => !t.round)
  const shades = useMemo(() => tables.map((t) => ({ p: [t.x, G + 3.1, t.z], s: [0.28, 0.22, 0.28] })), [tables])
  const cords = useMemo(() => tables.map((t) => ({ p: [t.x, G + (3.2 + H1) / 2, t.z], s: [0.012, H1 - 3.2, 0.012] })), [tables])
  const pans = useMemo(() => {
    const out = [[], [], [], [], []]
    let i = 0
    for (let x = servery.x0 + 0.6; x < servery.x1 - 0.4; x += 0.75, i++) out[i % 5].push({ p: [x, G + 0.97, servery.z - 0.15], s: [0.6, 0.06, 0.45] })
    return out
  }, [servery])
  return (
    <>
      <Instanced items={DETAIL.columns.map(([x, z]) => ({ p: [x, G + H1 / 2, z], s: [0.28, H1, 0.28] }))} material={M.column} geometry={CYL} />
      <Instanced items={shades} material={L.warm} geometry={CYL} />
      <Instanced items={cords} material={M.dark} geometry={BOX} />
      {pans.map((items, i) => (
        <Instanced key={i} items={items} material={L.pans[i]} geometry={BOX} />
      ))}
      {/* heat lamps along the top of the sneeze guard */}
      <mesh material={L.heat} position={[(servery.x0 + servery.x1) / 2, G + 1.45, servery.z - 0.1]}>
        <boxGeometry args={[servery.x1 - servery.x0, 0.05, 0.12]} />
      </mesh>
      {/* tray stack at the start of the line */}
      <Instanced items={[0, 1, 2, 3, 4, 5].map((k) => ({ p: [trays[0], G + 0.8 + k * 0.025, trays[1]], s: [0.45, 0.02, 0.35] }))} material={M.orange} geometry={BOX} />
      <mesh material={M.steel} position={[trays[0], G + 0.39, trays[1]]}>
        <boxGeometry args={[0.5, 0.78, 0.4]} />
      </mesh>
      {/* drinks cooler against the north wall */}
      <mesh material={M.steel} position={[cooler.x, G + cooler.h / 2, cooler.z]}>
        <boxGeometry args={[cooler.w, cooler.h, cooler.d]} />
      </mesh>
      <Plane p={[cooler.x, G + cooler.h / 2 + 0.05, cooler.z + cooler.d / 2 + 0.01]} w={cooler.w - 0.16} h={cooler.h - 0.3} material={L.cooler} />
      {/* trash, recycling, compost */}
      {bins.map(([x, z], i) => (
        <mesh key={i} material={L.bins[i]} position={[x, G + 0.5, z]}>
          <boxGeometry args={[0.65, 1.0, 0.55]} />
        </mesh>
      ))}
    </>
  )
}

// ---------- café: espresso machine, pastry case, cups
function Cafe({ M, L }) {
  const top = G + 1.07
  const [ex, ez] = DETAIL.espresso
  const [qx, qz] = DETAIL.pastry
  const pastries = useMemo(() => {
    const out = []
    for (let i = 0; i < 6; i++) for (const y of [0.1, 0.32]) out.push({ p: [qx, top + y, qz - 0.6 + i * 0.24], s: [0.08, 0.05, 0.08] })
    return out
  }, [qx, qz, top])
  return (
    <>
      <mesh material={M.steel} position={[ex, top + 0.25, ez]}>
        <boxGeometry args={[0.55, 0.5, 0.75]} />
      </mesh>
      <mesh material={M.dark} position={[ex, top + 0.56, ez]}>
        <boxGeometry args={[0.45, 0.12, 0.6]} />
      </mesh>
      <Instanced items={[-0.18, 0.18].map((dz) => ({ p: [ex - 0.32, top + 0.16, ez + dz], s: [0.04, 0.08, 0.04] }))} material={M.dark} geometry={CYL} />
      <Instanced items={[0, 1, 2, 3].map((k) => ({ p: [ex, top + 0.05, ez + 0.6 + k * 0.12], s: [0.045, 0.1, 0.045] }))} material={L.cup} geometry={CYL} />
      <mesh material={M.tableGlass} position={[qx, top + 0.25, qz]}>
        <boxGeometry args={[0.6, 0.5, 1.6]} />
      </mesh>
      <Instanced items={pastries} material={L.pastry} geometry={SPHERE} />
    </>
  )
}

// ---------- atrium: rugs, directory kiosk, big pendant globes
function Atrium({ M, L }) {
  const [kx, kz] = DETAIL.kiosk
  return (
    <>
      {DETAIL.rugs.slice(0, 2).map(([x, z, w, d], i) => (
        <mesh key={i} material={L.rug} position={[x, G + 0.01, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
        </mesh>
      ))}
      <mesh material={M.dark} position={[kx, G + 0.95, kz]}>
        <boxGeometry args={[0.7, 1.9, 0.18]} />
      </mesh>
      <Plane p={[kx, G + 1.1, kz + 0.1]} w={0.6} h={1.05} material={L.kiosk} />
      <Plane p={[kx, G + 1.1, kz - 0.1]} rot={Math.PI} w={0.6} h={1.05} material={L.kiosk} />
      <Instanced items={[-8, 0, 8].map((z) => ({ p: [-34.5, G + 3.5, z], s: [0.55, 0.55, 0.55] }))} material={L.warm} geometry={SPHERE} />
      <Instanced items={[-8, 0, 8].map((z) => ({ p: [-34.5, G + (4.05 + H1) / 2, z], s: [0.012, H1 - 4.05, 0.012] }))} material={M.dark} geometry={BOX} />
    </>
  )
}

// ---------- Zhang: AV booth, exit signs, wall sconces, aisle lights, mic, stage plants
function AuditoriumDetails({ M, L }) {
  const { booth } = DETAIL
  const { F, A0, STEP, RISE, NB, AISLE, x0, x1, z0, stage } = AUD
  const landing = G + NB * RISE
  const sconces = useMemo(() => {
    const out = []
    for (let z = 28; z < 47; z += 4.5) for (const x of [x0 + 0.14, x1 - 0.14]) out.push({ p: [x, G + 3.3, z], s: [0.08, 0.35, 0.25] })
    return out
  }, [x0, x1])
  const aisleLights = useMemo(() => {
    const out = []
    for (let k = 1; k < NB; k++)
      for (const phi of [-AISLE, AISLE]) {
        const r = A0 + (k - 1) * STEP + 0.04
        out.push({ p: [F[0] + r * Math.sin(phi), G + k * RISE - 0.06, F[1] + r * Math.cos(phi)], r: phi, s: [0.5, 0.03, 0.05] })
      }
    return out
  }, [F, A0, STEP, RISE, NB, AISLE])
  const bw = booth.x1 - booth.x0
  const bd = booth.z1 - booth.z0
  const bh = G + H1 - landing
  return (
    <>
      {/* AV booth on the back landing: glass front, two monitors */}
      <mesh material={M.white} position={[booth.x0, landing + bh / 2, (booth.z0 + booth.z1) / 2]}>
        <boxGeometry args={[0.15, bh, bd]} />
      </mesh>
      <mesh material={M.white} position={[booth.x1, landing + bh / 2, (booth.z0 + booth.z1) / 2]}>
        <boxGeometry args={[0.15, bh, bd]} />
      </mesh>
      <mesh material={M.white} position={[(booth.x0 + booth.x1) / 2, landing + 0.5, booth.z0]}>
        <boxGeometry args={[bw, 1.0, 0.15]} />
      </mesh>
      <mesh material={M.meetGlass} position={[(booth.x0 + booth.x1) / 2, landing + 1.0 + (bh - 1.0) / 2, booth.z0]}>
        <boxGeometry args={[bw, bh - 1.0, 0.04]} />
      </mesh>
      <Instanced items={[-1.3, 1.3].map((dx) => ({ p: [(booth.x0 + booth.x1) / 2 + dx, landing + 1.25, booth.z0 + 0.6], r: Math.PI, s: [0.9, 0.55, 0.05] }))} material={M.screen} geometry={BOX} />
      {/* EXIT over both doors, facing the seats */}
      {AUD.doors.map(([a, b]) => (
        <Plane key={a} p={[(a + b) / 2, G + 2.75, z0 + 0.14]} w={0.6} h={0.22} material={L.exitGlow} />
      ))}
      <Instanced items={sconces} material={L.warm} geometry={BOX} />
      <Instanced items={aisleLights} material={L.warm} geometry={BOX} />
      {/* mic stand next to the lectern, plants at the stage corners */}
      <mesh material={M.dark} position={[stage.x1 - 4.2, G + stage.h + 0.75, 25.1]}>
        <cylinderGeometry args={[0.015, 0.015, 1.5, 8]} />
      </mesh>
      <Instanced items={[stage.x0 + 0.5, stage.x1 - 0.5].map((x) => ({ p: [x, G + stage.h + 0.3, stage.z0 + 0.5], s: [0.35, 0.6, 0.35] }))} material={M.pot} geometry={BOX} />
      <Instanced items={[stage.x0 + 0.5, stage.x1 - 0.5].map((x) => ({ p: [x, G + stage.h + 1.1, stage.z0 + 0.5], s: [0.55, 0.7, 0.55] }))} material={M.leaf} geometry={SPHERE} />
    </>
  )
}

// ---------- commons: rug, foosball, vending machines, bean bags
function Commons({ M, L }) {
  const [fx, fz] = DETAIL.foosball
  const [rx, rz, rw, rd] = DETAIL.rugs[2]
  return (
    <>
      <mesh material={L.rugBlue} position={[rx, G + 0.01, rz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[rw, rd]} />
      </mesh>
      <mesh material={M.desk} position={[fx, G + 0.65, fz]}>
        <boxGeometry args={[1.4, 0.3, 0.8]} />
      </mesh>
      <mesh material={L.felt} position={[fx, G + 0.81, fz]}>
        <boxGeometry args={[1.25, 0.02, 0.68]} />
      </mesh>
      <Instanced items={[-0.45, -0.15, 0.15, 0.45].map((dx) => ({ p: [fx + dx, G + 0.86, fz], s: [0.025, 0.025, 1.3] }))} material={M.steel} geometry={BOX} />
      <Instanced items={[-0.6, 0.6].flatMap((dx) => [-0.3, 0.3].map((dz) => ({ p: [fx + dx, G + 0.25, fz + dz], s: [0.08, 0.5, 0.08] })))} material={M.dark} geometry={BOX} />
      {DETAIL.vending.map(([x, z], i) => (
        <group key={i}>
          <mesh material={M.dark} position={[x, G + 0.95, z]}>
            <boxGeometry args={[0.8, 1.9, 1.2]} />
          </mesh>
          <Plane p={[x - 0.41, G + 0.95, z]} rot={-Math.PI / 2} w={1.1} h={1.8} material={L.vending[i]} />
        </group>
      ))}
      {DETAIL.beanbags.map(([x, z], i) => (
        <mesh key={i} material={L.beanbag[i]} geometry={SPHERE} position={[x, G + 0.3, z]} scale={[0.55, 0.35, 0.55]} />
      ))}
    </>
  )
}

// ---------- foyer: restroom doors on the auditorium's west wall, water fountain
function Foyer({ M, L }) {
  const x = AUD.x0 - 0.12
  const [wx, wz] = DETAIL.fountain
  return (
    <>
      {DETAIL.restrooms.map((z) => (
        <group key={z}>
          <mesh material={L.door} position={[x, G + 1.05, z]}>
            <boxGeometry args={[0.05, 2.1, 1.0]} />
          </mesh>
          <Plane p={[x - 0.04, G + 1.6, z + 0.75]} rot={-Math.PI / 2} w={0.32} h={0.4} material={L.restroom} />
        </group>
      ))}
      <mesh material={M.steel} position={[wx, G + 0.9, wz]}>
        <boxGeometry args={[0.35, 0.3, 0.6]} />
      </mesh>
    </>
  )
}

// ---------- courtyard: lamp posts, stone landings outside each door
function CourtyardDetails({ M, L }) {
  const landings = useMemo(
    () =>
      COURT_DOORS.map((d) => {
        const g = new THREE.PlaneGeometry(2.6, 3)
        g.rotateX(-Math.PI / 2)
        g.rotateY(Math.atan2(d.n[0], d.n[1]))
        g.translate(d.p[0] + d.n[0] * 1.6, G + 0.012, d.p[1] + d.n[1] * 1.6)
        return g
      }),
    [],
  )
  return (
    <>
      {landings.map((g, i) => (
        <mesh key={i} geometry={g} material={M.stone} />
      ))}
      <Instanced items={DETAIL.lamps.map(([x, z]) => ({ p: [x, G + 1.6, z], s: [0.06, 3.2, 0.06] }))} material={M.mullion} geometry={CYL} />
      <Instanced items={DETAIL.lamps.map(([x, z]) => ({ p: [x, G + 3.35, z], s: [0.22, 0.22, 0.22] }))} material={L.warm} geometry={SPHERE} />
      {COURT_DOORS.map((d, i) => {
        const p = [d.p[0] - d.n[0] * 0.2, G + 2.85, d.p[1] - d.n[1] * 0.2]
        return <Plane key={i} p={p} rot={Math.atan2(-d.n[0], -d.n[1])} w={1.8} h={0.28} material={L.signs.court} />
      })}
    </>
  )
}

// ---------- hanging wayfinding signs in the cloister (a different message on each face)
function Wayfinding({ L }) {
  const S = L.signs
  // [x, z, sign seen walking north (-z), sign seen walking south (+z)]
  const spots = [
    [-24.4, -20, S.dining, S.atrium],
    [-24.4, 20, S.atrium, S.zhang],
    [24.4, -16, S.dining, S.cafe],
    [24.4, 17, S.cafe, S.commons],
  ]
  return spots.map(([x, z, north, south], i) => (
    <group key={i} position={[x, G + 3.5, z]}>
      <Plane p={[0, 0, 0.01]} w={3.4} h={0.5} material={north} />
      <Plane p={[0, 0, -0.01]} rot={Math.PI} w={3.4} h={0.5} material={south} />
    </group>
  ))
}
