// The masonry kit: turns a landmark recipe (recipe.json) into a flat list of solid pieces, each with its own
// place in the construction schedule. Pure data, no Three.js, so the Node tests audit exactly what the page
// builds.
//
// A piece is { shape, mat, p: [x, y, z], s: [sx, sy, sz], rx, ry, rz, start, dur, lift, tint, part, ex, cut }:
//   shape  box | cyl | dome | ring      (unit shapes; s scales them)
//   start  when it begins to drop into place (0–1 of the build), dur how long it takes, lift how far it falls
// Parts lay courses bottom to top; within a part, a course is placed around the footprint in order, so walls
// rise as real masonry: no scaled storeys, no fading. Openings are left out of the coursing (real voids) and
// arched openings get voussoirs. `ex` is where the piece moves in the exploded (dismantled) view, in metres at
// full explode; a piece with a `cut` key (0–1) instead slides off and disappears once the dismantle value
// passes the key (a cutaway), so a shell opens on one side while its frame stays in place.

export const SHAPES = ['box', 'cyl', 'dome', 'ring', 'cone']

// How far each kind of part moves in the exploded view (metres), unless the part sets `explode`.
const DEFAULT_EXPLODE = { walls: 2, battlement: 3, stringcourse: 2.4, turret: 4, loggia: 3, roof: 3, platform: 0, figure: 1.6, limb: 0, frame: 0, armature: 0, rays: 0, slab: 0, flame: 0 }

/** Small deterministic PRNG (mulberry32). */
export function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/**
 * Edges of a footprint polygon [[x, z], …]: { a, b, len, ux, uz, nx, nz } with n pointing outward. `open`
 * leaves out the closing edge (a run of wall that meets another part, such as a bastion against a tower).
 */
export function edgesOf(fp, open = false) {
  let area = 0
  for (let i = 0; i < fp.length; i++) {
    const [x1, z1] = fp[i], [x2, z2] = fp[(i + 1) % fp.length]
    area += x1 * z2 - x2 * z1
  }
  const ccw = area > 0
  return (open ? fp.slice(0, -1) : fp).map((a, i) => {
    const b = fp[(i + 1) % fp.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len
    // In x–z with y up, the outward normal of a counter-clockwise polygon is (uz, -ux).
    const nx = ccw ? uz : -uz, nz = ccw ? -ux : ux
    return { a, b, len, ux, uz, nx, nz }
  })
}

/** Builds the pieces of a recipe. Returns { pieces, stages, bounds, counts }. */
export function buildRecipe(recipe) {
  if (!recipe || !Array.isArray(recipe.parts) || !Array.isArray(recipe.stages)) throw Object.assign(new Error('recipe'), { code: 'data' })
  const stages = recipe.stages.map((s) => ({ ...s }))
  const stageOf = (id) => {
    const st = stages.find((s) => s.id === id)
    if (!st) throw Object.assign(new Error(`unknown stage ${id}`), { code: 'data' })
    return st
  }
  const rand = prng(recipe.seed ?? 7)
  const pieces = []
  const counts = {}
  // Each part collects its pieces with a rank (course, then position around); ranks map onto its stage window.
  recipe.parts.forEach((part, partIndex) => {
    const st = stageOf(part.stage)
    const local = []
    const add = (rank, piece) => local.push({ rank, piece })
    const fn = PARTS[part.type]
    if (!fn) throw Object.assign(new Error(`unknown part ${part.type}`), { code: 'data' })
    fn(part, add, rand, recipe)
    local.sort((a, b) => a.rank - b.rank)
    // part.window narrows the stage to a sub-range (e.g. a string course placed as the walls pass it).
    const [w0, w1] = part.window ?? [0, 1]
    const from = st.from + (st.to - st.from) * w0
    const span = (st.to - st.from) * (w1 - w0)
    const n = local.length
    const dur = clamp(span * (part.overlap ?? 0.14), 0.004, 0.05)
    local.forEach(({ piece }, i) => {
      const k = n > 1 ? i / (n - 1) : 0
      piece.start = from + Math.max(0, span - dur) * k
      piece.dur = dur
      piece.lift = piece.lift ?? part.lift ?? 2.2
      piece.part = partIndex
      if (!piece.ex) piece.ex = [0, 0, 0]
      if (piece.cut === undefined) piece.cut = -1
      const reach = part.explode ?? DEFAULT_EXPLODE[part.type] ?? 0
      piece.ex = piece.ex.map((v) => v * reach)
      pieces.push(piece)
    })
    counts[part.type] = (counts[part.type] ?? 0) + n
  })
  let minY = Infinity, maxY = -Infinity, r = 0
  for (const p of pieces) {
    minY = Math.min(minY, p.p[1] - p.s[1] / 2)
    maxY = Math.max(maxY, p.p[1] + p.s[1] / 2)
    r = Math.max(r, Math.hypot(p.p[0], p.p[2]))
  }
  return { pieces, stages, bounds: { minY, maxY, radius: r }, counts }
}

// ── Part types ─────────────────────────────────────────────────────────────────────────────────────
const tintOf = (rand, spread = 0.07) => 1 - spread / 2 + rand() * spread

/** Coursed walls along a footprint, with openings as voids and voussoir arches over arched openings. */
function walls(part, add, rand) {
  const { base = 0, height, thickness = 1, course = 0.55, block = 1.1, mat = 'stone', backing = 'mortar' } = part
  const edges = edgesOf(part.footprint, part.open)
  const rows = Math.max(1, Math.round(height / course))
  const ch = height / rows
  const openings = (part.openings ?? []).map((o) => ({ ...o, edge: o.edge }))
  const inOpening = (ei, u, y) => openings.some((o) => {
    if (o.edge !== ei && o.edge !== 'all') return false
    const e = edges[ei]
    const centres = o.edge === 'all' || o.repeat ? (o.at ?? [0.5]).flat() : [o.at ?? 0.5]
    return centres.some((c) => {
      const cu = c * e.len
      const top = o.y + o.h + (o.arch ? o.w / 2 : 0)
      if (Math.abs(u - cu) > o.w / 2 + 0.02 || y < o.y || y > top) return false
      if (!o.arch || y < o.y + o.h) return true
      const dy = y - (o.y + o.h)
      return Math.abs(u - cu) < Math.sqrt(Math.max(0, (o.w / 2) ** 2 - dy * dy)) + 0.05
    })
  })
  edges.forEach((e, ei) => {
    for (let row = 0; row < rows; row++) {
      const y = base + ch * (row + 0.5)
      // Corners interlock: alternate rows run past the corner by one block depth, covering the end of the
      // neighbouring wall's course (a closed run's ends meet other parts, so they do not run past).
      const lap = thickness * 0.36
      const ext0 = row % 2 && !(part.open && ei === 0) ? lap : 0
      const ext1 = row % 2 || (part.open && ei === edges.length - 1) ? 0 : lap
      const from = -ext0, to = e.len + ext1
      const len = to - from
      const nb = Math.max(1, Math.round(len / block))
      const bw = len / nb
      const shift = row % 2 ? bw / 2 : 0
      // Backing core for this course (keeps joints from showing daylight), inset half the thickness.
      const midU = (from + to) / 2
      add(row * 1000 + ei * 0.01, piece('box', backing, e, midU, y, -thickness / 2, [len - 0.04, ch * 0.98, thickness * 0.7], 1, { lift: 0 }))
      for (let k = -1; k < nb; k++) {
        let u0 = from + k * bw + shift
        let u1 = u0 + bw
        u0 = Math.max(from, u0)
        u1 = Math.min(to, u1)
        if (u1 - u0 < 0.08) continue
        const u = (u0 + u1) / 2
        if (inOpening(ei, u, y)) continue
        const w = (u1 - u0) * (0.965 + rand() * 0.02)
        const depth = thickness * (0.32 + rand() * 0.06)
        add(row * 1000 + ei * 100 + (u - from) / len * 99, piece('box', mat, e, u, y, -depth / 2 + 0.01, [w, ch * 0.93, depth], tintOf(rand)))
      }
    }
    // Voussoirs over arched openings on this edge.
    for (const o of openings) {
      if (o.edge !== ei && o.edge !== 'all' || !o.arch) continue
      for (const c of (o.edge === 'all' || o.repeat ? (o.at ?? [0.5]).flat() : [o.at ?? 0.5])) {
        const cu = c * e.len
        const r = o.w / 2 + 0.18
        const n = Math.max(5, Math.round((Math.PI * r) / 0.42))
        const springRow = Math.floor((o.y + o.h - base) / ch)
        for (let i = 0; i < n; i++) {
          const a = Math.PI * (i + 0.5) / n
          const u = cu - Math.cos(a) * r
          const y = o.y + o.h + Math.sin(a) * r
          add(springRow * 1000 + 990 + i * 0.1, piece('box', o.trim ?? 'trim', e, u, y, -0.2, [0.3, 0.42, thickness * 0.45], tintOf(rand, 0.05), { rz: Math.PI / 2 - a }))
        }
      }
    }
  })
}

/** Merlons with caps along a footprint at height y. */
function battlement(part, add, rand) {
  const { y, merlon = 0.9, gap = 0.6, h = 1.1, depth = 0.7, mat = 'stone', cap = 'trim' } = part
  edgesOf(part.footprint, part.open).forEach((e, ei) => {
    const pitch = merlon + gap
    const n = Math.max(1, Math.floor((e.len + gap) / pitch))
    const off = (e.len - (n * pitch - gap)) / 2
    for (let i = 0; i < n; i++) {
      const u = off + i * pitch + merlon / 2
      add(ei * 100 + i, piece('box', mat, e, u, y + h / 2, -depth / 2, [merlon, h, depth], tintOf(rand)))
      add(ei * 100 + i + 0.5, piece('box', cap, e, u, y + h + 0.1, -depth / 2, [merlon * 0.92, 0.2, depth * 1.08], 1))
      if (part.shield) add(ei * 100 + i + 0.7, piece('box', 'accent', e, u, y + h * 0.48, 0.05, [merlon * 0.36, h * 0.42, 0.1], 1))
    }
  })
}

/** A projecting band of trim stone along a footprint. */
function stringcourse(part, add) {
  const { y, h = 0.28, out = 0.22, mat = 'trim' } = part
  edgesOf(part.footprint, part.open).forEach((e, ei) => {
    const n = Math.max(1, Math.round(e.len / 1.6))
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) / n) * (e.len + out * 2) - out
      add(ei * 100 + i, piece('box', mat, e, u, y, out / 2, [(e.len + out * 2) / n - 0.02, h, out + 0.3], 1))
    }
  })
}

/** A flat stepped platform of slabs (foundations, terraces, roof decks). */
function platform(part, add, rand) {
  const { x = 0, z = 0, w, d, y = 0, h = 1, step = 2.2, mat = 'stone' } = part
  const rows = Math.max(1, Math.round(h / (part.course ?? 0.5)))
  const ch = h / rows
  for (let r = 0; r < rows; r++) {
    const inset = (part.batter ?? 0) * (r / rows)
    const nx = Math.max(1, Math.round((w - inset * 2) / step)), nz = Math.max(1, Math.round((d - inset * 2) / step))
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const sx = (w - inset * 2) / nx, sz = (d - inset * 2) / nz
      add(r * 10000 + j * 100 + i, { shape: 'box', mat, p: [x - w / 2 + inset + sx * (i + 0.5), y + ch * (r + 0.5), z - d / 2 + inset + sz * (j + 0.5)], s: [sx * 0.97, ch * 0.94, sz * 0.97], ry: 0, rz: 0, tint: tintOf(rand, 0.1) })
    }
  }
}

/** A round sentry turret: corbel ring, coursed drum, a cornice ring and a ribbed dome with a finial. */
function turret(part, add, rand) {
  const [x, z] = part.at
  const rl = Math.hypot(x, z) || 1
  const out = [x / rl, 0.25, z / rl]
  const add0 = add
  add = (rank, p) => add0(rank, { ...p, ex: out })
  const { y, r = 1, h = 2.4, course = 0.4, mat = 'stone', dome = 'dome' } = part
  const corbels = part.corbels ?? 3
  for (let i = 0; i < corbels; i++) {
    const rr = r * (0.55 + (0.45 * (i + 1)) / corbels)
    add(i, { shape: 'cyl', mat: 'trim', p: [x, y - 0.9 + i * 0.3, z], s: [rr, 0.28, rr], ry: 0, rz: 0, tint: 1 })
  }
  const rows = Math.max(2, Math.round(h / course))
  for (let i = 0; i < rows; i++) add(10 + i, { shape: 'ring', mat, p: [x, y + (h / rows) * (i + 0.5), z], s: [r, (h / rows) * 0.94, r], ry: (i % 2) * 0.3, rz: 0, tint: tintOf(rand) })
  // Slit windows as dark recesses facing outward from the building centre.
  const ang = Math.atan2(x, z)
  add(10 + rows * 0.6, { shape: 'box', mat: 'void', p: [x + Math.sin(ang) * r * 0.97, y + h * 0.55, z + Math.cos(ang) * r * 0.97], s: [0.18, h * 0.42, 0.1], ry: ang, rz: 0, tint: 1 })
  add(100, { shape: 'cyl', mat: 'trim', p: [x, y + h + 0.1, z], s: [r * 1.12, 0.2, r * 1.12], ry: 0, rz: 0, tint: 1 })
  add(101, { shape: 'dome', mat: dome, p: [x, y + h + 0.2, z], s: [r * 1.02, r * (part.domeRise ?? 1.05), r * 1.02], ry: 0, rz: 0, tint: 1 })
  const ribs = part.ribs ?? 8
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2
    add(102 + i * 0.01, { shape: 'box', mat: 'trim', p: [x + Math.sin(a) * r * 0.72, y + h + 0.2 + r * 0.62, z + Math.cos(a) * r * 0.72], s: [0.09, r * 0.95, 0.09], ry: a, rz: 0, rx: -0.72, tint: 1 })
  }
  add(110, { shape: 'cyl', mat: 'trim', p: [x, y + h + 0.2 + r * (part.domeRise ?? 1.05) + 0.25, z], s: [0.12, 0.5, 0.12], ry: 0, rz: 0, tint: 1 })
}

/** An arcaded balcony on one edge: slab, columns, voussoir arches, a balustrade and a roof slab. */
function loggia(part, add, rand, recipe) {
  const fp = part.footprint ?? recipe.parts.find((p) => p.id === part.of)?.footprint
  const e = edgesOf(fp)[part.edge]
  const { y, bays = 5, h = 3.2, out = 1.6, margin = 1 } = part
  const span = e.len - margin * 2
  const bw = span / bays
  add(0, piece('box', 'trim', e, e.len / 2, y - 0.15, out / 2, [span + 0.4, 0.3, out + 0.2], 1))
  for (let i = 0; i < bays; i++) for (let k = 0; k < 6; k++) add(1 + i * 0.1 + k * 0.01, piece('box', 'trim', e, margin + bw * i + bw * (k + 0.5) / 6, y + 0.45, out - 0.08, [0.12, 0.6, 0.12], 1))
  add(2, piece('box', 'trim', e, e.len / 2, y + 0.8, out - 0.08, [span, 0.12, 0.2], 1))
  for (let i = 0; i <= bays; i++) {
    const u = margin + bw * i
    add(3 + i * 0.01, piece('cyl', 'trim', e, u, y + (h - bw / 2) / 2, out - 0.15, [0.16, h - bw / 2, 0.16], 1))
  }
  for (let i = 0; i < bays; i++) {
    const cu = margin + bw * (i + 0.5), r = bw / 2
    const n = 9
    for (let k = 0; k < n; k++) {
      const a = Math.PI * (k + 0.5) / n
      add(4 + i * 0.1 + k * 0.001, piece('box', part.mat ?? 'stone', e, cu - Math.cos(a) * r, y + h - bw / 2 + Math.sin(a) * r, out - 0.15, [0.22, 0.3, 0.32], tintOf(rand, 0.05), { rz: Math.PI / 2 - a }))
    }
  }
  add(5, piece('box', part.mat ?? 'stone', e, e.len / 2, y + h + 0.3, out / 2, [span + 0.4, 0.6, out + 0.2], tintOf(rand)))
}

/** A pyramid or spire roof built from shrinking courses, with a finial. */
function roof(part, add0, rand) {
  const { x = 0, z = 0, y, w, d = w, h, courses = 10, mat = 'roof' } = part
  const add = (rank, p) => add0(rank, { ...p, ex: [0, 1, 0] })
  for (let i = 0; i < courses; i++) {
    const k = 1 - i / courses
    add(i, { shape: 'box', mat, p: [x, y + (h / courses) * (i + 0.5), z], s: [w * k, (h / courses) * 0.98, d * k], ry: 0, rz: 0, tint: tintOf(rand, 0.06) })
  }
  add(courses, { shape: 'cyl', mat: 'accent', p: [x, y + h + 0.6, z], s: [0.1, 1.2, 0.1], ry: 0, rz: 0, tint: 1 })
}

/** How many pieces are visible (started) at build progress p: CPU mirror of the shader rule. */
export function placedAt(pieces, p) {
  let n = 0
  for (const x of pieces) if (p > x.start + 1e-4 * x.dur) n++
  return n
}


// ── Sculpture parts: a hollow shell of thin plates on an internal frame ───────────────────────────────
/**
 * Sections [{ y, rx, rz, cx?, cz? }] (y relative to `base`) interpolated linearly; returns the ellipse at y.
 */
function sectionAt(sections, y) {
  if (y <= sections[0].y) return sections[0]
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1], b = sections[i]
    if (y <= b.y) {
      const k = (y - a.y) / (b.y - a.y || 1)
      const m = (u, v) => (u ?? 0) + ((v ?? 0) - (u ?? 0)) * k
      return { y, rx: m(a.rx, b.rx), rz: m(a.rz, b.rz), cx: m(a.cx, b.cx), cz: m(a.cz, b.cz) }
    }
  }
  return sections.at(-1)
}

/**
 * Cutaway of a shell plate. Plates on the side the part opens toward (`cut`, a yaw in radians; default the
 * front, +z; null keeps the shell whole) get a cut key: as the dismantle value passes it the plate slides off
 * along its normal and disappears, top first, so a section line sweeps down and the frame inside shows.
 * Plates on the far side stay, so the silhouette remains.
 */
function cutOf(part, nx, nz, y, top) {
  if (part.cut === null) return { cut: -1, ex: [0, 0, 0] }
  const a = part.cut ?? 0
  const facing = nx * Math.sin(a) + nz * Math.cos(a)
  if (facing <= 0.08) return { cut: -1, ex: [0, 0, 0] }
  return { cut: 0.04 + 0.82 * (1 - y / top), ex: [nx, 0.1, nz] }
}

/** A draped figure: bands of plates around elliptical sections, with fold ridges below `foldsTo`. */
function figure(part, add, rand) {
  const { base = 0, sections, band = 0.9, segments = 28, folds = 13, foldDepth = 0.28, foldsTo = 0, mat = 'copper', thickness = 0.14 } = part
  const top = sections.at(-1).y
  const rows = Math.max(2, Math.round(top / band))
  const bh = top / rows
  for (let r = 0; r < rows; r++) {
    const y = bh * (r + 0.5)
    const sec = sectionAt(sections, y)
    const below = sectionAt(sections, Math.max(0, y - bh / 2)), above = sectionAt(sections, Math.min(top, y + bh / 2))
    const slope = Math.atan2((below.rx + below.rz) / 2 - (above.rx + above.rz) / 2, bh)
    const fold = y < foldsTo ? foldDepth * (1 - y / foldsTo) : 0
    const n = Math.max(6, Math.round(segments * Math.min(1, (sec.rx + sec.rz) / 8 + 0.35)))
    for (let i = 0; i < n; i++) {
      const a = ((i + (r % 2) * 0.5) / n) * Math.PI * 2
      const rr = 1 + (fold * Math.sin(a * folds)) / Math.max(1, (sec.rx + sec.rz) / 2)
      const x = (sec.cx ?? 0) + sec.rx * rr * Math.cos(a)
      const z = (sec.cz ?? 0) + sec.rz * rr * Math.sin(a)
      const tx = -sec.rx * Math.sin(a), tz = sec.rz * Math.cos(a)
      const tl = Math.hypot(tx, tz) || 1
      const nx = sec.rz * Math.cos(a), nz = sec.rx * Math.sin(a)
      const nl = Math.hypot(nx, nz) || 1
      const w = ((Math.PI * 2 * (sec.rx + sec.rz)) / 2 / n) * 1.04
      add(r * 1000 + i, { shape: 'box', mat, p: [x, base + y, z], s: [w, bh * 1.02, thickness], ry: Math.atan2(-tz / tl, tx / tl), rx: -slope, rz: 0, tint: tintOf(rand, 0.08), ...cutOf(part, nx / nl, nz / nl, y, top) })
    }
  }
}

/** A tube of plates along a polyline (an arm, a torch handle): points [[x, y, z], …], radii per point. */
function limb(part, add, rand) {
  const { points, radii, ring = 0.8, segments = 12, mat = 'copper', thickness = 0.12 } = part
  let rank = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const len = Math.hypot(...d)
    const u = d.map((v) => v / len)
    // Two unit vectors across the tube.
    const ref = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    const c1 = norm(cross(u, ref)), c2 = cross(u, c1)
    const steps = Math.max(1, Math.round(len / ring))
    for (let k = 0; k < steps; k++) {
      const t = (k + 0.5) / steps
      const r = radii[i - 1] + (radii[i] - radii[i - 1]) * t
      const c = a.map((v, j) => v + d[j] * t)
      for (let j = 0; j < segments; j++) {
        const ang = ((j + (k % 2) * 0.5) / segments) * Math.PI * 2
        const n = c1.map((v, q) => v * Math.cos(ang) + c2[q] * Math.sin(ang))
        add(rank++, { shape: 'box', mat, p: c.map((v, q) => v + n[q] * r), s: [((Math.PI * 2 * r) / segments) * 1.05, (len / steps) * 1.04, thickness], basis: [cross(u, n), u, n], tint: tintOf(rand, 0.08), ex: [n[0], n[1] + 0.2, n[2]] })
      }
    }
  }
}

/** The internal pylon: four posts rising in segments with ties and diagonal braces between them. */
function frame(part, add) {
  const { x = 0, z = 0, base = 0, height, w = 2.4, step = 2, mat = 'iron', post = 0.5 } = part
  const n = Math.max(1, Math.round(height / step))
  const sh = height / n
  const corners = [[-w / 2, -w / 2], [w / 2, -w / 2], [w / 2, w / 2], [-w / 2, w / 2]]
  for (let i = 0; i < n; i++) {
    const y = base + sh * i
    for (const [cx, cz] of corners) add(i * 100, { shape: 'box', mat, p: [x + cx, y + sh / 2, z + cz], s: [post, sh * 1.01, post], ry: 0, rz: 0, tint: 1 })
    for (let k = 0; k < 4; k++) {
      const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4]
      const ry = Math.atan2(-(bz - az), bx - ax)
      add(i * 100 + 10 + k, { shape: 'box', mat, p: [x + (ax + bx) / 2, y + sh, z + (az + bz) / 2], s: [w, post * 0.7, post * 0.7], ry, rz: 0, tint: 1 })
      add(i * 100 + 20 + k, { shape: 'box', mat, p: [x + (ax + bx) / 2, y + sh / 2, z + (az + bz) / 2], s: [Math.hypot(w, sh), post * 0.45, post * 0.45], ry, rz: Math.atan2(sh, w) * (i % 2 ? 1 : -1), tint: 1 })
    }
  }
}

/** Armature bars from the pylon out to the shell, one ring every `step` metres. */
function armature(part, add) {
  const { base = 0, sections, step = 2.4, spokes = 8, inner = 1.4, mat = 'iron' } = part
  const top = sections.at(-1).y
  for (let y = step / 2, r = 0; y < top; y += step, r++) {
    const sec = sectionAt(sections, y)
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + (r % 2) * 0.3
      const ox = (sec.cx ?? 0) + sec.rx * 0.94 * Math.cos(a), oz = (sec.cz ?? 0) + sec.rz * 0.94 * Math.sin(a)
      const ix = inner * Math.cos(a), iz = inner * Math.sin(a)
      const len = Math.hypot(ox - ix, oz - iz)
      add(r * 100 + i, { shape: 'box', mat, p: [(ox + ix) / 2, base + y, (oz + iz) / 2], s: [len, 0.14, 0.14], ry: Math.atan2(-(oz - iz), ox - ix), rz: 0, tint: 1, ex: [Math.cos(a), 0, Math.sin(a)] })
    }
  }
}

/** Rays fanning out from a point (a crown), each a tapering stack of plates. */
function rays(part, add) {
  const { at, count = 7, length = 3.4, from = -1.2, to = 1.2, tilt = 0.45, yaw = 0, mat = 'copper' } = part
  for (let i = 0; i < count; i++) {
    const a = yaw + from + ((to - from) * i) / Math.max(1, count - 1)
    const dir = [Math.sin(a) * Math.cos(tilt), Math.sin(tilt), Math.cos(a) * Math.cos(tilt)]
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) / 4
      const w = 0.42 * (1 - t * 0.8)
      add(i * 10 + k, { shape: 'box', mat, p: at.map((v, q) => v + dir[q] * length * t), s: [w, length / 4 * 1.02, 0.12], ry: a, rx: Math.PI / 2 - tilt, rz: 0, tint: 1, ex: dir })
    }
  }
}

/** A plain oriented slab built from plates (a tablet, a plaque). */
function slab(part, add, rand) {
  const { at, w, h, d = 0.5, ry = 0, rz = 0, mat = 'copper', grid = 3 } = part
  for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
    const lx = (i + 0.5) / grid - 0.5, ly = (j + 0.5) / grid - 0.5
    const x = at[0] + Math.cos(ry) * lx * w - Math.sin(rz) * ly * h
    const y = at[1] + Math.cos(rz) * ly * h
    const z = at[2] - Math.sin(ry) * lx * w
    add(j * 10 + i, { shape: 'box', mat, p: [x, y, z], s: [w / grid * 1.02, h / grid * 1.02, d], ry, rz, tint: tintOf(rand, 0.06), ex: [Math.sin(ry), 0.2, Math.cos(ry)] })
  }
}

/** A cup and a flame on top of a handle (a torch). */
function flame(part, add) {
  const { at, r = 1.1, h = 2.6 } = part
  add(0, { shape: 'cyl', mat: part.cup ?? 'gold', p: [at[0], at[1] + 0.35, at[2]], s: [r, 0.7, r], ry: 0, rz: 0, tint: 1, ex: [0, 1, 0] })
  add(1, { shape: 'ring', mat: part.cup ?? 'gold', p: [at[0], at[1] + 0.85, at[2]], s: [r * 1.12, 0.3, r * 1.12], ry: 0, rz: 0, tint: 1, ex: [0, 1, 0] })
  add(2, { shape: 'cone', mat: 'flame', p: [at[0], at[1] + 1 + h / 2, at[2]], s: [r * 0.8, h, r * 0.8], ry: 0, rz: 0, tint: 1, ex: [0, 1.4, 0] })
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (v) => {
  const l = Math.hypot(...v) || 1
  return v.map((x) => x / l)
}

export const PARTS = { walls, battlement, stringcourse, platform, turret, loggia, roof, figure, limb, frame, armature, rays, slab, flame }

/** A box (or column) on edge e: u along the edge, out from the face (+ outward), at height y. */
function piece(shape, mat, e, u, y, out, s, tint, extra = {}) {
  const x = e.a[0] + e.ux * u + e.nx * out
  const z = e.a[1] + e.uz * u + e.nz * out
  return { shape, mat, p: [x, y, z], s, ry: Math.atan2(-e.uz, e.ux), rz: extra.rz ?? 0, tint, ex: [e.nx, 0, e.nz], ...extra }
}
