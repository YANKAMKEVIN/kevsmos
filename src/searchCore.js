// @ts-check
/** Recherche d'un astre, sans DOM : filtrage insensible aux accents et à la casse, tri par pertinence. Testé sous Node. */

/** @typedef {{o:any,t:string,s:string}} Entry  t : nom affiché, s : sous-titre (type, constellation…)
 * @typedef {Entry & {alt:number}} Result */

/** Texte sans accents, en minuscules. @param {unknown} s */
export const norm=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

/** Nombre maximal de résultats affichés. */
export const MAX_RESULTS=80;

/** Pertinence d'une entrée pour une requête normalisée (0 = nom exact, 1 = début du nom, 2 = dans le nom, 3 = dans le sous-titre).
 * @param {Entry} x @param {string} nq */
export function score(x,nq){const t=norm(x.t);return t===nq?0:t.startsWith(nq)?1:t.includes(nq)?2:3}

/** Sans requête, on ne propose que l'essentiel : Soleil, Lune, planètes, stations, étoiles très brillantes, grandes constellations.
 * @param {any} o */
export function isHighlight(o){return o.type==='body'||o.type==='sat'||(o.type==='star'&&o.mag<1)||(o.type==='cons'&&o.rank===1)}

/** Résultats d'une recherche.
 * Avec une requête : les entrées dont le nom ou le sous-titre la contiennent, les plus pertinentes d'abord (tri stable).
 * Sans requête : l'essentiel, ce qui est au-dessus de l'horizon d'abord.
 * @param {Entry[]} entries @param {string} q @param {(o:any)=>number} altOf hauteur en degrés @returns {Result[]} */
export function searchSky(entries,q,altOf){const nq=norm(q.trim());let r=entries;
  if(nq){r=r.filter(x=>norm(x.t).includes(nq)||norm(x.s).includes(nq)).map(x=>({x,k:score(x,nq)})).sort((a,b)=>a.k-b.k).map(e=>e.x)}
  else r=r.filter(x=>isHighlight(x.o));
  const out=r.map(x=>({...x,alt:altOf(x.o)}));
  if(!nq)out.sort((a,b)=>+(b.alt>0)-+(a.alt>0));
  return out.slice(0,MAX_RESULTS)}
