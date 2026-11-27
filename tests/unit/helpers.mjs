// Outils communs : on charge les mêmes bibliothèques que la page (three.js, Astronomy Engine, satellite.js, textes),
// puis les vrais modules de calcul (src/astro.js, src/catalog.js), sans navigateur ni WebGL.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
globalThis.window = globalThis;
for (const f of ['lib/three.min.js', 'lib/astronomy.browser.min.js', 'lib/satellite.min.js', 'data/histoires.js'])
  vm.runInThisContext(readFileSync(new URL(f, root), 'utf8'), { filename: f });

export const { etat } = await import('../../src/state.js');
export const astro = await import('../../src/astro.js');
export const catalog = await import('../../src/catalog.js');
export const places = await import('../../src/places.js');
etat.DATA = JSON.parse(readFileSync(new URL('data/sky.json', root), 'utf8'));
catalog.parseCatalog();

/** Se place quelque part, à une date, et calcule le ciel. */
export function skyAt(lat, lon, date, name = 'test') {
  etat.place = { name, lat, lon }; etat.obs = new Astronomy.Observer(lat, lon, 50);
  etat.offset = date.getTime() - Date.now();
  const t = astro.orient(date); astro.computeBodies(t);
  return t;
}
export const body = id => astro.BODIES.find(b => b.id === id);
export const star = name => etat.starObjs.find(s => s.proper === name);
/** Hauteur et direction d'un objet du catalogue (coordonnées équatoriales). */
export const altAzOf = o => astro.altAz(astro.wv(o.eq).clone());

export function memStore(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k),
    key: i => [...m.keys()][i] ?? null, get length() { return m.size; }, m,
  };
}
// TLE de l'ISS (format CelesTrak, trois lignes)
export const ISS_TLE = `ISS (ZARYA)
1 25544U 98067A   26330.50000000  .00016717  00000+0  30172-3 0  9993
2 25544  51.6400 208.9163 0006317  69.9862 290.1958 15.50000000400000`;
