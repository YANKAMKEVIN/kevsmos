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

fetch('data/sky.json').then(r=>r.json()).then(d=>{etat.DATA=d;build()}).catch(e=>{toast('Impossible de charger le catalogue d’étoiles.')});
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.1,(now-etat.lastT)/1000);etat.lastT=now;
  if(etat.playing){etat.offset+=dt*1200000;syncSlider()}
  const date=simDate();updateFrame(date);
  if(etat.mode==='compass'&&etat.ori){camera.quaternion.slerp(oriQuat(),.22)}
  else{if(etat.aim){const k=Math.min(1,(now-etat.aim.t0)/1100),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;let dy=((etat.aim.y1-etat.aim.y0+540)%360)-180;etat.yaw=(etat.aim.y0+dy*e+360)%360;etat.pitch=etat.aim.p0+(etat.aim.p1-etat.aim.p0)*e;etat.fov=etat.aim.f0+(etat.aim.f1-etat.aim.f0)*e;if(k>=1)etat.aim=null}
    else if(!ptrs.size&&(Math.abs(etat.velY)>.001||Math.abs(etat.velP)>.001)){etat.yaw=(etat.yaw+etat.velY+360)%360;etat.pitch=Math.max(-89,Math.min(89,etat.pitch+etat.velP));etat.velY*=.92;etat.velP*=.92}
    lookYP()}
  camera.fov=etat.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const zs=Math.max(1,Math.min(2.6,Math.sqrt(70/etat.fov)));starMat.uniforms.uS.value=zs;ptMat.uniforms.uS.value=zs;starMat.uniforms.uT.value=now/1000;starMat.uniforms.uLim.value=6.6+Math.max(0,(40-etat.fov)/12);
  bgMat.uniforms.uMw.value=LAYERS.mw?1:0;groundMat.uniforms.uA.value=LAYERS.ground?.96:.42;if(etat.lines)etat.lines.visible=LAYERS.lines;
  const sm=BODIES[0],mn=BODIES[1];placeDisc(sun,sm.world,Math.max(.27,etat.fov*.0055),30,6);placeDisc(moon,mn.world,Math.max(.26,etat.fov*.012),29,1.9);
  const right=new V3(1,0,0).applyQuaternion(camera.quaternion),upv=new V3(0,1,0).applyQuaternion(camera.quaternion);
  moonMat.uniforms.uL.value.set(etat.sunWorld.dot(right),etat.sunWorld.dot(upv),-etat.sunWorld.dot(mn.world)).normalize();
  updateSats(date);
  renderer.render(scene,camera);
  drawLabels();drawGuide();
  if(now-etat.hudT>250){etat.hudT=now;const d=camDir(),aa=altAz(d);hud.innerHTML=`<b>${Math.round(aa.az)}°</b> ${esc(dirName(aa.az))} · hauteur <b>${Math.round(aa.alt)}°</b>`+(etat.mode==='compass'?' · boussole':'');updClock()}
}
resize();
setPlace(etat.place,false);
requestAnimationFrame(frame);
loadSats();
/* ---------- Intro ---------- */
function endIntro(){$('#intro').classList.add('gone');setTimeout(()=>{const m=BODIES[1];if(m.alt>5){toast('La Lune est levée. Touche-la !')}},900)}
$('#goTouch').onclick=()=>{endIntro();geolocate(true)};
$('#goCompass').onclick=async()=>{endIntro();geolocate(true);await startCompass()};

$('#ver').textContent='v'+VERSION;
/** Accès pour les tests de bout en bout. */
Object.assign(window,{__ks:{etat,BODIES,LAYERS,describe,altAz,screenOf}});
// visuels peints (accueil, astres) : les fiches les montrent dès qu'ils sont là
loadArt().then(n=>{/** @type {any} */ (window).__ks.art=n});
