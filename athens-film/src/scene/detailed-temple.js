export function createDetailedTemple(THREE) {
  const group = new THREE.Group();
  group.name = "TempleOfHeaven_HallOfPrayerForGoodHarvests";

  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const TAU = Math.PI * 2;

  let randomState = 0x6d2b79f5;
  function random() {
    randomState |= 0;
    randomState = (randomState + 0x6d2b79f5) | 0;
    let t = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function randomBetween(a, b) {
    return a + (b - a) * random();
  }

  function addMesh(geometry, material, name) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function addInstanced(geometry, material, count, name) {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(0, count));
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    group.add(mesh);
    return mesh;
  }

  function finishInstances(mesh) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (mesh.computeBoundingSphere) mesh.computeBoundingSphere();
  }

  function setMatrixAt(mesh, index, position, quaternion, scale) {
    const matrix = new THREE.Matrix4();
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  }

  function makeCanvasTexture(canvas, colorTexture = true) {
    const texture = new THREE.CanvasTexture(canvas);
    if (colorTexture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }

  function makeLacquerTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    const image = context.createImageData(canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4;
        const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const noise = hash - Math.floor(hash);
        const broad = Math.sin(x * 0.19 + Math.sin(y * 0.023) * 1.7) * 5.0;
        const fine = Math.sin(x * 1.71 + y * 0.014) * 2.0;
        const verticalAge = Math.sin(x * 0.043 + 2.1) * 4.0;
        const value = Math.max(190, Math.min(252, 226 + noise * 13 + broad + fine + verticalAge));
        image.data[index] = value;
        image.data[index + 1] = value;
        image.data[index + 2] = value;
        image.data[index + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);

    context.globalAlpha = 0.13;
    context.strokeStyle = "#4b261e";
    context.lineWidth = 1;
    for (let i = 0; i < 58; i++) {
      const x = Math.floor(random() * canvas.width);
      context.beginPath();
      context.moveTo(x + randomBetween(-2, 2), 0);
      context.bezierCurveTo(
        x + randomBetween(-4, 4), canvas.height * 0.35,
        x + randomBetween(-5, 5), canvas.height * 0.68,
        x + randomBetween(-3, 3), canvas.height
      );
      context.stroke();
    }
    context.globalAlpha = 1;

    const texture = makeCanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 1.5);
    return texture;
  }

  function drawGreekKeyBand(context, x, y, width, height, vertical) {
    context.save();
    context.translate(x, y);
    if (vertical) { context.translate(width, 0); context.rotate(Math.PI / 2); [width, height] = [height, width]; }
    context.strokeStyle = "#c6d4bc";
    context.lineWidth = 3.2;
    context.lineJoin = "miter";
    const count = Math.max(3, Math.floor(width / 62));
    const step = width / count;
    context.beginPath();
    for (let i = 0; i < count; i++) {
      const left = i * step + 4;
      context.moveTo(left, height * .80);
      context.lineTo(left, height * .20);
      context.lineTo(left + step * .78, height * .20);
      context.lineTo(left + step * .78, height * .64);
      context.lineTo(left + step * .31, height * .64);
      context.lineTo(left + step * .31, height * .41);
      context.lineTo(left + step * .56, height * .41);
    }
    context.stroke();
    context.strokeStyle = "#a99658";
    context.lineWidth = 1.7;
    context.strokeRect(0, 1, width, height - 2);
    context.restore();
  }

  function drawFloralRoundel(context, cx, cy, radius, variant) {
    // Small line-drawn lotus, never a solid gold sun or a European rosette.
    context.save();
    context.translate(cx, cy);
    context.strokeStyle = "#d5ddc6";
    context.lineWidth = 2.7;
    context.fillStyle = variant % 2 ? "#5b9997" : "#598b9b";
    for (let layer = 0; layer < 2; layer++) {
      const petals = layer ? 8 : 6;
      for (let i = 0; i < petals; i++) {
        context.save();
        context.rotate(i / petals * TAU + layer * .39);
        const r = radius * (layer ? .63 : 1);
        context.beginPath();
        context.moveTo(0, r * .09);
        context.bezierCurveTo(-r * .36, -r * .16, -r * .25, -r * .64, 0, -r);
        context.bezierCurveTo(r * .25, -r * .64, r * .36, -r * .16, 0, r * .09);
        context.fill(); context.stroke();
        context.lineWidth = 1.2;
        context.beginPath(); context.moveTo(0, -r * .18); context.lineTo(0, -r * .78); context.stroke();
        context.restore();
      }
    }
    context.strokeStyle = "#b49d62";
    context.lineWidth = 2;
    context.beginPath(); context.arc(0, 0, radius * .15, 0, TAU); context.stroke();
    context.restore();
  }

  function drawCloudScroll(context, cx, cy, width, height, flip) {
    context.save(); context.translate(cx, cy); context.scale(flip ? -1 : 1, 1);
    context.lineCap = "round"; context.lineJoin = "round";
    const count = 5;
    for (let i = 0; i < count; i++) {
      const x = -width * .45 + width * .225 * i;
      context.save(); context.translate(x, Math.sin(i * 1.7) * height * .12);
      context.strokeStyle = "#d1dbc0"; context.lineWidth = 3.1;
      context.beginPath();
      context.moveTo(-width * .105, height * .12);
      context.bezierCurveTo(-width * .08, -height * .10, -width * .055, -height * .34, -width * .018, -height * .18);
      context.bezierCurveTo(width * .012, -height * .51, width * .082, -height * .39, width * .064, -height * .10);
      context.bezierCurveTo(width * .14, -height * .18, width * .13, height * .23, width * .068, height * .19);
      context.bezierCurveTo(width * .023, height * .13, width * .035, height * .36, -width * .068, height * .27);
      context.stroke();
      context.lineWidth = 1.5; context.strokeStyle = "#7aaea4";
      context.beginPath();
      context.moveTo(-width * .074, height * .12);
      context.bezierCurveTo(-width * .025, -height * .01, -width * .035, -height * .18, width * .003, -height * .12);
      context.bezierCurveTo(width * .04, -height * .33, width * .07, -height * .10, width * .038, height * .02);
      context.bezierCurveTo(width * .12, -height * .02, width * .08, height * .13, width * .005, height * .10);
      context.stroke(); context.restore();
    }
    context.restore();
  }

  function drawPairedDragonScroll(context, cx, cy, width, height, flip, variant) {
    context.save(); context.translate(cx, cy); context.scale(flip ? -1 : 1, 1);
    context.lineJoin = "round"; context.lineCap = "round";
    const body = () => {
      context.beginPath(); context.moveTo(-width * .25, height * .44);
      context.bezierCurveTo(width * .48, height * .26, -width * .49, height * .14, -width * .12, -height * .04);
      context.bezierCurveTo(width * .47, -height * .24, -width * .48, -height * .43, width * .10, -height * .38);
    };
    context.strokeStyle = "#1c5d69"; context.lineWidth = 25; body(); context.stroke();
    context.strokeStyle = variant % 2 ? "#b4cdb3" : "#a8c6bc"; context.lineWidth = 16; body(); context.stroke();
    context.strokeStyle = "#336f78"; context.lineWidth = 7; body(); context.stroke();
    // Tiny overlapping scales on the serpentine neck and coiled body.
    context.strokeStyle = "#d8dfc0"; context.lineWidth = 1.8;
    for (let i = 0; i < 28; i++) {
      const t = i / 27;
      const x = Math.sin(t * Math.PI * 3.3 + .55) * width * .17;
      const y = height * (.36 - t * .66);
      context.beginPath(); context.arc(x, y, width * .028, -.15, Math.PI * .95); context.stroke();
      if (i % 2 === 0) {
        context.beginPath(); context.moveTo(x - width * .052, y - 5); context.lineTo(x - width * .085, y - 12); context.lineTo(x - width * .078, y + 5); context.stroke();
      }
    }
    const hx = width * .10, hy = -height * .38;
    context.fillStyle = "#bbd3bd"; context.strokeStyle = "#1b6170"; context.lineWidth = 3;
    context.beginPath(); context.moveTo(hx - 18, hy + 12);
    context.quadraticCurveTo(hx - 35, hy - 12, hx - 3, hy - 20);
    context.lineTo(hx + 22, hy - 12); context.lineTo(hx + 56, hy + 1);
    context.lineTo(hx + 53, hy + 12); context.lineTo(hx + 15, hy + 14);
    context.quadraticCurveTo(hx + 1, hy + 34, hx - 18, hy + 12); context.fill(); context.stroke();
    context.strokeStyle = "#d9debc"; context.lineWidth = 3;
    context.beginPath(); context.moveTo(hx - 14, hy - 13); context.lineTo(hx - 29, hy - 39); context.lineTo(hx - 25, hy - 51);
    context.moveTo(hx - 25, hy - 33); context.lineTo(hx - 43, hy - 36);
    context.moveTo(hx + 4, hy - 19); context.lineTo(hx + 10, hy - 47); context.lineTo(hx + 23, hy - 54);
    context.moveTo(hx + 11, hy - 42); context.lineTo(hx + 4, hy - 56); context.stroke();
    context.fillStyle = "#0b3a55"; context.beginPath(); context.arc(hx + 13, hy - 4, 4, 0, TAU); context.fill();
    context.strokeStyle = "#a68e4c"; context.lineWidth = 2;
    context.beginPath(); context.moveTo(hx + 41, hy + 10);
    context.bezierCurveTo(hx + 92, hy + 18, hx + 80, hy + 48, hx + 54, hy + 35);
    context.moveTo(hx + 34, hy + 8); context.bezierCurveTo(hx + 71, hy - 22, hx + 93, hy - 21, hx + 87, hy - 43); context.stroke();
    // Four bent legs with independently drawn three-prong claws.
    context.strokeStyle = "#d0d9bb"; context.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1, y = height * (.24 - i * .155);
      const x = side * width * .12, elbow = side * width * .31, claw = side * width * .39;
      context.beginPath(); context.moveTo(x, y); context.lineTo(elbow, y - 19); context.lineTo(claw, y + 4); context.stroke();
      context.lineWidth = 2;
      for (let j = -1; j <= 1; j++) {
        context.beginPath(); context.moveTo(claw, y + 4); context.lineTo(claw + side * (15 + j * 3), y + j * 12); context.lineTo(claw + side * (20 + j * 3), y + j * 12 - 5); context.stroke();
      }
      context.lineWidth = 4;
    }
    context.restore();
  }

  function makeOrnamentAtlas() {
    const size = 4096;
    const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
    const context = canvas.getContext("2d");
    const cell = size / 4;
    context.fillStyle = "#194a66"; context.fillRect(0, 0, size, size);
    for (let index = 0; index < 16; index++) {
      context.save(); context.translate(index % 4 * cell, Math.floor(index / 4) * cell);
      context.fillStyle = index % 3 === 0 ? "#265d75" : "#286f75"; context.fillRect(0, 0, cell, cell);
      // Concentric painted joinery bands: cream, cobalt, teal and hairline gold.
      for (const [inset, color, thickness] of [[18,"#bbcfbd",12],[35,"#19405e",11],[51,"#b09d62",3],[61,"#79aa9e",14],[85,"#193e61",20],[112,"#cfdbc0",5],[125,"#285e70",12]]) {
        context.strokeStyle = color; context.lineWidth = thickness; context.strokeRect(inset,inset,cell-2*inset,cell-2*inset);
      }
      drawGreekKeyBand(context, 71, 72, 882, 48, false);
      drawGreekKeyBand(context, 71, 904, 882, 48, false);
      drawGreekKeyBand(context, 72, 133, 48, 758, true);
      drawGreekKeyBand(context, 904, 133, 48, 758, true);
      // Three framed registers replace the former single giant circular flower.
      const fields = [[145,145,734,150],[145,315,734,392],[145,727,734,150]];
      for (let k = 0; k < fields.length; k++) {
        const [x,y,w,h] = fields[k];
        context.fillStyle = k === 1 ? (index % 2 ? "#91b8ad" : "#9fbdb5") : "#164c6b";
        context.fillRect(x,y,w,h);
        context.strokeStyle = "#d3d9bc"; context.lineWidth = 5; context.strokeRect(x+4,y+4,w-8,h-8);
        context.strokeStyle = "#b59c59"; context.lineWidth = 1.7; context.strokeRect(x+15,y+15,w-30,h-30);
        context.strokeStyle = k === 1 ? "rgba(32,91,103,.20)" : "rgba(128,180,168,.20)"; context.lineWidth = 1.4;
        for (let xx=x+28;xx<x+w-18;xx+=28) {
          for (let yy=y+27;yy<y+h-14;yy+=25) { context.beginPath(); context.arc(xx,yy,19,.1,Math.PI-.1);context.stroke(); }
        }
      }
      drawCloudScroll(context, 512, 214, 605, 95, index % 2);
      drawCloudScroll(context, 512, 799, 605, 95, !(index % 2));
      // Pale, closely drawn cloud dragons in a Qing blue-green rectangular cartouche.
      context.save(); context.beginPath(); context.rect(165,332,694,356); context.clip();
      drawPairedDragonScroll(context, 355, 518, 270, 286, false, index);
      drawPairedDragonScroll(context, 669, 518, 270, 286, true, index+1);
      context.strokeStyle = "#316e7b"; context.lineWidth = 3;
      context.beginPath(); context.arc(512,505,30,0,TAU); context.stroke();
      context.strokeStyle = "#dce1c5"; context.lineWidth = 2; context.beginPath(); context.arc(512,505,21,0,TAU); context.stroke();
      for (let i=0;i<7;i++) {
        const x=200+i*102;
        drawCloudScroll(context,x,365+(i%2)*12,85,36,i%2);
        drawCloudScroll(context,x,660-(i%2)*12,85,36,!(i%2));
      }
      context.restore();
      // Miniature lotus medallions and ruyi corner brackets, each small enough to read as ornament.
      for (const x of [205,819]) for (const y of [217,801]) drawFloralRoundel(context,x,y,39,index);
      for (const x of [163,861]) for (const y of [333,689]) {
        context.save(); context.translate(x,y);context.scale(x>512?-1:1,y>512?-1:1);
        context.strokeStyle="#d1d9bc";context.lineWidth=4;context.beginPath();context.moveTo(0,76);context.lineTo(0,0);context.lineTo(95,0);context.moveTo(15,63);context.lineTo(15,17);context.lineTo(78,17);context.stroke();
        context.strokeStyle="#ae995d";context.lineWidth=2;context.beginPath();context.moveTo(25,52);context.quadraticCurveTo(26,26,55,29);context.quadraticCurveTo(73,27,64,46);context.quadraticCurveTo(51,55,45,43);context.stroke();context.restore();
      }
      // Fine vertical bead-and-leaf side borders instead of broad metallic framing.
      for (const x of [133,891]) for (let y=169;y<866;y+=29) {
        context.fillStyle="#cfdbc1";context.beginPath();context.ellipse(x,y,3,5,0,0,TAU);context.fill();
        context.strokeStyle="#609890";context.lineWidth=2;context.beginPath();context.moveTo(x,y+7);context.quadraticCurveTo(x+9,y+14,x,y+20);context.stroke();
      }
      context.restore();
    }
    const texture = makeCanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
  }

  const ornamentAtlas = makeOrnamentAtlas();
  const lacquerTexture = makeLacquerTexture();

  const materials = {
    roofShell: new THREE.MeshStandardMaterial({
      color: 0x101d36,
      roughness: 0.43,
      metalness: 0.16,
      flatShading: false
    }),
    roofUnder: new THREE.MeshStandardMaterial({
      color: 0x162d35,
      roughness: 0.62,
      metalness: 0.08,
      flatShading: false
    }),
    roofFascia: new THREE.MeshStandardMaterial({
      color: 0x153f48,
      roughness: 0.47,
      metalness: 0.12,
      flatShading: false
    }),
    tile: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.36,
      metalness: 0.17,
      flatShading: false
    }),
    capTile: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.31,
      metalness: 0.19,
      flatShading: false
    }),
    teal: new THREE.MeshStandardMaterial({
      color: 0x1f615b,
      roughness: 0.47,
      metalness: 0.09,
      flatShading: false
    }),
    jade: new THREE.MeshStandardMaterial({
      color: 0x398b77,
      roughness: 0.42,
      metalness: 0.10,
      flatShading: false
    }),
    blue: new THREE.MeshStandardMaterial({
      color: 0x244d68,
      roughness: 0.45,
      metalness: 0.08,
      flatShading: false
    }),
    navy: new THREE.MeshStandardMaterial({
      color: 0x102b45,
      roughness: 0.51,
      metalness: 0.07,
      flatShading: false
    }),
    darkWood: new THREE.MeshStandardMaterial({
      color: 0x172c31,
      roughness: 0.63,
      metalness: 0.04,
      flatShading: false
    }),
    ivory: new THREE.MeshStandardMaterial({
      color: 0xcfccb0,
      roughness: 0.54,
      metalness: 0.04,
      flatShading: false
    }),
    oldGold: new THREE.MeshStandardMaterial({
      color: 0xad8741,
      roughness: 0.39,
      metalness: 0.64,
      flatShading: false
    }),
    darkGold: new THREE.MeshStandardMaterial({
      color: 0x7d6331,
      roughness: 0.52,
      metalness: 0.49,
      flatShading: false
    }),
    red: new THREE.MeshStandardMaterial({
      color: 0x84261e,
      map: lacquerTexture,
      roughness: 0.39,
      metalness: 0.07,
      flatShading: false
    }),
    darkRed: new THREE.MeshStandardMaterial({
      color: 0x5c1918,
      map: lacquerTexture,
      roughness: 0.48,
      metalness: 0.04,
      flatShading: false
    }),
    raisedRed: new THREE.MeshStandardMaterial({
      color: 0x79231d,
      map: lacquerTexture,
      roughness: 0.41,
      metalness: 0.06,
      flatShading: false
    }),
    painted: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: ornamentAtlas,
      roughness: 0.58,
      metalness: 0.08,
      flatShading: false
    }),
    plaque: new THREE.MeshStandardMaterial({
      color: 0x102747,
      roughness: 0.46,
      metalness: 0.09,
      flatShading: false
    }),
    recess: new THREE.MeshStandardMaterial({
      color: 0x101f29,
      roughness: 0.73,
      metalness: 0.02,
      flatShading: false
    }),
    coffer: new THREE.MeshStandardMaterial({
      color: 0x183945,
      roughness: 0.58,
      metalness: 0.06,
      side: THREE.DoubleSide,
      flatShading: false
    })
  };

  function makePaneledCylinderGeometry(radius, bottom, height, panelCount, cellIndices, segmentsPerPanel = 12) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let panel = 0; panel < panelCount; panel++) {
      const cellId = cellIndices[panel % cellIndices.length];
      const atlasColumn = cellId % 4;
      const atlasRow = Math.floor(cellId / 4);
      const baseVertex = positions.length / 3;

      for (let segment = 0; segment <= segmentsPerPanel; segment++) {
        const local = segment / segmentsPerPanel;
        const theta = ((panel + local) / panelCount) * TAU;
        const sin = Math.sin(theta);
        const cos = Math.cos(theta);

        for (let level = 0; level < 2; level++) {
          positions.push(radius * sin, bottom + height * level, radius * cos);
          normals.push(sin, 0, cos);
          uvs.push(
            (atlasColumn + local) / 4,
            (atlasRow + level) / 4
          );
        }
      }

      for (let segment = 0; segment < segmentsPerPanel; segment++) {
        const bottomCurrent = baseVertex + segment * 2;
        const topCurrent = bottomCurrent + 1;
        const bottomNext = bottomCurrent + 2;
        const topNext = bottomCurrent + 3;
        indices.push(bottomCurrent, bottomNext, topNext);
        indices.push(bottomCurrent, topNext, topCurrent);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  function buildPaintedDrum(configuration) {
    const {
      name,
      radius,
      bottom,
      height,
      panelCount,
      cells
    } = configuration;

    const geometry = makePaneledCylinderGeometry(radius, bottom, height, panelCount, cells);
    addMesh(geometry, materials.painted, name + "_PaintedAtlas");

    const darkBandGeometry = new THREE.CylinderGeometry(radius + 0.035, radius + 0.035, 0.16, 160, 1, true);
    addMesh(darkBandGeometry, materials.navy, name + "_LowerCornice").position.set(0, bottom + 0.03, 0);
    addMesh(
      new THREE.CylinderGeometry(radius + 0.035, radius + 0.035, 0.16, 160, 1, true),
      materials.navy,
      name + "_UpperCornice"
    ).position.set(0, bottom + height - 0.03, 0);

    const lowerTrim = addMesh(
      new THREE.TorusGeometry(radius + 0.025, 0.038, 8, 192),
      materials.oldGold,
      name + "_LowerGiltBead"
    );
    lowerTrim.rotation.x = Math.PI * 0.5;
    lowerTrim.position.y = bottom + 0.13;

    const upperTrim = addMesh(
      new THREE.TorusGeometry(radius + 0.025, 0.038, 8, 192),
      materials.oldGold,
      name + "_UpperGiltBead"
    );
    upperTrim.rotation.x = Math.PI * 0.5;
    upperTrim.position.y = bottom + height - 0.13;

    const separatorGeometry = new THREE.BoxGeometry(0.095, Math.max(0.35, height - 0.34), 0.065);
    const separatorMesh = addInstanced(separatorGeometry, materials.teal, panelCount, name + "_TurquoiseSeparators");

    const giltSeparatorGeometry = new THREE.BoxGeometry(0.026, Math.max(0.25, height - 0.42), 0.04);
    const giltSeparatorMesh = addInstanced(giltSeparatorGeometry, materials.oldGold, panelCount, name + "_GiltSeparatorLines");

    const bossGeometry = new THREE.SphereGeometry(0.029, 12, 8);
    const bossMesh = addInstanced(bossGeometry, materials.oldGold, panelCount * 3, name + "_RoundelBosses");

    const identity = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    for (let panel = 0; panel < panelCount; panel++) {
      const boundary = (panel / panelCount) * TAU;
      const radial = new THREE.Vector3(Math.sin(boundary), 0, Math.cos(boundary));
      const tangent = new THREE.Vector3(Math.cos(boundary), 0, -Math.sin(boundary));
      const rotation = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, boundary);

      setMatrixAt(
        separatorMesh,
        panel,
        radial.clone().multiplyScalar(radius + 0.055).setY(bottom + height * 0.5),
        rotation,
        scale
      );

      setMatrixAt(
        giltSeparatorMesh,
        panel,
        radial.clone().multiplyScalar(radius + 0.092).addScaledVector(tangent, 0.062).setY(bottom + height * 0.5),
        rotation,
        scale
      );

      const centerAngle = ((panel + 0.5) / panelCount) * TAU;
      const centerRadial = new THREE.Vector3(Math.sin(centerAngle), 0, Math.cos(centerAngle));
      for (let row = 0; row < 3; row++) {
        const y = bottom + height * (0.22 + row * 0.28);
        setMatrixAt(
          bossMesh,
          panel * 3 + row,
          centerRadial.clone().multiplyScalar(radius + 0.075).setY(y),
          identity,
          new THREE.Vector3(1, 1, 0.65)
        );
      }
    }

    finishInstances(separatorMesh);
    finishInstances(giltSeparatorMesh);
    finishInstances(bossMesh);

    return panelCount;
  }

  function makeProfile(points) {
    const radii = points.map(point => point[0]);
    const heights = points.map(point => point[1]);
    const slopes = [];

    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        slopes.push((heights[1] - heights[0]) / (radii[1] - radii[0]));
      } else if (i === points.length - 1) {
        slopes.push((heights[i] - heights[i - 1]) / (radii[i] - radii[i - 1]));
      } else {
        slopes.push((heights[i + 1] - heights[i - 1]) / (radii[i + 1] - radii[i - 1]));
      }
    }

    function heightAt(radius) {
      if (radius <= radii[0]) return heights[0];
      if (radius >= radii[radii.length - 1]) return heights[heights.length - 1];

      let index = 0;
      while (index < radii.length - 2 && radius > radii[index + 1]) index++;

      const r0 = radii[index];
      const r1 = radii[index + 1];
      const y0 = heights[index];
      const y1 = heights[index + 1];
      const m0 = slopes[index];
      const m1 = slopes[index + 1];
      const length = r1 - r0;
      const t = (radius - r0) / length;
      const t2 = t * t;
      const t3 = t2 * t;

      return (
        (2 * t3 - 3 * t2 + 1) * y0 +
        (t3 - 2 * t2 + t) * length * m0 +
        (-2 * t3 + 3 * t2) * y1 +
        (t3 - t2) * length * m1
      );
    }

    function slopeAt(radius) {
      const delta = 0.002;
      return (heightAt(radius + delta) - heightAt(radius - delta)) / (2 * delta);
    }

    const samples = [];
    let totalLength = 0;
    let previous = null;

    for (let i = 0; i <= 500; i++) {
      const radius = radii[0] + (radii[radii.length - 1] - radii[0]) * (i / 500);
      const y = heightAt(radius);
      if (previous) totalLength += Math.hypot(radius - previous.radius, y - previous.y);
      samples.push({ radius, y, distance: totalLength });
      previous = { radius, y };
    }

    function pointAtDistance(distance) {
      const clamped = Math.max(0, Math.min(totalLength, distance));
      let low = 0;
      let high = samples.length - 1;
      while (low < high - 1) {
        const middle = (low + high) >> 1;
        if (samples[middle].distance < clamped) low = middle;
        else high = middle;
      }
      const a = samples[low];
      const b = samples[high];
      const span = Math.max(0.000001, b.distance - a.distance);
      const t = (clamped - a.distance) / span;
      return {
        radius: a.radius + (b.radius - a.radius) * t,
        y: a.y + (b.y - a.y) * t
      };
    }

    return {
      heightAt,
      slopeAt,
      pointAtDistance,
      totalLength,
      inner: radii[0],
      outer: radii[radii.length - 1],
      innerHeight: heights[0],
      outerHeight: heights[heights.length - 1]
    };
  }

  function makeCurvedSurfaceGeometry(innerRadius, outerRadius, profile, underside = false) {
    const radialSegments = 44;
    const angularSegments = 176;
    const positions = [];
    const indices = [];

    for (let radial = 0; radial <= radialSegments; radial++) {
      const t = radial / radialSegments;
      const radius = innerRadius + (outerRadius - innerRadius) * t;
      const y = profile.heightAt(radius) - (underside ? 0.18 : 0);
      for (let angular = 0; angular <= angularSegments; angular++) {
        const theta = (angular / angularSegments) * TAU;
        positions.push(radius * Math.sin(theta), y, radius * Math.cos(theta));
      }
    }

    for (let radial = 0; radial < radialSegments; radial++) {
      for (let angular = 0; angular < angularSegments; angular++) {
        const a = radial * (angularSegments + 1) + angular;
        const b = a + angularSegments + 1;
        if (underside) {
          indices.push(a, b + 1, b, a, a + 1, b + 1);
        } else {
          indices.push(a, b, b + 1, a, b + 1, a + 1);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function makeTilePatchGeometry(cap) {
    const xSegments = 4;
    const ySegments = 3;
    const top = [];
    const bottom = [];
    const indices = [];

    for (let yIndex = 0; yIndex <= ySegments; yIndex++) {
      const y = -0.5 + yIndex / ySegments;
      for (let xIndex = 0; xIndex <= xSegments; xIndex++) {
        const x = -0.5 + xIndex / xSegments;
        let actualX = x;
        let z;

        if (cap) {
          actualX = x * (1 - 0.12 * Math.max(0, y));
          z = 0.54 * Math.sqrt(Math.max(0, 1 - Math.pow(x * 2, 2)));
          z += 0.08 * y + 0.055 * Math.max(0, y - 0.22);
        } else {
          z = 0.29 * (1 - Math.pow(x * 2, 2));
          z += 0.06 * y + 0.045 * Math.max(0, y - 0.25);
        }

        top.push(actualX, y, z);
        bottom.push(actualX, y, z - (cap ? 0.30 : 0.43));
      }
    }

    const row = xSegments + 1;
    const topOffset = 0;
    const bottomOffset = top.length / 3;

    for (let yIndex = 0; yIndex < ySegments; yIndex++) {
      for (let xIndex = 0; xIndex < xSegments; xIndex++) {
        const a = topOffset + yIndex * row + xIndex;
        const b = a + row;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }

    for (let yIndex = 0; yIndex < ySegments; yIndex++) {
      for (let xIndex = 0; xIndex < xSegments; xIndex++) {
        const a = bottomOffset + yIndex * row + xIndex;
        const b = a + row;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }

    const perimeter = [];
    for (let x = 0; x <= xSegments; x++) perimeter.push(x);
    for (let y = 1; y <= ySegments; y++) perimeter.push(y * row + xSegments);
    for (let x = xSegments - 1; x >= 0; x--) perimeter.push(ySegments * row + x);
    for (let y = ySegments - 1; y > 0; y--) perimeter.push(y * row);

    for (let i = 0; i < perimeter.length; i++) {
      const a = topOffset + perimeter[i];
      const b = topOffset + perimeter[(i + 1) % perimeter.length];
      const c = bottomOffset + perimeter[i];
      const d = bottomOffset + perimeter[(i + 1) % perimeter.length];
      indices.push(a, c, d, a, d, b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(top.concat(bottom), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function makeScallopedRosetteGeometry(points = 16, depth = 0.065) {
    const shape = new THREE.Shape();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i / (points * 2)) * TAU;
      const radius = i % 2 === 0 ? 0.5 : 0.425;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.025,
      bevelThickness: 0.018,
      curveSegments: 2
    });
    geometry.translate(0, 0, -depth * 0.5);
    geometry.computeVertexNormals();
    return geometry;
  }

  function makePendantGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.5);
    shape.bezierCurveTo(0.24, -0.25, 0.20, 0.18, 0, 0.5);
    shape.bezierCurveTo(-0.20, 0.18, -0.24, -0.25, 0, -0.5);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.055,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.018,
      bevelThickness: 0.012
    });
    geometry.translate(0, 0, -0.0275);
    geometry.computeVertexNormals();
    return geometry;
  }

  function makeLeafGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.5);
    shape.bezierCurveTo(0.22, -0.25, 0.27, 0.18, 0, 0.5);
    shape.bezierCurveTo(-0.27, 0.18, -0.22, -0.25, 0, -0.5);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.06,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.025,
      bevelThickness: 0.016
    });
    geometry.translate(0, 0, -0.03);
    geometry.computeVertexNormals();
    return geometry;
  }

  const panTileGeometry = makeTilePatchGeometry(false);
  const capTileGeometry = makeTilePatchGeometry(true);
  const eaveRosetteGeometry = makeScallopedRosetteGeometry(16, 0.07);
  const smallRosetteGeometry = makeScallopedRosetteGeometry(12, 0.045);
  const pendantGeometry = makePendantGeometry();

  function roofOrientation(radius, theta, profile) {
    const radial = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
    const slope = profile.slopeAt(radius);
    const yAxis = radial.clone().multiplyScalar(1).addScaledVector(Y_AXIS, slope).normalize();
    const zAxis = radial.clone().multiplyScalar(-slope).add(Y_AXIS).normalize();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
    const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    return new THREE.Quaternion().setFromRotationMatrix(matrix);
  }

  function verticalRadialOrientation(theta) {
    const tangent = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
    const radial = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
    const matrix = new THREE.Matrix4().makeBasis(tangent, Y_AXIS, radial);
    return new THREE.Quaternion().setFromRotationMatrix(matrix);
  }

  function makeCoffersGeometry(profile, sectors, bands) {
    const positions = [];
    const indices = [];

    for (let sector = 0; sector < sectors; sector++) {
      const angleA = (sector / sectors) * TAU + 0.012;
      const angleB = ((sector + 1) / sectors) * TAU - 0.012;

      for (let band = 0; band < bands; band++) {
        const d0 = profile.totalLength * (0.10 + band / bands * 0.76);
        const d1 = profile.totalLength * (0.10 + (band + 1) / bands * 0.76);
        const p0 = profile.pointAtDistance(d0);
        const p1 = profile.pointAtDistance(d1);
        const r0 = p0.radius;
        const r1 = p1.radius;
        const y0 = p0.y - 0.235;
        const y1 = p1.y - 0.235;
        const middleAngle = (angleA + angleB) * 0.5;

        const vertices = [
          r0 * Math.sin(angleA), y0, r0 * Math.cos(angleA),
          r0 * Math.sin(angleB), y0, r0 * Math.cos(angleB),
          r1 * Math.sin(angleA), y1, r1 * Math.cos(angleA),
          r1 * Math.sin(angleB), y1, r1 * Math.cos(angleB),
          r0 * Math.sin(middleAngle), (y0 + y1) * 0.5, r0 * Math.cos(middleAngle),
          r1 * Math.sin(middleAngle), (y0 + y1) * 0.5, r1 * Math.cos(middleAngle)
        ];
        const base = positions.length / 3;
        positions.push(...vertices);
        indices.push(base, base + 3, base + 2, base, base + 1, base + 3);
        // Ceiling quads remain below the roof shell; no raised duplicate triangles.
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  const tilePalette = [
    0x101d36,
    0x13243d,
    0x162944,
    0x193252,
    0x12213a,
    0x1b304b,
    0x172a43,
    0x203651
  ];

  function buildRoof(configuration, roofIndex) {
    const profile = makeProfile(configuration.profile);
    const name = configuration.name;

    addMesh(
      makeCurvedSurfaceGeometry(profile.inner, profile.outer, profile, false),
      materials.roofShell,
      name + "_CurvedShellTop"
    );
    addMesh(
      makeCurvedSurfaceGeometry(profile.inner, profile.outer, profile, true),
      materials.roofUnder,
      name + "_VisibleUnderside"
    );

    const outerFascia = addMesh(
      new THREE.CylinderGeometry(profile.outer + 0.012, profile.outer + 0.012, 0.24, 192, 1, true),
      materials.roofFascia,
      name + "_OuterFascia"
    );
    outerFascia.position.y = profile.outerHeight - 0.09;

    const innerFascia = addMesh(
      new THREE.CylinderGeometry(profile.inner, profile.inner, 0.18, 160, 1, true),
      materials.roofFascia,
      name + "_InnerFascia"
    );
    innerFascia.position.y = profile.innerHeight - 0.06;

    const lowerGoldBead = addMesh(
      new THREE.TorusGeometry(profile.outer + 0.035, 0.033, 8, 224),
      materials.oldGold,
      name + "_WeatheredGiltEaveBead"
    );
    lowerGoldBead.rotation.x = Math.PI * 0.5;
    lowerGoldBead.position.y = profile.outerHeight - 0.15;

    const upperGoldBead = addMesh(
      new THREE.TorusGeometry(profile.outer + 0.025, 0.020, 8, 224),
      materials.darkGold,
      name + "_UpperEaveBead"
    );
    upperGoldBead.rotation.x = Math.PI * 0.5;
    upperGoldBead.position.y = profile.outerHeight + 0.015;

    const innerBead = addMesh(
      new THREE.TorusGeometry(profile.inner + 0.025, 0.025, 8, 160),
      materials.oldGold,
      name + "_InnerGiltRing"
    );
    innerBead.rotation.x = Math.PI * 0.5;
    innerBead.position.y = profile.innerHeight;

    const columns = configuration.columns;
    const courses = configuration.courses;
    const panMesh = addInstanced(
      panTileGeometry,
      materials.tile,
      columns * courses,
      name + "_IndividualPanTiles"
    );
    const capMesh = addInstanced(
      capTileGeometry,
      materials.capTile,
      columns * courses,
      name + "_IndividualCapTiles"
    );

    const pitch = profile.totalLength / courses;
    let panIndex = 0;
    let capIndex = 0;

    for (let course = 0; course < courses; course++) {
      const distance = (course + 0.5) * pitch;
      const point = profile.pointAtDistance(distance);
      const courseOffset = 0.043 + (course % 3) * 0.0018;

      for (let column = 0; column < columns; column++) {
        const theta = (column / columns) * TAU;
        const capTheta = ((column + 0.5) / columns) * TAU;
        const angularGap = TAU * point.radius / columns;
        const panWidth = angularGap * 0.91;
        const capWidth = angularGap * 0.43;
        const orientation = roofOrientation(point.radius, theta, profile);
        const capOrientation = roofOrientation(point.radius, capTheta, profile);
        const radial = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
        const normal = radial.clone().multiplyScalar(-profile.slopeAt(point.radius)).add(Y_AXIS).normalize();
        const capRadial = new THREE.Vector3(Math.sin(capTheta), 0, Math.cos(capTheta));
        const capNormal = capRadial.clone().multiplyScalar(-profile.slopeAt(point.radius)).add(Y_AXIS).normalize();

        const panPosition = radial.clone().multiplyScalar(point.radius).setY(point.y).addScaledVector(normal, courseOffset);
        const capPosition = capRadial.clone().multiplyScalar(point.radius).setY(point.y).addScaledVector(capNormal, courseOffset + 0.008);

        const panScale = new THREE.Vector3(
          panWidth,
          pitch * 1.19,
          Math.max(0.012, panWidth * 0.39)
        );
        const capScale = new THREE.Vector3(
          capWidth,
          pitch * 1.23,
          Math.max(0.038, 0.115 * Math.pow(angularGap / (TAU * profile.outer / columns), 0.34))
        );

        setMatrixAt(panMesh, panIndex, panPosition, orientation, panScale);
        setMatrixAt(capMesh, capIndex, capPosition, capOrientation, capScale);

        const colorIndex = (column * 13 + course * 7 + roofIndex * 3) % tilePalette.length;
        const panColor = new THREE.Color(tilePalette[colorIndex]);
        panColor.offsetHSL(0, 0, randomBetween(-0.025, 0.025));
        panMesh.setColorAt(panIndex, panColor);

        const capColor = new THREE.Color(tilePalette[(colorIndex + 2) % tilePalette.length]);
        capColor.offsetHSL(0, 0, randomBetween(-0.018, 0.028));
        capMesh.setColorAt(capIndex, capColor);

        panIndex++;
        capIndex++;
      }
    }

    finishInstances(panMesh);
    finishInstances(capMesh);

    const rafterAngles = configuration.rafterAngles;
    const rafterSegments = 8;
    const rafterMesh = addInstanced(
      new THREE.BoxGeometry(1, 1, 1),
      materials.darkWood,
      rafterAngles * rafterSegments,
      name + "_RadialTimberRafters"
    );

    let rafterIndex = 0;
    for (let angleIndex = 0; angleIndex < rafterAngles; angleIndex++) {
      const theta = (angleIndex / rafterAngles) * TAU;
      const radial = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));

      for (let segment = 0; segment < rafterSegments; segment++) {
        const d0 = profile.totalLength * (0.075 + segment / rafterSegments * 0.86);
        const d1 = profile.totalLength * (0.075 + (segment + 1) / rafterSegments * 0.86);
        const p0 = profile.pointAtDistance(d0);
        const p1 = profile.pointAtDistance(d1);
        const start = radial.clone().multiplyScalar(p0.radius).setY(p0.y - 0.275);
        const end = radial.clone().multiplyScalar(p1.radius).setY(p1.y - 0.275);
        const direction = end.clone().sub(start);
        const length = direction.length();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, direction.normalize());
        const position = start.add(end).multiplyScalar(0.5);
        setMatrixAt(
          rafterMesh,
          rafterIndex++,
          position,
          quaternion,
          new THREE.Vector3(0.135, length * 1.015, 0.19)
        );
      }
    }
    finishInstances(rafterMesh);

    const cofferSectors = configuration.cofferSectors;
    const cofferBands = 4;
    addMesh(
      makeCoffersGeometry(profile, cofferSectors, cofferBands),
      materials.coffer,
      name + "_PaintedCeilingCoffers"
    );

    const purlinRadii = [];
    for (let band = 0; band < 4; band++) {
      const point = profile.pointAtDistance(profile.totalLength * (0.20 + band * 0.20));
      purlinRadii.push(point);
      const purlin = addMesh(
        new THREE.TorusGeometry(point.radius, 0.065, 8, 160),
        band % 2 === 0 ? materials.teal : materials.blue,
        name + "_ConcentricPurlin_" + band
      );
      purlin.rotation.x = Math.PI * 0.5;
      purlin.position.y = point.y - 0.24;
    }

    const cofferRosetteMesh = addInstanced(
      smallRosetteGeometry,
      materials.oldGold,
      cofferSectors * cofferBands,
      name + "_CofferGoldRosettes"
    );
    let rosetteIndex = 0;

    for (let sector = 0; sector < cofferSectors; sector++) {
      const theta = ((sector + 0.5) / cofferSectors) * TAU;
      const tangent = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
      const radial = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
      const downward = Y_AXIS.clone().negate();
      const yAxis = radial.clone().negate();
      const basis = new THREE.Matrix4().makeBasis(tangent, yAxis, downward);
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);

      for (let band = 0; band < cofferBands; band++) {
        const point = purlinRadii[band];
        const position = radial.clone().multiplyScalar(point.radius).setY(point.y - 0.355);
        setMatrixAt(
          cofferRosetteMesh,
          rosetteIndex++,
          position,
          quaternion,
          new THREE.Vector3(0.105, 0.105, 0.75)
        );
      }
    }
    finishInstances(cofferRosetteMesh);

    const eaveRosettes = addInstanced(
      eaveRosetteGeometry,
      materials.capTile,
      columns,
      name + "_ScallopedEaveEndRosettes"
    );
    const eaveBosses = addInstanced(
      new THREE.SphereGeometry(0.046, 10, 8),
      materials.oldGold,
      columns,
      name + "_EaveEndBosses"
    );
    const eavePendants = addInstanced(
      pendantGeometry,
      materials.roofFascia,
      columns,
      name + "_PendantDripTiles"
    );

    for (let column = 0; column < columns; column++) {
      const theta = ((column + 0.5) / columns) * TAU;
      const radial = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
      const tangent = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
      const basis = new THREE.Matrix4().makeBasis(tangent, Y_AXIS, radial);
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
      const rosettePosition = radial.clone().multiplyScalar(profile.outer + 0.055).setY(profile.outerHeight - 0.14);
      const pendantPosition = radial.clone().multiplyScalar(profile.outer + 0.055).setY(profile.outerHeight - 0.32);
      const bossPosition = radial.clone().multiplyScalar(profile.outer + 0.105).setY(profile.outerHeight - 0.14);

      setMatrixAt(
        eaveRosettes,
        column,
        rosettePosition,
        quaternion,
        new THREE.Vector3(0.225, 0.225, 1)
      );
      setMatrixAt(
        eaveBosses,
        column,
        bossPosition,
        quaternion,
        new THREE.Vector3(1, 1, 0.7)
      );
      setMatrixAt(
        eavePendants,
        column,
        pendantPosition,
        quaternion,
        new THREE.Vector3(0.18, 0.30, 1)
      );
    }

    for(let i=0;i<columns;i++) eaveRosettes.setColorAt(i,new THREE.Color(i%5===0?0x31475a:0x213347));
    finishInstances(eaveRosettes);
    finishInstances(eaveBosses);
    finishInstances(eavePendants);

    return columns * courses * 2;
  }

  function makeBeveledBlockGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(-0.5, -0.5);
    shape.lineTo(0.5, -0.5);
    shape.lineTo(0.5, 0.5);
    shape.lineTo(-0.5, 0.5);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.26,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.045,
      bevelThickness: 0.035
    });
    geometry.translate(0, 0, -0.13);
    geometry.computeVertexNormals();
    return geometry;
  }

  function makeGongArmGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(-0.5, -0.08);
    shape.lineTo(-0.43, 0.02);
    shape.quadraticCurveTo(-0.38, 0.18, -0.28, 0.13);
    shape.lineTo(-0.17, 0.075);
    shape.lineTo(-0.12, 0.19);
    shape.lineTo(0.12, 0.19);
    shape.lineTo(0.17, 0.075);
    shape.lineTo(0.28, 0.13);
    shape.quadraticCurveTo(0.38, 0.18, 0.43, 0.02);
    shape.lineTo(0.5, -0.08);
    shape.lineTo(0.38, -0.13);
    shape.quadraticCurveTo(0.31, -0.025, 0.24, -0.055);
    shape.lineTo(0.11, -0.09);
    shape.lineTo(-0.11, -0.09);
    shape.lineTo(-0.24, -0.055);
    shape.quadraticCurveTo(-0.31, -0.025, -0.38, -0.13);
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.18,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.024,
      bevelThickness: 0.018
    });
    geometry.translate(0, 0, -0.09);
    geometry.computeVertexNormals();
    return geometry;
  }

  function makeDiagonalAngGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.07);
    shape.lineTo(0.12, -0.105);
    shape.lineTo(0.88, 0.88);
    shape.lineTo(1, 1.02);
    shape.lineTo(0.96, 1.12);
    shape.lineTo(0.83, 1.06);
    shape.lineTo(0.76, 0.99);
    shape.lineTo(0.06, 0.08);
    shape.lineTo(0, 0.03);
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.16,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.022,
      bevelThickness: 0.016
    });
    geometry.translate(0, 0, -0.08);
    geometry.computeVertexNormals();
    return geometry;
  }

  const bracketBlockGeometry = makeBeveledBlockGeometry();
  const bracketArmGeometry = makeGongArmGeometry();
  const bracketDiagonalGeometry = makeDiagonalAngGeometry();

  function buildDougongGallery(configuration) {
    const assemblyCount = configuration.count;
    const partBatches = new Map();
    let pieceCount = 0;

    function addPart(geometryName, materialName, localPosition, localQuaternion, localScale, colorTint) {
      const worldQuaternion = configuration.thetaQuaternion.clone().multiply(localQuaternion);
      const matrix = new THREE.Matrix4().compose(localPosition, worldQuaternion, localScale);
      const key = geometryName + "|" + materialName;
      if (!partBatches.has(key)) {
        partBatches.set(key, {
          geometryName,
          materialName,
          matrices: [],
          colors: []
        });
      }
      const batch = partBatches.get(key);
      batch.matrices.push(matrix);
      batch.colors.push(colorTint);
      pieceCount++;
    }

    for (let assembly = 0; assembly < assemblyCount; assembly++) {
      const theta = (assembly / assemblyCount) * TAU;
      const thetaQuaternion = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, theta);
      const radial = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
      const center = radial.clone().multiplyScalar(configuration.radius).setY(configuration.baseY);
      const tangent = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));

      const identity = new THREE.Quaternion();
      const radialQuarterTurn = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, -Math.PI * 0.5);
      const local = (x, y, z) => center.clone().addScaledVector(tangent, x).addScaledVector(Y_AXIS, y).addScaledVector(radial, z);

      function addLocal(geometryName, materialName, position, quaternion, scale, tint) {
        const worldQuaternion = thetaQuaternion.clone().multiply(quaternion);
        const matrix = new THREE.Matrix4().compose(position, worldQuaternion, scale);
        const key = geometryName + "|" + materialName;
        if (!partBatches.has(key)) {
          partBatches.set(key, {
            geometryName,
            materialName,
            matrices: [],
            colors: []
          });
        }
        const batch = partBatches.get(key);
        batch.matrices.push(matrix);
        batch.colors.push(tint);
        pieceCount++;
      }

      addLocal(
        "block",
        assembly % 3 === 0 ? "blue" : "teal",
        local(0, 0.02, 0),
        identity,
        new THREE.Vector3(0.78, 0.29, 0.46),
        0xdde4e6
      );
      addLocal(
        "block",
        "jade",
        local(-0.48, 0.03, 0.03),
        identity,
        new THREE.Vector3(0.44, 0.27, 0.40),
        0xe4ece6
      );
      addLocal(
        "block",
        "jade",
        local(0.48, 0.03, 0.03),
        identity,
        new THREE.Vector3(0.44, 0.27, 0.40),
        0xe4ece6
      );

      for (let level = 0; level < 5; level++) {
        const levelY = level * configuration.verticalStep;
        const outward = 0.12 + level * configuration.depthStep;
        const tangentLength = 1.38 + level * 0.12;
        const radialLength = 1.55 + level * 0.13;
        const armMaterial = level % 3 === 0 ? "jade" : level % 3 === 1 ? "teal" : "blue";

        addLocal(
          "arm",
          armMaterial,
          local(0, levelY, outward),
          identity,
          new THREE.Vector3(tangentLength, 1, 1),
          level % 2 ? 0xf1f0df : 0xd4e0df
        );

        addLocal(
          "arm",
          level % 2 === 0 ? "teal" : "blue",
          local(0, levelY + 0.055, outward + 0.30),
          radialQuarterTurn,
          new THREE.Vector3(radialLength, 1, 1),
          level % 2 ? 0xdce8e8 : 0xcbd8df
        );

        const diagonalQuaternion = radialQuarterTurn.clone().multiply(
          new THREE.Quaternion().setFromAxisAngle(Z_AXIS, (level % 2 ? 1 : -1) * 0.66)
        );
        addLocal(
          "diagonal",
          level % 2 === 0 ? "blue" : "teal",
          local(0, levelY - 0.055, outward + 0.20),
          diagonalQuaternion,
          new THREE.Vector3(0.84 + level * 0.045, 1, 1),
          0xd5e0e4
        );

        addLocal(
          "block",
          level % 2 === 0 ? "ivory" : "oldGold",
          local(-tangentLength * 0.43, levelY, outward),
          identity,
          new THREE.Vector3(0.205, 0.23, 0.255),
          0xffffff
        );
        addLocal(
          "block",
          level % 2 === 0 ? "oldGold" : "ivory",
          local(tangentLength * 0.43, levelY, outward),
          identity,
          new THREE.Vector3(0.205, 0.23, 0.255),
          0xffffff
        );

        addLocal(
          "block",
          level % 2 === 0 ? "navy" : "blue",
          local((level % 2 ? 1 : -1) * 0.13, levelY - 0.15, outward - 0.03),
          identity,
          new THREE.Vector3(0.205, 0.34, 0.25),
          0xd5dde2
        );
      }

      addLocal(
        "arm",
        "jade",
        local(0, configuration.verticalStep * 4 + 0.19, configuration.depthStep * 4 + 0.46),
        identity,
        new THREE.Vector3(1.98, 0.82, 0.9),
        0xf0f0de
      );
      addLocal(
        "arm",
        "teal",
        local(0, configuration.verticalStep * 4 + 0.23, configuration.depthStep * 4 + 0.73),
        radialQuarterTurn,
        new THREE.Vector3(2.08, 0.82, 0.9),
        0xe5eeee
      );
    }

    const geometries = {
      block: bracketBlockGeometry,
      arm: bracketArmGeometry,
      diagonal: bracketDiagonalGeometry
    };

    for (const batch of partBatches.values()) {
      const mesh = addInstanced(
        geometries[batch.geometryName],
        materials[batch.materialName],
        batch.matrices.length,
        configuration.name + "_" + batch.geometryName + "_" + batch.materialName
      );
      for (let i = 0; i < batch.matrices.length; i++) {
        mesh.setMatrixAt(i, batch.matrices[i]);
        if (batch.colors[i] !== undefined) {
          mesh.setColorAt(i, new THREE.Color(batch.colors[i]));
        }
      }
      finishInstances(mesh);
    }

    return { assemblies: assemblyCount, pieces: pieceCount };
  }

  function makeRaisedPanelGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(-0.5, -0.5);
    shape.lineTo(0.5, -0.5);
    shape.lineTo(0.5, 0.5);
    shape.lineTo(-0.5, 0.5);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.075,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.028,
      bevelThickness: 0.018
    });
    geometry.translate(0, 0, -0.0375);
    geometry.computeVertexNormals();
    return geometry;
  }

  function buildHallBody() {
    const bayCount = 28;
    const bayAngle = TAU / bayCount;
    const baseRadius = 14.10;

    addMesh(
      new THREE.CylinderGeometry(14.46, 14.46, 0.08, 144, 1, false),
      materials.darkRed,
      "HallFloorEdge"
    ).position.y = 6.20;

    addMesh(
      new THREE.CylinderGeometry(14.08, 14.08, 7.90, 144, 1, true),
      materials.red,
      "VermilionCylindricalHallWall"
    ).position.y = 10.15;

    const columnGeometry = new THREE.CylinderGeometry(0.255, 0.295, 7.78, 18, 1, false);
    const columnMesh = addInstanced(columnGeometry, materials.red, bayCount, "RoundVermilionColumns");

    const footGeometry = new THREE.CylinderGeometry(0.37, 0.41, 0.30, 18, 1, false);
    const footMesh = addInstanced(footGeometry, materials.darkRed, bayCount, "ColumnFootBases");

    const capitalGeometry = new THREE.BoxGeometry(0.76, 0.28, 0.72);
    const capitalMesh = addInstanced(capitalGeometry, materials.red, bayCount, "ColumnCarvedCapitals");

    const ringGeometry = new THREE.TorusGeometry(0.305, 0.032, 8, 24);
    const ringMesh = addInstanced(ringGeometry, materials.oldGold, bayCount * 3, "ColumnGiltRings");

    const recessMatrices = [];
    const jambMatrices = [];
    const leafMatrices = [];
    const panelMatrices = [];
    const trimMatrices = [];
    const latticeMatrices = [];
    const studMatrices = [];
    const darkFrameMatrices = [];

    function bayMatrix(theta, x, y, z, scale, localRotationZ = 0, localRotationY = 0) {
      const radial = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
      const tangent = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
      const position = radial.clone().multiplyScalar(baseRadius)
        .addScaledVector(tangent, x)
        .addScaledVector(Y_AXIS, y)
        .addScaledVector(radial, z);
      const qTheta = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, theta);
      const qLocal = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, localRotationY, localRotationZ, "ZYX")
      );
      const quaternion = qTheta.clone().multiply(qLocal);
      return new THREE.Matrix4().compose(position, quaternion, scale);
    }

    for (let column = 0; column < bayCount; column++) {
      const theta = (column + 0.5) * bayAngle;
      const qTheta = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, theta);
      const radial = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));

      setMatrixAt(
        columnMesh,
        column,
        radial.clone().multiplyScalar(14.20).setY(10.12),
        qTheta,
        new THREE.Vector3(1, 1, 1)
      );
      setMatrixAt(
        footMesh,
        column,
        radial.clone().multiplyScalar(14.20).setY(6.36),
        qTheta,
        new THREE.Vector3(1, 1, 1)
      );
      setMatrixAt(
        capitalMesh,
        column,
        radial.clone().multiplyScalar(14.20).setY(13.93),
        qTheta,
        new THREE.Vector3(1, 1, 1)
      );

      for (let ring = 0; ring < 3; ring++) {
        const y = ring === 0 ? 6.53 : ring === 1 ? 6.77 : 13.70;
        const qRing = qTheta.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, Math.PI * 0.5));
        setMatrixAt(
          ringMesh,
          column * 3 + ring,
          radial.clone().multiplyScalar(14.20).setY(y),
          qRing,
          new THREE.Vector3(1, 1, 1)
        );
      }
    }

    finishInstances(columnMesh);
    finishInstances(footMesh);
    finishInstances(capitalMesh);
    finishInstances(ringMesh);

    for (let bay = 0; bay < bayCount; bay++) {
      const theta = bay * bayAngle;

      recessMatrices.push(
        bayMatrix(theta, 0, 9.55, 0, new THREE.Vector3(3.03, 6.90, 0.08))
      );
      jambMatrices.push(
        bayMatrix(theta, -1.49, 9.62, 0.075, new THREE.Vector3(0.19, 7.12, 0.25))
      );
      jambMatrices.push(
        bayMatrix(theta, 1.49, 9.62, 0.075, new THREE.Vector3(0.19, 7.12, 0.25))
      );

      const leafCenters = [-0.705, 0.705];
      for (const leafX of leafCenters) {
        leafMatrices.push(
          bayMatrix(theta, leafX, 9.47, 0.105, new THREE.Vector3(1.35, 5.35, 0.14))
        );

        trimMatrices.push(
          bayMatrix(theta, leafX - 0.615, 9.47, 0.205, new THREE.Vector3(0.032, 5.12, 0.040))
        );
        trimMatrices.push(
          bayMatrix(theta, leafX + 0.615, 9.47, 0.205, new THREE.Vector3(0.032, 5.12, 0.040))
        );
        trimMatrices.push(
          bayMatrix(theta, leafX, 6.93, 0.205, new THREE.Vector3(1.23, 0.032, 0.040))
        );
        trimMatrices.push(
          bayMatrix(theta, leafX, 12.01, 0.205, new THREE.Vector3(1.23, 0.032, 0.040))
        );

        const panelDefinitions = [
          { x: leafX, y: 8.28, width: 1.035, height: 2.28 },
          { x: leafX, y: 10.86, width: 1.035, height: 0.94 }
        ];

        for (const panel of panelDefinitions) {
          panelMatrices.push(
            bayMatrix(
              theta,
              panel.x,
              panel.y,
              0.205,
              new THREE.Vector3(panel.width, panel.height, 1)
            )
          );

          const halfWidth = panel.width * 0.5;
          const halfHeight = panel.height * 0.5;
          trimMatrices.push(
            bayMatrix(theta, panel.x - halfWidth, panel.y, 0.257, new THREE.Vector3(0.027, panel.height, 0.028))
          );
          trimMatrices.push(
            bayMatrix(theta, panel.x + halfWidth, panel.y, 0.257, new THREE.Vector3(0.027, panel.height, 0.028))
          );
          trimMatrices.push(
            bayMatrix(theta, panel.x, panel.y - halfHeight, 0.257, new THREE.Vector3(panel.width, 0.027, 0.028))
          );
          trimMatrices.push(
            bayMatrix(theta, panel.x, panel.y + halfHeight, 0.257, new THREE.Vector3(panel.width, 0.027, 0.028))
          );

          const diagonalLength = Math.hypot(panel.width * 0.82, panel.height * 0.72);
          const diagonalAngle = Math.atan2(panel.height * 0.72, panel.width * 0.82);
          trimMatrices.push(
            bayMatrix(
              theta,
              panel.x,
              panel.y,
              0.262,
              new THREE.Vector3(diagonalLength, 0.018, 0.022),
              diagonalAngle
            )
          );
          trimMatrices.push(
            bayMatrix(
              theta,
              panel.x,
              panel.y,
              0.262,
              new THREE.Vector3(diagonalLength, 0.018, 0.022),
              -diagonalAngle
            )
          );

          if (panel.height > 1.5) {
            const studPositions = [
              [-halfWidth + 0.06, -halfHeight + 0.06],
              [halfWidth - 0.06, -halfHeight + 0.06],
              [-halfWidth + 0.06, halfHeight - 0.06],
              [halfWidth - 0.06, halfHeight - 0.06]
            ];
            for (const [sx, sy] of studPositions) {
              studMatrices.push(
                bayMatrix(theta, panel.x + sx, panel.y + sy, 0.285, new THREE.Vector3(1, 1, 1))
              );
            }
          }
        }
      }

      trimMatrices.push(
        bayMatrix(theta, 0, 9.47, 0.222, new THREE.Vector3(0.035, 5.20, 0.040))
      );

      const transomBottom = 12.30;
      const transomTop = 13.58;
      const transomHeight = transomTop - transomBottom;
      const transomCenter = (transomTop + transomBottom) * 0.5;
      const transomWidth = 2.76;
      const cellWidth = transomWidth / 6;

      darkFrameMatrices.push(
        bayMatrix(theta, 0, transomCenter, 0.18, new THREE.Vector3(2.96, 1.48, 0.11))
      );
      trimMatrices.push(
        bayMatrix(theta, -1.39, transomCenter, 0.255, new THREE.Vector3(0.055, 1.46, 0.055))
      );
      trimMatrices.push(
        bayMatrix(theta, 1.39, transomCenter, 0.255, new THREE.Vector3(0.055, 1.46, 0.055))
      );
      trimMatrices.push(
        bayMatrix(theta, 0, transomBottom - 0.02, 0.255, new THREE.Vector3(2.84, 0.055, 0.055))
      );
      trimMatrices.push(
        bayMatrix(theta, 0, transomTop + 0.02, 0.255, new THREE.Vector3(2.84, 0.055, 0.055))
      );

      for (let vertical = 0; vertical < 7; vertical++) {
        const x = -transomWidth * 0.5 + vertical * cellWidth;
        latticeMatrices.push(
          bayMatrix(theta, x, transomCenter, 0.255, new THREE.Vector3(0.024, transomHeight - 0.08, 0.047))
        );
      }

      for (let cell = 0; cell < 6; cell++) {
        const left = -transomWidth * 0.5 + cell * cellWidth;
        const right = left + cellWidth;
        const diagonalLength = Math.hypot(cellWidth, transomHeight - 0.10);
        const angle = Math.atan2(transomHeight - 0.10, cellWidth);

        latticeMatrices.push(
          bayMatrix(
            theta,
            (left + right) * 0.5,
            transomCenter,
            0.258,
            new THREE.Vector3(diagonalLength, 0.022, 0.045),
            angle
          )
        );
        latticeMatrices.push(
          bayMatrix(
            theta,
            (left + right) * 0.5,
            transomCenter,
            0.258,
            new THREE.Vector3(diagonalLength, 0.022, 0.045),
            -angle
          )
        );
      }

      for (let horizontal = 0; horizontal < 3; horizontal++) {
        const y = transomBottom + horizontal * transomHeight * 0.5;
        latticeMatrices.push(
          bayMatrix(theta, 0, y, 0.259, new THREE.Vector3(transomWidth - 0.04, 0.024, 0.047))
        );
      }

      const connectorAngles = [-0.72, -0.24, 0.24, 0.72];
      for (const angle of connectorAngles) {
        latticeMatrices.push(
          bayMatrix(
            theta,
            (angle < 0 ? -1 : 1) * (transomWidth * 0.5 - 0.08),
            transomCenter + (angle < 0 ? -0.22 : 0.22),
            0.259,
            new THREE.Vector3(0.25, 0.022, 0.045),
            angle
          )
        );
      }
    }

    const recessMesh = addInstanced(
      new THREE.BoxGeometry(1, 1, 1),
      materials.recess,
      recessMatrices.length,
      "DeepRecessedDoorBays"
    );
    recessMatrices.forEach((matrix, index) => recessMesh.setMatrixAt(index, matrix));
    finishInstances(recessMesh);

    const jambMesh = addInstanced(
      new THREE.BoxGeometry(1, 1, 1),
      materials.darkRed,
      jambMatrices.length,
      "DeepDoorRevealJambs"
    );
    jambMatrices.forEach((matrix, index) => jambMesh.setMatrixAt(index, matrix));
    finishInstances(jambMesh);

    const leafMesh = addInstanced(
      new THREE.BoxGeometry(1, 1, 1),
      materials.red,
      leafMatrices.length,
      "PairedVermilionDoorLeaves"
    );
    leafMatrices.forEach((matrix, index) => {
      leafMesh.setMatrixAt(index, matrix);
      leafMesh.setColorAt(index, new THREE.Color().setHSL(0.012, 0.47, randomBetween(0.43, 0.51)));
    });
    finishInstances(leafMesh);

    const panelGeometry = makeRaisedPanelGeometry();
    const panelMesh = addInstanced(
      panelGeometry,
      materials.raisedRed,
      panelMatrices.length,
      "BeveledDoorLowerPanels"
    );
    panelMatrices.forEach((matrix, index) => {
      panelMesh.setMatrixAt(index, matrix);
      panelMesh.setColorAt(index, new THREE.Color().setHSL(0.014, 0.42, randomBetween(0.43, 0.49)));
    });
    finishInstances(panelMesh);

    const trimMesh = addInstanced(
      new THREE.BoxGeometry(1, 1, 1),
      materials.oldGold,
      trimMatrices.length,
      "FineGoldDoorLineFrames"
    );
    trimMatrices.forEach((matrix, index) => trimMesh.setMatrixAt(index, matrix));
    finishInstances(trimMesh);

    const latticeMesh = addInstanced(
      new THREE.BoxGeometry(1, 1, 1),
      materials.jade,
      latticeMatrices.length,
      "ConnectedDiamondLatticeTransoms"
    );
    latticeMatrices.forEach((matrix, index) => latticeMesh.setMatrixAt(index, matrix));
    finishInstances(latticeMesh);

    const darkFrameMesh = addInstanced(
      new THREE.BoxGeometry(1, 1, 1),
      materials.navy,
      darkFrameMatrices.length,
      "TransomDarkBackingFrames"
    );
    darkFrameMatrices.forEach((matrix, index) => darkFrameMesh.setMatrixAt(index, matrix));
    finishInstances(darkFrameMesh);

    const studMesh = addInstanced(
      new THREE.SphereGeometry(0.037, 10, 8),
      materials.oldGold,
      studMatrices.length,
      "SmallGoldDoorStuds"
    );
    studMatrices.forEach((matrix, index) => studMesh.setMatrixAt(index, matrix));
    finishInstances(studMesh);

    return {
      bays: bayCount,
      leaves: leafMatrices.length,
      latticeStrips: latticeMatrices.length
    };
  }

  function cylinderBetween(start, end, radius, material, name, radialSegments = 12) {
    const direction = end.clone().sub(start);
    const length = direction.length();
    const geometry = new THREE.CylinderGeometry(radius, radius, length, radialSegments, 1, false);
    const mesh = addMesh(geometry, material, name);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
    return mesh;
  }

  function buildPlaque() {
    const centerY = 29.95;
    const centerZ = 11.47;

    addMesh(
      new THREE.BoxGeometry(2.32, 4.00, 0.18),
      materials.plaque,
      "FrontSuspendedDarkBluePlaque"
    ).position.set(0, centerY, centerZ);

    const framePieces = [
      { x: -1.205, y: centerY, sx: 0.09, sy: 4.20 },
      { x: 1.205, y: centerY, sx: 0.09, sy: 4.20 },
      { x: 0, y: centerY - 2.055, sx: 2.50, sy: 0.09 },
      { x: 0, y: centerY + 2.055, sx: 2.50, sy: 0.09 }
    ];

    for (let i = 0; i < framePieces.length; i++) {
      const piece = framePieces[i];
      addMesh(
        new THREE.BoxGeometry(piece.sx, piece.sy, 0.19),
        materials.oldGold,
        "SculptedPlaqueGoldFrame_" + i
      ).position.set(piece.x, piece.y, centerZ + 0.105);
    }

    const leafGeometry = makeLeafGeometry();
    const leafCount = 28;
    const leafMesh = addInstanced(
      leafGeometry,
      materials.oldGold,
      leafCount,
      "PlaqueFrameRepeatedGoldLeaves"
    );
    let leafIndex = 0;

    for (let i = 0; i < 7; i++) {
      const x = -0.96 + i * 0.32;
      setMatrixAt(
        leafMesh,
        leafIndex++,
        new THREE.Vector3(x, centerY + 2.055, centerZ + 0.225),
        new THREE.Quaternion().setFromAxisAngle(Z_AXIS, i % 2 ? 0.32 : -0.32),
        new THREE.Vector3(0.23, 0.34, 1)
      );
      setMatrixAt(
        leafMesh,
        leafIndex++,
        new THREE.Vector3(x, centerY - 2.055, centerZ + 0.225),
        new THREE.Quaternion().setFromAxisAngle(Z_AXIS, i % 2 ? -0.32 : 0.32),
        new THREE.Vector3(0.23, 0.34, 1)
      );
    }

    for (let i = 0; i < 7; i++) {
      const y = centerY - 1.54 + i * 0.515;
      setMatrixAt(
        leafMesh,
        leafIndex++,
        new THREE.Vector3(-1.205, y, centerZ + 0.225),
        new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -Math.PI * 0.5 + (i % 2 ? 0.25 : -0.25)),
        new THREE.Vector3(0.20, 0.31, 1)
      );
      setMatrixAt(
        leafMesh,
        leafIndex++,
        new THREE.Vector3(1.205, y, centerZ + 0.225),
        new THREE.Quaternion().setFromAxisAngle(Z_AXIS, Math.PI * 0.5 + (i % 2 ? 0.25 : -0.25)),
        new THREE.Vector3(0.20, 0.31, 1)
      );
    }
    finishInstances(leafMesh);

    const medallionGeometry = makeScallopedRosetteGeometry(14, 0.075);
    const medallionMesh = addInstanced(
      medallionGeometry,
      materials.oldGold,
      3,
      "UnletteredPlaqueGoldMedallions"
    );
    setMatrixAt(
      medallionMesh,
      0,
      new THREE.Vector3(0, centerY + 0.02, centerZ + 0.205),
      new THREE.Quaternion(),
      new THREE.Vector3(1.10, 1.10, 1)
    );
    setMatrixAt(
      medallionMesh,
      1,
      new THREE.Vector3(0, centerY + 1.34, centerZ + 0.205),
      new THREE.Quaternion(),
      new THREE.Vector3(0.42, 0.42, 1)
    );
    setMatrixAt(
      medallionMesh,
      2,
      new THREE.Vector3(0, centerY - 1.34, centerZ + 0.205),
      new THREE.Quaternion(),
      new THREE.Vector3(0.42, 0.42, 1)
    );
    finishInstances(medallionMesh);

    cylinderBetween(
      new THREE.Vector3(-0.88, centerY + 2.05, centerZ - 0.02),
      new THREE.Vector3(-0.88, 32.70, 10.92),
      0.035,
      materials.darkGold,
      "PlaqueLeftSuspensionRod"
    );
    cylinderBetween(
      new THREE.Vector3(0.88, centerY + 2.05, centerZ - 0.02),
      new THREE.Vector3(0.88, 32.70, 10.92),
      0.035,
      materials.darkGold,
      "PlaqueRightSuspensionRod"
    );
  }

  function makePetalGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.5);
    shape.bezierCurveTo(0.18, -0.25, 0.29, 0.20, 0, 0.5);
    shape.bezierCurveTo(-0.29, 0.20, -0.18, -0.25, 0, -0.5);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.075,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.022,
      bevelThickness: 0.018
    });
    geometry.translate(0, 0, -0.0375);
    geometry.computeVertexNormals();
    return geometry;
  }

  function buildFinial() {
    const profile = [[.44,39],[.68,39.12],[.74,39.28],[.66,39.44],[.48,39.55],[.48,40.0],[.65,40.14],[.65,40.33],[.57,40.43],[.69,40.72],[.84,41.08],[1.02,41.65],[1.10,42.20],[1.08,42.54],[.99,42.78],[.81,42.94],[.52,43.04],[.01,43.09]];
    const body=addMesh(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),96),materials.oldGold,'RoundedGiltCupFinial');
    body.material=materials.oldGold.clone();body.material.color.set(0xc29b51);body.material.roughness=.38;body.material.metalness=.63;
    for(const [r,y,t] of [[.68,39.12,.055],[.74,39.30,.045],[.52,39.65,.045],[.53,39.95,.055],[.65,40.18,.055],[.66,40.31,.035]]){
      const collar=addMesh(new THREE.TorusGeometry(r,t,10,64),materials.oldGold,'FinialIncisedCollar');collar.rotation.x=Math.PI/2;collar.position.y=y;
    }
    const petals=addInstanced(makePetalGeometry(),materials.oldGold,32,'FinialLotusNecklace');
    for(let i=0;i<32;i++){const a=i/32*TAU;setMatrixAt(petals,i,new THREE.Vector3(Math.sin(a)*.52,39.77,Math.cos(a)*.52),new THREE.Quaternion().setFromAxisAngle(Y_AXIS,a),new THREE.Vector3(.15,.35,1));}
    finishInstances(petals);
  }

  const bodyStats = buildHallBody();

  const friezePanels = buildPaintedDrum({
    name: "ContinuousPaintedLintelAndFrieze",
    radius: 14.48,
    bottom: 14.10,
    height: 2.10,
    panelCount: 56,
    cells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  });

  const lowerDrumPanels = buildPaintedDrum({
    name: "LowerPaintedCylindricalDrum",
    radius: 11.30,
    bottom: 22.40,
    height: 2.60,
    panelCount: 48,
    cells: [0, 2, 4, 6, 8, 10, 12, 14, 1, 3, 5, 7, 9, 11, 13, 15]
  });

  const upperDrumPanels = buildPaintedDrum({
    name: "UpperPaintedCylindricalDrum",
    radius: 8.50,
    bottom: 29.50,
    height: 2.50,
    panelCount: 32,
    cells: [1, 3, 5, 7, 9, 11, 13, 15]
  });

  const bottomBracketStats = buildDougongGallery({
    name: "LowerDougongGallery",
    count: 72,
    radius: 15.25,
    baseY: 16.08,
    verticalStep: 0.40,
    depthStep: 0.20
  });

  const middleBracketStats = buildDougongGallery({
    name: "MiddleDougongGallery",
    count: 56,
    radius: 10.25,
    baseY: 24.12,
    verticalStep: 0.275,
    depthStep: 0.17
  });

  const upperBracketStats = buildDougongGallery({
    name: "UpperDougongGallery",
    count: 40,
    radius: 8.70,
    baseY: 31.08,
    verticalStep: 0.28,
    depthStep: 0.17
  });

  const lowerRoofTiles = buildRoof({
    name: "LowerRoof",
    columns: 384,
    courses: 26,
    rafterAngles: 64,
    cofferSectors: 32,
    profile: [
      [11.30, 23.30],
      [12.65, 22.66],
      [14.15, 21.67],
      [15.70, 20.52],
      [17.10, 19.42],
      [18.08, 18.64],
      [18.40, 18.40],
      [18.60, 18.50]
    ]
  }, 0);

  const middleRoofTiles = buildRoof({
    name: "MiddleRoof",
    columns: 320,
    courses: 24,
    rafterAngles: 56,
    cofferSectors: 28,
    profile: [
      [8.60, 30.10],
      [9.30, 29.61],
      [10.50, 28.70],
      [11.95, 27.52],
      [13.30, 26.39],
      [14.25, 25.82],
      [14.56, 25.72],
      [14.80, 25.90]
    ]
  }, 1);

  const upperRoofTiles = buildRoof({
    name: "UpperRoof",
    columns: 256,
    courses: 22,
    rafterAngles: 48,
    cofferSectors: 24,
    profile: [
      [0.90, 39.00],
      [1.65, 38.77],
      [2.85, 38.14],
      [4.30, 37.17],
      [5.95, 36.08],
      [7.65, 34.92],
      [9.15, 33.87],
      [10.42, 33.10],
      [11.12, 32.73],
      [11.42, 32.79],
      [11.60, 32.90]
    ]
  }, 2);

  buildPlaque();
  buildFinial();

  let totalMeshes = 0;
  let totalInstancedMeshes = 0;
  group.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      totalMeshes++;
      if (object.isInstancedMesh) totalInstancedMeshes++;
    }
  });

  const stats = {
    tileInstances: lowerRoofTiles + middleRoofTiles + upperRoofTiles,
    bracketAssemblies:
      bottomBracketStats.assemblies +
      middleBracketStats.assemblies +
      upperBracketStats.assemblies,
    bracketPieces:
      bottomBracketStats.pieces +
      middleBracketStats.pieces +
      upperBracketStats.pieces,
    doorBays: bodyStats.bays,
    doorLeaves: bodyStats.leaves,
    latticeStrips: bodyStats.latticeStrips,
    ornamentPanels:
      friezePanels +
      lowerDrumPanels +
      upperDrumPanels,
    roofTiers: 3,
    ornamentAtlasResolution: 4096,
    totalMeshes,
    totalInstancedMeshes,
    independentDrawCalls: totalMeshes
  };

  group.userData.stats = stats;
  return { group, stats };
}