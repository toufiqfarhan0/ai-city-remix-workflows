import {planCity,vesselSite,inPolygon} from './urbanPlan';
import {buildVessel} from './vessel';
import { wallStreet40, pineStreet70, woolworth, leonard56, downtownSites, neighborhoodViews } from "./downtownLandmarks";
import * as THREE from "three";
import { Architecture } from "./architecture";
import { collisionBoxes, type Footprint } from "./streets";
import { buildUrbanEnvironment } from "./urbanEnvironment";
import { addCityLife } from "./cityLife";
import { createCameraGuard } from "./cameraSafety";
import {
  empireState,
  chrysler,
  oneWorld,
  flatiron,
  rockefeller,
} from "./landmarks";
import { building, vanderbiltTower, type Family } from "./archetypes";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { QUALITY, type LandmarkId, type QualityTier } from "./config";

/** Landmark anchors in the bar's order; names, areas and texts are in i18n/strings.json. */
export const landmarks: { id: LandmarkId; x: number; z: number; y: number }[] = [
  { id: "empire", x: -0.8, z: -1.5, y: 9.1 },
  { id: "chrysler", x: 1.8, z: -3.4, y: 8.9 },
  { id: "one-world", x: -1.3, z: 11, y: 9.8 },
  { id: "central-park", x: 0, z: -9.8, y: 1 },
  { id: "times-square", x: -1.7, z: -4.4, y: 2.7 },
  { id: "flatiron", x: -0.65, z: 1.7, y: 3.3 },
  { id: "rockefeller", x: -0.65, z: -5.7, y: 5.9 },
  { id: "vessel", x: vesselSite.x, z: vesselSite.z, y: 2.2 },
];
/** Architectural views look at the whole shaft, not the building's ground point. */
export const landmarkViews = [
  { look: 4.7, offset: [9.5, 5.3, 13.5] },
  { look: 4.65, offset: [9.6, 5.1, 12.8] },
  { look: 5.1, offset: [-12.4, 6.65, 11.5] },
  { look: 1, offset: [7, 10, 9] },
  { look: 1.8, offset: [-10, 6, 4] },
  { look: 1.9, offset: [7.5, 7, -8] },
  { look: 3.1, offset: [-7, 3.5, -9] },
  { look: 1.4, offset: [-3.8, 2.5, 3.4] },
] as const;
type Batch = { matrix: THREE.Matrix4; color: THREE.Color }[];
export interface CityState {
  azimuth: number;
  polar: number;
  distance: number;
  target: [number, number, number];
  night: number;
  targetNight: 0 | 1;
  rotating: boolean;
  transition: boolean;
  cameraClear: boolean;
  time: number;
}
export interface CityFacts {
  roadEdges: number;
  vehicles: number;
  pedestrians: number;
  boats: number;
  triangles: number;
  drawCalls: number;
}
export type CityAPI = {
  /** Advances the simulation by dt seconds of virtual time and renders one frame. */
  tick: (dt: number) => void;
  state: () => CityState;
  facts: CityFacts;
  setNight: (value: boolean) => void;
  setRotate: (value: boolean) => void;
  reset: () => void;
  /** Jumps to the start of the cover: overview camera, daylight, no rotation, no flight. */
  home: () => void;
  focus: (i: number) => void;
  zoom: (factor: number) => void;
  orbitBy: (dTheta: number, dPhi: number) => void;
  panBy: (dx: number, dz: number) => void;
  screenshot: () => string;
  dispose: () => void;
};
export interface CityOptions {
  quality: QualityTier;
  /** Camera cuts and instant day/night instead of eased transitions. */
  reducedMotion: boolean;
  /** Starts the requestAnimationFrame loop; capture mode steps from outside instead. */
  live: boolean;
  /** Debug starting viewpoint (?view=). */
  view: string | null;
  /** Whether the full layout's left text column is shown, so the city shifts right. */
  viewOffset: () => boolean;
  /** Called after the first rendered frame. */
  onFrame: () => void;
}
export function createCity(
  container: HTMLDivElement,
  options: CityOptions,
): CityAPI {
  const tier = QUALITY[options.quality];
  const scene = new THREE.Scene();
  const dayBg = new THREE.Color("#e6ece8"),
    nightBg = new THREE.Color("#101b30");
  scene.background = dayBg.clone();
  scene.fog = new THREE.Fog(dayBg, 65, 135);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.pixelRatio));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.7;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(
    38,
    container.clientWidth / container.clientHeight,
    0.05,
    180,
  );
  const initial = new THREE.Vector3(31, 24, 39),
    initialTarget = new THREE.Vector3(0, 1, 0);
  const requestedView = options.view ? neighborhoodViews[options.view] : undefined;
  camera.position.copy(requestedView ? new THREE.Vector3().fromArray(requestedView.position) : initial);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(requestedView ? new THREE.Vector3().fromArray(requestedView.target) : initialTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 3.2;
  controls.maxDistance = 74;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = 0.02;
  controls.autoRotateSpeed = 0.48;
  controls.zoomSpeed = 0.7;
  controls.panSpeed = 0.65;
  controls.screenSpacePanning = false;
  controls.listenToKeyEvents(window);
  controls.keyPanSpeed = 20;
  const hemi = new THREE.HemisphereLight("#d9efff", "#a0a58a", 2.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff0ce", 4);
  sun.position.set(-12, 28, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadowMap, tier.shadowMap);
  Object.assign(sun.shadow.camera, {
    left: -24,
    right: 24,
    top: 25,
    bottom: -25,
    near: 1,
    far: 75,
  });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.0002;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#7aafff", 0.7);
  fill.position.set(18, 10, -12);
  scene.add(fill);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: "#e3e7dc", roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.15;
  ground.receiveShadow = true;
  scene.add(ground);
  let seed = 412;
  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function pick<T>(arr: T[]) {
    return arr[Math.floor(rand() * arr.length)];
  }
  const cube = new THREE.BoxGeometry(1, 1, 1),
    dummy = new THREE.Object3D();
  const solids: Batch = [];
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.72,
    metalness: 0.08,
  });
  const lampMat = new THREE.MeshStandardMaterial({
    color: "#ffead0",
    emissive: "#ffc77b",
    emissiveIntensity: 0,
  });
  function instance(
    batch: Batch,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: THREE.ColorRepresentation,
    rotation = 0,
  ) {
    dummy.position.set(x, y, z);
    dummy.scale.set(w, h, d);
    dummy.rotation.set(0, rotation, 0);
    dummy.updateMatrix();
    batch.push({ matrix: dummy.matrix.clone(), color: new THREE.Color(color) });
  }
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: THREE.ColorRepresentation,
  ) {
    instance(solids, x, y, z, w, h, d, color);
  }
  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  function rounded(
    w: number,
    d: number,
    r: number,
    depth: number,
    color: string,
    y: number,
  ) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -d / 2);
    s.lineTo(w / 2 - r, -d / 2);
    s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    s.lineTo(w / 2, d / 2 - r);
    s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    s.lineTo(-w / 2 + r, d / 2);
    s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
    s.lineTo(-w / 2, -d / 2 + r);
    s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.12,
      bevelThickness: 0.08,
      curveSegments: 12,
    });
    const m = mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.15,
      }),
      0,
      y,
      0,
    );
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  rounded(18, 35.5, 1.5, 0.65, "#c4c2ae", -0.7);
  rounded(18.1, 35.6, 1.5, 0.13, "#f4e9d0", -0.09);
  const waterMat = new THREE.MeshStandardMaterial({
    color: "#278f9c",
    metalness: 0.38,
    roughness: 0.3,
  });
  const water = rounded(17.9, 35.4, 1.4, 0.08, "#278f9c", 0.11);
  (water.material as THREE.Material).dispose();
  water.material = waterMat;
  // The long axis points north. Downtown narrows into Battery Park at the south tip.
  const outline = [
    [-2.8, -16],
    [-3.9, -13],
    [-3.8, -9],
    [-3.6, -5],
    [-3.7, 0],
    [-3.5, 5],
    [-2.8, 9],
    [-2.5, 12],
    [-1.1, 15],
    [0.1, 15.5],
    [1.1, 13.8],
    [2.6, 10],
    [3.4, 6],
    [3.5, 1],
    [3.8, -4],
    [4, -10],
    [3.8, -14],
    [2.8, -16],
  ];
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => (i ? shape.lineTo(x, z) : shape.moveTo(x, z)));
  shape.closePath();
  const land = mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.4,
      bevelEnabled: true,
      bevelSize: 0.12,
      bevelThickness: 0.1,
      bevelSegments: 2,
    }),
    new THREE.MeshStandardMaterial({ color: "#c8c5aa", roughness: 0.95 }),
    0,
    0.46,
    0,
  );
  land.rotation.x = Math.PI / 2;
  function inside(x: number, z: number) {
    let yes = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [xi, zi] = outline[i],
        [xj, zj] = outline[j];
      if (zi > z != zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi)
        yes = !yes;
    }
    return yes;
  }
  function park(x: number, z: number, w: number, d: number) {
    box(x, 0.6, z, w, 0.12, d, "#7e9c58");
  }
  park(0, -10.6, 3.2, 7.4);
  park(-0.6, 14.7, .9, .7);
  // Neighborhood lots, not random tower silhouettes. Keep sight lines around each icon.
  const architecture = new Architecture(scene);
  const buildingLots: {
    x: number;
    z: number;
    family: Family;
    height: number;
    variant:number;
    w: number;
    d: number;
  }[] = [];
  const familySequence: Partial<Record<Family, number>> = {};
  const landmarkLots = [
    { x: -0.8, z: -1.5, w: 1.8, d: 1.5 },
    { x: 1.8, z: -3.4, w: 1.6, d: 1.4 },
    { x: -1.3, z: 11, w: 1.5, d: 1.5 },
    { x: -0.65, z: 1.7, w: 1.4, d: 1.65 },
    { x: -0.65, z: -5.7, w: 2, d: 1.8 },
    { x: 0.9, z: -4.9, w: 0.9, d: 0.9 },
    ...downtownSites,
    {x:-2.7,z:-2.1,w:.7,d:.65},
    {x:-2.55,z:1.55,w:.7,d:.75},
  ];
  const urbanPlan=planCity(landmarkLots.map(l=>({...l,height:0})),inside);
  const midtownFamilies:Family[]=["Art Deco","Luxury residential","Glass tower","Historic brick","Terraced","Mid-century office","Mixed use","Prewar residential","Corner building","Sculptural"];
  urbanPlan.parcels.forEach((parcel,i)=>{
    const {x,z,w,d}=parcel;
    const choices:Family[]=parcel.neighborhood==='Hudson Yards'?["Glass tower","Luxury residential","Mid-century office"]:z>8?["Historic brick","Art Deco","Mixed use","Glass tower","Corner building"]:z>2?["Historic brick","Mixed use","Corner building","Terraced"]:z< -6.8?["Prewar residential","Historic brick","Corner building"]:midtownFamilies;
    const family=choices[i%choices.length];
    let height=z>8?1.1+rand()*1.5:z>2?.75+rand()*.65:z< -6.8?1+rand()*1.2:1.6+rand()*2;
    if(parcel.neighborhood==='Hudson Yards')height=2.5+rand()*1.4;
    if(family==='Historic brick'||family==='Corner building')height*=.8;
    architecture.at(x,z);
    const identity=familySequence[family]??0;familySequence[family]=identity+1;
    building(architecture,family,w,d,height,identity);
    buildingLots.push({...parcel,family,height:height+.65,variant:identity});
  });
  container.dataset.cityBlocks=JSON.stringify(urbanPlan.blocks);
  container.dataset.parcels=JSON.stringify(urbanPlan.parcels);
  container.dataset.landmarkPlacements=JSON.stringify([...landmarkLots,vesselSite].map(l=>({...l,blockId:urbanPlan.blocks.find(b=>inPolygon(l.x,l.z,b.boundary))?.id??null})));
  // Dedicated landmark massing is separate from all six ordinary architectural families.
  empireState(architecture, -0.8, -1.5);
  chrysler(architecture, 1.8, -3.4);
  oneWorld(architecture, -1.3, 11);
  flatiron(architecture, -0.65, 1.7);
  rockefeller(architecture, -0.65, -5.7);
  architecture.at(0.9, -4.9);
  vanderbiltTower(architecture, 0.85, 0.87, 5);
  wallStreet40(architecture,downtownSites[0].x,downtownSites[0].z);
  pineStreet70(architecture,downtownSites[1].x,downtownSites[1].z);
  woolworth(architecture,downtownSites[2].x,downtownSites[2].z);
  leonard56(architecture,downtownSites[3].x,downtownSites[3].z);
  for(const [i,lot]of landmarkLots.slice(-2).entries()){
    architecture.at(lot.x,lot.z);building(architecture,i===0?'Glass tower':'Luxury residential',lot.w,lot.d,i===0?3.7:3.1,i);
  }
  architecture.finish();
  const vessel=buildVessel(scene);
  container.dataset.architecture = JSON.stringify(architecture.counts);
  container.dataset.buildings = String(buildingLots.length + 13);
  container.dataset.buildingLots=JSON.stringify(buildingLots);
  container.dataset.midtownFamilies=JSON.stringify([...new Set(buildingLots.filter(l=>l.z>=-7&&l.z<.7).map(l=>l.family))]);
  // Times Square: colorful signage and emissive billboards.
  const signs: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 8; i++) {
    const sm = new THREE.MeshStandardMaterial({
      color: pick(["#e56c46", "#4cd5c0", "#e8b542", "#d45a8d"]),
      emissive: pick(["#ff6e3b", "#24daca", "#f2a140", "#e5439a"]),
      emissiveIntensity: 0.3,
    });
    signs.push(sm);
    mesh(
      new THREE.BoxGeometry(0.4, 0.23 + rand() * 0.24, 0.055),
      sm,
      -2.08 + (i % 2) * 0.36,
      1.1 + Math.floor(i / 2) * 0.49,
      -3.77,
    );
  }
  const footprints: Footprint[] = [
    ...buildingLots,
    ...landmarkLots.map((lot, i) => ({
      ...lot,
      height: i<6 ? [8.5, 8.2, 9.2, 2.7, 5.5, 5.4][i] : (downtownSites[i-6]?.height??4.3),
    })),
  ];
  const network = urbanPlan.network;
  container.dataset.streetNetwork=JSON.stringify(network);
  const environmentDetails = buildUrbanEnvironment(
    scene,
    network,
    footprints,
    outline,
  );
  const life = addCityLife(scene, network, environmentDetails.walks);
  const blockers = collisionBoxes(footprints).map(
    (b) =>
      new THREE.Box3(
        new THREE.Vector3(b.minX, b.minY, b.minZ),
        new THREE.Vector3(b.maxX, b.maxY, b.maxZ),
      ),
  );
  const cameraPrevious = camera.position.clone(),
    guardCamera = createCameraGuard(blockers);
  container.dataset.roadEdges = String(network.edges.length);
  container.dataset.vehicles = String(life.vehicles.length + 4);
  container.dataset.pedestrians = String(life.people.length);
  container.dataset.boats = String(life.boats.length);
  function makeBatch(
    batch: Batch,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    shadow = false,
  ) {
    const m = new THREE.InstancedMesh(geometry, material, batch.length);
    batch.forEach((item, i) => {
      m.setMatrixAt(i, item.matrix);
      m.setColorAt(i, item.color);
    });
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    m.instanceMatrix.needsUpdate = true;
    scene.add(m);
    return m;
  }
  makeBatch(solids, cube, mat, true);

  const facts: CityFacts = {
    roadEdges: network.edges.length,
    vehicles: life.vehicles.length + 4,
    pedestrians: life.people.length,
    boats: life.boats.length,
    triangles: 0,
    drawCalls: 0,
  };

  // Every clock below is virtual: tick(dt) advances simTime, so a capture stepped at 1/30 s and a
  // live page at any frame rate run the same simulation.
  const TRANSITION_SECONDS = options.reducedMotion ? 0 : 1.4;
  let night = 0,
    targetNight = 0,
    simTime = 0,
    frame = 0,
    frames = 0,
    disposed = false,
    cameraClear = true;
  let transition: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    targetFrom: THREE.Vector3;
    targetTo: THREE.Vector3;
    elapsed: number;
    arc: boolean;
    duration: number;
  } | null = null;
  controls.addEventListener("start", () => {
    transition = null;
  });
  const bg = dayBg.clone();
  let lastShadowTime = -1;
  const smooth = (v: number) => {
    const u = THREE.MathUtils.clamp(v, 0, 1);
    return u * u * (3 - 2 * u);
  };
  function applyTransition(dt: number) {
    if (!transition) return;
    transition.elapsed += dt;
    const t = transition.duration > 0 ? Math.min(transition.elapsed / transition.duration, 1) : 1,
      ease = t * t * (3 - 2 * t);
    camera.position.lerpVectors(transition.from, transition.to, ease);
    if (transition.arc && t < 1) {
      const clearance = Math.max(transition.from.y, transition.to.y,
        ...blockers.map(box => box.max.y + 2));
      camera.position.lerpVectors(transition.from, transition.to,
        smooth((t - 0.25) / 0.5));
      camera.position.y = t < 0.25
        ? THREE.MathUtils.lerp(transition.from.y, clearance, smooth(t / 0.25))
        : t > 0.75
          ? THREE.MathUtils.lerp(clearance, transition.to.y, smooth((t - 0.75) / 0.25))
          : clearance;
    }
    controls.target.lerpVectors(
      transition.targetFrom,
      transition.targetTo,
      ease,
    );
    if (t === 1) transition = null;
  }
  function tick(dt: number) {
    if (disposed) return;
    simTime += dt;
    night = options.reducedMotion ? targetNight : THREE.MathUtils.damp(night, targetNight, 1.8, dt);
    if (Math.abs(night - targetNight) < 1e-4) night = targetNight;
    bg.copy(dayBg).lerp(nightBg, night);
    scene.background = bg;
    (scene.fog as THREE.Fog).color.copy(bg);
    architecture.update(night, camera);
    vessel.architecture.update(night,camera);
    hemi.intensity = 1.35 - .7 * night;
    sun.intensity = 2.15 - 1.95 * night;
    sun.color.set("#fff0ce").lerp(new THREE.Color("#8eacff"), night);
    fill.intensity = 0.7 + night * 0.65;
    lampMat.emissiveIntensity = night * 5;
    signs.forEach((s) => (s.emissiveIntensity = 0.3 + night * 3));
    waterMat.color.set("#278f9c").lerp(new THREE.Color("#173e60"), night);
    (ground.material as THREE.MeshStandardMaterial).color
      .set("#e3e7dc")
      .lerp(new THREE.Color("#18243a"), night);
    renderer.toneMappingExposure = 1.02 + night * .03;
    scene.environmentIntensity = 0.7 - night * 0.36;
    environmentDetails.update(simTime, night, camera);
    life.update(dt, simTime, night);
    applyTransition(dt);
    controls.target.y = Math.max(0.6, controls.target.y);
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -10, 10);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -20, 20);
    controls.update(dt);
    if (guardCamera(cameraPrevious, camera.position)) transition = null;
    cameraPrevious.copy(camera.position);
    cameraClear = !blockers.some((box) => box.containsPoint(camera.position));
    if (lastShadowTime < 0 || simTime - lastShadowTime >= 1 / 12) {
      renderer.shadowMap.needsUpdate = true;
      lastShadowTime = simTime;
    }
    renderer.render(scene, camera);
    if (frames++ === 0) {
      // Static facts, from the first frame (default overview with its shadow pass).
      facts.triangles = renderer.info.render.triangles;
      facts.drawCalls = renderer.info.render.calls;
      options.onFrame();
    }
  }
  function resize() {
    const w = container.clientWidth,
      h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    if (options.viewOffset() && w > 850) camera.setViewOffset(w, h, -Math.min(130, w * .09), 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  // Live mode: frame-rate independent ticks from requestAnimationFrame (dt capped at 50 ms).
  let fpsCount = 0,
    fpsStart = -1,
    last = -1;
  function loop(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(loop);
    const dt = last < 0 ? 1 / 60 : Math.min((now - last) / 1000, 0.05);
    last = now;
    tick(dt);
    if (fpsStart < 0) fpsStart = now;
    fpsCount++;
    if (now - fpsStart > 2000) {
      container.dataset.fps = String(Math.round((fpsCount * 1000) / (now - fpsStart)));
      fpsCount = 0;
      fpsStart = now;
    }
  }
  if (options.live) frame = requestAnimationFrame(loop);
  /** Consumes pending user damping so OrbitControls cannot move the camera after a programmed move. */
  function settleControls() {
    const wasDamping = controls.enableDamping, wasRotating = controls.autoRotate;
    controls.autoRotate = false;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = wasDamping;
    controls.autoRotate = wasRotating;
  }
  function move(to: THREE.Vector3, target: THREE.Vector3, arc = false) {
    settleControls();
    if (arc) controls.autoRotate = false;
    transition = {
      from: camera.position.clone(),
      to,
      targetFrom: controls.target.clone(),
      targetTo: target,
      elapsed: 0,
      arc,
      duration: TRANSITION_SECONDS,
    };
    // Reduced motion: cut straight to the end state in the same call.
    if (TRANSITION_SECONDS === 0) {
      applyTransition(0);
      controls.update();
      cameraPrevious.copy(camera.position);
    }
  }
  const offset = new THREE.Vector3(),
    spherical = new THREE.Spherical();
  return {
    tick,
    facts,
    state: () => {
      spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
      return {
        azimuth: spherical.theta,
        polar: spherical.phi,
        distance: spherical.radius,
        target: controls.target.toArray() as [number, number, number],
        night,
        targetNight: targetNight as 0 | 1,
        rotating: controls.autoRotate,
        transition: transition !== null,
        cameraClear,
        time: simTime,
      };
    },
    setNight: (v) => {
      targetNight = v ? 1 : 0;
      if (options.reducedMotion) night = targetNight;
    },
    setRotate: (v) => (controls.autoRotate = v),
    reset: () => move(initial.clone(),initialTarget.clone(),true),
    home: () => {
      settleControls();
      transition = null;
      controls.autoRotate = false;
      camera.position.copy(initial);
      controls.target.copy(initialTarget);
      controls.update();
      cameraPrevious.copy(camera.position);
      targetNight = 0;
      night = 0;
    },
    focus: (i) => {
      const l = landmarks[i];
      const v = landmarkViews[i],
        target = new THREE.Vector3(l.x, v.look, l.z);
      move(
        target
          .clone()
          .add(new THREE.Vector3(...(v.offset as unknown as [number, number, number]))),
        target,
        true,
      );
    },
    zoom: (factor) => {
      const offset = camera.position.clone().sub(controls.target);
      offset.multiplyScalar(factor);
      offset.clampLength(3.2, 74);
      move(controls.target.clone().add(offset), controls.target.clone());
    },
    orbitBy: (dTheta, dPhi) => {
      settleControls();
      transition = null;
      spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
      spherical.theta += dTheta;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + dPhi, controls.minPolarAngle, controls.maxPolarAngle);
      camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
      controls.update();
      cameraPrevious.copy(camera.position);
    },
    panBy: (dx, dz) => {
      settleControls();
      transition = null;
      offset.set(dx, 0, dz);
      controls.target.add(offset);
      camera.position.add(offset);
      controls.update();
      cameraPrevious.copy(camera.position);
    },
    screenshot: () => {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      environment.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
  };
}
