import assert from "node:assert/strict";
import * as THREE from "three";
import { Architecture } from "../src/architecture";
import { building, type Family } from "../src/archetypes";
import {
  empireState,
  chrysler,
  oneWorld,
  flatiron,
  rockefeller,
} from "../src/landmarks";
import { wallStreet40,pineStreet70,woolworth,leonard56 } from "../src/downtownLandmarks";
import { pointedArch } from "../src/chryslerArch";
const scene = new THREE.Scene(),
  kit = new Architecture(scene);
const families: Family[] = [
  "Art Deco",
  "Historic brick",
  "Glass tower",
  "Prewar residential",
  "Mixed use",
  "Sculptural",
  "Luxury residential", "Terraced", "Corner building", "Mid-century office",
];
families.forEach((family, i) => {
  for (let variant = 0; variant < 2; variant++) {
    kit.at(i * 2, 5 + variant * 2);
    building(kit, family, 0.9, 0.85, 2.2, variant);
  }
});
empireState(kit, -0.8, -1.5);
chrysler(kit, 1.8, -3.4);
oneWorld(kit, -1.3, 11);
flatiron(kit, -0.65, 1.7);
rockefeller(kit, -0.65, -5.7);
wallStreet40(kit,10,0);pineStreet70(kit,13,0);woolworth(kit,16,0);leonard56(kit,19,0);
kit.finish();
assert.equal(
  pointedArch(1, 0.5).holes.length,
  1,
  "Crown arches must have true cut-outs",
);
for (const family of families) assert.equal(kit.counts[family], 2);
let vertices = 0,
  instances = 0;
scene.traverse((obj) => {
  if (!(obj instanceof THREE.Mesh)) return;
  const position = obj.geometry.getAttribute("position");
  for (const value of position.array)
    assert.ok(Number.isFinite(value), "No invalid geometry coordinates");
  vertices += position.count;
  obj.geometry.computeBoundingBox();
  assert.ok(!obj.geometry.boundingBox!.isEmpty());
  if (obj instanceof THREE.InstancedMesh) {
    instances += obj.count;
    for (let i = 0; i < obj.count; i++) {
      const matrix = new THREE.Matrix4();
      obj.getMatrixAt(i, matrix);
      assert.ok(matrix.elements.every(Number.isFinite));
      assert.ok(
        Math.abs(matrix.determinant()) > 1e-12,
        "No singular instance transforms",
      );
    }
  }
});
assert.ok(vertices > 10000);
assert.ok(instances > 1000);
const camera = new THREE.PerspectiveCamera();
camera.position.set(5, 8, 10);
kit.update(0, camera);
const near = scene.children.filter((o) => o.visible).length;
assert.equal(kit.materials.crown.emissiveIntensity, 0);
camera.position.set(0, 1000, 0);
kit.update(1, camera);
assert.ok(
  scene.children.filter((o) => o.visible).length < near,
  "Micro-detail LOD must reduce visible batches at distance",
);
assert.ok(kit.materials.crown.emissiveIntensity > 0);
assert.ok(kit.materials.window.emissiveIntensity > kit.materials.windowCool.emissiveIntensity);
assert.ok(kit.materials.windowCool.emissiveIntensity > 0);
assert.notEqual(kit.materials.windowCool.emissive.getHex(),kit.materials.window.emissive.getHex());
console.log(
  JSON.stringify({
    status: "passed",
    families: families.length,
    landmarks: 9,
    vertices,
    instances,
    lod: "passed",
    nightMaterials: "passed",
  }),
);
