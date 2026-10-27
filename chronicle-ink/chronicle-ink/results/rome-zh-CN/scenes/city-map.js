// Real-geography ink map of a city (subject `city`). Data: s.geo from `node scripts/geo.mjs`
// (OpenStreetMap water, rivers, coast, modern roads; places and approximate historic areas from
// geo/places.json). Everything the shot changes is in params, so one scene file serves the whole film:
// {
//   from: { x, y, km }, to: { x, y, km },      // map view (centre in km, half-width in km), eased over the shot
//   areas: [{ id, from, to, a, b, color }],     // historic extent growth/shrink 0..1 between beats a..b;
//                                               // color "scar" (cinnabar) or "indigo"; tagged "AI illustration"
//   places: [{ id, beat, hot, lost, align, dy }],// a place appears on its beat (put an `appear` SFX there)
//   roads: [r0, r1],                            // modern road network opacity across the shot (today only)
//   year: "公元前753年", year_beat: 1,          // era stamp: only dates bound in this shot's claims
//   scar: 0..1, scar_beat: 0                    // fire/war wash with drifting embers (breakdown)
//   river: true                                  // the river glows once (use with the river claim)
// }
scene('city-map', function (g, s) {
  const k = s.kit
  const W = s.W
  const H = s.H
  const p = s.params
  const lastBeat = s.dur / s.beat_s
  g.drawImage(s.cache('paper', W, H, (c) => k.paper(c, W, H, 11, '#EDE3CC')), 0, 0)
  const a = p.from || p.to || { x: 0, y: 0, km: 6 }
  const b = p.to || p.from || a
  const view = k.geoView(a, b, k.clamp(s.u, 0, 1))
  const areas = (p.areas || []).map((ar, i) => ({
    id: ar.id,
    seed: 300 + i * 7,
    color: ar.color === 'scar' ? k.PAL.cinnabar : ar.color === 'indigo' ? k.PAL.indigo : undefined,
    p: ar.from == null ? 1 : ar.from + ((ar.to == null ? ar.from : ar.to) - ar.from) * k.prog(s.beat, ar.a || 0, ar.b == null ? lastBeat : ar.b, 'inOut'),
  }))
  const places = (p.places || []).map((q) => ({ id: q.id, hot: q.hot, lost: q.lost, align: q.align, dy: q.dy, p: k.prog(s.beat, q.beat || 0, (q.beat || 0) + 0.6) }))
  const roads = p.roads ? p.roads[0] + (p.roads[1] - p.roads[0]) * k.prog(s.t, 0, s.dur * 0.85, 'inOut') : 0
  const m = k.cityMap(g, s, { view, areas, places, roads })
  // The river glows once along its course (a soft indigo pulse).
  if (p.river && s.geo) {
    const glow = Math.sin(Math.PI * k.prog(s.beat, 0.5, 4.5))
    if (glow > 0) {
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round'
      for (const rv of s.geo.rivers) {
        if (rv.canal) continue
        g.beginPath()
        rv.pts.forEach((pt, i) => { const q = m.px(pt[0], pt[1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]) })
        g.strokeStyle = k.rgba(k.PAL.indigo, 0.45 * glow); g.lineWidth = Math.max(14, 0.2 * m.scale); g.stroke()
      }
      g.restore()
    }
  }
  // Scar: a cinnabar wash and embers rising (deterministic in t).
  if (p.scar) {
    const sp = p.scar * k.prog(s.beat, p.scar_beat || 0, (p.scar_beat || 0) + 1.5)
    g.fillStyle = k.rgba(k.PAL.cinnabar, 0.13 * sp)
    g.fillRect(0, 0, W, H)
    const r = k.rng(77)
    for (let i = 0; i < 90; i++) {
      const x0 = r() * W, speed = 40 + r() * 90, ph = r() * H
      const y = H - ((ph + s.t * speed) % (H * 1.1))
      const x = x0 + Math.sin(s.t * 1.3 + i) * 14
      g.fillStyle = k.rgba(i % 3 ? k.PAL.cinnabar : k.PAL.ink, (0.25 + 0.5 * r()) * sp)
      g.beginPath(); g.arc(x, y, 1.5 + r() * 3.5, 0, Math.PI * 2); g.fill()
    }
  }
  // Calm band for the caption: the map fades into paper at the bottom.
  const band = g.createLinearGradient(0, H * 0.74, 0, H)
  band.addColorStop(0, 'rgba(237,227,204,0)')
  band.addColorStop(1, 'rgba(237,227,204,0.88)')
  g.fillStyle = band
  g.fillRect(0, H * 0.74, W, H * 0.26)
  k.scaleBar(g, s, view, { x: W * 0.04, y: H * 0.79 })
  if (p.year) k.yearMark(g, s, p.year, k.prog(s.beat, p.year_beat || 0, (p.year_beat || 0) + 1), { x: W * 0.05, y: H * 0.11 })
})
