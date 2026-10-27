// Close-up calligraphy: characters are brushed onto xuan paper, ink pools at the stroke starts, then a
// cinnabar seal is pressed. params: { text, stamp_beat, vertical, final }
scene('ink-name', function (g, s) {
  const k = s.kit
  const W = s.W
  const H = s.H
  const p = s.params
  const chars = Array.from(String(p.text || '城'))
  g.drawImage(s.cache('paper', W, H, (c) => k.paper(c, W, H, 23, '#F0E7D3')), 0, 0)
  // Soft grey wash behind the writing (the brush was wet).
  // (no soft wash: it read as a grey blur on the contact sheet)
  const write = k.prog(s.beat, 0, chars.length * 1.2 + 0.6)
  k.layer(g, s, 1, () => {
    const size = p.vertical ? H * 0.17 : H * 0.34
    const x = p.vertical ? W * 0.5 : W * 0.47
    const y = p.vertical ? H * 0.5 - ((chars.length - 1) * size * 1.08) / 2 : H * 0.47
    // Ink bleeds where each character starts.
    chars.forEach((_, i) => {
      const at = i / chars.length
      const cx = p.vertical ? x : x - (chars.length - 1) * size * 0.5 + i * size
      const cy = p.vertical ? y + i * size * 1.08 : y
      k.bleed(g, cx - size * 0.25, cy - size * 0.2, size * (p.final ? 0.75 : 0.45), { p: k.clamp((write - at) * 3, 0, 1), alpha: p.final ? 0.35 : 0.22, seed: 40 + i })
    })
    if (p.vertical) k.textReveal(g, chars.join(''), x, y, { size, p: write, vertical: true, font: '"LXGW WenKai", serif' })
    else k.textReveal(g, chars.join(''), x, y, { size, p: write, font: '"LXGW WenKai", serif' })
  })
  // The writing brush rests on the right, slightly lifted while writing.
  k.layer(g, s, 1.3, () => {
    const lift = write < 1 ? Math.sin(write * Math.PI) * H * 0.02 : 0
    k.brush(g, W * 0.82, H * 0.76 - lift, 1.25, -0.5)
  })
  // Seal: pressed on its beat (scale down + full opacity on the hit frame).
  const stampAt = (p.stamp_beat ?? 6) * s.beat_s
  if (s.t >= stampAt - s.beat_s * 0.25) {
    const sp = k.prog(s.t, stampAt - s.beat_s * 0.25, stampAt)
    const size = H * 0.13 * (1.5 - 0.5 * k.ease.in(sp))
    const sx = p.vertical ? W * 0.62 : W * 0.72
    const sy = p.vertical ? H * 0.8 : H * 0.66
    k.seal(g, sx, sy, size, p.seal || '印', { alpha: sp, rot: -0.06 })
  }
})
