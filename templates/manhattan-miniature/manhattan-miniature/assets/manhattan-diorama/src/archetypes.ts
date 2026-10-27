import { extraBuilding, extraFamilies, type ExtraFamily } from "./newArchetypes";
import * as THREE from "three";
import { Architecture, clipped, type Point } from "./architecture";
export type Family =
  | ExtraFamily
  | "Art Deco"
  | "Historic brick"
  | "Glass tower"
  | "Prewar residential"
  | "Mixed use"
  | "Sculptural";
export function loft(
  k: Architecture,
  lower: Point[],
  upper: Point[],
  bottom: number,
  height: number,
  color: string,
  kind: "glass" | "stone" | "copper" = "glass",
) {
  const vertices: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) =>
    vertices.push(...a, ...b, ...c);
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length,
      a = [lower[i][0], bottom, lower[i][1]],
      b = [lower[j][0], bottom, lower[j][1]],
      c = [upper[j][0], bottom + height, upper[j][1]],
      d = [upper[i][0], bottom + height, upper[i][1]];
    tri(a, c, b);
    tri(a, d, c);
  }
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(
    upper.map(([x, z]) => new THREE.Vector2(x, z)),
    [],
  )) {
    tri(
      [upper[a][0], bottom + height, upper[a][1]],
      [upper[c][0], bottom + height, upper[c][1]],
      [upper[b][0], bottom + height, upper[b][1]],
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.computeVertexNormals();
  k.geometry(g, color, kind);
}
function tapered(
  k: Architecture,
  w: number,
  d: number,
  h: number,
  top = 0.72,
  rounded = false,
  glassColor = "#3d8c98",
) {
  const p = rounded
      ? Array.from(
          { length: 16 },
          (_, i) =>
            [
              (Math.cos((i * Math.PI) / 8) * w) / 2,
              (Math.sin((i * Math.PI) / 8) * d) / 2,
            ] as Point,
        )
      : clipped(w, d, w * 0.18),
    q = p.map(([x, z]) => [x * top + 0.08, z * top] as Point);
  loft(k, p, q, 0.22, h, glassColor);
  k.solid(p, 0, 0.22, "#b3c3c1");
  for (let y = 0.22; y < h + 0.2; y += 0.23) {
    const t = (y - 0.22) / h,
      r = p.map(
        ([x, z], i) => [x + (q[i][0] - x) * t, z + (q[i][1] - z) * t] as Point,
      );
    k.band(
      r,
      y,
      0.018,
      0.024,
      y % 0.46 < 0.23 ? "#c4d3cf" : "#789da5",
      "metal",
    );
    if (Math.round(y / 0.23) % 3 === 0)
      k.band(r, y + 0.065, 0.012, 0.026, "#d4d5b8", "window");
  }
  for (let i = 0; i < p.length; i++) {
    const a = new THREE.Vector3(p[i][0], 0.22, p[i][1]),
      b = new THREE.Vector3(q[i][0], h + 0.22, q[i][1]);
    k.beam(a, b, 0.009, "#becfce");
    const j = (i + 1) % p.length;
    for (const fraction of [0.25, 0.5, 0.75]) {
      const lower = new THREE.Vector3(p[i][0], 0.22, p[i][1]).lerp(
        new THREE.Vector3(p[j][0], 0.22, p[j][1]),
        fraction,
      );
      const upper = new THREE.Vector3(q[i][0], h + 0.22, q[i][1]).lerp(
        new THREE.Vector3(q[j][0], h + 0.22, q[j][1]),
        fraction,
      );
      k.beam(lower, upper, 0.0035, "#b5ccce");
    }
  }
  k.solid(q, h + 0.22, 0.14, "#67828a");
  k.hvac(h + 0.36, w * 0.7, d * 0.7);
}
function baseBuilding(
  k: Architecture,
  family: Family,
  w: number,
  d: number,
  h: number,
  variant: number,
) {
  if (extraFamilies.includes(family as ExtraFamily)) { extraBuilding(k,family as ExtraFamily,w,d,h,variant); return; }
  k.count(family);
  if (family === "Sculptural" && variant % 2 === 1) {
    const a = clipped(w, d, 0.12),
      b = a.map(([x, z]) => [x * 0.66 + w * 0.12, z * 0.78] as Point);
    loft(k, a, b, 0, h, "#3d8c98");
    for (let y = 0.3; y < h; y += 0.3) {
      const t = y / h;
      k.band(
        a.map(
          ([x, z], i) =>
            [x + (b[i][0] - x) * t, z + (b[i][1] - z) * t] as Point,
        ),
        y,
        0.022,
        0.035,
        "#d6d1bc",
      );
    }
    k.solid(clipped(w * 0.65, d * 0.7, 0.08), 0, h * 0.45, "#c3bca8");
    const roof = new THREE.BufferGeometry();
    roof.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -w * 0.2,
          h,
          -d * 0.3,
          w * 0.45,
          h,
          -d * 0.3,
          w * 0.45,
          h + 0.28,
          d * 0.3,
          -w * 0.2,
          h,
          -d * 0.3,
          w * 0.45,
          h + 0.28,
          d * 0.3,
          -w * 0.2,
          h + 0.28,
          d * 0.3,
        ],
        3,
      ),
    );
    roof.computeVertexNormals();
    k.geometry(roof, "#7b9b91", "copper");
    k.box(-w * 0.27, h * 0.45 + 0.055, d * 0.15, 0.17, 0.11, 0.2, "#86a16c");
    return;
  }
  if (family === "Art Deco") {
    const stone = ["#d8b88a", "#d9b875", "#e9d9b5"][variant % 3];
    let bottom = 0;
    for (const [scale, fraction] of variant % 2
      ? [
          [1, 0.18],
          [0.96, 0.2],
          [0.76, 0.48],
          [0.56, 0.14],
        ]
      : [
          [1, 0.18],
          [0.88, 0.17],
          [0.68, 0.44],
          [0.5, 0.13],
          [0.34, 0.08],
        ]) {
      const pts = clipped(
          w * scale,
          d * scale * (variant % 2 ? 0.68 : 1),
          0.07 * scale,
        ),
        height = h * fraction;
      k.solid(pts, bottom, height, stone);
      k.windows(pts, bottom + 0.01, height, "deco", 0.2, 0.24);
      k.band(pts, bottom + height, 0.06, 0.055, "#efe1c3");
      bottom += height;
    }
    for (let i = 0; i < 3; i++)
      k.solid(
        clipped(w * (0.29 - i * 0.045), d * (0.29 - i * 0.045), 0.025),
        h + i * 0.09,
        0.09,
        "#72968d",
        "copper",
      );
    k.cylinder(0, h + 0.4, 0, 0.02, 0.38, "#c4cbbf", "metal", 0.006);
    k.storefront(w, d, "#7d9288");
  } else if (family === "Historic brick") {
    const brick = ["#c96b4b", "#a84e3b", "#d98570", "#a06a49"][variant % 4],
      p =
        variant % 2
          ? clipped(w, d, 0.06)
          : ([
              [-w / 2, -d / 2],
              [w / 2, -d / 2],
              [w / 2, d / 2],
              [w * 0.08, d / 2],
              [w * 0.08, d * 0.17],
              [-w / 2, d * 0.17],
            ] as Point[]);
    k.solid(p, 0, h, brick);
    k.windows(
      p,
      0.44,
      h - 0.44,
      "historic",
      variant % 2 ? 0.23 : 0.28,
      variant % 2 ? 0.29 : 0.33,
    );
    for (let y = 0.45; y < h; y += 0.29) k.band(p, y, 0.027, 0.025, "#d5bba0");
    k.solid(p, h, 0.055, "#e4ccb1");
    k.band(p, h + 0.06, 0.095, 0.075, "#d9c3a4");
    k.band(p, h + 0.12, 0.13, 0.045, "#dec9ac");
    k.band(p, h + 0.17, 0.04, 0.09, "#bfa68a");
    k.storefront(w, d, ["#678c7d", "#ae7759", "#597f85"][variant % 3]);
    k.waterTank(-w * 0.18, h + 0.2, -d * 0.1, 0.075);
    k.escape(w, d, h);
    k.hvac(h + 0.2, w, d);
  } else if (family === "Glass tower") {
    tapered(k, w, d, h, variant % 2 ? 0.92 : 0.66, variant % 2 === 1,["#72b9d3","#3d8c98","#6489a6"][variant%3]);
  } else if (family === "Prewar residential") {
    const p: Point[] =
        variant % 2
          ? [
              [-w / 2, -d / 2],
              [w / 2, -d / 2],
              [w / 2, d / 2],
              [w * 0.12, d / 2],
              [w * 0.12, d * 0.1],
              [-w / 2, d * 0.1],
            ]
          : [
              [-w / 2, -d / 2],
              [w / 2, -d / 2],
              [w / 2, d / 2],
              [w * 0.18, d / 2],
              [w * 0.18, -d * 0.02],
              [-w * 0.18, -d * 0.02],
              [-w * 0.18, d / 2],
              [-w / 2, d / 2],
            ],
      stone = ["#d98570", "#e7b09a", "#c98e93", "#d9aa63", "#d8b88a"][variant % 5];
    k.solid(p, 0, h, stone);
    k.windows(
      p,
      0.3,
      h - 0.32,
      "residential",
      variant % 2 ? 0.29 : 0.22,
      variant % 2 ? 0.33 : 0.29,
    );
    for (const [x, z] of [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [-w / 2, d / 2],
      [w / 2, d / 2],
    ]) {
      k.box(x, h * 0.5, z, 0.07, h, 0.07, "#e6d9be");
      for (let y = 0.3; y < h; y += 0.32)
        k.box(x, y, z, 0.09, 0.04, 0.09, "#b7a48a");
    }
    for (let y = 0.65; y < h; y += 0.58) {
      k.box(-w * 0.36, y, d / 2 + 0.09, w * 0.22, 0.035, 0.2, "#d8c5a7");
      k.box(
        -w * 0.36,
        y + 0.09,
        d / 2 + 0.18,
        w * 0.22,
        0.12,
        0.02,
        "#667d74",
        "metal",
      );
      k.box(w * 0.36, y, d / 2 + 0.09, w * 0.22, 0.035, 0.2, "#d8c5a7");
      k.box(
        w * 0.36,
        y + 0.09,
        d / 2 + 0.18,
        w * 0.22,
        0.12,
        0.02,
        "#667d74",
        "metal",
      );
    }
    k.band(p, h, 0.08, 0.09, "#e8d9b9");
    loft(
      k,
      p,
      p.map(([x, z]) => [x * 0.78, z * 0.78] as Point),
      h,
      0.25,
      "#5c9b85",
      "copper",
    );
    k.band(p, h + 0.03, 0.025, 0.025, "#496b66", "metal");
    k.box(0, 0.22, -d / 2 - 0.04, 0.19, 0.36, 0.06, "#507070", "glass");
    k.box(0, 0.43, -d / 2 - 0.08, 0.28, 0.07, 0.18, "#dbccb1");
    k.hvac(h + 0.27, w * 0.5, d * 0.5);
  } else if (family === "Mixed use") {
    const p: Point[] =
      variant % 2
        ? clipped(w, d, 0.1)
        : [
            [-w / 2, -d / 2],
            [w / 2, -d / 2],
            [w / 2, d * 0.14],
            [w * 0.1, d * 0.14],
            [w * 0.1, d / 2],
            [-w / 2, d / 2],
          ];
    k.solid(p, 0, 0.57, "#ddd1b9");
    k.storefront(w, d, "#b07a5b");
    k.solid(p, 0.57, h - 0.57, variant%2?"#d9aa63":"#c96b4b");
    k.windows(p, 0.6, h - 0.62, "retail", variant % 2 ? 0.32 : 0.24, 0.3);
    if (variant % 2)
      for (let x = -w * 0.42; x < w * 0.5; x += w * 0.28)
        k.box(x, 0.3, d / 2 + 0.025, 0.035, 0.55, 0.09, "#ddcfb3");
    k.band(p, 0.58, 0.08, 0.07, "#ece0c8");
    k.band(p, h, 0.07, 0.09, "#d8cbae");
    const q = clipped(w * 0.58, d * 0.6, 0.07);
    k.solid(q, h, 0.28, "#acbdad");
    k.windows(q, h + 0.02, 0.25, "deco");
    k.hvac(h + 0.28, w * 0.6, d * 0.6);
    for (let i = 0; i < 3; i++)
      k.box(
        -w * 0.38,
        h + 0.06,
        -d * 0.3 + i * 0.18,
        0.12,
        0.12,
        0.12,
        "#7c966a",
      );
  } else {
    // Offset terraced wings, one sloping glass fin, and an asymmetric copper cap.
    const p = clipped(w, d, 0.13);
    k.solid(p, 0, 0.3, "#d5cebb");
    for (let i = 0; i < 4; i++) {
      const width = w * (1 - i * 0.16),
        depth = d * (1 - i * 0.13),
        x = (i - 1) * w * 0.09,
        hh = h / 4;
      const q = clipped(width, depth, 0.09);
      loft(
        k,
        q.map(([a, b]) => [a + x, b] as Point),
        q.map(([a, b]) => [a + x + 0.075, b * 0.94] as Point),
        0.3 + i * hh,
        hh,
        "#72b9d3",
      );
      k.band(
        q.map(([a, b]) => [a + x, b] as Point),
        0.3 + i * hh,
        0.04,
        0.065,
        "#e4d8bf",
      );
      for (let j = 0; j < 3; j++)
        k.box(
          -w * 0.37 + i * 0.1,
          0.39 + i * hh,
          -d * 0.25 + j * 0.18,
          0.1,
          0.1,
          0.1,
          "#809d72",
        );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -w * 0.25,
          h + 0.3,
          -d * 0.27,
          w * 0.36,
          h + 0.3,
          -d * 0.27,
          w * 0.36,
          h + 0.65,
          d * 0.18,
          -w * 0.25,
          h + 0.3,
          -d * 0.27,
          w * 0.36,
          h + 0.65,
          d * 0.18,
          -w * 0.25,
          h + 0.65,
          d * 0.18,
        ],
        3,
      ),
    );
    g.computeVertexNormals();
    k.geometry(g, "#7b9d94", "copper");
    k.box(w * 0.15, h + 0.39, 0, w * 0.3, 0.2, d * 0.26, "#6c8385");
  }
}

export const buildingVariants: Record<Family, [string, string]> = {
  "Luxury residential":["Balcony needle","Paired residential wings"],
  Terraced:["Four garden steps","Three courtyard terraces"],
  "Corner building":["Curved coral corner","Round-front retail house"],
  "Mid-century office":["Aluminum curtain slab","Bronze framed office bar"],
  "Art Deco": ["Setback needle", "Limestone wing slab"],
  "Historic brick": ["Cast-iron loft", "Brick corner shop"],
  "Glass tower": ["Faceted curtain tower", "Rounded glass office"],
  "Prewar residential": [
    "Copper courtyard residence",
    "Bay-window corner apartments",
  ],
  "Mixed use": ["Corner office loft", "Arcade department store"],
  Sculptural: ["Planted terrace tower", "Sloping copper pavilion"],
};
export function building(
  k: Architecture,
  family: Family,
  w: number,
  d: number,
  h: number,
  variant: number,
) {
  const glazing=["#4b8295","#426d78","#6489a6","#3d8c98"][variant%4];
  k.facade(glazing,variant%2?'#70583f':'#4d666b',family==='Glass tower'?'cool':family==='Historic brick'?'warm':'soft');
  baseBuilding(k, family, w, d, h, variant);
  if(family==='Historic brick'){for(let row=0,y=.48;y<h-.04;y+=.075,row++){k.box(0,y,d/2+.009,w*.96,.005,.006,'#c3a88c','stone',0,true);for(let x=-w*.45+(row%2)*.065;x<w*.47;x+=.13)k.box(x,y+.035,d/2+.009,.004,.068,.006,'#bea086','stone',0,true)}}
  k.count(buildingVariants[family][variant % 2]);
  if (family === "Historic brick" && variant % 2 === 0) {
    for (let x = -w * 0.42; x < w * 0.5; x += w * 0.28)
      k.box(x, h * 0.5 + 0.15, d / 2 + 0.025, 0.033, h - 0.35, 0.06, "#cdbd9f");
    k.box(-w * 0.23, h + 0.32, -d * 0.2, 0.22, 0.25, 0.2, "#c2ac8b");
  }
  if (family === "Prewar residential" && variant % 2) {
    k.band(
      clipped(w * 0.65, d * 0.55, 0.04),
      h + 0.29,
      0.025,
      0.08,
      "#728e82",
      "metal",
    );
    for (let i = 0; i < 3; i++)
      k.box(
        -w * 0.2 + i * w * 0.2,
        h + 0.33,
        -d * 0.16,
        0.09,
        0.09,
        0.1,
        "#83a074",
      );
    k.box(0, 0.43, d / 2 + 0.1, w * 0.4, 0.055, 0.22, "#77978e");
    for (let y = 0.65; y < h - 0.1; y += 0.33)
      k.box(w * 0.45, y, d * 0.2, 0.17, 0.23, 0.18, "#d3c7ae");
  }
  if (family === "Mixed use") {
    k.band(
      clipped(w * 0.6, d * 0.6, 0.04),
      h + 0.32,
      0.018,
      0.1,
      "#8fa398",
      "metal",
    );
    k.box(0, h + 0.35, 0, 0.16, 0.025, 0.13, "#cdb28b");
    for (const x of [-0.13, 0.13])
      k.box(x, h + 0.32, 0, 0.06, 0.1, 0.08, "#b19e7b");
  }
  if (family === "Glass tower") {
    for (let i = 0; i < 2; i++) {
      const g = new THREE.BoxGeometry(w * 0.22, 0.012, d * 0.24).rotateX(-0.28);
      k.geometry(
        g,
        "#537483",
        "glass",
        -w * 0.12 + i * w * 0.25,
        h + 0.43,
        d * 0.15,
      );
    }
    k.cylinder(w * 0.1, h + 0.61, 0, 0.008, 0.44, "#aabfb7", "metal", 0.003, 6);
    k.box(-w * 0.15, h + 0.41, -d * 0.2, w * 0.35, 0.16, d * 0.25, "#91a9a6");
  }
}

// Keep the established non-primary Vanderbilt massing independent of the new ordinary variants.
export function vanderbiltTower(
  k: Architecture,
  w: number,
  d: number,
  h: number,
) {
  tapered(k, w, d, h, 0.64, false);
  k.count("Vanderbilt tower");
}
