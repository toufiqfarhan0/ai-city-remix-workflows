// One continuous city chronicle (style `roman`, subject `city`): a timeline reads along the top while
// the city's extent morphs from keyframe to keyframe, walls are built, landmarks, events and people fade
// in and out on their years. Opening and closing shots fly in from (or back out to) the globe.
// Data: s.geo from `node scripts/geo.mjs` (OpenStreetMap fabric, world land, geo/places.json chronology).
// params (all per shot; consecutive shots continue each other's year and view, so cuts feel like one move):
// {
//   year: [y0, y1],                      // the timeline reads linearly from y0 to y1 over the shot
//   from: { x, y, km }, to: { x, y, km }, // camera (km around the city centre; km > 40 shows the globe)
//   globe: { lat, lon },                 // where the globe starts turning from (opening/closing shots)
//   river: true                          // the river glows once
// }
scene('chronicle', function (g, s) {
  const k = s.kit
  const W = s.W, H = s.H, p = s.params, geo = s.geo
  const ch = (geo && geo.chronology) || {}
  const yr = Array.isArray(p.year) ? p.year : [p.year ?? 2026, p.year ?? 2026]
  const year = yr[0] + (yr[1] - yr[0]) * k.clamp(s.u, 0, 1)
  const a = p.from || p.to || { x: 0, y: 0, km: 4 }, b = p.to || a
  const view = k.geoView(a, b, k.clamp(s.u, 0, 1))
  const atlasA = k.clamp((40 - view.km) / 30, 0, 1)
  // globe (fly-in / fly-out)
  if (atlasA < 1 && geo) {
    const c = geo.center
    const from = p.globe || c
    const e = k.ease.inOut(k.clamp(s.u, 0, 1))
    const toward = b.km < a.km
    const lat = toward ? from.lat + (c.lat - from.lat) * e : c.lat + (from.lat - c.lat) * e
    const lon = toward ? from.lon + (c.lon - from.lon) * e : c.lon + (from.lon - c.lon) * e
    const R = Math.min((W / (2 * view.km)) * 6371, 1e6)
    k.globe(g, s, { R, lat, lon, pin: { lat: c.lat, lon: c.lon, label: ch.city ? k.geoLabel({ label: ch.city }, s.lang) : '', sub: ch.coords || '' } })
  }
  if (atlasA > 0 && geo) {
    g.save(); g.globalAlpha = atlasA
    g.drawImage(s.cache('parchment', W, H, (c) => k.paper(c, W, H, 13)), 0, 0)
    const modern = k.clamp((year - (ch.modern?.[0] ?? 1870)) / ((ch.modern?.[1] ?? 1990) - (ch.modern?.[0] ?? 1870)), 0, 1)
    const ext = k.extentAt(geo, year)
    const scar = (ch.events || []).filter((e) => e.kind === 'scar').reduce((m, e) => Math.max(m, k.window01(year, e.year, e.until ?? e.year + 40, e.fade ?? 15)), 0)
    const walls = (ch.walls || []).map((w) => ({ id: w.id, p: k.clamp((year - w.from) / Math.max(1, w.to - w.from), 0, 1), label: year >= w.to && year - w.to < (w.label_years ?? 120) }))
    const places = (ch.places || []).map((q) => ({ id: q.id, p: k.window01(year, q.from, q.to ?? null, q.fade ?? 25), hot: (ch.events || []).some((e) => e.place === q.id && k.window01(year, e.year, e.until ?? e.year + 40, 10) > 0.5) }))
    const m = k.atlasMap(g, s, {
      view, places, walls, modern, hills: 1 - 0.65 * modern, latin: modern < 0.5,
      extent: ext ? { ring: ext.ring, alpha: 1 - 0.7 * modern, scar: scar > 0.3 } : null,
      river: p.river ? Math.sin(Math.PI * k.prog(s.beat, 0.5, 4.5)) : 0,
    })
    if (scar > 0) {
      g.fillStyle = k.rgba(k.PAL.cinnabar, 0.13 * scar); g.fillRect(0, 0, W, H)
      const r = k.rng(77)
      for (let i = 0; i < 110; i++) {
        const x0 = r() * W, speed = 40 + r() * 90, ph = r() * H
        const y = H - ((ph + s.t * speed) % (H * 1.1)), x = x0 + Math.sin(s.t * 1.3 + i) * 14
        g.fillStyle = k.rgba(i % 3 ? '#C2502F' : '#3A2A1C', (0.25 + 0.5 * r()) * scar)
        g.beginPath(); g.arc(x, y, 1.5 + r() * 3.5, 0, Math.PI * 2); g.fill()
      }
    }
    const band = g.createLinearGradient(0, H * 0.76, 0, H)
    band.addColorStop(0, 'rgba(235,221,191,0)'); band.addColorStop(1, 'rgba(235,221,191,0.9)')
    g.fillStyle = band; g.fillRect(0, H * 0.76, W, H * 0.24)
    k.meander(g, W, H, { u: 9, m: 10, alpha: 0.55 })
    k.compass(g, W * 0.93, H * 0.27, 40, { alpha: 0.8 })
    k.scaleBar(g, s, view, { y: H * 0.86 })
    if (ext && modern < 0.4) k.areaMeter(g, s, k.ringKm2(ext.ring), ch.meter_max || 15, { alpha: 1 - modern * 2.5 })
    for (const e of ch.events || []) k.eventCard(g, s, e, k.window01(year, e.year, e.until ?? e.year + 40, e.fade ?? 12), m.px)
    g.restore()
  }
  // the timeline is shown whenever the story is in the city (not during the globe flight)
  k.timelineBar(g, s, year, { alpha: atlasA })
})
