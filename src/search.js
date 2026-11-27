// @ts-check
/** Recherche d'un astre. */
import { $, esc, norm } from './util.js';
import { etat } from './state.js';
import { BODIES, altAz } from './astro.js';
import { DSO_T, MES_FR, consName, objWorld } from './catalog.js';
import { aimAt, select } from './pick.js';
import { closeAll } from './panels.js';

export function buildSearch(){etat.SEARCH=[...BODIES.map(b=>({o:b,t:b.fr,s:b.id==='Sun'?'Étoile':b.id==='Moon'?'Satellite naturel':'Planète'})),
  ...etat.starObjs.filter(s=>s.proper).map(s=>({o:s,t:s.name,s:'Étoile · '+consName(s.c)})),
  ...Object.values(etat.consById).map(c=>({o:{...c,type:'cons'},t:consName(c.id),s:'Constellation · '+c.la})),
  ...etat.messier.map(m=>({o:m,t:m.name,s:(DSO_T[m.t]||'Galaxie')+(MES_FR[m.id]?' · '+m.id:'')}))];renderSearch('')}
export function renderSearch(q){const nq=norm(q.trim());let r=etat.SEARCH.concat(etat.sats.filter(s=>s.main).map(s=>({o:s,t:s.fr,s:'Station spatiale'})));
  if(nq){r=r.filter(x=>norm(x.t).includes(nq)||norm(x.s).includes(nq));const sc=x=>{const t=norm(x.t);return t===nq?0:t.startsWith(nq)?1:t.includes(nq)?2:3};r.sort((a,b)=>sc(a)-sc(b))}
  r=r.map(x=>({...x,alt:altAz(objWorld(x.o)).alt}));if(!nq)r=r.filter(x=>x.o.type==='body'||x.o.type==='sat'||(x.o.type==='star'&&x.o.mag<1)||(x.o.type==='cons'&&x.o.rank===1)).sort((a,b)=>+(b.alt>0)-+(a.alt>0));
  $('#results').innerHTML=r.slice(0,80).map((x,i)=>`<button class="it" data-i="${i}"><span>${esc(x.t)}<br><small>${esc(x.s)}</small></span><small class="${x.alt>0?'up':''}">${x.alt>0?'visible, '+Math.round(x.alt)+'°':'sous l’horizon'}</small></button>`).join('')||'<p class="note">Rien trouvé. Essaie « Lune », « Orion » ou « Sirius ».</p>';
  $('#results').onclick=e=>{const b=e.target.closest('.it');if(!b)return;const x=r[+b.dataset.i];closeAll();select(x.o);aimAt(x.o,true)}}
$('#q').oninput=e=>renderSearch(e.target.value);
