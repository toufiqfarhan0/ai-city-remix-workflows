// Traditional Thai temple and royal palace architecture in ink wash.
// params: { prang, palace, buddha, gold, night }
scene('temple', function (g, s) {
  const k = s.kit
  const W = s.W
  const H = s.H
  const p = s.params
  const f = k.frame(s.size, W, H)

  // Paper background
  const paperBg = p.night ? '#E5DCB8' : '#F2EBD9'
  g.drawImage(s.cache(p.night ? 'paper-temple-night' : 'paper-temple', W, H, (c) => k.paper(c, W, H, 15, paperBg)), 0, 0)

  // Distant mist and soft hills
  k.layer(g, s, 0.3, () => {
    k.mist(g, W, f.horizon - H * 0.05, H * 0.08, { alpha: 0.6 })
    g.drawImage(s.cache('temple-far', W, H, (c) => k.mountains(c, { W, base: f.horizon + H * 0.02, height: H * 0.22, seed: 12, alpha: 0.25, peaks: 3 })), 0, 0)
  })

  // Central architectural element: Pagoda Prang / Tiered Roofs / Pavilion
  k.layer(g, s, 0.8, () => {
    const cx = W * 0.5
    const cy = f.horizon + H * 0.15
    const baseW = W * 0.35
    const peakH = H * 0.45

    // Soft wash behind the architecture
    const washColor = p.gold ? k.rgba('#D4AF37', 0.25) : k.rgba(k.PAL.ink, 0.15)
    g.fillStyle = washColor
    g.beginPath()
    g.moveTo(cx - baseW * 0.5, cy)
    g.lineTo(cx, cy - peakH)
    g.lineTo(cx + baseW * 0.5, cy)
    g.closePath()
    g.fill()

    // Multiple tiered prang / roof silhouettes
    const tiers = p.prang ? 7 : 4
    for (let i = 0; i < tiers; i++) {
      const ty = cy - (peakH / tiers) * i
      const tw = baseW * (1 - i / tiers) * 0.9
      const th = (peakH / tiers) * 0.8
      
      // Tier roofline
      g.strokeStyle = k.rgba(k.PAL.ink, 0.7)
      g.lineWidth = 2.5
      g.beginPath()
      g.moveTo(cx - tw * 0.5, ty)
      g.quadraticCurveTo(cx - tw * 0.2, ty - th * 0.4, cx, ty - th)
      g.quadraticCurveTo(cx + tw * 0.2, ty - th * 0.4, cx + tw * 0.5, ty)
      g.stroke()

      // Ornate roof finial upward curlicue
      g.beginPath()
      g.moveTo(cx - tw * 0.5, ty)
      g.quadraticCurveTo(cx - tw * 0.55, ty - 8, cx - tw * 0.58, ty - 16)
      g.moveTo(cx + tw * 0.5, ty)
      g.quadraticCurveTo(cx + tw * 0.55, ty - 8, cx + tw * 0.58, ty - 16)
      g.stroke()
    }

    // Central finial spire
    g.beginPath()
    g.moveTo(cx, cy - peakH)
    g.lineTo(cx, cy - peakH - H * 0.12)
    g.lineWidth = 3
    g.strokeStyle = k.rgba(k.PAL.cinnabar, 0.85)
    g.stroke()
  })

  // Foreground water / temple courtyard
  k.layer(g, s, 1.2, () => {
    k.water(g, { W, y0: f.horizon + H * 0.16, y1: H * 0.98, t: s.t, seed: 44, lines: 24 })
  })
})
