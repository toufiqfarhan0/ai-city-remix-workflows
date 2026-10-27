// Humayun's Tomb, Nizamuddin East, Delhi (UNESCO World Heritage Site).
// Procedural Three.js geometry in storybook miniature style:
// - Elevated red sandstone podium with arched alcoves and grand stairway
// - Octagonal hasht-bihisht massing with monumental double-storeyed pishtaq arches
// - Deep recessed geometric jali lattice screens that glow with warm lantern light
// - White marble inlay banding, borders, and arabesque trims
// - Elevated high octagonal drum with white marble bulbous double-dome
// - Four surrounding octagonal chattris (pillared kiosks) with marble cupolas and bronze finials
// - Slender corner guldasta pinnacles with lotus finials
//
// Return shape: { group, hitTarget, animate(t), stats, lightingMaterials, views }
// Clearance: x -9..9, z -10..11, origin at (0, 0, 0).
export function buildLandmark(THREE) {
  const group = new THREE.Group();
  group.name = 'HumayunsTomb';

  const PI = Math.PI;
  const TAU = PI * 2;

  const cast = (m, receive = true) => {
    m.castShadow = true;
    m.receiveShadow = receive;
    group.add(m);
    return m;
  };

  const material = (color, roughness = 0.78, extras = {}) => new THREE.MeshStandardMaterial({
    color, roughness, metalness: 0, ...extras
  });

  // Architectural palettes: Delhi warm red sandstone and pristine ivory marble
  const redSandstone = material('#b85c3a', 0.82);
  const darkSandstone = material('#924227', 0.85);
  const paleSandstone = material('#cf7956', 0.80);
  const plinthStone = material('#8a3d24', 0.88);
  const recessedStone = material('#522216', 0.90, { emissive: '#42160b', emissiveIntensity: 0.1 });

  // Marble materials
  const marble = material('#f4efe6', 0.35, { roughness: 0.45, metalness: 0.05 });
  const marbleShade = material('#dcd4c5', 0.40);
  const bronze = material('#d49b42', 0.35, { metalness: 0.65, roughness: 0.35, emissive: '#8f5c15', emissiveIntensity: 0.15 });

  // Lighting & Jali materials (night glow)
  const jaliGlow = material('#f8c868', 0.3, {
    emissive: '#ff9a28',
    emissiveIntensity: 0.85
  });
  jaliGlow.userData = { glowScale: 1.3 };

  const lanternWarm = material('#ffe494', 0.2, {
    emissive: '#fca311',
    emissiveIntensity: 1.2
  });
  lanternWarm.userData = { glowScale: 1.5 };

  const alcoveGlow = material('#ffc078', 0.4, {
    emissive: '#e86a17',
    emissiveIntensity: 0.5
  });
  alcoveGlow.userData = { glowScale: 0.8 };

  const lightingMaterials = [jaliGlow, lanternWarm, alcoveGlow];

  function mesh(geometry, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    return cast(m);
  }

  function box(w, h, d, mat, x, y, z) {
    return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  }

  function cylinder(rTop, rBot, h, segs, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    return mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), mat, x, y, z, rx, ry, rz);
  }

  // Mughal pointed arch shape (four-centered / Persian pointed arch)
  function pointedArchShape(width, height) {
    const s = new THREE.Shape();
    const w = width / 2;
    const h = height;
    const spring = h * 0.5;
    s.moveTo(-w, 0);
    s.lineTo(-w, spring);
    s.quadraticCurveTo(-w * 0.9, spring + (h - spring) * 0.65, 0, h);
    s.quadraticCurveTo(w * 0.9, spring + (h - spring) * 0.65, w, spring);
    s.lineTo(w, 0);
    s.closePath();
    return s;
  }

  function pointedArch(w, h, depth, mat, x, y, z, ry = 0) {
    const s = pointedArchShape(w, h);
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -depth / 2);
    return mesh(geo, mat, x, y, z, 0, ry, 0);
  }

  // ── 1. Base Plinth & Terrace (Charbagh Podium) ───────────────────────────
  // Massive square sandstone plinth with chamfered corners
  const plinthW = 14.8;
  const plinthH = 2.4;
  const plinthD = 14.8;
  box(plinthW, plinthH, plinthD, plinthStone, 0, plinthH / 2, 0);

  // Plinth upper terrace molding & parapet
  box(plinthW + 0.3, 0.25, plinthD + 0.3, paleSandstone, 0, plinthH + 0.125, 0);
  const terraceY = plinthH + 0.25;

  // Arcaded niches along the podium faces
  const nicheW = 1.0;
  const nicheH = 1.5;
  const nicheCount = 6;
  const spacing = 1.9;
  for (let i = 0; i < nicheCount; i++) {
    const offset = (i - (nicheCount - 1) / 2) * spacing;
    // Front face niches (skip middle 2 for central stair)
    if (Math.abs(offset) > 1.2) {
      box(nicheW, nicheH, 0.2, recessedStone, offset, plinthH * 0.45, plinthD / 2 + 0.05);
      pointedArch(nicheW * 0.9, nicheH * 0.9, 0.15, darkSandstone, offset, plinthH * 0.45 - nicheH * 0.45, plinthD / 2 + 0.08);
      // Small alcove lantern glow
      box(0.18, 0.18, 0.1, alcoveGlow, offset, plinthH * 0.45, plinthD / 2 + 0.12);
    }
    // Back face niches
    box(nicheW, nicheH, 0.2, recessedStone, offset, plinthH * 0.45, -plinthD / 2 - 0.05);
    pointedArch(nicheW * 0.9, nicheH * 0.9, 0.15, darkSandstone, offset, plinthH * 0.45 - nicheH * 0.45, -plinthD / 2 - 0.08, PI);

    // Left face
    box(0.2, nicheH, nicheW, recessedStone, -plinthW / 2 - 0.05, plinthH * 0.45, offset);
    // Right face
    box(0.2, nicheH, nicheW, recessedStone, plinthW / 2 + 0.05, plinthH * 0.45, offset);
  }

  // Grand Front Stairway leading up to terrace
  const stairSteps = 8;
  for (let s = 0; s < stairSteps; s++) {
    const sw = 3.2 - s * 0.08;
    const sh = plinthH / stairSteps;
    const sd = 0.35;
    box(sw, sh, sd * (stairSteps - s), paleSandstone, 0, (s + 0.5) * sh, plinthD / 2 + sd * (stairSteps - s) / 2);
  }

  // ── 2. Main Tomb Building (Octagonal Hasht-Bihisht Plan) ─────────────────
  const bodyW = 9.2;
  const bodyH = 5.6;
  const bodyD = 9.2;
  const bodyCenterY = terraceY + bodyH / 2;

  // Main square block
  box(bodyW, bodyH, bodyD, redSandstone, 0, bodyCenterY, 0);

  // Chamfered corner blocks with arched double-niches
  const cornerDist = 4.4;
  const cornerAngles = [PI * 0.25, PI * 0.75, PI * 1.25, PI * 1.75];
  cornerAngles.forEach((ang) => {
    const cx = Math.cos(ang) * cornerDist;
    const cz = Math.sin(ang) * cornerDist;
    const cw = 2.4;
    mesh(new THREE.BoxGeometry(cw, bodyH, cw), paleSandstone, cx, bodyCenterY, cz, 0, ang, 0);

    // Two tiers of niches on chamfer faces
    pointedArch(0.9, 1.8, 0.2, recessedStone, cx * 1.08, terraceY + 1.2, cz * 1.08, ang);
    pointedArch(0.9, 1.8, 0.2, recessedStone, cx * 1.08, terraceY + 3.4, cz * 1.08, ang);
    // Small glowing jali windows inside chamfer niches
    box(0.35, 0.65, 0.1, jaliGlow, cx * 1.09, terraceY + 1.2 + 0.4, cz * 1.09);
    box(0.35, 0.65, 0.1, jaliGlow, cx * 1.09, terraceY + 3.4 + 0.4, cz * 1.09);
  });

  // Roof cornice & crenellated parapet
  box(bodyW + 0.4, 0.35, bodyD + 0.4, paleSandstone, 0, terraceY + bodyH + 0.175, 0);
  box(bodyW + 0.2, 0.3, bodyD + 0.2, marble, 0, terraceY + bodyH + 0.45, 0);

  // ── 3. Four Monumental Pishtaqs (Grand Arched Portals) ───────────────────
  function buildPishtaq(facingAngle) {
    const pGroup = new THREE.Group();
    const frameW = 5.2;
    const frameH = 7.4; // Soars higher than main roofline
    const frameD = 1.0;

    // Outer sandstone rectangular frame
    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.8, frameH, frameD), redSandstone);
    frameLeft.position.set(-frameW / 2 + 0.4, frameH / 2, 0);
    pGroup.add(frameLeft);

    const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.8, frameH, frameD), redSandstone);
    frameRight.position.set(frameW / 2 - 0.4, frameH / 2, 0);
    pGroup.add(frameRight);

    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(frameW, 1.4, frameD), redSandstone);
    frameTop.position.set(0, frameH - 0.7, 0);
    pGroup.add(frameTop);

    // Marble border inlay band around the pishtaq
    const marbleBorder = new THREE.Mesh(new THREE.BoxGeometry(frameW - 1.2, 0.15, frameD + 0.05), marble);
    marbleBorder.position.set(0, frameH - 1.45, 0);
    pGroup.add(marbleBorder);

    // Recessed arch cavity
    const archW = 3.6;
    const archH = 5.8;
    const archDepth = 1.6;
    const innerArch = pointedArch(archW, archH, archDepth, darkSandstone, 0, 0, -archDepth / 2 + 0.3);
    pGroup.add(innerArch);

    // Inner back wall of the iwan
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(archW, archH, 0.2), recessedStone);
    backWall.position.set(0, archH / 2, -archDepth + 0.2);
    pGroup.add(backWall);

    // Lower entrance doorway with marble surround
    const doorW = 1.3;
    const doorH = 2.2;
    const doorSurround = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.3, doorH + 0.2, 0.25), marble);
    doorSurround.position.set(0, doorH / 2, -archDepth + 0.3);
    pGroup.add(doorSurround);

    const doorArch = pointedArch(doorW, doorH, 0.3, plinthStone, 0, 0, -archDepth + 0.4);
    pGroup.add(doorArch);

    // Upper Grand Jali Screen (geometric lattice window glowing from within)
    const jaliW = 1.8;
    const jaliH = 2.4;
    const jaliY = 2.6;
    const jaliMesh = new THREE.Mesh(new THREE.BoxGeometry(jaliW, jaliH, 0.15), jaliGlow);
    jaliMesh.position.set(0, jaliY + jaliH / 2, -archDepth + 0.35);
    pGroup.add(jaliMesh);

    // Jali marble frame & stone geometric mullions
    const jaliArch = pointedArch(jaliW + 0.2, jaliH + 0.2, 0.2, marble, 0, jaliY, -archDepth + 0.4);
    pGroup.add(jaliArch);

    // Decorative rosette / medallion medallions above the arch
    const rosetteL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12), marble);
    rosetteL.rotation.x = PI / 2;
    rosetteL.position.set(-1.6, frameH - 1.0, 0.52);
    pGroup.add(rosetteL);

    const rosetteR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12), marble);
    rosetteR.rotation.x = PI / 2;
    rosetteR.position.set(1.6, frameH - 1.0, 0.52);
    pGroup.add(rosetteR);

    // Flanking slender pinnacles (guldasta) at pishtaq top corners
    [-frameW / 2 + 0.3, frameW / 2 - 0.3].forEach((px) => {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 8), paleSandstone);
      pin.position.set(px, frameH + 0.7, 0);
      pGroup.add(pin);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 8), bronze);
      fin.position.set(px, frameH + 1.5, 0);
      pGroup.add(fin);
    });

    pGroup.position.set(
      Math.sin(facingAngle) * (bodyD / 2 + 0.2),
      terraceY,
      Math.cos(facingAngle) * (bodyD / 2 + 0.2)
    );
    pGroup.rotation.y = facingAngle;
    group.add(pGroup);
  }

  // Build pishtaqs on all 4 faces
  buildPishtaq(0);          // Front (+Z)
  buildPishtaq(PI);        // Back (-Z)
  buildPishtaq(PI * 0.5);   // Right (+X)
  buildPishtaq(PI * 1.5);   // Left (-X)

  // ── 4. The Marble Crown: Elevated Drum & Double-Dome ────────────────────
  const roofY = terraceY + bodyH + 0.6;

  // High Octagonal Sandstone & Marble Drum
  const drumR = 2.8;
  const drumH = 2.4;
  const drumY = roofY + drumH / 2;
  const drum = cylinder(drumR, drumR * 1.04, drumH, 8, paleSandstone, 0, drumY, 0, 0, PI / 8);

  // Decorative marble vertical paneling around drum
  for (let a = 0; a < 8; a++) {
    const ang = (a * PI) / 4;
    const px = Math.cos(ang) * (drumR + 0.05);
    const pz = Math.sin(ang) * (drumR + 0.05);
    box(0.5, drumH * 0.8, 0.1, marble, px, drumY, pz);
    // Subtle arched panel recess
    box(0.3, drumH * 0.6, 0.15, darkSandstone, px, drumY, pz);
  }

  // Marble ring / cornice at top of drum
  cylinder(drumR + 0.2, drumR, 0.3, 16, marble, 0, roofY + drumH + 0.15, 0);

  // Grand Bulbous White Marble Double-Dome
  // Constructed with layered rings and a lathe-like profile
  const domeBaseY = roofY + drumH + 0.3;
  const domeRadius = 2.75;
  const domeHeight = 3.6;

  // Swelling bulbous dome body (Mughal onion / lotus profile)
  const domePoints = [];
  const segments = 16;
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    // Mughal bulbous curve: starts at radius 2.6, expands to 2.85 at 35% height, then curves inward to point
    let r;
    if (u < 0.35) {
      r = 2.6 + Math.sin((u / 0.35) * (PI / 2)) * 0.25;
    } else {
      const v = (u - 0.35) / 0.65;
      r = 2.85 * Math.cos(v * (PI / 2) * 0.95);
    }
    const dy = u * domeHeight;
    domePoints.push(new THREE.Vector2(Math.max(0.05, r), dy));
  }
  const domeGeo = new THREE.LatheGeometry(domePoints, 32);
  const domeMesh = new THREE.Mesh(domeGeo, marble);
  domeMesh.position.set(0, domeBaseY, 0);
  cast(domeMesh);

  // Inverted lotus leaf cresting at top of dome
  const lotusBaseY = domeBaseY + domeHeight;
  cylinder(0.55, 0.3, 0.25, 12, marbleShade, 0, lotusBaseY + 0.12, 0);
  cylinder(0.7, 0.55, 0.18, 16, marble, 0, lotusBaseY + 0.28, 0);

  // Grand Bronze Lotus Finial (Kalasa) atop the dome
  const finialBaseY = lotusBaseY + 0.37;
  cylinder(0.08, 0.15, 0.5, 8, bronze, 0, finialBaseY + 0.25, 0);
  mesh(new THREE.SphereGeometry(0.25, 12, 12), bronze, 0, finialBaseY + 0.65, 0);
  cylinder(0.06, 0.1, 0.45, 8, bronze, 0, finialBaseY + 1.0, 0);
  mesh(new THREE.SphereGeometry(0.18, 10, 10), bronze, 0, finialBaseY + 1.3, 0);
  // Sharp bronze pinnacle tip
  mesh(new THREE.ConeGeometry(0.08, 0.7, 8), bronze, 0, finialBaseY + 1.75, 0);

  // ── 5. Four Surrounding Octagonal Chattris (Pillared Kiosks) ────────────
  const chattriRadius = 3.35;
  const chattriAngles = [PI * 0.25, PI * 0.75, PI * 1.25, PI * 1.75];
  chattriAngles.forEach((ang) => {
    const chX = Math.cos(ang) * chattriRadius;
    const chZ = Math.sin(ang) * chattriRadius;

    // Chattri base plinth
    box(1.7, 0.3, 1.7, paleSandstone, chX, roofY + 0.15, chZ);

    // 8 slender columns
    const colH = 1.6;
    const colR = 0.55;
    for (let c = 0; c < 8; c++) {
      const cAng = (c * PI) / 4;
      const px = chX + Math.cos(cAng) * colR;
      const pz = chZ + Math.sin(cAng) * colR;
      cylinder(0.06, 0.08, colH, 6, marble, px, roofY + 0.3 + colH / 2, pz);
    }

    // Interior glowing lantern inside the chattri
    const lamp = mesh(new THREE.SphereGeometry(0.18, 8, 8), lanternWarm, chX, roofY + 0.3 + colH * 0.6, chZ);
    lamp.userData = { glowScale: 1.5 };

    // Overhanging Chhajja (projecting eaves)
    const chhajjaY = roofY + 0.3 + colH;
    cylinder(1.05, 0.75, 0.2, 8, redSandstone, chX, chhajjaY + 0.1, chZ, 0, PI / 8);

    // White marble cupola / dome
    const cupolaH = 1.1;
    const cupolaY = chhajjaY + 0.2;
    const cupola = mesh(new THREE.SphereGeometry(0.72, 16, 12, 0, TAU, 0, PI * 0.65), marble, chX, cupolaY + 0.35, chZ);
    cupola.scale.set(1, 1.35, 1);

    // Bronze Chattri Finial
    cylinder(0.05, 0.08, 0.35, 6, bronze, chX, cupolaY + cupolaH + 0.15, chZ);
    mesh(new THREE.ConeGeometry(0.08, 0.35, 6), bronze, chX, cupolaY + cupolaH + 0.45, chZ);
  });

  // ── 6. Corner Minarets / Guldastas (Outer Pinnacles) ─────────────────────
  const pinAngles = [PI * 0.25, PI * 0.75, PI * 1.25, PI * 1.75];
  const pinDist = 5.25;
  pinAngles.forEach((ang) => {
    const px = Math.cos(ang) * pinDist;
    const pz = Math.sin(ang) * pinDist;
    const pinH = 2.0;
    cylinder(0.18, 0.24, pinH, 8, paleSandstone, px, roofY + pinH / 2, pz);
    // Marble pinnacle canopy
    cylinder(0.28, 0.2, 0.35, 8, marble, px, roofY + pinH + 0.18, pz);
    // Bronze finial
    mesh(new THREE.ConeGeometry(0.12, 0.5, 8), bronze, px, roofY + pinH + 0.55, pz);
  });

  // ── 7. Hit Target (for click-to-open card) ────────────────────────────────
  // Sized to cover the full monument silhouette comfortably
  const hitTarget = new THREE.Mesh(
    new THREE.BoxGeometry(15.2, 21.0, 15.2),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
  );
  hitTarget.position.set(0, 10.5, 0);
  hitTarget.name = 'LandmarkHitTarget';
  group.add(hitTarget);

  // ── 8. Animation & Camera Anchors ────────────────────────────────────────
  // Small motion: subtle flickering of jali lantern emissive intensities and paper kite
  function animate(t) {
    const pulse = 0.95 + Math.sin(t * 2.5) * 0.08 + Math.sin(t * 5.1) * 0.03;
    lanternWarm.emissiveIntensity = 1.2 * pulse;
    jaliGlow.emissiveIntensity = 0.85 * pulse;
  }

  // Camera views for chapters 02 and 03:
  // facade: frame the monumental pishtaq entrance and detailed jali lattice
  // crown: frame the twin white marble double-domes, chattris and bronze finials
  const views = {
    facade: {
      target: [0, 6.2, 3.5],
      from: [0, 6.2, 17.5],
      hold: [0, 6.2, 14.8],
    },
    crown: {
      target: [0, 14.8, 0],
      from: [0, 13.5, 15.5],
      hold: [0, 14.5, 13.0],
    },
  };

  const stats = {
    spires: 9, // 1 central dome finial + 4 chattri cupolas + 4 corner pinnacles
    domes: 5,
    chattris: 4,
    alcoves: 24,
  };

  return {
    group,
    hitTarget,
    animate,
    stats,
    lightingMaterials,
    views,
  };
}
