// Lever et coucher : valeurs connues (éphémérides), nuit polaire et soleil de minuit, Lune.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { astro, skyAt } from './helpers.mjs';

const near = (got, want, tolMin, msg) => assert.ok(Math.abs(got - want) <= tolMin * 60e3, `${msg} : ${new Date(got).toISOString()} au lieu de ${new Date(want).toISOString()}`);

test('Paris, solstice d\'hiver : lever 8 h 41, coucher 16 h 56 (heure de Paris)', () => {
  skyAt(48.857, 2.352, new Date('2026-12-21T00:00:00Z'));
  const rs = astro.riseSet('Sun');
  near(+rs.r, Date.parse('2026-12-21T07:41Z'), 4, 'lever'); near(+rs.s, Date.parse('2026-12-21T15:56Z'), 4, 'coucher');
});

test('Douala, équinoxe de mars : douze heures de jour, midi solaire vers 11 h 29 UTC', () => {
  skyAt(4.05, 9.7, new Date('2026-03-20T00:00:00Z'));
  const { r, s } = astro.riseSet('Sun');
  near(+r, Date.parse('2026-03-20T05:25Z'), 4, 'lever'); near(+s, Date.parse('2026-03-20T17:32Z'), 4, 'coucher');
  const day = (s - r) / 3600e3;
  assert.ok(day > 12 && day < 12.2, `durée du jour ${day} h`);
});

test('Tromsø : nuit polaire en décembre, soleil de minuit en juin (ni lever ni coucher)', () => {
  for (const iso of ['2026-12-21T00:00:00Z', '2026-06-21T00:00:00Z']) {
    skyAt(69.65, 18.96, new Date(iso));
    const rs = astro.riseSet('Sun');
    assert.equal(rs.r, null, `${iso} lever`); assert.equal(rs.s, null, `${iso} coucher`);
  }
});

test('on cherche le prochain lever et le prochain coucher, dans les 29 heures', () => {
  const t0 = new Date('2026-11-27T12:00:00Z');
  for (const id of ['Sun', 'Moon', 'Jupiter']) {
    skyAt(48.857, 2.352, t0);
    const rs = astro.riseSet(id);
    for (const d of [rs.r, rs.s]) assert.ok(d && d > t0 && d - t0 < 29 * 3600e3, `${id} : ${d}`);
  }
});

test('le Soleil se lève à l\'est et se couche à l\'ouest, plus au nord en été', () => {
  skyAt(48.857, 2.352, new Date('2026-06-21T03:47:30Z'));
  const ete = astro.BODIES[0].az;
  skyAt(48.857, 2.352, new Date('2026-12-21T07:41:00Z'));
  const hiver = astro.BODIES[0].az;
  assert.equal(astro.dirName(ete), 'nord-est'); assert.equal(astro.dirName(hiver), 'sud-est');
  assert.ok(ete < 60 && hiver > 120, `${ete} ${hiver}`);
});
