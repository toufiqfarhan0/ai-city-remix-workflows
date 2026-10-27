// Local marble geometry after both requested MiniMax module calls timed out.
export function createMarbleBase(THREE) {
  const group = new THREE.Group();
  const stats = {postCount:0,panelCount:0,stepCount:0,carvingCount:0,source:'local fallback'};
  const stone = new THREE.MeshStandardMaterial({color:0xb5bec4,roughness:.83,metalness:.02});
  const pale = new THREE.MeshStandardMaterial({color:0xd0d4d2,roughness:.72,metalness:.01});
  const recess = new THREE.MeshStandardMaterial({color:0x828f95,roughness:.94});
  const buckets = new Map(), dummy = new THREE.Object3D();
  function instance(geo,mat,x,y,z,ry=0,sx=1,sy=1,sz=1,rx=0) {
    const k=geo.uuid+mat.uuid;
    if(!buckets.has(k))buckets.set(k,{geo,mat,transforms:[]});
    dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
    buckets.get(k).transforms.push(dummy.matrix.clone());
  }
  function mesh(geo,mat,x=0,y=0,z=0) {const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
  const box=new THREE.BoxGeometry(1,1,1), sphere=new THREE.SphereGeometry(1,9,6);
  function radial(geo,mat,r,y,a,sx=1,sy=1,sz=1){instance(geo,mat,Math.sin(a)*r,y,Math.cos(a)*r,a,sx,sy,sz);}
  function profile(r,y){return new THREE.LatheGeometry([[r-.65,y-2],[r-.3,y-2],[r-.3,y-1.88],[r-.05,y-1.8],[r,y-1.65],[r-.16,y-1.48],[r-.17,y-.38],[r-.03,y-.29],[r+.12,y-.22],[r+.12,y-.1],[r-.03,y],[0,y]].map(v=>new THREE.Vector2(...v)),192);}
  const postGeometry=new THREE.LatheGeometry([[0,0],[.29,0],[.29,.12],[.22,.18],[.16,.2],[.14,.78],[.19,.81],[.19,.89],[.26,.93],[.25,1.02],[.18,1.1],[.1,1.2],[0,1.22]].map(v=>new THREE.Vector2(...v)),12);
  function post(x,y,z,yaw=0){instance(postGeometry,pale,x,y,z);instance(box,stone,x,y+.055,z,yaw,.54,.11,.54);for(let j=0;j<8;j++){const a=j*Math.PI/4;instance(sphere,pale,x+Math.sin(a)*.19,y+.98,z+Math.cos(a)*.19,a,.078,.13,.052);}instance(sphere,pale,x,y+1.2,z,0,.15,.19,.15);stats.postCount++;stats.carvingCount+=9;}
  function curve(points,radius=.025){const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return new THREE.TubeGeometry(c,32,radius,5,false);}
  const motifs=[];
  for(let j=0;j<3;j++){
    let pts=[];for(let k=0;k<=44;k++){const t=k/44;let x=(t-.5)*1.1;let y=.12*Math.sin(t*Math.PI*(4+j*2))+.06*Math.sin(t*Math.PI*10);pts.push([x,y,.105]);}
    motifs.push(curve(pts,.032));
  }
  const petals=new THREE.TorusGeometry(.12,.025,5,12);
  [28,25,22].forEach((r,level)=>{
    const top=(level+1)*2;mesh(profile(r,top),stone);
    mesh(new THREE.CylinderGeometry(r-.2,r-.2,.06,192),pale,0,top+.01,0);
    const count=Math.floor(2*Math.PI*r/1.7), step=2*Math.PI/count, gap=Math.asin(4.3/(r-.28));
    for(let j=0;j<count;j++){
      const a=j*step; if(Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<gap)continue;
      post(Math.sin(a)*(r-.35),top+.05,Math.cos(a)*(r-.35),a);
      const mid=a+step/2;if(Math.abs(Math.atan2(Math.sin(mid),Math.cos(mid)))<gap)continue;
      const w=2*(r-.35)*Math.sin(step/2)-.22;
      radial(box,pale,r-.35,top+1.04,mid,w,.16,.28);
      radial(box,pale,r-.35,top+.2,mid,w,.13,.26);
      radial(box,recess,r-.35,top+.58,mid,w-.12,.57,.11);
      radial(box,pale,r-.265,top+.83,mid,w-.05,.07,.13);
      radial(box,pale,r-.265,top+.31,mid,w-.05,.07,.13);
      radial(motifs[j%3],pale,r-.26,top+.57,mid,(w-.15)/1.1,1,1);
      radial(petals,pale,r-.2,top+.57,mid,1.05,1.05,1);
      radial(sphere,pale,r-.15,top+.57,mid,.07,.07,.045);
      stats.panelCount++;stats.carvingCount+=3;
    }
    // Radial joints are thin, low contrast surface seams.
    for(let j=0;j<144;j++){const a=j*Math.PI/72, inner=level===2?15.2:r-3;radial(box,recess,(r+inner)/2,top+.047,a,.012,.012,r-inner-.2);}
    const seam=new THREE.TorusGeometry(r-.2,.014,3,192);const sm=mesh(seam,recess,0,top+.052,0);sm.rotation.x=Math.PI/2;
  });
  const levels=[[0,2,35,28],[2,4,28,25],[4,6,25,22]];
  for(const [lo,hi,far,near] of levels){
    const solid=new THREE.Shape();solid.moveTo(far,0);solid.lineTo(near,0);solid.lineTo(near,hi-.025);solid.lineTo(far,Math.max(0,lo-.025));solid.closePath();
    const fill=new THREE.ExtrudeGeometry(solid,{depth:2.08,bevelEnabled:false,steps:1});fill.rotateY(-Math.PI/2);fill.translate(1.04,0,0);mesh(fill,stone);
    const steps=10,run=(far-near)/steps;
    for(let i=0;i<steps;i++){
      const h=lo+(i+1)*(hi-lo)/steps,z=far-(i+.5)*run;
      for(const x of [-2.25,2.25]){
        instance(box,stone,x,h/2,z,0,2,h,run+.015);
        instance(box,pale,x,h+.025,z+run*.42,0,2.04,.05,.09);stats.stepCount++;
      }
    }
    const slope=Math.atan2(hi-lo,far-near),length=Math.hypot(hi-lo,far-near);
    const ramp=mesh(new THREE.BoxGeometry(2.08,.18,length),stone,0,(lo+hi)/2+.12,(far+near)/2);ramp.rotation.x=slope;
    // Relief is placed in ramp coordinates so it remains flush with the inclined slab.
    const relief=new THREE.Group();relief.position.copy(ramp.position);relief.rotation.copy(ramp.rotation);group.add(relief);
    const curveMesh=(pts,rad)=>{const m=new THREE.Mesh(curve(pts,rad),pale);relief.add(m);stats.carvingCount++;};
    const body=[];for(let k=0;k<=70;k++){const t=k/70;body.push([.33*Math.sin(t*9),.13+.025*Math.sin(t*17),(t-.5)*(length-.5)]);}curveMesh(body,.065);
    const headZ=(length-.5)*.43,headX=.33*Math.sin(.93*9);
    for(const [x,y,z,sx,sy,sz] of [[headX,.19,headZ,.16,.07,.21],[headX,.19,headZ+.17,.13,.05,.15]]){const h=new THREE.Mesh(sphere,pale);h.position.set(x,y,z);h.scale.set(sx,sy,sz);relief.add(h);}
    for(const side of [-1,1]){
      curveMesh([[headX+side*.1,.19,headZ-.04],[headX+side*.2,.2,headZ-.25],[headX+side*.12,.21,headZ-.4]],.024);
      curveMesh([[headX+side*.13,.19,headZ+.12],[headX+side*.31,.17,headZ+.18],[headX+side*.4,.15,headZ+.4]],.018);
      for(let k=0;k<2;k++){const t=.25+k*.4,z=(t-.5)*(length-.5),x=.33*Math.sin(t*9),ex=x+side*.34;curveMesh([[x,.15,z],[ex,.18,z+.11],[ex+side*.06,.15,z+.3]],.031);for(let claw=0;claw<3;claw++)curveMesh([[ex+side*.06,.15,z+.3],[ex+side*(.12+.05*claw),.14,z+.35+claw*.04]],.016);}
    }
    for(let k=0;k<30;k++){const t=k/29,z=(t-.5)*(length-.8),x=.33*Math.sin(t*9);const s=new THREE.Mesh(sphere,pale);s.position.set(x,.19,z);s.scale.set(.075,.024,.08);relief.add(s);stats.carvingCount++;}
    for(let side of [-1,1]){const pts=[];for(let k=0;k<=50;k++){const t=k/50;pts.push([side*(.65+.12*Math.sin(t*23)),.13,(t-.5)*(length-.5)]);}curveMesh(pts,.03);}
    for(let side of [-1,1])for(let k=0;k<4;k++){const z=(k/3-.5)*(length-.6),pts=[];for(let q=0;q<=26;q++){const a=q/26*Math.PI*2.5,rr=.20*(1-q/32);pts.push([side*.52+Math.cos(a)*rr,.14,z+Math.sin(a)*rr]);}curveMesh(pts,.026);}
    for(const x of [-3.65,3.65]){
      const rail=mesh(new THREE.BoxGeometry(.22,.18,length+.25),pale,x,(lo+hi)/2+1.08,(far+near)/2);rail.rotation.x=slope;
      for(let k=0;k<=4;k++){const t=k/4;post(x,lo+t*(hi-lo)+.04,far-t*(far-near));}
    }
  }
  for(const data of buckets.values()){
    const m=new THREE.InstancedMesh(data.geo,data.mat,data.transforms.length);data.transforms.forEach((x,i)=>m.setMatrixAt(i,x));m.instanceMatrix.needsUpdate=true;m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;group.add(m);
  }
  stats.instanceBatches=buckets.size;
  return {group,stats};
}
