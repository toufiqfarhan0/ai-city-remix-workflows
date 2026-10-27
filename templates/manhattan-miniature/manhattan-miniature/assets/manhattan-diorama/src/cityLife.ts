import * as THREE from "three";
import { vehicleModel, boatModel, type VehicleKind } from "./models";
import { type RoadNetwork, greenFor } from "./streets";
import { type WalkPath } from "./urbanEnvironment";
import { waveHeight } from "./waterMotion";
type Vehicle = {
  from: number;
  to: number;
  distance: number;
  speed: number;
  maxSpeed: number;
  position: THREE.Vector3;
  yaw: number;
  kind: VehicleKind;
  slot: number;
  length: number;
};
export function addCityLife(
  scene: THREE.Scene,
  network: RoadNetwork,
  walks: WalkPath[],
) {
  const bodyMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.56,
      metalness: 0.18,
      side: THREE.DoubleSide,
    }),
    headMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: "#fff0c2",
      emissiveIntensity: 0,
    }),
    tailMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: "#f15639",
      emissiveIntensity: 0,
    });
  const fleets = new Map<VehicleKind, THREE.InstancedMesh[]>(),
    vehicles: Vehicle[] = [],
    dummy = new THREE.Object3D();
  let seed = 93;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const kinds: VehicleKind[] = ["taxi", "car", "bus", "delivery"];
  for (const kind of kinds) {
    const count =
        kind === "taxi" ? 12 : kind === "car" ? 10 : kind === "bus" ? 3 : 4,
      parts = vehicleModel(kind),
      meshes = Object.entries(parts).map(([part, g]) => {
        const m = new THREE.InstancedMesh(
          g,
          part === "head"
            ? headMaterial
            : part === "tail"
              ? tailMaterial
              : bodyMaterial,
          count,
        );
        m.castShadow = part === "body";
        m.receiveShadow = true;
        m.frustumCulled = false;
        scene.add(m);
        return m;
      });
    fleets.set(kind, meshes);
    for (let i = 0; i < count; i++) {
      const edge =
        network.edges[
          (Math.floor(rand() * network.edges.length) + i) % network.edges.length
        ];
      if (!edge) continue;
      const reverse = i % 2 === 0,
        from = reverse ? edge.b : edge.a,
        to = reverse ? edge.a : edge.b,
        A = network.nodes[from],
        B = network.nodes[to];
      vehicles.push({
        from,
        to,
        distance: rand() * Math.hypot(B.x - A.x, B.z - A.z),
        speed: 0,
        maxSpeed: (kind === "bus" ? 0.18 : 0.22) + rand() * 0.08,
        position: new THREE.Vector3(A.x, 0.69, A.z),
        yaw: Math.atan2(-(B.x - A.x), -(B.z - A.z)),
        kind,
        slot: i,
        length: kind === "bus" ? 0.4 : kind === "delivery" ? 0.32 : 0.22,
      });
    }
  }
  const bridgeParts = vehicleModel("taxi"),
    bridgeCars = Object.entries(bridgeParts).map(([part, g]) => {
      const m = new THREE.InstancedMesh(
        g,
        part === "head"
          ? headMaterial
          : part === "tail"
            ? tailMaterial
            : bodyMaterial,
        4,
      );
      m.frustumCulled = false;
      scene.add(m);
      return m;
    });
  const beamGeometry = new THREE.PlaneGeometry(0.16, 0.6).rotateX(-Math.PI / 2);
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: "#ffdfa2",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beams = new THREE.InstancedMesh(
    beamGeometry,
    beamMaterial,
    vehicles.length + 4,
  );
  beams.frustumCulled = false;
  scene.add(beams);
  const personCount = Math.min(48, walks.length * 2),
    torso = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.04, 0.043, 0.024),
      new THREE.MeshStandardMaterial({ roughness: 1 }),
      personCount,
    ),
    heads = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.016, 7, 5),
      new THREE.MeshStandardMaterial({ color: "#caa882", roughness: 1 }),
      personCount,
    ),
    legs = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.011, 0.042, 0.012),
      new THREE.MeshStandardMaterial({ color: "#455f68", roughness: 1 }),
      personCount * 2,
    ),
    arms = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.009, 0.04, 0.01),
      new THREE.MeshStandardMaterial({ roughness: 1 }),
      personCount * 2,
    );
  const people = Array.from({ length: personCount }, (_, i) => ({
    route: walks[i % walks.length],
    progress: rand(),
    offset: rand() * 0.04 - 0.02,
    phase: rand() * 6.28,
    color: new THREE.Color(
      ["#bc7759", "#5f99a0", "#d6ae62", "#68836e", "#d3c9b2", "#a27b92"][i % 6],
    ),
  }));
  people.forEach((p, i) => {
    torso.setColorAt(i, p.color);
    arms.setColorAt(i * 2, p.color);
    arms.setColorAt(i * 2 + 1, p.color);
  });
  for (const m of [torso, heads, legs, arms]) {
    m.frustumCulled = false;
    scene.add(m);
  }
  const boatTypes = ["ferry", "water taxi", "sailboat"] as const,
    boats = boatTypes.map((type) => {
      const m = new THREE.Mesh(boatModel(type), bodyMaterial);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    });
  const wakeGeo = new THREE.BufferGeometry();
  wakeGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -0.02, 0, 0.18, -0.16, 0, 0.65, -0.11, 0, 0.61, 0.02, 0, 0.18, 0.11, 0,
        0.61, 0.16, 0, 0.65,
      ],
      3,
    ),
  );
  wakeGeo.computeVertexNormals();
  const wakeMaterial = new THREE.MeshBasicMaterial({
    color: "#d7e9d5",
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wakes = boats.map(() => {
    const m = new THREE.Mesh(wakeGeo, wakeMaterial);
    scene.add(m);
    return m;
  });
  function setModel(
    meshes: THREE.InstancedMesh[],
    slot: number,
    position: THREE.Vector3,
    yaw: number,
  ) {
    dummy.position.copy(position);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    for (const m of meshes) m.setMatrixAt(slot, dummy.matrix);
  }
  function headBeam(
    slot: number,
    p: THREE.Vector3,
    yaw: number,
    length: number,
  ) {
    dummy.position
      .copy(p)
      .add(
        new THREE.Vector3(0, 0, -length / 2 - 0.24).applyAxisAngle(
          THREE.Object3D.DEFAULT_UP,
          yaw,
        ),
      );
    dummy.position.y = p.y + 0.012;
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    beams.setMatrixAt(slot, dummy.matrix);
  }
  return {
    vehicles,
    boats,
    people,
    update(dt: number, time: number, night: number) {
      headMaterial.emissiveIntensity = night * 2.8;
      tailMaterial.emissiveIntensity = 0.1 + night * 2;
      beamMaterial.opacity = night * 0.11;
      wakeMaterial.opacity = 0.32 - night * 0.16;
      vehicles.forEach((v, index) => {
        const A = network.nodes[v.from],
          B = network.nodes[v.to],
          dx = B.x - A.x,
          dz = B.z - A.z,
          length = Math.hypot(dx, dz),
          remaining = length - v.distance,
          stopDistance=Math.min(.15,length*.35),
          green =
            B.neighbors.length < 3 || greenFor(B, Math.abs(dz) > Math.abs(dx), time);
        let target = v.maxSpeed;
        if (!green && remaining < 0.42)
          target = Math.min(target, Math.max(0, (remaining - stopDistance) * 1.6));
        for (const other of vehicles)
          if (
            other !== v &&
            other.from === v.from &&
            other.to === v.to &&
            other.distance > v.distance &&
            other.distance - v.distance < (v.length + other.length) / 2 + 0.13
          )
            target = 0;
        v.speed = THREE.MathUtils.damp(v.speed, target, 5, dt);
        v.distance += v.speed * dt;
        if (!green) v.distance = Math.min(v.distance, length - stopDistance);
        if (v.distance >= length - 0.002) {
          const options = B.neighbors.filter((n) => n !== v.from),
            next = (options.length ? options : B.neighbors)[
              Math.floor(rand() * (options.length || B.neighbors.length))
            ];
          if (next !== undefined) {
            v.from = v.to;
            v.to = next;
            v.distance = 0;
          }
        }
        const C = network.nodes[v.from],
          D = network.nodes[v.to],
          vx = D.x - C.x,
          vz = D.z - C.z,
          len = Math.hypot(vx, vz),
          lane = 0.048,
          t = Math.min(1, v.distance / len),
          desired = new THREE.Vector3(
            C.x + vx * t - (vz / len) * lane,
            0.662,
            C.z + vz * t + (vx / len) * lane,
          ),
          yaw = Math.atan2(-vx, -vz);
        if (time < 0.1) v.position.copy(desired);
        else v.position.lerp(desired, 1 - Math.exp(-dt * 12));
        const diff = Math.atan2(Math.sin(yaw - v.yaw), Math.cos(yaw - v.yaw));
        v.yaw += diff * (1 - Math.exp(-dt * 9));
        setModel(fleets.get(v.kind)!, v.slot, v.position, v.yaw);
        headBeam(index, v.position, v.yaw, v.length);
      });
      for (const meshes of fleets.values())
        for (const m of meshes) m.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < 4; i++) {
        const u = (time * 0.035 + i * 0.25) % 1,
          forward = u < 0.5,
          t = forward ? u * 2 : 2 - u * 2,
          p = new THREE.Vector3(
            2.85 + t * 4.65,
            0.999,
            [7.5, 9.7][i % 2] + (forward ? -0.11 : 0.11),
          ),
          yaw = forward ? -Math.PI / 2 : Math.PI / 2;
        setModel(bridgeCars, i, p, yaw);
        headBeam(vehicles.length + i, p, yaw, 0.22);
      }
      for (const m of bridgeCars) m.instanceMatrix.needsUpdate = true;
      beams.instanceMatrix.needsUpdate = true;
      people.forEach((p, i) => {
        const len = p.route.curve.getLength(),
          u = (p.progress + (time * p.route.speed) / len) % 2,
          t = u < 1 ? u : 2 - u,
          sign = u < 1 ? 1 : -1,
          pos = p.route.curve.getPoint(t),
          tangent = p.route.curve.getTangent(t).multiplyScalar(sign),
          yaw = Math.atan2(tangent.x, tangent.z),
          stride = Math.sin(time * 5 + p.phase) * 0.3;
        dummy.position.copy(pos).add(new THREE.Vector3(p.offset, 0.072, 0));
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        torso.setMatrixAt(i, dummy.matrix);
        dummy.position.y = pos.y + 0.111;
        dummy.updateMatrix();
        heads.setMatrixAt(i, dummy.matrix);
        for (const s of [-1, 1]) {
          dummy.position
            .copy(pos)
            .add(
              new THREE.Vector3(s * 0.01 + p.offset, 0.027, 0).applyAxisAngle(
                THREE.Object3D.DEFAULT_UP,
                yaw,
              ),
            );
          dummy.rotation.set(stride * s, yaw, 0);
          dummy.updateMatrix();
          legs.setMatrixAt(i * 2 + (s === 1 ? 1 : 0), dummy.matrix);
          dummy.position
            .copy(pos)
            .add(
              new THREE.Vector3(s * 0.025 + p.offset, 0.072, 0).applyAxisAngle(
                THREE.Object3D.DEFAULT_UP,
                yaw,
              ),
            );
          dummy.rotation.set(-stride * s, yaw, 0);
          dummy.updateMatrix();
          arms.setMatrixAt(i * 2 + (s === 1 ? 1 : 0), dummy.matrix);
        }
      });
      for (const m of [torso, heads, legs, arms])
        m.instanceMatrix.needsUpdate = true;
      boats.forEach((boat, i) => {
        const angle = time * (0.018 + i * 0.004) + i * 2.1,
          x = (i === 1 ? 5.55 : -5.65 - i * 0.45) + Math.cos(angle) * 0.43,
          z = (i === 1 ? -6 : 0) + Math.sin(angle) * (i === 1 ? 5.2 : 12),
          dx = -Math.sin(angle) * 0.43,
          dz = Math.cos(angle) * (i === 1 ? 5.2 : 12);
        boat.position.set(x, 0.29 + waveHeight(x, z, time), z);
        boat.rotation.set(
          Math.sin(time * 0.7 + i) * 0.015,
          Math.atan2(-dx, -dz),
          Math.cos(time * 0.6 + i) * 0.012,
        );
        wakes[i].position.copy(boat.position);
        wakes[i].position.y = 0.294;
        wakes[i].rotation.set(0, boat.rotation.y, 0);
        wakes[i].scale.set(
          1 + Math.sin(time + i) * 0.06,
          1,
          1 + Math.sin(time * 0.8 + i) * 0.08,
        );
      });
    },
  };
}
