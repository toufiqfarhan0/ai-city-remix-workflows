import * as THREE from "three";
import { Architecture } from "./architecture";
import { pointedArch } from "./chryslerArch";
import { type Footprint, type RoadNetwork, occupied } from "./streets";

export type WalkPath = { curve: THREE.Curve<THREE.Vector3>; speed: number };
export function buildUrbanEnvironment(
  scene: THREE.Scene,
  network: RoadNetwork,
  footprints: Footprint[],
  outline: number[][],
) {
  const k = new Architecture(scene),
    walks: WalkPath[] = [],
    signals: {
      mesh: THREE.Mesh;
      node: number;
      vertical: boolean;
      isGreen: boolean;
    }[] = [];
  let seed = 744;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const streetTrees: THREE.Vector3[] = [],
    poolPositions: THREE.Vector3[] = [],
    swayTrees: {
      mesh: THREE.InstancedMesh;
      data: { x: number; y: number; z: number; s: number; variant: number }[];
    }[] = [];
  function bench(x: number, z: number, yaw = 0, y = 0.7) {
    k.at(x, z, y, yaw);
    for (const s of [-1, 1])
      k.box(s * 0.065, 0.025, 0, 0.016, 0.05, 0.07, "#4e6d66", "metal");
    for (let i = 0; i < 3; i++)
      k.box(0, 0.06, -0.03 + i * 0.025, 0.18, 0.014, 0.019, "#ac8d62");
    k.box(0, 0.1, -0.04, 0.18, 0.075, 0.015, "#b29b72");
    k.at(0, 0, 0);
  }
  function lamp(x: number, z: number) {
    k.cylinder(x, 0.91, z, 0.011, 0.55, "#647f77", "metal");
    k.box(x + 0.035, 1.2, z, 0.09, 0.025, 0.055, "#e6d4b1", "accent");
    k.box(x + 0.035, 1.18, z, 0.068, 0.009, 0.04, "#ffdd9b", "accent");
    poolPositions.push(new THREE.Vector3(x + 0.035, 0.69, z));
  }
  function shrub(x: number, z: number, s = 0.07) {
    k.cylinder(x, 0.72 + s * 0.5, z, s, s, "#87a273", "stone", s * 0.75, 7);
  }
  function roadWidth(vertical: boolean, x: number) {
    return vertical
      ? x < -2
        ? 0.22
        : x < 0
          ? 0.28
          : x < 2
            ? 0.32
            : 0.28
      : 0.22;
  }
  // Asphalt and raised curb/sidewalk sections are generated from exactly the traversable road edges.
  network.edges.forEach((edge, index) => {
    const A = network.nodes[edge.a],
      B = network.nodes[edge.b],
      dx = B.x - A.x,
      dz = B.z - A.z,
      len = Math.hypot(dx, dz),
      vertical = Math.abs(dz) > Math.abs(dx),
      w = edge.width ?? roadWidth(vertical, A.x),
      yaw = -Math.atan2(dz, dx),
      nx = dz / len,
      nz = -dx / len;
    k.at(0, 0, 0);
    k.box(
      (A.x + B.x) / 2,
      0.65,
      (A.z + B.z) / 2,
      len + 0.015,
      0.035,
      w,
      "#596c72",
      "stone",
      yaw,
    );
    for (const s of [-1, 1]) {
      const off = (w / 2 + 0.035) * s;
      k.box(
        (A.x + B.x) / 2 + nx * off,
        0.684,
        (A.z + B.z) / 2 + nz * off,
        Math.max(.01,len - 0.38),
        0.045,
        0.055,
        "#c1bfa8",
        "stone",
        yaw,
      );
      k.box(
        (A.x + B.x) / 2 + nx * (w / 2 + 0.008) * s,
        0.69,
        (A.z + B.z) / 2 + nz * (w / 2 + 0.008) * s,
        Math.max(.01,len - 0.38),
        0.018,
        0.015,
        "#e0d6bd",
        "stone",
        yaw,
      );
    }
    for (let t = 0.17; t < len - 0.1; t += 0.28)
      k.box(
        A.x + (dx * t) / len,
        0.672,
        A.z + (dz * t) / len,
        0.1,
        0.006,
        0.009,
        vertical ? "#d4c89e" : "#e4ddc1",
        "stone",
        yaw,
      );
    for (const side of [-1, 1]) {
      const off = (w / 2 + 0.06) * side,
        px = A.x + dx * 0.35 + nx * off,
        pz = A.z + dz * 0.35 + nz * off,
        qx = A.x + dx * 0.75 + nx * off,
        qz = A.z + dz * 0.75 + nz * off;
      if (
        !occupied(px, pz, footprints, 0.035) &&
        !occupied(qx, qz, footprints, 0.035) &&
        index % 3 === 0
      )
        walks.push({
          curve: new THREE.LineCurve3(
            new THREE.Vector3(px, 0.7, pz),
            new THREE.Vector3(qx, 0.7, qz),
          ),
          speed: 0.04 + rand() * 0.025,
        });
      if (index % 7 === 0 && !occupied(px, pz, footprints, 0.06)) {
        bench(px, pz, yaw);
        k.cylinder(qx, 0.735, qz, 0.025, 0.075, "#597e70", "metal");
        k.cylinder(qx, 0.778, qz, 0.028, 0.012, "#b4c2ac", "metal");
      }
      if (index % 6 === 0 && !occupied(qx, qz, footprints, 0.055)) {
        k.cylinder(qx, 0.73, qz, 0.014, 0.075, "#b65d44", "metal");
        k.box(qx, 0.752, qz, 0.052, 0.018, 0.018, "#c47550", "metal");
      }
    }
    if (index % 7 === 2) {
      const off = w / 2 + 0.055,
        px = (A.x + B.x) / 2 + nx * off,
        pz = (A.z + B.z) / 2 + nz * off;
      if (!occupied(px, pz, footprints, 0.06)) {
        lamp(px, pz);
        k.box(px, 0.94, pz, 0.1, 0.035, 0.009, "#568675", "metal", yaw);
        k.box(px, 0.95, pz, 0.07, 0.005, 0.012, "#ebddba", "stone", yaw);
      }
    }
    if (index % 8 === 1) {
      const x = (A.x + B.x) / 2 + nx * (w / 2 + 0.12),
        z = (A.z + B.z) / 2 + nz * (w / 2 + 0.12);
      if (!occupied(x, z, footprints, 0.14))
        streetTrees.push(new THREE.Vector3(x, 0.99, z));
    }
    if (index % 17 === 4) {
      const off = w / 2 + 0.075,
        px = (A.x + B.x) / 2 + nx * off,
        pz = (A.z + B.z) / 2 + nz * off;
      if (!occupied(px, pz, footprints, 0.11)) {
        k.at(px, pz, 0.69, yaw);
        for (const x of [-0.12, 0.12])
          k.box(x, 0.16, 0, 0.012, 0.32, 0.012, "#758e85", "metal");
        k.box(0, 0.32, 0, 0.3, 0.025, 0.14, "#7a9c96");
        k.box(0, 0.18, -0.06, 0.26, 0.22, 0.009, "#a5c2bd", "glass");
        k.box(0.145, 0.22, -0.02, 0.04, 0.15, 0.022, "#729ba3");
        k.at(0, 0, 0);
        bench(px, pz, yaw);
      }
    }
  });
  for (let id = 0; id < network.nodes.length; id++) {
    const n = network.nodes[id];
    if (n.neighbors.length < 2) continue;
    k.at(0, 0, 0);
    for (const next of n.neighbors) {
      const b=network.nodes[next],dx=b.x-n.x,dz=b.z-n.z,len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len;
      if(len<.4)continue;
      const yaw=-Math.atan2(dz,dx);
      for(let i=0;i<5;i++)k.box(n.x+ux*.22-uz*(-.09+i*.045),.677,n.z+uz*.22+ux*(-.09+i*.045),.08,.007,.023,'#eee6cc','stone',yaw);
    }
    if (n.neighbors.length >= 3 && id % 2 === 0) {
      for (const vertical of [true, false]) {
        const x = n.x + (vertical ? 0.18 : -0.18),
          z = n.z + (vertical ? -0.18 : 0.18);
        if (occupied(x, z, footprints, 0.04)) continue;
        k.cylinder(x, 0.91, z, 0.009, 0.46, "#b8a479", "metal");
        k.box(x, 1.12, z, 0.047, 0.12, 0.04, "#596765");
        for (const [name, y, color] of [
          ["red", 1.145, "#f27150"],
          ["green", 1.1, "#88c5a1"],
        ] as const) {
          const material = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 1,
          });
          const m = new THREE.Mesh(
            new THREE.SphereGeometry(0.012, 6, 5),
            material,
          );
          m.position.set(x, y, z + 0.024);
          scene.add(m);
          signals.push({
            mesh: m,
            node: id,
            vertical,
            isGreen: name === "green",
          });
        }
      }
    }
  }
  // Irregular lake shoreline, with a narrow neck and a crossing footbridge.
  k.at(0,0,0);
  const lakeShape=new THREE.Shape();
  const shore=[[-.35,-12.65],[.1,-12.95],[.65,-12.7],[1.05,-12.1],[.9,-11.55],[.55,-11.3],[.8,-10.7],[.52,-10.3],[.02,-10.45],[-.2,-10.95],[-.05,-11.45],[-.45,-11.9]];
  const shoreCurve=new THREE.SplineCurve([...shore,shore[0]].map(p=>new THREE.Vector2(p[0],p[1])));
  lakeShape.setFromPoints(shoreCurve.getPoints(80));
  const lake=new THREE.ShapeGeometry(lakeShape).rotateX(Math.PI/2).translate(0,.689,0);
  k.geometry(lake,'#3e999b','glass');
  for(let i=0;i<14;i++){const t=i/13,x=.02+t*.67,y=.73+Math.sin(t*Math.PI)*.12,z=-11.42;
    k.box(x,y,z,.054,.028,.17,'#b8a47c');
    for(const side of[-1,1]){k.box(x,y+.07,z+side*.085,.01,.13,.01,'#917f61');if(i)k.beam(new THREE.Vector3(x-.052,y+.13,z+side*.085),new THREE.Vector3(x,y+.13,z+side*.085),.009,'#a3916b');}
  }
  // Park landscape: open lawns, curving paths and several canopy species, not street-tree rows.
  const leafData = [[], [], []] as {
    x: number;
    y: number;
    z: number;
    s: number;
    variant: number;
  }[][];
  for (let patch = 0; patch < 13; patch++) {
    const x = (rand() - 0.5) * 2.7,
      z = -14 + rand() * 6.7;
    k.at(0, 0, 0);
    k.cylinder(
      x,
      0.673,
      z,
      0.18 + rand() * 0.22,
      0.012,
      ["#91ab65", "#a6b77b", "#7fa365"][patch % 3],
      "stone",
      undefined,
      9,
    );
  }
  const curves = [
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.15, 0.7, -13.9),
      new THREE.Vector3(-0.65, 0.7, -12.9),
      new THREE.Vector3(-0.95, 0.7, -11.6),
      new THREE.Vector3(-0.45, 0.7, -10.2),
      new THREE.Vector3(0.8, 0.7, -8.9),
      new THREE.Vector3(0.35, 0.7, -7.1),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.3, 0.7, -13.8),
      new THREE.Vector3(0.7, 0.7, -13),
      new THREE.Vector3(-0.6, 0.7, -12.9),
      new THREE.Vector3(-1.3, 0.7, -10.2),
      new THREE.Vector3(-0.6, 0.7, -8.1),
    ]),
  ];
  for (const curve of curves) {
    k.geometry(new THREE.TubeGeometry(curve, 75, 0.043, 5, false).translate(0,-.7,0).scale(1,.12,1).translate(0,.686,0), "#d7c9a5");
    walks.push({ curve, speed: 0.045 });
    for (let i = 0; i < 5; i++) {
      const p = curve.getPoint((i + 0.3) / 5);
      bench(p.x + 0.1, p.z, Math.PI / 2);
      if (i % 2 === 0) lamp(p.x - 0.1, p.z);
    }
  }
  for (let i = 0; i < 200; i++) {
    const cluster=i%7, x = Math.max(-1.4,Math.min(1.4,Math.sin(cluster*2.4)*1.05+(rand()-.5)*.9)),
      z = Math.max(-14,Math.min(-7.3,-13.7+cluster*1.03+(rand()-.5)*1.2));
    if (
      Math.hypot((x - 0.4) / 0.85, (z + 11.6) / 1.25) < 1.1 ||
      Math.hypot(x, z + 8.3) < 0.65 ||
      curves.some((c) =>
        c.getPoints(35).some((p) => Math.hypot(p.x - x, p.z - z) < 0.16),
      )
    )
      continue;
    const type = i % 3,
      s = 0.12 + rand() * 0.13,
      y = 0.83 + s * 0.95;
    k.cylinder(x, 0.81, z, 0.018, 0.25, "#817150");
    leafData[type].push({ x, y, z, s, variant: type });
    if (i % 7 === 0) shrub(x + 0.14, z - 0.1);
  }
  for (let i = 0; i < 12; i++) {
    const x = -.98 + rand() * .75,
      z = 14.43 + rand() * .5;
    leafData[i % 3].push({
      x,
      y: 1.02,
      z,
      s: 0.12 + rand() * 0.05,
      variant: i % 3,
    });
    k.cylinder(x, 0.8, z, 0.015, 0.23, "#817150");
  }
  for (const p of streetTrees) {
    leafData[1].push({ x: p.x, y: p.y, z: p.z, s: 0.115, variant: 1 });
    k.cylinder(p.x, 0.81, p.z, 0.013, 0.25, "#817150");
  }
  const geometries = [
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.SphereGeometry(1, 7, 5),
    new THREE.ConeGeometry(1, 2.2, 7),
  ];
  for (let type = 0; type < 3; type++) {
    const data = leafData[type],
      m = new THREE.InstancedMesh(
        geometries[type],
        new THREE.MeshStandardMaterial({ roughness: 0.95 }),
        data.length,
      );
    data.forEach((_d, i) =>
      m.setColorAt(
        i,
        new THREE.Color(["#71955a", "#93ab6e", "#5b8666"][type]).multiplyScalar(
          0.88 + rand() * 0.22,
        ),
      ),
    );
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    scene.add(m);
    swayTrees.push({ mesh: m, data });
  }
  // Low-profile waterfront promenade, docks and mooring bollards.
  k.at(0, 0, 0);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    k.box(
      (a[0] + b[0]) / 2,
      0.56,
      (a[1] + b[1]) / 2,
      len,
      0.12,
      0.07,
      "#b4b4a0",
      "stone",
      -Math.atan2(dz, dx),
    );
    for (let t = 0.3; t < len; t += 0.7) {
      const x = a[0] + (dx * t) / len,
        z = a[1] + (dz * t) / len;
      k.cylinder(x, 0.665, z, 0.018, 0.07, "#74857b", "metal");
    }
  }
  for (const [x, z] of [
    [-3.8, -8],
    [-3.6, 4],
    [-2.8, 10],
    [3.8, -7],
  ]) {
    const direction = Math.sign(x);
    k.box(x + direction * 0.35, 0.59, z, 0.8, 0.1, 0.3, "#b7a889");
    for (let i = 0; i < 9; i++)
      k.box(
        x + direction * (0.03 + i * 0.08),
        0.649,
        z,
        0.052,
        0.012,
        0.29,
        "#c8b89a",
      );
    for (const zz of [-0.12, 0.12]) {
      k.cylinder(x + direction * 0.7, 0.49, z + zz, 0.032, 0.39, "#728d85");
      k.cylinder(
        x + direction * 0.68,
        0.71,
        z + zz,
        0.014,
        0.14,
        "#cad2bb",
        "metal",
      );
    }
  }
  // Compressed East River suspension bridges; intentionally unnamed.
  for (const [bridge, z] of [7.5, 9.7].entries()) {
    const deck = 1.0;
    k.at(0, 0, 0);
    k.box(5.2, deck - 0.07, z, 5.2, 0.14, 0.56, "#7e8d8c");
    for (const s of [-1, 1]) {
      k.box(
        5.2,
        deck + 0.1,
        z + s * 0.27,
        5.15,
        0.025,
        0.018,
        "#9bac9e",
        "metal",
      );
      k.box(
        5.2,
        deck - 0.13,
        z + s * 0.23,
        5.1,
        0.025,
        0.025,
        "#6e8782",
        "metal",
      );
      for (let x = 2.8; x < 7.7; x += 0.24) {
        k.box(
          x,
          deck + 0.05,
          z + s * 0.27,
          0.013,
          0.11,
          0.013,
          "#afbdab",
          "metal",
        );
        k.beam(
          new THREE.Vector3(x, deck - 0.12, z + s * 0.24),
          new THREE.Vector3(x + 0.24, deck - 0.27, z + s * 0.24),
          0.01,
          "#829a91",
        );
      }
    }
    for (const x of [3.9, 6.1]) {
      if (bridge === 1) {
        for (const dz of [-0.3, 0, 0.3])
          k.box(x, 1.65, z + dz, 0.17, 1.4, 0.075, "#c9b99a");
        for (const dz of [-0.15, 0.15]) {
          const g = new THREE.ExtrudeGeometry(pointedArch(0.25, 0.42), {
            depth: 0.17,
            bevelEnabled: false,
            curveSegments: 10,
          });
          g.rotateY(Math.PI / 2);
          k.geometry(g, "#dbccad", "stone", x - 0.085, 1.79, z + dz);
        }
        k.box(x, 2.37, z, 0.23, 0.12, 0.72, "#d6c5a4");
      } else {
        for (const dz of [-0.26, 0.26])
          k.box(x, 1.65, z + dz, 0.11, 1.4, 0.09, "#8caaa5", "metal");
        for (const y of [1.4, 1.82, 2.25]) {
          k.box(x, y, z, 0.1, 0.055, 0.6, "#abc0b2", "metal");
          k.beam(
            new THREE.Vector3(x, y - 0.31, z - 0.25),
            new THREE.Vector3(x, y, z + 0.25),
            0.014,
            "#8aa89e",
          );
        }
      }
    }
    for (const s of [-1, 1]) {
      const anchors = [
        [2.65, 1.04],
        [3.9, 2.35],
        [6.1, 2.35],
        [7.75, 1.04],
      ];
      for (let span = 0; span < 3; span++) {
        const [a, ay] = anchors[span],
          [b, by] = anchors[span + 1];
        let last: THREE.Vector3 | undefined;
        for (let i = 0; i <= 18; i++) {
          const t = i / 18,
            x = a + (b - a) * t,
            y = ay + (by - ay) * t - (span === 1 ? 0.8 : 0.1) * 4 * t * (1 - t),
            p = new THREE.Vector3(x, y, z + s * 0.28);
          if (last) k.beam(last, p, 0.008, "#d8d1ad");
          last = p;
          if (i % 2 === 0)
            k.beam(
              new THREE.Vector3(x, 1.04, z + s * 0.28),
              p,
              0.0045,
              "#b6bda8",
            );
        }
      }
    }
    for (let x = 2.7; x < 7.7; x += 0.28)
      k.box(x, 1.006, z, 0.1, 0.008, 0.012, "#e5d9b6");
  }
  k.finish();
  const contactMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}",
    fragmentShader:
      "varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;gl_FragColor=vec4(.23,.29,.24,exp(-dot(p,p)*4.)*.17);}",
  });
  const contact = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    contactMaterial,
    footprints.length,
  );
  const contactObject = new THREE.Object3D();
  footprints.forEach((b, i) => {
    contactObject.position.set(b.x, 0.674, b.z);
    contactObject.scale.set(b.w * 1.65, 1, b.d * 1.65);
    contactObject.updateMatrix();
    contact.setMatrixAt(i, contactObject.matrix);
  });
  scene.add(contact);
  const glow = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { night: { value: 0 } },
    vertexShader:
      "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}",
    fragmentShader:
      "varying vec2 vUv;uniform float night;void main(){float d=length(vUv-.5)*2.;gl_FragColor=vec4(1.,.68,.27,exp(-d*d*5.)*.23*night);}",
  });
  const pools = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.62, 0.7).rotateX(-Math.PI / 2),
      glow,
      poolPositions.length,
    ),
    dummy = new THREE.Object3D();
  poolPositions.forEach((p, i) => {
    dummy.position.copy(p);
    dummy.updateMatrix();
    pools.setMatrixAt(i, dummy.matrix);
  });
  scene.add(pools);
  // Reflective, animated water normals on a subdivided surface. The boundary matches the display base.
  const waterTime = { value: 0 },
    waterNight = { value: 0 };
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: "#328f9b",
    roughness: 0.28,
    metalness: 0.42,
  });
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterTime = waterTime;
    shader.uniforms.uWaterNight = waterNight;
    shader.vertexShader =
      "uniform float uWaterTime; varying vec3 vWater;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\ntransformed.y += .006*sin(.35*position.x+.22*position.z-.6*uWaterTime)+.006*sin(-.18*position.x+.42*position.z+.45*uWaterTime);vWater=transformed;",
    );
    shader.fragmentShader =
      "uniform float uWaterTime;uniform float uWaterNight;varying vec3 vWater;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      "#include <clipping_planes_fragment>\nvec2 q=abs(vWater.xz)-vec2(7.45,16.2);if(length(max(q,0.))+min(max(q.x,q.y),0.)>1.25)discard;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      "#include <normal_fragment_begin>\nnormal.x+=.018*sin(vWater.x*4.+vWater.z*1.8+uWaterTime*.6);normal.z+=.014*cos(vWater.z*5.-uWaterTime*.45);normal=normalize(normal);",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\nfloat streak=pow(max(0.,sin(vWater.z*38.+sin(vWater.x*6.+uWaterTime)*2.)),14.);totalEmissiveRadiance+=vec3(.5,.3,.12)*uWaterNight*streak*exp(-pow((abs(vWater.x)-4.1)*1.2,2.))*.25;",
    );
  };
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(17.6, 34.7, 60, 110).rotateX(-Math.PI / 2),
    waterMaterial,
  );
  surface.position.y = 0.277;
  surface.receiveShadow = true;
  scene.add(surface);
  return {
    walks,
    signals,
    k,
    update(time: number, night: number, camera: THREE.Camera) {
      waterTime.value = time;
      waterNight.value = night;
      waterMaterial.color
        .set("#328f9b")
        .lerp(new THREE.Color("#214461"), night);
      glow.uniforms.night.value = night;
      k.update(night, camera);
      for (const group of swayTrees) {
        group.data.forEach((d, i) => {
          dummy.position.set(d.x, d.y, d.z);
          dummy.rotation.set(
            Math.sin(time * 0.45 + i) * 0.018,
            0,
            Math.cos(time * 0.4 + i) * 0.012,
          );
          dummy.scale.set(d.s, d.s * (d.variant === 1 ? 1.4 : 1), d.s);
          dummy.updateMatrix();
          group.mesh.setMatrixAt(i, dummy.matrix);
        });
        group.mesh.instanceMatrix.needsUpdate = true;
      }
      for (const s of signals) {
        const phase = (time + network.nodes[s.node].signal * 1.3) % 12,
          green = s.vertical ? phase < 5.2 : phase >= 6 && phase < 11.2;
        const material = s.mesh.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = (s.isGreen ? green : !green) ? 1.8 : 0.02;
      }
    },
  };
}
