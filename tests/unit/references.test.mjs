// Positions comparées à des valeurs de référence publiées (Meeus, « Astronomical Algorithms », 2e éd.),
// et chaîne de calcul de l'appli (J2000 -> horizon) comparée à la formule classique des manuels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etat, astro, catalog, skyAt, body, star } from './helpers.mjs';

const A = Astronomy, D = Math.PI / 180;
const near = (got, want, tol, msg) => assert.ok(Math.abs(got - want) <= tol, `${msg} : ${got} au lieu de ${want} (± ${tol})`);
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

/** Ascension droite et déclinaison apparentes géocentriques, équinoxe de la date (degrés), distance (km). */
function apparent(id, iso) {
  const t = A.MakeTime(new Date(iso));
  const e = A.EquatorFromVector(A.RotateVector(A.Rotation_EQJ_EQD(t), A.GeoVector(id, t, true)));
  return { ra: e.ra * 15, dec: e.dec, km: e.dist * 149597870.7 };
}

test('Soleil, 13 octobre 1992 (Meeus, exemple 25.a)', () => {
  const p = apparent('Sun', '1992-10-13T00:00:00Z');
  near(p.ra, 198.38083, 0.01, 'ascension droite'); near(p.dec, -7.78507, 0.01, 'déclinaison');
});

test('Lune, 12 avril 1992 (Meeus, exemple 47.a)', () => {
  const p = apparent('Moon', '1992-04-12T00:00:00Z');
  near(p.ra, 134.68847, 0.02, 'ascension droite'); near(p.dec, 13.768368, 0.02, 'déclinaison'); near(p.km, 368409.7, 50, 'distance');
});

test('Vénus, 20 décembre 1992 (Meeus, exemple 33.a)', () => {
  const p = apparent('Venus', '1992-12-20T00:00:00Z');
  near(p.ra, 316.17273, 0.005, 'ascension droite'); near(p.dec, -18.88801, 0.005, 'déclinaison');
});

test('étoiles du catalogue : positions Hipparcos (J2000)', () => {
  const ref = { Sirius: [101.28716, -16.71612], Vega: [279.23473, 38.78369], Polaris: [37.95456, 89.26411], Betelgeuse: [88.79294, 7.40706] };
  for (const [name, [ra, dec]] of Object.entries(ref)) {
    const s = star(name);
    near(s.ra, ra, 0.001, `${name} ascension droite`); near(s.dec, dec, 0.001, `${name} déclinaison`);
  }
});

test('saisons 2026 : équinoxes et solstices à quelques minutes près, Soleil sur l\'équateur céleste', () => {
  const s = A.Seasons(2026), min = 60e3;
  near(+s.mar_equinox.date, Date.parse('2026-03-20T14:46Z'), 3 * min, 'équinoxe de mars');
  near(+s.jun_solstice.date, Date.parse('2026-06-21T08:24Z'), 3 * min, 'solstice de juin');
  near(+s.dec_solstice.date, Date.parse('2026-12-21T20:50Z'), 3 * min, 'solstice de décembre');
  near(apparent('Sun', s.mar_equinox.date.toISOString()).dec, 0, 0.001, 'déclinaison du Soleil à l\'équinoxe');
  near(apparent('Sun', s.jun_solstice.date.toISOString()).dec, 23.436, 0.01, 'déclinaison du Soleil au solstice');
});

/** Hauteur et azimut (depuis le nord, vers l'est) par la formule des manuels, sans réfraction. */
function textbookAltAz(raDeg, decDeg, lat, lon, date) {
  const lst = (A.SiderealTime(A.MakeTime(date)) * 15 + lon + 720) % 360;
  const H = (lst - raDeg) * D, d = decDeg * D, f = lat * D;
  const alt = Math.asin(Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(H));
  const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(f) - Math.cos(d) * Math.sin(f) * Math.cos(H));
  return { alt: alt / D, az: (az / D + 360) % 360 };
}

test('hauteur et direction des astres : l\'appli suit la formule des manuels (Paris, Douala, Sydney)', () => {
  const places = [[48.857, 2.352], [4.05, 9.7], [-33.87, 151.21]];
  for (const [lat, lon] of places) for (const iso of ['2026-11-27T21:00:00Z', '2026-06-21T04:30:00Z']) {
    const date = new Date(iso);
    skyAt(lat, lon, date);
    for (const b of astro.BODIES) {
      const e = A.Equator(b.id, A.MakeTime(date), etat.obs, true, true);   // équinoxe de la date, topocentrique
      const ref = textbookAltAz(e.ra * 15, e.dec, lat, lon, date);
      near(b.alt, ref.alt, 0.02, `${b.id} hauteur (${lat}, ${iso})`);
      if (Math.abs(ref.alt) < 89) assert.ok(angDiff(b.az, ref.az) < 0.05, `${b.id} azimut ${b.az} au lieu de ${ref.az}`);
    }
    for (const name of ['Sirius', 'Vega', 'Betelgeuse']) {     // J2000 -> équinoxe de la date (précession, nutation)
      const s = star(name), t = A.MakeTime(date);
      const e = A.EquatorFromVector(A.RotateVector(A.Rotation_EQJ_EQD(t), A.VectorFromSphere(new A.Spherical(s.dec, s.ra, 1), t)));
      const ref = textbookAltAz(e.ra * 15, e.dec, lat, lon, date), got = astro.altAz(astro.wv(s.eq).clone());
      near(got.alt, ref.alt, 0.02, `${name} hauteur`); assert.ok(angDiff(got.az, ref.az) < 0.05, `${name} azimut`);
    }
  }
});

test('un point du ciel au méridien, à la déclinaison égale à la latitude, est au zénith', () => {
  const date = new Date('2026-11-27T21:00:00Z');
  for (const lat of [48.857, 4.05, -33.87]) {
    skyAt(lat, 10, date);
    const t = A.MakeTime(date), lst = A.SiderealTime(t) * 15 + 10;
    // coordonnées de la date -> J2000 (celles de l'appli)
    const v = A.RotateVector(A.Rotation_EQD_EQJ(t), A.VectorFromSphere(new A.Spherical(lat, lst, 1), t));
    const e = A.EquatorFromVector(v);
    near(astro.altAz(astro.wv(astro.eqVec(e.ra * 15, e.dec)).clone()).alt, 90, 0.02, `zénith à la latitude ${lat}`);
  }
});

test('phases de la Lune 2026 : pleines et nouvelles lunes aux dates connues', () => {
  const min = 60e3;
  const at = (target, from) => +A.SearchMoonPhase(target, A.MakeTime(new Date(from)), 40).date;
  near(at(180, '2026-02-20'), Date.parse('2026-03-03T11:38Z'), 5 * min, 'pleine lune du 3 mars (éclipse totale)');
  near(at(0, '2026-02-01'), Date.parse('2026-02-17T12:01Z'), 5 * min, 'nouvelle lune du 17 février (éclipse annulaire)');
  near(at(0, '2026-08-01'), Date.parse('2026-08-12T17:37Z'), 10 * min, 'nouvelle lune du 12 août (éclipse totale)');
  near(at(180, '2026-01-01'), Date.parse('2026-01-03T10:03Z'), 5 * min, 'pleine lune du 3 janvier');
  const name = iso => astro.phaseName(A.MoonPhase(A.MakeTime(new Date(iso))));
  assert.equal(name('2026-03-03T11:38Z'), 'Pleine lune');
  assert.equal(name('2026-02-17T12:01Z'), 'Nouvelle lune');
  assert.match(name('2026-02-24T12:00Z'), /Premier (quartier|croissant)|Gibbeuse croissante/);
  assert.match(name('2026-03-11T12:00Z'), /Dernier quartier|Gibbeuse décroissante|Dernier croissant/);
});

test('fiche de la Lune : phase, part éclairée et prochaine pleine lune', () => {
  skyAt(48.857, 2.352, new Date('2026-03-03T11:38:00Z'));
  let f = catalog.describe(body('Moon'));
  assert.equal(f.kind, 'Pleine lune'); assert.match(f.facts, /Éclairée<\/i><b>(99|100) %/);
  skyAt(48.857, 2.352, new Date('2026-02-20T12:00:00Z'));
  f = catalog.describe(body('Moon'));
  assert.match(f.facts, /Prochaine pleine lune<\/i><b>3 mars/);
  assert.match(f.facts, /Distance<\/i><b>[\d\s\u00a0\u202f]+ km/);
});

test('fiche d\'une planète : distance en millions ou milliards de km, accordée', () => {
  skyAt(48.857, 2.352, new Date('2026-11-27T21:00:00Z'));
  assert.match(catalog.describe(body('Neptune')).facts, /\d,\d\d milliards de km/);
  assert.match(catalog.describe(body('Mars')).facts, /millions de km/);
  const sat = catalog.describe(body('Saturn')).facts;
  assert.match(sat, /\d,\d\d milliard(s)? de km|millions de km/);
  if (/milliard de km/.test(sat)) assert.ok(body('Saturn').dist * 149597870.7 < 2e9, 'singulier sous 2 milliards');
});
