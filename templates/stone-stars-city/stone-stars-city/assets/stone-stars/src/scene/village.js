// Warm storybook village on a floating island around the landmark: houses, a ring road, a plaza
// with a fountain, trees, flowers and clouds. Seeded, so the layout never changes between loads.
// The module deliberately owns no render loop, textures, or global state.

export function buildVillage(THREE) {
  const group = new THREE.Group();
  group.name = 'StorybookVillage';

  const TAU = Math.PI * 2;
  const topY = 0.34;
  let seed = 31122026;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const between = (a, b) => a + (b - a) * random();

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0,
    ...extra
  });

  const materials = {
    islandSide: mat('#347c76', { roughness: 0.96 }),
    limestone: mat('#ead8b7', { roughness: 0.9 }),
    grass: mat('#71966f', { roughness: 1 }),
    road: mat('#c9836f', { roughness: 0.96, side: THREE.DoubleSide }),
    roadEdge: mat('#f0dab8', { roughness: 0.93, side: THREE.DoubleSide }),
    plaza: mat('#ddb98e', { roughness: 0.96 }),
    plazaAccent: mat('#ba846e', { roughness: 0.94 }),
    wall: mat('#ffffff', { roughness: 0.82 }),
    trim: mat('#f6e5c5', { roughness: 0.82 }),
    roof: mat('#ffffff', { roughness: 0.86 }),
    glass: mat('#5a9ea2', { roughness: 0.22, metalness: 0.08, emissive: '#173b42', emissiveIntensity: 0.18 }),
    dark: mat('#315d5c', { roughness: 0.74 }),
    wood: mat('#91634e', { roughness: 0.9 }),
    leaf: mat('#ffffff', { roughness: 0.98 }),
    flower: mat('#ffffff', { roughness: 0.82 }),
    water: mat('#4fc1c5', { roughness: 0.16, metalness: 0.06, transparent: true, opacity: 0.82 }),
    waterBright: mat('#b9fbef', { roughness: 0.12, emissive: '#65cec8', emissiveIntensity: 0.34 }),
    cloud: mat('#fff4dd', { roughness: 1 }),
  };

  function roundedShape(width, depth, radius) {
    const x = -width / 2;
    const y = -depth / 2;
    const s = new THREE.Shape();
    s.moveTo(x + radius, y);
    s.lineTo(x + width - radius, y);
    s.quadraticCurveTo(x + width, y, x + width, y + radius);
    s.lineTo(x + width, y + depth - radius);
    s.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
    s.lineTo(x + radius, y + depth);
    s.quadraticCurveTo(x, y + depth, x, y + depth - radius);
    s.lineTo(x, y + radius);
    s.quadraticCurveTo(x, y, x + radius, y);
    return s;
  }

  function islandLayer(width, depth, radius, height, y, material, bevel = 0.18) {
    const geo = new THREE.ExtrudeGeometry(roundedShape(width, depth, radius), {
      depth: height,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 4
    });
    geo.rotateX(Math.PI / 2);
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = y - geo.boundingBox.max.y;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }

  // Floating island: deep teal rock, a pale carved rim, and a moss-soft top.
  islandLayer(51.4, 47.2, 5.8, 2.55, -0.03, materials.islandSide, 0.28);
  islandLayer(52.0, 47.8, 6.0, 0.48, 0.16, materials.limestone, 0.23);
  islandLayer(50.4, 46.2, 5.25, 0.22, topY, materials.grass, 0.15);

  const roadCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-17.8, topY + 0.035, -20.2),
    new THREE.Vector3(-22.0, topY + 0.035, -14.2),
    new THREE.Vector3(-22.1, topY + 0.035, 9.8),
    new THREE.Vector3(-18.7, topY + 0.035, 18.6),
    new THREE.Vector3(0, topY + 0.035, 20.5),
    new THREE.Vector3(18.7, topY + 0.035, 18.6),
    new THREE.Vector3(22.1, topY + 0.035, 9.8),
    new THREE.Vector3(22.0, topY + 0.035, -14.2),
    new THREE.Vector3(17.8, topY + 0.035, -20.2),
    new THREE.Vector3(0, topY + 0.035, -21.0)
  ], true, 'catmullrom', 0.34);

  function curveStrip(curve, width, segments, material, yOffset = 0) {
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      const side = new THREE.Vector3(tangent.z, 0, -tangent.x).multiplyScalar(width / 2);
      positions.push(p.x + side.x, p.y + yOffset, p.z + side.z);
      positions.push(p.x - side.x, p.y + yOffset, p.z - side.z);
      uvs.push(0, t * 12, 1, t * 12);
      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  curveStrip(roadCurve, 2.48, 128, materials.roadEdge, -0.012);
  curveStrip(roadCurve, 2.16, 128, materials.road, 0.012);

  // A warm cobbled gathering place, deliberately low so the basilica owns the skyline.
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.35, 0.22, 48), materials.plaza);
  plaza.position.set(0, topY + 0.23, 15.8);
  plaza.receiveShadow = true;
  group.add(plaza);

  const ringGeo = new THREE.TorusGeometry(1, 0.07, 6, 64);
  const ringMesh = new THREE.InstancedMesh(ringGeo, materials.plazaAccent, 3);
  const dummy = new THREE.Object3D();
  [1.5, 2.45, 3.45].forEach((radius, i) => {
    dummy.position.set(0, topY + 0.37, 15.8);
    dummy.rotation.set(Math.PI / 2, 0, 0);
    dummy.scale.setScalar(radius);
    dummy.updateMatrix();
    ringMesh.setMatrixAt(i, dummy.matrix);
  });
  ringMesh.receiveShadow = true;
  group.add(ringMesh);

  const stepData = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    stepData.push({
      p: [Math.sin(a) * 3.78, topY + 0.4, 15.8 + Math.cos(a) * 3.78],
      s: [0.7, 0.12, 0.36],
      r: [0, -a, 0],
      c: i % 2 ? '#efd7af' : '#c99179'
    });
  }
  for (let z = 11.45; z < 12.7; z += 0.62) {
    stepData.push({p: [0, topY + 0.37, z], s: [1.75, 0.11, 0.48], r: [0, 0, 0], c: '#efd7af'});
  }

  const batches = {
    steps: { geometry: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), material: materials.trim, items: stepData },
    walls: { geometry: roundedBoxGeometry(), material: materials.wall, items: [] },
    roofs: { geometry: barrelRoofGeometry(), material: materials.roof, items: [] },
    gables: { geometry: gableRoofGeometry(), material: materials.roof, items: [] },
    trims: { geometry: roundedBoxGeometry(), material: materials.trim, items: [] },
    glass: { geometry: archGeometry(0.78, 1.1, 0.09), material: materials.glass, items: [] },
    frames: { geometry: archGeometry(0.96, 1.28, 0.07), material: materials.trim, items: [] },
    balconies: { geometry: new THREE.BoxGeometry(1, 1, 1), material: materials.dark, items: [] },
    awnings: { geometry: roundedBoxGeometry(), material: materials.roof, items: [] },
    awningStripes: { geometry: roundedBoxGeometry(), material: materials.trim, items: [] },
    chimneys: { geometry: roundedBoxGeometry(), material: materials.roof, items: [] },
    trunks: { geometry: new THREE.CylinderGeometry(0.45, 0.58, 1, 9), material: materials.wood, items: [] },
    foliage: { geometry: new THREE.SphereGeometry(0.5, 12, 9), material: materials.leaf, items: [] },
    cypress: { geometry: new THREE.ConeGeometry(0.5, 1, 12), material: materials.leaf, items: [] },
    flowers: { geometry: new THREE.IcosahedronGeometry(0.5, 1), material: materials.flower, items: [] },
  };

  function roundedBoxGeometry() {
    const geo = new THREE.ExtrudeGeometry(roundedShape(1, 1, 0.12), {
      depth: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.055,
      bevelThickness: 0.055,
      curveSegments: 3
    });
    geo.translate(0, 0, -0.5);
    return geo;
  }

  function archGeometry(width, height, depth) {
    const s = new THREE.Shape();
    const half = width / 2;
    const spring = height - half;
    s.moveTo(-half, 0);
    s.lineTo(half, 0);
    s.lineTo(half, spring);
    s.absarc(0, spring, half, 0, Math.PI, false);
    s.lineTo(-half, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 7 });
    geo.translate(0, -height / 2, -depth / 2);
    return geo;
  }

  function barrelRoofGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0);
    s.bezierCurveTo(-0.48, 0.62, -0.28, 1, 0, 1);
    s.bezierCurveTo(0.28, 1, 0.48, 0.62, 0.5, 0);
    s.lineTo(-0.5, 0);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      curveSegments: 10
    });
    geo.translate(0, 0, -0.5);
    return geo;
  }

  function gableRoofGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0);
    s.lineTo(0, 1);
    s.lineTo(0.5, 0);
    s.lineTo(-0.5, 0);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.045,
      bevelThickness: 0.045,
      curveSegments: 2
    });
    geo.translate(0, 0, -0.5);
    return geo;
  }

  function item(p, s, c, r = [0, 0, 0]) {
    return { p, s, c, r };
  }

  const wallPalette = ['#efad8f', '#f1c985', '#9ecdb5', '#b7cadb', '#e7a8a6', '#d5b4ce', '#f2d6ad', '#83bcb7'];
  const roofPalette = ['#b85f51', '#c96e55', '#4f8e88', '#d48765', '#8f6b87', '#d2a052'];
  const houseSpecs = [
    [-17.2, -12.4, 5.1, 4.4, 5.2, 0],
    [-17.7, -4.7, 4.3, 4.8, 4.2, 1],
    [-17.2, 3.0, 5.0, 4.1, 5.8, 2],
    [-17.6, 10.3, 4.4, 4.8, 4.8, 3],
    [17.2, -12.4, 4.8, 4.5, 5.6, 4],
    [17.7, -4.7, 4.2, 4.8, 4.4, 5],
    [17.2, 3.0, 5.2, 4.0, 5.1, 6],
    [17.6, 10.3, 4.5, 4.7, 5.9, 7],
    [-12.0, -15.8, 4.8, 4.2, 4.5, 8],
    [-4.0, -15.7, 5.1, 4.4, 5.4, 9],
    [4.0, -15.7, 4.7, 4.3, 4.7, 10],
    [12.0, -15.8, 5.1, 4.1, 5.8, 11],
    [-13.1, 15.7, 5.1, 4.0, 4.6, 12],
    [13.1, 15.7, 5.1, 4.0, 5.0, 13]
  ];

  function addHouseDetails(x, z, w, d, h, index) {
    const floors = Math.max(2, Math.min(3, Math.round(h / 1.9)));
    const faces = [
      {nx: 0, nz: 1, angle: 0, width: w, depth: d},
      {nx: 0, nz: -1, angle: Math.PI, width: w, depth: d},
      {nx: 1, nz: 0, angle: Math.PI / 2, width: d, depth: w},
      {nx: -1, nz: 0, angle: -Math.PI / 2, width: d, depth: w}
    ];
    faces.forEach((face, faceIndex) => {
      const cols = face.width > 4.55 ? 3 : 2;
      const surface = face.depth / 2 + 0.31;
      for (let floor = 0; floor < floors; floor++) {
        const wy = topY + 1.22 + floor * ((h - 1.3) / floors);
        for (let col = 0; col < cols; col++) {
          if (floor === 0 && col === Math.floor(cols / 2)) continue;
          const along = (col - (cols - 1) / 2) * (face.width / (cols + 0.4));
          const px = x + face.nx * surface + Math.cos(face.angle) * along;
          const pz = z + face.nz * surface - Math.sin(face.angle) * along;
          batches.frames.items.push(item([px, wy, pz], [0.76, 0.86, 1], '#f6e5c5', [0, face.angle, 0]));
          batches.glass.items.push(item([
            px + face.nx * 0.035,
            wy,
            pz + face.nz * 0.035
          ], [0.70, 0.79, 1], (floor + faceIndex) % 2 ? '#72b7b4' : '#3f7f88', [0, face.angle, 0]));
        }
      }
      // Every side gets a visible arched doorway, avoiding blank exterior boxes from any camera angle.
      const doorX = x + face.nx * (face.depth / 2 + 0.33);
      const doorZ = z + face.nz * (face.depth / 2 + 0.33);
      const doorY = topY + 0.91;
      batches.frames.items.push(item([doorX, doorY, doorZ], [1.02, 1.4, 1], '#f6e5c5', [0, face.angle, 0]));
      batches.glass.items.push(item([
        doorX + face.nx * 0.04,
        doorY,
        doorZ + face.nz * 0.04
      ], [0.80, 1.27, 1], faceIndex % 2 ? '#315d5c' : '#4b7773', [0, face.angle, 0]));
    });

    // Identify the inward face for a small balcony.
    const xFacing = Math.abs(x) > Math.abs(z) + 2;
    let angle;
    let nx;
    let nz;
    let facadeWidth;
    let faceDepth;
    if (xFacing) {
      const inward = x < 0 ? 1 : -1;
      angle = inward > 0 ? Math.PI / 2 : -Math.PI / 2;
      nx = inward;
      nz = 0;
      facadeWidth = d;
      faceDepth = w;
    } else {
      const inward = z < 0 ? 1 : -1;
      angle = inward > 0 ? 0 : Math.PI;
      nx = 0;
      nz = inward;
      facadeWidth = w;
      faceDepth = d;
    }
    if (index % 2 === 0) {
      const by = topY + Math.min(h - 1.0, 3.18);
      const bx = x + nx * (faceDepth / 2 + 0.54);
      const bz = z + nz * (faceDepth / 2 + 0.54);
      batches.balconies.items.push(item([bx, by, bz], xFacing ? [0.72, 0.16, 2.15] : [2.15, 0.16, 0.72], '#315d5c', [0, 0, 0]));
      for (let k = -2; k <= 2; k++) {
        const along = k * 0.43;
        batches.balconies.items.push(item([
          bx + Math.cos(angle) * along + nx * 0.26,
          by + 0.42,
          bz - Math.sin(angle) * along + nz * 0.26
        ], [0.07, 0.72, 0.07], '#315d5c'));
      }
    }

    // Put a chunky striped awning on the outward face where the orbiting camera sees it first.
    const outX = -nx;
    const outZ = -nz;
    const outAngle = angle + Math.PI;
    const ay = topY + 2.12;
    const ax = x + outX * (faceDepth / 2 + 0.56);
    const az = z + outZ * (faceDepth / 2 + 0.56);
    const awningScale = xFacing ? [0.9, 0.2, 2.15] : [2.15, 0.2, 0.9];
    const awningRotation = [outZ * 0.24, 0, -outX * 0.24];
    batches.awnings.items.push(item([ax, ay, az], awningScale, roofPalette[index % roofPalette.length], awningRotation));
    for (let stripe = -1.5; stripe <= 1.5; stripe += 1) {
      const shift = stripe * 0.42;
      batches.awningStripes.items.push(item([
        ax + (xFacing ? 0 : shift),
        ay + 0.035,
        az + (xFacing ? shift : 0)
      ], xFacing ? [0.92, 0.06, 0.20] : [0.20, 0.06, 0.92], '#fff0cf', awningRotation));
    }
  }

  houseSpecs.forEach(([x, z, w, d, h, index]) => {
    const wallColor = wallPalette[index % wallPalette.length];
    const roofColor = roofPalette[(index * 3 + 1) % roofPalette.length];
    batches.walls.items.push(item([x, topY + h / 2, z], [w, h, d], wallColor));
    batches.trims.items.push(item([x, topY + 0.24, z], [w + 0.18, 0.38, d + 0.18], '#f6e5c5'));
    batches.trims.items.push(item([x, topY + h - 0.18, z], [w + 0.24, 0.28, d + 0.24], '#f6e5c5'));

    const roofRise = 1.65 + (index % 3) * 0.22;
    if (index % 3 === 1) {
      batches.gables.items.push(item([x, topY + h - 0.06, z], [w + 0.72, roofRise, d + 0.68], roofColor));
    } else {
      batches.roofs.items.push(item([x, topY + h - 0.06, z], [w + 0.72, roofRise, d + 0.68], roofColor));
    }
    if (index % 3 !== 2) {
      const chimneyX = x + w * (index % 2 ? -0.24 : 0.24);
      const chimneyZ = z + d * 0.16;
      batches.chimneys.items.push(item([chimneyX, topY + h + 1.2, chimneyZ], [0.56, 1.75, 0.56], index % 2 ? '#a85e55' : '#4f817b'));
      batches.trims.items.push(item([chimneyX, topY + h + 2.08, chimneyZ], [0.76, 0.18, 0.76], '#f6e5c5'));
    }
    addHouseDetails(x, z, w, d, h, index);
  });

  // Trees and flowers frame the edges while keeping the +Z basilica facade open.
  const broadTrees = [
    [-12.7, -9.8, 1.0], [-12.6, -2.1, 0.88], [-12.4, 7.0, 0.95],
    [12.7, -9.4, 0.94], [12.7, -1.4, 0.86], [12.4, 7.0, 0.92],
    [-7.7, -19.1, 0.92], [7.7, -19.1, 0.98], [-18.6, 14.5, 0.8], [18.6, 14.5, 0.8]
  ];
  broadTrees.forEach(([x, z, s], i) => {
    batches.trunks.items.push(item([x, topY + 0.72 * s, z], [0.56 * s, 1.45 * s, 0.56 * s], '#91634e'));
    batches.foliage.items.push(item([x, topY + 2.0 * s, z], [2.25 * s, 2.5 * s, 2.15 * s], i % 3 ? '#739a6d' : '#91ad75'));
    batches.foliage.items.push(item([x - 0.55 * s, topY + 2.55 * s, z + 0.12 * s], [1.45 * s, 1.38 * s, 1.4 * s], '#94b579'));
    batches.foliage.items.push(item([x + 0.52 * s, topY + 2.45 * s, z - 0.1 * s], [1.38 * s, 1.55 * s, 1.35 * s], '#648e67'));
    batches.foliage.items.push(item([x - 0.12 * s, topY + 3.02 * s, z - 0.28 * s], [1.18 * s, 1.08 * s, 1.15 * s], '#aac487'));
    batches.foliage.items.push(item([x + 0.15 * s, topY + 1.72 * s, z + 0.48 * s], [1.35 * s, 1.22 * s, 1.3 * s], '#5f8b65'));
  });
  const cypresses = [[-20.0, -7.8], [-20.1, 4.0], [20.0, -7.8], [20.1, 4.0], [-15.7, -18.4], [15.7, -18.4]];
  cypresses.forEach(([x, z], i) => {
    batches.trunks.items.push(item([x, topY + 0.9, z], [0.38, 1.8, 0.38], '#805b48'));
    batches.cypress.items.push(item([x, topY + 3.15, z], [1.35, 4.6 + (i % 2) * 0.45, 1.35], i % 2 ? '#477c65' : '#56896b'));
  });

  const flowerColors = ['#f5c36d', '#e8878b', '#d9a1d2', '#fff0bd', '#79b9aa'];
  const flowerBeds = [[-9.9, 9.4], [9.9, 9.4], [-10.2, 18.0], [10.2, 18.0], [-18.9, -17.2], [18.9, -17.2]];
  flowerBeds.forEach(([cx, cz], bed) => {
    for (let i = 0; i < 13; i++) {
      const a = i * 2.39996 + bed;
      const r = 0.22 + (i % 5) * 0.17;
      batches.flowers.items.push(item([
        cx + Math.cos(a) * r,
        topY + 0.38 + (i % 3) * 0.035,
        cz + Math.sin(a) * r * 0.58
      ], [0.22, 0.22, 0.22], flowerColors[(i + bed) % flowerColors.length]));
    }
  });

  function buildBatch({geometry, material, items}, name) {
    if (!items.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    mesh.name = name;
    const color = new THREE.Color();
    items.forEach((entry, i) => {
      dummy.position.set(...entry.p);
      dummy.rotation.set(...(entry.r || [0, 0, 0]));
      dummy.scale.set(...entry.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(entry.c || '#ffffff');
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  Object.entries(batches).forEach(([name, batch]) => buildBatch(batch, name));

  // Petite turquoise fountain at the heart of the front plaza.
  const fountain = new THREE.Group();
  fountain.name = 'TurquoiseFountain';
  fountain.position.set(0, topY + 0.38, 16);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.58, 0.42, 32), materials.limestone);
  basin.position.y = 0.20;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.12, 32), materials.water);
  water.position.y = 0.46;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.29, 1.5, 16), materials.limestone);
  stem.position.y = 1.05;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 10, 0, TAU, 0, Math.PI / 2), materials.water);
  bowl.rotation.x = Math.PI;
  bowl.scale.y = 0.34;
  bowl.position.y = 1.61;
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 9), materials.waterBright);
  crown.position.y = 1.88;
  [basin, water, stem, bowl, crown].forEach(mesh => {
    mesh.castShadow = mesh !== water;
    mesh.receiveShadow = true;
    fountain.add(mesh);
  });
  group.add(fountain);

  const sparkleCount = 14;
  const sparkleGeo = new THREE.IcosahedronGeometry(0.09, 1);
  const sparkles = new THREE.InstancedMesh(sparkleGeo, materials.waterBright, sparkleCount);
  sparkles.name = 'FountainSparkles';
  fountain.add(sparkles);
  const sparklePhases = Array.from({length: sparkleCount}, (_, i) => i * 0.73 + (i % 3) * 0.31);

  // Plush clouds sit behind the basilica and drift only a little.
  const cloudPuffs = [
    [-16.6, 26, -35, 5.0, 2.2, 2.4], [-14.2, 26.65, -34.8, 4.3, 2.7, 2.6], [-11.9, 25.95, -35.15, 4.7, 2.0, 2.25],
    [13.6, 29, -41, 5.2, 2.4, 2.6], [16.2, 29.75, -41, 4.4, 3.0, 2.8], [18.7, 29.05, -41.35, 4.9, 2.1, 2.45],
    [-1.6, 35, -46, 3.7, 1.9, 2.0], [0.45, 35.5, -46.15, 4.0, 2.3, 2.2], [2.55, 34.95, -46, 3.6, 1.8, 2.0]
  ];
  const cloudMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 12, 8), materials.cloud, cloudPuffs.length);
  cloudMesh.name = 'PlushClouds';
  cloudMesh.castShadow = false;
  cloudPuffs.forEach((p, i) => {
    dummy.position.set(p[0], p[1], p[2]);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(p[3], p[4], p[5]);
    dummy.updateMatrix();
    cloudMesh.setMatrixAt(i, dummy.matrix);
  });
  group.add(cloudMesh);

  // A thin water rill near the front edge adds another turquoise note without crossing the road.
  const rill = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 18.0, 4, 18), materials.water);
  rill.rotation.z = Math.PI / 2;
  rill.scale.set(0.16, 1, 1);
  rill.position.set(0, topY + 0.09, 22.0);
  rill.receiveShadow = true;
  group.add(rill);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.22, 1.25), materials.limestone);
  bridge.position.set(0, topY + 0.47, 22.0);
  bridge.castShadow = true;
  bridge.receiveShadow = true;
  group.add(bridge);

  let lastT = Number.NaN;
  function animate(t) {
    if (!Number.isFinite(t) || t === lastT) return;
    lastT = t;
    for (let i = 0; i < sparkleCount; i++) {
      const phase = sparklePhases[i];
      const cycle = (t * 0.52 + phase / TAU) % 1;
      const angle = phase + t * 0.18;
      const radius = 0.18 + cycle * 0.86;
      const arc = Math.sin(cycle * Math.PI);
      dummy.position.set(Math.cos(angle) * radius, 1.74 + arc * 0.92 - cycle * 0.38, Math.sin(angle) * radius);
      const scale = 0.58 + arc * 0.7;
      dummy.scale.setScalar(scale);
      dummy.rotation.set(t * 0.7 + phase, phase, 0);
      dummy.updateMatrix();
      sparkles.setMatrixAt(i, dummy.matrix);
    }
    sparkles.instanceMatrix.needsUpdate = true;
    cloudPuffs.forEach((p, i) => {
      const cloudBand = Math.floor(i / 3);
      const drift = Math.sin(t * (0.045 + cloudBand * 0.008) + cloudBand * 1.7) * (0.7 + cloudBand * 0.15);
      const bob = Math.sin(t * 0.08 + i * 0.9) * 0.12;
      dummy.position.set(p[0] + drift, p[1] + bob, p[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(p[3], p[4], p[5]);
      dummy.updateMatrix();
      cloudMesh.setMatrixAt(i, dummy.matrix);
    });
    cloudMesh.instanceMatrix.needsUpdate = true;
    water.material.emissiveIntensity = 0.04 + Math.sin(t * 1.2) * 0.018;
  }

  group.traverse(object => {
    if (object.isMesh && object.name !== 'PlushClouds') object.receiveShadow = true;
  });

  const stats = Object.freeze({
    houses: houseSpecs.length,
    trees: broadTrees.length + cypresses.length,
    flowerBlossoms: batches.flowers.items.length,
    roadLength: Number(roadCurve.getLength().toFixed(1)),
    animatedSparkles: sparkleCount,
    landmarkClearance: { minX: -9, maxX: 9, minZ: -10, maxZ: 11 },
    approximateDrawCalls: 35
  });
  group.userData.stats = stats;

  return { group, roadCurve, animate, stats };
}
