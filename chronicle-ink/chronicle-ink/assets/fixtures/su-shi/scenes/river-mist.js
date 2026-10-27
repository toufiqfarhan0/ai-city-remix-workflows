// Wide river in layered mist: far peaks, mid hills, water ripples, optional moon and boat.
// params: { moon, boat, empty, dawn, fade, title }
scene('river-mist', function (g, s) {
  const k = s.kit
  const W = s.W
  const H = s.H
  const p = s.params
  const f = k.frame(s.size, W, H)
  // Paper (static, cached once per page).
  g.drawImage(s.cache(p.dawn ? 'paper-dawn' : 'paper', W, H, (c) => k.paper(c, W, H, p.dawn ? 17 : 7, p.dawn ? '#F1E9D6' : '#E9DFC8')), 0, 0)
  // Far range: pale, barely moving.
  k.layer(g, s, 0.25, () => {
    if (p.moon) k.moon(g, W * 0.84, H * 0.26, H * 0.05)
    g.drawImage(s.cache('far', W, H, (c) => k.mountains(c, { W, base: f.horizon - H * 0.04, height: H * 0.26, seed: 4, alpha: 0.22, peaks: 2, cun: 20 })), 0, 0)
  })
  k.mist(g, W, f.horizon - H * 0.08, H * 0.07, { alpha: 0.7 })
  // Mid hills on the left bank.
  k.layer(g, s, 0.6, () => {
    g.drawImage(s.cache('mid', W, H, (c) => k.mountains(c, { W, x0: -W * 0.15, x1: W * 0.55, base: f.horizon + H * 0.02, height: H * 0.3, seed: 9, alpha: 0.55, peaks: 2, cun: 46 })), 0, 0)
  })
  k.mist(g, W, f.horizon + H * 0.02, H * 0.05, { alpha: 0.75 })
  // Water: ripples drift with time.
  k.layer(g, s, 1, () => {
    k.water(g, { W, y0: f.horizon + H * 0.03, y1: H * 0.98, t: s.t, seed: 21, lines: 30 })
    if (p.boat) {
      const bx = W * 0.6 + s.t * 6
      k.boat(g, bx, f.horizon + H * 0.13, 1.1, { figure: !p.empty, awning: true })
      // Reflection: a few broken strokes under the hull.
      k.stroke(g, [[bx - 50, f.horizon + H * 0.15], [bx + 55, f.horizon + H * 0.152]], { w: 3, alpha: 0.25, dry: 0.8, seed: 5 })
    }
  })
  // Foreground reeds, strongest parallax.
  k.layer(g, s, 1.5, () => {
    k.grass(g, -W * 0.05, W * 0.22, H * 1.02, { n: 34, h: H * 0.16, seed: 31, wind: Math.sin(s.t * 0.8) * 6 })
  })
  // Fade: mist rises to an almost blank sheet (end card).
  if (p.fade) {
    g.fillStyle = k.rgba(k.PAL.paper, 0.85 * k.prog(s.t, 0, s.dur * 0.6, 'inOut'))
    g.fillRect(0, 0, W, H)
  }
})
