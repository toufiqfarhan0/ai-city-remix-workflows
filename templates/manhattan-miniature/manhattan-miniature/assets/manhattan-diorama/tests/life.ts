import assert from "node:assert/strict";
import * as THREE from "three";
import { makeRoadNetwork, occupied, greenFor } from "../src/streets";
import { addCityLife } from "../src/cityLife";
import { vehicleModel, boatModel } from "../src/models";
import { createCameraGuard } from "../src/cameraSafety";
import { waveHeight } from "../src/waterMotion";
import { buildingVariants } from "../src/archetypes";
const footprints = [
  { x: -1.1, z: -1.5, w: 1.8, d: 1.5, height: 8 },
  { x: 1.8, z: -3.4, w: 1.6, d: 1.4, height: 8 },
  { x: -1.3, z: 11, w: 1.5, d: 1.5, height: 9 },
];
const network = makeRoadNetwork(
  footprints,
  (x, z) => Math.abs(x) < 3.7 && Math.abs(z) < 15.5,
);
assert.ok(network.edges.length > 50);
for (const edge of network.edges) {
  const a = network.nodes[edge.a],
    b = network.nodes[edge.b];
  for (let i = 0; i <= 100; i++)
    assert.equal(
      occupied(
        a.x + ((b.x - a.x) * i) / 100,
        a.z + ((b.z - a.z) * i) / 100,
        footprints,
        0.149,
      ),
      false,
      "Roads must not cross expanded building footprints",
    );
}
assert.equal(new Set(Object.values(buildingVariants).flat()).size, 20);
for (const kind of ["taxi", "car", "bus", "delivery"] as const) {
  const model = vehicleModel(kind);
  assert.ok(model.body.getAttribute("position").count > 100);
  assert.ok(model.head && model.tail);
  for (const g of Object.values(model))
    for (const n of g.getAttribute("position").array)
      assert.ok(Number.isFinite(n));
}
for (const kind of ["ferry", "water taxi", "sailboat"] as const)
  assert.ok(boatModel(kind).getAttribute("position").count > 100);
const scene = new THREE.Scene(),
  walks = [
    {
      curve: new THREE.LineCurve3(
        new THREE.Vector3(-3, 0.7, 1),
        new THREE.Vector3(-3, 0.7, 3),
      ),
      speed: 0.05,
    },
  ],
  life = addCityLife(scene, network, walks);
let moved = 0,
  redStops = 0;
life.update(0.016, 0.016, 0);
const starts = life.vehicles.map((v) => v.position.clone());
for (let i = 1; i < 600; i++) {
  life.update(0.05, i * 0.05, i / 600);
  for (const v of life.vehicles) {
    assert.ok(v.position.toArray().every(Number.isFinite));
    assert.equal(
      occupied(v.position.x, v.position.z, footprints, 0.025),
      false,
    );
    const a = network.nodes[v.from],
      b = network.nodes[v.to],
      remaining = Math.hypot(b.x - a.x, b.z - a.z) - v.distance;
    if (
      b.neighbors.length >= 3 &&
      !greenFor(b, Math.abs(b.z - a.z) > 0.1, i * 0.05) &&
      remaining < 0.17 &&
      v.speed < 0.02
    )
      redStops++;
  }
}
life.vehicles.forEach((v, i) => {
  if (v.position.distanceTo(starts[i]) > 0.1) moved++;
});
assert.ok(moved > 10, "Traffic should travel along the network");
assert.equal(life.boats.length, 3);
assert.ok(redStops > 0, "Vehicles should actually stop at red signals");
assert.equal(greenFor({ x: 0, z: 0, neighbors: [], signal: 0 }, true, 2), true);
assert.equal(
  greenFor({ x: 0, z: 0, neighbors: [], signal: 0 }, false, 2),
  false,
);
for (let i = 0; i < 1000; i++)
  assert.ok(Math.abs(waveHeight(i * 0.17, -i * 0.13, i * 0.11)) <= 0.01200001);
const nearBox = new THREE.Box3(
    new THREE.Vector3(-1, 0, -1),
    new THREE.Vector3(1, 5, 1),
  ),
  farBox = new THREE.Box3(
    new THREE.Vector3(3, 0, -1),
    new THREE.Vector3(5, 5, 1),
  ),
  guard = createCameraGuard([farBox, nearBox]),
  position = new THREE.Vector3(8, 2, 0);
assert.equal(guard(new THREE.Vector3(-4, 2, 0), position), true);
assert.ok(
  position.x < -1,
  "Swept camera must stop at the nearest building, regardless of input order",
);
const inside = new THREE.Vector3(0, 2, 0);
guard(inside.clone(), inside);
assert.equal(nearBox.containsPoint(inside), false);
console.log(
  JSON.stringify({
    status: "passed",
    variants: 20,
    roadEdges: network.edges.length,
    vehicleModels: 4,
    movingVehicles: moved,
    boatModels: 3,
    redLightStops: redStops,
    cameraCollision: "passed",
    waveBound: "passed",
  }),
);
