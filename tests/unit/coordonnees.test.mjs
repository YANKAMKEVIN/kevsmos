// Conversions de coordonnées : conventions du monde 3D (x est, y zénith, -z nord), matrices, vecteurs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { astro, skyAt } from './helpers.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} au lieu de ${b}`);
const V3 = THREE.Vector3;

test('hauteur et azimut d\'un vecteur du monde : nord, est, sud, ouest, zénith', () => {
  const cases = [[new V3(0, 0, -1), 0, 0], [new V3(1, 0, 0), 0, 90], [new V3(0, 0, 1), 0, 180], [new V3(-1, 0, 0), 0, 270], [new V3(0, 1, 0), 90, null], [new V3(0, -1, 0), -90, null]];
  for (const [w, alt, az] of cases) {
    const aa = astro.altAz(w);
    near(aa.alt, alt, 1e-9, 'hauteur');
    if (az !== null) near(aa.az, az, 1e-9, 'azimut');
    assert.ok(aa.az >= 0 && aa.az < 360);
  }
  near(astro.altAz(new V3(1, 1, -1).normalize()).alt, 35.2644, 1e-3, 'hauteur à 45° d\'azimut');
  assert.ok(Number.isFinite(astro.altAz(new V3(0, 1.0000001, 0)).alt), 'arrondi au-delà de 1 : pas de NaN');
});

test('vecteur équatorial : unitaire, aller-retour ascension droite / déclinaison', () => {
  for (const [ra, dec] of [[0, 0], [90, 0], [101.287, -16.716], [279.23, 38.78], [359.9, -89.5]]) {
    const v = astro.eqVec(ra, dec);
    near(v.length(), 1, 1e-12, 'norme');
    near((Math.atan2(v.y, v.x) * 180 / Math.PI + 360) % 360, ra % 360, 1e-9, 'ascension droite');
    near(Math.asin(v.z) * 180 / Math.PI, dec, 1e-9, 'déclinaison');
  }
});

test('matrice du ciel : rotation pure, inverse = transposée, toEq cohérente', () => {
  skyAt(45.5, -73.57, new Date('2026-03-01T03:00:00Z'));
  const m = astro.M.elements, mi = astro.Minv.elements;
  near(astro.M.determinant(), 1, 1e-9, 'déterminant');
  const id = new THREE.Matrix4().multiplyMatrices(astro.M, astro.Minv).elements;
  id.forEach((x, i) => near(x, i % 5 === 0 ? 1 : 0, 1e-9, `M·M⁻¹[${i}]`));
  const v = astro.eqVec(123, 45), w = astro.wv(v).clone(), back = w.clone().applyMatrix3(astro.toEq);
  near(back.distanceTo(v), 0, 1e-9, 'monde -> équatorial');
  assert.ok(m.length === 16 && mi.length === 16);
});

test('le pôle céleste est à la hauteur de la latitude, au nord ou au sud', () => {
  const date = new Date('2026-11-27T21:00:00Z');
  for (const lat of [48.857, 4.05, -33.87, -4.32]) {
    skyAt(lat, 10, date);
    const n = astro.altAz(astro.wv(astro.eqVec(0, 90)).clone()), s = astro.altAz(astro.wv(astro.eqVec(0, -90)).clone());
    near(n.alt, lat, 0.4, `pôle nord à ${lat}`); near(s.alt, -lat, 0.4, `pôle sud à ${lat}`);   // précession depuis J2000 : < 0,4°
    assert.equal(astro.dirName(n.az), 'nord'); assert.equal(astro.dirName(s.az), 'sud');
  }
});

test('directions en français : les huit secteurs et leurs bords', () => {
  const want = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
  want.forEach((d, i) => { assert.equal(astro.dirName(i * 45), d); assert.equal(astro.dirName(i * 45 + 22), d); assert.equal(astro.dirName((i * 45 + 337.6) % 360), d); });
  assert.equal(astro.dirName(359.99), 'nord');
});

test('couleur des étoiles : composantes entre 0 et 1, du bleu au rouge, valeurs extrêmes bornées', () => {
  for (let bv = -1; bv <= 3; bv += .05) for (const c of astro.bvRGB(bv)) assert.ok(c >= 0 && c <= 1 && Number.isFinite(c), `B-V ${bv}`);
  assert.deepEqual(astro.bvRGB(-1), astro.bvRGB(-.4)); assert.deepEqual(astro.bvRGB(5), astro.bvRGB(2));
  const sun = astro.bvRGB(.65); assert.ok(sun[0] >= sun[2], 'le Soleil (B-V 0,65) tire vers le jaune');
});

test('nombres et heures en français', () => {
  assert.equal(astro.nf(1234.5, 1).replace(/\s/g, ' '), '1 234,5');
  assert.equal(astro.fmtT(null), '—'); assert.equal(astro.fmtDay(null), '—');
  assert.match(astro.fmtT(new Date('2026-11-27T21:05:00Z')), /^\d\d:\d\d$/);
  assert.equal(astro.phaseName(359), 'Nouvelle lune'); assert.equal(astro.phaseName(185), 'Pleine lune'); assert.equal(astro.phaseName(270), 'Dernier quartier');
});
