import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etat, astro, catalog, places, skyAt, body, star, altAzOf, ISS_TLE } from './helpers.mjs';

test('coordonnées : vecteurs unitaires, pôles au bon endroit', () => {
  const v = astro.eqVec(123, 45);
  assert.ok(Math.abs(v.length() - 1) < 1e-12);
  assert.ok(Math.abs(astro.eqVec(0, 90).z - 1) < 1e-12);
  assert.ok(Math.abs(astro.eqVec(10, 0, 50).length() - 50) < 1e-9);
});

test('couleur des étoiles : bleue chaude, rouge froide', () => {
  const [rb, , bb] = astro.bvRGB(-.3), [rr, , br] = astro.bvRGB(1.8);
  assert.ok(bb > rb && rr > br);
  assert.equal(astro.colorName(-.2), 'bleue'); assert.equal(astro.colorName(.65), 'jaune'); assert.equal(astro.colorName(1.85), 'rouge');
});

test('phases de la Lune et directions en français', () => {
  assert.equal(astro.phaseName(0), 'Nouvelle lune'); assert.equal(astro.phaseName(90), 'Premier quartier');
  assert.equal(astro.phaseName(180), 'Pleine lune'); assert.equal(astro.phaseName(300), 'Dernier croissant');
  assert.deepEqual([0, 44, 90, 180, 270, 359].map(astro.dirName), ['nord', 'nord-est', 'est', 'sud', 'ouest', 'nord']);
});

test('lieu par défaut selon le fuseau horaire', () => {
  assert.equal(places.defaultPlace('Africa/Douala').name, 'Douala');
  assert.equal(places.defaultPlace('America/Montreal').name, 'Montréal');
  assert.equal(places.defaultPlace('Antarctica/Troll').name, 'Paris', 'fuseau inconnu : Paris');
});

test('catalogue : 88 constellations, étoiles et objets de Messier en français', () => {
  assert.equal(Object.keys(etat.consById).length, 88);
  assert.equal(star('Polaris').name, 'Étoile polaire'); assert.equal(star('Polaris').c, 'UMi');
  assert.equal(star('Betelgeuse').name, 'Bételgeuse'); assert.equal(star('Betelgeuse').c, 'Ori');
  assert.equal(etat.messier.find(m => m.id === 'M42').name, 'Nébuleuse d’Orion');
  assert.ok(etat.starObjs.every(s => s.mag < 4.6 && s.c && etat.consById[s.c]), 'chaque étoile a sa constellation');
  const bayer = etat.starObjs.filter(s => !s.proper && s.bayer);
  const greek = bayer.filter(s => /^[α-ω]/.test(s.bayer));
  assert.ok(greek.length > 300 && greek.every(s => /^[A-ZÊÔ][a-zêéô]+\d* /.test(s.name)), 'lettres grecques en toutes lettres : « Alpha … »');
  for (const s of bayer) assert.equal(s.name.split(' ')[0], (s.name.split(' ')[0].replace(/\d+$/, '')) + s.bayer.replace(/\D/g, ''), `${s.name} (${s.bayer}) : numéro écrit une seule fois`);
});

test('l\'Étoile polaire est à la hauteur de la latitude, plein nord', () => {
  for (const [lat, lon] of [[48.857, 2.352], [45.5, -73.57], [4.05, 9.7]]) {
    skyAt(lat, lon, new Date('2026-11-27T21:00:00Z'));
    const aa = altAzOf(star('Polaris'));
    assert.ok(Math.abs(aa.alt - lat) < 1.2, `latitude ${lat} : ${aa.alt}`);
    assert.ok(aa.az < 3 || aa.az > 357, `azimut ${aa.az}`);
  }
});

test('Soleil : haut à midi en été à Paris, couché à minuit ; Lune et planètes calculées', () => {
  skyAt(48.857, 2.352, new Date('2026-06-21T12:00:00Z'));
  const sun = body('Sun');
  assert.ok(sun.alt > 60 && sun.alt < 66, `midi : ${sun.alt}`);
  assert.equal(astro.dirName(sun.az), 'sud');
  skyAt(48.857, 2.352, new Date('2026-06-21T23:30:00Z'));
  assert.ok(body('Sun').alt < -10);
  for (const b of astro.BODIES) assert.ok(Number.isFinite(b.alt) && Number.isFinite(b.az) && Number.isFinite(b.mag) && b.dist > 0, b.id);
  assert.ok(body('Venus').mag < -3, 'Vénus est très brillante');
});

test('lever et coucher du Soleil, dans le bon ordre et le même jour', () => {
  skyAt(48.857, 2.352, new Date('2026-06-21T00:00:00Z'));
  const rs = astro.riseSet('Sun');
  assert.ok(rs.r && rs.s && rs.r < rs.s);
  const h = d => d.getUTCHours() + d.getUTCMinutes() / 60;
  assert.ok(Math.abs(h(rs.r) - 3.78) < .2 && Math.abs(h(rs.s) - 19.97) < .2, `${rs.r.toISOString()} ${rs.s.toISOString()}`);
});

test('fiches : Lune, planète, étoile, constellation, objet du ciel profond', () => {
  skyAt(48.857, 2.352, new Date('2026-11-27T21:00:00Z'));
  const moon = catalog.describe(body('Moon'));
  assert.equal(moon.title, 'Lune'); assert.match(moon.kind, /lune|croissant|quartier|Gibbeuse/i); assert.match(moon.facts, /Éclairée/);
  const jup = catalog.describe(body('Jupiter'));
  assert.equal(jup.kind, 'Planète'); assert.match(jup.facts, /Distance/); assert.ok(jup.text.length > 40, 'histoire de Jupiter');
  const sirius = catalog.describe(star('Sirius'));
  assert.equal(sirius.title, 'Sirius'); assert.match(sirius.kind, /Étoile .* · Grand Chien/);
  const ori = catalog.describe({ ...etat.consById.Ori, type: 'cons' });
  assert.equal(ori.title, 'Orion'); assert.match(ori.kind, /^Constellation · Orion$/); assert.match(ori.text, /chasseur/);
  const m31 = catalog.describe(etat.messier.find(m => m.id === 'M31'));
  assert.equal(m31.title, 'Galaxie d’Andromède'); assert.match(m31.kind, /^Galaxie · M31 · Andromède/);
  for (const f of [moon, jup, sirius, ori, m31]) assert.match(f.facts, /<i>Où<\/i>/);
});

test('satellites : lecture des orbites, ISS reconnue, position et éclairage calculés', () => {
  skyAt(48.857, 2.352, new Date('2026-11-27T18:00:00Z'));
  const sats = astro.parseTle(ISS_TLE + '\nDÉBRIS\npas une orbite\n');
  assert.equal(sats.length, 1);
  assert.equal(sats[0].key, 'iss'); assert.equal(sats[0].fr, 'Station spatiale internationale');
  const l = astro.satLook(sats[0], new Date('2026-11-27T18:00:00Z'));
  assert.ok(l && Number.isFinite(l.az) && Number.isFinite(l.el));
  assert.ok(l.h > 300 && l.h < 500, `altitude ${l.h} km`);
  const s = astro.sunEci(new Date('2026-11-27T18:00:00Z'));
  assert.equal(astro.litBySun({ x: s.x * 7000, y: s.y * 7000, z: s.z * 7000 }, s), true, 'côté Soleil : éclairé');
  assert.equal(astro.litBySun({ x: -s.x * 6500, y: -s.y * 6500, z: -s.z * 6500 }, s), false, 'derrière la Terre : dans l\'ombre');
});
