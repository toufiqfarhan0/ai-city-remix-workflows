import assert from 'node:assert/strict';
import * as THREE from 'three';
import { planCity, inPolygon, vesselSite } from '../src/urbanPlan';
import { downtownSites } from '../src/downtownLandmarks';
import { buildVessel } from '../src/vessel';
const outline: [
    number,
    number
][] = [[-2.8, -16], [-3.9, -13], [-3.8, -9], [-3.6, -5], [-3.7, 0], [-3.5, 5], [-2.8, 9], [-2.5, 12], [-1.1, 15], [.1, 15.5], [1.1, 13.8], [2.6, 10], [3.4, 6], [3.5, 1], [3.8, -4], [4, -10], [3.8, -14], [2.8, -16]];
const icons = [{ x: -.8, z: -1.5, w: 1.8, d: 1.5 }, { x: 1.8, z: -3.4, w: 1.6, d: 1.4 }, { x: -1.3, z: 11, w: 1.5, d: 1.5 }, { x: -.65, z: 1.7, w: 1.4, d: 1.65 }, { x: -.65, z: -5.7, w: 2, d: 1.8 }, { x: .9, z: -4.9, w: .9, d: .9 }, ...downtownSites, { x: -2.7, z: -2.1, w: .7, d: .65 }, { x: -2.55, z: 1.55, w: .7, d: .75 }].map(b => ({ ...b, height: 0 }));
const p = planCity(icons, (x, z) => inPolygon(x, z, outline));
const seen = new Set<number>([0]), queue = [0];
while (queue.length) {
    for (const n of p.network.nodes[queue.shift()!].neighbors)
        if (!seen.has(n)) {
            seen.add(n);
            queue.push(n);
        }
}
assert.equal(seen.size, p.network.nodes.length, 'all road nodes reachable');
assert(p.parcels.length >= 80, 'sufficient coherent block parcels');
for (const icon of [...icons, vesselSite])
    assert(p.blocks.some(b => inPolygon(icon.x, icon.z, b.boundary)), 'each landmark belongs to a reserved or mixed block');
for (const lot of p.parcels) {
    const block = p.blocks.find(b => b.id === lot.blockId)!;
    assert(block);
    for (const sx of [-1, 1])
        for (const sz of [-1, 1])
            assert(inPolygon(lot.x + sx * lot.w / 2, lot.z + sz * lot.d / 2, block.boundary));
    for (const icon of icons)
        assert(!(Math.abs(lot.x - icon.x) < (lot.w + icon.w) / 2 && Math.abs(lot.z - icon.z) < (lot.d + icon.d) / 2));
}
for (let i = 0; i < p.parcels.length; i++)
    for (let j = i + 1; j < p.parcels.length; j++) {
        const a = p.parcels[i], b = p.parcels[j];
        assert(!(Math.abs(a.x - b.x) < (a.w + b.w) / 2 - .001 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - .001), 'parcels do not overlap');
    }
for (const e of p.network.edges) {
    const a = p.network.nodes[e.a], b = p.network.nodes[e.b];
    for (let i = 0; i <= 100; i++) {
        const t = i / 100, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        for (const lot of [...icons, ...p.parcels])
            assert(!(Math.abs(x - lot.x) < lot.w / 2 + (e.width ?? .24) / 2 && Math.abs(z - lot.z) < lot.d / 2 + (e.width ?? .24) / 2), 'road corridor clear of structures');
    }
}
const cross = (a: number[], b: number[]) => a[0] * b[1] - a[1] * b[0];
for (let i = 0; i < p.network.edges.length; i++)
    for (let j = i + 1; j < p.network.edges.length; j++) {
        const e = p.network.edges[i], f = p.network.edges[j];
        if ([e.a, e.b].some(n => n === f.a || n === f.b))
            continue;
        const a = p.network.nodes[e.a], b = p.network.nodes[e.b], c = p.network.nodes[f.a], d = p.network.nodes[f.b], r = [b.x - a.x, b.z - a.z], s = [d.x - c.x, d.z - c.z], q = [c.x - a.x, c.z - a.z], den = cross(r, s);
        if (Math.abs(den) < 1e-7)
            continue;
        const t = cross(q, s) / den, u = cross(q, r) / den;
        assert(!(t > 1e-5 && t < 1 - 1e-5 && u > 1e-5 && u < 1 - 1e-5), 'every crossing is a declared graph node');
    }
const scene = new THREE.Scene(), v = buildVessel(scene);
assert(v.stairs >= 100);
let hit = false;
const ray = new THREE.Raycaster(new THREE.Vector3(vesselSite.x, 3, vesselSite.z), new THREE.Vector3(0, -1, 0));
scene.updateMatrixWorld(true);
for (const h of ray.intersectObjects(scene.children, true))
    if (h.point.y > 1)
        hit = true;
assert(!hit, 'Vessel central void remains open');
console.log(JSON.stringify({ planning: 'pass', blocks: p.blocks.length, parcels: p.parcels.length, roads: p.network.edges.length, connectedNodes: seen.size, vesselStairs: v.stairs }));
