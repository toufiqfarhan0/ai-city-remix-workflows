import * as THREE from 'three';
import {createDetailedTemple} from './detailed-temple.js';
import {createMarbleBase} from './marble-base.js';
import {stoneMap,grassMap,skyDome,distantTrees,contactShadow} from './environment.js';
import {createParkSetting,parkLayout} from './park-setting.js';

const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
const mix=(a,b,u)=>a+(b-a)*u;
import {shots,duration,transition,landmarks} from './config.js';
export {shots};

// quality 'low' turns off antialiasing and halves the shadow map; geometry stays identical.
export function createShowcase({canvas,width=1920,height=1080,quality='high'}){
 const high=quality!=='low';
 const renderer=new THREE.WebGLRenderer({canvas,antialias:high,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.setSize(width,height,false);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x152139,.0008);
 const camera=new THREE.PerspectiveCamera(42,width/height,.2,2400);
 const sky=skyDome();scene.add(sky);
 const trees=distantTrees();trees.scale.set(3.5,1.4,3.5);scene.add(trees);
 const texture=stoneMap();texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.MeshStandardMaterial({color:0xc4c5ba,map:grassMap(),roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const shadow=contactShadow();shadow.position.z=-75;scene.add(shadow);
 const temple=createDetailedTemple(THREE),marble=createMarbleBase(THREE);
 temple.group.position.z=marble.group.position.z=-75;scene.add(temple.group,marble.group);
 const park=createParkSetting(texture);scene.add(park.group);
 // Keep full geometry throughout the film; bounds still cull off-camera instances.
 [temple.group,marble.group,park.group].forEach(group=>group.traverse(object=>{
  object.matrixAutoUpdate=false;object.updateMatrix();
  if(object.isInstancedMesh){object.computeBoundingBox();object.computeBoundingSphere();object.frustumCulled=true}
 }));
 const hemisphere=new THREE.HemisphereLight(0x9eb4d9,0x33333c,1.05);scene.add(hemisphere);
 const sun=new THREE.DirectionalLight(0xb7cdf0,1.7);sun.position.set(-160,260,210);sun.target.position.set(-20,0,5);sun.castShadow=true;
 sun.shadow.mapSize.set(high?4096:2048,high?4096:2048);Object.assign(sun.shadow.camera,{left:-230,right:230,top:230,bottom:-230,near:5,far:650});sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
 const warm=new THREE.DirectionalLight(0xffd3a2,1.35);warm.position.set(28,18,57);warm.target.position.set(0,19,0);scene.add(warm,warm.target);
 const rim=new THREE.DirectionalLight(0x6a8cce,1.05);rim.position.set(20,35,-45);scene.add(rim);
 const lamps=[];for(const [x,y,z] of [[0,18,-51],[0,9,-118],[0,10,95],[-93,9,65]]){const lamp=new THREE.PointLight(0xffc587,400,58,2);lamp.position.set(x,y,z);scene.add(lamp);lamps.push(lamp)}
 const colors={sky:[0x9eb4d9,0xc5e4ff],ground:[0x33333c,0x77715e],fog:[0x152139,0xa9cadb],sun:[0xb7cdf0,0xfff0d7],trees:[0x78828b,0xb4c09c]};
 Object.keys(colors).forEach(k=>colors[k]=colors[k].map(v=>new THREE.Color(v)));
 const target=new THREE.Vector3();
 let state={};
 function renderAt(time,overrides={}){
  const t=clamp(time,0,duration),index=shots.findIndex(s=>t<s.end),shot=shots[index<0?shots.length-1:index];
  let u=clamp((t-shot.start)/(shot.end-shot.start));
  if(shot===shots.at(-1))u=smooth(clamp((t-shot.start)/(shot.end-shot.start-.6)));
  const view={center:shot.center,yaw:mix(...shot.yaw,u),elev:mix(...shot.elev,u),distance:mix(...shot.distance,u),...overrides};
  const day=overrides.day??smooth((t-transition.start)/(transition.end-transition.start));
  const info=landmarks.find(l=>l.id===shot.id);
  return renderView(view,day,{t,index:shots.indexOf(shot),id:shot.id,preset:shot.preset,title:info.name,caption:info.detail});
 }
 function renderView(view,day,extra={}){
  day=clamp(day);const {yaw,elev,distance}=view;
  target.fromArray(view.center);const horizontal=distance*Math.cos(elev);
  camera.position.set(target.x+Math.sin(yaw)*horizontal,target.y+distance*Math.sin(elev),target.z+Math.cos(yaw)*horizontal);camera.lookAt(target);sky.position.copy(camera.position);
  sky.material.uniforms.day.value=day;sky.children[0].material.uniforms.day.value=day;
  trees.material.color.copy(colors.trees[0]).lerp(colors.trees[1],day);
  hemisphere.color.copy(colors.sky[0]).lerp(colors.sky[1],day);hemisphere.groundColor.copy(colors.ground[0]).lerp(colors.ground[1],day);hemisphere.intensity=1.05+.85*day;
  sun.color.copy(colors.sun[0]).lerp(colors.sun[1],day);sun.intensity=1.7+1.4*day;
  warm.intensity=1.35-1.1*day;rim.intensity=1.05-.7*day;lamps.forEach(l=>l.intensity=400*(1-day));
  scene.fog.color.copy(colors.fog[0]).lerp(colors.fog[1],day);scene.fog.density=.0008-.00035*day;renderer.toneMappingExposure=1.08+.03*day;park.fixtureMaterial.emissiveIntensity=1.2*(1-day);
  renderer.render(scene,camera);
  state={...extra,day,view:{...view,center:[...view.center]},position:camera.position.toArray(),target:target.toArray(),triangles:renderer.info.render.triangles};return state;
 }
 // Backing-store size in device pixels; the CSS size is set by the page layout.
 function resize(w,h){w=Math.max(2,Math.round(w));h=Math.max(2,Math.round(h));if(w===width&&h===height)return;width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=fovFor(w/h);camera.updateProjectionMatrix()}
 // Narrower frames than the 1212×730 stage keep its horizontal field of view (up to 80° vertical).
 function fovFor(aspect){const ref=1212/730;return aspect>=ref?42:Math.min(80,2*Math.atan(Math.tan(21*Math.PI/180)*ref/aspect)*180/Math.PI)}
 renderer.shadowMap.needsUpdate=true;renderAt(0);
 return {scene,camera,renderer,renderAt,renderView,resize,parkLayout,get size(){return {width,height}},get state(){return state}};
}
