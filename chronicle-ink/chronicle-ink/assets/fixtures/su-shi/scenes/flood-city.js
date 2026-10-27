// Walled city in a flood: the river surges on the reveal cue; small silhouettes carry earth to the wall.
scene('flood-city', function (g, s) {
  const k = s.kit
  const W = s.W
  const H = s.H
  g.drawImage(s.cache('paper', W, H, (c) => k.paper(c, W, H, 81, '#E6DCC6')), 0, 0)
  // Storm sky: heavy grey washes.
  g.drawImage(s.cache('sky', W, H, (c) => {
    k.wash(c, W * 0.3, H * 0.15, W * 0.4, H * 0.18, { alpha: 0.05, seed: 82 })
    k.wash(c, W * 0.75, H * 0.2, W * 0.35, H * 0.15, { alpha: 0.05, seed: 83 })
  }), 0, 0)
  k.rain(g, W, H * 0.7, s.t, { alpha: 0.12, n: 120 })
  // City wall with crenellations and a gate tower.
  k.layer(g, s, 0.6, () => g.drawImage(s.cache('wall', W, H, (c) => {
    const y = H * 0.46
    k.wall(c, W * 0.18, y, W * 0.64, H * 0.1, { alpha: 0.6 })
    k.pavilion(c, W * 0.5, y - H * 0.02, 1.05, { alpha: 0.85 })
    // Earth embankment in front of the wall (the workers stand on it).
    c.fillStyle = k.rgba(k.PAL.ochre, 0.35)
    c.beginPath(); c.moveTo(W * 0.12, H * 0.66); c.quadraticCurveTo(W * 0.5, H * 0.6, W * 0.88, H * 0.66); c.lineTo(W * 0.9, H * 0.7); c.lineTo(W * 0.1, H * 0.7); c.closePath(); c.fill()
    k.stroke(c, k.curve([[W * 0.12, H * 0.66], [W * 0.5, H * 0.6], [W * 0.88, H * 0.66]]), { w: 4, alpha: 0.6, dry: 0.5, seed: 85 })
  }), 0, 0))
  // Flood water: rising surge lines; each reveal cue lifts the water.
  const at = s.cue('reveal', 0) ?? 0
  const surge = k.prog(s.t, at, at + s.beat_s * 2, 'out') * 0.6 + k.prog(s.t, at + s.beat_s * 4, at + s.beat_s * 6, 'out') * 0.4
  const level = H * (0.74 - 0.05 * surge)
  k.layer(g, s, 1, () => {
    const gr = g.createLinearGradient(0, level, 0, H)
    gr.addColorStop(0, k.rgba(k.PAL.ochre, 0.32)); gr.addColorStop(1, k.rgba(k.PAL.ink, 0.35))
    g.fillStyle = gr
    g.fillRect(-W * 0.2, level, W * 1.4, H)
    for (let i = 0; i < 9; i++) {
      const y = level + i * H * 0.03
      const pts = []
      for (let x = -W * 0.1; x <= W * 1.1; x += 40) pts.push([x, y + Math.sin(x / 90 + s.t * 3 + i) * (6 + 6 * surge)])
      k.stroke(g, pts, { w: 2.5 + i * 0.3, alpha: 0.35, dry: 0.5, seed: 90 + i, taper: [0, 0] })
    }
  })
  // Workers on the embankment carry baskets (silhouettes from far away).
  k.layer(g, s, 1.2, () => {
    for (let i = 0; i < 6; i++) {
      const x = W * (0.24 + i * 0.09) + Math.sin(s.t * 1.5 + i) * 10
      const y = H * 0.635 - Math.abs(i - 2.5) * H * 0.006
      k.figure(g, x, y, 0.42, { pose: 'bowing', hat: 'straw', t: s.t + i, alpha: 0.85, flip: i % 2 === 1 })
      g.fillStyle = k.rgba(k.PAL.ink, 0.85)
      g.beginPath(); g.arc(x + (i % 2 ? -20 : 20), y - 58, 11, 0, Math.PI * 2); g.fill()
    }
  })
})
