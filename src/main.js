// @ts-check
/** Point d'entrée : boucle d'animation, écran d'accueil, démarrage. */
import { $, V3, esc, toast, VERSION } from './util.js';
import { etat } from './state.js';
import { setPlace } from './pick.js';
import { bgMat, build, camera, groundMat, moon, moonMat, placeDisc, ptMat, renderer, resize, scene, starMat, sun, updateFrame, updateSats } from './scene.js';
import { BODIES, altAz, dirName, simDate } from './astro.js';
import { camDir, lookYP, oriQuat, ptrs, startCompass } from './controls.js';
import { LAYERS, geolocate } from './panels.js';
import { describe } from './catalog.js';
import { syncSlider, updClock } from './timebar.js';
import { loadSats } from './sats.js';
import { loadArt } from './art.js';
import { drawGuide, drawLabels, hud, screenOf } from './labels.js';
import { IDLE_MS, IDLE_MS_REDUCED, Signature, needsRender, perf } from './loop.js';

fetch('data/sky.json').then(r=>r.json()).then(d=>{etat.DATA=d;build()}).catch(e=>{toast('Impossible de charger le catalogue d’étoiles.')});
const _right=new V3(),_up=new V3();
const reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const sig=new Signature(20);
let raf=0,lastRender=-1e9,prevSel=null,prevSheet=false;
/** Calques en un nombre (pour l'empreinte de l'image). */
const layerBits=()=>(LAYERS.lines?1:0)|(LAYERS.names?2:0)|(LAYERS.mw?4:0)|(LAYERS.ground?8:0)|(LAYERS.sats?16:0);
/** Déplace la caméra (boussole, visée animée, inertie du glisser), au même rythme quelle que soit la cadence d'images. */
function moveCamera(now,dt){const f=dt*60;
  if(etat.mode==='compass'&&etat.ori){camera.quaternion.slerp(oriQuat(),1-Math.pow(.78,f));return}
  if(etat.aim){const k=Math.min(1,(now-etat.aim.t0)/1100),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;let dy=((etat.aim.y1-etat.aim.y0+540)%360)-180;etat.yaw=(etat.aim.y0+dy*e+360)%360;etat.pitch=etat.aim.p0+(etat.aim.p1-etat.aim.p0)*e;etat.fov=etat.aim.f0+(etat.aim.f1-etat.aim.f0)*e;if(k>=1)etat.aim=null}
  else if(!ptrs.size&&(Math.abs(etat.velY)>.001||Math.abs(etat.velP)>.001)){etat.yaw=(etat.yaw+etat.velY*f+360)%360;etat.pitch=Math.max(-89,Math.min(89,etat.pitch+etat.velP*f));const k=Math.pow(.92,f);etat.velY*=k;etat.velP*=k}
  lookYP()}
/** Quelque chose qui change l'image a-t-il bougé depuis la dernière image dessinée ? */
const sheetEl=$('#sheet');
function imageChanged(){const q=camera.quaternion,sheet=sheetEl.classList.contains('open');
  sig.begin().push(q.x).push(q.y).push(q.z).push(q.w).push(etat.fov).push(etat.offset).push(etat.obs.latitude).push(etat.obs.longitude)
    .push(layerBits()).push(innerWidth).push(innerHeight).push(etat.sats.length).push(etat.ready?1:0).push(etat.playing?1:0).push(ptrs.size);
  let c=sig.changed(1e-6);
  if(etat.sel!==prevSel||sheet!==prevSheet){prevSel=etat.sel;prevSheet=sheet;c=true}
  return c||!!etat.aim||etat.playing}
function frame(now){raf=requestAnimationFrame(frame);perf.frames++;const dt=Math.min(.1,(now-etat.lastT)/1000);etat.lastT=now;
  if(etat.playing){etat.offset+=dt*1200000;syncSlider()}
  moveCamera(now,dt);
  if(!needsRender(imageChanged(),now,lastRender,reducedMotion?IDLE_MS_REDUCED:IDLE_MS))return;
  lastRender=now;perf.renders++;
  const date=simDate();updateFrame(date);
  camera.fov=etat.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const zs=Math.max(1,Math.min(2.6,Math.sqrt(70/etat.fov)));starMat.uniforms.uS.value=zs;ptMat.uniforms.uS.value=zs;starMat.uniforms.uT.value=reducedMotion?0:now/1000;starMat.uniforms.uLim.value=6.6+Math.max(0,(40-etat.fov)/12);
  bgMat.uniforms.uMw.value=LAYERS.mw?1:0;groundMat.uniforms.uA.value=LAYERS.ground?.96:.42;if(etat.lines)etat.lines.visible=LAYERS.lines;
  const sm=BODIES[0],mn=BODIES[1];placeDisc(sun,sm.world,Math.max(.27,etat.fov*.0055),30,6);placeDisc(moon,mn.world,Math.max(.26,etat.fov*.012),29,1.9);
  const right=_right.set(1,0,0).applyQuaternion(camera.quaternion),upv=_up.set(0,1,0).applyQuaternion(camera.quaternion);
  moonMat.uniforms.uL.value.set(etat.sunWorld.dot(right),etat.sunWorld.dot(upv),-etat.sunWorld.dot(mn.world)).normalize();
  updateSats(date);
  renderer.render(scene,camera);
  drawLabels();drawGuide();
  if(now-etat.hudT>250){etat.hudT=now;const d=camDir(),aa=altAz(d);hud.innerHTML=`<b>${Math.round(aa.az)}°</b> ${esc(dirName(aa.az))} · hauteur <b>${Math.round(aa.alt)}°</b>`+(etat.mode==='compass'?' · boussole':'');updClock()}
}
/** Onglet caché : plus aucune image ni calcul ; au retour, on repart sans à-coup. */
function onVisibility(){
  if(document.visibilityState==='hidden'){cancelAnimationFrame(raf);raf=0;perf.running=false;return}
  if(!perf.running){perf.running=true;etat.lastT=performance.now();lastRender=-1e9;raf=requestAnimationFrame(frame)}}
document.addEventListener('visibilitychange',onVisibility);
resize();
setPlace(etat.place,false);
raf=requestAnimationFrame(frame);
loadSats();
/* ---------- Intro ---------- */
function endIntro(){$('#intro').classList.add('gone');setTimeout(()=>{const m=BODIES[1];if(m.alt>5){toast('La Lune est levée. Touche-la !')}},900)}
$('#goTouch').onclick=()=>{endIntro();geolocate(true)};
$('#goCompass').onclick=async()=>{endIntro();geolocate(true);await startCompass()};

$('#ver').textContent='v'+VERSION;
/** Accès pour les tests de bout en bout. */
Object.assign(window,{__ks:{etat,BODIES,LAYERS,describe,altAz,screenOf,perf,camDir,pixelRatio:()=>renderer.getPixelRatio()}});
// visuels peints (accueil, astres) : les fiches les montrent dès qu'ils sont là
loadArt().then(n=>{/** @type {any} */ (window).__ks.art=n});
