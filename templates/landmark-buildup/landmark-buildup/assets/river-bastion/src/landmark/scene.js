// The Three.js scene: the assembled landmark, its site (river or ground), sky, sun, fill and floodlights.
// render(view, build, light) is stateless: the camera, the build progress and the light are its only inputs,
// so the live page, scrubbing and the film all draw the same frame for the same inputs.
import * as THREE from 'three'
import { createAssembly } from './assembly.js'
import { buildRecipe } from './kit.js'

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const hex = (s) => new THREE.Color(s)

function grainTexture(seed = 3) {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const img = g.createImageData(size, size)
  let a = seed
  const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296)
  for (let i = 0; i < size * size; i++) {
    const v = 214 + rnd() * 34 + (rnd() < 0.04 ? -40 : 0)
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v * 0.985
    img.data[i * 4 + 2] = v * 0.96
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

function skyDome() {
  const geo = new THREE.SphereGeometry(900, 32, 16)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, glow: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunDir; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.55));
      float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0); c += glow * pow(s, 18.0) * 0.8 + glow * pow(1.0 - h, 6.0) * 0.25;
      gl_FragColor = vec4(c, 1.0); }`,
  })
  return new THREE.Mesh(geo, mat)
}

// Light through the scene's single light value: 0 bright day, 0.55 golden hour, 1 dusk with floodlights.
const KEYS = [
  { t: 0, top: '#5d8fd0', hor: '#cfe1ee', glow: '#fff4dc', sun: '#fff7ea', sunI: 2.6, hemi: 1.1, elev: 0.95, az: 0.9, flood: 0, exposure: 1 },
  { t: 0.55, top: '#476fb3', hor: '#f3c38f', glow: '#ffb46a', sun: '#ffc68a', sunI: 2.2, hemi: 0.75, elev: 0.32, az: 1.25, flood: 0, exposure: 1.02 },
  { t: 1, top: '#141b3c', hor: '#5b4a73', glow: '#c06a5a', sun: '#ff9a64', sunI: 0.25, hemi: 0.4, elev: 0.04, az: 1.4, flood: 1, exposure: 1 },
]
export function lightAt(v) {
  const t = clamp(v)
  const i = t <= KEYS[1].t ? 0 : 1
  const a = KEYS[i], b = KEYS[i + 1]
  const k = clamp((t - a.t) / (b.t - a.t))
  const n = (x) => a[x] + (b[x] - a[x]) * k
  const c = (x) => hex(a[x]).lerp(hex(b[x]), k)
  return { top: c('top'), hor: c('hor'), glow: c('glow'), sun: c('sun'), sunI: n('sunI'), hemi: n('hemi'), elev: n('elev'), az: n('az'), flood: n('flood'), exposure: n('exposure') }
}

export function createScene({ canvas, recipe, width, height, quality = 'high' }) {
  const high = quality !== 'low'
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: high, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(1)
  renderer.setSize(width, height, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.3, 2400)
  const sky = skyDome()
  scene.add(sky)
  scene.fog = new THREE.Fog(0xcfe1ee, 160, 900)

  const pal = recipe.palette
  const grain = grainTexture(recipe.seed ?? 3)
  const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: hex(c), roughness: 0.86, metalness: 0, map: grain, ...extra })
  const materials = {
    stone: mat(pal.stone), trim: mat(pal.trim, { roughness: 0.78 }), mortar: mat(pal.mortar, { map: null, roughness: 1 }),
    accent: mat(pal.accent, { map: null, roughness: 0.6 }), dome: mat(pal.dome, { roughness: 0.7 }), roof: mat(pal.roof),
    void: new THREE.MeshStandardMaterial({ color: hex(pal.void), roughness: 1 }),
    iron: new THREE.MeshStandardMaterial({ color: hex(pal.iron ?? '#3d4146'), roughness: 0.45, metalness: 0.3, emissive: hex(pal.iron ?? '#3d4146'), emissiveIntensity: 0.12 }),
    copper: mat(pal.copper ?? '#6fa592', { roughness: 0.6, metalness: 0.2 }),
    gold: new THREE.MeshStandardMaterial({ color: hex(pal.gold ?? '#d9a94a'), roughness: 0.35, metalness: 0.8 }),
    flame: new THREE.MeshStandardMaterial({ color: hex(pal.flame ?? '#f2c45a'), emissive: hex(pal.flame ?? '#f2c45a'), emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3 }),
  }
  const built = buildRecipe(recipe)
  const assembly = createAssembly(built.pieces, materials)
  scene.add(assembly.group)

  // Site: open water with a quay behind, or plain ground.
  const water = recipe.site?.ground === 'water'
  const groundMat = new THREE.MeshStandardMaterial({ color: hex(water ? pal.water : pal.ground), roughness: water ? 0.5 : 0.95, metalness: 0 })
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 48), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = water ? -0.9 : -0.02
  ground.receiveShadow = true
  scene.add(ground)
  if (recipe.site?.ground === 'island') {
    // An island of lawn in open water.
    groundMat.color.copy(hex(pal.water))
    groundMat.roughness = 0.5
    ground.position.y = -0.9
    const island = new THREE.Mesh(new THREE.CylinderGeometry(recipe.site.radius ?? 60, (recipe.site.radius ?? 60) + 4, 1.2, 48), new THREE.MeshStandardMaterial({ color: hex(pal.ground), roughness: 0.95 }))
    island.position.y = -0.6
    island.receiveShadow = true
    scene.add(island)
  }
  if (water) {
    const quay = new THREE.Mesh(new THREE.BoxGeometry(1400, 2, 400), new THREE.MeshStandardMaterial({ color: hex(pal.ground), roughness: 0.95 }))
    quay.position.set(0, -0.2, -(recipe.site.radius ?? 30) - 200)
    quay.receiveShadow = true
    scene.add(quay)
  }

  const hemi = new THREE.HemisphereLight(0xdfe9f5, 0x5a5448, 1)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xffffff, 2.5)
  sun.castShadow = true
  sun.shadow.mapSize.set(high ? 4096 : 2048, high ? 4096 : 2048)
  const R = Math.max(built.bounds.radius + 8, built.bounds.maxY)
  Object.assign(sun.shadow.camera, { left: -R * 1.3, right: R * 1.3, top: R * 1.3, bottom: -R * 1.3, near: 1, far: 400 })
  sun.shadow.bias = -0.0002
  sun.shadow.normalBias = 0.03
  scene.add(sun, sun.target)
  // Floodlights at the foot of the walls, warm, aimed up; they come on at dusk.
  const floods = []
  for (const [x, z] of recipe.floodlights ?? [[-16, 14], [16, 14], [0, 20], [-14, -14], [14, -14]]) {
    const s = new THREE.SpotLight(0xffc98a, 0, 120, 0.7, 0.6, 1.2)
    s.position.set(x, 0.5, z)
    s.target.position.set(x * 0.15, built.bounds.maxY * 0.55, z * 0.15)
    scene.add(s, s.target)
    floods.push(s)
  }
  const fill = new THREE.DirectionalLight(0xbcd0ec, 0.5)
  fill.position.set(-60, 40, -50)
  scene.add(fill)

  const target = new THREE.Vector3()
  let lastBuild = -1, lastLight = -1, lastExplode = -1
  let state = {}
  function render(view, build, light, explode = 0) {
    const L = lightAt(light)
    sky.material.uniforms.top.value.copy(L.top)
    sky.material.uniforms.horizon.value.copy(L.hor)
    sky.material.uniforms.glow.value.copy(L.glow)
    const sd = new THREE.Vector3(Math.sin(L.az) * Math.cos(L.elev), Math.sin(L.elev), Math.cos(L.az) * Math.cos(L.elev))
    sky.material.uniforms.sunDir.value.copy(sd)
    scene.fog.color.copy(L.hor)
    hemi.intensity = L.hemi
    hemi.color.copy(L.top).lerp(new THREE.Color(0xffffff), 0.55)
    sun.color.copy(L.sun)
    sun.intensity = L.sunI
    sun.position.copy(sd).multiplyScalar(200)
    sun.target.position.set(0, built.bounds.maxY * 0.3, 0)
    for (const f of floods) f.intensity = 160 * L.flood
    fill.intensity = 0.5 * (1 - L.flood * 0.6)
    renderer.toneMappingExposure = L.exposure
    assembly.setBuild(build)
    assembly.setExplode(explode)
    materials.flame.emissiveIntensity = 0.6 + 2.4 * L.flood
    // Shadows only change when the build or the light does; camera moves reuse the map.
    if (build !== lastBuild || light !== lastLight || explode !== lastExplode) {
      renderer.shadowMap.needsUpdate = true
      lastBuild = build
      lastLight = light
      lastExplode = explode
    }
    target.fromArray(view.center)
    const hz = view.distance * Math.cos(view.elev)
    camera.position.set(target.x + Math.sin(view.yaw) * hz, target.y + view.distance * Math.sin(view.elev), target.z + Math.cos(view.yaw) * hz)
    camera.lookAt(target)
    sky.position.copy(camera.position)
    renderer.render(scene, camera)
    state = { build, light, explode, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls }
    return state
  }
  function resize(w, h) {
    w = Math.max(2, Math.round(w))
    h = Math.max(2, Math.round(h))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Narrow frames keep the horizontal field of a 16:9 frame (up to 70° vertical), so the whole landmark fits.
    const ref = 16 / 9
    camera.fov = camera.aspect >= ref ? 38 : Math.min(70, (2 * Math.atan(Math.tan((19 * Math.PI) / 180) * (ref / camera.aspect)) * 180) / Math.PI)
    camera.updateProjectionMatrix()
  }
  return { renderer, scene, camera, render, resize, built, assembly, get state() { return state } }
}
