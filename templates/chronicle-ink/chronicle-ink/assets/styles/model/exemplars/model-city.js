// One continuous chronicle projected onto a city model (style `model`, subject `city`).
// The model is a graphite table model in a black void, built from OpenStreetMap streets and building
// footprints; it is rendered once per camera view (`chronology.views`) and shots only zoom into it.
// History is light: each era's extent shows the white model through a coloured mask with a glowing
// edge (soft spotlights for uncertain early settlements), ended eras stay as thin white rings, a white
// halo sweeps out when an era begins, walls glow while they are built, landmarks and events get small
// two-line callouts. The opening can show the white model dimming to graphite ("we project the rings
// of this city onto it with light"); a heights shot extrudes every building to its OSM height.
// Data: s.geo from `node scripts/geo.mjs` with a `chronology` block in geo/places.json.
// params per shot:
//   year: [y0, y1]                         the year block reads from y0 to y1 over the shot
//   view: '<name>'                         camera from chronology.views (default chronology.camera)
//   zoom: [{ x, y, z }, { x, y, z }]       zoom into the model around (x, y) km, z = 1 shows all of it
//   globe: { lat, lon, km: [k0, k1] }      globe flight; the model fades in below 150 km
//   dim: [d0, d1]                          0 = white plaster model, 1 = graphite (the opening fade)
//   halo: { area, beat }                   white ring sweeping out from an extent when its era begins
//   heights: true                          buildings extruded to their OSM heights, coloured by height
//   rings: true                            closing view: every era's ring with its name and year
//   river: true                            the river glows once
//   hills: [{ id, beat }]                  outline hills with their names on a beat
//   focus: [{ id, beat }]                  chronology.focus item: landmark lights up with a callout, or
//                                          kind "scar" spreads a red ring (fire, sack); card: true adds
//                                          the photo card (geo/photos.json)
//   big: { text, unit?, line?, note? }     replaces the year in the left block with a figure
//   era_label: true                        name the current era's extent on the map
//   clean: true                            the bare model only (opening): no rings, walls, labels or year
scene('model-city', function (g, s) {
  const k = s.kit
  const W = s.W, H = s.H, p = s.params, geo = s.geo
  const ch = (geo && geo.chronology) || {}
  const lang = s.lang
  const u = k.clamp(s.u, 0, 1), e = k.ease.inOut(u)
  const yr = Array.isArray(p.year) ? p.year : [p.year ?? 2026, p.year ?? 2026]
  const year = yr[0] + (yr[1] - yr[0]) * u
  const viewKey = p.view || 'main'
  const V0 = Object.assign({ x: -0.3, y: 0.35, km: 4.2, pitch: 50, yaw: -14 }, ch.camera || {}, (ch.views || {})[viewKey] || {})
  const cam = k.camera(s, V0)
  const plate = ch.plate_km || 3.6
  g.fillStyle = '#050506'; g.fillRect(0, 0, W, H)
  // ---- globe flight ----
  let modelA = 1
  if (p.globe && geo) {
    const [k0, k1] = p.globe.km
    const km = Math.exp(Math.log(k0) + (Math.log(k1) - Math.log(k0)) * e)
    const c = geo.center
    const toward = k1 < k0
    const lat = toward ? p.globe.lat + (c.lat - p.globe.lat) * e : c.lat + (p.globe.lat - c.lat) * e
    const lon = toward ? p.globe.lon + (c.lon - p.globe.lon) * e : c.lon + (p.globe.lon - c.lon) * e
    k.globe(g, s, { R: Math.min((W / (2 * km)) * 6371, 3e6), lat, lon, alpha: k.clamp((km - 120) / 300, 0, 1), pin: { lat: c.lat, lon: c.lon, label: k.labelOf(ch.city, lang), sub: ch.coords || '' } })
    modelA = k.clamp((150 - km) / 110, 0, 1)
    k.hud(g, s, ch.hud || [], 0.85)
    if (modelA <= 0) return
  }
  // ---- zoom into the fixed model ----
  const z0 = (p.zoom && p.zoom[0]) || { x: 0, y: 0, z: 1 }, z1 = (p.zoom && p.zoom[1]) || z0
  const zx = z0.x + (z1.x - z0.x) * e, zy = z0.y + (z1.y - z0.y) * e
  const z = Math.exp(Math.log(z0.z) + (Math.log(z1.z) - Math.log(z0.z)) * e)
  const anchor = cam.proj(zx, zy)
  // zooming in also slides the zoomed part into the clear stage (right of the left block, above the
  // captions); at z = 1 nothing moves, so the whole model always sits in the same place
  const stage = ch.stage || [0.62, 0.42]
  const pull = k.clamp((z - 1) / 0.45, 0, 1)
  const target = [anchor[0] + (W * stage[0] - anchor[0]) * pull, anchor[1] + (H * stage[1] - anchor[1]) * pull]
  const T = k.zoomXf(anchor, z, target)
  const P = (x, y) => T(cam.proj(x, y))
  const flat = Math.sin(cam.pitch)
  const model = (tone) => s.cache(`model-${tone}-${viewKey}`, W * 2, H * 2, (cv) => k.renderModelTone(cv, geo, V0, W * 2, H * 2, plate, tone, ch.height_exaggerate || 2.5))
  const drawM = (ctx, img) => { ctx.setTransform(z, 0, 0, z, target[0] - anchor[0] * z, target[1] - anchor[1] * z); ctx.drawImage(img, 0, 0, W, H); ctx.setTransform(1, 0, 0, 1, 0, 0) }
  const light = model('light')
  g.save(); g.globalAlpha = modelA
  drawM(g, model('dark'))
  if (p.dim) {
    const d = k.clamp(p.dim[0] + (p.dim[1] - p.dim[0]) * k.ease.inOut(k.prog(u, 0.15, 0.85)), 0, 1)
    if (d < 1) { g.globalAlpha = modelA * (1 - d); drawM(g, light); g.globalAlpha = modelA }
  }
  if (p.heights) { g.globalAlpha = modelA * k.clamp(u * 3, 0, 1); drawM(g, model('heights')); g.globalAlpha = modelA }
  const buf = s.cache('light-buffer', W, H, () => {})
  const ring = (pts) => { const path = new Path2D(); pts.forEach((pt, i) => { const q = P(pt[0], pt[1]); if (i) path.lineTo(q[0], q[1]); else path.moveTo(q[0], q[1]) }); path.closePath(); return path }
  const areas = Object.fromEntries((geo.areas || []).map((x) => [x.id, x]))
  const win = (from, to, f) => k.window01(year, from, to, f)
  const radiusPx = (A) => Math.sqrt(A.km2 / Math.PI) * cam.scale * z
  // rings of the eras that have ended: fine white lines that accumulate
  for (const L of ch.layers || []) {
    const A = areas[L.area]
    if (!A || !A.ring || year < L.to - 10 || p.heights || p.clean || p.rings) continue
    const a = 0.75 * k.clamp((year - L.to + 10) / 30, 0, 1)
    g.save(); g.globalAlpha = modelA * a; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.4; g.stroke(ring(A.ring)); g.restore()
  }
  // the current era as coloured light
  let era = null
  if (!p.heights && !p.clean && !p.rings) for (const L of ch.layers || []) {
    const A = areas[L.area], vis = win(L.from, L.to, L.fade ?? 30)
    if (vis <= 0 || !A) continue
    const drawLight = (o) => drawM(o, light)
    if (L.spot) {
      const c0 = P(A.x, A.y), r = radiusPx(A) * 2.6
      k.projectLight(g, buf, drawLight, { x: c0[0], y: c0[1], rx: r, ry: r * flat }, L.color, vis * modelA, 0.12)
    } else {
      const path = ring(A.ring)
      k.projectLight(g, buf, drawLight, { path }, L.color, vis * modelA * 0.95, 0.1)
      k.glowEdge(g, path, L.color, vis * modelA)
    }
    if (vis > 0.5) era = L
  }
  // closing view: every ring named at its northern edge, the first settlement still glowing
  const ringLabels = []
  if (p.rings) {
    const ra = k.prog(s.beat, 0.5, 2.5)
    for (const L of ch.layers || []) {
      const A = areas[L.area]
      if (!A || !A.ring) continue
      if (L.spot) { const c0 = P(A.x, A.y), r = radiusPx(A) * 2.6; k.projectLight(g, buf, (o) => drawM(o, light), { x: c0[0], y: c0[1], rx: r, ry: r * flat }, L.color, 0.8 * modelA * ra, 0.12); continue }
      g.save(); g.globalAlpha = modelA * ra; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.4; g.stroke(ring(A.ring))
      const topPt = A.ring.reduce((m, q) => (q[1] > m[1] ? q : m), A.ring[0]), q = P(topPt[0], topPt[1])
      g.font = `400 17px ${k.FONT.sans}`; g.fillStyle = 'rgba(255,255,255,0.85)'; g.textAlign = 'center'; g.textBaseline = 'bottom'
      const label = `${k.labelOf(A.label, lang)} ${k.yearText(L.from, lang)}`, lw = g.measureText(label).width
      let ly = q[1] - 6
      while (ringLabels.some((r) => Math.abs(r[0] - q[0]) < (r[2] + lw) / 2 + 8 && Math.abs(r[1] - ly) < 22)) ly += 22
      ringLabels.push([q[0], ly, lw])
      g.fillText(label, q[0], ly); g.restore()
    }
  }
  // the white halo when an era begins
  if (p.halo) {
    const A = areas[p.halo.area]
    if (A) { const c0 = P(A.x, A.y), r0 = Math.max(60, radiusPx(A) * 0.8); g.save(); g.globalAlpha = modelA; k.halo(g, c0[0], c0[1], r0, r0 * 2.8 + W * 0.15, flat, k.prog(s.beat, p.halo.beat ?? 0, (p.halo.beat ?? 0) + 3)); g.restore() }
  }
  // walls glow while they are built, then stay as a fine bright line until removed
  for (const w of ch.walls || []) {
    const Wd = (geo.walls || []).find((x) => x.id === w.id)
    if (!Wd || year < w.from || p.heights || p.clean || p.rings) continue
    const prog = k.clamp((year - w.from) / Math.max(1, w.to - w.from), 0, 1)
    const glow = 1 - k.clamp((year - w.to - (w.glow_years ?? 60)) / 60, 0, 1)
    const n = Math.ceil(Wd.segments.length * prog)
    g.save(); g.globalAlpha = modelA; g.lineCap = 'round'; g.lineJoin = 'round'
    for (const [wd, al] of [[18, 0.14 * glow], [8, 0.35 * glow], [3, 0.55 + 0.45 * glow]]) {
      g.strokeStyle = k.rgba(w.color || '#FF5A43', al); g.lineWidth = wd
      for (let i = 0; i < n; i++) { g.beginPath(); Wd.segments[i].forEach((pt, j) => { const q = P(pt[0], pt[1]); if (j) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]) }); g.stroke() }
    }
    g.restore()
  }
  if (p.river) {
    const gl = Math.sin(Math.PI * k.prog(s.beat, 0.5, 4.5))
    if (gl > 0) for (const rv of geo.rivers) { if (rv.canal) continue; g.save(); g.globalAlpha = gl * 0.8 * modelA; g.strokeStyle = '#7FD0DA'; g.lineWidth = 5 * Math.sqrt(z); g.beginPath(); rv.pts.forEach((pt, i) => { const q = P(pt[0], pt[1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]) }); g.stroke(); g.restore() }
  }
  const byId = Object.fromEntries([...(geo.places || []), ...(geo.hills || [])].map((x) => [x.id, x]))
  const hillById = Object.fromEntries((geo.hills || []).map((x) => [x.id, x]))
  const taken = []
  for (const h of p.hills || []) {
    const hl = hillById[h.id]
    if (!hl) continue
    const a = k.prog(s.beat, h.beat || 0, (h.beat || 0) + 1.2)
    k.hillMark(g, cam, P, hl, z, a * modelA * 0.8)
    if (a > 0.4) { const q = P(hl.x, hl.y); g.save(); g.globalAlpha = modelA * k.clamp((a - 0.4) * 2, 0, 1); taken.push(k.callout2(g, q[0], q[1], k.labelOf(hl.label, lang), '', { size: 20 })); g.restore() }
  }
  if (p.era_label && era) {
    const A = areas[era.area]
    if (A && A.ring) {
      const topPt = A.ring.reduce((m, q) => (q[1] > m[1] ? q : m), A.ring[0])
      const q = P(A.x, topPt[1])
      g.save(); g.globalAlpha = modelA * k.prog(s.beat, 0.5, 1.5)
      g.font = `500 22px ${k.FONT.sans}`; g.textAlign = 'center'; g.textBaseline = 'bottom'
      const t = k.labelOf(A.label, lang), w = g.measureText(t).width
      g.fillStyle = 'rgba(12,13,15,0.86)'; g.fillRect(q[0] - w / 2 - 10, q[1] - 46, w + 20, 34)
      g.fillStyle = k.rgba(era.color, 1); g.fillRect(q[0] - w / 2 - 10, q[1] - 46, 3, 34)
      g.fillStyle = '#F3F1EC'; g.fillText(t, q[0], q[1] - 19)
      g.restore()
      taken.push([q[0] - w / 2 - 10, q[1] - 46, w + 20, 34])
    }
  }
  // focus: the landmark's buildings light up with a callout, or a scar ring for a fire or a sack
  const focused = new Set()
  for (const f of p.focus || []) {
    const F = (ch.focus || {})[f.id]
    if (!F) continue
    const at = byId[F.place]
    if (!at) continue
    focused.add(F.place)
    const q = P(at.x, at.y)
    const b0 = f.beat || 0, last = s.dur / s.beat_s
    const out = 1 - k.prog(s.beat, last - 0.5, last)
    const inA = k.prog(s.beat, b0, b0 + 1)
    g.save(); g.globalAlpha = modelA * out
    if (F.kind === 'scar') {
      const r = (F.ring_km || 0.6) * cam.scale * z * k.ease.out(k.prog(s.beat, b0, b0 + 2))
      g.fillStyle = 'rgba(226,85,63,0.2)'; g.beginPath(); g.ellipse(q[0], q[1], r, r * flat, 0, 0, Math.PI * 2); g.fill()
      g.strokeStyle = 'rgba(255,110,80,0.95)'; g.lineWidth = 2.5; g.stroke()
      const rr = k.rng(41)
      for (let i = 0; i < 60; i++) {
        const a0 = rr() * Math.PI * 2, d = Math.sqrt(rr()) * r, sp = 30 + rr() * 60
        const x = q[0] + Math.cos(a0) * d, y = q[1] + Math.sin(a0) * d * flat - ((s.t * sp + rr() * 80) % 90)
        g.fillStyle = `rgba(255,${120 + Math.round(rr() * 80)},60,${(0.3 + 0.45 * rr()).toFixed(2)})`; g.beginPath(); g.arc(x, y, 1.4 + rr() * 2.2, 0, Math.PI * 2); g.fill()
      }
    } else {
      const lit = k.prog(s.beat, b0 + 0.3, b0 + 1.1)
      if (lit > 0) {
        const R = F.r_km || 0.1
        const key = '__near_' + f.id
        const near = (geo[key] = geo[key] || geo.buildings.filter((b) => { const cx = b.reduce((s2, v) => s2 + v[0], 0) / b.length, cy = b.reduce((s2, v) => s2 + v[1], 0) / b.length; return Math.hypot(cx - at.x, cy - at.y) < R }))
        g.save(); g.globalAlpha = modelA * out * lit
        for (const b of near) { g.beginPath(); b.forEach((v, i) => { const w2 = P(v[0], v[1]); if (i) g.lineTo(w2[0], w2[1]); else g.moveTo(w2[0], w2[1]) }); g.closePath(); g.fillStyle = 'rgba(255,214,140,0.9)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.2; g.stroke() }
        g.restore()
        // a soft ring closes in on the point
        const ri = 18 + (1 - k.ease.out(inA)) * 160
        g.strokeStyle = `rgba(255,255,255,${(0.8 * inA).toFixed(2)})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(q[0], q[1], ri, ri * Math.max(0.55, flat), 0, 0, Math.PI * 2); g.stroke()
      }
    }
    g.restore()
    const ca = k.prog(s.beat, b0 + 0.6, b0 + 1.3) * out * modelA
    if (ca > 0) { g.save(); g.globalAlpha = ca; taken.push(k.callout2(g, q[0], q[1], k.labelOf(F.title, lang), k.labelOf(F.sub, lang) || '', { size: 24, dot: F.kind === 'scar' ? '#FF6A4D' : '#FFFFFF' })); g.restore() }
    if (F.card) {
      const card = k.prog(s.beat, b0 + 0.9, b0 + 1.6) * out
      k.photoCard(g, s, q, s.photo && s.photo(F.photo), k.labelOf(F.title, lang), /^zh/.test(lang) ? F.en || '' : '', card * modelA, { color: F.kind === 'scar' ? '#FF6A4D' : '#E8C27A' })
    }
  }
  // labels: events first, then landmarks; anything that would overlap is skipped
  const free = (r) => !taken.some((t) => r[0] < t[0] + t[2] + 8 && r[0] + r[2] + 8 > t[0] && r[1] < t[1] + t[3] + 6 && r[1] + r[3] + 6 > t[1])
  const onScreen = (q) => q[0] > W * 0.3 && q[0] < W * 0.92 && q[1] > H * 0.12 && q[1] < H * 0.8
  let line = null, note = null, person = null
  for (const ev of ch.events || []) {
    const vis = win(ev.year, ev.until ?? ev.year + 40, ev.fade ?? 10)
    if (vis <= 0) continue
    if (ev.kind === 'person') { if (vis > (person?.vis ?? 0)) person = { ev, vis }; continue }
    if (vis > 0.5) { line = k.labelOf(ev.title, lang); note = ev.sub ? k.labelOf(ev.sub, lang) : null }
    const at = ev.place && byId[ev.place]
    if (!at || focused.has(ev.place) || p.heights || p.clean) continue
    const q = P(at.x, at.y)
    if (!onScreen(q)) continue
    g.save(); g.globalAlpha = vis * modelA
    const r0 = [q[0] + 14, q[1] - 40, 300, 48]
    if (free(r0)) taken.push(k.callout2(g, q[0], q[1], k.labelOf(ev.title, lang), ev.sub ? k.labelOf(ev.sub, lang) : '', { size: 22, dot: ev.kind === 'scar' ? '#FF6A4D' : '#FFFFFF' }))
    g.restore()
  }
  if (!p.heights && !p.clean) for (const q0 of ch.places || []) {
    const vis = win(q0.from, q0.to ?? null, q0.fade ?? 25), at = byId[q0.id]
    if (!at || vis <= 0 || focused.has(q0.id)) continue
    const q = P(at.x, at.y)
    if (!onScreen(q)) continue
    g.save(); g.font = `500 20px ${k.FONT.sans}`
    const w = g.measureText(k.labelOf(at.label, lang)).width
    const rect = [q[0] + 16, q[1] - 32, w + 18, 30]
    if (free(rect)) { g.globalAlpha = vis * modelA * 0.9; taken.push(k.callout2(g, q[0], q[1], k.labelOf(at.label, lang), '', { size: 19 })) }
    g.restore()
  }
  g.restore()
  // heights legend
  if (p.heights) {
    const a = k.clamp(u * 3, 0, 1) * modelA
    g.save(); g.globalAlpha = a
    const x = W * 0.035, y = H * 0.66, w = 220
    const gr = g.createLinearGradient(x, 0, x + w, 0)
    for (const [t, h] of [[0, 0], [0.25, 12], [0.5, 24], [0.75, 45], [1, 90]]) gr.addColorStop(t, k.heightColor(h))
    g.fillStyle = gr; g.fillRect(x, y, w, 6)
    g.fillStyle = 'rgba(243,241,236,0.6)'; g.font = `13px ${k.FONT.mono || 'monospace'}`; g.textAlign = 'left'; g.textBaseline = 'top'
    g.fillText('0 m', x, y + 12); g.textAlign = 'right'; g.fillText('90 m', x + w, y + 12)
    g.textAlign = 'left'; g.fillText(k.labelOf(ch.heights_note || { en: 'OpenStreetMap heights where mapped · vertical ×2.5' }, lang), x, y + 32)
    g.restore()
  }
  // ---- left data block, HUD, caption shade ----
  const back = g.createLinearGradient(0, 0, W * 0.34, 0)
  back.addColorStop(0, 'rgba(5,5,6,0.82)'); back.addColorStop(0.7, 'rgba(5,5,6,0.45)'); back.addColorStop(1, 'rgba(5,5,6,0)')
  g.save(); g.globalAlpha = modelA; g.fillStyle = back; g.fillRect(0, 0, W * 0.34, H)
  const low = g.createLinearGradient(0, H * 0.8, 0, H)
  low.addColorStop(0, 'rgba(5,5,6,0)'); low.addColorStop(1, 'rgba(5,5,6,0.7)')
  g.fillStyle = low; g.fillRect(0, H * 0.8, W, H * 0.2); g.restore()
  const eraName = (ch.eras || []).reduce((m, x) => (year >= x.from ? x : m), null)
  k.hud(g, s, ch.hud || [], 0.8)
  if (!p.rings && !p.clean) {
    const big = p.big ? { big: k.labelOf(p.big.text, lang), unit: p.big.unit ? k.labelOf(p.big.unit, lang) : null, line: p.big.line ? k.labelOf(p.big.line, lang) : null, note: p.big.note ? k.labelOf(p.big.note, lang) : null }
      : { big: k.yearText(year, lang), line, note }
    k.dataBlock(g, s, { code: eraName ? eraName.code : '', era: eraName ? k.labelOf(eraName.label, lang) : '', ...big }, modelA)
  }
  if (person && modelA > 0 && !p.rings && !p.big && !p.clean) {
    const ev = person.ev
    g.save(); g.globalAlpha = person.vis * modelA
    const x = W * 0.035, y = H * 0.6
    g.fillStyle = 'rgba(243,241,236,0.85)'; g.fillRect(x, y, 2, 46)
    g.fillStyle = '#F3F1EC'; g.font = `500 24px ${k.FONT.sans}`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(k.labelOf(ev.title, lang), x + 14, y)
    if (ev.sub) { g.fillStyle = '#A9A7A1'; g.font = `400 17px ${k.FONT.sans}`; g.fillText(k.labelOf(ev.sub, lang), x + 14, y + 30) }
    g.restore()
  }
})
