// @ts-check
/** Petits outils : raccourci $, bibliothèques (Astronomy Engine, three.js), textes, échappement, message. */

/** Version de l'appli, affichée sur l'accueil. */
export const VERSION='1.1.0';
/** @type {(s:string)=>any} */
export const $=s=>document.querySelector(s), A=Astronomy, D2R=Math.PI/180, R2D=180/Math.PI, V3=THREE.Vector3;
export const TXT=globalThis.KEV_TXT||{cons:{},stars:{},bodies:{},dso:{}};
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const norm=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
let toastT;
export function toast(m,ms=3800){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),ms)}
