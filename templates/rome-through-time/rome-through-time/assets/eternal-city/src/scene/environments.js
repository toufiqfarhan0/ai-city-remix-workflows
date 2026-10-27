import * as THREE from 'three';
import {group,box,cyl,mesh,roof,arch,column,tree,road,slab,statue,romanInsula,romanDomus,medievalHouse,medievalTower,romanesqueChurch,palazzo,baroqueChurch,modernBlock,palettes,batch} from './architecture.js';
export function createEnvironment(config){const p=palettes[config.id],root=group(null,`${config.id}-environment`),buildings=[],vehicles=[];const ground=group(root,`${config.id}-ground`);
// Four ground strips leave the same Forum basin open for era-specific ground levels.
for(const [x,z,w,d]of [[0,-9.3,30.5,5.8],[0,7.4,30.5,10.2],[-13.4,-2.3,3.7,8.2],[7.3,-2.3,15.4,8.2]])slab(ground,x,z,w,d,.04,p.ground);
for(const s of config.streets){road(ground,s.points,s.width,config.id==='modern'?'#70766e':config.id==='medieval'?'#baa984':'#d2c09b',.13);if(config.id==='modern'){road(ground,s.points,s.width+.4,'#d6cdb7',.08);for(let i=0;i<s.points.length-1;i++){const a=s.points[i],b=s.points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);for(let k=.3;k<len;k+=.85){const m=box(ground,a[0]+dx*k/len,.18,a[1]+dz*k/len,.035,.015,.35,'#e8dfc6');m.rotation.y=Math.atan2(dx,dz)}}}}
const generators={insula:romanInsula,domus:romanDomus,'stone-house':medievalHouse,tower:medievalTower,romanesque:romanesqueChurch,palazzo,'baroque-church':baroqueChurch,'italian-block':modernBlock,'preserved-church':baroqueChurch};
for(const spec of config.buildings){const obj=generators[spec.type](root,spec,p);obj.userData={kind:'building',id:spec.id,archetype:spec.type};buildings.push(obj)}
if(config.id==='imperial'){
 const portico=group(root,'imperial-north-colonnade',-5,.12,-6.3);for(let i=0;i<13;i++)column(portico,-4.1+i*.67,0,1.6,0);box(portico,0,1.7,0,8.9,.22,.65,p.trim);roof(portico,9.1,.9,1.82,p.roof);for(const [x,z]of [[-7,-6.4],[1.1,-1],[2.6,8.8]])statue(root,x,z,1.2);
 for(let i=0;i<7;i++){const stall=group(root,`market-${i}`,-11.5+i*.60,.15,-5.9);box(stall,0,.28,0,.5,.55,.45,'#ad8155');roof(stall,.65,.7,.7,i%2?'#ab4e35':'#d4b36e')}
 for(const [x,z]of [[-13,6],[-7,11],[2,-8],[12,9],[-3,10]])tree(root,x,z,.7,'olive',.12,p.green);
}else if(config.id==='medieval'){
 const gardens=[[-10,-4],[-8,-2],[-3,0],[1,6],[1.5,8],[-4,7],[-8,6],[6,-3],[12,7],[-1,-4],[3,-9]];for(const [x,z]of gardens){slab(root,x,z,.9,.7,.18,'#6e8050');for(let i=0;i<4;i++)box(root,x-.35+i*.23,.23,z,.07,.09,.65,'#8a9b62');tree(root,x+.5,z+.5,.65,'olive',.12,p.green)}
 for(let i=0;i<7;i++)tree(root,-5+i*.9,4.8+(i%2)*1.1,.85,'cypress',.7,p.green);
 // Reused masonry and timber fences articulate smaller medieval plots.
 for(let i=0;i<10;i++){box(root,-10+i*.45,.35,5.4,.35,.55,.25,'#9f9279');box(root,-9+i*.32,.38,-2.5,.06,.65,.06,'#786248')}
}else if(config.id==='baroque'){
 const piazza=group(root,'baroque-piazza',1.5,.12,-3.8);slab(piazza,0,0,4.4,3.2,.04,'#d6c49f');for(let i=0;i<7;i++)box(piazza,-1.8+i*.6,.11,0,.025,.02,3,'#ad9f82');cyl(piazza,0,.18,0,.82,.20,p.trim);cyl(piazza,0,.30,0,.66,.06,'#7e9c92');cyl(piazza,0,.75,0,.13,.9,p.trim);cyl(piazza,0,1.15,0,.42,.12,p.trim);statue(piazza,0,0,1.3);
 const garden=group(root,'palatine-formal-gardens',-1,.9,6.6);for(let x of [-2,0,2])for(let z of [-1,1]){slab(garden,x,z,1.5,1.3,.1,'#8b9662');for(let s of [-1,1])box(garden,x+s*.7,.24,z,.15,.3,1.3,'#627d48')}road(garden,[[-3.8,0],[3.8,0]],.45,'#d7c29d',.15);for(let i=0;i<8;i++)tree(root,-5+i*1.1,4.3,.85,'cypress',.5,p.green);
 for(const [x,z]of [[-13,7],[12,6],[-9,2],[2,-6]])tree(root,x,z,.8,'olive',.12,p.green);
}else{
 // Contemporary traffic remains separate from batched architecture so it can move.
 const traffic=group(root,'modern-traffic');for(let i=0;i<config.vehicles;i++){const bus=i===2||i===9,g=group(traffic,`vehicle-${i}`);const color=bus?'#a94432':['#e0d0ab','#516f7c','#ad5743','#d9b44e'][i%4];box(g,0,.21,0,bus?.49:.33,bus?.42:.27,bus?1.35:.61,color);box(g,0,.42,0,bus?.45:.29,.18,bus?1.1:.32,'#435d60');for(let side of [-1,1])for(let z of [-.22,.22]){const tire=mesh(g,new THREE.CylinderGeometry(.09,.09,.06,8),'#3d443b',side*(bus?.25:.18),.1,z);tire.rotation.z=Math.PI/2}g.position.set(i<8?13.65:-12+i*1.7,.2,i<8?-6+i*1.8:-8.2);if(i>=8)g.rotation.y=Math.PI/2;vehicles.push({g,index:i,bus})}
 for(let i=0;i<10;i++){const x=i<6?12.8:-12+(i-6)*5.5,z=i<6?-7+i*2.9:-7.1;const lamp=group(root,`streetlight-${i}`,x,.15,z);cyl(lamp,0,.9,0,.025,1.8,'#59645b');box(lamp,.16,1.8,0,.38,.055,.10,'#59645b');box(lamp,.28,1.76,0,.12,.04,.08,'#f6e7b8')}
 for(let i=0;i<2;i++){const g=group(root,`traffic-light-${i}`,12.7,.2,-7.2+i*14);cyl(g,0,.65,0,.035,1.3,'#485c50');box(g,0,1.3,0,.14,.4,.12,'#3f4c43');mesh(g,new THREE.SphereGeometry(.04,6,4),i?'#92ab6f':'#c66e4e',0,1.38,.075)}
 for(let i=0;i<7;i++){box(root,12.9+i*.17,.19,7.6,.09,.015,1.1,'#efe4ca');box(root,-10.7+i*.17,.19,-8.2,.09,.015,1.3,'#efe4ca')}
 for(let i=0;i<11;i++)tree(root,-13+i*2.6,-6.9,.75,'pine',.13,p.green);for(let i=0;i<8;i++)tree(root,12.2,-4+i*1.5,.7,'pine',.13,p.green);
 for(let i=0;i<6;i++){const b=group(root,`bench-${i}`,4.5+i*1.4,.22,7.3);box(b,0,.2,0,.65,.09,.22,'#8b7250');box(b,0,.36,-.1,.65,.22,.05,'#8b7250');for(let s of [-1,1])box(b,s*.23,.1,0,.05,.2,.20,'#5c6658')}
 for(let i=0;i<26;i++){const x=4.5+(i%10)*.75,z=6.7+Math.floor(i/10)*.4;const person=group(root,`visitor-${i}`,x,.2,z);cyl(person,0,.14,0,.045,.26,['#687d91','#ba6c53','#dbc99d'][i%3]);mesh(person,new THREE.SphereGeometry(.065,6,5),'#be9674',0,.34,0)}
 for(let i=0;i<20;i++){const x=3.5+i*.5;cyl(root,x,.46,7,.025,.7,'#6e776a')}road(root,[[3.5,7],[13,7]],.06,'#6e776a',.7);
}
// Preserve each building as a construction root while merging its internal geometry.
const details=group(root,`${config.id}-details`);for(const c of [...root.children])if(c.isMesh)details.add(c);for(const c of [...root.children])if(c.isGroup&&c.name!=='modern-traffic')batch(c);for(const {g}of vehicles)batch(g);
const growthRoots=[...root.children].filter(c=>c!==ground);for(const obj of growthRoots){obj.userData.baseY=obj.position.y;obj.userData.baseScaleY=obj.scale.y}
return {root,buildings,vehicles,growthRoots,ground};}
