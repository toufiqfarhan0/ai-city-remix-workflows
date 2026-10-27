export function createParkLandmarks(THREE) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const stats = { tileInstances: 0, bracketPieces: 0, railingPosts: 0, totalMeshes: 0, landmarks: 4 };
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitSphere = new THREE.SphereGeometry(1, 12, 8);
  const unitOcta = new THREE.OctahedronGeometry(1, 0);
  const postShaft = new THREE.CylinderGeometry(.09, .12, .78, 8);
  const cylinderGeometries = new Map();

  function standard(color, options = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: .72, metalness: .025, ...options });
  }

  function paintTexture(base, accent, light, repeat = 1) {
    if (typeof document === "undefined" || !document.createElement) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(7, 7, 498, 114);
    ctx.strokeStyle = light;
    ctx.lineWidth = 2;
    ctx.strokeRect(15, 15, 482, 98);
    for (let x = 54; x < 512; x += 128) {
      ctx.save();
      ctx.translate(x, 64);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      for (let p = 0; p < 8; p++) {
        ctx.beginPath();
        const a = p * Math.PI / 4;
        ctx.ellipse(Math.cos(a) * 13, Math.sin(a) * 13, 13, 7, a, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = light;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-25, 2, 10, .2, Math.PI * 1.75);
      ctx.arc(25, -2, 10, Math.PI * 1.25, Math.PI * 2.75);
      ctx.stroke();
      ctx.restore();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, 1);
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function stoneTexture() {
    if (typeof document === "undefined" || !document.createElement) return null;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#d8d4c8";
    ctx.fillRect(0, 0, 256, 256);
    let seed = 81723;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 4200; i++) {
      const shade = Math.floor(145 + random() * 75);
      ctx.fillStyle = `rgba(${shade},${shade},${shade - 5},${.025 + random() * .06})`;
      ctx.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1 + random() * 2);
    }
    ctx.strokeStyle = "rgba(105,104,96,.13)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 28; i++) {
      const x = random() * 256;
      const y = random() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 35, y - 18, x + 55, y + 28, x + 95, y + 7);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5);
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function paintedMaterial(base, accent, light, repeat = 1) {
    const map = paintTexture(base, accent, light, repeat);
    return standard(map ? 0xffffff : base, { map, roughness: .62 });
  }

  const red = standard(0x9f2025, { roughness: .57 });
  const redDark = standard(0x64191d, { roughness: .64 });
  const redBright = standard(0xb62a2c, { roughness: .5 });
  const navy = standard(0x142740, { roughness: .37, metalness: .07 });
  const navyDark = standard(0x0c1828, { roughness: .48 });
  const green = standard(0x1d5144, { roughness: .38, metalness: .06 });
  const greenDark = standard(0x153b34, { roughness: .5 });
  const gold = standard(0xc79a42, { roughness: .38, metalness: .42 });
  const teal = standard(0x278b89, { roughness: .54 });
  const latticeTeal = standard(0x55a8a0, { roughness: .48 });
  const stoneMap = stoneTexture();
  const stone = standard(stoneMap ? 0xffffff : 0xd8d4c8, { map: stoneMap, roughness: .93 });
  const stoneGrey = standard(0xa9aaa3, { roughness: .94 });
  const centralStone = standard(0xaeb6b1, { roughness: .88 });
  const paintedTeal = paintedMaterial("#146d70", "#d3ae58", "#e8dfbd", 4);
  const paintedRound = paintedMaterial("#15586d", "#d0a64c", "#e9dfb9", 12);
  const roofUnder = standard(0x17212a, { side: THREE.BackSide, roughness: .82 });
  const tileMaterial = standard(0xffffff, { roughness: .34, metalness: .08, side: THREE.DoubleSide });

  function matrixAt(x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
    return new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(sx, sy, sz)
    );
  }

  function mesh(parent, geometry, material) {
    const object = new THREE.Mesh(geometry, material);
    object.castShadow = object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function box(parent, material, x, y, z, w, h, d, ry = 0) {
    const object = mesh(parent, unitBox, material);
    object.position.set(x, y, z);
    object.scale.set(w, h, d);
    object.rotation.y = ry;
    return object;
  }

  function cylinder(parent, material, x, y, z, rt, rb, h, segments = 32) {
    const key = [rt, rb, h, segments].join(',');
    if (!cylinderGeometries.has(key)) cylinderGeometries.set(key, new THREE.CylinderGeometry(rt, rb, h, segments));
    const object = mesh(parent, cylinderGeometries.get(key), material);
    object.position.set(x, y, z);
    return object;
  }

  function torusArc(parent, material, radius, tube, y, x, z, start, arc) {
    const geometry = new THREE.TorusGeometry(radius, tube, 7, Math.max(12, Math.ceil(110 * arc / (Math.PI * 2))), arc);
    geometry.rotateX(Math.PI / 2);
    geometry.rotateY(-start);
    const object = mesh(parent, geometry, material);
    object.position.set(x, y, z);
    return object;
  }

  function putInstances(parent, geometry, material, matrices, palette = null) {
    if (!matrices.length) return null;
    const object = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, index) => object.setMatrixAt(index, matrix));
    if (palette) {
      matrices.forEach((_, index) => {
        const c = new THREE.Color(palette[index % palette.length]);
        c.multiplyScalar(.87 + ((index * 13) % 19) / 65);
        object.setColorAt(index, c);
      });
      if (object.instanceColor) object.instanceColor.needsUpdate = true;
    }
    object.instanceMatrix.needsUpdate = true;
    object.castShadow = object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function tileGeometry(convex) {
    const positions = [], indices = [];
    const nx = 4, nz = 1, row = nx + 1;
    for (let layer = 0; layer < 2; layer++) {
      for (let j = 0; j <= nz; j++) {
        for (let i = 0; i <= nx; i++) {
          const u = i / nx * 2 - 1;
          const top = convex ? .07 + .05 * (1 - u * u) : .015 + .045 * u * u;
          positions.push(u * .16, layer ? top - .09 : top, j / nz - .5);
        }
      }
    }
    const layerSize = row * (nz + 1);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
        indices.push(a, c, b, b, c, d);
        indices.push(a + layerSize, b + layerSize, c + layerSize, b + layerSize, d + layerSize, c + layerSize);
      }
    }
    for (let i = 0; i < nx; i++) {
      const a = i, b = i + 1;
      indices.push(a, b, a + layerSize, b, b + layerSize, a + layerSize);
      const c = nz * row + i, d = c + 1;
      indices.push(c, c + layerSize, d, c, d + layerSize, d + layerSize);
    }
    for (let j = 0; j < nz; j++) {
      const a = j * row, b = (j + 1) * row;
      indices.push(a, a + layerSize, b, b, a + layerSize, b + layerSize);
      const c = a + nx, d = b + nx;
      indices.push(c, d, c + layerSize, d, d + layerSize, c + layerSize);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  const tileCap = tileGeometry(true);
  const tilePan = tileGeometry(false);

  function addTiles(parent, caps, pans, palette) {
    const batches = [[caps, tileCap, 0], [pans, tilePan, 1]];
    for (const [matrices, geometry, kind] of batches) {
      if (!matrices.length) continue;
      const object = putInstances(parent, geometry, tileMaterial, matrices, palette);
      if (object) object.userData.tileBatch = true;
    }
    stats.tileInstances += caps.length + pans.length;
  }

  function bracketGeometry() {
    const components = [
      { s: [.42, .66, .42], p: [0, .33, 0], r: [0, 0, 0], c: 0x247d80 },
      { s: [.72, .22, .5], p: [0, .12, 0], r: [0, 0, 0], c: 0x17666d },
      { s: [1.55, .2, .3], p: [0, .31, 0], r: [0, 0, 0], c: 0x269397 },
      { s: [1.12, .19, .27], p: [0, .61, 0], r: [0, 0, 0], c: 0x3aa39d },
      { s: [.78, .17, .23], p: [-.52, .49, 0], r: [0, 0, .24], c: 0x247d80 },
      { s: [.78, .17, .23], p: [.52, .49, 0], r: [0, 0, -.24], c: 0x247d80 },
      { s: [.22, .34, .3], p: [-.72, .16, 0], r: [0, 0, 0], c: 0xd0a64c },
      { s: [.22, .34, .3], p: [.72, .16, 0], r: [0, 0, 0], c: 0xd0a64c },
      { s: [.42, .13, .22], p: [-.83, .73, 0], r: [0, 0, -.28], c: 0xd6b565 },
      { s: [.42, .13, .22], p: [.83, .73, 0], r: [0, 0, .28], c: 0xd6b565 }
    ];
    const positions = [], normals = [], colors = [], indices = [];
    components.forEach(component => {
      const geometry = new THREE.BoxGeometry(...component.s);
      const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...component.r));
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(...component.p), quaternion, new THREE.Vector3(1, 1, 1)
      );
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
      const p = geometry.attributes.position, n = geometry.attributes.normal;
      const offset = positions.length / 3;
      const color = new THREE.Color(component.c);
      for (let i = 0; i < p.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(matrix);
        const normal = new THREE.Vector3().fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize();
        positions.push(point.x, point.y, point.z);
        normals.push(normal.x, normal.y, normal.z);
        colors.push(color.r, color.g, color.b);
      }
      const index = geometry.index.array;
      for (let i = 0; i < index.length; i++) indices.push(index[i] + offset);
      geometry.dispose();
    });
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    result.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    result.setIndex(indices);
    return result;
  }

  const bracketGeo = bracketGeometry();
  const bracketMat = standard(0xffffff, { vertexColors: true, roughness: .58 });
  function addBrackets(parent, matrices) {
    putInstances(parent, bracketGeo, bracketMat, matrices);
    stats.bracketPieces += matrices.length * 10;
  }

  function roundPoint(radius, radiusMax, eave, apex) {
    const t = clamp(radius / radiusMax, 0, 1);
    const y = eave + (apex - eave) * Math.pow(1 - t, 1.55) + .45 * smooth(.87, 1, t);
    return new THREE.Vector3(0, y, 0);
  }

  function roundShellGeometry(radius, eave, apex) {
    const positions = [], uvs = [], indices = [];
    const segments = 96, rings = 34;
    positions.push(0, apex, 0);
    uvs.push(.5, .5);
    for (let ring = 1; ring <= rings; ring++) {
      const r = radius * ring / rings;
      const p = roundPoint(r, radius, eave, apex);
      for (let j = 0; j < segments; j++) {
        const a = j / segments * Math.PI * 2;
        positions.push(Math.sin(a) * r, p.y, Math.cos(a) * r);
        uvs.push(j / segments * 4, ring / rings);
      }
    }
    for (let j = 0; j < segments; j++) indices.push(0, 1 + (j + 1) % segments, 1 + j);
    for (let ring = 1; ring < rings; ring++) {
      const inner = 1 + (ring - 1) * segments, outer = inner + segments;
      for (let j = 0; j < segments; j++) {
        const k = (j + 1) % segments;
        indices.push(inner + j, inner + k, outer + j, inner + k, outer + k, outer + j);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function addRoundRoof(parent, radius, eave, apex) {
    const geometry = roundShellGeometry(radius, eave, apex);
    mesh(parent, geometry, navy);
    const underside = mesh(parent, geometry, roofUnder);
    underside.position.y = -.18;
    const edgeY = roundPoint(radius, radius, eave, apex).y;
    cylinder(parent, navy, 0, edgeY - .13, 0, radius, radius, .28, 96);
    const edge = mesh(parent, new THREE.TorusGeometry(radius - .03, .15, 8, 96), navy);
    edge.rotation.x = Math.PI / 2;
    edge.position.y = edgeY;
    const caps = [], pans = [];
    const courses = 29;
    for (let course = 0; course < courses; course++) {
      const r = (course + .5) * radius / courses;
      const count = Math.max(6, Math.ceil(Math.PI * 2 * r / .32));
      const p = roundPoint(r, radius, eave, apex);
      const dr = (roundPoint(r + .01, radius, eave, apex).y - roundPoint(r - .01, radius, eave, apex).y) / .02;
      for (let j = 0; j < count; j++) {
        const a = j / count * Math.PI * 2;
        const normal = new THREE.Vector3(-dr * Math.sin(a), 1, -dr * Math.cos(a)).normalize();
        const tangent = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
        const downslope = new THREE.Vector3().crossVectors(tangent, normal).normalize();
        const position = new THREE.Vector3(Math.sin(a) * r, p.y, Math.cos(a) * r).addScaledVector(normal, (course + j) % 6 === 0 ? .075 : .035);
        const matrix = new THREE.Matrix4().makeBasis(tangent, normal, downslope);
        matrix.setPosition(position);
        matrix.scale(new THREE.Vector3(Math.PI * 2 * r / count / .32 * 1.03, 1, radius / courses * Math.sqrt(1 + dr * dr) * 1.14));
        ((course + j) % 6 === 0 ? pans : caps).push(matrix);
      }
    }
    addTiles(parent, caps, pans, [0x142740, 0x1b3049, 0x203550, 0x172a40]);
    return edgeY;
  }

  function hipProfile(s, ridge, eave) {
    return eave + (ridge - eave) * Math.pow(1 - clamp(s, 0, 1), 1.55) + .36 * smooth(.84, 1, s);
  }

  function hipPoint(face, u, v, width, depth, ridge, eave) {
    const halfW = width / 2, halfD = depth / 2, ridgeHalf = (width - depth) / 2;
    let x, z, s;
    if (face === "front" || face === "back") {
      x = u * (ridgeHalf + halfD * v);
      z = (face === "front" ? 1 : -1) * halfD * v;
      s = v;
    } else {
      const run = halfW - ridgeHalf;
      x = face === "right" ? ridgeHalf + v * run : -ridgeHalf - v * run;
      z = u * halfD * v;
      s = v;
    }
    return new THREE.Vector3(x, hipProfile(s, ridge, eave), z);
  }

  function hipShellGeometry(width, depth, ridge, eave) {
    const positions = [], uvs = [], indices = [];
    function face(faceName, nu, nv) {
      const base = positions.length / 3;
      for (let j = 0; j <= nv; j++) {
        for (let i = 0; i <= nu; i++) {
          const u = faceName === "front" || faceName === "back" ? -1 + 2 * i / nu : -1 + 2 * i / nu;
          const v = j / nv;
          const p = hipPoint(faceName, u, v, width, depth, ridge, eave);
          positions.push(p.x, p.y, p.z);
          uvs.push(i / nu * 3, j / nv);
        }
      }
      for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
          const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
          if (faceName === "front" || faceName === "left") {
            indices.push(a, c, b, b, c, d);
          } else {
            indices.push(a, b, c, b, d, c);
          }
        }
      }
    }
    face("front", 64, 28);
    face("back", 64, 28);
    face("right", 34, 18);
    face("left", 34, 18);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function addHipRoof(parent, options) {
    const { width, depth, ridge, eave, greenRoof = false } = options;
    const group = new THREE.Group();
    group.position.set(options.x || 0, 0, options.z || 0);
    parent.add(group);
    const shell = hipShellGeometry(width, depth, ridge, eave);
    mesh(group, shell, greenRoof ? green : navy);
    const underside = mesh(group, shell, roofUnder);
    underside.position.y = -.16;
    const edgeY = hipProfile(1, ridge, eave);
    const ridgeHalf = (width - depth) / 2;
    const fascia = greenRoof ? greenDark : navyDark;
    box(group, fascia, 0, edgeY - .12, depth / 2, width + .12, .28, .2);
    box(group, fascia, 0, edgeY - .12, -depth / 2, width + .12, .28, .2);
    box(group, fascia, width / 2, edgeY - .12, 0, .2, .28, depth);
    box(group, fascia, -width / 2, edgeY - .12, 0, .2, .28, depth);
    const rafterMatrices = [];
    for (let x = -width / 2 + .35; x <= width / 2; x += .72) {
      rafterMatrices.push(matrixAt(x, edgeY - .28, depth / 2 - .38, .1, .15, .76));
      rafterMatrices.push(matrixAt(x, edgeY - .28, -depth / 2 + .38, .1, .15, .76));
    }
    for (let z = -depth / 2 + .35; z <= depth / 2; z += .72) {
      rafterMatrices.push(matrixAt(width / 2 - .38, edgeY - .28, z, .76, .15, .1));
      rafterMatrices.push(matrixAt(-width / 2 + .38, edgeY - .28, z, .76, .15, .1));
    }
    putInstances(group, unitBox, fascia, rafterMatrices);
    box(group, navyDark, 0, ridge + .09, 0, ridgeHalf * 2 + .7, .19, .44);
    box(group, greenRoof ? green : navy, 0, ridge + .22, 0, ridgeHalf * 2 + .32, .16, .3);
    box(group, navyDark, 0, ridge + .34, 0, ridgeHalf * 2, .09, .18);
    const caps = [], pans = [];
    const faces = ["front", "back", "right", "left"];
    faces.forEach((faceName, faceIndex) => {
      const longFace = faceName === "front" || faceName === "back";
      const su = longFace ? Math.max(16, Math.ceil(width / .4)) : Math.max(12, Math.ceil(depth / .4));
      const sv = Math.max(7, Math.ceil(depth / 2 / .55));
      for (let j = 0; j < sv; j++) {
        for (let i = 0; i < su; i++) {
          const u = -1 + 2 * (i + .5) / su;
          const v = (j + .5) / sv;
          const p = hipPoint(faceName, u, v, width, depth, ridge, eave);
          const du = hipPoint(faceName, u + .002, v, width, depth, ridge, eave).sub(hipPoint(faceName, u - .002, v, width, depth, ridge, eave));
          const dv = hipPoint(faceName, u, v + .002, width, depth, ridge, eave).sub(hipPoint(faceName, u, v - .002, width, depth, ridge, eave));
          let normal = new THREE.Vector3().crossVectors(dv, du).normalize();
          if (normal.y < 0) normal.negate();
          const zAxis = dv.clone().addScaledVector(normal, -dv.dot(normal)).normalize();
          const xAxis = new THREE.Vector3().crossVectors(normal, zAxis).normalize();
          const pan = (i + j + faceIndex) % 6 === 0;
          p.addScaledVector(normal, pan ? .075 : .035);
          const matrix = new THREE.Matrix4().makeBasis(xAxis, normal, zAxis);
          matrix.setPosition(p);
          const xScale = clamp(du.length() / .004 * 2 / su / .32 * 1.04, .08, 2);
          const zScale = clamp(dv.length() / .004 / sv * 1.12, .08, 2.5);
          matrix.scale(new THREE.Vector3(xScale, 1, zScale));
          (pan ? pans : caps).push(matrix);
        }
      }
    });
    addTiles(group, caps, pans, greenRoof ? [0x1d5144, 0x28634f, 0x2b6a53, 0x17473d] : [0x142740, 0x1b3049, 0x203550, 0x172a40]);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const points = [
          new THREE.Vector3(sx * (width / 2 - .04), edgeY, sz * (depth / 2 - .04)),
          new THREE.Vector3(sx * (width / 2 - .62), edgeY + .1, sz * (depth / 2 - .04)),
          new THREE.Vector3(sx * (width / 2 - .82), edgeY + .43, sz * (depth / 2 - .2)),
          new THREE.Vector3(sx * (width / 2 - .56), edgeY + .65, sz * (depth / 2 - .38))
        ];
        mesh(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 14, .075, 6, false), gold);
      }
      const terminal = mesh(group, unitSphere, gold);
      terminal.position.set(sx * ridgeHalf, ridge + .48, 0);
      terminal.scale.set(.22, .25, .22);
    }
    const brackets = [];
    const spacing = 2.05;
    for (let x = -width / 2 + 1; x <= width / 2 - 1; x += spacing) {
      brackets.push(matrixAt(x, edgeY - .94, depth / 2 - .32, 1, 1, 1, 0));
      brackets.push(matrixAt(x, edgeY - .94, -depth / 2 + .32, 1, 1, 1, Math.PI));
    }
    for (let z = -depth / 2 + 1; z <= depth / 2 - 1; z += spacing) {
      brackets.push(matrixAt(width / 2 - .32, edgeY - .94, z, 1, 1, 1, Math.PI / 2));
      brackets.push(matrixAt(-width / 2 + .32, edgeY - .94, z, 1, 1, 1, -Math.PI / 2));
    }
    addBrackets(group, brackets);
    return group;
  }

  function annulusWall(inner, outer, y0, y1, gap) {
    const positions = [], indices = [];
    const segments = 144;
    for (let i = 0; i <= segments; i++) {
      const a = gap / 2 + (Math.PI * 2 - gap) * i / segments;
      const s = Math.sin(a), c = Math.cos(a);
      positions.push(inner * s, y0, inner * c, outer * s, y0, outer * c, outer * s, y1, outer * c, inner * s, y1, inner * c);
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 4, b = a + 4;
      indices.push(a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
      indices.push(a, b, a + 3, b, b + 3, a + 3);
      indices.push(a + 3, b + 3, a + 2, b + 3, b + 2, a + 2);
      indices.push(a, b + 1, b, a, a + 1, b + 1);
    }
    indices.push(0, 1, 2, 0, 2, 3);
    const e = segments * 4;
    indices.push(e, e + 3, e + 2, e, e + 2, e + 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function facadePosition(x, z, angle, lx, lz) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [x + lx * c + lz * s, z - lx * s + lz * c];
  }

  function orientedBox(parent, material, x, z, angle, lx, y, lz, w, h, d) {
    const p = facadePosition(x, z, angle, lx, lz);
    return box(parent, material, p[0], y, p[1], w, h, d, angle);
  }

  function facadeMatrix(x, z, angle, lx, y, lz, w, h, d) {
    const p = facadePosition(x, z, angle, lx, lz);
    return matrixAt(p[0], y, p[1], w, h, d, angle);
  }

  function doorBay(parent, x, base, z, width, angle, lattices) {
    orientedBox(parent, redDark, x, z, angle, 0, base + 2.45, 0, width, 4.9, .18);
    const leaf = (width - .38) / 2;
    for (const side of [-1, 1]) {
      orientedBox(parent, redBright, x, z, angle, side * (leaf / 2 + .07), base + 2.45, .15, leaf, 4.55, .12);
      orientedBox(parent, red, x, z, angle, side * (leaf / 2 + .07), base + 2.45, .225, leaf - .16, 3.95, .035);
    }
    orientedBox(parent, gold, x, z, angle, 0, base + 2.45, .27, .065, 4.75, .08);
    orientedBox(parent, gold, x, z, angle, -width / 2 + .08, base + 2.45, .25, .065, 4.8, .08);
    orientedBox(parent, gold, x, z, angle, width / 2 - .08, base + 2.45, .25, .065, 4.8, .08);
    orientedBox(parent, redDark, x, z, angle, 0, base + 5.78, .05, width, 1.45, .16);
    const verticals = Math.max(5, Math.floor(width / .42));
    for (let i = 0; i <= verticals; i++) {
      const lx = -width / 2 + .12 + (width - .24) * i / verticals;
      lattices.gold.push(facadeMatrix(x, z, angle, lx, base + 5.8, .18, .035, 1.28, .055));
    }
    for (const y of [base + 5.25, base + 5.8, base + 6.35]) {
      lattices.teal.push(facadeMatrix(x, z, angle, 0, y, .18, width - .16, .04, .055));
    }
    orientedBox(parent, red, x, z, angle, 0, base + 4.83, .2, width + .08, .18, .2);
  }

  function hallStructure(parent, options) {
    const { width, depth, base, eave, bays = 5, sideBays = 3 } = options;
    const lattices = { teal: [], gold: [] };
    const bayWidth = width / bays;
    for (let i = 0; i < bays; i++) {
      const x = -width / 2 + (i + .5) * bayWidth;
      doorBay(parent, x, base, depth / 2, bayWidth - .28, 0, lattices);
    }
    box(parent, red, 0, base + (eave - base) / 2, -depth / 2, width, eave - base, .22);
    for (const side of [-1, 1]) {
      box(parent, red, side * width / 2, base + (eave - base) / 2, 0, .22, eave - base, depth);
      const angle = side * Math.PI / 2;
      for (let j = 0; j < sideBays; j++) {
        const z = -depth / 2 + (j + .5) * depth / sideBays;
        const w = depth / sideBays - .2;
        orientedBox(parent, redDark, side * width / 2, z, angle, 0, base + 3.6, .16, w, 4.1, .12);
        for (let k = 0; k < 5; k++) {
          const lx = -w / 2 + .16 + (w - .32) * k / 4;
          lattices.teal.push(facadeMatrix(side * width / 2, z, angle, lx, base + 3.6, .25, .035, 3.65, .05));
        }
        lattices.gold.push(facadeMatrix(side * width / 2, z, angle, 0, base + 3.6, .25, w - .15, .045, .055));
      }
    }
    for (let i = 0; i <= bays; i++) {
      const x = -width / 2 + i * bayWidth;
      for (const side of [-1, 1]) {
        cylinder(parent, red, x, (base + eave) / 2, side * depth / 2, .27, .3, eave - base, 16);
        cylinder(parent, stone, x, base + .12, side * depth / 2, .4, .44, .24, 16);
      }
    }
    for (let j = 1; j < sideBays; j++) {
      const z = -depth / 2 + j * depth / sideBays;
      for (const side of [-1, 1]) {
        cylinder(parent, red, side * width / 2, (base + eave) / 2, z, .25, .28, eave - base, 14);
        cylinder(parent, stone, side * width / 2, base + .12, z, .37, .41, .24, 14);
      }
    }
    box(parent, redDark, 0, eave - .16, 0, width + .25, .3, depth + .25);
    box(parent, paintedTeal, 0, eave - .68, depth / 2 + .13, width + .15, .62, .18);
    box(parent, paintedTeal, 0, eave - .68, -depth / 2 - .13, width + .15, .62, .18);
    box(parent, paintedTeal, width / 2 + .13, eave - .68, 0, .18, .62, depth);
    box(parent, paintedTeal, -width / 2 - .13, eave - .68, 0, .18, .62, depth);
    putInstances(parent, unitBox, latticeTeal, lattices.teal);
    putInstances(parent, unitBox, gold, lattices.gold);
  }

  function addPosts(parent, positions, base) {
    const shafts = [], caps = [];
    positions.forEach(([x, z]) => {
      shafts.push(matrixAt(x, base + .39, z));
      caps.push(matrixAt(x, base + .82, z, .18, .12, .18));
    });
    putInstances(parent, postShaft, stone, shafts);
    putInstances(parent, unitSphere, stone, caps);
    stats.railingPosts += positions.length;
  }

  function addRectRailing(parent, segments, base) {
    const posts = [], reliefs = [];
    for (const segment of segments) {
      const { x, z, length, angle = 0 } = segment;
      box(parent, stone, x, base + .78, z, length, .14, .15, angle);
      box(parent, stone, x, base + .31, z, length, .1, .12, angle);
      const count = Math.max(2, Math.floor(length / 2));
      for (let i = 0; i <= count; i++) {
        const offset = -length / 2 + length * i / count;
        posts.push([x + Math.cos(angle) * offset, z - Math.sin(angle) * offset]);
        if (i < count) reliefs.push(matrixAt(x + Math.cos(angle) * (offset + length / count / 2), base + .52, z - Math.sin(angle) * (offset + length / count / 2), .16, .28, .08, angle));
      }
    }
    addPosts(parent, posts, base);
    putInstances(parent, unitOcta, stoneGrey, reliefs);
  }

  function buildVault() {
    const group = new THREE.Group();
    group.name = "vault";
    cylinder(group, stone, 0, .325, 0, 11.7, 11.9, .65, 72);
    cylinder(group, stoneGrey, 0, .68, 0, 11.35, 11.45, .12, 72);
    cylinder(group, redDark, 0, 4.45, 0, 9.4, 9.4, 7.3, 64);
    for (let i = 0; i < 4; i++) {
      const top = .64 - i * .16;
      box(group, stone, 0, top / 2, 11.35 + i * .43, 5.4 - i * .22, top, .5);
    }
    const columnMatrices = [];
    for (let i = 0; i < 16; i++) {
      const a = (i + .5) * Math.PI * 2 / 16;
      columnMatrices.push(matrixAt(Math.sin(a) * 9.25, 5.25, Math.cos(a) * 9.25));
      cylinder(group, stone, Math.sin(a) * 9.25, .86, Math.cos(a) * 9.25, .43, .47, .3, 14);
    }
    putInstances(group, new THREE.CylinderGeometry(.27, .31, 8.9, 16), red, columnMatrices);
    const panels = [], insets = [], tealLattice = [], goldLattice = [];
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI * 2 / 16;
      const x = Math.sin(a) * 9.55, z = Math.cos(a) * 9.55;
      panels.push(matrixAt(x, 3.2, z, 3.25, 4.8, .24, a));
      for (const offset of [-.78, .78]) {
        const p = facadePosition(x, z, a, offset, .16);
        insets.push(matrixAt(p[0], 3.25, p[1], 1.3, 4.15, .07, a));
      }
      for (let j = 0; j < 5; j++) {
        const lx = -1.35 + j * .675;
        const p = facadePosition(x, z, a, lx, .18);
        tealLattice.push(matrixAt(p[0], 6.52, p[1], .045, 2.15, .055, a));
      }
      for (const y of [5.55, 6.55, 7.55]) {
        const p = facadePosition(x, z, a, 0, .18);
        goldLattice.push(matrixAt(p[0], y, p[1], 3.05, .045, .055, a));
      }
    }
    putInstances(group, unitBox, red, panels);
    putInstances(group, unitBox, redDark, insets);
    putInstances(group, unitBox, latticeTeal, tealLattice);
    putInstances(group, unitBox, gold, goldLattice);
    for (const offset of [-1.2, -.4, .4, 1.2]) {
      const x = offset, z = 9.75;
      box(group, redBright, x, 3.25, z, .72, 4.55, .13);
      box(group, redDark, x, 3.25, z + .085, .53, 3.95, .035);
    }
    box(group, gold, 0, 3.25, 9.86, .075, 4.8, .08);
    cylinder(group, paintedRound, 0, 8.72, 0, 9.62, 9.62, 1.25, 64);
    const roundBrackets = [];
    for (let i = 0; i < 32; i++) {
      const a = i * Math.PI * 2 / 32;
      roundBrackets.push(matrixAt(Math.sin(a) * 9.62, 9.38, Math.cos(a) * 9.62, 1, 1, 1, a));
    }
    addBrackets(group, roundBrackets);
    addRoundRoof(group, 13, 10.2, 19.25);
    cylinder(group, gold, 0, 19.55, 0, .12, .17, 1.0, 14);
    const lower = mesh(group, unitSphere, gold);
    lower.position.set(0, 20.05, 0);
    lower.scale.set(.53, .63, .53);
    const upper = mesh(group, unitSphere, gold);
    upper.position.set(0, 21.1, 0);
    upper.scale.set(.35, .48, .35);
    cylinder(group, gold, 0, 21.62, 0, .08, .16, .42, 12);
    const railPosts = [];
    for (let i = 0; i < 32; i++) {
      const a = i * Math.PI * 2 / 32;
      const delta = Math.min(a, Math.PI * 2 - a);
      if (delta > .23) railPosts.push([Math.sin(a) * 11.3, Math.cos(a) * 11.3]);
    }
    addPosts(group, railPosts, .72);
    torusArc(group, stone, 11.3, .095, 1.5, 0, 0, .23, Math.PI * 2 - .46);
    const wall = mesh(group, annulusWall(21.4, 22, 0, 3, .29), stone);
    wall.material = stone;
    mesh(group, annulusWall(21.83, 22.13, 3, 3.3, .29), navy);
    for (const side of [-1, 1]) {
      box(group, red, side * 1.72, 1.25, 21.45, .34, 2.5, .4);
      const gate = box(group, redBright, side * 1.33, 1.125, 21.2, 1.05, 2.25, .12, side * .55);
      gate.rotation.y = side * .55;
    }
    box(group, paintedRound, 0, 2.55, 21.45, 3.8, .52, .42);
    return group;
  }

  function buildAltar() {
    const group = new THREE.Group();
    group.name = "altar";
    const radii = [20, 17, 14];
    radii.forEach((radius, index) => cylinder(group, stone, 0, index * 2 + 1, 0, radius, radius + .08, 2, 96));
    for (const radius of [3, 5, 7, 9, 11]) {
      const ring = mesh(group, new THREE.TorusGeometry(radius, .065, 6, 96), stoneGrey);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 6.045;
    }
    cylinder(group, centralStone, 0, 6.09, 0, 2.42, 2.42, .18, 64);
    for (const radius of [1.35, 1.85]) {
      const ring = mesh(group, new THREE.TorusGeometry(radius, .045, 6, 64), stoneGrey);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 6.19;
    }
    const stairMatrices = [];
    for (let level = 0; level < 3; level++) {
      const radius = radii[level], lower = level * 2, outer = radius + 2.15, inner = radius - .65;
      for (let direction = 0; direction < 4; direction++) {
        const angle = direction * Math.PI / 2;
        for (let step = 0; step < 10; step++) {
          const distance = outer - (outer - inner) * (step + .5) / 10;
          const top = lower + (step + 1) * .2;
          stairMatrices.push(matrixAt(Math.sin(angle) * distance, lower + (top - lower) / 2, Math.cos(angle) * distance, 5.35, top - lower, (outer - inner) / 10 + .035, angle));
        }
      }
    }
    putInstances(group, unitBox, stone, stairMatrices);
    const reliefMatrices = [];
    for (let level = 0; level < 3; level++) {
      const radius = radii[level] + .055, y = level * 2 + 1;
      for (let i = 0; i < 48; i++) {
        const a = i * Math.PI * 2 / 48;
        reliefMatrices.push(matrixAt(Math.sin(a) * radius, y, Math.cos(a) * radius, .2, .43, .075, a));
      }
    }
    putInstances(group, unitOcta, stoneGrey, reliefMatrices);
    for (let level = 0; level < 3; level++) {
      const radius = radii[level] - .43, y = (level + 1) * 2, positions = [];
      for (let i = 0; i < 72; i++) {
        const a = i * Math.PI * 2 / 72;
        const m = a % (Math.PI / 2), distance = Math.min(m, Math.PI / 2 - m);
        if (distance >= .15) positions.push([Math.sin(a) * radius, Math.cos(a) * radius]);
      }
      addPosts(group, positions, y);
      for (const height of [.32, .8]) {
        for (let quadrant = 0; quadrant < 4; quadrant++) {
          const start = quadrant * Math.PI / 2 + .16;
          torusArc(group, stone, radius, .075, y + height, 0, 0, start, Math.PI / 2 - .32);
        }
      }
    }
    return group;
  }

  function buildImperialHall() {
    const group = new THREE.Group();
    group.name = "imperial-hall";
    box(group, stone, 0, .75, 0, 32, 1.5, 17);
    box(group, stoneGrey, 0, 1.48, 0, 31.5, .12, 16.5);
    const stairMatrices = [];
    for (let i = 0; i < 3; i++) {
      const top = 1.5 - i * .5;
      stairMatrices.push(matrixAt(0, top / 2, 8.45 + i * .48, 7, top, .53));
      stairMatrices.push(matrixAt(16.25 + i * .48, top / 2, 0, .53, top, 7));
      stairMatrices.push(matrixAt(-16.25 - i * .48, top / 2, 0, .53, top, 7));
    }
    putInstances(group, unitBox, stone, stairMatrices);
    addRectRailing(group, [
      { x: -9.75, z: 8.1, length: 11.5 }, { x: 9.75, z: 8.1, length: 11.5 },
      { x: 0, z: -8.1, length: 31 }, { x: 15.6, z: -5.5, length: 5, angle: Math.PI / 2 },
      { x: 15.6, z: 5.5, length: 5, angle: Math.PI / 2 }, { x: -15.6, z: -5.5, length: 5, angle: Math.PI / 2 },
      { x: -15.6, z: 5.5, length: 5, angle: Math.PI / 2 }
    ], 1.5);
    hallStructure(group, { width: 26, depth: 13, base: 1.62, eave: 11, bays: 5, sideBays: 3 });
    box(group, red, 0, 12.85, 0, 23, 2.25, 10.2);
    box(group, paintedTeal, 0, 14.2, 5.2, 23.4, .48, .16);
    addHipRoof(group, { width: 34, depth: 22, ridge: 15.05, eave: 11 });
    addHipRoof(group, { width: 29, depth: 18, ridge: 18.35, eave: 15 });
    return group;
  }

  function buildAbstinence() {
    const group = new THREE.Group();
    group.name = "abstinence";
    box(group, standard(0xc7c8c1, { roughness: .95 }), 0, .04, 0, 48, .08, 40);
    for (const z of [-19.1, 19.1]) box(group, stone, 0, .13, z, 46.6, .18, 1.05);
    for (const x of [-22.7, 22.7]) box(group, stone, x, .13, 0, 1.05, .18, 38.2);
    box(group, red, 0, 1.5, -20.7, 49.4, 3, .6);
    box(group, red, -24.7, 1.5, 0, .6, 3, 41.4);
    box(group, red, 24.7, 1.5, 0, .6, 3, 41.4);
    box(group, red, -14.6, 1.5, 20.7, 20.2, 3, .6);
    box(group, red, 14.6, 1.5, 20.7, 20.2, 3, .6);
    const wallCaps = [];
    for (let x = -24.4; x <= 24.4; x += .52) {
      if (Math.abs(x) > 4.8) wallCaps.push(matrixAt(x, 3.04, 20.7, 1.85, 1, 1, Math.PI / 2));
      wallCaps.push(matrixAt(x, 3.04, -20.7, 1.85, 1, 1, Math.PI / 2));
    }
    for (let z = -20.4; z <= 20.4; z += .52) {
      wallCaps.push(matrixAt(-24.7, 3.04, z, 1.85, 1, 1));
      wallCaps.push(matrixAt(24.7, 3.04, z, 1.85, 1, 1));
    }
    addTiles(group, wallCaps, [], [0x1d5144, 0x28634f, 0x2b6a53, 0x17473d]);
    const pavilion = new THREE.Group();
    pavilion.position.z = -7;
    group.add(pavilion);
    box(pavilion, stone, 0, .35, 0, 28, .7, 14.5);
    hallStructure(pavilion, { width: 26, depth: 13, base: .72, eave: 9.5, bays: 5, sideBays: 3 });
    addRectRailing(pavilion, [
      { x: -10, z: 6.9, length: 8 }, { x: 10, z: 6.9, length: 8 },
      { x: 0, z: -6.9, length: 27 }, { x: 13.7, z: -4.5, length: 4.5, angle: Math.PI / 2 },
      { x: 13.7, z: 4.5, length: 4.5, angle: Math.PI / 2 }, { x: -13.7, z: -4.5, length: 4.5, angle: Math.PI / 2 },
      { x: -13.7, z: 4.5, length: 4.5, angle: Math.PI / 2 }
    ], .7);
    const pavilionStairs = [];
    for (let i = 0; i < 3; i++) {
      const top = .7 - i * .23;
      pavilionStairs.push(matrixAt(0, top / 2, 7.2 + i * .4, 6.2, top, .44));
    }
    putInstances(pavilion, unitBox, stone, pavilionStairs);
    addHipRoof(pavilion, { width: 30, depth: 18, ridge: 16.35, eave: 9.5, greenRoof: true });
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 19, 0, -2);
      wing.rotation.y = Math.PI / 2;
      group.add(wing);
      box(wing, stone, 0, .22, 0, 23, .44, 8);
      hallStructure(wing, { width: 22, depth: 7, base: .47, eave: 5.7, bays: 6, sideBays: 2 });
      addHipRoof(wing, { width: 24, depth: 9, ridge: 7.95, eave: 5.7, greenRoof: true });
      box(wing, stone, 0, .23, 4.35, 5, .46, .8);
    }
    const gate = new THREE.Group();
    gate.position.z = 18.35;
    group.add(gate);
    for (const side of [-1, 1]) {
      cylinder(gate, red, side * 3.25, 3.25, 0, .38, .43, 6.5, 18);
      cylinder(gate, stone, side * 3.25, .17, 0, .58, .64, .34, 18);
      box(gate, red, side * 4.7, 2.2, 0, 2.8, 4.4, .42);
      box(gate, paintedTeal, side * 4.7, 4.55, .22, 2.9, .5, .12);
    }
    box(gate, red, 0, 6.15, 0, 7.3, .7, .6);
    box(gate, paintedTeal, 0, 6.52, .1, 7.5, .32, .18);
    addHipRoof(gate, { width: 11.5, depth: 5, ridge: 8.45, eave: 6.65, greenRoof: true });
    box(group, stone, 0, .22, 14.8, 7, .44, 1.2);
    return group;
  }

  function actualHeight(group) {
    group.updateMatrixWorld(true);
    let maximum = 0;
    group.traverse(object => {
      if (!object.isMesh || !object.geometry) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      if (object.isInstancedMesh) {
        for (let i = 0; i < object.count; i++) {
          const matrix = new THREE.Matrix4().fromArray(object.instanceMatrix.array, i * 16);
          const bounds = object.geometry.boundingBox.clone().applyMatrix4(matrix).applyMatrix4(object.matrixWorld);
          maximum = Math.max(maximum, bounds.max.y);
        }
      } else {
        const bounds = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
        maximum = Math.max(maximum, bounds.max.y);
      }
    });
    return Math.round(maximum * 1000) / 1000;
  }

  const landmarks = [
    { id: "vault", group: buildVault() },
    { id: "altar", group: buildAltar() },
    { id: "imperial-hall", group: buildImperialHall() },
    { id: "abstinence", group: buildAbstinence() }
  ];

  function batchRepeatedMeshes(group) {
    group.updateMatrixWorld(true);
    const localFromWorld = group.matrixWorld.clone().invert();
    const batches = new Map();
    group.traverse(object => {
      if (!object.isMesh || object.isInstancedMesh || Array.isArray(object.material)) return;
      const key = object.geometry.uuid + ':' + object.material.uuid;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(object);
    });
    for (const objects of batches.values()) {
      if (objects.length < 2) continue;
      const matrices = objects.map(object => new THREE.Matrix4().multiplyMatrices(localFromWorld, object.matrixWorld));
      putInstances(group, objects[0].geometry, objects[0].material, matrices);
      objects.forEach(object => object.removeFromParent());
    }
  }

  for (const landmark of landmarks) {
    batchRepeatedMeshes(landmark.group);
    landmark.group.userData.id = landmark.id;
    landmark.boundsHeight = actualHeight(landmark.group);
    landmark.group.traverse(object => {
      if (object.isMesh) stats.totalMeshes++;
    });
  }

  return { landmarks, stats };
}
