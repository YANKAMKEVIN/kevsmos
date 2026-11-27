import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY, LEGACY_PLACE, LEGACY_LAYERS, TLE_KEY, SAVE_VERSION, defaults, parse, migrate, isValid, load, write, fromLegacy, readTle, writeTle } from '../../src/save.js';
import { memStore } from './helpers.mjs';

test('les valeurs par défaut sont valides', () => assert.ok(isValid(defaults())));

test('aller-retour : ce qui est sauvé est relu à l\'identique', () => {
  const st = memStore(), d = defaults();
  d.place = { name: 'Douala', lat: 4.05, lon: 9.7 }; d.layers.mw = false;
  assert.ok(write(st, d));
  assert.deepEqual(load(st), d);
});

test('sauvegarde absente ou stockage bloqué : valeurs par défaut', () => {
  assert.deepEqual(load(memStore()), defaults());
  const blocked = { getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('bloqué'); }, removeItem() {}, key() { return null; }, length: 0 };
  assert.deepEqual(load(blocked), defaults());
  assert.equal(write(blocked, defaults()), false);
  assert.equal(readTle(blocked), null);
  writeTle({ t: 1, d: 'x' }, blocked);
});

test('fichier abîmé : mis de côté, jamais écrasé en silence', () => {
  const bad = ['{pas du json', '[]', '{"version":1}', JSON.stringify({ ...defaults(), place: { name: 'X', lat: 200, lon: 0 } }),
    JSON.stringify({ ...defaults(), layers: { lines: 'oui' } }), JSON.stringify({ ...defaults(), intrus: 1 })];
  for (const b of bad) {
    const st = memStore({ [KEY]: b });
    assert.deepEqual(load(st), defaults(), b);
    assert.equal(st.getItem(KEY + '.abimee'), b);
    assert.equal(st.getItem(KEY), null);
  }
});

test('sauvegarde d\'une version plus récente : refusée', () => {
  const d = { ...defaults(), version: SAVE_VERSION + 1 };
  assert.equal(migrate(d), null); assert.equal(parse(JSON.stringify(d)), null);
});

test('ancien format (kevsmos.place, kevsmos.layers) : repris une fois, puis effacé', () => {
  const st = memStore({ [LEGACY_PLACE]: JSON.stringify({ name: 'Ma position', lat: 3.87, lon: 11.52 }), [LEGACY_LAYERS]: JSON.stringify({ lines: false, names: true, mw: true, ground: false, sats: true }), [TLE_KEY]: '{"t":1,"d":"x"}' });
  const d = load(st);
  assert.deepEqual(d.place, { name: 'Ma position', lat: 3.87, lon: 11.52 });
  assert.equal(d.layers.lines, false); assert.equal(d.layers.ground, false);
  assert.equal(st.getItem(LEGACY_PLACE), null); assert.equal(st.getItem(LEGACY_LAYERS), null);
  assert.equal(st.getItem(TLE_KEY), '{"t":1,"d":"x"}', 'le cache des orbites n\'est pas touché');
});

test('ancien format abîmé : on garde ce qui est lisible', () => {
  const d = fromLegacy('{abîmé', JSON.stringify({ mw: false, lines: 3 }));
  assert.equal(d.place, null); assert.equal(d.layers.mw, false); assert.equal(d.layers.lines, true);
});

test('cache des orbites : lu s\'il est intact, ignoré sinon', () => {
  const st = memStore();
  writeTle({ t: 5, d: 'TLE' }, st);
  assert.deepEqual(readTle(st), { t: 5, d: 'TLE' });
  st.setItem(TLE_KEY, '{"t":"hier"}'); assert.equal(readTle(st), null);
  st.setItem(TLE_KEY, 'abîmé'); assert.equal(readTle(st), null);
});
