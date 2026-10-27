// Roman Atlas city map (style `roman`, subject `city`). Data: s.geo from `node scripts/geo.mjs`.
// Everything a shot changes is in params, so one file serves every map shot of the film:
// {
//   from: { x, y, km }, to: { x, y, km },              // view (centre and half-width in km), eased over the shot
//   hills: 1 | [h0, h1], hill_names: true,             // hachured hills (Latin names; Chinese names too)
//   areas: [{ id, p0, p1, a, b, from, color, fade }],  // extent growth p0 -> p1 between beats a..b, from = origin
//                                                      // place/hill id; color "scar" | "faded"; fade = fabric 0..1
//   walls: [{ id, p0, p1, a, b, label }],              // real OpenStreetMap wall drawn progressively
//   modern: [m0, m1],                                  // today's built-up land and every street
//   places: [{ id, beat, hot, lost, align, dy }],      // markers appear on their beat (put an `appear` SFX there)
//   latin: true,                                       // Latin sub-labels
//   era: { year, name, beat },                         // era plaque (only dates in the shot's claims)
//   meter: { area, beat },                             // area meter of one extent (AI illustration)
//   scar: 0..1, scar_beat, river: true, frame: true
// }
scene('atlas', function (g, s) {
  const k = s.kit
  const W = s.W, H = s.H, p = s.params
  const lastBeat = s.dur / s.beat_s
  const span = (v, a, b, e) => Array.isArray(v) ? v[0] + (v[1] - v[0]) * k.prog(s.beat, a ?? 0, b ?? lastBeat, e || 'inOut') : (v ?? 0)
  g.drawImage(s.cache('parchment', W, H, (c) => k.paper(c, W, H, 13)), 0, 0)
  const a = p.from || p.to || { x: 0, y: 0, km: 4 }, b = p.to || a
  const view = k.geoView(a, b, k.clamp(s.u, 0, 1))
  const areas = (p.areas || []).map((ar) => ({ id: ar.id, from: ar.from, color: ar.color, fade: ar.fade, label: ar.label, km2: ar.km2, p: ar.p0 == null ? 1 : ar.p0 + ((ar.p1 ?? ar.p0) - ar.p0) * k.prog(s.beat, ar.a || 0, ar.b ?? lastBeat, 'inOut') }))
  const walls = (p.walls || []).map((w) => ({ id: w.id, label: w.label, p: w.p0 == null ? 1 : w.p0 + ((w.p1 ?? w.p0) - w.p0) * k.prog(s.beat, w.a || 0, w.b ?? lastBeat, 'inOut') }))
  const places = (p.places || []).map((q) => ({ id: q.id, hot: q.hot, lost: q.lost, align: q.align, dy: q.dy, p: k.prog(s.beat, q.beat || 0, (q.beat || 0) + 0.6) }))
  const m = k.atlasMap(g, s, {
    view, areas, walls, places, latin: p.latin, hillNames: p.hill_names,
    hills: span(p.hills ?? 1), modern: span(p.modern), river: p.river ? Math.sin(Math.PI * k.prog(s.beat, 0.5, 4.5)) : 0,
  })
  if (p.scar) {
    const sp = p.scar * k.prog(s.beat, p.scar_beat || 0, (p.scar_beat || 0) + 1.5)
    g.fillStyle = k.rgba(k.PAL.cinnabar, 0.14 * sp); g.fillRect(0, 0, W, H)
    const r = k.rng(77)
    for (let i = 0; i < 110; i++) {
      const x0 = r() * W, speed = 40 + r() * 90, ph = r() * H
      const y = H - ((ph + s.t * speed) % (H * 1.1)), x = x0 + Math.sin(s.t * 1.3 + i) * 14
      g.fillStyle = k.rgba(i % 3 ? '#C2502F' : '#3A2A1C', (0.25 + 0.5 * r()) * sp)
      g.beginPath(); g.arc(x, y, 1.5 + r() * 3.5, 0, Math.PI * 2); g.fill()
    }
  }
  // calm band for the caption
  const band = g.createLinearGradient(0, H * 0.76, 0, H)
  band.addColorStop(0, 'rgba(235,221,191,0)'); band.addColorStop(1, 'rgba(235,221,191,0.9)')
  g.fillStyle = band; g.fillRect(0, H * 0.76, W, H * 0.24)
  if (p.frame !== false) k.meander(g, W, H, { u: 9, m: 10, alpha: 0.55 })
  k.compass(g, W * 0.93, H * 0.2, 46, { alpha: 0.8 })
  k.scaleBar(g, s, view, { y: H * 0.86 })
  if (p.era) k.eraPlaque(g, s, p.era.year, p.era.name, k.prog(s.beat, p.era.beat || 0, (p.era.beat || 0) + 1))
  if (p.meter && s.geo) {
    const A = (s.geo.areas || []).find((x) => x.id === p.meter.area)
    const ar = areas.find((x) => x.id === p.meter.area)
    if (A) k.areaMeter(g, s, A.km2 * k.ease.out(k.clamp(ar ? ar.p : 1, 0, 1)), p.meter.max || 15, { alpha: k.prog(s.beat, p.meter.beat || 0, (p.meter.beat || 0) + 1) })
  }
  return m
})
