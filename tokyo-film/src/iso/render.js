// Isometric pixel renderer. A frame is a pure function of (camera, time of day, clock): camera = { cx, cy,
// zoom (buffer pixels per metre), rot (0–3 quarter turns) }. Order: background → ground (every pixel traced
// back to its grid cell) → buildings, trees and cars sorted far to near (walls facing the viewer, then the
// roof). Colours are posterized and dithered so the frame keeps a small palette.
import { BAYER4, fillPoly, fillRing, line, mix, posterize, rgb, shade } from './raster.js'
import { GROUND, hash01 } from './world.js'

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const hex = (s) => (typeof s === 'number' ? s : Number.parseInt(String(s).replace('#', ''), 16))
const HZ = 0.95 // screen pixels per metre of height, relative to the ground scale

const SKY = [
  { t: 0, bg: 0x9fc4dc, amb: 1, lit: 0, sun: 1 },
  { t: 0.45, bg: 0xe9a77a, amb: 0.86, lit: 0.06, sun: 0.75 },
  { t: 0.68, bg: 0x4b4876, amb: 0.56, lit: 0.2, sun: 0.2 },
  { t: 1, bg: 0x0d1430, amb: 0.36, lit: 0.22, sun: 0 },
]
export function lightAt(tod) {
  const t = clamp(tod)
  let i = 0
  while (i < SKY.length - 2 && SKY[i + 1].t < t) i++
  const a = SKY[i], b = SKY[i + 1]
  const k = clamp((t - a.t) / (b.t - a.t))
  return { bg: mix(a.bg, b.bg, k), amb: a.amb + (b.amb - a.amb) * k, lit: a.lit + (b.lit - a.lit) * k, sun: a.sun + (b.sun - a.sun) * k, night: clamp((t - 0.55) / 0.4) }
}

/**
 * Rotation of world metres around the area centre by `rot` quarter turns (any real number: whole numbers
 * are the four classic views, the values in between are the turn itself), and its inverse.
 */
export function rotator(world, rot) {
  const mx = world.width / 2, my = world.height / 2
  const r = ((rot % 4) + 4) % 4
  const a = (r * Math.PI) / 2
  // Snap exact quarter turns so the classic views stay pixel-identical.
  const snap = Math.abs(r - Math.round(r)) < 1e-9
  const c = snap ? [1, 0, -1, 0][Math.round(r) % 4] : Math.cos(a)
  const s = snap ? [0, 1, 0, -1][Math.round(r) % 4] : Math.sin(a)
  const fwd = (x, y) => {
    const dx = x - mx, dy = y - my
    return [dx * c - dy * s, dx * s + dy * c]
  }
  const inv = (X, Y) => [X * c + Y * s + mx, -X * s + Y * c + my]
  /** A direction (no translation). */
  const dir = (x, y) => [x * c - y * s, x * s + y * c]
  return { fwd, inv, dir, r }
}

/** Screen projection for a camera on a W×H buffer. cam.lift raises the view by that many metres. */
export function projection(world, cam, W, H) {
  const R = rotator(world, cam.rot)
  const z = cam.zoom
  const [CX, CY] = R.fwd(cam.cx, cam.cy)
  const ox = W / 2 - (CX - CY) * z, oy = H / 2 + (CX + CY) * z * 0.5 + (cam.lift ?? 0) * z * HZ
  const toScreen = (x, y, h = 0) => {
    const [X, Y] = R.fwd(x, y)
    return [ox + (X - Y) * z, oy - (X + Y) * z * 0.5 - h * z * HZ, X + Y]
  }
  const toGround = (px, py) => {
    const A = (px - ox) / z, B = (oy - py) / (0.5 * z)
    return R.inv((A + B) / 2, (B - A) / 2)
  }
  return { R, z, ox, oy, toScreen, toGround }
}

export function createRenderer(world) {
  const st = world.style
  const G = st.ground
  const C = {
    land: hex(G.land), plaza: hex(G.plaza), green: hex(G.green), green2: hex(G.greenDark), water: hex(G.water), water2: hex(G.waterLight),
    major: hex(G.road), minor: hex(G.roadMinor), path: hex(G.path), rail: hex(G.rail), kerb: hex(G.kerb), line: hex(G.line),
    glass: hex(st.glass), lit: hex(st.windowLit), lit2: hex(st.windowWarm), trim: hex(st.trim),
    tree: hex(st.tree), tree2: hex(st.treeDark), trunk: hex(st.trunk), lamp: hex(st.lamp),
  }
  const cars = st.cars.map(hex)
  const ROADS = new Set([GROUND.major, GROUND.minor])

  function frame(r, view) {
    const W = r.width, H = r.height
    const L = lightAt(view.tod)
    const night = L.night
    const P = projection(world, view.camera, W, H)
    const z = P.z
    const dith = (x, y) => BAYER4[((y & 3) << 2) | (x & 3)]
    const tint = (c, k) => posterize(shade(c, k), 20)
    const counts = { buildings: 0, cars: 0, trees: 0 }

    // ── Ground: trace every pixel back to its grid cell ────────────────────────────────────────
    const bg = rgb(posterize(mix(L.bg, 0x2a3a52, 0.15), 20))
    const cache = new Map()
    const word = (c, k) => {
      const key = c * 64 + Math.round(k * 50)
      let w = cache.get(key)
      if (w === undefined) cache.set(key, (w = rgb(tint(c, k))))
      return w
    }
    const near = (x, y, d) => world.groundAt(x + d, y) !== world.groundAt(x, y) || world.groundAt(x - d, y) !== world.groundAt(x, y) || world.groundAt(x, y + d) !== world.groundAt(x, y) || world.groundAt(x, y - d) !== world.groundAt(x, y)
    const kerbW = Math.max(1.2, 0.9 / z)
    for (let y = 0; y < H; y++) {
      const row = y * W
      for (let x = 0; x < W; x++) {
        let [wx, wy] = P.toGround(x + 0.5, y + 0.5)
        // Outside the baked box the edge ground carries on and fades into the sky.
        const ex = wx < 0 ? -wx : wx > world.width ? wx - world.width : 0
        const ey = wy < 0 ? -wy : wy > world.height ? wy - world.height : 0
        const fade = ex || ey ? Math.min(1, Math.hypot(ex, ey) / 140) : 0
        // Ground patterns are anchored to 1.5 m world cells, so they move with the city instead of shimmering.
        const wd = BAYER4[((Math.floor(wy / 1.5) & 3) << 2) | (Math.floor(wx / 1.5) & 3)]
        if (fade >= 1 || (fade > 0 && wd < fade)) {
          r.data[row + x] = bg
          continue
        }
        wx = Math.min(world.width - 0.01, Math.max(0, wx))
        wy = Math.min(world.height - 0.01, Math.max(0, wy))
        const g = world.groundAt(wx, wy)
        let w
        if (g < 0) w = bg
        else if (g === GROUND.water) {
          // Thin ripple lines that drift with the clock.
          const ripple = Math.abs(Math.sin(wy * 0.32 + Math.sin(wx * 0.035 + view.clock * 0.35) * 2.4 + view.clock * 0.7))
          w = ripple < 0.06 && wd < 0.75 ? word(night > 0.5 ? mix(C.water2, C.lit, 0.3) : C.water2, L.amb) : word(mix(C.water, L.bg, 0.15), L.amb)
        } else if (g === GROUND.green) w = word(wd < 0.28 ? C.green2 : C.green, L.amb * 0.96)
        else if (ROADS.has(g)) {
          const edge = near(wx, wy, kerbW)
          w = edge ? word(C.kerb, L.amb) : word(g === GROUND.major ? C.major : C.minor, L.amb)
        } else if (g === GROUND.path) w = word(C.path, L.amb)
        else if (g === GROUND.rail) w = word(((Math.floor(wx * 1.2) + Math.floor(wy * 1.2)) & 1) ? C.rail : shade(C.rail, 0.8), L.amb)
        else if (g === GROUND.plaza) w = word(wd < 0.15 ? shade(C.plaza, 0.94) : C.plaza, L.amb)
        else w = word(wd < 0.12 ? shade(C.land, 0.95) : C.land, L.amb)
        r.data[row + x] = w
      }
    }
    // Street lamps glow along the roads at night (a pixel every 30 m, from the grid).
    if (night > 0.15 && z > 0.35) {
      const step = Math.max(1, Math.round(30 / world.cell))
      for (let gr = 0; gr < world.GH; gr += step) for (let gc = 0; gc < world.GW; gc += step) {
        const g = world.grid[gr * world.GW + gc]
        if (!ROADS.has(g) || hash01(gc, gr) > 0.5) continue
        const [sx, sy] = P.toScreen((gc + 0.5) * world.cell, (gr + 0.5) * world.cell, 6)
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue
        r.pixel(sx, sy, rgb(0xffe9a8))
        if (z > 0.7) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1]]) if (dith(sx + dx, sy + dy) < night * 0.6) r.pixel(sx + dx, sy + dy, rgb(0xd8b066))
      }
    }

    // ── Uprights sorted far to near ───────────────────────────────────────────────────────────────
    const draws = []
    const pad = 40
    for (const b of world.buildings) {
      const [sx, sy, depth] = P.toScreen(b.cx, b.cy)
      const reach = b.radius * z * 1.2 + 4
      if (sx < -reach - pad || sx > W + reach + pad || sy < -reach - pad || sy - b.h * z * HZ > H + reach + pad) continue
      draws.push({ d: depth, fn: () => drawBuilding(b) })
    }
    for (const t of world.trees) {
      const [sx, sy, depth] = P.toScreen(t.x, t.y)
      if (sx < -10 || sx > W + 10 || sy < -20 || sy > H + 10) continue
      draws.push({ d: depth, fn: () => drawTree(t, sx, sy) })
    }
    if (z > 0.22) {
      for (const lane of world.lanes) {
        for (let i = 0; i < lane.cars; i++) {
          const speed = 9 + hash01(lane.seed, i) * 6
          const s = ((hash01(lane.seed, i + 50) * lane.len + view.clock * speed) % lane.len + lane.len) % lane.len
          const [x, y] = world.pointOn(lane, s)
          const [sx, sy, depth] = P.toScreen(x, y)
          if (sx < -4 || sx > W + 4 || sy < -4 || sy > H + 4) continue
          draws.push({ d: depth - 0.5, fn: () => drawCar(sx, sy, cars[(lane.seed + i) % cars.length]) })
        }
      }
    }
    draws.sort((a, b) => b.d - a.d)
    for (const d of draws) d.fn()

    function drawBuilding(b) {
      const n = b.ring.length
      const g = [], t = []
      for (const [x, y] of b.ring) {
        const [gx, gy, gd] = P.toScreen(x, y, b.minH)
        const [, ty] = P.toScreen(x, y, b.h)
        g.push([gx, gy, gd])
        t.push([gx, ty])
      }
      // Visible walls face the viewer (south-west in rotated coordinates).
      const walls = []
      for (let i = 0; i < n; i++) {
        const e = b.edges[i]
        const [nX, nY] = P.R.dir(e.nx, e.ny)
        const facing = -(nX + nY)
        if (facing <= 0.02) continue
        const j = (i + 1) % n
        walls.push({ i, j, e, nX, nY, d: (g[i][2] + g[j][2]) / 2 })
      }
      walls.sort((a, b2) => b2.d - a.d)
      const floorH = b.kind === 'tower' || b.kind === 'office' ? 3.8 : b.kind === 'industrial' || b.kind === 'warehouse' ? 5 : 3.3
      const detail = z * floorH * HZ
      for (const w of walls) {
        const g0 = g[w.i], g1 = g[w.j]
        const quad = [[g0[0], g0[1]], [g1[0], g1[1]], [t[w.j][0], t[w.j][1]], [t[w.i][0], t[w.i][1]]]
        // Light comes from the screen's upper left: walls facing left are lit, walls facing right are in shade.
        // Smooth in the facing direction so walls do not flicker between lit and shaded during a turn.
        const lit = L.amb * (0.74 + 0.26 * clamp(0.5 - (w.nX - w.nY) * 0.75)) * (0.9 + 0.1 * L.sun)
        const dx = g1[0] - g0[0]
        fillPoly(r, quad, (x, y) => {
          const k = clamp(Math.abs(dx) > 0.3 ? (x + 0.5 - g0[0]) / dx : 0.5)
          const gy = g0[1] + (g1[1] - g0[1]) * k
          const hm = b.minH + (gy - (y + 0.5)) / (z * HZ)
          return rgb(texel(b, w.e.len * k, hm, lit, detail, x, y))
        })
      }
      // Roof.
      const roof = t.map(([x, y]) => [x, y])
      const roofLit = L.amb * 1.06
      fillRing(r, roof, rgb(tint(b.roofTone, roofLit)))
      if (z > 0.6) {
        const edgeC = rgb(tint(mix(b.roofTone, 0xffffff, 0.25), roofLit))
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n
          line(r, roof[i][0], roof[i][1], roof[j][0], roof[j][1], edgeC)
        }
      }
      counts.buildings++
    }
    function texel(b, u, v, lit, detail, x, y) {
      const tone = b.tone
      if (b.h - v < 0.7 && b.kind !== 'tower') return tint(mix(tone, C.trim, 0.5), lit)
      const floorH = b.kind === 'tower' || b.kind === 'office' ? 3.8 : b.kind === 'industrial' || b.kind === 'warehouse' ? 5 : 3.3
      const fl = Math.floor(v / floorH)
      const bay = b.kind === 'tower' || b.kind === 'office' ? 2 : 3
      const by = Math.floor(u / bay)
      // Windows light up in runs of three bays (an office, a flat), not one by one.
      const on = hash01(b.seed + fl * 131, Math.floor(by / 3)) < L.lit
      if (detail < 2.2) {
        // Too small for windows: floors read as alternating bands; lit windows still sparkle at night.
        const band = Math.floor(v / floorH * 2) & 1
        if (on && band && night > 0.1) return tint(C.lit2, 0.95)
        return tint(b.kind === 'tower' || b.kind === 'office' ? mix(tone, C.glass, band ? 0.45 : 0.2) : band ? shade(tone, 0.94) : tone, lit)
      }
      const lv = v / floorH - fl, lu = u / bay - by
      if (b.kind === 'tower' || b.kind === 'office') {
        if (lv < 0.16) return tint(mix(tone, 0x8c8c8c, 0.25), lit)
        if (on) return tint(lv > 0.6 ? C.lit : C.lit2, 1)
        return tint(mix(C.glass, tone, 0.3), lit * (0.92 + 0.12 * Math.sin(v * 0.3)))
      }
      if (lv > 0.3 && lv < 0.82 && lu > 0.28 && lu < 0.72) return on ? tint(lv > 0.6 ? C.lit : C.lit2, 1) : tint(C.glass, lit * 0.95)
      return tint(tone, lit)
    }
    function drawTree(t, sx, sy) {
      const rad = Math.max(1, Math.round(2.4 * t.s * z * 1.4))
      const trunkH = Math.max(1, Math.round(rad * 0.7))
      for (let i = 0; i < trunkH; i++) r.pixel(sx, sy - i, rgb(tint(C.trunk, L.amb)))
      const cy = sy - trunkH - rad
      for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
        if (x * x + y * y > rad * rad + 0.5) continue
        const c = x + y < -rad * 0.4 ? mix(C.tree, 0xd9e690, 0.22) : x + y > rad * 0.5 ? C.tree2 : C.tree
        r.pixel(sx + x, cy + y, rgb(tint(c, L.amb * 0.95)))
      }
      counts.trees++
    }
    function drawCar(sx, sy, colour) {
      const w = z > 0.7 ? 3 : 2
      for (let i = 0; i < w; i++) r.pixel(sx + i - 1, sy, rgb(tint(colour, L.amb)))
      if (z > 0.7) r.pixel(sx, sy - 1, rgb(tint(colour, L.amb * 0.8)))
      if (night > 0.2) {
        r.pixel(sx + w - 1, sy, rgb(0xfff2c0))
        r.pixel(sx - 1, sy, rgb(0xff5040))
      }
      counts.cars++
    }
    return counts
  }
  return { frame }
}
