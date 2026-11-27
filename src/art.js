// @ts-check
/**
 * Visuels peints avec Codex (dossier art/, prompts dans tools/art/prompts.json).
 * Le jeu reste jouable sans eux : tant qu'une image n'est pas chargée, le dessin
 * procédural d'origine prend le relais.
 */

export const ART_FILES = /** @type {const} */ ([
  'titre', 'soleil', 'lune', 'mercure', 'venus', 'mars', 'jupiter', 'saturne', 'uranus', 'neptune',
  'iss', 'etoile', 'nebuleuse',
]);

/** @type {Record<string, string>} visuel de chaque astre du système solaire */
const BODY_ART = { Sun: 'soleil', Moon: 'lune', Mercury: 'mercure', Venus: 'venus', Mars: 'mars', Jupiter: 'jupiter', Saturn: 'saturne', Uranus: 'uranus', Neptune: 'neptune' };

/**
 * Nom du visuel à montrer sur la fiche d'un objet, ou null.
 * @param {{type:string,id?:string,key?:string}} o
 * @returns {string|null}
 */
export function artFor(o) {
  if (o.type === 'body') return BODY_ART[o.id || ''] || null;
  if (o.type === 'sat') return o.key === 'iss' ? 'iss' : null;
  if (o.type === 'star') return 'etoile';
  if (o.type === 'dso') return 'nebuleuse';
  return null;
}

/** @type {Map<string, HTMLImageElement>} */
const loaded = new Map();

/**
 * Charge tous les visuels. Se résout quand tout est chargé, ou au bout de `maxMs`
 * (une image lente ou absente ne bloque jamais le jeu).
 * @param {number} [maxMs]
 * @returns {Promise<number>} nombre d'images prêtes
 */
export function loadArt(maxMs = 4000) {
  const all = ART_FILES.map(name => new Promise(res => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { loaded.set(name, im); res(true); };
    im.onerror = () => res(false);
    im.src = `art/${name}.webp`;
  }));
  return Promise.race([
    Promise.all(all),
    new Promise(res => setTimeout(res, maxMs)),
  ]).then(() => loaded.size);
}

/**
 * L'image si elle est prête, sinon null.
 * @param {string} name
 * @returns {HTMLImageElement|null}
 */
export function art(name) { return loaded.get(name) || null; }
