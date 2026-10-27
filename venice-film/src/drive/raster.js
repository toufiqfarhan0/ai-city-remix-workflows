// Low-resolution pixel buffer and the three primitives the whole drive is drawn with:
//   fillPoly   flat convex polygons (ground strips, roofs, bridge decks), optionally ordered-dithered
//   wallSpan   a vertical wall between two ground points, filled column by column with a texel callback
//              (u along the wall in metres, v up the wall in metres) and perspective-correct u
//   sprite     a camera-facing cut-out at a world point, filled with a mask callback (u -1..1, v 0..1)
// Everything writes integer pixels into a Uint32Array, then the canvas scales it up with nearest neighbour.

export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

/** 0xRRGGBB → little-endian ABGR word for ImageData. */
export const rgb = (hex) => (0xff000000 | ((hex & 0xff) << 16) | (hex & 0xff00) | ((hex >> 16) & 0xff)) >>> 0
/** Mix two 0xRRGGBB colours by k (0..1). */
export function mix(a, b, k) {
  const q = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k)
  return (q(16) << 16) | (q(8) << 8) | q(0)
}
/** Multiply a colour by f (0..2), clamped. */
export function shade(c, f) {
  const q = (s) => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f)))
  return (q(16) << 16) | (q(8) << 8) | q(0)
}
/** Snap each channel to `levels` steps: keeps the frame on a small, stable set of colours. */
export function posterize(c, levels = 12) {
  const step = 255 / (levels - 1)
  const q = (s) => Math.round(Math.round(((c >> s) & 255) / step) * step)
  return (q(16) << 16) | (q(8) << 8) | q(0)
}

export function createRaster(width, height) {
  const r = {
    width,
    height,
    data: new Uint32Array(width * height),
    image: null,
    resize(w, h) {
      r.width = w
      r.height = h
      r.data = new Uint32Array(w * h)
      r.image = null
    },
    clear(word) {
      r.data.fill(word)
    },
    /** Copies the buffer into a canvas 2D context at its own resolution. */
    present(ctx) {
      if (!r.image || r.image.width !== r.width || r.image.height !== r.height) r.image = ctx.createImageData(r.width, r.height)
      new Uint32Array(r.image.data.buffer).set(r.data)
      ctx.putImageData(r.image, 0, 0)
    },
    pixel(x, y, word) {
      if (x >= 0 && y >= 0 && x < r.width && y < r.height) r.data[(y | 0) * r.width + (x | 0)] = word
    },
  }
  return r
}

/**
 * Fills a convex screen polygon [[x, y], …]. `word` is a colour word, or a function (x, y) → word | 0
 * (0 leaves the pixel untouched) for patterned fills.
 */
export function fillPoly(r, pts, word) {
  if (pts.length < 3) return
  let top = Infinity, bottom = -Infinity
  for (const p of pts) {
    if (p[1] < top) top = p[1]
    if (p[1] > bottom) bottom = p[1]
  }
  const y0 = Math.max(0, Math.ceil(top - 0.5))
  const y1 = Math.min(r.height - 1, Math.floor(bottom - 0.5))
  const fn = typeof word === 'function'
  const n = pts.length
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5
    let xl = Infinity, xr = -Infinity
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n]
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
        const x = a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0])
        if (x < xl) xl = x
        if (x > xr) xr = x
      }
    }
    if (xl === Infinity) continue
    const xa = Math.max(0, Math.ceil(xl - 0.5))
    const xb = Math.min(r.width - 1, Math.floor(xr - 0.5))
    const row = y * r.width
    if (!fn) r.data.fill(word, row + xa, row + xb + 1)
    else for (let x = xa; x <= xb; x++) {
      const w = word(x, y)
      if (w) r.data[row + x] = w
    }
  }
}

/**
 * Draws a vertical wall from ground point A to ground point B (camera space: x right, z forward, metres),
 * from height h0 to h1. cam: { focal, cx, horizon, eye }. texel(u, v, x, y) → word | 0, with u in metres
 * from A and v in metres above the ground. Returns false when the wall is behind the camera.
 */
export function wallSpan(r, cam, A, B, h0, h1, length, texel, near = 0.6) {
  let [ax, az] = A
  let [bx, bz] = B
  let ua = 0, ub = length
  if (az < near && bz < near) return false
  if (az < near) {
    const k = (near - az) / (bz - az)
    ax += (bx - ax) * k
    az = near
    ua = length * k
  } else if (bz < near) {
    const k = (near - bz) / (az - bz)
    bx += (ax - bx) * k
    bz = near
    ub = length * (1 - k)
  }
  let sa = cam.cx + (ax / az) * cam.focal
  let sb = cam.cx + (bx / bz) * cam.focal
  let iza = 1 / az, izb = 1 / bz
  let uza = ua * iza, uzb = ub * izb
  if (sb < sa) {
    ;[sa, sb] = [sb, sa]
    ;[iza, izb] = [izb, iza]
    ;[uza, uzb] = [uzb, uza]
  }
  const xa = Math.max(0, Math.ceil(sa - 0.5))
  const xb = Math.min(r.width - 1, Math.floor(sb - 0.5))
  const span = sb - sa || 1e-6
  const W = r.width
  for (let x = xa; x <= xb; x++) {
    const k = (x + 0.5 - sa) / span
    const iz = iza + (izb - iza) * k
    const u = (uza + (uzb - uza) * k) / iz
    // Screen y of a world height h at depth z: horizon - (h - eye) * focal / z.
    const yTop = cam.horizon - (h1 - cam.eye) * cam.focal * iz
    const yBot = cam.horizon - (h0 - cam.eye) * cam.focal * iz
    const ya = Math.max(0, Math.ceil(yTop - 0.5))
    const yb = Math.min(r.height - 1, Math.floor(yBot - 0.5))
    if (yb < ya) continue
    const vScale = (h1 - h0) / (yBot - yTop || 1e-6)
    for (let y = ya; y <= yb; y++) {
      const v = h0 + (yBot - (y + 0.5)) * vScale
      const w = texel(u, v, x, y, 1 / iz)
      if (w) r.data[y * W + x] = w
    }
  }
  return true
}

/**
 * A camera-facing cut-out standing on the ground at camera-space (x, z): `width` and `height` in metres.
 * mask(u, v, x, y) → word | 0 with u from -1 (left) to 1 (right) and v from 0 (ground) to 1 (top).
 */
export function sprite(r, cam, x, z, width, height, mask, base = 0, near = 0.8) {
  if (z < near) return false
  const iz = 1 / z
  const sx = cam.cx + x * iz * cam.focal
  const half = (width / 2) * iz * cam.focal
  const yBot = cam.horizon - (base - cam.eye) * cam.focal * iz
  const yTop = cam.horizon - (base + height - cam.eye) * cam.focal * iz
  const xa = Math.max(0, Math.ceil(sx - half - 0.5))
  const xb = Math.min(r.width - 1, Math.floor(sx + half - 0.5))
  const ya = Math.max(0, Math.ceil(yTop - 0.5))
  const yb = Math.min(r.height - 1, Math.floor(yBot - 0.5))
  if (xb < xa || yb < ya) return false
  const W = r.width
  for (let y = ya; y <= yb; y++) {
    const v = (yBot - (y + 0.5)) / (yBot - yTop || 1e-6)
    for (let x = xa; x <= xb; x++) {
      const u = (x + 0.5 - sx) / (half || 1e-6)
      const w = mask(u, v, x, y)
      if (w) r.data[y * W + x] = w
    }
  }
  return true
}

/** A one-pixel line (Bresenham) between two screen points. */
export function line(r, x0, y0, x1, y1, word) {
  x0 = Math.round(x0)
  y0 = Math.round(y0)
  x1 = Math.round(x1)
  y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (let guard = 0; guard < 4000; guard++) {
    r.pixel(x0, y0, word)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0 += sy
    }
  }
}
