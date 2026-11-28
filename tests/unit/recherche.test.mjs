// Recherche d'un astre sur le vrai catalogue : accents, casse, pertinence, suggestions sans requête.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etat, astro, catalog, skyAt } from './helpers.mjs';
import { searchSky, norm, score, MAX_RESULTS } from '../../src/searchCore.js';

skyAt(48.857, 2.352, new Date('2026-11-27T21:00:00Z'));
const entries = catalog.searchEntries(astro.BODIES);
const alt = o => astro.altAz(catalog.objWorld(o)).alt;
const first = q => searchSky(entries, q, alt)[0]?.t;

test('le catalogue cherchable : 9 astres, 88 constellations, les objets de Messier du catalogue, étoiles nommées', () => {
  assert.equal(entries.filter(e => e.o.type === 'body').length, 9);
  assert.equal(entries.filter(e => e.o.type === 'cons').length, 88);
  assert.equal(entries.filter(e => e.o.type === 'dso').length, etat.messier.length); assert.ok(etat.messier.length >= 40);
  assert.ok(entries.filter(e => e.o.type === 'star').length > 50);
  assert.ok(entries.every(e => e.t && e.s), 'chaque entrée a un nom et un sous-titre');
});

test('normalisation : sans accents ni majuscules', () => {
  assert.equal(norm('Bételgeuse'), 'betelgeuse'); assert.equal(norm('ÉTOILE Polaire'), 'etoile polaire'); assert.equal(norm('Croix du Sud'), 'croix du sud');
});

test('le nom exact passe avant le début du nom, puis le milieu, puis le sous-titre', () => {
  const x = t => ({ o: {}, t, s: 'Étoile · Lyre' });
  assert.deepEqual(['Lyre', 'Lyrebird', 'La Lyre', 'Véga'].map(t => score(x(t), 'lyre')), [0, 1, 2, 3]);
  const r = searchSky([x('La Lyre'), x('Véga'), x('Lyrebird'), x('Lyre')], 'lyre', () => 0).map(e => e.t);
  assert.deepEqual(r, ['Lyre', 'Lyrebird', 'La Lyre', 'Véga']);
});

test('recherches courantes : Orion, Lune, Jupiter, Sirius, Véga sans accent, Bételgeuse en minuscules', () => {
  assert.equal(first('orion'), 'Orion');
  assert.equal(first('Lune'), 'Lune');
  assert.equal(first('jup'), 'Jupiter');
  assert.equal(first('sirius'), 'Sirius');
  assert.equal(first('vega'), 'Véga');
  assert.equal(first('betelgeuse'), 'Bételgeuse');
  assert.equal(first('  ANDROMEDE  '), 'Andromède');
  assert.equal(first('m31'), 'Galaxie d’Andromède');
  assert.equal(first('pleiades'), 'Les Pléiades');
});

test('recherche par sous-titre : « planète » donne les sept planètes, « Orion » ses étoiles', () => {
  const pl = searchSky(entries, 'planète', alt);
  assert.equal(pl.length, 7); assert.ok(pl.every(e => e.o.type === 'body'));
  const ori = searchSky(entries, 'orion', alt).map(e => e.t);
  assert.ok(ori.includes('Bételgeuse') && ori.includes('Rigel'), ori.join(', '));
});

test('rien trouvé : liste vide ; trop de résultats : 80 au plus', () => {
  assert.deepEqual(searchSky(entries, 'xyzzy', alt), []);
  assert.equal(searchSky(entries, 'a', alt).length, MAX_RESULTS);
});

test('sans requête : l\'essentiel, ce qui est levé d\'abord, avec la hauteur', () => {
  const r = searchSky(entries, '', alt);
  assert.ok(r.length > 15 && r.length < 60, `${r.length}`);
  assert.ok(r.every(e => e.o.type === 'body' || e.o.type === 'sat' || (e.o.type === 'star' && e.o.mag < 1) || (e.o.type === 'cons' && e.o.rank === 1)));
  const k = r.findIndex(e => e.alt <= 0);
  assert.ok(k > 0 && r.slice(k).every(e => e.alt <= 0), 'les astres levés d\'abord');
  assert.ok(r.every(e => Number.isFinite(e.alt)));
});

test('les stations s\'ajoutent à la recherche quand leurs orbites arrivent', () => {
  const st = { o: { type: 'sat', main: true }, t: 'Station spatiale internationale', s: 'Station spatiale' };
  assert.equal(searchSky(entries.concat(st), 'station', () => 20)[0].t, 'Station spatiale internationale');
  assert.ok(searchSky(entries.concat(st), '', () => 20).some(e => e.o.type === 'sat'));
});
