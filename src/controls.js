// @ts-check
/** Caméra : boussole du téléphone, glisser et pincer au doigt, molette, clavier. */
import { $, D2R, R2D, V3, toast } from './util.js';
import { camera } from './scene.js';
/** Le canvas du ciel (pris dans la page : scene.js n'est peut-être pas encore évalué, import circulaire). */
const canvas=/** @type {HTMLCanvasElement} */ (document.getElementById('c'));
import { etat } from './state.js';
import { pick } from './pick.js';
import { closeAll } from './panels.js';

const qT=new THREE.Quaternion(),qTmp=new THREE.Quaternion(),eul=new THREE.Euler(),zee=new V3(0,0,1),q1=new THREE.Quaternion(-Math.sqrt(.5),0,0,Math.sqrt(.5));
function onOri(e,abs){if(e.alpha==null)return;let a=e.alpha;
  if(!abs&&e.webkitCompassHeading!=null&&e.webkitCompassAccuracy!==-1){const tgt=((360-e.webkitCompassHeading)-e.alpha+720)%360;
    if(etat.compassOff==null)etat.compassOff=tgt;else{let dd=((tgt-etat.compassOff+540)%360)-180;etat.compassOff=(etat.compassOff+dd*.08+360)%360}a=e.alpha+etat.compassOff}
  etat.ori={a,b:e.beta,g:e.gamma,abs:abs||e.webkitCompassHeading!=null};etat.lastOri=performance.now()}
addEventListener('deviceorientationabsolute',e=>{etat.absOK=true;onOri(e,true)});
addEventListener('deviceorientation',e=>{if(!etat.absOK)onOri(e,!!e.absolute)});
export function oriQuat(){const so=((screen.orientation&&screen.orientation.angle)||window.orientation||0)*D2R;
  eul.set(etat.ori.b*D2R,etat.ori.a*D2R,-etat.ori.g*D2R,'YXZ');qT.setFromEuler(eul);qT.multiply(q1);qT.multiply(qTmp.setFromAxisAngle(zee,-so));return qT}
export function camDir(){return new V3(0,0,-1).applyQuaternion(camera.quaternion)}
function syncYP(){const d=camDir();etat.yaw=(Math.atan2(d.x,-d.z)*R2D+360)%360;etat.pitch=Math.asin(Math.max(-1,Math.min(1,d.y)))*R2D}
export function lookYP(){const az=etat.yaw*D2R,al=etat.pitch*D2R;camera.up.set(0,1,0);camera.lookAt(Math.sin(az)*Math.cos(al),Math.sin(al),-Math.cos(az)*Math.cos(al))}
export function setMode(m){etat.mode=m;$('#bCompass').classList.toggle('on',m==='compass');if(m==='touch')syncYP()}
export const ptrs=new Map();
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});etat.moved=0;etat.downT=performance.now();etat.velY=etat.velP=0;etat.aim=null;
  if(ptrs.size===2){const [a,b]=[...ptrs.values()];etat.pinch0=Math.hypot(a.x-b.x,a.y-b.y);etat.fov0=etat.fov}});
canvas.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;etat.moved+=Math.abs(dx)+Math.abs(dy);
  if(ptrs.size===2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(etat.pinch0)etat.fov=Math.max(8,Math.min(100,etat.fov0*etat.pinch0/d));return}
  if(etat.moved>6){if(etat.mode==='compass'){setMode('touch');toast('Mode doigt. Touche la boussole pour revenir.')}
    const k=etat.fov/innerHeight;etat.velY=-dx*k;etat.velP=dy*k;etat.yaw=(etat.yaw+etat.velY+360)%360;etat.pitch=Math.max(-89,Math.min(89,etat.pitch+etat.velP))}});
const up=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)etat.pinch0=0;if(etat.moved<8&&performance.now()-etat.downT<500&&ptrs.size===0)pick(e.clientX,e.clientY)};
canvas.addEventListener('pointerup',up);
canvas.addEventListener('pointercancel',e=>{ptrs.delete(e.pointerId)});
canvas.addEventListener('wheel',e=>{e.preventDefault();etat.fov=Math.max(8,Math.min(100,etat.fov*Math.exp(e.deltaY*.001)))},{passive:false});
addEventListener('keydown',e=>{if(/** @type {any} */ (e.target).tagName==='INPUT')return;const k={ArrowLeft:[-3,0],ArrowRight:[3,0],ArrowUp:[0,3],ArrowDown:[0,-3]}[e.key];if(k){if(etat.mode==='compass')setMode('touch');etat.yaw=(etat.yaw+k[0]+360)%360;etat.pitch=Math.max(-89,Math.min(89,etat.pitch+k[1]))}if(e.key==='Escape')closeAll()});
export async function startCompass(){
  try{if(typeof DeviceOrientationEvent!=='undefined'&&/** @type {any} */ (DeviceOrientationEvent).requestPermission){const r=await /** @type {any} */ (DeviceOrientationEvent).requestPermission();if(r!=='granted')throw 0}}catch(e){toast('Ton navigateur refuse l’accès à la boussole ici. Glisse ton doigt pour explorer.',5000);return false}
  const t0=performance.now();await new Promise(r=>setTimeout(r,1200));
  if(!etat.ori||etat.lastOri<t0){toast('Pas de boussole disponible ici (ordinateur ou navigateur protégé). Glisse ton doigt pour explorer.',5500);setMode('touch');return false}
  if(!etat.ori.abs)toast('Boussole relative : le nord peut être décalé. Fais un 8 avec ton téléphone pour la calibrer.',5000);
  setMode('compass');return true}
