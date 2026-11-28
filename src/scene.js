// @ts-check
/** Scène WebGL : fond de ciel, étoiles, sol, lignes, planètes, Lune, Soleil, satellites. */
import { $, D2R, V3 } from './util.js';
import { etat } from './state.js';
import { BODIES, GC, GL, M, NGP, orient, computeBodies, SAT_MAX, bvRGB, eqVec, litBySun, planets, satLook, sunEci, toEq } from './astro.js';
import { parseCatalog } from './catalog.js';
import { makeLabels } from './labels.js';
import { buildSearch } from './search.js';
import { LAYERS } from './panels.js';
import { pixelRatio } from './loop.js';

/* ---------- Scène ---------- */
export const canvas=$('#c'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
const PR=pixelRatio(devicePixelRatio,typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches);
renderer.setPixelRatio(PR);
export const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,1,.01,200);
const sky=new THREE.Group();
sky.matrixAutoUpdate=false;
scene.add(sky);
export const bgMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthTest:false,depthWrite:false,
uniforms:{uSun:{value:new V3(0,-1,0)},uToEq:{value:toEq},uNgp:{value:NGP},uGc:{value:GC},uGl:{value:GL},uMw:{value:1}},
vertexShader:`varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`varying vec3 vD;uniform vec3 uSun,uNgp,uGc,uGl;uniform mat3 uToEq;uniform float uMw;
float hs(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float ns(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hs(i),hs(i+vec3(1,0,0)),f.x),mix(hs(i+vec3(0,1,0)),hs(i+vec3(1,1,0)),f.x),f.y),mix(mix(hs(i+vec3(0,0,1)),hs(i+vec3(1,0,1)),f.x),mix(hs(i+vec3(0,1,1)),hs(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*ns(p);p*=2.03;a*=.5;}return s;}
void main(){vec3 d=normalize(vD);float alt=d.y,sa=uSun.y;float day=smoothstep(-.2,.08,sa);float h=1.-clamp(alt,0.,1.);
vec3 night=mix(vec3(.006,.009,.03),vec3(.03,.05,.11),pow(h,5.));
vec3 dayc=mix(vec3(.1,.3,.68),vec3(.56,.76,.95),pow(h,3.));
float sd=dot(d,uSun);float tw=smoothstep(-.32,-.02,sa)*(1.-smoothstep(.05,.3,sa));
vec3 twc=mix(vec3(.95,.42,.28),vec3(.98,.72,.48),clamp(alt*3.,0.,1.));
vec3 col=mix(night,dayc,day);
col+=twc*tw*pow(h,6.)*(.3+.7*pow(sd*.5+.5,4.))*.85;
col+=vec3(1.,.88,.7)*pow(max(sd,0.),10.)*.3*(day+tw);
vec3 e=uToEq*d;float b=asin(clamp(dot(e,uNgp),-1.,1.));float l=atan(dot(e,uGl),dot(e,uGc));
float n=fbm(e*5.),n2=fbm(e*13.+3.);
float band=exp(-b*b/.03)*(.4+.6*pow(cos(l*.5),2.));
float bulge=exp(-(b*b*7.+l*l*1.6));
float lane=1.-.8*exp(-pow((b-.012)/.03,2.))*smoothstep(1.8,.2,abs(l))*smoothstep(.35,.7,n2);
float mw=(band*(.35+.9*n*n*1.6)+bulge*.9)*lane;
vec3 mwc=mix(vec3(.55,.62,.88),vec3(.98,.84,.64),clamp(bulge*1.4+.15*n,0.,1.));
float ext=smoothstep(-.02,.35,alt);
col+=mwc*mw*.5*uMw*(1.-day)*(.3+.7*ext);
col+=vec3(.015,.04,.05)*pow(h,10.)*(1.-day);
gl_FragColor=vec4(col,1.);}`});
const bg=new THREE.Mesh(new THREE.SphereGeometry(100,64,32),bgMat);
bg.renderOrder=0;
scene.add(bg);
export const starMat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,
uniforms:{uS:{value:1},uT:{value:0},uDay:{value:0},uPR:{value:PR},uLim:{value:6.5}},
vertexShader:`attribute float aM,aP;varying vec3 vC;varying float vA;uniform float uS,uT,uDay,uPR,uLim;
void main(){vec4 w=modelMatrix*vec4(position,1.);gl_Position=projectionMatrix*viewMatrix*w;float alt=w.y/length(w.xyz);
float f=pow(10.,-.4*(aM-1.));float ext=smoothstep(-.03,.3,alt);float tw=1.+.32*sin(uT*(2.5+aP*5.)+aP*60.)*(1.-.75*smoothstep(0.,.7,alt));
float sz=clamp(2.6+4.4*sqrt(f),2.2,20.)*uS*uPR;gl_PointSize=sz*tw;
float vis=1.-smoothstep(uLim-1.2,uLim,aM);
vA=clamp(.42+.8*sqrt(f),.2,1.)*mix(.2,1.,ext)*vis*(1.-uDay);vC=color;}`,
fragmentShader:`varying vec3 vC;varying float vA;void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;float co=exp(-r*r*6.),ha=exp(-r*r*2.)*.38;float a=(co+ha)*vA;if(a<.004)discard;gl_FragColor=vec4(mix(vC,vec3(1.),co*.55)*a,a);}`,vertexColors:true});

/* sol */
export const groundMat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,side:THREE.BackSide,
uniforms:{uA:{value:.96},uSun:{value:new V3(0,-1,0)}},
vertexShader:`varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`varying vec3 vD;uniform float uA;uniform vec3 uSun;
float pr(float a){return .006+.022*pow(.5+.5*sin(a*2.+1.3),3.)+.009*(.5+.5*sin(a*7.+.4))+.004*sin(a*19.+2.)+.002*sin(a*41.);}
void main(){vec3 d=normalize(vD);float az=atan(d.x,-d.z);float hz=pr(az);if(d.y>hz)discard;
float day=smoothstep(-.2,.08,uSun.y);vec3 base=mix(vec3(.01,.013,.024),vec3(.07,.09,.08),day);
float rim=exp(-(hz-d.y)*90.);vec3 col=base+vec3(.1,.18,.28)*rim*.35;
gl_FragColor=vec4(col,uA*(1.-.15*rim));}`});
const gnd=new THREE.Mesh(new THREE.SphereGeometry(60,96,48,0,Math.PI*2,Math.PI/2-.06,Math.PI/2+.06),groundMat);
gnd.renderOrder=20;
scene.add(gnd);
/* lignes */
const lineMat=new THREE.LineBasicMaterial({color:0x7fb8ff,transparent:true,opacity:.32,depthTest:false,depthWrite:false});
const selLineMat=new THREE.LineBasicMaterial({color:0x8fe6ff,transparent:true,opacity:.95,depthTest:false,depthWrite:false});
const pGeo=new THREE.BufferGeometry();
pGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(planets.length*3),3));
pGeo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(planets.flatMap(p=>new THREE.Color(p.col).toArray())),3));
pGeo.setAttribute('aS',new THREE.BufferAttribute(new Float32Array(planets.length),1));
export const ptMat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,
uniforms:{uS:{value:1},uPR:{value:PR},uDay:{value:0}},
vertexShader:`attribute float aS;varying vec3 vC;varying float vA;uniform float uS,uPR,uDay;void main(){vec4 w=modelMatrix*vec4(position,1.);gl_Position=projectionMatrix*viewMatrix*w;gl_PointSize=aS*uS*uPR;vC=color;vA=mix(1.,.5,uDay)*mix(.35,1.,smoothstep(-.03,.2,w.y/length(w.xyz)));}`,
fragmentShader:`varying vec3 vC;varying float vA;void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;float a=(smoothstep(.42,.28,r)+exp(-r*r*2.6)*.5)*vA;if(a<.01)discard;gl_FragColor=vec4(vC*a,a);}`});
const pPts=new THREE.Points(pGeo,ptMat);
pPts.frustumCulled=false;
pPts.renderOrder=6;
scene.add(pPts);
export const moonMat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{uL:{value:new V3(1,0,0)},uDay:{value:0}},
vertexShader:`varying vec2 vU;void main(){vU=(uv*2.-1.)*1.9;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`varying vec2 vU;uniform vec3 uL;uniform float uDay;
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
void main(){float r=length(vU);float ill=.5+.5*uL.z;
if(r>1.){float g=exp(-(r-1.)*3.2)*.28*ill*(1.-uDay*.8);gl_FragColor=vec4(vec3(.85,.9,1.)*g,g);return;}
vec3 n=vec3(vU,sqrt(1.-r*r));float lit=smoothstep(-.04,.06,dot(n,uL));
float m=ns(vU*3.+4.)*.6+ns(vU*7.)*.3+ns(vU*19.)*.1;float maria=smoothstep(.45,.62,m);
vec3 c=vec3(.95,.93,.88)*(1.-.32*maria)*(.75+.25*n.z);
vec3 col=mix(vec3(.035,.045,.07),c,lit);float a=smoothstep(1.,.97,r);gl_FragColor=vec4(col*a,a);}`});
export const moon=new THREE.Mesh(new THREE.PlaneGeometry(2,2),moonMat);
moon.renderOrder=8;
moon.frustumCulled=false;
scene.add(moon);
const sunMat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,
vertexShader:`varying vec2 vU;void main(){vU=(uv*2.-1.)*6.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`varying vec2 vU;void main(){float r=length(vU);float d=smoothstep(1.,.92,r);float g=exp(-r*.9)*.7+exp(-r*.25)*.12;vec3 c=vec3(1.,.96,.86)*d+vec3(1.,.8,.55)*g;float a=max(d,g);gl_FragColor=vec4(c*a,a);}`});
export const sun=new THREE.Mesh(new THREE.PlaneGeometry(2,2),sunMat);
sun.renderOrder=7;
sun.frustumCulled=false;
scene.add(sun);
const sGeo=new THREE.BufferGeometry();
sGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(SAT_MAX*3),3));
sGeo.setAttribute('aL',new THREE.BufferAttribute(new Float32Array(SAT_MAX),1));
sGeo.setDrawRange(0,0);
const sMat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uPR:{value:PR}},
vertexShader:`attribute float aL;varying float vL;uniform float uPR;void main(){gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);gl_PointSize=(aL>1.5?8.:4.5)*uPR;vL=aL;}`,
fragmentShader:`varying float vL;void main(){float r=length(gl_PointCoord-.5)*2.;float a=exp(-r*r*5.)*(vL>.5?1.:.28);if(a<.01)discard;vec3 c=vL>1.5?vec3(.75,1.,.85):vec3(.85,.95,1.);gl_FragColor=vec4(c*a,a);}`});
const sPts=new THREE.Points(sGeo,sMat);
sPts.frustumCulled=false;
sPts.renderOrder=9;
scene.add(sPts);
export function build(){
  parseCatalog();
  const S=etat.DATA.stars,n=S.length,pos=new Float32Array(n*3),col=new Float32Array(n*3),mag=new Float32Array(n),ph=new Float32Array(n);
  S.forEach((s,i)=>{const v=eqVec(s[0],s[1],50);pos.set([v.x,v.y,v.z],i*3);col.set(bvRGB(s[3]),i*3);mag[i]=s[2];ph[i]=Math.random()});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setAttribute('aM',new THREE.BufferAttribute(mag,1));g.setAttribute('aP',new THREE.BufferAttribute(ph,1));
  const pts=new THREE.Points(g,starMat);pts.frustumCulled=false;pts.renderOrder=4;sky.add(pts);
  const lp=[];for(const id in etat.DATA.lines)for(const seg of etat.DATA.lines[id])for(let i=0;i<seg.length-1;i++){const a=eqVec(seg[i][0],seg[i][1],50),b=eqVec(seg[i+1][0],seg[i+1][1],50);lp.push(a.x,a.y,a.z,b.x,b.y,b.z)}
  const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));etat.lines=new THREE.LineSegments(lg,lineMat);etat.lines.frustumCulled=false;etat.lines.renderOrder=2;sky.add(etat.lines);
  const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.Float32BufferAttribute(etat.messier.flatMap(m=>eqVec(m.ra,m.dec,50).toArray()),3));
  const mm=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uPR:{value:PR},uDay:starMat.uniforms.uDay,uS:starMat.uniforms.uS},
    vertexShader:`uniform float uPR,uS;void main(){gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);gl_PointSize=14.*uPR*uS;}`,
    fragmentShader:`uniform float uDay;void main(){float r=length(gl_PointCoord-.5)*2.;float a=exp(-r*r*4.)*.16*(1.-uDay);if(a<.005)discard;gl_FragColor=vec4(vec3(.8,.72,1.)*a,a);}`});
  const mp=new THREE.Points(mg,mm);mp.frustumCulled=false;mp.renderOrder=3;sky.add(mp);
  makeLabels();buildSearch();etat.ready=true;
}
export function updateFrame(date){
  const t=orient(date);
  sky.matrix.copy(M);sky.matrixWorldNeedsUpdate=true;
  if(Math.abs(date-etat.lastBodyT)>(etat.playing?1:15000)||performance.now()-etat.lastBodyReal>1000){etat.lastBodyT=+date;etat.lastBodyReal=performance.now();updateBodies(t)}
}
function updateBodies(t){
  const pa=pGeo.attributes.position.array,sa=pGeo.attributes.aS.array;
  computeBodies(t);
  BODIES.forEach((b,i)=>{
    if(i>=2){const j=i-2;pa[j*3]=b.world.x*40;pa[j*3+1]=b.world.y*40;pa[j*3+2]=b.world.z*40;sa[j]=Math.max(4,Math.min(24,10-2.6*b.mag))}});
  pGeo.attributes.position.needsUpdate=true;pGeo.attributes.aS.needsUpdate=true;
  etat.sunWorld.copy(BODIES[0].world);bgMat.uniforms.uSun.value.copy(etat.sunWorld);groundMat.uniforms.uSun.value.copy(etat.sunWorld);
  const day=Math.min(1,Math.max(0,(etat.sunWorld.y+.12)/.2));starMat.uniforms.uDay.value=Math.pow(day,.7)*.97;ptMat.uniforms.uDay.value=day;moonMat.uniforms.uDay.value=day;
}
export function placeDisc(mesh,dir,angDeg,R,k){mesh.position.copy(dir).multiplyScalar(R);mesh.quaternion.copy(camera.quaternion);mesh.scale.setScalar(R*Math.tan(angDeg*D2R)*k)}
export function showConsLines(id){if(etat.selLines){sky.remove(etat.selLines);etat.selLines.geometry.dispose();etat.selLines=null}if(!id||!etat.DATA.lines[id])return;
  const lp=[];for(const seg of etat.DATA.lines[id])for(let i=0;i<seg.length-1;i++){const a=eqVec(seg[i][0],seg[i][1],50),b=eqVec(seg[i+1][0],seg[i+1][1],50);lp.push(a.x,a.y,a.z,b.x,b.y,b.z)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));etat.selLines=new THREE.LineSegments(g,selLineMat);etat.selLines.frustumCulled=false;etat.selLines.renderOrder=25;sky.add(etat.selLines)}
export function updateSats(date){if(!etat.sats.length){sGeo.setDrawRange(0,0);return}if((etat.satFrame++)%2)return;const s=sunEci(date),pa=sGeo.attributes.position.array,la=sGeo.attributes.aL.array;let n=0;
  for(const o of etat.sats){const l=satLook(o,date);o.vis=null;if(!l||l.el<-.02||!LAYERS.sats)continue;o.lit=litBySun(l.p,s);o.h=l.h;o.vis=true;
    o.world.set(Math.sin(l.az)*Math.cos(l.el),Math.sin(l.el),-Math.cos(l.az)*Math.cos(l.el));if(!o.main&&!o.lit)continue;pa[n*3]=o.world.x*40;pa[n*3+1]=o.world.y*40;pa[n*3+2]=o.world.z*40;la[n]=o.main?(o.lit?2:1.6):1;n++}
  sGeo.setDrawRange(0,n);sGeo.attributes.position.needsUpdate=true;sGeo.attributes.aL.needsUpdate=true}
export function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
addEventListener('resize',resize);
