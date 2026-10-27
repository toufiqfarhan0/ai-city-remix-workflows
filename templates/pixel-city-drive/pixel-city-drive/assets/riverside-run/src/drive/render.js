// Renders one frame of the drive into the low-resolution raster. A frame is a pure function of
// (s, lane, timeOfDay, clock): the same inputs always give the same pixels, which is what makes the film
// seekable. Order: sky → far land → ground strips far to near → every upright thing sorted far to near
// (walls, landmarks, bridges, trees, lamps, signs) → the car.
import { BAYER4, fillPoly, line, mix, posterize, rgb, shade, sprite, wallSpan } from './raster.js'
import { GLYPH_H, inkAt, layout } from './font.js'
import { ROAD_HALF, WALK, hash01 } from './world.js'

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const frac = (v) => v - Math.floor(v)
const hex = (s) => (typeof s === 'number' ? s : Number.parseInt(String(s).replace('#', ''), 16))
const VIEW = 900 // metres of road drawn ahead
const SIDE_REACH = 1500 // open water and land reach this far sideways

// Light through the day: 0 golden afternoon → sunset → dusk → blue hour → 1 night.
const SKY = [
  { t: 0, top: 0x3a78c4, hor: 0xf1cf95, amb: 1, sun: 1, lit: 0 },
  { t: 0.38, top: 0x3a5ba6, hor: 0xf49a58, amb: 0.88, sun: 0.85, lit: 0.04 },
  { t: 0.58, top: 0x272f6a, hor: 0xcf6c63, amb: 0.6, sun: 0.25, lit: 0.22 },
  { t: 0.78, top: 0x151a42, hor: 0x4f4272, amb: 0.4, sun: 0, lit: 0.48 },
  { t: 1, top: 0x080b1e, hor: 0x1f2548, amb: 0.28, sun: 0, lit: 0.6 },
]
export function lightAt(tod) {
  const t = clamp(tod)
  let i = 0
  while (i < SKY.length - 2 && SKY[i + 1].t < t) i++
  const a = SKY[i], b = SKY[i + 1]
  const k = clamp((t - a.t) / (b.t - a.t))
  return { top: mix(a.top, b.top, k), hor: mix(a.hor, b.hor, k), amb: a.amb + (b.amb - a.amb) * k, sun: a.sun + (b.sun - a.sun) * k, lit: a.lit + (b.lit - a.lit) * k, night: clamp((t - 0.5) / 0.4) }
}

export function createRenderer(world) {
  const st = world.style
  const C = {
    road: hex(st.ground.road), line: hex(st.ground.line), kerb: hex(st.ground.kerb), walk: hex(st.ground.walk), walk2: hex(st.ground.walkPattern),
    plaza: hex(st.ground.plaza), grass: hex(st.ground.grass), grass2: hex(st.ground.grassDark), water: hex(st.ground.water), water2: hex(st.ground.waterLight),
    trim: hex(st.trim), roof: hex(st.roof), glass: hex(st.glass), lit: hex(st.windowLit), lit2: hex(st.windowWarm), door: hex(st.door),
    stone: hex(st.landmarkStone), stone2: hex(st.landmarkShade), dome: hex(st.landmarkRoof), accent: hex(st.landmarkAccent),
    tree: hex(st.tree), tree2: hex(st.treeDark), trunk: hex(st.trunk), lamp: hex(st.lamp), pole: hex(st.pole),
    car: hex(st.vehicle.body), carDark: hex(st.vehicle.shade), tail: hex(st.vehicle.tail),
    bridge: hex(st.bridge.deck), pier: hex(st.bridge.pier), tower: hex(st.bridge.tower),
    signStreet: hex(st.signs.street), signLm: hex(st.signs.landmark), signInk: hex(st.signs.ink),
  }
  for (const b of world.buildings) b.toneHex = hex(b.tone)
  const sunBearing = ((st.sunBearing ?? 250) * Math.PI) / 180
  const sunDir = [Math.sin(sunBearing), Math.cos(sunBearing)]
  const signBlocks = new Map()
  const blockOf = (text) => {
    if (!signBlocks.has(text)) signBlocks.set(text, layout(text, 70, 2))
    return signBlocks.get(text)
  }

  /** frame(r, { s, lane, tod, clock, speed }) → facts about what was drawn. */
  function frame(r, view) {
    const W = r.width, H = r.height
    const L = lightAt(view.tod)
    const night = L.night
    const f = world.frame(view.s + 6)
    const pos = world.frame(view.s)
    const look = view.look ?? 0
    const cl = Math.cos(look), sl = Math.sin(look)
    const fx = f.fx * cl + f.rx * sl, fy = f.fy * cl + f.ry * sl
    const cam = {
      x: pos.x + pos.rx * view.lane, y: pos.y + pos.ry * view.lane, fx, fy, rx: fy, ry: -fx,
      eye: 4.4, focal: Math.max(W, H * 1.25) * 0.6, cx: W / 2, horizon: Math.round(H * 0.44),
    }
    const toCam = (wx, wy) => {
      const dx = wx - cam.x, dy = wy - cam.y
      return [dx * cam.rx + dy * cam.ry, dx * cam.fx + dy * cam.fy]
    }
    const fogNear = 220, fogFar = VIEW
    const fogC = mix(L.hor, L.top, 0.15)
    const fogK = (z) => clamp((z - fogNear) / (fogFar - fogNear)) * 0.92
    const dith = (x, y) => BAYER4[((y & 3) << 2) | (x & 3)]
    const tint = (c, k) => posterize(shade(c, k), 18)
    const out = (c, z, x, y) => {
      const k = fogK(z)
      return rgb(k > 0 && dith(x, y) < k ? posterize(mix(c, fogC, 0.35 + k * 0.5), 18) : c)
    }
    const counts = { walls: 0, sprites: 0, landmarks: 0, bridges: 0, signs: 0 }

    // ── Sky: dithered bands, sun or moon at real bearings, clouds and stars ──────────────────────
    const bands = 9
    const bandC = []
    for (let i = 0; i <= bands; i++) bandC.push(rgb(posterize(mix(L.top, L.hor, (i / bands) ** 1.6), 20)))
    const heading = Math.atan2(cam.fx, cam.fy)
    const angX = (bearing) => {
      let a = bearing - heading
      while (a > Math.PI) a -= 2 * Math.PI
      while (a < -Math.PI) a += 2 * Math.PI
      return Math.abs(a) < 1.4 ? cam.cx + Math.tan(a) * cam.focal : null
    }
    for (let y = 0; y < cam.horizon && y < H; y++) {
      const v = (y / cam.horizon) * bands
      const b0 = Math.floor(v), k = v - b0
      const row = y * W
      for (let x = 0; x < W; x++) r.data[row + x] = bandC[Math.min(bands, b0 + (dith(x, y) < k ? 1 : 0))]
    }
    if (night > 0.2) {
      for (let i = 0; i < 160; i++) {
        const bx = angX(hash01(i, 1) * Math.PI * 2)
        const ey = Math.floor(hash01(i, 2) * cam.horizon * 0.8)
        if (bx !== null && hash01(i, 3) < night && hash01(i, Math.floor(view.clock * 2)) > 0.08) r.pixel(bx, ey, rgb(hash01(i, 4) > 0.8 ? 0xfff3c4 : 0xc8d2ff))
      }
    }
    const sunX = angX(sunBearing)
    const sunElev = 0.32 - view.tod * 0.62 // radians-ish above the horizon; sets around tod 0.52
    if (sunX !== null && sunElev > -0.06) {
      const sy = cam.horizon - Math.tan(sunElev) * cam.focal
      const rad = Math.max(3, W * 0.022)
      for (let y = Math.floor(sy - rad - 3); y <= sy + rad + 3; y++) for (let x = Math.floor(sunX - rad - 3); x <= sunX + rad + 3; x++) {
        if (y >= cam.horizon) continue
        const d = Math.hypot(x + 0.5 - sunX, y + 0.5 - sy)
        if (d <= rad) r.pixel(x, y, rgb(mix(0xfff4c8, 0xff9a4a, clamp(view.tod * 1.6))))
        else if (d <= rad + 3 && dith(x, y) < 0.5 * (1 - (d - rad) / 3)) r.pixel(x, y, rgb(mix(L.hor, 0xffe2a0, 0.6)))
      }
    }
    const moonX = angX(sunBearing + Math.PI * 0.85)
    if (moonX !== null && night > 0.3) {
      const my = cam.horizon * 0.28, rad = Math.max(2, W * 0.012)
      for (let y = Math.floor(my - rad); y <= my + rad; y++) for (let x = Math.floor(moonX - rad); x <= moonX + rad; x++) {
        const d = Math.hypot(x + 0.5 - moonX, y + 0.5 - my), d2 = Math.hypot(x + 0.5 - moonX - rad * 0.45, y + 0.5 - my + rad * 0.2)
        if (d <= rad && d2 > rad * 0.85) r.pixel(x, y, rgb(0xf3eccd))
      }
    }
    for (let i = 0; i < 7; i++) {
      const cx = angX(hash01(i, 21) * Math.PI * 2 + view.clock * 0.004)
      if (cx === null) continue
      const cy = Math.floor(cam.horizon * (0.18 + hash01(i, 22) * 0.5))
      const cw = Math.floor(W * (0.08 + hash01(i, 23) * 0.12)), ch = Math.max(2, Math.floor(cw * 0.14))
      const cc = rgb(posterize(mix(mix(0xffffff, L.hor, 0.45), L.top, 0.25 + night * 0.5), 16))
      const cs = rgb(posterize(mix(mix(0xb8a8c8, L.top, 0.5), L.hor, 0.2), 16))
      for (let y = 0; y < ch; y++) {
        const half = (cw / 2) * Math.sqrt(1 - ((y - ch * 0.6) / ch) ** 2 * 0.9)
        for (let x = Math.floor(cx - half); x <= cx + half; x++) r.pixel(x, cy + y, y > ch * 0.6 ? cs : cc)
      }
    }

    // ── Far land fills below the horizon (anything the strips do not reach) ────────────────────
    const farLand = rgb(posterize(mix(tint(C.plaza, L.amb * 0.8), fogC, 0.7), 18))
    for (let y = Math.max(0, cam.horizon); y < H; y++) r.data.fill(farLand, y * W, y * W + W)

    // ── Ground strips, far to near ──────────────────────────────────────────────────────────────
    const step = world.step
    const iNear = Math.floor((view.s - 12) / step)
    const iFar = Math.ceil((view.s + VIEW) / step)
    const samp = new Map()
    const sample = (i) => {
      if (!samp.has(i)) samp.set(i, world.frame(i * step))
      return samp.get(i)
    }
    const near = 0.7
    const project = (poly) => {
      // poly: camera-space [x, z]; clip against z = near, then perspective onto the ground plane.
      const outp = []
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length]
        const ina = a[1] >= near, inb = b[1] >= near
        if (ina) outp.push(a)
        if (ina !== inb) {
          const k = (near - a[1]) / (b[1] - a[1])
          outp.push([a[0] + (b[0] - a[0]) * k, near])
        }
      }
      return outp.map(([x, z]) => [cam.cx + (x / z) * cam.focal, cam.horizon + (cam.eye / z) * cam.focal])
    }
    const quad = (fa, fb, d0, d1) => {
      const p = [[fa, d0], [fa, d1], [fb, d1], [fb, d0]].map(([fr, d]) => toCam(fr.x + fr.rx * d, fr.y + fr.ry * d))
      return project(p)
    }
    // Ground texel helpers: row depth and lateral position give world-anchored patterns.
    const zRow = (y) => (cam.eye * cam.focal) / Math.max(0.5, y + 0.5 - cam.horizon)
    const groundFill = (base, pattern) => (x, y) => {
      const z = zRow(y)
      const lat = ((x + 0.5 - cam.cx) * z) / cam.focal + view.lane
      const c = pattern(base, lat, z + view.s, x, y, z)
      return out(c, z, x, y)
    }
    const water = (c, lat, w, x, y, z) => {
      const wave = frac(w * 0.05 + Math.sin(lat * 0.09 + view.clock * 0.9) * 0.35 + view.clock * 0.12)
      const glint = wave < 0.08 && dith(x, y) < 0.6
      const sky = mix(c, L.hor, clamp(0.25 + z / 900))
      if (glint) return tint(night > 0.5 ? mix(C.water2, C.lit, 0.4) : C.water2, L.amb + 0.2)
      return tint(sky, L.amb * 0.95)
    }
    const walk = (c, lat, w) => {
      // Two-tone paving laid in waves (a pattern any city can swap in style.json).
      // Square paving slabs: thin joints every 1.2 m both ways.
      const joint = frac(w / 1.2) < 0.08 || frac(lat / 1.2) < 0.08
      return tint(joint ? mix(c, C.walk2, 0.22) : c, L.amb)
    }
    const grass = (c, lat, w, x, y) => tint(dith(x + Math.floor(w * 0.5), y) < 0.3 ? C.grass2 : c, L.amb * 0.95)
    const plain = (c, lat, w, x, y) => tint(dith(x, y + Math.floor(w)) < 0.12 ? shade(c, 0.92) : c, L.amb)
    const asphalt = (c, lat, w, x, y) => tint(dith(x * 3 + Math.floor(w * 0.7), y) < 0.1 ? shade(c, 1.12) : c, L.amb * 0.95)
    const kerb = ROAD_HALF + WALK
    for (let i = iFar; i >= iNear; i--) {
      const fa = sample(i), fb = sample(i + 1)
      const s = i * step
      for (const side of [-1, 1]) {
        const land = world.landAt(side, s)
        const d0 = side * kerb
        const bandsSide = land === 'w' ? [[kerb, SIDE_REACH, 'water']]
          : land === 'f' ? [[kerb, kerb + 40, 'plaza'], [kerb + 40, SIDE_REACH, 'water']]
            : land === 'q' ? [[kerb, kerb + 40, 'grass'], [kerb + 40, SIDE_REACH, 'water']]
              : land === 'p' ? [[kerb, 160, 'grass']] : [[kerb, 160, 'plaza']]
        for (const [a, b, kind] of bandsSide) {
          const poly = quad(fa, fb, side * a, side * b)
          if (poly.length < 3) continue
          fillPoly(r, poly, kind === 'water' ? groundFill(C.water, water) : kind === 'grass' ? groundFill(C.grass, grass) : groundFill(C.plaza, plain))
        }
        const sw = quad(fa, fb, side * ROAD_HALF, d0)
        if (sw.length >= 3) fillPoly(r, sw, groundFill(C.walk, walk))
        const kb = quad(fa, fb, side * ROAD_HALF, side * (ROAD_HALF + 0.35))
        if (kb.length >= 3) fillPoly(r, kb, rgb(tint(C.kerb, L.amb)))
      }
      const rd = quad(fa, fb, -ROAD_HALF, ROAD_HALF)
      if (rd.length >= 3) fillPoly(r, rd, groundFill(C.road, asphalt))
      // Lane lines: dashed between lanes and in the centre (solid near junction-free stretches).
      if (i % 3 !== 0) {
        const lc = rgb(tint(C.line, L.amb + night * 0.3))
        for (const d of [-ROAD_HALF / 2, ROAD_HALF / 2]) {
          const q = quad(fa, fb, d - 0.12, d + 0.12)
          if (q.length >= 3) fillPoly(r, q, lc)
        }
      }
      const cl = quad(fa, fb, -0.18, 0.18)
      if (cl.length >= 3) fillPoly(r, cl, rgb(tint(world.style.ground.centre ? hex(world.style.ground.centre) : C.line, L.amb + night * 0.3)))
    }

    // ── Upright things, sorted far to near ──────────────────────────────────────────────────────
    const items = world.query(view.s - 20, view.s + VIEW)
    const draws = []
    for (const it of items) {
      if (it.type === 'wall') {
        const A = toCam(...world.at(it.sa, it.da)), B = toCam(...world.at(it.sb, it.db))
        const z = (A[1] + B[1]) / 2
        if (Math.max(A[1], B[1]) < 0.6 || z > VIEW + 60) continue
        draws.push({ z: it.face === 'end' ? z + 0.2 : z, fn: () => drawWall(it, A, B) })
      } else {
        const [x, z] = toCam(...world.at(it.s, it.d))
        if (z < 0.8 || z > VIEW) continue
        draws.push({ z, fn: () => drawThing(it, x, z) })
      }
    }
    for (const l of world.landmarks) {
      const [x, z] = toCam(...world.at(l.s, l.d))
      if (z < 2 || z > 2200) continue
      draws.push({ z, fn: () => drawLandmark(l, x, z) })
    }
    for (const b of world.bridges) {
      if (b.s < view.s - 30 || b.s > view.s + VIEW + 400) continue
      draws.push({ z: toCam(...world.at(b.s, 0))[1], fn: () => drawBridge(b) })
    }
    draws.sort((a, b) => b.z - a.z)
    for (const d of draws) d.fn()

    function lambert(nx, ny) {
      return clamp(nx * sunDir[0] + ny * sunDir[1], 0, 1) * L.sun
    }
    function drawWall(it, A, B) {
      const b = it.b
      // Outward normal of the face, for sunlight: front walls face the road, end walls face along it.
      const pa = world.at(it.sa, it.da), pb = world.at(it.sb, it.db)
      let nx = pb[1] - pa[1], ny = -(pb[0] - pa[0])
      const nl = Math.hypot(nx, ny) || 1
      nx /= nl
      ny /= nl
      const mid = world.frame((it.sa + it.sb) / 2)
      const toRoad = -(b.side) * (nx * mid.rx + ny * mid.ry)
      if (it.face === 'front' && toRoad < 0) {
        nx = -nx
        ny = -ny
      }
      const lit = L.amb * (0.72 + 0.4 * lambert(nx, ny))
      const texel = facade(b, it, lit)
      if (wallSpan(r, cam, A, B, 0, b.h, it.len, (u, v, x, y, z) => {
        const c = texel(u + it.u0, v, x, y)
        return c === null ? 0 : out(c, z, x, y)
      })) counts.walls++
    }
    function facade(b, it, lit) {
      const kind = b.kind
      const tone = b.toneHex
      const floorH = kind === 'office' || kind === 'tower' ? 3.6 : kind === 'industrial' || kind === 'warehouse' ? 5 : 3.3
      const bay = kind === 'office' || kind === 'tower' ? 1.8 : kind === 'house' ? 3.4 : kind === 'civic' || kind === 'church' ? 4.2 : 3
      const ground = kind === 'shop' || ((kind === 'terrace' || kind === 'apartments') && b.d < 30 && hash01(b.id, 5) < 0.6)
      const awning = ground && hash01(b.id, 6) < 0.6 ? world.style.awnings[Math.floor(hash01(b.id, 8) * world.style.awnings.length)] : null
      const glassC = mix(C.glass, L.hor, 0.18 + 0.2 * (1 - night))
      const tile = b.pattern === 'tiles'
      const tileA = hex(world.style.tileColours?.[0] ?? '#3d6fb6'), tileB = hex(world.style.tileColours?.[1] ?? '#e9eef5')
      const cornice = kind === 'house' || kind === 'terrace' ? 0.9 : 0.5
      const end = it.face === 'end'
      return (u, v, x, y) => {
        if (v > b.h - 0.02) return null
        const top = b.h - v
        if (top < cornice) return tint(kind === 'house' || kind === 'terrace' ? C.roof : C.trim, lit * (top < cornice * 0.4 ? 0.85 : 1))
        const fl = Math.floor(v / floorH), lv = (v - fl * floorH) / floorH
        const by = Math.floor(u / bay), lu = (u - by * bay) / bay
        if (kind === 'office' || kind === 'tower') {
          const mullion = lu < 0.1 || lv < 0.12
          if (mullion) return tint(mix(tone, 0x888888, 0.2), lit)
          const on = hash01(b.seed + fl * 131, by) < L.lit * 0.8
          return on ? tint(C.lit, 1.05) : tint(mix(glassC, tone, 0.15), lit * (0.9 + 0.12 * Math.sin(v * 0.4 + u * 0.08)))
        }
        if (kind === 'industrial' || kind === 'warehouse') {
          if (fl === 0 && lu > 0.2 && lu < 0.8 && lv < 0.75 && by % 3 === 1) return tint(mix(tone, 0x30302e, 0.55), lit)
          const ribs = Math.floor(u * 1.6) % 2 === 0
          if (lv > 0.62 && lv < 0.82 && lu > 0.15 && lu < 0.85 && v > 2.5) return hash01(b.seed + fl, by) < L.lit * 0.5 ? tint(C.lit2, 1) : tint(glassC, lit)
          return tint(ribs ? tone : shade(tone, 0.9), lit)
        }
        if (fl === 0 && ground && v < floorH) {
          // Shop fronts: a band of glass behind an awning, doors between.
          if (awning && lv > 0.68 && lv < 0.86) return tint(hex(Math.floor(u * 1.2) % 2 ? awning : '#f1ece0'), lit)
          if (lv < 0.66 && lu > 0.08 && lu < 0.92) return hash01(b.seed, by + 99) < 0.2 ? tint(C.door, lit) : night > 0.25 && hash01(b.seed, by) < 0.75 ? tint(C.lit2, 1) : tint(glassC, lit * 0.95)
          return tint(mix(tone, 0x5a5048, 0.25), lit)
        }
        const win = lu > 0.28 && lu < 0.72 && lv > 0.28 && lv < 0.84
        const frame = lu > 0.24 && lu < 0.76 && lv > 0.22 && lv < 0.88
        if (win) {
          if (kind === 'church' && lv > 0.7 && Math.abs(lu - 0.5) > 0.22 - (0.84 - lv) * 0.9) return tint(tone, lit)
          const on = hash01(b.seed + fl * 977, by) < L.lit
          if (on) return tint(lv > 0.6 ? C.lit : C.lit2, 1)
          return tint(lv > 0.75 ? mix(glassC, L.top, 0.25) : glassC, lit * 0.9)
        }
        if (frame) return tint(C.trim, lit)
        if (tile && !end && v > floorH) return tint(((Math.floor(u * 3) + Math.floor(v * 3)) & 1) ? tileA : tileB, lit * (dith(x, y) < 0.15 ? 0.92 : 1))
        if (lv < 0.06 && fl > 0 && kind !== 'house') return tint(C.trim, lit * 0.95) // string course
        return tint(end ? shade(tone, 0.94) : tone, lit)
      }
    }
    function drawThing(it, x, z) {
      if (it.type === 'tree') {
        const seed = it.seed
        if (sprite(r, cam, x, z, it.w, it.h, (u, v, px, py) => {
          if (v < 0.36) return Math.abs(u) < 0.1 ? out(tint(C.trunk, L.amb), z, px, py) : 0
          const cu = u * (1.05 + 0.1 * Math.sin(v * 9 + seed)), cv = (v - 0.66) / 0.34
          const rr = cu * cu + cv * cv
          if (rr > 1 - hash01(Math.floor(u * 6 + 9), Math.floor(v * 7) + seed) * 0.25) return 0
          const k = -cu * 0.5 + cv * 0.6
          const c = k > 0.15 && dith(px, py) < 0.7 ? mix(C.tree, 0xd6e27a, 0.25) : k < -0.35 ? C.tree2 : C.tree
          return out(tint(c, L.amb * 0.95), z, px, py)
        })) counts.sprites++
      } else if (it.type === 'lamp') {
        const on = night > 0.1
        sprite(r, cam, x, z, 1.6, 7.5, (u, v, px, py) => {
          if (v > 0.93 && Math.abs(u + (it.d > 0 ? 0.5 : -0.5)) < 0.45 && v < 0.98) return rgb(on ? 0xfff0b8 : shade(C.pole, L.amb * 1.1))
          if (v > 0.96 && Math.abs(u) < 1) return out(tint(C.pole, L.amb), z, px, py)
          return Math.abs(u) < 0.16 ? out(tint(C.pole, L.amb), z, px, py) : 0
        })
        if (on && z < 400) {
          const [lx] = [cam.cx + ((x + (it.d > 0 ? -0.4 : 0.4)) / z) * cam.focal]
          const ly = cam.horizon - (7.1 - cam.eye) * (cam.focal / z)
          const rad = Math.max(1.5, (cam.focal / z) * 0.9)
          for (let yy = Math.floor(ly - rad); yy <= ly + rad; yy++) for (let xx = Math.floor(lx - rad); xx <= lx + rad; xx++) {
            const d = Math.hypot(xx + 0.5 - lx, yy + 0.5 - ly) / rad
            if (d < 1 && dith(xx, yy) < (1 - d) * 0.4 * night) r.pixel(xx, yy, rgb(0xffdd88))
          }
        }
      } else if (it.type === 'sign') {
        const blk = blockOf(it.text)
        const bw = (blk.width + 6) * 0.07, bh = (blk.height + 6) * 0.07
        const board = it.colour === 'landmark' ? C.signLm : C.signStreet
        const poleH = 3.4
        counts.signs++
        sprite(r, cam, x, z, Math.max(bw, 0.3), poleH + bh, (u, v, px, py) => {
          const hy = v * (poleH + bh)
          if (hy < poleH) return Math.abs(u) < 0.05 + 0.25 / Math.max(1, bw) ? out(tint(C.pole, L.amb), z, px, py) : 0
          const fx = ((u + 1) / 2) * (blk.width + 6), fy = (1 - (hy - poleH) / bh) * (blk.height + 6)
          if (fx < 1 || fy < 1 || fx > blk.width + 5 || fy > blk.height + 5) return out(tint(C.signInk, L.amb + night * 0.4), z, px, py)
          const ink = inkAt(blk, Math.floor(fx - 3), Math.floor(fy - 3))
          return out(tint(ink ? C.signInk : board, L.amb + night * 0.45), z, px, py)
        })
      }
    }
    function drawLandmark(l, x, z) {
      const flood = night > 0.25
      const lit = flood ? 0.95 : L.amb * (0.85 + 0.25 * L.sun)
      const shapeOf = SHAPES[l.kind] ?? SHAPES.monument
      const seed = l.id
      if (sprite(r, cam, x, z, l.w, l.h, (u, v, px, py) => {
        const m = shapeOf(u, v, seed)
        if (!m) return 0
        const c = m === 1 ? C.stone : m === 2 ? C.stone2 : m === 3 ? C.dome : m === 4 ? (flood && hash01(Math.floor(u * 9), Math.floor(v * 9)) < 0.5 ? C.lit2 : mix(C.glass, L.top, 0.3)) : C.accent
        const glow = flood && m <= 2 ? mix(c, 0xffd9a0, 0.28 * (1 - v * 0.6)) : c
        return out(tint(glow, m === 4 ? 1 : lit), Math.min(z, VIEW), px, py)
      })) counts.landmarks++
    }
    function drawBridge(b) {
      const sus = b.structure === 'suspension'
      const deckH = b.h, thick = sus ? 7 : b.kind === 'foot' ? 0.8 : 1.4
      const span = sus ? 900 : b.kind === 'foot' ? kerb + 2 : kerb + 14
      const deck = b.kind === 'rail' ? C.pier : C.bridge
      const A = toCam(...world.at(b.s, -span)), B = toCam(...world.at(b.s, span))
      wallSpan(r, cam, A, B, deckH, deckH + thick, span * 2, (u, v, x, y, z) => {
        const rail = v > deckH + thick - 0.25 || (b.kind === 'foot' && v > deckH + thick - 0.5 && Math.floor(u * 2) % 2 === 0)
        const truss = sus && (Math.abs(frac(u / 12) - 0.5) * 2 < (v - deckH) / thick)
        return out(tint(rail ? shade(deck, 0.8) : truss ? shade(deck, 0.86) : deck, L.amb * 0.95), z, x, y)
      })
      // Piers either side of the carriageway.
      for (const sd of [-1, 1]) {
        const dd = sd * (sus ? kerb + 6 : ROAD_HALF + (b.kind === 'foot' ? WALK + 0.8 : 0.9))
        const w = sus ? 4 : 0.9
        const P = toCam(...world.at(b.s - w / 2, dd)), Q = toCam(...world.at(b.s + w / 2, dd))
        wallSpan(r, cam, P, Q, 0, deckH, w, (u, v, x, y, z) => out(tint(C.pier, L.amb * (0.8 + 0.2 * (u / w))), z, x, y))
      }
      if (sus && b.water) {
        // The main tower stands out over the water, with its cables sweeping down to the deck.
        const td = b.water * 360, tw = 9, gap = 34, top = deckH + 120
        for (const off of [-gap / 2, gap / 2]) {
          const P = toCam(...world.at(b.s + off - tw / 2, td)), Q = toCam(...world.at(b.s + off + tw / 2, td))
          wallSpan(r, cam, P, Q, 0, top, tw, (u, v, x, y, z) => out(tint(C.tower, L.amb * (u < tw * 0.3 ? 0.82 : 1)), z, x, y))
        }
        for (const hh of [deckH + 30, deckH + 78, top - 4]) {
          const P = toCam(...world.at(b.s - gap / 2, td)), Q = toCam(...world.at(b.s + gap / 2, td))
          wallSpan(r, cam, P, Q, hh, hh + 4, gap, (u, v, x, y, z) => out(tint(C.tower, L.amb * 0.9), z, x, y))
        }
        const [tx, tz] = toCam(...world.at(b.s, td))
        const towerX = tz > 1 ? cam.cx + (tx / tz) * cam.focal : -1
        if (tz > 1 && towerX > -W * 0.2 && towerX < W * 1.2) {
          const sx = towerX, sy = cam.horizon - (top - cam.eye) * (cam.focal / tz)
          for (const along of [-1, 1]) for (let k = 1; k <= 3; k++) {
            const [ex, ez] = toCam(...world.at(b.s, td - b.water * (120 + k * 140) * along))
            if (ez < 1) continue
            line(r, sx, sy, cam.cx + (ex / ez) * cam.focal, cam.horizon - (deckH + thick - cam.eye) * (cam.focal / ez), rgb(tint(C.tower, L.amb * 0.8)))
          }
        }
      }
      counts.bridges++
    }

    // ── The car, seen from behind, in its lane ─────────────────────────────────────────────────
    if (world.style.vehicle.kind !== 'none') drawCar(r, view, L, night, C, look)
    return counts
  }
  return { frame }
}

// Landmark silhouettes by kind: (u -1..1, v 0..1) → 0 empty, 1 stone, 2 shaded stone, 3 roof/dome,
// 4 window, 5 accent. Shapes are generic, so the same code draws any city's towers, churches and monuments.
const merlon = (u, n, v, y0, y1) => v > y0 && v < y1 && frac(u * n) > 0.5
export const SHAPES = {
  tower(u, v) {
    const au = Math.abs(u)
    if (v < 0.3) return au < 1 ? (au > 0.94 ? 2 : frac(v * 30) < 0.08 ? 2 : 1) : 0
    if (v < 0.34) return au < 1 && !merlon(u, 6, v, 0.3, 0.34) ? 1 : au > 0.86 && au < 1 ? 1 : 0
    if (au > 0.82 && au < 1 && v < 0.42) return v > 0.38 ? 3 : 1 // corner turrets on the bastion
    if (au < 0.44 && v < 0.84) {
      if (v > 0.52 && v < 0.6 && frac(u * 4 + 0.5) > 0.3) return 4 // a loggia of arches
      if ((v > 0.66 && v < 0.72) && Math.abs(frac(u * 2.2 + 0.5) - 0.5) < 0.16) return 4
      return au > 0.38 ? 2 : 1
    }
    if (au < 0.44 && v < 0.88) return merlon(u, 9, v, 0.84, 0.88) ? 0 : 1
    if (au > 0.34 && au < 0.46 && v < 0.98) return v > 0.92 ? 3 : 1
    return 0
  },
  lighthouse(u, v) {
    const w = 0.55 * (1 - v * 0.35)
    if (v < 0.8) return Math.abs(u) < w ? (Math.floor(v * 7) % 2 ? 5 : 1) : 0
    if (v < 0.92) return Math.abs(u) < 0.36 ? 4 : 0
    return Math.abs(u) < 0.42 * (1 - (v - 0.92) / 0.08) ? 3 : 0
  },
  fort(u, v) {
    const au = Math.abs(u)
    if (au > 0.8 && au < 1 && v < 0.78) return v > 0.7 && frac(u * 18) > 0.5 ? 0 : au > 0.95 ? 2 : 1
    if (au < 0.8 && v < 0.55) return merlon(u, 14, v, 0.5, 0.55) ? 0 : frac(v * 20) < 0.06 ? 2 : 1
    return 0
  },
  church(u, v) {
    const au = Math.abs(u)
    // A long nave with a pitched roof, one tower with a dome at the west end, buttresses and tall windows.
    if (u < -0.62 && u > -0.98) {
      if (v < 0.78) return v > 0.5 && v < 0.62 && Math.abs(u + 0.8) < 0.07 ? 4 : u < -0.94 ? 2 : 1
      const w = 0.18 * (1 - (v - 0.78) / 0.22)
      return Math.abs(u + 0.8) < w ? 3 : 0
    }
    if (au < 1 && v < 0.42) {
      if (v > 0.12 && v < 0.34 && Math.abs(frac(u * 5) - 0.5) < 0.12) return 4
      if (frac(u * 5) < 0.06) return 2
      return 1
    }
    if (au < 1 && v < 0.42 + (1 - au) * 0.12 && u > -0.62) return 3
    return 0
  },
  monument(u, v) {
    if (v < 0.07) return Math.abs(u) < 1 ? 2 : 0
    const w = 0.52 - (v - 0.07) * 0.34
    if (Math.abs(u) < w) return u > w * 0.55 ? 2 : frac(v * 14) < 0.05 ? 2 : 1
    if (v < 0.3 && u < 0 && u > -w - (0.3 - v) * 1.4) return 2 // a prow at the foot
    return 0
  },
  museum(u, v) {
    const roof = 0.62 + 0.28 * Math.cos(u * 2.2)
    if (Math.abs(u) > 1 || v > roof) return 0
    if (v > roof - 0.12) return 3
    if (v < 0.28 && frac(u * 8) > 0.2) return 4
    return frac(u * 16) < 0.12 ? 2 : 1
  },
  palace(u, v) {
    const au = Math.abs(u)
    if (au < 0.26 && v > 0.7 && v < 0.7 + (0.26 - au) * 0.6) return 3
    if (au > 1 || v > 0.7) return 0
    if (v > 0.64) return 2
    const fl = Math.floor(v * 3.2), lv = frac(v * 3.2)
    if (fl < 3 && lv > 0.3 && lv < 0.8 && Math.abs(frac(u * 7) - 0.5) < 0.16) return 4
    return au < 0.26 ? 1 : frac(u * 7) < 0.04 ? 2 : 1
  },
}

function drawCar(r, view, L, night, C, look = 0) {
  const W = r.width, H = r.height
  const cw = Math.round(Math.min(W * 0.26, H * 0.42)), ch = Math.round(cw * 0.5)
  const bob = view.speed > 3 && Math.floor(view.clock * 9) % 2 ? 1 : 0
  const x0 = Math.round(W / 2 - cw / 2 - Math.sin(look) * W * 0.25), y0 = H - ch - Math.round(H * 0.035) + bob
  const amb = L.amb
  const body = rgb(posterize(shade(C.car, amb * 1.05), 18)), dark = rgb(posterize(shade(C.carDark, amb), 18))
  const glassTop = rgb(posterize(mix(L.top, 0x10121a, 0.35), 18)), glassLow = rgb(posterize(mix(L.hor, 0x10121a, 0.45), 18))
  const tail = rgb(night > 0.2 ? 0xff4a3a : posterize(shade(C.tail, amb), 18)), tyre = rgb(0x17181c), chrome = rgb(posterize(shade(0xd8dade, amb), 18))
  const shadow = rgb(0x111214)
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const u = x / (cw - 1), v = y / (ch - 1)
      let c = 0
      const inset = v < 0.42 ? 0.17 - (0.42 - v) * 0.15 : 0
      if (v > 0.9) c = (u < 0.2 && u > 0.04) || (u > 0.8 && u < 0.96) ? tyre : u > 0.06 && u < 0.94 ? shadow : 0
      else if (u < inset || u > 1 - inset) c = 0
      else if (v < 0.04) c = 0
      else if (v < 0.42) c = u < inset + 0.04 || u > 1 - inset - 0.04 || v < 0.1 ? body : v < 0.22 ? glassTop : glassLow
      else if (v < 0.5) c = dark
      else if (v < 0.66 && (u < 0.17 || u > 0.83)) c = tail
      else if (v > 0.6 && v < 0.74 && u > 0.38 && u < 0.62) c = chrome
      else c = v > 0.78 ? dark : body
      if (c) r.pixel(x0 + x, y0 + y, c)
    }
  }
  if (night > 0.2) {
    // Tail-light glow on the road.
    for (let y = y0 + ch; y < Math.min(H, y0 + ch + 4); y++) for (let x = x0; x < x0 + cw; x++) if (BAYER4[((y & 3) << 2) | (x & 3)] < 0.18 * night && (x - x0 < cw * 0.25 || x - x0 > cw * 0.75)) r.pixel(x, y, rgb(0x8a2a24))
  }
}
