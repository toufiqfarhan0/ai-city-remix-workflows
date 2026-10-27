// Carved inscription: letters are cut into a marble slab between two columns, a laurel wreath grows
// and a medallion is pressed on its beat. params: { text, sub, latin, stamp_beat, seal }
scene('plaque', function (g, s) {
  const k = s.kit
  const W = s.W, H = s.H, p = s.params
  g.drawImage(s.cache('parchment', W, H, (c) => k.paper(c, W, H, 13)), 0, 0)
  // marble slab
  g.drawImage(s.cache('slab', W, H, (c) => {
    const x = W * 0.2, y = H * 0.2, w = W * 0.6, h = H * 0.5
    const m = c.createLinearGradient(x, y, x + w, y + h)
    m.addColorStop(0, '#F3EEE3'); m.addColorStop(0.5, '#E6DFD0'); m.addColorStop(1, '#F1EADC')
    c.fillStyle = m; c.fillRect(x, y, w, h)
    const r = k.rng(9)
    c.strokeStyle = 'rgba(120,110,95,0.18)'
    for (let i = 0; i < 26; i++) { c.lineWidth = 0.6 + r() * 1.4; c.beginPath(); let px = x + r() * w, py = y + r() * h; c.moveTo(px, py); for (let j = 0; j < 6; j++) { px += (r() - 0.3) * 60; py += (r() - 0.5) * 30; c.lineTo(px, py) } c.stroke() }
    c.strokeStyle = '#B08A3E'; c.lineWidth = 4; c.strokeRect(x + 14, y + 14, w - 28, h - 28)
    c.strokeStyle = '#2A1E14'; c.lineWidth = 2; c.strokeRect(x, y, w, h)
  }), 0, 0)
  k.column(g, W * 0.15, H * 0.78, H * 0.62, { w: H * 0.07 })
  k.column(g, W * 0.85, H * 0.78, H * 0.62, { w: H * 0.07 })
  // letters cut in, one by one
  const chars = Array.from(String(p.text || 'ROMA'))
  const cut = k.prog(s.beat, 0, chars.length * 0.9 + 0.5)
  const size = H * (chars.length > 3 ? 0.17 : 0.22)
  g.save(); g.font = `${size}px ${/[\u3400-\u9fff]/.test(p.text || '') ? k.FONT.serif : k.FONT.display}`; g.textAlign = 'center'; g.textBaseline = 'middle'
  const total = g.measureText(chars.join('')).width
  let x = W / 2 - total / 2
  chars.forEach((ch, i) => {
    const w = g.measureText(ch).width
    const a = k.clamp((cut * chars.length - i) * 1.5, 0, 1)
    if (a > 0) {
      g.globalAlpha = a
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText(ch, x + w / 2 + 2, H * 0.42 + 2)
      g.fillStyle = '#3A2A1C'; g.fillText(ch, x + w / 2, H * 0.42)
    }
    x += w
  })
  g.restore()
  if (p.latin) { g.save(); g.globalAlpha = k.prog(s.beat, chars.length * 0.9, chars.length * 0.9 + 1); g.font = `${H * 0.05}px ${k.FONT.display}`; g.fillStyle = '#5A4632'; g.textAlign = 'center'; g.fillText(p.latin, W / 2, H * 0.58); g.restore() }
  // laurel wreath under the slab
  const lw = k.prog(s.beat, 1, 4, 'out')
  // two branches rise from the bottom of the slab around the inscription (canvas angles: y down)
  if (lw > 0) {
    k.laurel(g, W / 2, H * 0.45, H * 0.3, { a0: Math.PI * 0.62, a1: Math.PI * (0.62 + 0.55 * lw), n: 8 })
    k.laurel(g, W / 2, H * 0.45, H * 0.3, { a0: Math.PI * 0.38, a1: Math.PI * (0.38 - 0.55 * lw), n: 8 })
  }
  const stampAt = (p.stamp_beat ?? 6) * s.beat_s
  if (s.t >= stampAt - s.beat_s * 0.25) {
    const sp = k.prog(s.t, stampAt - s.beat_s * 0.25, stampAt)
    k.seal(g, W * 0.74, H * 0.66, H * 0.12 * (1.5 - 0.5 * k.ease.in(sp)), p.seal || 'SPQR', { alpha: sp })
  }
  k.meander(g, W, H, { u: 9, m: 10, alpha: 0.55 })
})
