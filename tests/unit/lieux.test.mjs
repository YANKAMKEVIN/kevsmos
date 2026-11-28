// Villes proposées et ville par défaut selon le fuseau horaire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, TZ_CITY, defaultPlace } from '../../src/places.js';
import { isPlace } from '../../src/save.js';

test('chaque ville a un nom unique, un pays et des coordonnées valides', () => {
  assert.equal(new Set(CITIES.map(c => c[0])).size, CITIES.length);
  for (const [name, country, lat, lon] of CITIES) {
    assert.ok(country.length > 1, name);
    assert.ok(isPlace({ name, lat, lon }), name);
  }
});

test('chaque fuseau connu mène à une ville de la liste', () => {
  for (const [tz, city] of Object.entries(TZ_CITY)) {
    assert.ok(CITIES.some(c => c[0] === city), `${tz} -> ${city}`);
    assert.equal(defaultPlace(tz).name, city, tz);
  }
});

test('fuseaux : la bonne ville et les bonnes coordonnées', () => {
  const want = { 'Africa/Douala': ['Douala', 4.05, 9.7], 'Europe/Paris': ['Paris', 48.857, 2.352], 'America/Montreal': ['Montréal', 45.5, -73.57],
    'America/Toronto': ['Montréal', 45.5, -73.57], 'Europe/Zurich': ['Genève', 46.2, 6.14], 'Indian/Reunion': ['Saint-Denis', -20.88, 55.45],
    'Pacific/Tahiti': ['Papeete', -17.53, -149.57], 'Africa/Kinshasa': ['Kinshasa', -4.32, 15.31], 'Australia/Sydney': ['Sydney', -33.87, 151.21] };
  for (const [tz, [name, lat, lon]] of Object.entries(want)) assert.deepEqual(defaultPlace(tz), { name, lat, lon }, tz);
});

test('fuseau inconnu, vide ou piégé : Paris', () => {
  for (const tz of ['Antarctica/Troll', '', 'toString', '__proto__', 'constructor']) assert.equal(defaultPlace(tz).name, 'Paris', JSON.stringify(tz));
});

test('sans fuseau donné : celui du système, toujours une ville valide', () => {
  const p = defaultPlace();
  assert.ok(isPlace(p) && CITIES.some(c => c[0] === p.name));
});
