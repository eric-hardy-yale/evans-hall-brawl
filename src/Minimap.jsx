import { useEffect, useRef } from 'react'
import { BEIN, BOUNDS, COURTYARD, DRUMS, LIBRARY, MEETING, STAIRS, arc } from './layout.js'
import { DAN } from './HandsomeDan.jsx'
import { AUD, AUD_SEATS, CAFE, COURT_DOORS, DINING, KITCHEN, TABLES1, ENTRANCE } from './ground.js'

const PAD = 3
const X0 = BOUNDS.xMin - PAD
const X1 = BOUNDS.xMax + BEIN.terrace + PAD
const Z0 = BOUNDS.zMin - PAD
const Z1 = BOUNDS.zMax + PAD
const S = 2.6 // px per meter
const Wpx = Math.round((X1 - X0) * S)
const Hpx = Math.round((Z1 - Z0) * S)
const px = (x, z) => [(x - X0) * S, (z - Z0) * S]

function drawStatic2(g) {
  g.fillStyle = '#0b0b0d'
  g.fillRect(0, 0, Wpx, Hpx)
  const path = (pts, close = true) => {
    g.beginPath()
    pts.forEach((p, i) => (i ? g.lineTo(...px(...p)) : g.moveTo(...px(...p))))
    if (close) g.closePath()
  }
  // building
  g.fillStyle = '#1a1a1f'
  g.strokeStyle = '#ff4fa3'
  g.lineWidth = 1.5
  path([[BOUNDS.xMin, BOUNDS.zMin], [BOUNDS.xMax, BOUNDS.zMin], [BOUNDS.xMax, BOUNDS.zMax], [BOUNDS.xMin, BOUNDS.zMax]])
  g.fill()
  g.stroke()
  // terrace + Beinecke
  path(arc(BEIN.c, BEIN.terrace, BEIN.terrace, 0, Math.PI, 30))
  g.fillStyle = '#2a2622'
  g.fill()
  path(arc(BEIN.c, BEIN.r, BEIN.r, 0, Math.PI, 30))
  g.fillStyle = '#3a2a33'
  g.fill()
  g.stroke()
  // courtyard
  path(COURTYARD)
  g.fillStyle = '#18321a'
  g.fill()
  g.strokeStyle = '#ffb3d9'
  g.stroke()
  // drums
  g.strokeStyle = '#ff4fa3'
  for (const d of DRUMS) {
    path(arc(d.c, d.rx, d.rz, 0, Math.PI * 2, 48))
    g.fillStyle = '#16244f'
    g.fill()
    for (const [a0, a1] of d.arcs) {
      path(arc(d.c, d.rx, d.rz, a0, a1, 32), false)
      g.stroke()
    }
  }
  // library, meeting rooms, stairs
  g.fillStyle = '#3b2a1c'
  g.fillRect(...px(LIBRARY.x0, LIBRARY.z0), (LIBRARY.x1 - LIBRARY.x0) * S, (LIBRARY.z1 - LIBRARY.z0) * S)
  g.fillStyle = '#26262e'
  for (const m of MEETING) g.fillRect(...px(m.x - 2.6, m.z - 2.8), 5.2 * S, 5.6 * S)
  g.fillStyle = '#ff4fa3'
  g.font = 'bold 10px system-ui, sans-serif'
  for (const s of STAIRS) {
    g.fillRect(...px(s.c[0] - s.w / 2, s.c[1] - s.d / 2), s.w * S, s.d * S)
    g.fillStyle = '#0b0b0d'
    g.fillText(s.id, ...px(s.c[0] - 0.9, s.c[1] + 1.2))
    g.fillStyle = '#ff4fa3'
  }
  g.fillStyle = '#ffd6ea'
  g.font = '9px system-ui, sans-serif'
  g.fillText('ROSS LIB', ...px(LIBRARY.x0 + 0.6, 1))
  g.fillText('BEINECKE', ...px(BEIN.c[0] + 2, 1))
  g.fillText('COURTYARD', ...px(-7, 1))
  g.fillText('N ↑', ...px(BOUNDS.xMax + 6, BOUNDS.zMin + 2))
  for (const d of DRUMS) g.fillText(d.id, ...px(d.c[0] - 2.4, d.c[1] + 1))
}

// floor 1: atrium, auditorium fan, dining tables, café, commons, courtyard doors
function drawStatic1(g) {
  const path = (pts) => {
    g.beginPath()
    pts.forEach((p, i) => (i ? g.lineTo(...px(...p)) : g.moveTo(...px(...p))))
    g.closePath()
  }
  const rect = (x0, z0, x1, z1) => g.fillRect(...px(x0, z0), (x1 - x0) * S, (z1 - z0) * S)
  g.fillStyle = '#0b0b0d'
  g.fillRect(0, 0, Wpx, Hpx)
  g.fillStyle = '#1a1a1f'
  g.strokeStyle = '#ff4fa3'
  g.lineWidth = 1.5
  path([[BOUNDS.xMin, BOUNDS.zMin], [BOUNDS.xMax, BOUNDS.zMin], [BOUNDS.xMax, BOUNDS.zMax], [BOUNDS.xMin, BOUNDS.zMax]])
  g.fill()
  g.stroke()
  // courtyard is walkable down here
  path(COURTYARD)
  g.fillStyle = '#244a26'
  g.fill()
  g.strokeStyle = '#ffb3d9'
  g.stroke()
  g.fillStyle = '#ffb3d9'
  for (const d of COURT_DOORS) g.fillRect(...px(d.p[0] - 1, d.p[1] - 1), 2 * S, 2 * S)
  // auditorium + seats
  g.fillStyle = '#1d2a4a'
  rect(AUD.x0, AUD.z0, AUD.x1, AUD.z1)
  g.strokeStyle = '#ff4fa3'
  g.strokeRect(...px(AUD.x0, AUD.z0), (AUD.x1 - AUD.x0) * S, (AUD.z1 - AUD.z0) * S)
  g.fillStyle = '#c9a44a'
  rect(AUD.stage.x0, AUD.stage.z0, AUD.stage.x1, AUD.stage.z1)
  g.fillStyle = '#5f7fbf'
  for (const s of AUD_SEATS) g.fillRect(...px(s.x - 0.2, s.z - 0.2), 1, 1)
  g.fillStyle = '#0b0b0d'
  for (const [a, b] of AUD.doors) rect(a, AUD.z0 - 0.3, b, AUD.z0 + 0.3)
  // kitchen, servery, tables, café counter
  g.fillStyle = '#2b2b33'
  rect(KITCHEN.x0, KITCHEN.z0, KITCHEN.x1, KITCHEN.z1)
  g.fillStyle = '#8a8f99'
  rect(DINING.servery.x0, DINING.servery.z - 0.45, DINING.servery.x1, DINING.servery.z + 0.45)
  g.fillStyle = '#6b4a2e'
  for (const t of TABLES1) rect(t.x - t.w / 2, t.z - t.d / 2, t.x + t.w / 2, t.z + t.d / 2)
  rect(CAFE.counter.x - 0.4, CAFE.counter.z0, CAFE.counter.x + 0.4, CAFE.counter.z1)
  // entrance
  g.fillStyle = '#7fd6ff'
  rect(ENTRANCE.x - 0.6, ENTRANCE.z0, ENTRANCE.x + 0.6, ENTRANCE.z1)
  // stairs
  g.font = 'bold 10px system-ui, sans-serif'
  for (const s of STAIRS) {
    g.fillStyle = '#ff4fa3'
    g.fillRect(...px(s.c[0] - s.w / 2, s.c[1] - s.d / 2), s.w * S, s.d * S)
    g.fillStyle = '#0b0b0d'
    g.fillText(s.id, ...px(s.c[0] - 0.9, s.c[1] + 1.2))
  }
  g.fillStyle = '#ffd6ea'
  g.font = '9px system-ui, sans-serif'
  g.fillText('ATRIUM', ...px(BOUNDS.xMin + 1, -6))
  g.fillText('ENTRANCE', ...px(BOUNDS.xMin + 1, 6))
  g.fillText('ZHANG AUDITORIUM', ...px(-19, 46))
  g.fillText('DINING COMMONS', ...px(-13, -25.5))
  g.fillText('KITCHEN', ...px(KITCHEN.x0 + 1.5, -36))
  g.fillText('CAFÉ', ...px(21, -15))
  g.fillText('COMMONS', ...px(13, 30))
  g.fillText('COURTYARD', ...px(-7, 1))
  g.fillText('N ↑', ...px(BOUNDS.xMax + 6, BOUNDS.zMin + 2))
}

export default function Minimap({ drawRef, level }) {
  const ref = useRef()
  useEffect(() => {
    const bg = document.createElement('canvas')
    bg.width = Wpx
    bg.height = Hpx
    const bgc = bg.getContext('2d')
    if (level === 1) drawStatic1(bgc)
    else drawStatic2(bgc)
    bgc.fillStyle = '#ffffff'
    bgc.font = 'bold 13px system-ui, sans-serif'
    bgc.fillText(`FLOOR ${level}`, 8, 18)
    const g = ref.current.getContext('2d')
    drawRef.current = (x, z, fx, fz) => {
      g.drawImage(bg, 0, 0)
      // Handsome Dan tours floor 2
      if (level === 2) {
        const [dx, dy] = px(DAN.x, DAN.z)
        g.fillStyle = '#4a90ff'
        g.strokeStyle = '#ffffff'
        g.lineWidth = 1.5
        g.beginPath()
        g.arc(dx, dy, 4, 0, Math.PI * 2)
        g.fill()
        g.stroke()
      }
      const [cx, cy] = px(x, z)
      g.fillStyle = 'rgba(255,79,163,0.25)'
      g.beginPath()
      g.moveTo(cx, cy)
      const a = Math.atan2(fz, fx)
      g.arc(cx, cy, 26, a - 0.5, a + 0.5)
      g.closePath()
      g.fill()
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.arc(cx, cy, 4, 0, Math.PI * 2)
      g.fill()
    }
  }, [drawRef, level])
  return <canvas ref={ref} className="minimap" width={Wpx} height={Hpx} />
}

