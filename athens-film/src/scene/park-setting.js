import * as THREE from 'three';
import { createParkLandmarks } from './park-landmarks.js';

// Distances are compressed to make the five landmarks readable in one view.
export const parkLayout = [
  {id:'prayer',name:'Hall of Prayer',x:0,z:-75,height:43.1},
  {id:'imperial-hall',name:'Huangqian Hall',x:0,z:-135,height:19.08},
  {id:'vault',name:'Imperial Vault',x:0,z:75,height:21.83},
  {id:'altar',name:'Circular Mound Altar',x:0,z:145,height:6.94},
  {id:'abstinence',name:'Hall of Abstinence',x:-93,z:45,height:17.08}
];

export function createParkSetting(stoneTexture){
  const group=new THREE.Group();group.name='Park grounds';
  const buildings=createParkLandmarks(THREE);
  for(const landmark of buildings.landmarks){const p=parkLayout.find(p=>p.id===landmark.id);landmark.group.position.set(p.x,0,p.z);landmark.group.name=p.name;group.add(landmark.group)}
  const pavementTexture=stoneTexture.clone();pavementTexture.repeat.set(4,4);pavementTexture.needsUpdate=true;
  const stone=new THREE.MeshStandardMaterial({color:0xb4b1a4,map:pavementTexture,roughness:.94});
  const edge=new THREE.MeshStandardMaterial({color:0xa8a497,roughness:.9});
  const lawn=new THREE.MeshStandardMaterial({color:0x3c5138,roughness:1});
  function box(x,z,w,d,material=stone,height=.14){const m=new THREE.Mesh(new THREE.BoxGeometry(w,height,d),material);m.position.set(x,height/2-.02,z);m.receiveShadow=true;group.add(m);return m}
  function circle(x,z,r){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.12,112),stone);mesh.position.set(x,.02,z);mesh.receiveShadow=true;group.add(mesh)}
  // Ceremonial platforms and their forecourts.
  circle(0,-75,39);box(0,-135,49,39);circle(0,75,28);circle(0,145,29);box(-93,45,61,53);
  // The broad central path links the prayer precinct to the southern altars.
  box(0,10,18,94);box(0,-110,13,28);box(0,110,16,34);box(-48,45,80,10);
  box(0,185,18,29);box(0,-165,14,23);
  for(const x of [-9.5,9.5])box(x,10,.7,94,edge,.22);
  const fixtureMaterial=new THREE.MeshStandardMaterial({color:0xf0d2a0,emissive:0xffbf78,emissiveIntensity:1,roughness:.6});
  const fixturePosts=new THREE.InstancedMesh(new THREE.BoxGeometry(.28,.75,.28),new THREE.MeshStandardMaterial({color:0x303a38,roughness:.8}),18);
  const fixtureHeads=new THREE.InstancedMesh(new THREE.BoxGeometry(.22,.22,.22),fixtureMaterial,18);
  const fixtureTransform=new THREE.Object3D();let fixtureIndex=0;
  for(let z=-30;z<=50;z+=10)for(const x of [-10.2,10.2]){fixtureTransform.position.set(x,.375,z);fixtureTransform.updateMatrix();fixturePosts.setMatrixAt(fixtureIndex,fixtureTransform.matrix);fixtureTransform.position.y=.72;fixtureTransform.updateMatrix();fixtureHeads.setMatrixAt(fixtureIndex++,fixtureTransform.matrix)}
  group.add(fixturePosts,fixtureHeads);
  box(-38,-5,48,85,lawn,.16);box(38,-5,48,85,lawn,.16);
  box(54,104,37,117,lawn,.16);box(-52,127,35,87,lawn,.16);
  // Low red precinct walls leave the axis and courtyard entrances open.
  const wall=new THREE.MeshStandardMaterial({color:0x7f2925,roughness:.88});
  const cap=new THREE.MeshStandardMaterial({color:0x253844,roughness:.72});
  function wallSegment(x,z,w,d){box(x,z,w,d,wall,2.1);const top=box(x,z,w+.2,d+.2,cap,.26);top.position.y=2.13}
  wallSegment(-45,-100,.7,101);wallSegment(45,-100,.7,101);wallSegment(0,-151,90,.7);
  wallSegment(-28,-49,34,.7);wallSegment(28,-49,34,.7);
  // Repeated cypress groves stay clear of the landmark footprints and sightlines.
  let seed=1827;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const positions=[];
  for(const side of [-1,1])for(let z=-170;z<205;z+=13){positions.push([side*78+(random()-.5)*7,z+(random()-.5)*5]);positions.push([side*145+(random()-.5)*7,z+(random()-.5)*5])}
  for(let z=-165;z<200;z+=20)for(const x of [-34,34])positions.push([x,z]);
  const safe=positions.filter(([x,z])=>!parkLayout.some(p=>Math.abs(x-p.x)<(p.id==='abstinence'?37:46)&&Math.abs(z-p.z)<(p.id==='prayer'?48:38)));
  const bark=new THREE.MeshStandardMaterial({color:0x544638,roughness:1}),leaf=new THREE.MeshStandardMaterial({color:0x203d2d,roughness:.98});
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.25,.43,4,6),bark,safe.length);
  const crowns=new THREE.InstancedMesh(new THREE.SphereGeometry(1,9,7),leaf,safe.length*3);const object=new THREE.Object3D();
  safe.forEach(([x,z],i)=>{const h=6+random()*4;object.position.set(x,2,z);object.scale.set(1,1,1);object.updateMatrix();trunks.setMatrixAt(i,object.matrix);for(let j=0;j<3;j++){object.position.set(x+(random()-.5)*2,h*.6+j*1.5,z+(random()-.5)*2);object.scale.set(2.3-j*.35,h*.43,2.2-j*.3);object.updateMatrix();crowns.setMatrixAt(i*3+j,object.matrix)}});
  trunks.castShadow=crowns.castShadow=true;trunks.receiveShadow=crowns.receiveShadow=true;group.add(trunks,crowns);
  return {group,landmarks:buildings.landmarks,stats:buildings.stats,fixtureMaterial};
}
