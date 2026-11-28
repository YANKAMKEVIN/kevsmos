// @ts-check
/** Calculs du ciel sans DOM ni WebGL : coordonnées, couleurs d'étoiles, phases, lever et coucher, satellites. Testé sous Node. */
import { A, D2R, R2D, V3 } from './util.js';
import { etat } from './state.js';

export const M=new THREE.Matrix4(),Minv=new THREE.Matrix4(),toEq=new THREE.Matrix3();
export function eqVec(raDeg,decDeg,r=1){const a=raDeg*D2R,d=decDeg*D2R;return new V3(Math.cos(d)*Math.cos(a)*r,Math.cos(d)*Math.sin(a)*r,Math.sin(d)*r)}
export const NGP=eqVec(192.85948,27.12825),GC=eqVec(266.40499,-28.93617),GL=new V3().crossVectors(NGP,GC);
/* étoiles */
export function bvRGB(bv){bv=Math.max(-.4,Math.min(2,bv));const T=4600*(1/(.92*bv+1.7)+1/(.92*bv+.62)),t=T/100;let r,g,b;
if(t<=66){r=255;g=99.47*Math.log(t)-161.12;b=t<=19?0:138.52*Math.log(t-10)-305.04}else{r=329.7*Math.pow(t-60,-.1332);g=288.12*Math.pow(t-60,-.0755);b=255}
const c=[r,g,b].map(v=>Math.max(0,Math.min(255,v))/255);const m=(c[0]+c[1]+c[2])/3;return c.map(v=>m+(v-m)*.85)}
/* planètes, Lune, Soleil */
/** Soleil, Lune et planètes (positions mises à jour à chaque instant). @type {any[]} */
export const BODIES=[['Sun','Soleil','#fff3d6'],['Moon','Lune','#f4f1ea'],['Mercury','Mercure','#d8cfc4'],['Venus','Vénus','#fff6e0'],['Mars','Mars','#ff9b6b'],['Jupiter','Jupiter','#ffe7c2'],['Saturn','Saturne','#ffe2a8'],['Uranus','Uranus','#b8f1ff'],['Neptune','Neptune','#8fb4ff']].map(([id,fr,col])=>({id,fr,col,type:'body',world:new V3(),eq:new V3(),alt:0,az:0,mag:0,dist:0}));
export const planets=BODIES.slice(2);
/* satellites */
export const SAT_MAX=200;
const _w=new V3();
export function wv(eq){return _w.copy(eq).applyMatrix4(M)}
export const simDate=()=>new Date(Date.now()+etat.offset);
export function altAz(w){return{alt:Math.asin(Math.max(-1,Math.min(1,w.y)))*R2D,az:(Math.atan2(w.x,-w.z)*R2D+360)%360}}
const DIRS=['nord','nord-est','est','sud-est','sud','sud-ouest','ouest','nord-ouest'];
export const dirName=az=>DIRS[Math.round(az/45)%8];
export const fmtT=d=>d?d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'—';
export const fmtDay=d=>{if(!d)return'—';const n=simDate();const same=d.toDateString()===n.toDateString();return(same?'':d.toLocaleDateString('fr-FR',{weekday:'short'})+' ')+fmtT(d)};
export function riseSet(id){const t=A.MakeTime(simDate());let r=null,s=null;try{r=A.SearchRiseSet(id,etat.obs,+1,t,1.2)}catch(e){}try{s=A.SearchRiseSet(id,etat.obs,-1,t,1.2)}catch(e){}return{r:r&&r.date,s:s&&s.date}}
export const nf=(x,d=0)=>x.toLocaleString('fr-FR',{maximumFractionDigits:d,minimumFractionDigits:d});
export function phaseName(p){if(p<8||p>352)return'Nouvelle lune';if(p<82)return'Premier croissant';if(p<98)return'Premier quartier';if(p<172)return'Gibbeuse croissante';if(p<188)return'Pleine lune';if(p<262)return'Gibbeuse décroissante';if(p<278)return'Dernier quartier';return'Dernier croissant'}
export function colorName(bv){return bv<0?'bleue':bv<.3?'bleu-blanc':bv<.6?'blanche':bv<.85?'jaune':bv<1.4?'orange':'rouge'}
export function parseTle(txt){const out=[];const L=txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),seen=new Set();
  for(let i=0;i+2<L.length+1;i++){if(L[i+1]&&L[i+1].startsWith('1 ')&&L[i+2]&&L[i+2].startsWith('2 ')){const name=L[i],id=L[i+1].slice(2,7);if(!seen.has(id)){seen.add(id);
    const main=/ISS \(ZARYA\)/.test(name)?'iss':/CSS \(TIANHE\)/.test(name)?'css':null;
    try{const rec=satellite.twoline2satrec(L[i+1],L[i+2]);out.push({type:'sat',key:main,main:!!main,short:main==='iss'?'ISS':main==='css'?'Tiangong':name,fr:main==='iss'?'Station spatiale internationale':main==='css'?'Station Tiangong':name,rec,world:new V3()})}catch(e){}}i+=2}}
  out.sort((a,b)=>+b.main-+a.main);return out.slice(0,SAT_MAX)}
export function satLook(s,date){const pv=satellite.propagate(s.rec,date);if(!pv||!pv.position)return null;const gm=satellite.gstime(date);const ecf=satellite.eciToEcf(pv.position,gm);
  const la=satellite.ecfToLookAngles({longitude:etat.obs.longitude*D2R,latitude:etat.obs.latitude*D2R,height:.05},ecf);return{az:la.azimuth,el:la.elevation,p:pv.position,h:Math.hypot(pv.position.x,pv.position.y,pv.position.z)-6371}}
export function sunEci(date){const v=A.GeoVector('Sun',A.MakeTime(date),true);const n=Math.hypot(v.x,v.y,v.z);return{x:v.x/n,y:v.y/n,z:v.z/n}}
export function litBySun(p,s){const d=p.x*s.x+p.y*s.y+p.z*s.z;if(d>0)return true;const px=p.x-d*s.x,py=p.y-d*s.y,pz=p.z-d*s.z;return Math.hypot(px,py,pz)>6371}
/** Prochain passage visible de l'ISS dans les 24 h après t0 (au moins 10° de haut, ciel de nuit, station éclairée) -> etat.satPass.
 * @param {number} [t0] instant de départ (ms) */
export function computePass(t0=Date.now()){const iss=etat.sats.find(s=>s.key==='iss');if(!iss){etat.satPass=null;return}
  for(let k=0;k<24*180;k++){const d=new Date(t0+k*20000);const l=satLook(iss,d);if(!l||l.el<10*D2R)continue;const t=A.MakeTime(d);const sh=A.Horizon(t,etat.obs,...(e=>[e.ra,e.dec])(A.Equator('Sun',t,etat.obs,true,true)));if(sh.altitude>-6)continue;if(!litBySun(l.p,sunEci(d)))continue;
    etat.satPass={t:d,dir:'vers le '+dirName(l.az*R2D)};return}etat.satPass=null}

/** Oriente le ciel pour une date et le lieu choisi (matrices M, Minv, toEq) ; renvoie le temps astronomique.
 * @param {Date} date */
export function orient(date){
  const t=A.MakeTime(date),R=A.Rotation_EQJ_HOR(t,etat.obs).rot;
  M.set(-R[0][1],-R[1][1],-R[2][1],0, R[0][2],R[1][2],R[2][2],0, -R[0][0],-R[1][0],-R[2][0],0, 0,0,0,1);
  Minv.copy(M).transpose();toEq.setFromMatrix4(Minv);
  return t}
/** Positions, hauteur, direction et éclat du Soleil, de la Lune et des planètes (après orient). @param {any} t */
export function computeBodies(t){
  BODIES.forEach(b=>{const e=A.Equator(b.id,t,etat.obs,false,true);b.dist=e.dist;b.ra=e.ra*15;b.dec=e.dec;b.eq.copy(eqVec(b.ra,b.dec));b.world.copy(b.eq).applyMatrix4(M);
    b.alt=Math.asin(b.world.y)*R2D;b.az=(Math.atan2(b.world.x,-b.world.z)*R2D+360)%360;
    try{b.mag=A.Illumination(b.id,t).mag}catch(_){b.mag=-26.7}})}
