import { Architecture, rect, clipped, type Point } from './architecture';
import { profiles } from './aiProfiles';
export const extraFamilies=['Luxury residential','Terraced','Corner building','Mid-century office'] as const;
export type ExtraFamily=typeof extraFamilies[number];
export function extraBuilding(k:Architecture,family:ExtraFamily,w:number,d:number,h:number,v:number){
 const p=profiles[extraFamilies.indexOf(family)],odd=v%2===1;
 k.count(family);k.facade(p.glassColor,family==='Mid-century office'?'#627580':'#715b49',family==='Mid-century office'?'cool':'soft');
 if(family==='Luxury residential'){
  const q=clipped(w*.66,d*.74,.045);k.solid(rect(w,d),0,.4,p.trimColor);k.storefront(w,d,'#5c9b85');
  k.solid(q,.4,h-.4,p.glassColor,'glass');
  for(const sx of[-1,1])for(const sz of[-1,1])k.box(sx*w*.3,h/2,sz*d*.35,.055,h,.055,p.facadeColor);
  for(let y=.5,i=0;y<h;y+=p.floorStep,i++){
   const side=odd?(i%2?1:-1):1;
   k.box(side*w*.19,y,d*.41,w*.54,.025,d*.23,p.trimColor);
   k.box(side*w*.19,y+.075,d*.52,w*.54,.09,.012,'#6e9ca9','metal');
   if(i%4===0)k.box(-side*w*.22,y+.04,-d*.25,.1,.09,.14,'#5c9b85');
  }
  if(odd){k.box(-w*.28,h*.42,-d*.18,w*.28,h*.84,d*.42,p.facadeColor);k.windows(rect(w*.28,d*.42).map(([x,z])=>[x-w*.28,z-d*.18]as Point),.4,h*.72,'residential',.15,.25)}
  k.solid(rect(w*.46,d*.48),h,.18,'#bfc8cc');k.hvac(h+.18,w*.5,d*.5);
 } else if(family==='Terraced'){
  const n=odd?3:4,hh=h/n;
  for(let i=0;i<n;i++){
   const ww=w*(1-i*.14),dd=d*(1-i*.16),zz=-i*d*.065,q=rect(ww,dd).map(([x,z])=>[x,z+zz]as Point);
   k.solid(q,i*hh,hh,i%2?p.trimColor:'#c96b4b');k.windows(q,i*hh+.06,hh-.08,'retail',.25,p.floorStep);k.band(q,(i+1)*hh,.045,.055,'#d8b88a');
   if(i<n-1)for(let j=0;j<3;j++){const x=-ww*.31+j*ww*.3,z=dd*.39+zz;k.box(x,(i+1)*hh+.07,z,.14,.14,.13,p.facadeColor);k.box(x,(i+1)*hh+.145,z,.16,.055,.15,'#598658')}
  }
  k.hvac(h,w*.45,d*.4);
 } else if(family==='Corner building'){
  const r=w*(odd?.43:.3),cx=w/2-r,cz=d/2-r;
  const q:Point[]=[[-w/2,-d/2],[w/2,-d/2],[w/2,cz]];
  for(let i=1;i<=8;i++){const a=i*Math.PI/16;q.push([cx+Math.cos(a)*r,cz+Math.sin(a)*r])}q.push([-w/2,d/2]);
  k.solid(q,0,h,[p.facadeColor,'#d9aa63','#e7b09a','#c96b4b'][v%4]);k.windows(q,.4,h-.4,'historic',odd?.2:.27,p.floorStep+.07);
  k.band(q,.42,.05,.075,p.trimColor);k.band(q,h,.08,.11,p.trimColor);k.band(q,h+.11,.1,.045,'#d8b88a');
  k.storefront(w,d,odd?'#3d8c98':'#a84e3b');k.box(cx+.1,.24,cz+.15,.18,.36,.03,'#6489a6','windowSoft',-.65);
  k.waterTank(-w*.25,h+.16,-d*.2,.075);
 } else {
  // Thin dark slab on an open columned podium, with a structural aluminum grid.
  k.solid(rect(w,d),0,.15,'#a0a9a8');
  const dd=d*(odd?.53:.72),ww=w*(odd?.94:.78);k.solid(rect(ww,dd),.3,h-.3,'#315367','glass');
  for(const sx of[-1,1])for(const sz of[-1,1])k.box(sx*ww*.36,.23,sz*dd*.4,.035,.25,.035,'#bfc8cc','metal');
  for(let y=.35;y<h;y+=p.floorStep)k.band(rect(ww,dd),y,.025,.025,'#bfc8cc','metal');
  for(let x=-ww/2;x<=ww/2+.001;x+=ww/5)for(const z of[-dd/2,dd/2])k.box(x,h/2+.15,z,.016,h-.3,.023,'#bfc8cc','metal');
  for(let i=0;i<5;i++)k.box(-ww*.4+i*ww*.2,h*.62,dd/2+.016,ww*.13,.09,.012,'#6489a6','windowCool');
  k.solid(rect(ww*.74,dd*.7),h,.19,'#596f7c','metal');k.hvac(h+.19,ww*.6,dd*.5);
 }
}
