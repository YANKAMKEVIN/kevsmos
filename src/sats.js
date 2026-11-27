// @ts-check
/** Satellites : orbites CelesTrak (cache de 6 h), ISS et Tiangong. */
import { readTle, writeTle } from './save.js';
import { etat } from './state.js';
import { addSatLabel } from './labels.js';
import { computePass, parseTle } from './astro.js';

/* ---------- Satellites (CelesTrak) ---------- */
export async function loadSats(){if(typeof satellite==='undefined')return;let txt=null;const c=readTle();
  if(c&&Date.now()-c.t<6*3600e3)txt=c.d;else{try{const [a,b]=await Promise.all(['stations','visual'].map(g=>fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP='+g+'&FORMAT=tle').then(r=>{if(!r.ok)throw 0;return r.text()})));txt=a+'\n'+b;writeTle({t:Date.now(),d:txt})}catch(e){if(c)txt=c.d}}
  if(!txt){return}
  etat.sats=parseTle(txt);etat.sats.forEach(s=>{if(s.main)addSatLabel(s)});computePass()}
