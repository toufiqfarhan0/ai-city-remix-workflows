import * as THREE from 'three';
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

export function stoneMap() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 2048;
  const ctx = c.getContext('2d'); const rng = seeded(74217);
  ctx.fillStyle = '#6b7076'; ctx.fillRect(0, 0, 2048, 2048);
  const blockW = 128, blockH = 80;
  for (let row = -1; row < 27; row++) {
    for (let col = -1; col < 18; col++) {
      const x = col * blockW + (row % 2) * blockW / 2;
      const y = row * blockH;
      const g = Math.floor(104 + rng() * 22);
      ctx.fillStyle = `rgb(${g},${g + 4},${g + 7})`;
      ctx.fillRect(x + 1.5, y + 1.5, blockW - 3, blockH - 3);
      ctx.strokeStyle = 'rgba(202,205,206,.16)'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 3.5, y + 3.5, blockW - 7, blockH - 7);
      for (let k = 0; k < 5; k++) {
        const xx = x + rng() * blockW, yy = y + rng() * blockH;
        ctx.strokeStyle = `rgba(55,63,69,${0.018 + rng() * 0.025})`;
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 8 + rng() * 35, yy + rng() * 3); ctx.stroke();
      }
    }
  }
  const img = ctx.getImageData(0, 0, 2048, 2048);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.floor((rng() - 0.5) * 9);
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24); tex.anisotropy = 8;
  return tex;
}

export function grassMap(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const context=canvas.getContext('2d'),data=context.createImageData(256,256),random=seeded(41023);
  for(let i=0;i<data.data.length;i+=4){const variation=(random()-.5)*18;data.data[i]=99+variation;data.data[i+1]=114+variation;data.data[i+2]=80+variation;data.data[i+3]=255}
  context.putImageData(data,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(80,80);return texture;
}

export function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false, uniforms: {day: {value:0}},
    vertexShader: `varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      uniform float day; varying vec3 vDir;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){
        vec3 d=normalize(vDir);float h=clamp(d.y,0.,1.);
        vec3 col=mix(vec3(.075,.145,.265),vec3(.012,.045,.12),pow(h,.42));
        float band=exp(-pow((d.x*.47+d.y*.83+d.z*.29-.35)*7.5,2.));
        float dust=n3(d*11.)*.6+n3(d*27.)*.28+n3(d*71.)*.12;
        col+=band*pow(dust,2.)*vec3(.018,.026,.045);
        float horizon=exp(-h*9.);col+=horizon*vec3(.006,.008,.011);
        col=mix(col,mix(vec3(.70,.82,.88),vec3(.12,.39,.68),pow(h,.5)),day); gl_FragColor=vec4(col,1.);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  sky.renderOrder = -20; sky.frustumCulled = false;
  const rng = seeded(330589), count = 16000;
  const pos = new Float32Array(count * 3), lum = new Float32Array(count), size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const az = rng() * Math.PI * 2;
    const y = i < 12000 ? 0.035 + rng() * 0.95 : 0.15 + rng() * 0.64;
    const r = Math.sqrt(1 - y * y), radius = 840;
    pos[i * 3] = Math.sin(az) * r * radius; pos[i * 3 + 1] = y * radius; pos[i * 3 + 2] = Math.cos(az) * r * radius;
    lum[i] = 0.32 + Math.pow(rng(), 3) * 0.64; size[i] = 1.1 + Math.pow(rng(), 3) * 1.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('lum', new THREE.BufferAttribute(lum, 1));
  geo.setAttribute('starSize', new THREE.BufferAttribute(size, 1));
  const stars = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: {day: {value:0}}, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float lum;attribute float starSize;varying float vLum;void main(){vLum=lum;gl_PointSize=starSize;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float day; varying float vLum;void main(){float d=length(gl_PointCoord-.5);float a=(1.-smoothstep(.04,.5,d))*vLum;gl_FragColor=vec4(.70,.79,1.,a*(1.-day));}`
  }));
  stars.renderOrder = -19; stars.frustumCulled = false;
  sky.add(stars); return sky;
}

export function distantTrees() {
  const c = document.createElement('canvas'); c.width = 4096; c.height = 512;
  const ctx = c.getContext('2d'), rng = seeded(919733);
  const grad = ctx.createLinearGradient(0, 50, 0, 512); grad.addColorStop(0, '#142329'); grad.addColorStop(1, '#0b141c');
  ctx.fillStyle = grad;
  for (let i = 0; i < 370; i++) {
    const x = rng() * 4096, y = 140 + rng() * 125, w = 18 + rng() * 33, h = 70 + rng() * 120;
    ctx.beginPath(); ctx.ellipse(x, y + h * .35, w, h, (rng() - .5) * .25, 0, Math.PI * 2); ctx.fill();
    for (let b = 0; b < 7; b++) {
      ctx.beginPath(); ctx.ellipse(x + (rng() - .5) * w * 1.7, y + h * .2 + (rng() - .5) * h * 1.2, w * (.2 + rng() * .4), h * (.1 + rng() * .2), 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillRect(x - 2, y, 4, 512 - y);
  }
  ctx.fillRect(0, 345, 4096, 167);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = 3;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(238, 238, 25, 144, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .15, side: THREE.BackSide, color: 0x78828b, depthWrite: false, fog: true }));
  mesh.position.y = 11.5; return mesh;
}

export function contactShadow() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(256, 256, 155, 256, 256, 256);
  g.addColorStop(0, 'rgba(0,0,0,.54)'); g.addColorStop(.58, 'rgba(0,0,0,.20)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(75, 75), new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,opacity:.62}));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .018; return shadow;
}

