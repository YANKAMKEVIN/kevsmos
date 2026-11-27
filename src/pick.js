// @ts-check
/** Toucher un astre : choix, fiche descriptive, visée. */
import { prefs, persist } from './save.js';
import { $, A, R2D, V3, esc, toast } from './util.js';
import { etat } from './state.js';
import { camera, showConsLines } from './scene.js';
import { BODIES, Minv, altAz, computePass, fmtDay, riseSet, wv } from './astro.js';
import { consName, describe, objWorld } from './catalog.js';

export function setPlace(p,keep=true){etat.place=p;etat.obs=new A.Observer(p.lat,p.lon,50);$('#placeName').textContent=p.name;if(keep){prefs.place=p;persist()}etat.lastBodyT=0;etat.satPass=null;computePass()}
function dirFromScreen(x,y){return new V3((x/innerWidth)*2-1,-(y/innerHeight)*2+1,.5).unproject(camera).normalize()}
function pickables(){const a=[];BODIES.forEach(b=>a.push([b,b.world,b.mag]));etat.starObjs.forEach(s=>a.push([s,wv(s.eq).clone(),s.mag]));etat.messier.forEach(m=>a.push([m,wv(m.eq).clone(),m.mag+1.5]));etat.sats.forEach(s=>{if(s.vis!=null&&s.world)a.push([s,s.world,s.main?-1:3])});return a}
export function pick(x,y){const d=dirFromScreen(x,y),thr=etat.fov*.05;let best=null,bs=1e9;
  for(const [o,w,m] of pickables()){const ang=Math.acos(Math.max(-1,Math.min(1,d.dot(w))))*R2D;if(ang>thr*1.5)continue;const sc=ang-Math.max(0,(4.5-m))*thr*.12;if(sc<bs){bs=sc;best=o}}
  if(!best){const e=d.clone().applyMatrix4(Minv);let ra=Math.atan2(e.y,e.x)*R2D;ra=(ra+360)%360;const dec=Math.asin(e.z)*R2D;const ci=A.Constellation(ra/15,dec);best=etat.consById[ci.symbol]?{...etat.consById[ci.symbol],type:'cons'}:null}
  if(best)select(best)}
export function select(o){etat.sel=o;const {title,kind,text,facts}=describe(o);
  $('#sheetBody').innerHTML=`<h2>${esc(title)}</h2><div class="kind">${esc(kind)}</div><p>${esc(text)}</p><div class="facts">${facts}</div><div class="acts"><button class="btn" id="aimB">${etat.mode==='compass'?'Me guider':'Viser'}</button></div>`;
  $('#aimB').onclick=()=>aimAt(o);
  $('#sheet').classList.add('open');
  if(o.type==='cons')showConsLines(o.id);else showConsLines(o.c||null);
}
export function aimAt(o,keep){etat.sel=o;if(!keep)$('#sheet').classList.remove('open');const aa=altAz(objWorld(o));
  if(aa.alt<-1){const rs=o.type==='body'?riseSet(o.id):null;toast(`${o.fr||o.name||consName(o.id)} : sous l’horizon pour l’instant${rs&&rs.r?', lever à '+fmtDay(rs.r):''}. Je te montre où, à travers le sol.`,4500)}
  if(etat.mode==='compass'){toast('Suis la flèche et tourne-toi.');return}
  const f1=o.type==='cons'?Math.max(etat.fov,55):Math.min(etat.fov,o.type==='body'&&o.id==='Moon'?30:45);etat.aim={y0:etat.yaw,p0:etat.pitch,y1:aa.az,p1:Math.max(-14,Math.min(85,aa.alt-(keep?f1*.22:0))),t0:performance.now(),f0:etat.fov,f1}}
$('#x').onclick=()=>{$('#sheet').classList.remove('open');etat.sel=null;showConsLines(null)};
