// Landmark views and the film's shot table; visible copy lives in src/i18n/strings.json.
// Change the shot table to author a new film. World coordinates use Y up, north -Z.
export const duration = 20;
export const transition = { start: 8.5, end: 13.5 };
export const landmarks = [
 {id:'prayer',center:[0,21,-75],yaw:.4,elev:.24,distance:73,detailCenter:[0,26,-75],detailDistance:49},
 {id:'imperial-hall',center:[0,10,-135],yaw:.58,elev:.38,distance:43,detailCenter:[0,11,-128],detailDistance:32},
 {id:'vault',center:[0,11,75],yaw:.4,elev:.3,distance:46,detailCenter:[0,15,84],detailDistance:25},
 {id:'altar',center:[0,3,145],yaw:.25,elev:.5,distance:54,detailCenter:[0,3.8,151],detailDistance:33},
 {id:'abstinence',center:[-93,8,45],yaw:.5,elev:.46,distance:63,detailCenter:[-93,12,40],detailDistance:35}
];
// Hard cuts connect distinct buildings; 7.5–14.5s locks the camera for the light change.
export const shots = [
 {start:0,end:2.5,id:'prayer',preset:'orbit',center:[0,21,-75],yaw:[.38,.52],elev:[.22,.26],distance:[73,70]},
 {start:2.5,end:5,id:'imperial-hall',preset:'detail',center:[0,11,-128],yaw:[.6,.76],elev:[.26,.3],distance:[34,32]},
 {start:5,end:7.5,id:'vault',preset:'detail',center:[0,14,81],yaw:[.28,.4],elev:[.16,.2],distance:[33,31]},
 {start:7.5,end:14.5,id:'prayer',preset:'orbit',center:[0,21,-75],yaw:[.28,.28],elev:[.2,.2],distance:[73,73]},
 {start:14.5,end:17,id:'altar',preset:'detail',center:[0,3.8,151],yaw:[.16,.26],elev:[.36,.42],distance:[38,36]},
 {start:17,end:20,id:'abstinence',preset:'detail',center:[-93,12,40],yaw:[.4,.56],elev:[.28,.33],distance:[37,35]}
];
