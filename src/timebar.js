// @ts-check
/** Voyage dans le temps : curseur, une heure en arrière, accéléré, maintenant. */
import { $, esc } from './util.js';
import { etat } from './state.js';
import { fmtT, simDate } from './astro.js';

/* ---------- Temps ---------- */
const slider=$('#slider');
slider.oninput=()=>{etat.playing=false;$('#tPlay').textContent='▶';etat.offset=+slider.value*60000};
$('#tMinus').onclick=()=>{etat.offset-=3600000;syncSlider()};
$('#tNow').onclick=()=>{etat.offset=0;etat.playing=false;$('#tPlay').textContent='▶';syncSlider()};
$('#tPlay').onclick=()=>{etat.playing=!etat.playing;$('#tPlay').textContent=etat.playing?'❚❚':'▶'};
export function syncSlider(){slider.value=Math.max(-720,Math.min(720,Math.round(etat.offset/60000)))}
export function updClock(){const d=simDate();$('#clock').innerHTML=`${esc(fmtT(d))}<small>${esc(Math.abs(etat.offset)<60000?'maintenant':d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}))}</small>`}
