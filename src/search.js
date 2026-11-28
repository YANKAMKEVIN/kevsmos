// @ts-check
/** Recherche d'un astre. */
import { $, esc } from './util.js';
import { searchSky } from './searchCore.js';
import { etat } from './state.js';
import { BODIES, altAz } from './astro.js';
import { objWorld, searchEntries } from './catalog.js';
import { aimAt, select } from './pick.js';
import { closeAll } from './panels.js';

export function buildSearch(){etat.SEARCH=searchEntries(BODIES);renderSearch('')}
export function renderSearch(q){const r=searchSky(etat.SEARCH.concat(etat.sats.filter(s=>s.main).map(s=>({o:s,t:s.fr,s:'Station spatiale'}))),q,o=>altAz(objWorld(o)).alt);
  $('#results').innerHTML=r.map((x,i)=>`<button class="it" data-i="${i}"><span>${esc(x.t)}<br><small>${esc(x.s)}</small></span><small class="${x.alt>0?'up':''}">${x.alt>0?'visible, '+Math.round(x.alt)+'°':'sous l’horizon'}</small></button>`).join('')||'<p class="note">Rien trouvé. Essaie « Lune », « Orion » ou « Sirius ».</p>';
  $('#results').onclick=e=>{const b=e.target.closest('.it');if(!b)return;const x=r[+b.dataset.i];closeAll();select(x.o);aimAt(x.o,true)}}
$('#q').oninput=e=>renderSearch(e.target.value);
