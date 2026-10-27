// Sichuan hills: three ranges in mist, terraced slopes, a small town of tiled roofs by a river.
scene('meishan-hills', function (g, s) {
  const k = s.kit
  const W = s.W
  const H = s.H
  const f = k.frame('wide', W, H)
  g.drawImage(s.cache('paper', W, H, (c) => k.paper(c, W, H, 31, '#ECE2CB')), 0, 0)
  k.layer(g, s, 0.2, () => g.drawImage(s.cache('far', W, H, (c) => k.mountains(c, { W, base: H * 0.5, height: H * 0.3, seed: 12, alpha: 0.18, peaks: 4, cun: 18 })), 0, 0))
  k.mist(g, W, H * 0.5, H * 0.06, { alpha: 0.8 })
  k.layer(g, s, 0.5, () => g.drawImage(s.cache('mid', W, H, (c) => {
    k.mountains(c, { W, x0: W * 0.35, x1: W * 1.3, base: H * 0.64, height: H * 0.32, seed: 15, alpha: 0.45, peaks: 2, cun: 50 })
    // Terraces: thin curved dry strokes on the right slope.
    for (let i = 0; i < 9; i++) {
      const y = H * (0.48 + i * 0.018)
      k.stroke(c, k.curve([[W * 0.62, y], [W * 0.75, y - H * 0.012], [W * 0.92, y + H * 0.004]]), { w: 2, alpha: 0.35, dry: 0.6, seed: 70 + i })
    }
  }), 0, 0))
  k.mist(g, W, H * 0.64, H * 0.05, { alpha: 0.7 })
  // Town: rows of small tiled roofs on the left bank.
  k.layer(g, s, 0.9, () => g.drawImage(s.cache('town', W, H, (c) => {
    const r = k.rng(5)
    const spots = [[0.1, 0.74], [0.16, 0.72], [0.22, 0.75], [0.28, 0.73], [0.19, 0.78], [0.26, 0.79], [0.33, 0.76], [0.13, 0.79]]
    for (const [px, py] of spots.sort((a, b) => a[1] - b[1])) k.house(c, W * px, H * py, 0.9 + 0.3 * r(), { alpha: 0.78 })
    // Bank line under the town.
    k.stroke(c, k.curve([[W * 0.02, H * 0.8], [W * 0.2, H * 0.81], [W * 0.4, H * 0.79]]), { w: 5, alpha: 0.5, dry: 0.6, seed: 66 })
    k.water(c, { W, y0: H * 0.82, y1: H * 0.9, t: 0, seed: 67, lines: 14 })
  }), 0, 0))
  // Foreground pine branch on the right, strongest parallax.
  k.layer(g, s, 1.4, () => {
    k.stroke(g, k.curve([[W * 1.02, H * 0.08], [W * 0.9, H * 0.14], [W * 0.82, H * 0.13], [W * 0.76, H * 0.18]]), { w: 16, alpha: 0.85, dry: 0.45, seed: 91, taper: [0.02, 0.8] })
    const r = k.rng(93)
    for (let i = 0; i < 26; i++) {
      const x = W * (0.78 + 0.2 * r())
      const y = H * (0.1 + 0.08 * r())
      for (let n = 0; n < 6; n++) {
        const a = -Math.PI / 2 + (n - 2.5) * 0.35
        k.stroke(g, [[x, y], [x + Math.cos(a) * 26, y + Math.sin(a) * 26]], { w: 2, alpha: 0.6, seed: 100 + i * 7 + n, taper: [0, 0.8] })
      }
    }
  })
  // The appear cue: a flock of birds lifts off the hill.
  const at = s.cue('appear', 0) ?? 1
  if (s.t >= at) k.geese(g, W * 0.4, H * 0.3 - (s.t - at) * 12, 5, 1.1, s.t - at)
})
