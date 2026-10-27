// Three.js world shared by the live page and the film: island village, landmark, traffic, walkers,
// stars and one light value. Owns no render loop; the page (app.js) calls renderAt / renderView.
//
// renderAt(t) is the film state at t, a pure function of time. renderView(view, light, motion)
// renders a free camera at a light value with the moving parts at `motion` seconds.
import * as THREE from 'three';
import { buildLandmark } from './landmark.js';
import { buildVillage } from './village.js';
import { duration, filmLight, filmPoses, lightStops } from './config.js';

const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const quintic = (v) => v * v * v * (v * (v * 6 - 15) + 10);
const color = (c) => new THREE.Color(c);
export const PAPER = '#e8e9dd';
// The canvas background darkens from paper to a night blue after golden hour, so stars read at night.
const NIGHT_BG = '#26324a';

function palette(fog, key, sky, ground, si, hi, glow, star, exposure) {
  return { fog: color(fog), key: color(key), sky: color(sky), ground: color(ground), si, hi, glow, star, exposure };
}
// Day, golden hour and starlight are authored; blue hour is their midpoint, as in the film.
const DAY = palette('#e9dfc6', '#fff0ce', '#f4f7e8', '#a28e9e', 3, 2.2, 0.35, 0, 1.02);
const GOLDEN = palette('#edc9ae', '#ffd49a', '#ffedce', '#9581a6', 3.1, 2.25, 0.7, 0, 1.05);
const STARS = palette('#33425e', '#b4cbf5', '#a9c0e7', '#483953', 0.7, 1.25, 2.5, 0.9, 1.1);
function blend(a, b, t) {
  const o = {};
  for (const k in a) o[k] = a[k]?.isColor ? a[k].clone().lerp(b[k], t) : a[k] + (b[k] - a[k]) * t;
  return o;
}
const BLUE = blend(GOLDEN, STARS, 0.5);
const STOP_PALETTES = [DAY, GOLDEN, BLUE, STARS];

/** Palette at a light value in [0, 1], piecewise between the four stops. */
export function paletteAt(light) {
  const v = clamp(light, 0, 1);
  for (let i = 1; i < lightStops.length; i++) {
    const [, a] = lightStops[i - 1], [, b] = lightStops[i];
    if (v <= b) return blend(STOP_PALETTES[i - 1], STOP_PALETTES[i], (v - a) / (b - a));
  }
  return STOP_PALETTES.at(-1);
}
/** The film's light value at t: golden hour until 9 s, starlight from 21 s. */
export const filmLightAt = (t) => filmLight.from + (filmLight.to - filmLight.from) * smooth(filmLight.start, filmLight.end, t);

// quality 'low' turns off antialiasing and halves the shadow map; geometry stays identical.
export function createWorld({ canvas, width = 1190, height = 790, quality = 'high' }) {
  const high = quality !== 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: high, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(PAPER, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#edcfac', 240, 600);
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 800);
  const hemi = new THREE.HemisphereLight('#fff0d6', '#9c81a4', 2.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffdbab', 3.1);
  sun.position.set(-35, 65, 45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 45, bottom: -35, near: 1, far: 150 });
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.0003;
  sun.shadow.radius = 4;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#b9e7ef', 1.2);
  rim.position.set(36, 40, -45);
  scene.add(rim);

  const village = buildVillage(THREE);
  scene.add(village.group);
  const landmark = buildLandmark(THREE);
  scene.add(landmark.group);
  const villageGlass = village.group.getObjectByName('glass')?.material;
  if (villageGlass) villageGlass.emissive.set('#ffbf78');
  const pointFill = new THREE.PointLight('#ffc76a', 0, 28, 1.5);
  pointFill.position.set(0, 7, 12);
  scene.add(pointFill);

  // Cars and walkers follow the ring road; their position is a pure function of motion time.
  const carColors = ['#f4b942', '#2e7d32', '#f4f1ea', '#d89a32', '#b85c3a', '#245a78', '#2e7d32'];
  const carGeo = roundedUnit(THREE);
  const glassMat = new THREE.MeshStandardMaterial({ color: '#5a9fa9', roughness: 0.22, metalness: 0.15 });
  const headMat = new THREE.MeshStandardMaterial({ color: '#fff5c6', emissive: '#ffc66d', emissiveIntensity: 0.3 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#394650', roughness: 0.9 });
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  wheelGeo.rotateX(Math.PI / 2);
  const cars = [];
  for (let i = 0; i < 10; i++) {
    const group = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: carColors[i % carColors.length], roughness: 0.38 });
    const part = (mat, x, y, z, sx, sy, sz, geo = carGeo) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      group.add(m);
      return m;
    };
    part(body, 0, 0.42, 0, 1.5, 0.46, 0.86);
    part(glassMat, -0.12, 0.77, 0, 0.82, 0.44, 0.72);
    part(body, -0.12, 1.01, 0, 0.9, 0.14, 0.8);
    for (const z of [-0.26, 0.26]) part(headMat, 0.75, 0.45, z, 0.06, 0.17, 0.18);
    const wheels = [];
    for (const x of [-0.49, 0.49]) for (const z of [-0.44, 0.44]) wheels.push(part(wheelMat, x, 0.22, z, 0.34, 0.34, 0.19, wheelGeo));
    scene.add(group);
    cars.push({ group, wheels, dir: i % 2 ? 1 : -1, phase: i / 10, speed: 0.012 + (i % 3) * 0.0014 });
  }
  const road = village.roadCurve;
  const side = new THREE.Vector3();
  function updateTraffic(t) {
    for (const c of cars) {
      const f = (((c.phase + c.dir * t * c.speed) % 1) + 1) % 1;
      const p = road.getPointAt(f), tangent = road.getTangentAt(f);
      side.set(-tangent.z, 0, tangent.x).multiplyScalar(c.dir * 0.48);
      c.group.position.copy(p).add(side);
      c.group.rotation.y = Math.atan2(-tangent.z * c.dir, tangent.x * c.dir);
      for (const w of c.wheels) w.rotation.z = -c.dir * t * 5;
    }
  }
  const peopleN = 32;
  const people = new THREE.InstancedMesh(carGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), peopleN);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: '#e5b898', roughness: 0.8 }), peopleN);
  scene.add(people, heads);
  for (let i = 0; i < peopleN; i++) people.setColorAt(i, color(carColors[i % carColors.length]));
  const dummy = new THREE.Object3D();
  function updatePeople(t) {
    for (let i = 0; i < peopleN; i++) {
      const f = (((i / peopleN + t * 0.0018 * (i % 2 ? 1 : -1)) % 1) + 1) % 1;
      const p = road.getPointAt(f), v = road.getTangentAt(f);
      p.add(side.set(-v.z, 0, v.x).multiplyScalar(1.65));
      const bob = Math.sin(t * 6 + i) * 0.035;
      dummy.position.set(p.x, p.y + 0.45 + bob, p.z);
      dummy.scale.set(0.27, 0.55, 0.25);
      dummy.updateMatrix();
      people.setMatrixAt(i, dummy.matrix);
      dummy.position.y = p.y + 0.93 + bob;
      dummy.scale.set(0.34, 0.34, 0.34);
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
    }
    people.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  }

  let seed = 2048;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const starPositions = [];
  for (let i = 0; i < 110; i++) {
    const a = random() * Math.PI * 2, y = 0.35 + random() * 0.55, r = Math.sqrt(1 - y * y) * 200;
    starPositions.push(Math.cos(a) * r, y * 200, Math.sin(a) * r);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const paper = color(PAPER), nightBg = color(NIGHT_BG), bg = new THREE.Color();
  const starMat = new THREE.PointsMaterial({ color: '#fff2be', size: 1.4, transparent: true, opacity: 0, depthWrite: false, fog: false });
  scene.add(new THREE.Points(starGeo, starMat));

  let lanterns = true;
  function applyLight(light) {
    const p = paletteAt(light);
    scene.fog.color.copy(p.fog);
    sun.color.copy(p.key);
    sun.intensity = p.si;
    hemi.color.copy(p.sky);
    hemi.groundColor.copy(p.ground);
    hemi.intensity = p.hi;
    rim.intensity = 0.6 + p.hi * 0.25;
    starMat.opacity = p.star;
    renderer.setClearColor(bg.copy(paper).lerp(nightBg, smooth(1 / 3, 1, light)), 1);
    renderer.toneMappingExposure = p.exposure;
    headMat.emissiveIntensity = 0.2 + p.glow * 0.3;
    pointFill.intensity = lanterns ? p.glow * 12 : 0;
    if (villageGlass) villageGlass.emissiveIntensity = lanterns ? p.glow * 0.65 : 0;
    // userData.glowScale (default 1) lets a landmark make some glow brighter or dimmer than others.
    for (const m of landmark.lightingMaterials) m.emissiveIntensity = lanterns ? p.glow * (m.userData.glowScale ?? 1) : 0;
  }
  function animate(t) {
    updateTraffic(t);
    updatePeople(t);
    landmark.animate(t);
    village.animate(t);
  }

  const poses = filmPoses(landmark.views);
  const target = new THREE.Vector3();
  /** The film camera at t, as a free view { target, yaw, elev, distance }. */
  function filmView(t) {
    let i = 0;
    while (i < poses.length - 2 && t > poses[i + 1].t) i++;
    const a = poses[i], b = poses[i + 1];
    const u = quintic(clamp((t - a.t) / (b.t - a.t), 0, 1));
    const mix = (x, y) => x + (y - x) * u;
    return viewFrom(a.p.map((x, k) => mix(x, b.p[k])), a.aim.map((x, k) => mix(x, b.aim[k])));
  }

  let state = {};
  function renderView(view, light, motion = 0, extra = {}) {
    const { yaw, elev, distance } = view;
    target.fromArray(view.target);
    const h = distance * Math.cos(elev);
    camera.position.set(target.x + Math.sin(yaw) * h, target.y + distance * Math.sin(elev), target.z + Math.cos(yaw) * h);
    camera.lookAt(target);
    animate(motion);
    applyLight(light);
    renderer.render(scene, camera);
    state = { ...extra, light, motion, view: { ...view, target: [...view.target] }, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls };
    return state;
  }
  function renderAt(time) {
    const t = clamp(time, 0, duration);
    return renderView(filmView(t), filmLightAt(t), t, { t });
  }
  // Frames narrower than the 1190×790 stage keep its horizontal field of view, up to 62° vertical
  // (portrait phones crop the island's far corners instead of shrinking it).
  function fovFor(aspect) {
    const ref = 1190 / 790;
    return aspect >= ref ? 38 : Math.min(62, (2 * Math.atan((Math.tan((19 * Math.PI) / 180) * ref) / aspect) * 180) / Math.PI);
  }
  function resize(w, h) {
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = fovFor(w / h);
    camera.updateProjectionMatrix();
  }
  camera.fov = fovFor(width / height);
  camera.updateProjectionMatrix();

  return {
    scene, camera, renderer, renderAt, renderView, filmView, resize,
    setLanterns(on) { lanterns = !!on; },
    get lanterns() { return lanterns; },
    get state() { return state; },
    stats: { ...village.stats, ...landmark.stats, cars: cars.length, people: peopleN },
    views: landmark.views,
    hitTarget: landmark.hitTarget,
  };
}

/** A camera position and aim as a free view { target, yaw, elev, distance }. */
export function viewFrom(position, aim) {
  const dx = position[0] - aim[0], dy = position[1] - aim[1], dz = position[2] - aim[2];
  const distance = Math.hypot(dx, dy, dz);
  return { target: [...aim], yaw: Math.atan2(dx, dz), elev: Math.asin(dy / distance), distance };
}

function roundedUnit(THREE) {
  const s = new THREE.Shape(), a = 0.42, r = 0.09;
  s.moveTo(-a + r, -a);
  s.lineTo(a - r, -a);
  s.quadraticCurveTo(a, -a, a, -a + r);
  s.lineTo(a, a - r);
  s.quadraticCurveTo(a, a, a - r, a);
  s.lineTo(-a + r, a);
  s.quadraticCurveTo(-a, a, -a, a - r);
  s.lineTo(-a, -a + r);
  s.quadraticCurveTo(-a, -a, -a + r, -a);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.84, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, steps: 1, curveSegments: 3 });
  g.translate(0, 0, -0.42);
  g.computeVertexNormals();
  return g;
}
