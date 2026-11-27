// @ts-check
/** Sauvegarde versionnée (lieu d'observation, calques affichés) dans localStorage,
 * et cache des orbites de satellites (6 h).
 *
 * Règle : toute modification du format incrémente SAVE_VERSION et ajoute une étape
 * à migrate(). Une sauvegarde abîmée ou plus récente que l'appli n'est jamais
 * écrasée en silence : elle est mise de côté sous KEY + '.abimee' et l'appli repart
 * des valeurs par défaut. L'ancien format (clés kevsmos.place et kevsmos.layers) est repris une fois puis effacé. */

export const KEY = 'kevsmos.sauvegarde';
export const LEGACY_PLACE = 'kevsmos.place';
export const LEGACY_LAYERS = 'kevsmos.layers';
export const TLE_KEY = 'kevsmos.tle';
export const SAVE_VERSION = 1;
export const LAYER_KEYS = /** @type {const} */ (['lines', 'names', 'mw', 'ground', 'sats']);

/** @typedef {{name:string,lat:number,lon:number}} Place
 * @typedef {{lines:boolean,names:boolean,mw:boolean,ground:boolean,sats:boolean}} Layers
 * @typedef {{version:number,place:Place|null,layers:Layers}} SaveData */

/** @returns {SaveData} */
export function defaults() { return { version: SAVE_VERSION, place: null, layers: { lines: true, names: true, mw: true, ground: true, sats: true } }; }

/** @param {any} p @returns {p is Place} */
export function isPlace(p) {
  return !!p && typeof p === 'object' && typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 80
    && Number.isFinite(p.lat) && p.lat >= -90 && p.lat <= 90 && Number.isFinite(p.lon) && p.lon >= -180 && p.lon <= 180;
}
/** @param {any} l @returns {l is Layers} */
export function isLayers(l) {
  return !!l && typeof l === 'object' && !Array.isArray(l) && Object.keys(l).length === LAYER_KEYS.length && LAYER_KEYS.every(k => typeof l[k] === 'boolean');
}

/** Amène une sauvegarde d'une version antérieure à SAVE_VERSION ; null si inconnue ou trop récente.
 * @param {any} d @returns {any} */
export function migrate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const v = d.version;
  if (!Number.isInteger(v) || v < 1 || v > SAVE_VERSION) return null;
  const out = structuredClone(d);
  // Étapes futures, à chaîner ici :
  // if (out.version === 1) { out = v1ToV2(out); }
  return out;
}

/** @param {any} d @returns {d is SaveData} */
export function isValid(d) {
  return !!d && d.version === SAVE_VERSION && (d.place === null || isPlace(d.place)) && isLayers(d.layers) && Object.keys(d).length === 3;
}

/** Texte -> sauvegarde valide, ou null. @param {string|null} text */
export function parse(text) {
  if (text == null) return null;
  let raw;
  try { raw = JSON.parse(text); } catch { return null; }
  const d = migrate(raw);
  return isValid(d) ? d : null;
}

/** Ancien format -> format actuel ; on garde ce qui est lisible.
 * @param {string|null} place @param {string|null} layers @returns {SaveData} */
export function fromLegacy(place, layers) {
  const d = defaults();
  const read = t => { try { return JSON.parse(t || 'null'); } catch { return null; } };
  const p = read(place); if (isPlace(p)) d.place = { name: p.name, lat: p.lat, lon: p.lon };
  const l = read(layers); if (l && typeof l === 'object') for (const k of LAYER_KEYS) if (typeof l[k] === 'boolean') d.layers[k] = l[k];
  return d;
}

/** Lit la sauvegarde ; reprend l'ancien format ; repart des valeurs par défaut si elle manque ou est abîmée.
 * @param {Storage|null} store @returns {SaveData} */
export function load(store) {
  if (!store) return defaults();
  let text = null, oldP = null, oldL = null;
  try { text = store.getItem(KEY); if (text == null) { oldP = store.getItem(LEGACY_PLACE); oldL = store.getItem(LEGACY_LAYERS); } } catch { return defaults(); }
  if (text == null) {
    if (oldP == null && oldL == null) return defaults();
    const d = fromLegacy(oldP, oldL);
    if (write(store, d)) { try { store.removeItem(LEGACY_PLACE); store.removeItem(LEGACY_LAYERS); } catch { /* bloqué */ } }
    return d;
  }
  const d = parse(text);
  if (d) return d;
  try { store.setItem(KEY + '.abimee', text); store.removeItem(KEY); } catch { /* stockage plein ou bloqué */ }
  return defaults();
}

/** @param {Storage|null} store @param {SaveData} d @returns {boolean} */
export function write(store, d) {
  if (!store || !isValid(d)) return false;
  try { store.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
}

/** Le stockage du navigateur, ou null s'il est bloqué (navigation privée, iframe…). */
export function browserStore() {
  try { const s = globalThis.localStorage; s.getItem(KEY); return s; } catch { return null; }
}

/** Sauvegarde en cours (modifiée sur place, jamais remplacée). */
export const prefs = load(browserStore());
/** Écrit la sauvegarde en cours. */
export function persist() { return write(browserStore(), prefs); }

/** Cache des orbites (texte TLE et date) ; null s'il manque ou est illisible. @returns {{t:number,d:string}|null} */
export function readTle(store = browserStore()) {
  try { const c = JSON.parse(store?.getItem(TLE_KEY) || 'null'); return c && Number.isFinite(c.t) && typeof c.d === 'string' ? c : null; } catch { return null; }
}
/** @param {{t:number,d:string}} c */
export function writeTle(c, store = browserStore()) { try { store?.setItem(TLE_KEY, JSON.stringify(c)); } catch { /* plein : tant pis pour le cache */ } }
