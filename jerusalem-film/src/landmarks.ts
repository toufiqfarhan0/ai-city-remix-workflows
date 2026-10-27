import * as THREE from "three";
import { pointedArch } from "./chryslerArch";
import { Architecture, rect, clipped, type Point } from "./architecture";
export function empireState(k: Architecture, x: number, z: number) {
  k.at(x, z);
  const limestone = "#dacbae",
    trim = "#efe0c1";
  // Broad 5th Avenue podium, shoulder wings, slender fluted shaft, then 86th-floor deck.
  const levels = [
    [1.75, 1.42, 0, 0.52],
    [1.48, 1.2, 0.52, 0.52],
    [1.25, 1.02, 1.04, 0.48],
    [1.04, 0.85, 1.52, 3.8],
    [0.9, 0.75, 5.32, 0.46],
    [0.76, 0.64, 5.78, 0.34],
    [0.64, 0.54, 6.12, 0.3],
  ];
  for (const [w, d, b, h] of levels) {
    const p = rect(w, d);
    k.solid(p, b, h, limestone);
    k.windows(p, b + 0.025, h, "deco", 0.145, 0.22);
    k.band(p, b + h, 0.045, 0.045, trim);
  }
  for (const sign of [-1, 1]) {
    k.box(sign * 0.61, 1.85, 0, 0.19, 2, 0.9, "#d4c3a5");
    for (let y = 1.1; y < 2.9; y += 0.23)
      k.box(sign * 0.715, y, 0, 0.017, 0.13, 0.63, "#536c70", "window");
    k.box(sign * 0.61, 2.91, 0, 0.24, 0.06, 0.97, trim);
  }
  const deck = rect(0.83, 0.72);
  k.solid(deck, 6.42, 0.12, trim);
  k.band(deck, 6.62, 0.025, 0.025, "#879a95", "metal");
  for (const s of [-1, 1])
    for (let i = 0; i < 8; i++) {
      k.box(
        -0.38 + i * 0.108,
        6.58,
        s * 0.34,
        0.012,
        0.15,
        0.012,
        "#889a96",
        "metal",
      );
      k.box(
        s * 0.4,
        6.58,
        -0.32 + i * 0.09,
        0.012,
        0.15,
        0.012,
        "#889a96",
        "metal",
      );
    }
  k.solid(clipped(0.48, 0.43, 0.065), 6.54, 0.52, "#d9d1b9");
  k.windows(clipped(0.48, 0.43, 0.065), 6.57, 0.46, "deco", 0.11, 0.2);
  k.band(clipped(0.48, 0.43, 0.065), 7.06, 0.035, 0.05, "#eee0c1", "accent");
  k.cylinder(0, 7.24, 0, 0.15, 0.32, "#d2d8c8", "accent", 0.115, 8);
  k.cylinder(0, 7.52, 0, 0.075, 0.32, "#cbd4cc", "metal", 0.038, 10);
  k.cylinder(0, 8.02, 0, 0.022, 0.78, "#d7ddce", "accent", 0.008, 8);
  for (let i = 0; i < 5; i++)
    k.cylinder(
      0,
      7.7 + i * 0.12,
      0,
      0.035 - i * 0.004,
      0.025,
      "#bdcfc7",
      "metal",
    );
  k.box(0, 0.25, 0.735, 0.3, 0.4, 0.08, "#648084", "glass");
  k.box(0, 0.49, 0.765, 0.44, 0.07, 0.14, trim);
  k.count("Empire State landmark");
}
export function chrysler(
  k: Architecture,
  x: number,
  z: number,
  arch = pointedArch,
) {
  k.at(x, z);
  const stone = "#d9d2bc";
  for (const [w, d, b, h] of [
    [1.5, 1.3, 0, 0.62],
    [1.23, 1.08, 0.62, 0.68],
    [1.02, 0.9, 1.3, 2.35],
    [0.85, 0.76, 3.65, 1.5],
    [0.68, 0.64, 5.15, 0.42],
  ]) {
    const p = clipped(w, d, 0.045);
    k.solid(p, b, h, stone);
    k.windows(p, b + 0.02, h, "deco", 0.16, 0.22);
    k.band(p, b + h, 0.045, 0.045, "#eee1c5");
  }
  // Eagle-like corner ornaments at the tower shoulder, not arbitrary roof spikes.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      k.box(
        sx * 0.48,
        3.63,
        sz * 0.42,
        0.2,
        0.09,
        0.15,
        "#becdca",
        "metal",
        -sx * sz * 0.2,
      );
      k.cylinder(
        sx * 0.53,
        3.64,
        sz * 0.47,
        0.035,
        0.18,
        "#c5d0cb",
        "metal",
        0.02,
        5,
      );
    }
  // Seven diminishing, intersecting vaulted faces. The small triangular lights follow each arch.
  for (let tier = 0; tier < 7; tier++) {
    const w = 0.98 - tier * 0.112,
      base = 5.5 + tier * 0.205,
      h = 0.48 - tier * 0.026;
    const p = rect(w * 0.83, w * 0.83);
    k.solid(p, base, 0.2, "#bacac8", "metal");
    for (let face = 0; face < 4; face++) {
      const angle = (face * Math.PI) / 2;
      const g = new THREE.ExtrudeGeometry(arch(w, h), {
        depth: 0.022,
        bevelEnabled: true,
        bevelThickness: 0.006,
        bevelSize: 0.006,
        bevelSegments: 1,
        curveSegments: 18,
      });
      g.translate(0, base, w * 0.435);
      g.rotateY(angle);
      k.geometry(g, "#d4e0d9", "crown");
      for (const t of [-0.27, 0, 0.27]) {
        const xx = t * w,
          yy = base + h * (0.75 - Math.abs(t) * 0.72),
          ww = w * 0.055;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(
            [
              xx - ww,
              yy - 0.045,
              w * 0.48,
              xx + ww,
              yy - 0.045,
              w * 0.48,
              xx,
              yy + 0.08,
              w * 0.48,
            ],
            3,
          ),
        );
        geo.computeVertexNormals();
        geo.rotateY(angle);
        k.geometry(geo, "#b9ccbb", "window");
      }
      // Stainless steel fan ribs accent the curved panels at close range.
      for (const t of [-0.36, 0.36]) {
        const a = new THREE.Vector3(
            t * w,
            base + 0.04,
            w * 0.46,
          ).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle),
          b = new THREE.Vector3(
            t * w * 0.35,
            base + h * 0.83,
            w * 0.46,
          ).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
        k.beam(a, b, 0.007, "#e1e8db");
      }
    }
  }
  k.cylinder(0, 7.15, 0, 0.085, 0.32, "#c9dad5", "accent", 0.025, 8);
  k.cylinder(0, 7.72, 0, 0.025, 0.94, "#dce6dc", "accent", 0.003, 10);
  k.count("Chrysler landmark");
}
export function oneWorld(k: Architecture, x: number, z: number) {
  k.at(x, z);
  const base = rect(1.35, 1.35);
  k.solid(base, 0, 1.12, "#9fb7ba", "glass");
  for (let i = 0; i < 11; i++)
    k.band(base, 0.08 + i * 0.095, 0.02, 0.018, "#bbcecb", "metal");
  const B = Array.from(
      { length: 4 },
      (_, i) =>
        new THREE.Vector3(
          Math.cos(Math.PI / 4 + (i * Math.PI) / 2) * 0.94,
          1.12,
          Math.sin(Math.PI / 4 + (i * Math.PI) / 2) * 0.94,
        ),
    ),
    T = Array.from(
      { length: 4 },
      (_, i) =>
        new THREE.Vector3(
          Math.cos((i * Math.PI) / 2) * 0.65,
          7.4,
          Math.sin((i * Math.PI) / 2) * 0.65,
        ),
    );
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    for (const [a, b, c, color] of [
      [B[i], B[j], T[j], "#77a0ae"],
      [T[i], T[j], B[i], "#9bbec4"],
    ] as const) {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [...a.toArray(), ...b.toArray(), ...c.toArray()],
          3,
        ),
      );
      g.computeVertexNormals();
      k.geometry(g, color, "glass");
    }
    for (const t of [T[i], T[j]]) k.beam(B[i], t, 0.009, "#c5d7d2");
  }
  for (let floor = 0; floor < 42; floor++) {
    const t = floor / 42,
      ring: Point[] = [];
    for (let i = 0; i < 4; i++) {
      const a = B[i].clone().lerp(T[i], t),
        b = B[i].clone().lerp(T[(i + 1) % 4], t);
      ring.push([a.x, a.z], [b.x, b.z]);
    }
    k.band(ring, 1.12 + t * 6.28, 0.014, 0.017, "#b8cdd0", "metal");
    if (floor % 3 === 0)
      k.band(ring, 1.16 + t * 6.28, 0.01, 0.022, "#ccd1ae", "window");
  }
  k.solid(
    T.map((t) => [t.x, t.z] as Point),
    7.4,
    0.11,
    "#8cabae",
    "metal",
  );
  k.cylinder(0, 7.63, 0, 0.18, 0.2, "#b3c9c6", "metal", 0.13, 16);
  k.cylinder(0, 8.38, 0, 0.035, 1.4, "#d1e0d7", "accent", 0.008, 10);
  for (let i = 0; i < 8; i++)
    k.cylinder(
      0,
      7.9 + i * 0.14,
      0,
      0.048 - i * 0.004,
      0.018,
      "#91b0b3",
      "metal",
    );
  k.count("One WTC landmark");
}
export function flatiron(k: Architecture, x: number, z: number) {
  k.at(x, z, 0.69, -0.16);
  const s = new THREE.Shape();
  s.moveTo(-0.66, 0.67);
  s.lineTo(0.66, 0.67);
  s.lineTo(-0.52, -0.8);
  s.quadraticCurveTo(-0.65, -0.89, -0.66, -0.69);
  s.lineTo(-0.66, 0.67);
  const pts = s.getPoints(5).map((v) => [v.x, v.y] as Point);
  k.solid(pts, 0, 0.39, "#d8c6aa");
  k.solid(pts, 0.39, 2.05, "#e0cfb0");
  k.windows(pts, 0.43, 1.92, "historic", 0.19, 0.24);
  for (const y of [0.32, 0.44, 1.95, 2.08, 2.36, 2.48])
    k.band(pts, y, 0.06, y > 2.3 ? 0.075 : 0.035, "#f0debb");
  k.band(pts, 2.58, 0.045, 0.15, "#cdb793");
  for (let y = 0.08; y < 0.37; y += 0.07)
    k.band(pts, y, 0.02, 0.018, "#ae9d85");
  k.box(-0.675, 0.2, 0.2, 0.035, 0.3, 0.16, "#5d797c", "glass");
  k.count("Flatiron landmark");
}
export function rockefeller(k: Architecture, x: number, z: number) {
  k.at(x, z);
  const stone = "#d3c7af";
  for (const [w, d, b, h] of [
    [1.85, 1.24, 0, 0.55],
    [1.55, 0.96, 0.55, 0.62],
    [1.27, 0.66, 1.17, 2.65],
    [1.08, 0.62, 3.82, 0.73],
    [0.87, 0.55, 4.55, 0.4],
    [0.59, 0.48, 4.95, 0.25],
  ]) {
    const p = rect(w, d);
    k.solid(p, b, h, stone);
    k.windows(p, b + 0.02, h, "deco", 0.14, 0.23);
    k.band(p, b + h, 0.04, 0.04, "#e2d7bf");
  }
  for (const side of [-1, 1]) {
    k.box(side * 0.95, 0.45, 0.55, 0.44, 0.9, 0.7, "#d1c7b2");
    k.windows(
      rect(0.44, 0.7).map(([x, z]) => [x + side * 0.95, z + 0.55] as Point),
      0.02,
      0.82,
      "deco",
      0.14,
      0.25,
    );
  }
  k.solid(rect(0.73, 0.5), 5.2, 0.08, "#e5dcc6");
  k.band(rect(0.73, 0.5), 5.35, 0.015, 0.04, "#a8b9ae", "metal");
  k.count("Rockefeller landmark");
}
