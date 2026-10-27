// Scholar's desk seen from above: a handscroll, an inkstone, a brush. params.mode:
//   birth  the scroll unrolls and a plum branch grows on it (scroll cue, appear cue)
//   seal   an official letter lies on the desk; a seal is pressed on the seal cue
scene('desk-scroll', function (g, s) {
  const k = s.kit
  const W = s.W
  const H = s.H
  const mode = s.params.mode || 'birth'
  // Dark wooden desk with grain.
  g.drawImage(s.cache('desk', W, H, (c) => {
    c.fillStyle = '#D8C9AC'
    c.fillRect(0, 0, W, H)
    const r = k.rng(44)
    for (let i = 0; i < 60; i++) {
      const y = r() * H
      c.strokeStyle = `rgba(120,96,60,${(0.05 + 0.08 * r()).toFixed(3)})`
      c.lineWidth = 1 + r() * 3
      c.beginPath(); c.moveTo(0, y)
      for (let x = 0; x <= W; x += 80) c.lineTo(x, y + Math.sin(x / 300 + i) * 8)
      c.stroke()
    }
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.7)
    v.addColorStop(0, 'rgba(80,60,30,0)'); v.addColorStop(1, 'rgba(80,60,30,0.28)')
    c.fillStyle = v; c.fillRect(0, 0, W, H)
  }), 0, 0)
  k.layer(g, s, 1, () => {
    if (mode === 'birth') {
      const open = k.prog(s.t, s.cue('scroll', 0) ?? 0, (s.cue('scroll', 0) ?? 0) + 3 * s.beat_s, 'inOut')
      const x = W * 0.12
      const y = H * 0.16
      const w = W * 0.62
      const h = H * 0.56
      const inner = k.scroll(g, x, y, w, h, { open })
      g.save()
      g.beginPath(); g.rect(inner.x, inner.y, inner.w, inner.h); g.clip()
      g.drawImage(s.cache('scroll-paper', W, H, (c) => k.paper(c, W, H, 52, '#F3EBD8')), 0, 0)
      const grow = k.prog(s.t, s.cue('appear', 0) ?? s.beat_s * 4, (s.cue('appear', 0) ?? s.beat_s * 4) + 3 * s.beat_s)
      k.plum(g, x + w * 0.1, y + h * 0.9, 2.4, { p: grow * open })
      k.mountains(g, { W, x0: x + w * 0.45, x1: x + w * 1.05, base: y + h * 0.95, height: h * 0.45, seed: 57, alpha: 0.3 * open, peaks: 2, cun: 16 })
      g.restore()
      k.inkstone(g, W * 0.85, H * 0.36, 0.9)
      k.brush(g, W * 0.84, H * 0.72, 1.2, -0.25)
    } else {
      // Folded official letter with vertical lines of writing (abstract strokes, not legible text).
      g.save()
      g.translate(W * 0.42, H * 0.46)
      g.rotate(-0.05)
      g.fillStyle = '#F1E8D2'
      g.fillRect(-W * 0.24, -H * 0.3, W * 0.48, H * 0.6)
      g.strokeStyle = k.rgba(k.PAL.cinnabar, 0.55)
      g.lineWidth = 2
      for (let i = 0; i < 9; i++) { const lx = -W * 0.2 + i * W * 0.05; g.beginPath(); g.moveTo(lx, -H * 0.27); g.lineTo(lx, H * 0.27); g.stroke() }
      for (let i = 0; i < 8; i++) {
        const lx = -W * 0.175 + i * W * 0.05
        let yy = -H * 0.24
        const r = k.rng(200 + i)
        while (yy < H * 0.2) {
          const len = 10 + r() * 22
          k.stroke(g, [[lx - 6 + r() * 4, yy], [lx + 4 + r() * 4, yy + len]], { w: 4 + r() * 3, alpha: 0.75, seed: 300 + i * 31 + Math.round(yy), taper: [0.2, 0.4] })
          yy += len + 8 + r() * 10
        }
      }
      g.restore()
      k.inkstone(g, W * 0.82, H * 0.3, 0.85)
      k.brush(g, W * 0.8, H * 0.78, 1.2, -0.35)
      const at = s.cue('seal', 0) ?? s.beat_s * 4
      if (s.t >= at - s.beat_s * 0.25) {
        const sp = k.prog(s.t, at - s.beat_s * 0.25, at)
        k.seal(g, W * 0.56, H * 0.62, H * 0.12 * (1.6 - 0.6 * k.ease.in(sp)), '湖州', { alpha: sp, rot: -0.08 })
      }
    }
  })
})
