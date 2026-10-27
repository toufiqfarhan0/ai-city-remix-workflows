import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export class Model {
  parts: Record<string, THREE.BufferGeometry[]> = {};
  add(
    g: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    part = "body",
  ) {
    g.translate(x, y, z);
    if (g.index) {
      const other = g.toNonIndexed();
      g.dispose();
      g = other;
    }
    if (!g.getAttribute("uv"))
      g.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          new Float32Array(g.getAttribute("position").count * 2),
          2,
        ),
      );
    const c = new THREE.Color(color),
      colors = [];
    for (let i = 0; i < g.getAttribute("position").count; i++)
      colors.push(c.r, c.g, c.b);
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    (this.parts[part] ??= []).push(g);
  }
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    part = "body",
  ) {
    this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, part);
  }
  cylinder(
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    color: string,
    rotation = 0,
  ) {
    const g = new THREE.CylinderGeometry(r, r, h, 10);
    g.rotateZ(rotation);
    this.add(g, color, x, y, z);
  }
  finish() {
    return Object.fromEntries(
      Object.entries(this.parts).map(([name, geos]) => {
        const g = mergeGeometries(geos, false)!;
        geos.forEach((s) => s.dispose());
        return [name, g];
      }),
    );
  }
}
export type VehicleKind = "taxi" | "car" | "bus" | "delivery";
export function vehicleModel(kind: VehicleKind) {
  const m = new Model(),
    bus = kind === "bus",
    truck = kind === "delivery",
    length = bus ? 0.4 : truck ? 0.32 : 0.22,
    width = bus || truck ? 0.112 : 0.098,
    color =
      kind === "taxi"
        ? "#e9b52f"
        : bus
          ? "#789eaa"
          : truck
            ? "#eee5d2"
            : "#a8bcb6";
  m.box(0, 0.045, 0, width, 0.056, length, color);
  if (bus) {
    m.box(0, 0.111, 0, width, 0.094, length * 0.94, "#e9e7d7");
    m.box(0, 0.087, 0, width * 1.015, 0.025, length * 0.96, "#527f91");
    for (const s of [-1, 1])
      for (let i = 0; i < 6; i++)
        m.box(
          s * (width / 2 + 0.001),
          0.126,
          -0.155 + i * 0.055,
          0.005,
          0.046,
          0.04,
          "#3b5864",
        );
    m.box(0, 0.125, -length * 0.48, 0.094, 0.06, 0.008, "#3b5864");
    m.box(0.05, 0.091, -0.08, 0.008, 0.112, 0.06, "#46666e");
    m.box(0, 0.168, 0.04, 0.055, 0.012, 0.11, "#aab6b3");
  } else if (truck) {
    m.box(0, 0.1, 0.045, 0.116, 0.14, 0.2, "#d2d3c4");
    m.box(0, 0.096, -0.107, 0.109, 0.064, 0.088, "#d8b992");
    m.box(0, 0.119, -0.154, 0.09, 0.038, 0.006, "#3f6372");
    for (const s of [-1, 1])
      m.box(s * 0.056, 0.119, -0.11, 0.005, 0.032, 0.05, "#3f6372");
    m.box(0, 0.101, 0.15, 0.102, 0.12, 0.008, "#b3bbb3");
  } else {
    m.box(0, 0.09, 0.006, 0.078, 0.039, 0.12, color);
    m.box(0, 0.105, -0.052, 0.072, 0.025, 0.008, "#436a77");
    m.box(0, 0.104, 0.068, 0.072, 0.024, 0.007, "#436a77");
    for (const s of [-1, 1]) {
      m.box(s * 0.04, 0.104, 0, 0.006, 0.024, 0.093, "#436a77");
      m.box(s * 0.043, 0.101, 0.008, 0.008, 0.033, 0.007, color);
      m.box(s * 0.054, 0.08, -0.042, 0.015, 0.01, 0.018, color);
    }
    if (kind === "taxi") m.box(0, 0.118, 0, 0.039, 0.017, 0.025, "#f1db92");
  }
  for (const x of [-width * 0.52, width * 0.52])
    for (const z of [-length * 0.3, length * 0.3]) {
      m.cylinder(x, 0.031, z, 0.023, 0.014, "#3d4848", Math.PI / 2);
      m.cylinder(x * 1.06, 0.031, z, 0.011, 0.015, "#b0b9b2", Math.PI / 2);
    }
  for (const x of [-width * 0.32, width * 0.32]) {
    m.box(
      x,
      0.062,
      -length / 2 - 0.003,
      0.019,
      0.014,
      0.009,
      "#fff0cc",
      "head",
    );
    m.box(x, 0.06, length / 2 + 0.003, 0.018, 0.012, 0.008, "#e14b3f", "tail");
  }
  m.box(0, 0.05, -length / 2 - 0.005, width * 0.85, 0.012, 0.008, "#abb9b4");
  m.box(0, 0.047, length / 2 + 0.005, 0.035, 0.015, 0.008, "#e7d9b4");
  return m.finish();
}
export function boatModel(type: "ferry" | "water taxi" | "sailboat") {
  const m = new Model(),
    length = type === "ferry" ? 0.7 : type === "water taxi" ? 0.48 : 0.42,
    w = type === "ferry" ? 0.25 : 0.17;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -length * 0.34);
  shape.lineTo(-w * 0.43, length * 0.28);
  shape.quadraticCurveTo(0, length * 0.65, w * 0.43, length * 0.28);
  shape.lineTo(w / 2, -length * 0.34);
  shape.closePath();
  const hull = new THREE.ExtrudeGeometry(shape, {
    depth: 0.085,
    bevelEnabled: true,
    bevelSize: 0.018,
    bevelThickness: 0.014,
    bevelSegments: 2,
  });
  hull.rotateX(-Math.PI / 2);
  m.add(hull, type === "water taxi" ? "#edbb41" : "#eee7d3", 0, 0.005, 0);
  if (type !== "sailboat") {
    m.box(
      0,
      0.145,
      0.015,
      w * 0.75,
      0.13,
      length * 0.57,
      type === "water taxi" ? "#dfb64d" : "#e9e2cf",
    );
    m.box(0, 0.22, 0.015, w * 0.85, 0.025, length * 0.6, "#e9e2cc");
    for (const s of [-1, 1])
      for (let i = 0; i < 4; i++)
        m.box(
          s * w * 0.38,
          0.17,
          -length * 0.18 + i * length * 0.105,
          0.008,
          0.055,
          length * 0.075,
          "#3e697b",
        );
    m.box(0, 0.165, -length * 0.29, w * 0.68, 0.055, 0.008, "#3e697b");
    m.box(0, 0.25, 0.12, 0.045, 0.07, 0.05, "#b36c4d");
  } else {
    m.cylinder(0, 0.36, 0, 0.008, 0.64, "#b0c2bc");
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          0, 0.13, 0, 0, 0.65, 0, 0, 0.13, -0.29, 0, 0.13, 0.03, 0, 0.54, 0.03,
          0, 0.13, 0.21,
        ],
        3,
      ),
    );
    g.computeVertexNormals();
    m.add(g, "#efe1be", 0, 0, 0);
  }
  for (const s of [-1, 1]) {
    m.box(s * w * 0.43, 0.11, 0, 0.009, 0.04, length * 0.68, "#c9c9b1");
    for (let i = 0; i < 5; i++)
      m.box(
        s * w * 0.43,
        0.105,
        -length * 0.3 + i * length * 0.15,
        0.008,
        0.09,
        0.008,
        "#e1d9c0",
      );
  }
  return m.finish().body;
}
