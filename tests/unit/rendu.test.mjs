// Économie d'énergie du rendu : densité de pixels plafonnée, rendu à la demande, poids des bibliothèques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync, readFileSync } from 'node:fs';
import { pixelRatio, needsRender, Signature, IDLE_MS } from '../../src/loop.js';

test('densité de pixels : 2 au plus sur ordinateur, 1,5 au plus au doigt, 1 si inconnue', () => {
  assert.equal(pixelRatio(1, false), 1); assert.equal(pixelRatio(3, false), 2); assert.equal(pixelRatio(1.25, false), 1.25);
  assert.equal(pixelRatio(3, true), 1.5); assert.equal(pixelRatio(2.625, true), 1.5); assert.equal(pixelRatio(1, true), 1);
  for (const bad of [undefined, NaN, 0, -2]) assert.equal(pixelRatio(bad, true), 1);
});

test('rendu à la demande : tout de suite si ça bouge, sinon une image par intervalle', () => {
  assert.equal(needsRender(true, 1000, 999, IDLE_MS), true);
  assert.equal(needsRender(false, 1000, 950, IDLE_MS), false);
  assert.equal(needsRender(false, 1000, 1000 - IDLE_MS, IDLE_MS), true);
});

test('empreinte : détecte un mouvement, ignore le bruit, change une seule fois', () => {
  const s = new Signature(4);
  const take = (...v) => { s.begin(); v.forEach(x => s.push(x)); return s.changed(); };
  assert.equal(take(180, 28, 70, 0), true, 'première image');
  assert.equal(take(180, 28, 70, 0), false, 'rien n\'a bougé');
  assert.equal(take(180 + 1e-9, 28, 70, 0), false, 'bruit négligeable');
  assert.equal(take(181, 28, 70, 0), true, 'la caméra a tourné');
  assert.equal(take(181, 28, 70, 0), false);
  assert.equal(take(181, 28, 70, NaN), true, 'NaN compte comme un changement');
});

test('poids des fichiers chargés au démarrage : pas de dérive (bibliothèques, catalogue, code)', () => {
  const kb = f => statSync(new URL('../../' + f, import.meta.url)).size / 1024;
  const libs = ['lib/three.min.js', 'lib/astronomy.browser.min.js', 'lib/satellite.min.js'].reduce((a, f) => a + kb(f), 0);
  assert.ok(libs < 820, `bibliothèques : ${libs.toFixed(0)} Ko`);
  assert.ok(kb('data/sky.json') < 240, 'catalogue');
  assert.ok(kb('data/histoires.js') < 24, 'histoires');
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /<link rel="preload" href="data\/sky.json" as="fetch" crossorigin>/, 'le catalogue est préchargé en parallèle des bibliothèques');
});
