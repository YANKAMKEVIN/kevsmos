// @ts-check
/** Panneaux : recherche, lieu, calques. */
import { prefs, persist } from './save.js';
import { $, esc, norm, toast } from './util.js';
import { CITIES } from './places.js';
import { setPlace } from './pick.js';
import { etat } from './state.js';
import { setMode, startCompass } from './controls.js';
import { renderSearch } from './search.js';

/* ---------- Panneaux ---------- */
export function closeAll(){document.querySelectorAll('.panel').forEach(p=>p.classList.remove('open'))}
document.querySelectorAll('.panel .close').forEach(b=>{/** @type {HTMLElement} */ (b).onclick=closeAll});
$('#bSearch').onclick=()=>{closeAll();renderSearch($('#q').value);$('#pSearch').classList.add('open');setTimeout(()=>$('#q').focus(),50)};
$('#where').onclick=()=>{closeAll();renderCities('');$('#pPlace').classList.add('open')};
$('#bLayers').onclick=()=>{closeAll();$('#pLayers').classList.add('open')};
$('#bCompass').onclick=async()=>{if(etat.mode==='compass'){setMode('touch');return}await startCompass()};
function renderCities(q){const nq=norm(q);const r=CITIES.filter(c=>!nq||norm(c[0]+' '+c[1]).includes(nq));
  $('#cities').innerHTML=r.map((c,i)=>`<button class="it" data-i="${i}"><span>${esc(c[0])}</span><small>${esc(c[1])}</small></button>`).join('');
  $('#cities').onclick=e=>{const b=e.target.closest('.it');if(!b)return;const c=r[+b.dataset.i];setPlace({name:c[0],lat:c[2],lon:c[3]});closeAll();toast('Ciel vu depuis '+c[0]+'.')}}
$('#qc').oninput=e=>renderCities(e.target.value);
export function geolocate(quiet){return new Promise(res=>{if(!navigator.geolocation){if(!quiet)toast('Position indisponible ici. Choisis une ville.');return res(false)}
  navigator.geolocation.getCurrentPosition(p=>{const la=p.coords.latitude,lo=p.coords.longitude;setPlace({name:'Ma position',lat:+la.toFixed(3),lon:+lo.toFixed(3)});res(true)},
  ()=>{if(!quiet)toast('Position refusée ou indisponible ici. Choisis une ville dans la liste.',4500);res(false)},{enableHighAccuracy:false,timeout:8000,maximumAge:600000})})}
$('#geo').onclick=async()=>{if(await geolocate(false)){closeAll();toast('Ciel calé sur ta position.')}};
export const LAYERS=prefs.layers;
const TG=[['lines','Tracés des constellations'],['names','Noms'],['mw','Voie lactée'],['ground','Sol opaque'],['sats','Satellites']];
$('#toggles').innerHTML=TG.map(([k,t])=>`<button class="tg" data-k="${k}" aria-pressed="${!!LAYERS[k]}"><span>${t}</span><span></span></button>`).join('');
$('#toggles').onclick=e=>{const b=e.target.closest('.tg');if(!b)return;const k=b.dataset.k;LAYERS[k]=!LAYERS[k];b.setAttribute('aria-pressed',LAYERS[k]);persist()};
