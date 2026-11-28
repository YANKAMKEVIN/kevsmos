// Satellites : lecture des orbites (TLE figés, aucune requête réseau), propagation SGP4, visée, prochain passage visible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etat, astro, skyAt, ISS_TLE } from './helpers.mjs';

const CSS_TLE = `CSS (TIANHE)
1 48274U 21035A   26330.50000000  .00016717  00000+0  30172-3 0  9993
2 48274  41.4700 100.0000 0006317  69.9862 290.1958 15.60000000300000`;
const OTHER = `HST
1 20580U 90037B   26330.50000000  .00001000  00000+0  50000-4 0  9991
2 20580  28.4700  50.0000 0002500  90.0000 270.0000 15.10000000100000`;
const EPOCH = Date.parse('2026-11-26T12:00:00Z');
const D = 180 / Math.PI;

/** Point sous la station (latitude, longitude en degrés) et altitude (km). */
function sub(rec, ms) {
  const d = new Date(ms), pv = satellite.propagate(rec, d);
  const g = satellite.eciToGeodetic(pv.position, satellite.gstime(d));
  return { lat: g.latitude * D, lon: g.longitude * D, h: g.height, z: pv.position.z };
}

test('lecture : stations reconnues et en tête, doublons et lignes abîmées ignorés', () => {
  const sats = astro.parseTle([OTHER, ISS_TLE, 'n\'importe quoi', CSS_TLE, ISS_TLE, '1 tronqué'].join('\r\n'));
  assert.deepEqual(sats.map(s => s.key), ['iss', 'css', null]);
  assert.deepEqual(sats.map(s => s.short), ['ISS', 'Tiangong', 'HST']);
  assert.equal(sats[1].fr, 'Station Tiangong');
  assert.ok(sats.every(s => s.type === 'sat' && s.rec && s.world));
  assert.deepEqual(astro.parseTle(''), []);
});

test('lecture : au plus SAT_MAX satellites', () => {
  const many = [];
  for (let i = 0; i < astro.SAT_MAX + 50; i++) many.push(OTHER.replace(/20580/g, String(30000 + i)).replace('HST', 'SAT ' + i));
  assert.equal(astro.parseTle(many.join('\n')).length, astro.SAT_MAX);
});

test('ISS : orbite basse inclinée de 51,6°, une révolution toutes les 93 minutes', () => {
  const [iss] = astro.parseTle(ISS_TLE);
  let maxLat = 0, nodes = [];
  for (let k = 0, prev = null; k <= 24 * 60; k++) {
    const s = sub(iss.rec, EPOCH + k * 60e3);
    assert.ok(s.h > 370 && s.h < 460, `altitude ${s.h} km`);
    maxLat = Math.max(maxLat, Math.abs(s.lat));
    if (prev && prev.z < 0 && s.z >= 0) nodes.push(k);
    prev = s;
  }
  assert.ok(maxLat > 51 && maxLat < 52, `latitude maximale ${maxLat}`);
  const period = (nodes.at(-1) - nodes[0]) / (nodes.length - 1);
  assert.ok(Math.abs(period - 1440 / 15.5) < 1.5, `période ${period} min`);
});

test('Tiangong : inclinaison 41,5°', () => {
  const css = astro.parseTle(CSS_TLE)[0];
  let maxLat = 0;
  for (let k = 0; k < 200; k++) maxLat = Math.max(maxLat, Math.abs(sub(css.rec, EPOCH + k * 60e3).lat));
  assert.ok(maxLat > 41 && maxLat < 42, `${maxLat}`);
});

test('visée : la station est au zénith pour qui est dessous, sous l\'horizon aux antipodes', () => {
  const [iss] = astro.parseTle(ISS_TLE);
  const t = EPOCH + 37 * 60e3, s = sub(iss.rec, t);
  skyAt(s.lat, s.lon, new Date(t));
  const l = astro.satLook(iss, new Date(t));
  assert.ok(l.el * D > 85, `hauteur ${l.el * D}`); assert.ok(Math.abs(l.h - s.h) < 25, `altitude ${l.h} / ${s.h}`);
  skyAt(-s.lat, s.lon > 0 ? s.lon - 180 : s.lon + 180, new Date(t));
  assert.ok(astro.satLook(iss, new Date(t)).el < 0);
});

test('propagation loin de l\'époque : jamais d\'exception, résultat fini ou null', () => {
  const [iss] = astro.parseTle(ISS_TLE);
  skyAt(48.857, 2.352, new Date(EPOCH));
  for (const days of [-30, 0, 30, 3650]) {
    let l;
    assert.doesNotThrow(() => { l = astro.satLook(iss, new Date(EPOCH + days * 864e5)); });
    assert.ok(l === null || (Number.isFinite(l.az) && Number.isFinite(l.el)), `${days} jours`);
  }
});

test('prochain passage visible : station haute, ciel noir, station au soleil', () => {
  const [iss] = astro.parseTle(ISS_TLE);
  etat.sats = [iss];
  let found = 0;
  try {
    for (let day = 0; day < 4; day++) {
      const t0 = EPOCH + day * 864e5;
      skyAt(48.857, 2.352, new Date(t0));
      astro.computePass(t0);
      const p = etat.satPass;
      if (!p) continue;
      found++;
      assert.ok(p.t >= t0 && p.t - t0 <= 24 * 3600e3, 'dans les 24 h');
      assert.match(p.dir, /^vers le (nord|sud|est|ouest)/);
      const l = astro.satLook(iss, p.t);
      assert.ok(l.el * D >= 10, `hauteur ${l.el * D}`);
      assert.ok(astro.litBySun(l.p, astro.sunEci(p.t)), 'éclairée');
      const T = Astronomy.MakeTime(p.t), e = Astronomy.Equator('Sun', T, etat.obs, true, true);
      assert.ok(Astronomy.Horizon(T, etat.obs, e.ra, e.dec).altitude <= -6, 'ciel noir');
    }
    assert.ok(found > 0, 'au moins un passage visible en quatre jours depuis Paris');
  } finally { etat.sats = []; etat.satPass = null; }
});

test('sans ISS, pas de passage annoncé', () => {
  etat.sats = astro.parseTle(OTHER); etat.satPass = { t: new Date(), dir: 'x' };
  astro.computePass(EPOCH);
  assert.equal(etat.satPass, null, 'l\'ancien passage est oublié');
  etat.sats = []; etat.satPass = null;
});
