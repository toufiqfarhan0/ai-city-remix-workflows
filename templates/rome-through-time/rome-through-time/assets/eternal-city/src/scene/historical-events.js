export const MIN_YEAR=125,MAX_YEAR=2026,MILESTONES=[125,1300,1700,2026];
export const clampYear=y=>Math.max(MIN_YEAR,Math.min(MAX_YEAR,Number.isFinite(y)?y:MIN_YEAR));
export const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
export const progress=(year,interval)=>interval?smooth((year-interval[0])/(interval[1]-interval[0])):1;
// Equal visual intervals are retained in the existing UI; the model receives actual years.
export function sliderToYear(t){t=Math.max(0,Math.min(3,t));const i=Math.min(2,Math.floor(t));return MILESTONES[i]+(MILESTONES[i+1]-MILESTONES[i])*(t-i)}
export function yearToSlider(y){y=clampYear(y);const i=y<1300?0:y<1700?1:2;return i+(y-MILESTONES[i])/(MILESTONES[i+1]-MILESTONES[i])}
export function interpolateYear(y,stops){if(y<=stops[0][0])return stops[0][1];for(let i=1;i<stops.length;i++)if(y<=stops[i][0])return stops[i-1][1]+(stops[i][1]-stops[i-1][1])*progress(y,[stops[i-1][0],stops[i][0]]);return stops.at(-1)[1]}
export const PLAYBACK_YEAR_KEYS=[[0,125],[2,600],[8,1300],[15,1700],[21.8,2026],[25,2026]];
// Local ease-in/out gives each historical change an emphasis, without intermediate holds.
export function playbackYear(seconds){if(seconds<2){const u=Math.max(0,seconds/2);return 125+475*(u+u*u-u*u*u)}return interpolateYear(Math.max(0,Math.min(25,seconds)),PLAYBACK_YEAR_KEYS)}

export class HistoricalEventTimeline{
 constructor(){this.events=[]}
 add(entity){for(const [kind,range]of [['construction',entity.construction],['deterioration',entity.demolition],['removal',entity.removal]])if(range)this.events.push({id:`${entity.id}:${kind}`,startYear:range[0],endYear:range[1],affectedEntityIds:[entity.id],transitionType:kind,confidence:entity.confidence||'approximate broad visual interval',approximate:true,progressFunction:'smoothstep'})}
 atYear(year){return this.events.filter(e=>year>=e.startYear&&year<=e.endYear)}
}
