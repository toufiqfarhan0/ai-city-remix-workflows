// Roman vista: the river at sunset under layered hills, cypresses, a temple, aqueduct arches and
// (optionally) a dome. Silhouettes only, no people. params: { ruins, dome, smoke, night, title }
scene('vista', function (g, s) {
  const k = s.kit
  const W = s.W, H = s.H, p = s.params
  const horizon = H * 0.6
  g.drawImage(s.cache(p.night ? 'sky-night' : 'sky', W, H, (c) => {
    const sky = c.createLinearGradient(0, 0, 0, horizon)
    if (p.night) { sky.addColorStop(0, '#2E3442'); sky.addColorStop(1, '#8C6E58') }
    else { sky.addColorStop(0, '#E9D6AE'); sky.addColorStop(0.65, '#E6B784'); sky.addColorStop(1, '#D9915E') }
    c.fillStyle = sky; c.fillRect(0, 0, W, horizon + 2)
    c.fillStyle = '#C9B48B'; c.fillRect(0, horizon, W, H - horizon)
  }), 0, 0)
  // sun
  const sunY = horizon - H * 0.12 + s.u * H * 0.03
  const sun = g.createRadialGradient(W * 0.66, sunY, 0, W * 0.66, sunY, H * 0.26)
  sun.addColorStop(0, p.night ? 'rgba(240,230,200,0.75)' : 'rgba(255,236,190,0.95)'); sun.addColorStop(0.18, p.night ? 'rgba(240,230,200,0.25)' : 'rgba(255,214,150,0.55)'); sun.addColorStop(1, 'rgba(255,200,140,0)')
  g.fillStyle = sun; g.fillRect(0, 0, W, horizon)
  // far hills and city silhouette (parallax)
  k.layer(g, s, 0.3, () => {
    g.drawImage(s.cache('far', W, H, (c) => k.mountains(c, { W, base: horizon, height: H * 0.14, seed: 7, alpha: 0.35, peaks: 3, cun: 0 })), 0, 0)
  })
  k.layer(g, s, 0.6, () => {
    g.fillStyle = 'rgba(92,58,38,0.78)'
    // temple with columns and pediment
    const tx = W * 0.3, ty = horizon, tw = W * 0.12
    g.beginPath(); g.moveTo(tx - tw * 0.08, ty - H * 0.16); g.lineTo(tx + tw / 2, ty - H * 0.22); g.lineTo(tx + tw * 1.08, ty - H * 0.16); g.closePath(); g.fill()
    g.fillRect(tx - tw * 0.06, ty - H * 0.165, tw * 1.12, H * 0.012)
    for (let i = 0; i < 6; i++) if (!(p.ruins && (i === 1 || i === 4))) g.fillRect(tx + (i / 5) * tw - 5, ty - H * 0.15, 10, H * (p.ruins && i === 3 ? 0.08 : 0.15))
    if (p.ruins) g.fillRect(tx + tw * 0.15, ty - H * 0.035, tw * 0.3, H * 0.035)
    // aqueduct arches
    for (let i = 0; i < 9; i++) k.arch(g, W * 0.48 + i * W * 0.04, horizon, W * 0.04, H * (0.12 - (p.ruins && i > 5 ? 0.05 : 0)), { color: 'rgba(120,70,44,0.75)' })
    if (p.dome) { g.beginPath(); g.ellipse(W * 0.84, horizon - H * 0.12, W * 0.045, H * 0.07, 0, Math.PI, 0); g.fill(); g.fillRect(W * 0.795, horizon - H * 0.12, W * 0.09, H * 0.12); g.fillRect(W * 0.836, horizon - H * 0.235, W * 0.008, H * 0.05) }
  })
  k.layer(g, s, 0.9, () => { for (let i = 0; i < 7; i++) k.cypress(g, W * (0.06 + i * 0.035), horizon + 6, H * (0.16 + 0.05 * Math.sin(i * 1.7)), { color: 'rgba(52,58,34,0.9)' }) })
  // smoke columns (breakdown)
  if (p.smoke) {
    const r = k.rng(31)
    for (let i = 0; i < 40; i++) {
      const x = W * (0.25 + 0.5 * r()), y = horizon - ((r() * H * 0.5 + s.t * 30) % (H * 0.5))
      g.fillStyle = `rgba(60,48,40,${(0.06 + 0.06 * r()).toFixed(3)})`; g.beginPath(); g.arc(x + Math.sin(s.t + i) * 20, y, 30 + r() * 60, 0, Math.PI * 2); g.fill()
    }
  }
  // river with sun glints
  k.layer(g, s, 1.1, () => {
    const water = g.createLinearGradient(0, horizon, 0, H)
    water.addColorStop(0, 'rgba(110,140,140,0.9)'); water.addColorStop(1, 'rgba(70,96,100,0.95)')
    g.fillStyle = water; g.fillRect(-W * 0.1, horizon + H * 0.02, W * 1.2, H * 0.3)
    const r = k.rng(55)
    for (let i = 0; i < 70; i++) {
      const y = horizon + H * 0.03 + r() * H * 0.26, x = (W * 0.66 + (r() - 0.5) * W * (0.1 + (y - horizon) / H)) + Math.sin(s.t * 1.7 + i) * 8
      g.fillStyle = `rgba(255,226,170,${(0.25 + 0.45 * r()).toFixed(3)})`; g.fillRect(x, y, 20 + r() * 40, 2)
    }
  })
  // near bank
  k.layer(g, s, 1.4, () => {
    g.fillStyle = 'rgba(70,52,34,0.9)'
    g.beginPath(); g.moveTo(-20, H); g.lineTo(-20, H * 0.9); g.quadraticCurveTo(W * 0.3, H * 0.86, W * 0.55, H * 0.93); g.quadraticCurveTo(W * 0.8, H * 0.97, W + 20, H * 0.92); g.lineTo(W + 20, H); g.fill()
  })
  const band = g.createLinearGradient(0, H * 0.76, 0, H)
  band.addColorStop(0, 'rgba(235,221,191,0)'); band.addColorStop(0.35, 'rgba(235,221,191,0.78)'); band.addColorStop(1, 'rgba(235,221,191,0.9)')
  g.fillStyle = band; g.fillRect(0, H * 0.76, W, H * 0.24)
  k.meander(g, W, H, { u: 9, m: 10, alpha: 0.5 })
})
