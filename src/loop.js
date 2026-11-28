// @ts-check
/** Économie d'énergie du rendu, sans DOM ni WebGL (testé sous Node) :
 * - densité de pixels plafonnée (moins de pixels à dessiner sur les téléphones à écran très dense) ;
 * - rendu à la demande : à pleine cadence quand quelque chose bouge (caméra, temps accéléré, boussole, visée),
 *   sinon une image tous les IDLE_MS (assez pour le scintillement des étoiles), ou une par seconde si
 *   l'utilisateur préfère réduire les animations ;
 * - pause complète quand l'onglet est caché (voir main.js). */

/** Intervalle entre deux images quand rien ne bouge (ms). */
export const IDLE_MS = 100;
/** Idem quand l'utilisateur demande moins d'animations (ms). */
export const IDLE_MS_REDUCED = 1000;

/** Densité de pixels utilisée par le rendu WebGL : 2 au plus sur ordinateur, 1,5 au plus sur écran tactile.
 * @param {number|undefined} dpr devicePixelRatio @param {boolean} coarse pointeur grossier (doigt) */
export function pixelRatio(dpr, coarse) {
  const d = Number.isFinite(dpr) && /** @type {number} */ (dpr) > 0 ? /** @type {number} */ (dpr) : 1;
  return Math.min(d, coarse ? 1.5 : 2);
}

/** Faut-il dessiner cette image ?
 * @param {boolean} changed quelque chose a bougé depuis la dernière image dessinée
 * @param {number} now @param {number} lastRender instants (ms) @param {number} idleMs */
export function needsRender(changed, now, lastRender, idleMs) {
  return changed || now - lastRender >= idleMs;
}

/** Empreinte de ce qui change l'image (caméra, temps simulé, lieu, calques, fenêtre…), comparée d'une image à l'autre. */
export class Signature {
  /** @param {number} n nombre de valeurs */
  constructor(n) { this.cur = new Float64Array(n); this.prev = new Float64Array(n).fill(NaN); this.i = 0; }
  /** Commence une nouvelle empreinte. */
  begin() { this.i = 0; return this; }
  /** @param {number} v */
  push(v) { this.cur[this.i++] = v; return this; }
  /** Vrai si l'empreinte a changé depuis le dernier appel (tolérance eps) ; garde la nouvelle. */
  changed(eps = 1e-7) {
    let diff = false;
    for (let k = 0; k < this.i; k++) if (!(Math.abs(this.cur[k] - this.prev[k]) <= eps)) { diff = true; break; }
    if (diff) this.prev.set(this.cur);
    return diff;
  }
}

/** Compteurs lus par les tests de bout en bout. */
export const perf = { frames: 0, renders: 0, running: true };
