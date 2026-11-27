// @ts-check
/** Étiquettes à l'écran (astres, points cardinaux), anneau de sélection et flèche de guidage. */
import { $, D2R, V3 } from './util.js';
import { camera } from './scene.js';
import { etat } from './state.js';
import { BODIES, wv } from './astro.js';
import { consName, objWorld } from './catalog.js';
import { camDir } from './controls.js';
import { LAYERS } from './panels.js';

/* ---------- Étiquettes ---------- */
const LBL=[];
const labelsEl=$('#labels');
function addLabel(text,cls,getWorld,obj){const el=document.createElement('div');el.className='lb '+cls;el.textContent=text;labelsEl.appendChild(el);const L={el,cls,getWorld,obj,on:true};LBL.push(L);return L}
/** @type {[string,number][]} */
const CARD=[['N',0],['NE',45],['E',90],['SE',135],['S',180],['SO',225],['O',270],['NO',315]];
export function makeLabels(){
  CARD.forEach(([t,a])=>{const w=new V3(Math.sin(a*D2R),.012,-Math.cos(a*D2R));addLabel(t,'card'+(t==='N'?' n':''),()=>w)});
  BODIES.forEach(b=>addLabel(b.fr,'body',()=>b.world,b));
  etat.starObjs.filter(s=>s.proper&&s.mag<1.9).forEach(s=>addLabel(s.name,'star',()=>wv(s.eq),s));
  Object.values(etat.consById).forEach(c=>{const L=addLabel(consName(c.id),'cons',()=>wv(c.eq),c);L.rank=c.rank});
  etat.messier.filter(m=>['M31','M42','M45'].includes(m.id)).forEach(m=>addLabel(m.name,'dso',()=>wv(m.eq),m));
}
export function addSatLabel(s){s.label=addLabel(s.short,'sat',()=>s.world,s)}
/* ---------- Boucle ---------- */
export const guide=$('#guide'),ring=$('#ring'),hud=$('#hud');
const _p=new V3();
export function screenOf(w){_p.copy(w).project(camera);const front=camDir().dot(w)>0;return{x:(_p.x+1)/2*innerWidth,y:(1-_p.y)/2*innerHeight,front}}
export function drawLabels(){const cd=camDir();const showN=LAYERS.names;
  for(const L of LBL){let ok=true;if(L.cls==='cons')ok=showN&&LAYERS.lines&&(L.rank<=2||etat.fov<45);else if(L.cls==='star'||L.cls==='dso')ok=showN&&(L.cls!=='dso'||etat.fov<60);else if(L.cls==='sat')ok=LAYERS.sats&&L.obj.vis;
    let w=ok&&L.getWorld();if(ok&&w){const dot=cd.dot(w);if(dot<Math.cos((etat.fov*.5+20)*D2R))ok=false;
      else{const alt=w.y;if(L.cls!=='card'&&alt<-.01&&LAYERS.ground)ok=false;}}
    if(ok){const s=screenOf(w);if(!s.front||s.x<-80||s.x>innerWidth+20||s.y<-20||s.y>innerHeight+20)ok=false;else{const off=L.cls==='body'?(L.obj.id==='Moon'?Math.max(.26,etat.fov*.012)/etat.fov*innerHeight+8:12):8;L.el.style.transform=`translate(${(s.x+(L.cls==='card'?-6:off)).toFixed(1)}px,${(s.y+(L.cls==='card'?-26:-8)).toFixed(1)}px)`}}
    if(ok!==L.on){L.el.style.display=ok?'':'none';L.on=ok}}
  if(etat.sel){const s=screenOf(objWorld(etat.sel));if(s.front&&s.x>0&&s.x<innerWidth&&s.y>0&&s.y<innerHeight&&etat.sel.type!=='cons'){ring.style.display='block';ring.style.transform=`translate(${s.x}px,${s.y}px)`}else ring.style.display='none'}else ring.style.display='none'}
export function drawGuide(){if(!etat.sel||$('#sheet').classList.contains('open')){guide.style.display='none';return}const w=objWorld(etat.sel),s=screenOf(w);
  const inView=s.front&&s.x>30&&s.x<innerWidth-30&&s.y>90&&s.y<innerHeight-150;if(inView){guide.style.display='none';return}
  const cx=innerWidth/2,cy=innerHeight/2;let dx=s.x-cx,dy=s.y-cy;if(!s.front){dx=-dx;dy=-dy}if(!s.front&&Math.hypot(dx,dy)<1){dx=1}
  const ang=Math.atan2(dy,dx),rx=innerWidth/2-56,ry=innerHeight/2-140,k=Math.min(rx/Math.abs(Math.cos(ang)||1e-6),ry/Math.abs(Math.sin(ang)||1e-6));
  guide.style.display='flex';guide.style.transform=`translate(${cx+Math.cos(ang)*k-17}px,${cy+Math.sin(ang)*k-17}px)`;guide.querySelector('svg').style.transform=`rotate(${ang}rad)`;
  guide.querySelector('span').textContent=etat.sel.fr||etat.sel.name||consName(etat.sel.id)}
