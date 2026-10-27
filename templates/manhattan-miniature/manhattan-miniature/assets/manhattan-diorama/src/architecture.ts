import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type Point = [number, number];
type Kind =
  "stone" | "glass" | "window" | "windowSoft" | "windowCool" | "metal" | "copper" | "accent" | "crown";
type Entry = { matrix: THREE.Matrix4; color: THREE.Color };
export const rect = (w: number, d: number): Point[] => [
  [-w / 2, -d / 2],
  [w / 2, -d / 2],
  [w / 2, d / 2],
  [-w / 2, d / 2],
];
export const clipped = (w: number, d: number, c = 0.15): Point[] => [
  [-w / 2 + c, -d / 2],
  [w / 2 - c, -d / 2],
  [w / 2, -d / 2 + c],
  [w / 2, d / 2 - c],
  [w / 2 - c, d / 2],
  [-w / 2 + c, d / 2],
  [-w / 2, d / 2 - c],
  [-w / 2, -d / 2 + c],
];
export class Architecture {
  private boxes = new Map<string, Entry[]>();
  private custom = new Map<Kind, THREE.BufferGeometry[]>();
  private object = new THREE.Object3D();
  private origin = new THREE.Vector3();
  private yaw = 0;
  private glazing = '#426b7c';
  private frameColor = '#63635c';
  private lightKind: Kind = 'window';
  facade(glazing:string,frame:string,light:'warm'|'soft'|'cool'='warm') {
    this.glazing=glazing;this.frameColor=frame;
    this.lightKind=light==='cool'?'windowCool':light==='soft'?'windowSoft':'window';
  }
  private lodZone = 0;
  private lodMeshes: { mesh: THREE.Object3D; center: THREE.Vector3 }[] = [];
  readonly counts: Record<string, number> = {};
  readonly materials: Record<Kind, THREE.MeshStandardMaterial> = {
    stone: new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0.015 }),
    glass: new THREE.MeshStandardMaterial({
      roughness: 0.18,
      metalness: 0.42,
      side: THREE.DoubleSide,
    }),
    window: new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      color: "#ffffff",
      emissive: "#ffc176",
      emissiveIntensity: 0,
      roughness: 0.3,
      metalness: 0.25,
    }),
    windowSoft: new THREE.MeshStandardMaterial({side:THREE.DoubleSide,color:'#ffffff',emissive:'#ffe2b1',emissiveIntensity:0,roughness:.34,metalness:.2}),
    windowCool: new THREE.MeshStandardMaterial({side:THREE.DoubleSide,color:'#ffffff',emissive:'#97c8e8',emissiveIntensity:0,roughness:.2,metalness:.34}),
    metal: new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.72 }),
    copper: new THREE.MeshStandardMaterial({
      roughness: 0.55,
      metalness: 0.36,
    }),
    crown: new THREE.MeshStandardMaterial({
      color: "#ecf3f1",
      roughness: 0.23,
      metalness: 0.72,
      emissive: "#91bac7",
      emissiveIntensity: 0,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: "#e2dfc8",
      emissive: "#ffcf86",
      emissiveIntensity: 0,
      roughness: 0.45,
      metalness: 0.35,
    }),
  };
  constructor(private scene: THREE.Scene) {}
  at(x: number, z: number, y = 0.69, yaw = 0) {
    this.origin.set(x, y, z);
    this.yaw = yaw;
    this.facade("#426b7c","#63635c",Math.floor(Math.abs(z))%3===0?"soft":"warm");
    this.lodZone = z < -6 ? 0 : z < 1 ? 1 : z < 8 ? 2 : 3;
    return this;
  }
  private transform(
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    rotation = 0,
  ) {
    this.object.position
      .set(x, y, z)
      .applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.yaw)
      .add(this.origin);
    this.object.rotation.set(0, this.yaw + rotation, 0);
    this.object.scale.set(sx, sy, sz);
    this.object.updateMatrix();
    return this.object.matrix.clone();
  }
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    kind: Kind = "stone",
    yaw = 0,
    micro = false,
  ) {
    if (w <= 0 || h <= 0 || d <= 0) return;
    const key = kind + (micro ? `:${this.lodZone}` : "");
    if (!this.boxes.has(key)) this.boxes.set(key, []);
    this.boxes.get(key)!.push({
      matrix: this.transform(x, y, z, w, h, d, yaw),
      color: new THREE.Color(color),
    });
  }
  geometry(
    geometry: THREE.BufferGeometry,
    color: string,
    kind: Kind = "stone",
    x = 0,
    y = 0,
    z = 0,
  ) {
    geometry.applyMatrix4(this.transform(x, y, z));
    const col = new THREE.Color(color),
      a = new Float32Array(geometry.getAttribute("position").count * 3);
    for (let i = 0; i < a.length; i += 3) {
      a[i] = col.r;
      a[i + 1] = col.g;
      a[i + 2] = col.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(a, 3));
    if (!geometry.getAttribute("uv"))
      geometry.setAttribute(
        "uv",
        new THREE.BufferAttribute(new Float32Array((a.length / 3) * 2), 2),
      );
    if (geometry.index) {
      const g = geometry.toNonIndexed();
      geometry.dispose();
      geometry = g;
    }
    if (!this.custom.has(kind)) this.custom.set(kind, []);
    this.custom.get(kind)!.push(geometry);
  }
  solid(
    points: Point[],
    bottom: number,
    h: number,
    color: string,
    kind: Kind = "stone",
    bevel = 0.008,
  ) {
    const shape = new THREE.Shape();
    points.forEach(([x, z], i) =>
      i ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
    );
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: h,
      bevelEnabled: bevel > 0,
      bevelSegments: 1,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 5,
    });
    g.rotateX(-Math.PI / 2);
    this.geometry(g, color, kind, 0, bottom, 0);
  }
  band(
    points: Point[],
    y: number,
    width = 0.025,
    h = 0.04,
    color = "#d9cfb8",
    kind: Kind = "stone",
  ) {
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      this.box(
        (a[0] + b[0]) / 2,
        y,
        (a[1] + b[1]) / 2,
        len + width,
        h,
        width,
        color,
        kind,
        -Math.atan2(dz, dx),
      );
    }
  }
  beam(
    a: THREE.Vector3,
    b: THREE.Vector3,
    r: number,
    color: string,
    kind: Kind = "metal",
  ) {
    const v = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(r, r, v.length(), 5);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        v.normalize(),
      ),
    );
    this.geometry(
      g,
      color,
      kind,
      ...(a.clone().add(b).multiplyScalar(0.5).toArray() as [
        number,
        number,
        number,
      ]),
    );
  }
  cylinder(
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    color: string,
    kind: Kind = "stone",
    top = r,
    sides = 12,
  ) {
    this.geometry(
      new THREE.CylinderGeometry(top, r, h, sides),
      color,
      kind,
      x,
      y,
      z,
    );
  }
  // Polygon-edge facade placement follows the footprint, including wedges and courtyards.
  windows(
    points: Point[],
    bottom: number,
    h: number,
    style: "deco" | "historic" | "residential" | "retail" = "historic",
    spacing = 0.24,
    floor = 0.28,
  ) {
    const area = points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0);
    const winding = area > 0 ? 1 : -1;
    for (let e = 0; e < points.length; e++) {
      const a = points[e],
        b = points[(e + 1) % points.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      if (length < 0.16) continue;
      const nx = (dz / length) * winding,
        nz = (-dx / length) * winding,
        angle = -Math.atan2(dz, dx),
        cols = Math.max(1, Math.floor(length / spacing)),
        rows = Math.floor((h - 0.08) / floor);
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const t = (col + 0.5) / cols,
            x = a[0] + dx * t,
            z = a[1] + dz * t,
            y = bottom + 0.14 + row * floor,
            w = (length / cols) * (style === "deco" ? 0.38 : 0.56),
            hh = style === "deco" ? floor * 0.61 : floor * 0.53;
          const lit =
            (row * 13 + col * 7 + e * 3 + Math.floor(this.origin.z * 19)) %
              7 !==
            0;
          this.box(
            x + nx * 0.015,
            y,
            z + nz * 0.015,
            w + 0.032,
            hh + 0.035,
            0.026,
            this.frameColor,
            "stone",
            angle,
          );
          this.box(
            x + nx * 0.031,
            y,
            z + nz * 0.031,
            w,
            hh,
            0.013,
            lit ? this.glazing : "#284f68",
            lit ? (row%5===0 && this.lightKind!=="windowCool"?"windowSoft":this.lightKind) : "glass",
            angle,
          );
          if (style !== "deco") {
            this.box(
              x + nx * 0.049,
              y - hh / 2 - 0.018,
              z + nz * 0.049,
              w + 0.075,
              0.027,
              0.065,
              "#d8c9ad",
              "stone",
              angle,
              true,
            );
            this.box(
              x + nx * 0.045,
              y + hh / 2 + 0.02,
              z + nz * 0.045,
              w + 0.05,
              0.022,
              0.04,
              "#dbccb4",
              "stone",
              angle,
              true,
            );
          }
        }
      if (style === "deco") {
        for (let col = 0; col <= cols; col++) {
          const t = col / cols;
          this.box(
            a[0] + dx * t + nx * 0.035,
            bottom + h / 2,
            a[1] + dz * t + nz * 0.035,
            0.026,
            h,
            0.045,
            "#e1d2b4",
            "stone",
            angle,
          );
        }
      }
    }
  }
  hvac(y: number, w: number, d: number) {
    this.box(w * 0.17, y + 0.13, -d * 0.15, 0.21, 0.24, 0.23, "#849398");
    for (let i = 0; i < 4; i++)
      this.box(
        w * 0.17 - 0.07 + i * 0.046,
        y + 0.255,
        -d * 0.15,
        0.012,
        0.012,
        0.21,
        "#53696f",
        "metal",
        0,
        true,
      );
    this.box(-w * 0.21, y + 0.055, d * 0.17, 0.14, 0.11, 0.2, "#a4a9a0");
  }
  waterTank(x: number, y: number, z: number, r = 0.12) {
    const scale = r / 0.12;
    for (const dx of [-r * 0.65, r * 0.65])
      for (const dz of [-r * 0.65, r * 0.65])
        this.box(
          x + dx,
          y + 0.12 * scale,
          z + dz,
          0.025 * scale,
          0.26 * scale,
          0.025 * scale,
          "#586466",
          "metal",
        );
    this.cylinder(x, y + 0.39 * scale, z, r, 0.32 * scale, "#966c4b");
    this.cylinder(
      x,
      y + 0.585 * scale,
      z,
      r * 1.18,
      0.12 * scale,
      "#60716c",
      "metal",
      0,
    );
    for (const yy of [0.28, 0.47])
      this.cylinder(
        x,
        y + yy * scale,
        z,
        r * 1.025,
        0.018 * scale,
        "#485e60",
        "metal",
      );
  }
  storefront(w: number, d: number, color = "#598d7f") {
    for (let i = 0; i < 3; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / 3;
      this.box(
        x,
        0.22,
        d / 2 + 0.025,
        (w / 3) * 0.79,
        0.3,
        0.025,
        "#9bada3",
        "window",
      );
      this.box(x, 0.39, d / 2 + 0.12, (w / 3) * 0.93, 0.07, 0.26, color);
      this.box(x, 0.43, d / 2 + 0.245, (w / 3) * 0.93, 0.1, 0.025, color);
      this.box(x, 0.58, d / 2 + 0.035, (w / 3) * 0.85, 0.14, 0.035, "#e7dcc5");
      this.box(
        x,
        0.58,
        d / 2 + 0.058,
        (w / 3) * 0.6,
        0.022,
        0.012,
        color,
        "metal",
      );
    }
    this.box(0, 0.2, d / 2 + 0.055, 0.09, 0.34, 0.04, "#c6b18c", "metal");
  }
  escape(w: number, d: number, h: number) {
    const x = w * 0.12,
      z = d / 2 + 0.12;
    for (let y = 0.65; y < h - 0.1; y += 0.32) {
      this.box(x, y, z, 0.28, 0.025, 0.22, "#465e5a", "metal", 0, true);
      this.box(
        x,
        y + 0.11,
        z + 0.11,
        0.29,
        0.02,
        0.022,
        "#465e5a",
        "metal",
        0,
        true,
      );
      for (const xx of [-0.13, 0, 0.13])
        this.box(
          x + xx,
          y + 0.06,
          z + 0.11,
          0.014,
          0.12,
          0.014,
          "#465e5a",
          "metal",
          0,
          true,
        );
      for (let i = 0; i < 6; i++)
        this.box(
          x - 0.1 + i * 0.037,
          y + 0.02 + i * 0.04,
          z,
          0.045,
          0.015,
          0.1,
          "#465e5a",
          "metal",
          0,
          true,
        );
    }
  }
  count(type: string) {
    this.counts[type] = (this.counts[type] ?? 0) + 1;
  }
  finish() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const glazingPlane = new THREE.PlaneGeometry(1,1);
    for (const [key, entries] of this.boxes) {
      const [kind, zone] = key.split(":");
      const m = new THREE.InstancedMesh(
        kind.startsWith("window") ? glazingPlane : geometry,
        this.materials[kind as Kind],
        entries.length,
      );
      entries.forEach((e, i) => {
        m.setMatrixAt(i, e.matrix);
        m.setColorAt(i, e.color);
      });
      m.castShadow = kind === "stone" || kind === "metal";
      m.receiveShadow = true;
      m.computeBoundingSphere();
      this.scene.add(m);
      if (zone !== undefined)
        this.lodMeshes.push({
          mesh: m,
          center: new THREE.Vector3(0, 2, [-10, -3, 5, 11][Number(zone)]),
        });
    }
    for (const [kind, geometries] of this.custom) {
      const merged = mergeGeometries(geometries, false);
      geometries.forEach((g) => g.dispose());
      if (!merged) throw new Error("Architecture geometry merge failed");
      const material = this.materials[kind].clone();
      material.vertexColors = true;
      const m = new THREE.Mesh(merged, material);
      m.castShadow = !kind.startsWith("window") && kind !== "glass";
      m.receiveShadow = true;
      this.scene.add(m);
      material.userData.kind = kind;
      this.materialCopies.push(material);
    }
  }
  private materialCopies: THREE.MeshStandardMaterial[] = [];
  update(night: number, camera: THREE.Camera) {
    this.materials.window.emissiveIntensity = night * 1.3;
    this.materials.windowSoft.emissiveIntensity = night * 1.05;
    this.materials.windowCool.emissiveIntensity = night * .7;
    this.materials.accent.emissiveIntensity = night * 1.4;
    this.materials.crown.emissiveIntensity = night * 0.85;
    this.materialCopies.forEach((m) => {
      if (m.userData.kind === "accent") m.emissiveIntensity = night * 1.4;
      if (m.userData.kind === "crown") m.emissiveIntensity = night * 0.85;
      if (m.userData.kind === "window") m.emissiveIntensity = night * 1.3;
      if (m.userData.kind === "windowSoft") m.emissiveIntensity = night * 1.05;
      if (m.userData.kind === "windowCool") m.emissiveIntensity = night * .7;
    });
    for (const l of this.lodMeshes)
      l.mesh.visible = camera.position.distanceTo(l.center) < 43;
  }
}
