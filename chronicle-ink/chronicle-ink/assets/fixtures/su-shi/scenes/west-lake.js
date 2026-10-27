// Lake city: indigo wash water, a long causeway with willows, a pavilion, far hills (parallax).
scene('west-lake', function (g, s) {
  const k = s.kit
  const W = s.W
  const H = s.H
  g.drawImage(s.cache('paper', W, H, (c) => k.paper(c, W, H, 71, '#EAE3CF')), 0, 0)
  k.layer(g, s, 0.2, () => g.drawImage(s.cache('far', W, H, (c) => {
    k.mountains(c, { W, base: H * 0.46, height: H * 0.18, seed: 33, alpha: 0.2, peaks: 3, cun: 10, color: k.PAL.indigo })
    // A small pagoda on the far hill.
    c.fillStyle = k.rgba(k.PAL.ink, 0.35)
    for (let i = 0; i < 5; i++) c.fillRect(W * 0.31 - 9 + i, H * 0.36 - i * 14, 18 - i * 2, 10)
  }), 0, 0))
  k.mist(g, W, H * 0.47, H * 0.04, { alpha: 0.8 })
  k.layer(g, s, 0.5, () => {
    g.drawImage(s.cache('lake', W, H, (c) => {
      const gr = c.createLinearGradient(0, H * 0.47, 0, H)
      gr.addColorStop(0, k.rgba(k.PAL.indigo, 0.08)); gr.addColorStop(1, k.rgba(k.PAL.indigo, 0.22))
      c.fillStyle = gr; c.fillRect(-W * 0.2, H * 0.47, W * 1.4, H * 0.53)
    }), 0, 0)
    k.water(g, { W, y0: H * 0.5, y1: H * 0.95, t: s.t, seed: 34, lines: 26 })
  })
  // Causeway with willows across the middle distance.
  k.layer(g, s, 0.8, () => {
    g.drawImage(s.cache('causeway', W, H, (c) => {
      k.stroke(c, k.curve([[-W * 0.1, H * 0.62], [W * 0.3, H * 0.6], [W * 0.7, H * 0.63], [W * 1.1, H * 0.6]]), { w: 9, alpha: 0.6, dry: 0.4, seed: 35, taper: [0, 0] })
      // Arched bridge.
      k.stroke(c, k.curve([[W * 0.44, H * 0.615], [W * 0.48, H * 0.585], [W * 0.52, H * 0.615]]), { w: 6, alpha: 0.75, seed: 36 })
      k.pavilion(c, W * 0.78, H * 0.6, 0.55, { alpha: 0.8 })
    }), 0, 0)
    const r = k.rng(37)
    for (let i = 0; i < 9; i++) {
      const x = W * (0.05 + i * 0.1 + 0.03 * r())
      const y = H * 0.61
      k.stroke(g, [[x, y], [x + 2, y - H * 0.09]], { w: 5, alpha: 0.7, seed: 38 + i })
      for (let b = 0; b < 7; b++) {
        const sway = Math.sin(s.t * 1.3 + i + b) * 6
        const bx = x + (b - 3) * 6
        k.stroke(g, k.curve([[bx, y - H * 0.09], [bx + (b - 3) * 5, y - H * 0.06], [bx + (b - 3) * 6 + sway, y - H * 0.02]]), { w: 1.6, alpha: 0.55, seed: 60 + i * 7 + b, taper: [0, 0.7] })
      }
    }
  })
  // Foreground: lotus leaves in the lower left, fast parallax.
  k.layer(g, s, 1.4, () => {
    const r = k.rng(39)
    for (let i = 0; i < 6; i++) {
      const x = W * (0.02 + 0.05 * i + 0.02 * r())
      const y = H * (0.88 + 0.06 * r())
      g.fillStyle = k.rgba(k.PAL.ink, 0.5 + 0.3 * r())
      g.beginPath(); g.ellipse(x, y, 60 + 30 * r(), 18 + 8 * r(), -0.1, 0, Math.PI * 2); g.fill()
    }
    const at = s.cue('appear', 0) ?? s.beat_s * 2
    if (s.t >= at) {
      const bp = k.prog(s.t, at, at + s.beat_s, 'out')
      g.fillStyle = k.rgba(k.PAL.cinnabar, 0.7 * bp)
      g.beginPath(); g.ellipse(W * 0.16, H * 0.83, 16 * bp, 26 * bp, 0, 0, Math.PI * 2); g.fill()
      k.stroke(g, [[W * 0.16, H * 0.86], [W * 0.165, H * 0.92]], { w: 3, alpha: 0.7 * bp, seed: 50 })
    }
  })
})
