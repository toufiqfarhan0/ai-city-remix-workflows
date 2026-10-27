import * as THREE from 'three';
import { Architecture, rect, clipped, type Point } from './architecture';
import { loft } from './archetypes';

export const downtownSites = [
 {id:'40-wall',name:'40 Wall Street',x:.05,z:13.15,w:1.12,d:1.02,height:6.85},
 {id:'70-pine',name:'70 Pine Street',x:1.4,z:11.75,w:.9,d:.95,height:7.05},
 {id:'woolworth',name:'Woolworth Building',x:.25,z:8.7,w:1.34,d:1.36,height:6.05},
 {id:'56-leonard',name:'56 Leonard Street',x:-1.9,z:6.55,w:1.8,d:1.14,height:5.45},
] as const;
export const neighborhoodViews:Record<string,{position:number[];target:number[]}>= {
 topdown:{position:[0,66,.9],target:[0,0,.8]},
 vessel:{position:[-6.45,3.9,2.85],target:[-2.65,1.4,-.55]},
 'vessel-east':{position:[.5,3.5,-.3],target:[-2.65,1.4,-.55]},
 'vessel-top':{position:[-2.65,6,-.3],target:[-2.65,.9,-.55]},
 '40-wall':{position:[8.8,8.3,23],target:[.05,4.2,13.15]},
 '70-pine':{position:[11.8,8.4,18.8],target:[1.4,4.3,11.75]},
 woolworth:{position:[8.8,7.5,4.8],target:[.25,3.7,8.7]},
 '56-leonard':{position:[-10.4,6.8,13.4],target:[-1.9,3.4,6.55]},
 lower:{position:[13,13,23],target:[-.2,3.6,10]},
 midtown:{position:[16,11,6],target:[0,3,-3.3]},
};
function shaft(k:Architecture,w:number,d:number,b:number,h:number,color:string,spacing=.15){
 const p=clipped(w,d,.045); k.solid(p,b,h,color);k.windows(p,b+.025,h,'deco',spacing,.22);k.band(p,b+h,.035,.05,'#e9d9b5');return p;
}
function pyramid(k:Architecture,w:number,d:number,b:number,h:number,color:string){
 const base=rect(w,d),tip=rect(.018,.018);loft(k,base,tip,b,h,color,'copper');
 for(const [x,z] of base)k.beam(new THREE.Vector3(x,b,z),new THREE.Vector3(0,b+h,0),.009,'#356e60','copper');
 for(let i=1;i<6;i++){const t=i/6;k.band(rect(w*(1-t),d*(1-t)),b+h*t,.009,.012,'#478a74','copper')}
}
export function wallStreet40(k:Architecture,x:number,z:number){
 k.at(x,z);k.facade('#466d75','#66563e','warm');
 // Broad banking base, progressively narrower shoulders and a true four-sided copper pyramid.
 shaft(k,1.1,.96,0,.7,'#d8b88a',.21);
 shaft(k,1.02,.88,.7,.65,'#d8b88a',.18);
 shaft(k,.86,.76,1.35,.55,'#e9d9b5');
 shaft(k,.66,.63,1.9,2.9,'#d3b387',.13);
 shaft(k,.55,.53,4.8,.55,'#e9d9b5',.12);
 shaft(k,.47,.46,5.35,.35,'#d8b88a',.12);
 k.band(rect(.55,.54),5.7,.03,.065,'#d9b875','metal');
 pyramid(k,.59,.57,5.73,.82,'#3f8b70');
 k.solid(rect(.12,.12),6.55,.08,'#487c66','copper');
 k.cylinder(0,6.74,0,.018,.25,'#c2a365','accent',.002,8);
 for(const s of [-1,1]){k.box(s*.45,.43,.49,.055,.65,.08,'#b79a70');k.box(s*.45,.78,.49,.12,.07,.12,'#e9d9b5')}
 k.box(0,.27,.5,.22,.43,.035,'#426270','windowSoft');
 k.count('40 Wall Street landmark');
}
export function pineStreet70(k:Architecture,x:number,z:number){
 k.at(x,z);k.facade('#4a727a','#73634c','soft');
 const tiers=[[.88,.9,0,.65],[.79,.81,.65,.65],[.67,.7,1.3,2.4],[.56,.58,3.7,.8],[.47,.49,4.5,.55],[.37,.39,5.05,.45],[.28,.3,5.5,.34]];
 for(const[w,d,b,h]of tiers)shaft(k,w,d,b,h,b<1.3?'#c6a27b':'#dec99f',.12);
 // An octagonal glazed lantern and radiating fins distinguish Pine from Wall Street's green roof.
 k.cylinder(0,6.01,0,.18,.34,'#b7b695','stone',.13,8);
 k.cylinder(0,6.08,0,.128,.31,'#5d9ba6','windowSoft',.108,8);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,xx=Math.cos(a)*.15,zz=Math.sin(a)*.15;k.box(xx,6.04,zz,.027,.49,.027,'#e9d9b5');k.cylinder(xx,6.3,zz,.024,.12,'#d9b875','accent',.005,4)}
 k.cylinder(0,6.36,0,.125,.24,'#d6c79e','metal',.035,8);
 k.cylinder(0,6.74,0,.022,.6,'#d9c9a5','accent',.003,8);
 for(const s of[-1,1])k.box(s*.25,3.1,-.33,.03,3.35,.055,'#c9b17e');
 k.count('70 Pine Street landmark');
}
function gothicArch(k:Architecture,x:number,y:number,z:number,w:number,h:number,angle:number){
 const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(-w/2,h*.63);s.quadraticCurveTo(-w*.45,h*.87,0,h);s.quadraticCurveTo(w*.45,h*.87,w/2,h*.63);s.lineTo(w/2,0);s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth:.018,bevelEnabled:false,curveSegments:6});g.rotateY(angle);k.geometry(g,'#4d8091','windowSoft',x,y,z);
 const pts=s.getPoints(8).map(p=>new THREE.Vector3(p.x,p.y,.025).applyAxisAngle(THREE.Object3D.DEFAULT_UP,angle).add(new THREE.Vector3(x,y,z)));
 for(let i=1;i<pts.length;i++)k.beam(pts[i-1],pts[i],.009,'#e9d9b5','stone');
 const a=new THREE.Vector3(0,0,.03).applyAxisAngle(THREE.Object3D.DEFAULT_UP,angle).add(new THREE.Vector3(x,y,z));
 k.beam(a,a.clone().add(new THREE.Vector3(0,h*.84,0)),.007,'#cab283','stone');
}
export function woolworth(k:Architecture,x:number,z:number){
 k.at(x,z);k.facade('#4b7683','#9c855f','soft');
 // The lower wings and a slender buttressed tower form a Gothic composition, not an Art Deco stack.
 const base=rect(1.16,1.18);k.solid(base,0,1.4,'#d5bd92');k.windows(base,.3,1.05,'historic',.18,.25);k.band(base,1.4,.055,.12,'#e9d9b5');
 for(const side of[-1,1]){const p=rect(.24,1.15).map(([a,b])=>[a+side*.46,b]as Point);k.solid(p,1.4,.38,'#d8b88a');pyramidAt(k,side*.46,0,.27,1.16,1.78,.25,'#5c9b85')}
 const tower=rect(.66,.72);k.solid(tower,1.4,3.15,'#e4d0a6');k.windows(tower,1.45,2.1,'deco',.13,.23);
 for(let face=0;face<4;face++){const a=face*Math.PI/2;for(const t of[-.2,0,.2])for(const y of[3.68,4.13]){const p=new THREE.Vector3(t,y,.375).applyAxisAngle(THREE.Object3D.DEFAULT_UP,a);gothicArch(k,p.x,p.y,p.z,.13,.35,a)}}
 for(const sx of[-1,1])for(const sz of[-1,1]){k.box(sx*.345,3.65,sz*.375,.065,2.65,.075,'#ceb68e');k.solid(rect(.105,.11).map(([a,b])=>[a+sx*.345,b+sz*.375]as Point),4.85,.12,'#e9d9b5');k.cylinder(sx*.345,5.1,sz*.375,.068,.37,'#518e77','copper',.004,4)}
 k.band(tower,4.63,.065,.1,'#d9b875');
 pyramid(k,.7,.77,4.72,.95,'#5c9b85');
 // Small dormer gables and Gothic crockets are modeled in relief on every roof face.
 for(let face=0;face<4;face++){const a=face*Math.PI/2,p=new THREE.Vector3(0,4.95,.29).applyAxisAngle(THREE.Object3D.DEFAULT_UP,a);gothicArch(k,p.x,p.y,p.z,.19,.28,a);for(let i=0;i<3;i++){const v=new THREE.Vector3(0,4.95+i*.19,.3-i*.06).applyAxisAngle(THREE.Object3D.DEFAULT_UP,a);k.cylinder(v.x,v.y,v.z,.018,.08,'#bbcd9d','accent',.002,4)}}
 k.cylinder(0,5.79,0,.018,.24,'#bed0a6','accent',.002,6);
 k.count('Woolworth landmark');
}
function pyramidAt(k:Architecture,x:number,z:number,w:number,d:number,b:number,h:number,color:string){const p=rect(w,d).map(([a,c])=>[a+x,c+z]as Point),q=rect(.01,d*.85).map(([a,c])=>[a+x,c+z]as Point);loft(k,p,q,b,h,color,'copper')}
export function leonard56(k:Architecture,x:number,z:number){
 k.at(x,z);k.facade('#6489a6','#547381','cool');
 k.solid(rect(.91,.86),0,.32,'#bfc8cc');
 // Individual floor plates and inhabited cantilevers, with the strongest shifts at the top.
 const offsets=[[-.08,.05],[.06,-.08],[.09,.04],[-.1,-.05],[.04,.09],[-.06,-.03]];
 for(let i=0;i<22;i++){
  const [dx,dz]=offsets[i%offsets.length],top=i>16,xx=dx*(top?1.45:.75),zz=dz*(top?1.3:.7),w=top?(i%2?.71:.9):.78,d=top?(i%3?.72:.86):.76,y=.32+i*.22;
  const p=rect(w,d).map(([a,b])=>[a+xx,b+zz]as Point);
  k.solid(p,y,.2,i%3?'#6489a6':'#72b9d3','glass',.002);k.band(p,y+.2,.045,.035,'#bfc8cc','stone');
  for(const s of[-1,1])k.box(xx+s*w*.27,y+.1,zz+d/2+.008,.012,.2,.012,'#5f7985','metal');
  if(i%3===0||top){const side=i%2?1:-1,bx=xx+side*(w*.5+.075),bz=zz+(i%3-1)*.2;
   k.box(bx,y+.105,bz,.31,.21,.33,i%2?'#72b9d3':'#6489a6','glass');k.box(bx,y+.22,bz,.38,.035,.4,'#c3cbcc');
   k.box(bx+side*.185,y+.29,bz,.012,.12,.39,'#5f8291','metal');
  }
  if(i%5===1)k.box(xx,y+.09,zz+d/2+.012,w*.62,.095,.013,'#abc8cc','windowCool');
 }
 k.box(-.1,5.2,.05,.45,.13,.43,'#bfc8cc');k.hvac(5.27,.45,.43);
 k.count('56 Leonard landmark');
}
