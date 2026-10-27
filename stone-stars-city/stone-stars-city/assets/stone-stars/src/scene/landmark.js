// The centrepiece: a storybook Gaudí-style basilica of honey stone, fruit-tipped spires, a rose
// window and three portals. Procedural Three.js only. To build another landmark, replace this file
// and keep the returned shape: { group, hitTarget, animate(t), stats, lightingMaterials, views }.
// The landmark stands on the island's origin, faces +Z and must stay inside the village clearance
// (x -9..9, z -10..11; see village.js).
export function buildLandmark(THREE) {
  const group = new THREE.Group();
  group.name = 'Landmark';

  const PI = Math.PI;
  const TAU = PI * 2;
  const cast = (mesh, receive = true) => {
    mesh.castShadow = true;
    mesh.receiveShadow = receive;
    group.add(mesh);
    return mesh;
  };
  const material = (color, roughness = .78, extras = {}) => new THREE.MeshStandardMaterial({
    color, roughness, metalness: 0, ...extras
  });

  const stone = material('#d9a85c', .88);
  const paleStone = material('#f4d79d', .83);
  const sunStone = material('#d9904f', .85);
  const blushStone = material('#c96d59', .82);
  const shadowStone = material('#9f5b45', .9);
  const deep = material('#312d38', .55);
  const warmRecess = material('#704426', .82, { emissive: '#9a5b25', emissiveIntensity: .08 });
  const roofMat = material('#b5523b', .55, { metalness: .04 });
  const roofDark = material('#7f352e', .62);
  const turquoise = material('#2a9d8f', .4, { metalness: .07 });
  const gold = material('#f5bf4f', .33, { metalness: .14, emissive: '#d8741e', emissiveIntensity: .18 });
  const leafGreen = material('#72ad69', .72);
  const leafLight = material('#a5c86f', .72);
  const berry = material('#d85570', .54);
  const violet = material('#6a4c93', .52);
  const blue = material('#4e8fc4', .46);
  const orange = material('#e76f51', .5);

  const glassAmber = material('#e9c46a', .24, { emissive: '#ff8a25', emissiveIntensity: .9 });
  const glassCyan = material('#2a9d8f', .2, { emissive: '#087d76', emissiveIntensity: .82 });
  const glassMagenta = material('#ec5a9a', .2, { emissive: '#c12670', emissiveIntensity: .82 });
  const glassBlue = material('#5d83ef', .22, { emissive: '#3653d8', emissiveIntensity: .68 });
  const starMaterial = material('#fff4ad', .18, {
    metalness: .08, emissive: '#ffb632', emissiveIntensity: 1.75
  });
  const starCoreMaterial = material('#b8661e', .36, {
    metalness: .08, emissive: '#7f3511', emissiveIntensity: .3
  });
  // Night glow: world.js sets emissiveIntensity = glow × userData.glowScale (default 1) on each of these.
  const lightingMaterials = [glassAmber, glassCyan, glassMagenta, glassBlue, starMaterial];

  function mesh(geometry, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    return cast(m);
  }

  function box(w, h, d, mat, x, y, z, bevel = 0) {
    if (!bevel) return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
    const shape = roundedRectShape(w, h, bevel);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: d, steps: 1, curveSegments: 4,
      bevelEnabled: true, bevelSegments: 2, bevelSize: Math.min(bevel * .42, .13), bevelThickness: .08
    });
    geo.translate(0, 0, -d / 2);
    return mesh(geo, mat, x, y, z);
  }

  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function gabledBlock(width, wallHeight, ridgeHeight, depth, mat, x, y, z) {
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0);
    s.lineTo(width / 2, 0);
    s.lineTo(width / 2, wallHeight);
    s.lineTo(0, ridgeHeight);
    s.lineTo(-width / 2, wallHeight);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth, steps: 1, curveSegments: 2,
      bevelEnabled: true, bevelSegments: 2, bevelSize: .12, bevelThickness: .1
    });
    geo.translate(0, 0, -depth / 2);
    return mesh(geo, mat, x, y, z);
  }

  function pointedArch(width, height, depth, mat, x, y, z, bevel = .08) {
    const spring = height * .48;
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0);
    s.lineTo(width / 2, 0);
    s.lineTo(width / 2, spring);
    s.bezierCurveTo(width / 2, height * .72, width * .2, height * .9, 0, height);
    s.bezierCurveTo(-width * .2, height * .9, -width / 2, height * .72, -width / 2, spring);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth, steps: 1, curveSegments: 7,
      bevelEnabled: bevel > 0, bevelSegments: 2, bevelSize: bevel, bevelThickness: bevel
    });
    geo.translate(0, 0, -depth / 2);
    return mesh(geo, mat, x, y, z);
  }

  function roofPrism(width, height, depth, mat, x, y, z) {
    const vertices = new Float32Array([
      -width/2,0,-depth/2, width/2,0,-depth/2, 0,height,-depth/2,
      -width/2,0, depth/2, width/2,0, depth/2, 0,height, depth/2
    ]);
    const indices = [0,1,2, 3,5,4, 0,3,4, 0,4,1, 1,4,5, 1,5,2, 2,5,3, 2,3,0];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setIndex(indices); geo.computeVertexNormals();
    return mesh(geo, mat, x, y, z);
  }

  function cylinderBetween(a, b, radius, mat, radial = 8, targetGroup = group) {
    const delta = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.05, delta.length(), radial, 1), mat);
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    m.castShadow = true; m.receiveShadow = true; targetGroup.add(m);
    return m;
  }

  // Softly bevelled podium and the main stepped masses.
  box(16.2, .7, 20.1, shadowStone, 0, .63, 0, .35);
  box(15.4, .52, 19.3, paleStone, 0, 1.02, 0, .28);
  box(13.4, 5.7, 16.6, stone, 0, 4.05, -.45, .34);
  box(15.1, 3.2, 12.2, sunStone, 0, 3.0, -.95, .42);
  gabledBlock(9.6, 7.3, 10.5, 16.4, paleStone, 0, 1.2, -.45);
  gabledBlock(14.5, 5.8, 9.4, 4.15, sunStone, 0, 1.25, 7.55);
  roofPrism(9.5, 3.15, 14.5, roofMat, 0, 11.65, -.75);
  roofPrism(4.9, 2.05, 8.8, roofDark, 0, 14.1, -1.35);

  // Rounded apse, side chapels, and rhythmical scallops around the base.
  mesh(new THREE.CylinderGeometry(6.2, 6.7, 6.5, 16, 1, false, PI, PI), stone, 0, 4.25, -7.55, 0, PI / 2, 0);
  for (const side of [-1, 1]) {
    box(2.65, 4.65, 12.8, side < 0 ? blushStone : sunStone, side * 6.2, 3.45, -.7, .5);
    roofPrism(3.25, 1.25, 12.6, side < 0 ? orange : turquoise, side * 6.2, 5.78, -.7);
  }
  for (let i = 0; i < 9; i++) {
    const a = PI + i * PI / 8;
    const x = Math.sin(a) * 6.72;
    const z = -7.3 + Math.cos(a) * 2.1;
    mesh(new THREE.CylinderGeometry(.58, .72, 3.65, 9), i % 2 ? paleStone : sunStone, x, 2.8, z);
    mesh(new THREE.SphereGeometry(.64, 10, 7, 0, TAU, 0, PI * .7), roofMat, x, 4.65, z);
  }

  // Organic exterior columns split into branches below the roof line.
  for (const side of [-1, 1]) {
    for (const z of [-5.7, -1.8, 2.1, 5.4]) {
      const base = new THREE.Vector3(side * 7.45, 1.2, z);
      const fork = new THREE.Vector3(side * 6.45, 7.2, z);
      cylinderBetween(base, fork, .28, paleStone, 9);
      cylinderBetween(fork, new THREE.Vector3(side * 4.95, 10.1, z - 1.25), .18, sunStone, 8);
      cylinderBetween(fork, new THREE.Vector3(side * 4.95, 10.1, z + 1.25), .18, sunStone, 8);
      mesh(new THREE.SphereGeometry(.37, 9, 6), gold, fork.x, fork.y, fork.z);
    }
  }

  // Catenary-like buttress arcs make the walls read as a stone grove.
  for (const side of [-1, 1]) {
    for (const z of [-4.9, -.9, 3.1]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side * 5.05, 9.9, z),
        new THREE.Vector3(side * 7.7, 9.1, z),
        new THREE.Vector3(side * 7.7, 4.45, z)
      );
      mesh(new THREE.TubeGeometry(curve, 10, .16, 6, false), stone);
    }
  }

  // Instanced decorative collections.
  const darkSlots = [];
  const towerRibs = [];
  const tinyGlass = [[], [], []];
  const beads = [];
  const leaves = [];
  const ornamentRotors = [];
  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  function queue(arr, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, color = null) {
    arr.push({ x, y, z, sx, sy, sz, rx, ry, rz, color });
  }
  function commitInstances(arr, geo, mat, name) {
    if (!arr.length) return null;
    const inst = new THREE.InstancedMesh(geo, mat, arr.length);
    inst.name = name;
    arr.forEach((a, i) => {
      dummy.position.set(a.x, a.y, a.z);
      dummy.rotation.set(a.rx, a.ry, a.rz);
      dummy.scale.set(a.sx, a.sy, a.sz);
      dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
      if (a.color) { c.set(a.color); inst.setColorAt(i, c); }
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.castShadow = mat === paleStone || mat === gold;
    inst.receiveShadow = true;
    group.add(inst);
    return inst;
  }

  const spires = [];
  function makeSpire({ x, z, base, height, radius, accent = turquoise, finial = 'fruit', lean = 0 }) {
    const spire = new THREE.Group();
    spire.position.set(x, base, z);
    spire.rotation.z = lean;
    const bodyHeight = height * .82;
    const points = [
      [radius * .86, 0], [radius, bodyHeight * .05], [radius * .94, bodyHeight * .23],
      [radius * .8, bodyHeight * .5], [radius * .58, bodyHeight * .72],
      [radius * .4, bodyHeight * .9], [radius * .18, bodyHeight]
    ].map(p => new THREE.Vector2(p[0], p[1]));
    const body = new THREE.Mesh(new THREE.LatheGeometry(points, 12), stone);
    body.castShadow = true; body.receiveShadow = true; spire.add(body);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(radius * .83, .12, 5, 12), accent);
    collar.rotation.x = PI / 2; collar.position.y = bodyHeight * .48; collar.castShadow = true; spire.add(collar);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(radius * .15, radius * .34, height * .11, 10), accent);
    crown.position.y = bodyHeight + height * .045; crown.castShadow = true; spire.add(crown);
    group.add(spire); spires.push(spire);

    const levels = Math.max(2, Math.floor(bodyHeight / 3.8));
    for (let l = 0; l < levels; l++) {
      const yy = base + 2 + l * (bodyHeight - 3.1) / Math.max(1, levels - 1);
      const localR = radius * (1 - .48 * (yy - base) / bodyHeight) + .025;
      for (let face = 0; face < 4; face++) {
        const a = face * PI / 2;
        queue(darkSlots, x + Math.sin(a) * localR, yy, z + Math.cos(a) * localR,
          .19, .58, .065, 0, a, 0);
      }
    }

    if (finial === 'fruit') {
      const rotor = new THREE.Group();
      rotor.position.set(x, base + height * .96, z);
      const fruitMat = [berry, orange, violet, blue][spires.length % 4];
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(radius * .3, 9, 7), fruitMat);
      fruit.scale.y = 1.32; fruit.castShadow = false; rotor.add(fruit);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(radius * .17, 7, 5), leafLight);
      leaf.scale.set(1.8, .35, .8); leaf.position.set(radius * .18, radius * .38, 0); leaf.rotation.z = .55;
      leaf.castShadow = false; rotor.add(leaf);
      group.add(rotor); ornamentRotors.push(rotor);
    }
    return spire;
  }

  // Four strongly readable facade bell towers in staggered pairs.
  const frontTowerSpecs = [
    { x: -6.1, z: 7.2, base: 1.3, height: 22.1, radius: 1.36, accent: glassCyan, lean: -.018 },
    { x: -2.25, z: 7.65, base: 1.35, height: 24.65, radius: 1.43, accent: roofMat, lean: -.012 },
    { x: 2.25, z: 7.65, base: 1.35, height: 25.8, radius: 1.43, accent: gold, lean: .012 },
    { x: 6.1, z: 7.2, base: 1.3, height: 23.15, radius: 1.36, accent: glassMagenta, lean: .018 }
  ];
  frontTowerSpecs.forEach(makeSpire);
  frontTowerSpecs.forEach(t => {
    for (let level = 0; level < 4; level++) {
      const yy = t.base + 2.65 + level * 2.55;
      const rel = (yy - t.base) / (t.height * .82);
      const r = t.radius * (1 - rel * .3);
      for (const offset of [-.48, 0, .48]) {
        queue(towerRibs, t.x + offset * r, yy, t.z + r * .91,
          .06, 1.92, .06);
      }
    }
  });

  // Evangelist and apse towers create the dense, unmistakable forest silhouette.
  [
    { x:-3.35,z:-1.75,base:8.3,height:18.15,radius:1.18,accent:glassCyan },
    { x: 3.35,z:-1.75,base:8.3,height:18.7,radius:1.18,accent:glassMagenta },
    { x:-3.15,z:-5.0,base:7.4,height:17.0,radius:1.08,accent:gold },
    { x: 3.15,z:-5.0,base:7.4,height:17.5,radius:1.08,accent:blue },
    { x:-5.25,z:-6.65,base:4.3,height:14.65,radius:.94,accent:orange },
    { x: 0,z:-8.35,base:4.2,height:16.45,radius:1.03,accent:glassCyan },
    { x: 5.25,z:-6.65,base:4.3,height:15.1,radius:.94,accent:berry },
    { x:-6.35,z:-3.75,base:5.5,height:13.15,radius:.88,accent:roofMat },
    { x: 6.35,z:-3.75,base:5.5,height:13.55,radius:.88,accent:gold }
  ].forEach(makeSpire);

  // The central lantern is tallest and capped by a glowing eight-point star and cross.
  makeSpire({ x:0, z:-3.15, base:10.3, height:21.75, radius:1.58, accent:turquoise, finial:'none' });
  const lanternBand = mesh(new THREE.TorusGeometry(1.18, .16, 6, 14), gold, 0, 25.35, -3.15, PI / 2);
  lanternBand.castShadow = false;
  const starShape = new THREE.Shape();
  for (let i = 0; i < 16; i++) {
    const a = PI / 2 + i * PI / 8;
    const r = i % 2 ? .3 : .92;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (!i) starShape.moveTo(x, y); else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth:.18, bevelEnabled:true, bevelSegments:2, bevelSize:.06, bevelThickness:.06 });
  starGeo.translate(0, 0, -.09);
  const starCore = mesh(starGeo.clone(), starCoreMaterial, 0, 32.75, -3.27);
  starCore.scale.set(1.14, 1.14, 1);
  starCore.castShadow = false;
  const star = mesh(starGeo, starMaterial, 0, 32.82, -3.15);
  star.castShadow = false;
  const starHalo = mesh(new THREE.TorusGeometry(1.02, .035, 5, 28), starMaterial, 0, 32.82, -3.23);
  starHalo.castShadow = false;
  mesh(new THREE.CylinderGeometry(.12, .3, 2.15, 8), gold, 0, 30.75, -3.15);
  box(.12, 1.7, .13, starMaterial, 0, 32.55, -3.29, .03).castShadow = false;
  box(.95, .12, .13, starMaterial, 0, 32.62, -3.29, .03).castShadow = false;

  // Main facade: three deep, layered portals and a leafy stone canopy.
  const portalData = [
    { x:-4.15,w:3.1,h:4.7 }, { x:0,w:4.7,h:6.35 }, { x:4.15,w:3.1,h:4.7 }
  ];
  portalData.forEach((p, idx) => {
    pointedArch(p.w + 1.3, p.h + 1.5, .58, paleStone, p.x, 1.2, 9.78);
    pointedArch(p.w + .65, p.h + .72, .52, idx === 1 ? blushStone : sunStone, p.x, 1.25, 10.02);
    pointedArch(p.w, p.h, .36, deep, p.x, 1.27, 10.25);
    for (let i = 0; i < 9; i++) {
      const a = .18 + i * (PI - .36) / 8;
      const rx = p.w * .58, ry = p.h * .53;
      queue(beads, p.x + Math.cos(a) * rx, 1.2 + p.h * .49 + Math.sin(a) * ry,
        10.41, .16, .16, .1);
    }
  });

  // Doors and warm pools of glass within the portals.
  for (const x of [-4.15, 4.15]) {
    pointedArch(1.1, 2.2, .09, glassAmber, x, 1.32, 10.46, .02).castShadow = false;
  }
  pointedArch(1.55, 3.05, .09, glassCyan, -.86, 1.32, 10.46, .02).castShadow = false;
  pointedArch(1.55, 3.05, .09, glassMagenta, .86, 1.32, 10.46, .02).castShadow = false;

  // Rose window with jewel-like radial panes and a strong stone frame.
  const roseY = 9.95, roseZ = 9.86;
  mesh(new THREE.CircleGeometry(2.38, 40), deep, 0, roseY, roseZ).castShadow = false;
  mesh(new THREE.TorusGeometry(2.55, .25, 8, 40), paleStone, 0, roseY, roseZ + .12);
  mesh(new THREE.TorusGeometry(1.04, .14, 7, 30), gold, 0, roseY, roseZ + .34);
  mesh(new THREE.CircleGeometry(.88, 24), glassAmber, 0, roseY, roseZ + .35).castShadow = false;
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12;
    const r = 1.64;
    queue(tinyGlass[i % 3], Math.sin(a) * r, roseY + Math.cos(a) * r, roseZ + .3,
      .58, .95, .12, 0, 0, -a);
    cylinderBetween(
      new THREE.Vector3(Math.sin(a) * .85, roseY + Math.cos(a) * .85, roseZ + .38),
      new THREE.Vector3(Math.sin(a) * 2.22, roseY + Math.cos(a) * 2.22, roseZ + .38),
      .055, gold, 5
    ).castShadow = false;
  }

  // Small glowing discs along the aisles and clerestory.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const z = -5.2 + i * 2.25;
      queue(tinyGlass[(i + (side > 0 ? 1 : 0)) % 3], side * 7.58, 4.1 + (i % 2) * .62, z,
        .34, .54, .12, 0, side * PI / 2, 0);
    }
  }
  for (let i = 0; i < 7; i++) {
    const x = -4.0 + i * 1.34;
    queue(tinyGlass[i % 3], x, 8.05 + (i % 2) * .48, 10.12, .32, .48, .1);
  }

  // Leaf clusters and mosaic beads make the facade feel handcrafted up close.
  for (let i = 0; i < 26; i++) {
    const x = -6.9 + (i % 13) * 1.15;
    const y = 5.65 + Math.sin(i * 1.7) * .5 + Math.floor(i / 13) * .72;
    queue(leaves, x, y, 10.34, .3 + (i % 3) * .06, .13, .12, 0, 0, (i % 2 ? -1 : 1) * .55,
      i % 3 === 0 ? '#a9c86d' : '#669f61');
  }
  for (let i = 0; i < 34; i++) {
    const a = i * .73;
    queue(beads, Math.sin(a) * (5.2 + (i % 3) * .55), 7.3 + Math.cos(a * .83) * 1.2,
      10.34, .1 + (i % 2) * .035, .1 + (i % 2) * .035, .075,
      0, 0, 0, ['#f3bd48','#58b9a9','#db668a','#6f82c9'][i % 4]);
  }

  // Bell tower mouth openings sit above the main facade and remain legible at distance.
  frontTowerSpecs.forEach((t, ti) => {
    const y = 9.1 + (ti % 2) * .7;
    pointedArch(1.02, 2.15, .08, deep, t.x, y, t.z + t.radius * .78, .02).castShadow = false;
    pointedArch(.55, 1.42, .06, glassAmber, t.x, y + .28, t.z + t.radius * .85, .01).castShadow = false;
  });

  const slotGeo = new THREE.SphereGeometry(1, 7, 7);
  const glassPetalGeo = new THREE.SphereGeometry(1, 8, 6);
  const beadGeo = new THREE.SphereGeometry(1, 7, 5);
  const leafGeo = new THREE.SphereGeometry(1, 7, 5);
  commitInstances(darkSlots, slotGeo, warmRecess, 'Warm bell tower perforations');
  commitInstances(towerRibs, new THREE.CylinderGeometry(1, 1, 1, 6), sunStone, 'Front bell tower ribs');
  commitInstances(tinyGlass[0], glassPetalGeo, glassCyan, 'Cyan stained glass');
  commitInstances(tinyGlass[1], glassPetalGeo, glassMagenta, 'Magenta stained glass');
  commitInstances(tinyGlass[2], glassPetalGeo, glassBlue, 'Blue stained glass');
  commitInstances(beads, beadGeo, gold, 'Facade mosaic beads');
  commitInstances(leaves, leafGeo, leafGreen, 'Carved leaf clusters');

  // Transparent raycast proxy: broad enough to select the whole landmark.
  const hitTarget = new THREE.Mesh(
    new THREE.BoxGeometry(16.5, 27.5, 20.5),
    new THREE.MeshBasicMaterial({ transparent:true, opacity:0, depthWrite:false, colorWrite:false })
  );
  hitTarget.name = 'Basilica hit target';
  hitTarget.position.set(0, 14, 0);
  group.add(hitTarget);

  // Count real renderable units after construction. Instanced meshes remain one draw call each.
  let drawCalls = 0;
  group.traverse(o => { if (o.isMesh && o !== hitTarget) drawCalls++; });
  const stats = {
    towers: spires.length,
    spires: spires.length,
    portals: 3,
    stainedGlassPanels: tinyGlass.reduce((n, a) => n + a.length, 0) + 7,
    drawCalls
  };

  function animate(t = 0) {
    const glint = .5 + .5 * Math.sin(t * 1.35);
    starMaterial.emissiveIntensity = 1.45 + glint * .75;
    star.rotation.z = Math.sin(t * .38) * .07;
    starCore.rotation.z = star.rotation.z;
    const haloPulse = 1 + Math.sin(t * 1.35 + .5) * .025;
    starHalo.scale.setScalar(haloPulse);
    ornamentRotors.forEach((o, i) => {
      o.rotation.y = Math.sin(t * .32 + i * .77) * .14;
      o.rotation.z = Math.sin(t * .5 + i * .63) * .025;
    });
    lanternBand.rotation.z = t * .055;
  }

  // Camera anchors used by the film chapters and the chapter buttons (world space, Y up).
  // facade: the rose window and three portals; crown: the tallest spires and the star.
  const views = {
    facade: { target: [0, 7.5, 10.1], from: [5.5, 13, 31], hold: [3.8, 12.8, 30.3] },
    crown: { target: [0, 24, -1.5], from: [11, 28, 28], hold: [7.5, 27, 27] },
  };

  return { group, hitTarget, animate, stats, lightingMaterials, views };
}
