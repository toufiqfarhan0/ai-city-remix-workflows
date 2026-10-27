import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { Architecture } from '../src/architecture';
import { building,buildingVariants,type Family } from '../src/archetypes';
import { downtownSites,wallStreet40,pineStreet70,woolworth,leonard56 } from '../src/downtownLandmarks';
const models=[wallStreet40,pineStreet70,woolworth,leonard56];
const signatures:string[]=[];
function inspect(draw:(k:Architecture)=>void){
 const scene=new THREE.Scene(),kit=new Architecture(scene);draw(kit);kit.finish();
 const hash=createHash('sha256');let instances=0;const bounds=new THREE.Box3();
 scene.traverse(o=>{if(o instanceof THREE.Mesh){const a=o.geometry.getAttribute('position').array;hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));if(o instanceof THREE.InstancedMesh){hash.update(Buffer.from(o.instanceMatrix.array.buffer));instances+=o.count;}bounds.union(new THREE.Box3().setFromObject(o));}});
 assert.ok(bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite));
 for(const o of scene.children){if(o instanceof THREE.Mesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}}
 return {hash:hash.digest('hex'),bounds,instances};
}
for(let i=0;i<4;i++){
 const r=inspect(k=>models[i](k,0,0));signatures.push(r.hash);
 assert.ok(r.bounds.max.y>5.5&&r.bounds.max.y<9);
 assert.ok(r.bounds.max.x-r.bounds.min.x<=downtownSites[i].w+.12,`${downtownSites[i].name}: width ${r.bounds.max.x-r.bounds.min.x} vs envelope ${downtownSites[i].w}`);
 assert.ok(r.bounds.max.z-r.bounds.min.z<=downtownSites[i].d+.18,`${downtownSites[i].name}: depth ${r.bounds.max.z-r.bounds.min.z} vs envelope ${downtownSites[i].d}`);
 assert.ok(r.instances>100);
}
assert.equal(new Set(signatures).size,4,'Four landmarks must have different geometry');
const ordinary=Object.keys(buildingVariants)as Family[];
assert.equal(ordinary.length,10);
const geometries=ordinary.map(f=>inspect(k=>{k.at(0,0);building(k,f,.9,.85,2.5,0)}).hash);
assert.equal(new Set(geometries).size,10,'Archetypes differ geometrically, without using color in their signature');
assert.ok(downtownSites[3].z<downtownSites[2].z&&downtownSites[2].z<11&&11<downtownSites[0].z);
assert.ok(downtownSites[1].x>downtownSites[0].x);
for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const a=downtownSites[i],b=downtownSites[j];assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2||Math.abs(a.z-b.z)>=(a.d+b.d)/2)}
console.log(JSON.stringify({status:'passed',uniqueLandmarkGeometry:4,uniqueArchetypeGeometry:10,landmarkEnvelopes:'passed',neighborhoodOrder:'passed'}));
