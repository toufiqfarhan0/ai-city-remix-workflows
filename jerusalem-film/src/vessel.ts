import * as THREE from 'three';
import { Architecture } from './architecture';
import { vesselSite } from './urbanPlan';
/** Open stair basket: alternating radial landings, linked flights and six-sided apertures. */
export function buildVessel(scene: THREE.Scene) {
    const k = new Architecture(scene), { x, z } = vesselSite;
    k.at(x, z);
    k.box(0, -.014, 0, 1.68, .025, 1.9, '#d4c8b2');
    for (let i = 0; i < 12; i++)
        k.box(-.77 + i * .14, .003, 0, .006, .006, 1.85, '#b2a48e');
    const material = new THREE.MeshStandardMaterial({ color: '#b7794d', metalness: .87, roughness: .23 });
    const matrices: THREE.Matrix4[] = [], treads: THREE.Matrix4[] = [], obj = new THREE.Object3D();
    const link = (a: THREE.Vector3, b: THREE.Vector3, width = .029, depth = .072) => { obj.position.copy(a).add(b).multiplyScalar(.5); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); obj.scale.set(width, a.distanceTo(b), depth); obj.updateMatrix(); matrices.push(obj.matrix.clone()); };
    const levels = 9, sectors = 8, h = .14;
    const point = (level: number, i: number, off = 0) => { const a = (i + (level % 2) * .5) / sectors * Math.PI * 2, r = .23 + level * .055 + off; return new THREE.Vector3(Math.cos(a) * r, level * h + .08, Math.sin(a) * r); };
    for (let l = 0; l < levels; l++)
        for (let i = 0; i < sectors; i++) {
            const p = point(l, i - .06), q = point(l, i + .06);
            link(p, q, .035, .10);
            if (l === levels - 1)
                continue;
            for (const side of [-1, 1]) {
                const next = i + (l % 2 ? (side === 1 ? 1 : 0) : (side === 1 ? 0 : -1)), a = point(l, i + side * .06), b = point(l + 1, next - side * .06);
                link(a, b, .045, .105);
                for (let step = 0; step < 7; step++) {
                    const t = (step + .5) / 7, p = a.clone().lerp(b, t);
                    obj.position.copy(p);
                    obj.rotation.set(0, -Math.atan2(b.z - a.z, b.x - a.x), 0);
                    obj.scale.set(a.distanceTo(b) / 7 + .006, .012, .088);
                    obj.updateMatrix();
                    treads.push(obj.matrix.clone());
                }
                for (const off of [-.05, .05]) {
                    const aa = a.clone(), bb = b.clone();
                    aa.y += .085;
                    bb.y += .085;
                    const normal = new THREE.Vector3(b.z - a.z, 0, a.x - b.x).normalize().multiplyScalar(off);
                    aa.add(normal);
                    bb.add(normal);
                    link(aa, bb, .009, .009);
                }
            }
        }
    for (const [ms, mat] of [[matrices, material], [treads, new THREE.MeshStandardMaterial({ color: '#67594c', metalness: .55, roughness: .4 })]] as const) {
        const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, ms.length);
        ms.forEach((matrix, i) => m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, .69, z).multiply(matrix)));
        m.castShadow = true;
        m.receiveShadow = true;
        scene.add(m);
    }
    for (const sx of [-.71, .71])
        for (const zz of [-.77, .77]) {
            k.cylinder(sx, .05, zz, .105, .1, '#a49b80');
            k.cylinder(sx, .23, zz, .012, .3, '#78674e');
            k.cylinder(sx, .4, zz, .11, .23, '#7b9d68', 'stone', .08, 8);
            k.box(sx * .75, .09, zz, .21, .04, .07, '#9a7755');
        }
    k.finish();
    return { architecture: k, modules: levels * sectors, stairs: (levels - 1) * sectors * 2 };
}
