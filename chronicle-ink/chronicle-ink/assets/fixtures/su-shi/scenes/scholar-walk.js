// Robed scholars seen from behind (never faces). params:
//   figures 1|2, gate (city gate ahead), road (long road), autumn (blowing leaves), bank (river bank), old (stooped)
scene('scholar-walk', function (g, s) {
  const k = s.kit
  const W = s.W
  const H = s.H
  const p = s.params
  const f = k.frame(s.size, W, H, 'left')
  g.drawImage(s.cache(`paper-${p.autumn ? 'a' : 'n'}`, W, H, (c) => k.paper(c, W, H, p.autumn ? 61 : 63, p.autumn ? '#EBDDC2' : '#ECE3CD')), 0, 0)
  k.layer(g, s, 0.25, () => g.drawImage(s.cache(`far-${p.bank ? 'b' : 'r'}`, W, H, (c) => k.mountains(c, { W, base: H * 0.56, height: H * 0.22, seed: p.bank ? 81 : 77, alpha: 0.2, peaks: 3, cun: 16 })), 0, 0))
  k.mist(g, W, H * 0.56, H * 0.05, { alpha: 0.75 })
  k.layer(g, s, 0.6, () => {
    if (p.gate) {
      // City gate tower on the horizon: wall, gate opening, double roof.
      g.drawImage(s.cache('gate', W, H, (c) => {
        const gx = W * 0.58
        const gy = H * 0.6
        k.wall(c, gx - W * 0.3, gy - H * 0.06, W * 0.6, H * 0.06, { alpha: 0.5 })
        c.fillStyle = k.rgba(k.PAL.paper, 0.9)
        c.beginPath(); c.moveTo(gx - W * 0.025, gy); c.lineTo(gx - W * 0.025, gy - H * 0.035); c.quadraticCurveTo(gx, gy - H * 0.055, gx + W * 0.025, gy - H * 0.035); c.lineTo(gx + W * 0.025, gy); c.fill()
        k.pavilion(c, gx, gy - H * 0.06, 1.0, { alpha: 0.7 })
        k.pavilion(c, gx, gy - H * 0.1, 0.7, { alpha: 0.6 })
      }), 0, 0)
    }
    if (p.bank) k.water(g, { W, y0: H * 0.6, y1: H * 0.95, t: s.t, seed: 12, lines: 22 })
  })
  // Road: two converging dry strokes toward the horizon.
  if (!p.bank) {
    k.layer(g, s, 0.9, () => g.drawImage(s.cache('road', W, H, (c) => {
      k.stroke(c, [[W * 0.25, H * 1.02], [W * 0.54, H * 0.62]], { w: 6, alpha: 0.45, dry: 0.7, seed: 21 })
      k.stroke(c, [[W * 0.8, H * 1.02], [W * 0.61, H * 0.62]], { w: 6, alpha: 0.45, dry: 0.7, seed: 22 })
      k.grass(c, 0, W * 0.3, H * 0.98, { n: 40, h: H * 0.06, seed: 23 })
      k.grass(c, W * 0.75, W, H * 0.98, { n: 30, h: H * 0.06, seed: 24 })
    }), 0, 0))
  } else {
    k.layer(g, s, 1, () => g.drawImage(s.cache('bank', W, H, (c) => {
      c.fillStyle = k.rgba(k.PAL.ink, 0.8)
      c.beginPath(); c.moveTo(0, H); c.lineTo(0, H * 0.8); c.quadraticCurveTo(W * 0.25, H * 0.76, W * 0.5, H * 0.86); c.lineTo(W * 0.62, H); c.closePath(); c.fill()
      k.grass(c, W * 0.02, W * 0.45, H * 0.82, { n: 40, h: H * 0.08, seed: 25 })
    }), 0, 0))
  }
  // Figures walk away from the camera (they shrink and rise toward the horizon).
  k.layer(g, s, 1.05, () => {
    const n = p.figures || 1
    const walk = p.bank ? 0 : k.ease.out(s.u) * 0.12
    for (let i = 0; i < n; i++) {
      const x = p.bank ? W * 0.3 : W * (0.575 + (i - (n - 1) / 2) * 0.06)
      const y = p.bank ? H * 0.78 : H * (0.8 - walk)
      const sc = (p.bank ? 1.15 : 0.95 - walk * 2.2) * (i ? 0.92 : 1)
      k.figure(g, x, y, sc, { pose: p.old ? 'bowing' : 'walking', hat: 'tall', t: s.t + i, alpha: 0.88 })
    }
  })
  if (p.autumn) {
    const r = k.rng(71)
    for (let i = 0; i < 26; i++) {
      const x = ((r() * W + s.t * (120 + 60 * r())) % (W + 100)) - 50
      const y = H * (0.2 + 0.6 * r()) + Math.sin(s.t * 2 + i) * 20
      g.fillStyle = k.rgba(i % 3 ? k.PAL.ochre : k.PAL.cinnabar, 0.7)
      g.beginPath(); g.ellipse(x, y, 7, 3, s.t * 3 + i, 0, Math.PI * 2); g.fill()
    }
  }
  if (p.bank) {
    // Wind in the robe: streamers of dry brush from the figure toward the horizon.
    k.layer(g, s, 1.05, () => k.stroke(g, k.curve([[W * 0.33, H * 0.68], [W * 0.42, H * 0.66 + Math.sin(s.t * 2) * 6], [W * 0.5, H * 0.67]]), { w: 3, alpha: 0.35, dry: 0.8, seed: 9 }))
  }
})
