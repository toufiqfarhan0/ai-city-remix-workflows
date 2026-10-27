// A deterministic director; camera state is a function of film time, never frame count.
export const FILM_DURATION=25;
export const HERO_HOLD_START=23;
export const CAMERA_KEYS=[
 {time:0,position:[33,31,40],target:[0,.5,0]},
 {time:2,position:[31,29,38],target:[1,.7,.5]},
 {time:8,position:[27,25,35],target:[2.5,.8,1]},
 {time:15,position:[15,27,43],target:[0,.8,0]},
 {time:19.5,position:[29,22,36],target:[2,.8,0]},
 {time:22,position:[31,28,39],target:[.8,.3,0]},
 {time:23,position:[32,30,40],target:[0,0,0]},
 {time:25,position:[32,30,40],target:[0,0,0]}
];
export const CHAPTERS=[
 {label:'125 AD — Empire',sentence:'A city of spectacle, marble and imperial ambition.'},
 {label:'1300 — Medieval Rome',sentence:'Ancient stone becomes shelter, pasture and a city reborn.'},
 {label:'1700 — Baroque Rome',sentence:'Palaces and domes weave a new city around enduring ruins.'},
 {label:'2026 — Rome Today',sentence:'Protected archaeology lives beside the rhythms of modern Rome.'}
];
export function chapterAt(seconds){return CHAPTERS[seconds<2?0:seconds<8?1:seconds<15?2:3]}
function tangent(i,field,axis){if(i===0||i>=CAMERA_KEYS.length-2)return 0;const before=CAMERA_KEYS[i-1],after=CAMERA_KEYS[i+1];return (after[field][axis]-before[field][axis])/(after.time-before.time)}
export function cinematicFrame(seconds){const t=Math.max(0,Math.min(HERO_HOLD_START,seconds));let i=0;while(i<CAMERA_KEYS.length-2&&t>CAMERA_KEYS[i+1].time)i++;const a=CAMERA_KEYS[i],b=CAMERA_KEYS[i+1],duration=b.time-a.time,u=(t-a.time)/duration,u2=u*u,u3=u2*u;const sample=field=>[0,1,2].map(axis=>(2*u3-3*u2+1)*a[field][axis]+(u3-2*u2+u)*duration*tangent(i,field,axis)+(-2*u3+3*u2)*b[field][axis]+(u3-u2)*duration*tangent(i+1,field,axis));return {position:sample('position'),target:sample('target'),fov:36,chapter:chapterAt(t)}}
