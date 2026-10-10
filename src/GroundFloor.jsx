import { useMemo } from 'react'
import * as THREE from 'three'
import { BEIN, BOUNDS, COURTYARD, EAST, inPoly } from './layout.js'
import {
  AUD, ATRIUM, AUD_SEATS, CAFE, CHAIRS1, COMMONS, COURT_DOORS, DINING, G, H1, KITCHEN, PLANTS1, TABLES1, WALLS1,
  audTierOutline,
} from './ground.js'
import { BOX, Instanced, Plane, SPHERE, slideMat, wallItems } from './parts.jsx'
import * as T from './textures.js'
import GroundDetails from './GroundDetails.jsx'

// Floor 1 (courtyard level): Bekenstein Atrium, Zhang Auditorium, Dining Commons, café, student commons.
const WALL_MATS = ['white', 'exterior', 'dark', 'slats', 'steel', 'meetGlass', 'desk', 'orange', 'leather']

export default function GroundFloor({ M }) {
  const L = useMemo(
    () => ({
      audCarpet: new THREE.MeshStandardMaterial({ color: '#3d4a63', roughness: 1 }),
      audStep: new THREE.MeshStandardMaterial({ color: '#c9a44a', roughness: 0.6 }),
      welcome: new THREE.MeshBasicMaterial({ map: T.bannerTex('Yale School of Management', 'Edward P. Evans Hall · Bekenstein Atrium') }),
      dining: new THREE.MeshBasicMaterial({ map: T.bannerTex('Dining Commons', '', { bg: '#1f2421', fg: '#f3dfa8' }) }),
      cafe: new THREE.MeshBasicMaterial({ map: T.bannerTex('Café', '', { bg: '#3b2a1c', fg: '#f3dfa8', w: 512 }) }),
      commons: new THREE.MeshBasicMaterial({ map: T.bannerTex('Student Commons', '', { bg: '#ff4fa3', fg: '#ffffff' }) }),
      menus: [
        ['Grill', ['Burger + fries', 'Grilled chicken', 'Veggie burger', 'Sweet potato fries', 'Grilled cheese'], 1],
        ['Global', ['Chicken tikka', 'Pad thai', 'Bibimbap bowl', 'Falafel plate', 'Ramen'], 2],
        ['Salad + Deli', ['Build-your-own salad', 'Turkey club', 'Caprese panini', 'Soup of the day', 'Fruit cup'], 3],
      ].map(([t, items, seed]) => new THREE.MeshBasicMaterial({ map: T.menuTex(t, items, seed) })),
      cafeMenu: new THREE.MeshBasicMaterial({ map: T.menuTex('Coffee', ['Drip coffee', 'Latte', 'Cold brew', 'Chai latte', 'Croissant'], 4) }),
      audSign: new THREE.MeshBasicMaterial({ map: T.signTex('Zhang Auditorium', '350 seats') }),
      kitchenSign: new THREE.MeshBasicMaterial({ map: T.signTex('Kitchen', 'Staff only') }),
    }),
    [],
  )

  return (
    <group>
      <FloorAndCeiling1 M={M} />
      <Walls1 M={M} />
      <CourtyardDoors M={M} />
      <Auditorium M={M} L={L} />
      <Furniture M={M} />
      <Signs M={M} L={L} />
      <Lights1 M={M} />
      <TerraceUnderside M={M} />
      <GroundDetails M={M} />
    </group>
  )
}

function FloorAndCeiling1({ M }) {
  const geos = useMemo(() => {
    const { xMin, xMax, zMin, zMax } = BOUNDS
    const make = (up) => {
      const f = (x, z) => new THREE.Vector2(x, up ? -z : z)
      const s = new THREE.Shape([f(xMin, zMin), f(xMax, zMin), f(xMax, zMax), f(xMin, zMax)])
      s.holes.push(new THREE.Path(COURTYARD.map(([x, z]) => f(x, z))))
      const g = new THREE.ShapeGeometry(s)
      g.rotateX(up ? -Math.PI / 2 : Math.PI / 2)
      return g
    }
    // stone floors where people eat and come in
    const rect = ({ x0, x1, z0, z1 }) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0)
      g.rotateX(-Math.PI / 2)
      g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2)
      return g
    }
    return { floor: make(true), ceil: make(false), stone: [DINING, ATRIUM, CAFE].map(rect) }
  }, [])
  return (
    <>
      <mesh geometry={geos.floor} material={M.carpet} position={[0, G + 0.002, 0]} />
      <mesh geometry={geos.ceil} material={M.ceiling} position={[0, G + H1, 0]} />
      {geos.stone.map((g, i) => (
        <mesh key={i} geometry={g} material={M.stone1} position={[0, G + 0.006, 0]} />
      ))}
    </>
  )
}

function Walls1({ M }) {
  const groups = useMemo(() => WALL_MATS.map((m) => [m, wallItems(WALLS1, m)]), [])
  return groups.map(([m, items]) => <Instanced key={m} items={items} material={M[m]} geometry={BOX} />)
}

// steel door frames at the four courtyard doors, plus mullions on the floor 1 glass
function CourtyardDoors({ M }) {
  const items = useMemo(() => {
    const out = []
    for (const d of COURT_DOORS) {
      const t = [-d.n[1], d.n[0]]
      for (const s of [-1.1, 1.1]) out.push({ p: [d.p[0] + t[0] * s, G + H1 / 2, d.p[1] + t[1] * s], s: [0.12, H1, 0.12] })
      out.push({ p: [d.p[0], G + 2.5, d.p[1]], r: Math.atan2(t[1], t[0]) * -1, s: [2.3, 0.1, 0.12] })
    }
    COURTYARD.forEach(([x, z], i) => {
      if (i % 6 === 0 && !COURT_DOORS.some((d) => Math.hypot(x - d.p[0], z - d.p[1]) < 1.5)) out.push({ p: [x, G + H1 / 2, z], s: [0.07, H1, 0.07] })
    })
    return out
  }, [])
  return <Instanced items={items} material={M.mullion} geometry={BOX} />
}

function Auditorium({ M, L }) {
  const { stage, F, NB, RISE } = AUD
  const tiers = useMemo(() => {
    const out = []
    for (let k = 1; k <= NB; k++) {
      const outline = audTierOutline(k)
      if (!outline) continue
      const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)))
      const g = new THREE.ExtrudeGeometry(shape, { depth: RISE, bevelEnabled: false })
      g.rotateX(-Math.PI / 2)
      g.translate(0, G + (k - 1) * RISE + 0.004, 0)
      out.push(g)
    }
    return out
  }, [NB, RISE])
  const seats = useMemo(() => AUD_SEATS.map((c) => ({ p: [c.x, c.y + 0.45, c.z], r: c.rot, s: [0.52, 0.12, 0.5] })), [])
  const backs = useMemo(
    () => AUD_SEATS.map((c) => ({ p: [c.x + Math.sin(c.rot) * 0.24, c.y + 0.75, c.z + Math.cos(c.rot) * 0.24], r: c.rot, s: [0.52, 0.65, 0.08] })),
    [],
  )
  const zWall = AUD.z0 + 0.12
  return (
    <>
      {tiers.map((g, i) => (
        <mesh key={i} geometry={g} material={[L.audCarpet, L.audStep]} />
      ))}
      <mesh material={M.stage} position={[(stage.x0 + stage.x1) / 2, G + stage.h / 2, (stage.z0 + stage.z1) / 2]}>
        <boxGeometry args={[stage.x1 - stage.x0, stage.h, stage.z1 - stage.z0]} />
      </mesh>
      <Instanced items={seats} material={M.audSeat} geometry={BOX} />
      <Instanced items={backs} material={M.audSeat} geometry={BOX} />
      {/* main screen + two side screens on the stage wall */}
      <mesh material={M.dark} position={[F[0], G + 2.6, zWall]}>
        <boxGeometry args={[6.7, 3.9, 0.04]} />
      </mesh>
      <Plane p={[F[0], G + 2.6, zWall + 0.03]} w={6.4} h={3.6} material={slideMat('mgt409', 'title')} />
      {[[-21.5, 'chart'], [3.5, 'content']].map(([x, kind]) => (
        <Plane key={x} p={[x, G + 2.9, zWall + 0.03]} w={3.2} h={1.8} material={slideMat('mgt409', kind)} />
      ))}
      <mesh material={M.dark} position={[stage.x1 - 3, G + stage.h + 0.55, 25]}>
        <boxGeometry args={[0.7, 1.1, 0.5]} />
      </mesh>
    </>
  )
}

function Furniture({ M }) {
  const flat = TABLES1.filter((t) => !t.round)
  const tops = useMemo(() => flat.map((t) => ({ p: [t.x, G + t.h, t.z], s: [t.w, 0.04, t.d] })), [flat])
  const legs = useMemo(
    () => flat.flatMap((t) => [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ p: [t.x + sx * (t.w / 2 - 0.08), G + t.h / 2, t.z + sz * (t.d / 2 - 0.08)], s: [0.05, t.h, 0.05] })))),
    [flat],
  )
  const chairs = CHAIRS1.filter((c) => !c.stool)
  const stools = CHAIRS1.filter((c) => c.stool)
  const seat = useMemo(() => chairs.map((c) => ({ p: [c.x, c.y + 0.47, c.z], r: c.rot, s: [0.46, 0.06, 0.46] })), [chairs])
  const back = useMemo(
    () => chairs.map((c) => ({ p: [c.x + Math.sin(c.rot) * 0.21, c.y + 0.78, c.z + Math.cos(c.rot) * 0.21], r: c.rot, s: [0.46, 0.55, 0.05] })),
    [chairs],
  )
  const chairLegs = useMemo(() => chairs.map((c) => ({ p: [c.x, c.y + 0.22, c.z], s: [0.05, 0.44, 0.05] })), [chairs])
  const stoolTop = useMemo(() => stools.map((c) => ({ p: [c.x, c.y + 0.75, c.z], s: [0.38, 0.05, 0.38] })), [stools])
  const stoolLeg = useMemo(() => stools.map((c) => ({ p: [c.x, c.y + 0.37, c.z], s: [0.05, 0.74, 0.05] })), [stools])
  const [px, pz] = COMMONS.pingpong
  return (
    <>
      <Instanced items={tops} material={M.desk} geometry={BOX} />
      <Instanced items={legs} material={M.mullion} geometry={BOX} />
      <Instanced items={seat} material={M.chair} geometry={BOX} />
      <Instanced items={back} material={M.chair} geometry={BOX} />
      <Instanced items={chairLegs} material={M.mullion} geometry={BOX} />
      <Instanced items={stoolTop} material={M.leather} geometry={BOX} />
      <Instanced items={stoolLeg} material={M.steel} geometry={BOX} />
      {TABLES1.filter((t) => t.round).map((t, i) => (
        <group key={i}>
          <mesh material={M.desk} position={[t.x, G + t.h, t.z]}>
            <cylinderGeometry args={[t.w / 2 + 0.1, t.w / 2 + 0.1, 0.04, 28]} />
          </mesh>
          <mesh material={M.steel} position={[t.x, G + t.h / 2, t.z]}>
            <cylinderGeometry args={[0.04, 0.04, t.h, 10]} />
          </mesh>
        </group>
      ))}
      {/* ping-pong */}
      <mesh material={[M.dark, M.dark, M.pingpong, M.dark, M.dark, M.dark]} position={[px, G + 0.74, pz]}>
        <boxGeometry args={[2.74, 0.04, 1.525]} />
      </mesh>
      <mesh material={M.board} position={[px, G + 0.83, pz]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[1.7, 0.15, 0.01]} />
      </mesh>
      <Instanced
        items={[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ p: [px + sx * 1.2, G + 0.36, pz + sz * 0.62], s: [0.06, 0.72, 0.06] })))}
        material={M.mullion}
        geometry={BOX}
      />
      {/* entrance doors: glass panes with steel frames in the west wall */}
      {[-1.25, 1.25].map((z) => (
        <mesh key={z} material={M.meetGlass} position={[BOUNDS.xMin + 0.05, G + 1.25, z]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[2.4, 2.5, 0.04]} />
        </mesh>
      ))}
      <Instanced
        items={[-2.5, 0, 2.5].map((z) => ({ p: [BOUNDS.xMin + 0.05, G + 1.3, z], s: [0.12, 2.6, 0.12] })).concat([{ p: [BOUNDS.xMin + 0.05, G + 2.6, 0], s: [0.12, 0.1, 5.1] }])}
        material={M.steel}
        geometry={BOX}
      />
      <mesh material={M.dark} position={[BOUNDS.xMin + 1.6, G + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 5]} />
      </mesh>
      {/* plants */}
      <Instanced items={PLANTS1.map(([x, z]) => ({ p: [x, G + 0.3, z], s: [0.3, 0.6, 0.3] }))} material={M.pot} geometry={BOX} />
      <Instanced items={PLANTS1.map(([x, z]) => ({ p: [x, G + 1.1, z], s: [0.5, 0.65, 0.5] }))} material={M.leaf} geometry={SPHERE} />
    </>
  )
}

function Signs({ L }) {
  const { servery } = DINING
  const serveryX = (servery.x0 + servery.x1) / 2
  return (
    <>
      <Plane p={[BOUNDS.xMin + 0.15, G + 3.5, 0]} rot={Math.PI / 2} w={8.5} h={1.6} material={L.welcome} />
      <Plane p={[serveryX, G + 4.05, BOUNDS.zMin + 0.3]} w={8} h={0.75} material={L.dining} />
      {[-10, 0, 10].map((dx, i) => (
        <Plane key={dx} p={[serveryX + dx, G + 2.55, BOUNDS.zMin + 0.3]} w={3} h={2.25} material={L.menus[i]} />
      ))}
      <Plane p={[BOUNDS.xMax - 0.3, G + 3.9, 0]} rot={-Math.PI / 2} w={3} h={0.75} material={L.cafe} />
      <Plane p={[BOUNDS.xMax - 0.3, G + 2.4, 0]} rot={-Math.PI / 2} w={2.6} h={1.95} material={L.cafeMenu} />
      <Plane p={[AUD.x1 + 0.12, G + 3.9, 38.5]} rot={Math.PI / 2} w={6} h={0.75} material={L.commons} />
      <Plane p={[AUD.x1 + 0.12, G + 2.1, 38.5]} rot={Math.PI / 2} w={3.2} h={1.8} material={slideMat('mgt887', 'chart')} />
      {AUD.doors.map(([a, b]) => (
        <Plane key={a} p={[(a + b) / 2 + (a < AUD.F[0] ? 1.6 : -1.6), 1.55 + G, AUD.z0 - 0.12]} rot={Math.PI} w={0.5} h={0.62} material={L.audSign} />
      ))}
      <Plane p={[KITCHEN.x1 + 0.12, G + 1.55, -36]} rot={Math.PI / 2} w={0.5} h={0.62} material={L.kitchenSign} />
    </>
  )
}

function Lights1({ M }) {
  const items = useMemo(() => {
    const out = []
    const { xMin, xMax, zMin, zMax } = BOUNDS
    for (let x = xMin + 1.2; x < xMax; x += 2.4)
      for (let z = zMin + 1.2; z < zMax; z += 2.4) if (!inPoly(x, z, COURTYARD)) out.push({ p: [x, G + H1 - 0.01, z] })
    return out
  }, [])
  const lampGeo = useMemo(() => {
    const g = new THREE.CircleGeometry(0.09, 12)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  return <Instanced items={items} material={M.lamp} geometry={lampGeo} />
}

// underside of the Beinecke Terrace Room and terrace, seen from floor 1 looking east
function TerraceUnderside({ M }) {
  const geos = useMemo(() => {
    const under = new THREE.CircleGeometry(BEIN.terrace, 64, -Math.PI / 2, Math.PI)
    under.rotateX(Math.PI / 2)
    const edge = new THREE.CylinderGeometry(BEIN.terrace, BEIN.terrace, -G - H1, 64, 1, true, 0, Math.PI)
    return { under, edge }
  }, [])
  return (
    <>
      <mesh geometry={geos.under} material={M.ceiling} position={[EAST, G + H1, 0]} />
      <mesh geometry={geos.edge} material={M.slabEdge} position={[EAST, G + H1 + (-G - H1) / 2, 0]} />
    </>
  )
}
