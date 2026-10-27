import * as THREE from 'three';
import {group,batch} from './architecture.js';
import {clampYear,progress,HistoricalEventTimeline} from './historical-events.js';
const WEATHER_COLOR=new THREE.Color('#a79b7f');
const interval=range=>range?[range[0],range[1]>range[0]?range[1]:range[0]+150]:undefined;
export class HistoricalEntityRegistry{
 constructor(root){this.root=root;this.entities=new Map();this.timeline=new HistoricalEventTimeline();this.currentYear=125}
 add(spec){if(this.entities.has(spec.id))throw new Error('Duplicate historical entity '+spec.id);const obj=spec.object,parent=spec.parent||this.root;parent.add(obj);obj.name=spec.id;obj.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(obj);const entity={category:'building',lifecycle:'modified',renovationPeriods:[],reuseOf:null,preservationStatus:'evolving urban fabric',confidence:'approximate broad visual interval',...spec,construction:interval(spec.construction),demolition:interval(spec.demolition),removal:interval(spec.removal),position:obj.position.toArray(),baseScale:obj.scale.toArray(),bounds,parts:[],existsFrom:spec.construction?.[0]??125,existsUntil:spec.removal?.[1]??null};
 // Parts keep their original transforms. A world-space clipping plane reveals/removes height; nothing is squashed.
 obj.traverse(m=>{if(!m.isMesh)return;m.material=m.material.clone();m.material.alphaHash=false;m.material.clipShadows=true;const plane=new THREE.Plane(new THREE.Vector3(0,-1,0),1000);m.material.clippingPlanes=[plane];const base=m.material.color.clone(),hex=base.getHexString();const roof=['a65636','a75c3a','a35a3a','a45435','ad6546','81513c','86503a','855039','ac6241','9b5e40','a15e44','95694e'].includes(hex);const detail=['535b50','464b41','546d6a','465f66'].includes(hex);if(entity.category==='building'&&!detail&&!roof){const hue=[...entity.id].reduce((a,c)=>a+c.charCodeAt(0),0)%5;const tint=['#e9c79c','#dca987','#e0cfac','#cbb98f','#e1ba7b'][hue];base.lerp(new THREE.Color(tint),.28)}entity.parts.push({mesh:m,material:m.material,base,plane,roof,detail,bounds:new THREE.Box3().setFromObject(m)})});
 this.entities.set(entity.id,entity);this.timeline.add(entity);return entity}
 updateCityAtYear(year){this.currentYear=clampYear(year);for(const e of this.entities.values())BuildingLifecycleController.evaluate(e,this.currentYear)}
 diagnostics(){return [...this.entities.values()].map(e=>({id:e.id,category:e.category,lifecycle:e.lifecycle,position:e.position,visible:e.object.visible,construction:e.construction??null,demolition:e.demolition??null,existsFrom:e.existsFrom,existsUntil:e.existsUntil,progress:e.progress,retainedHeight:e.retainedHeight??.1,parts:e.parts.length,confidence:e.confidence,renovationPeriods:e.renovationPeriods,reuseOf:e.reuseOf,preservationStatus:e.preservationStatus}))}
 dispose(){const geos=new Set(),mats=new Set();this.root.traverse(o=>{if(o.isMesh){geos.add(o.geometry);mats.add(o.material)}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose())}
}
export class BuildingLifecycleController{
 static evaluate(e,year){const born=progress(year,e.construction),damage=e.demolition?progress(year,e.demolition):0,removed=e.removal?progress(year,e.removal):0,retained=e.retainedHeight??.10;
 e.progress={born,damage,removed};e.object.visible=born>0&&removed<1;const height=Math.max(.03,e.bounds.max.y-e.bounds.min.y),age=e.weather===false?0:Math.max(0,Math.min(1,(year-125)/1200));
 const bodyDamage=e.demolition?progress(year,[e.demolition[0]+(e.demolition[1]-e.demolition[0])*.24,e.demolition[1]]):0;
 for(const part of e.parts){let build=born;if(part.roof)build=Math.max(0,Math.min(1,(born-.78)/.22));if(part.detail)build=Math.max(0,Math.min(1,(born-.48)/.52));const roofDamage=e.demolition?progress(year,[e.demolition[0],e.demolition[0]+(e.demolition[1]-e.demolition[0])*.28]):0;let opacity=1;if(e.surface)opacity=born;else if(part.detail)opacity=build*(1-damage);else if(!part.roof&&born<1)opacity=Math.min(1,born*5);
 const top=e.bounds.min.y+height*Math.min(born,1-bodyDamage*(1-retained));const ph=Math.max(.03,part.bounds.max.y-part.bounds.min.y),roofTop=part.bounds.min.y+ph*Math.min(build,1-roofDamage);part.plane.constant=e.surface?1000:(part.roof?Math.min(top,roofTop):top)+.015;part.material.opacity=opacity*(1-removed);const translucent=part.material.opacity<.999;if(part.material.transparent!==translucent){part.material.transparent=translucent;part.material.needsUpdate=true}part.material.depthWrite=!translucent;part.mesh.visible=build>0&&opacity>0&&part.material.opacity>0&&(!part.roof||roofDamage<1);part.material.color.copy(part.base).lerp(WEATHER_COLOR,age*(e.weatherStrength??.23)*(part.roof?.35:1));const renovation=e.renovationPeriods.reduce((v,r)=>Math.max(v,progress(year,r)),0);if(renovation&&!part.roof&&!part.detail)part.material.color.lerp(part.base,renovation*.65);}
 }
}
export class ContinuousTimeController{
 constructor(registry,landmarks,environment){this.registry=registry;this.landmarks=landmarks;this.environment=environment;this.currentYear=NaN}
 updateCityAtYear(year){year=clampYear(year);if(year===this.currentYear)return;this.currentYear=year;this.registry.updateCityAtYear(year);this.landmarks.update(year);this.environment.update(year)}
}
