// Draws the kit's pieces as instanced meshes, one per (shape, material). Every instance carries its schedule
// (start, duration, lift) as an instanced attribute; one shared uniform, uBuild (0–1), drives all of them on
// the GPU. The same displacement is patched into the shadow depth material, so a stone casts its shadow only
// where it is drawn. A piece that has not started is collapsed to nothing (no transparency, no fade).
import * as THREE from 'three'

const GEOMETRY = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  cyl: () => new THREE.CylinderGeometry(1, 1, 1, 14),
  ring: () => new THREE.CylinderGeometry(1, 1, 1, 12),
  dome: () => new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2),
  cone: () => new THREE.ConeGeometry(1, 1, 14),
}

const VERTEX_HEAD = `attribute vec3 aBuild;\nattribute vec3 aExplode;\nattribute float aCut;\nuniform float uBuild;\nuniform float uExplode;\n`
// Replaces three's project_vertex: collapse unstarted pieces, then drop each piece from `lift` metres above
// its seat in world space (after its instance transform), with a short settle as it lands.
const PROJECT = `
  float buildK = clamp((uBuild - aBuild.x) / max(aBuild.y, 1e-4), 0.0, 1.0);
  // Cutaway pieces slide off over a short window after the dismantle value passes their key, then vanish.
  float cutK = aCut < 0.0 ? 0.0 : clamp((uExplode - aCut) / 0.08, 0.0, 1.0);
  vec4 mvPosition = vec4(transformed * step(1e-4, buildK) * step(cutK, 0.999), 1.0);
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif
  float fall = 1.0 - buildK;
  mvPosition.y += aBuild.z * fall * fall * fall - aBuild.z * 0.025 * sin(buildK * 3.14159) * fall;
  // Exploded view: every piece slides along its own direction (shells off their frame).
  float ex = uExplode * uExplode * (3.0 - 2.0 * uExplode);
  mvPosition.xyz += aExplode * (aCut < 0.0 ? ex : cutK);
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;
`

function patch(material, uniforms, key) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBuild = uniforms.uBuild
    shader.uniforms.uExplode = uniforms.uExplode
    shader.vertexShader = VERTEX_HEAD + shader.vertexShader.replace('#include <project_vertex>', PROJECT)
  }
  material.customProgramCacheKey = () => `${key}-cut`
  return material
}

/** materials: { name: THREE.Material }. Returns { group, uniforms, setBuild(p), setExplode(v), meshes, count }. */
export function createAssembly(pieces, materials) {
  const uniforms = { uBuild: { value: 0 }, uExplode: { value: 0 } }
  const group = new THREE.Group()
  const buckets = new Map()
  for (const p of pieces) {
    const k = `${p.shape}|${p.mat}`
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k).push(p)
  }
  const m = new THREE.Matrix4(), bm = new THREE.Matrix4(), q = new THREE.Quaternion(), ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color()
  const meshes = []
  const base = new Map()
  for (const [k, list] of buckets) {
    const [shape, mat] = k.split('|')
    if (!base.has(mat)) {
      const src = materials[mat] ?? materials.stone
      const color = patch(src.clone(), uniforms, `buildup-color-${mat}`)
      const depth = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uniforms, 'buildup-depth')
      base.set(mat, { color, depth })
    }
    const { color, depth } = base.get(mat)
    const geo = GEOMETRY[shape]()
    const sched = new Float32Array(list.length * 3)
    const expl = new Float32Array(list.length * 3)
    const cuts = new Float32Array(list.length)
    const mesh = new THREE.InstancedMesh(geo, color, list.length)
    list.forEach((p, i) => {
      if (p.basis) {
        // Explicit local axes (x, y, z) for pieces laid along an arbitrary direction (a raised arm).
        bm.makeBasis(ax.fromArray(p.basis[0]).normalize(), ay.fromArray(p.basis[1]).normalize(), az.fromArray(p.basis[2]).normalize())
        q.setFromRotationMatrix(bm)
      } else {
        e.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0, 'YXZ')
        q.setFromEuler(e)
      }
      m.compose(v.set(...p.p), q, sc.set(...p.s))
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, col.setScalar(p.tint ?? 1))
      sched[i * 3] = p.start
      sched[i * 3 + 1] = p.dur
      sched[i * 3 + 2] = p.lift
      expl.set(p.ex ?? [0, 0, 0], i * 3)
      cuts[i] = p.cut ?? -1
    })
    geo.setAttribute('aBuild', new THREE.InstancedBufferAttribute(sched, 3))
    geo.setAttribute('aExplode', new THREE.InstancedBufferAttribute(expl, 3))
    geo.setAttribute('aCut', new THREE.InstancedBufferAttribute(cuts, 1))
    mesh.customDepthMaterial = depth
    mesh.castShadow = mat !== 'void'
    mesh.receiveShadow = true
    // Pieces move vertically before they land; keep the bounds generous so nothing is culled mid-fall.
    mesh.frustumCulled = false
    mesh.instanceMatrix.needsUpdate = true
    group.add(mesh)
    meshes.push(mesh)
  }
  return {
    group,
    uniforms,
    meshes,
    count: pieces.length,
    setBuild(p) {
      uniforms.uBuild.value = Math.max(0, Math.min(1, p))
    },
    setExplode(v) {
      uniforms.uExplode.value = Math.max(0, Math.min(1, v))
    },
  }
}
