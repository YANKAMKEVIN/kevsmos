// Parcours au doigt sur téléphone et cas difficiles, dans un vrai navigateur (Chromium, WebGL logiciel SwiftShader) :
// 1. Pixel 7 sans capteurs, géolocalisation refusée : boussole absente, position refusée, puis parcours complet au doigt
//    (chercher, viser, fiche, temps, lieu, calques, rechargement).
// 2. Ordinateur : géolocalisation acceptée, Échap dans le champ de recherche, le ciel est vraiment dessiné.
// 3. Boussole simulée (événements d'orientation), et boussole refusée (iPhone).
// 4. Économie d'énergie : densité de pixels plafonnée, rendu à la demande, pause quand l'onglet est caché.
// 5. Navigateur sans WebGL : message clair, aucune erreur.
// Lancer : npm run capteurs
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { startServer, checker, openPage, toastText, sleep, KEY } from './e2e-outils.mjs';

const OUT = process.env.SMOKE_SHOTS || 'test-results';
mkdirSync(OUT, { recursive: true });
const { url, stop } = await startServer();
const { check, fails } = checker();
const saved = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const cam = page => page.evaluate(() => ({ yaw: __ks.etat.yaw, pitch: __ks.etat.pitch, fov: __ks.etat.fov }));
const angle = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const isOpen = (page, sel) => page.locator(sel).evaluate(e => e.classList.contains('open'));
async function swipe(cdp, x, y, dx, dy, steps = 12) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let k = 1; k <= steps; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * k / steps, y: y + dy * k / steps, id: 1 }] }); await sleep(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function capture(pg, name) {
  try { await pg.screenshot({ path: `${OUT}/${name}.png`, timeout: 60000 }); }
  catch (e) { console.log(`NOTE  capture ${name} ignorée (${String(e.message || e).split('\n')[0]})`); }
}

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'] });
try {
  // ---------- 1. Pixel 7, sans capteurs, géolocalisation refusée ----------
  console.log('▶ Pixel 7 au doigt, sans boussole, position refusée');
  // capteurs autorisés mais absents (aucun événement d'orientation) ; position non autorisée : refusée
  const pctx = await browser.newContext({ ...devices['Pixel 7'], timezoneId: 'Europe/Paris', permissions: ['accelerometer', 'gyroscope', 'magnetometer'] });
  let tel = await openPage(pctx, url);
  check(await tel.evaluate(() => __ks.pixelRatio()) === 1.5, `densité de pixels plafonnée à 1,5 au doigt (écran ${devices['Pixel 7'].deviceScaleFactor})`);
  await tel.tap('#goCompass');
  const t1 = await toastText(tel, /boussole/, 5000);
  check(/Pas de boussole disponible/.test(t1), `sans capteur d'orientation : message clair (« ${t1.slice(0, 40)}… »)`);
  check(await tel.evaluate(() => __ks.etat.mode) === 'touch' && await tel.evaluate(() => document.getElementById('intro').classList.contains('gone')), 'on reste en mode doigt, l\'accueil est fermé');
  check(await tel.locator('#placeName').innerText() === 'Paris', 'position refusée au démarrage : ville du fuseau gardée, sans message bloquant');
  await tel.tap('#where'); await sleep(300); await tel.tap('#geo');
  const t2 = await toastText(tel, /Position/, 9000);
  check(/Position refusée ou indisponible/.test(t2), 'bouton « Utiliser ma position » refusé : on propose la liste des villes');
  check(await isOpen(tel, '#pPlace'), 'le panneau des lieux reste ouvert pour choisir une ville');
  await tel.tap('#pPlace .close'); await sleep(300);

  const cdp = await pctx.newCDPSession(tel);
  const c0 = await cam(tel);
  await swipe(cdp, 200, 400, -120, -50);
  await sleep(300);
  check(angle((await cam(tel)).yaw, c0.yaw) > 5, 'glisser au doigt fait tourner le ciel');

  // chercher la Lune, ouvrir sa fiche, la viser
  await tel.tap('#bSearch'); await sleep(300); await tel.fill('#q', 'lune'); await sleep(200);
  check(await tel.locator('#results .it').first().innerText().then(t => t.startsWith('Lune')), 'recherche « lune » : la Lune en premier');
  await tel.locator('#results .it').first().tap(); await sleep(1600);
  check(await tel.locator('#sheet h2').innerText() === 'Lune' && /Éclairée/.test(await tel.locator('#sheet .facts').innerText()), 'fiche de la Lune : phase et part éclairée');
  const moonAlt = await tel.evaluate(() => __ks.BODIES[1].alt);
  await tel.tap('#aimB');
  await tel.waitForFunction(() => __ks.etat.aim === null && !document.getElementById('sheet').classList.contains('open'), null, { timeout: 5000 }).catch(() => {});
  await sleep(300);
  const aimed = await tel.evaluate(() => { const s = __ks.screenOf(__ks.BODIES[1].world); return { s, w: innerWidth, h: innerHeight, aim: __ks.etat.aim }; });
  check(!(await isOpen(tel, '#sheet')) && aimed.aim === null && aimed.s.front && Math.abs(aimed.s.x - aimed.w / 2) < aimed.w * .2 && Math.abs(aimed.s.y - aimed.h / 2) < aimed.h * .25,
    `« Viser » centre la Lune (hauteur ${moonAlt | 0}°, écran ${aimed.s.x | 0}, ${aimed.s.y | 0}, visée ${JSON.stringify(aimed.aim)}, fiche ${await isOpen(tel, "#sheet")})`);
  await capture(tel, 'capteurs-pixel7-lune');

  // voyager dans le temps avec le curseur
  await tel.locator('#slider').fill('120'); await sleep(400);
  check(await tel.evaluate(() => __ks.etat.offset) === 120 * 60000 && /^00:00/.test(await tel.locator('#clock').innerText()), 'curseur du temps : deux heures plus tard (minuit à Paris)');
  await tel.tap('#tNow'); await sleep(200);

  // changer de lieu, masquer les noms
  await tel.tap('#where'); await sleep(300); await tel.fill('#qc', 'mont'); await sleep(150);
  await tel.locator('#cities .it').first().tap(); await sleep(400);
  check(await tel.locator('#placeName').innerText() === 'Montréal' && (await saved(tel))?.place?.name === 'Montréal', 'lieu : Montréal, sauvegardé');
  await tel.tap('#bLayers'); await sleep(300); await tel.tap('.tg[data-k="names"]'); await sleep(400);
  check((await saved(tel))?.layers?.names === false, 'calque des noms masqué et sauvegardé');
  check(await tel.evaluate(() => [...document.querySelectorAll('.lb.star, .lb.cons')].every(e => e.style.display === 'none')), 'plus aucun nom d\'étoile ni de constellation à l\'écran');
  await tel.tap('#pLayers .close');
  check(await tel.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'pas de défilement horizontal');
  check(tel.errors.length === 0, `aucune erreur (${tel.errors.slice(0, 3).join(' | ')})`);
  await tel.reload(); await tel.waitForFunction(() => window.__ks && __ks.etat.ready);
  check(await tel.locator('#placeName').innerText() === 'Montréal' && await tel.evaluate(() => !__ks.LAYERS.names), 'après rechargement : Montréal, noms masqués');
  await pctx.close();

  // ---------- 2. Ordinateur, géolocalisation acceptée ----------
  console.log('▶ Ordinateur, position acceptée');
  const gctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 3, timezoneId: 'Europe/Paris', permissions: ['geolocation'], geolocation: { latitude: -4.3217, longitude: 15.3125 } });
  const pc = await openPage(gctx, url);
  check(await pc.evaluate(() => __ks.pixelRatio()) === 2, 'densité de pixels plafonnée à 2 sur ordinateur (écran 3)');
  await pc.click('#goTouch');
  await pc.waitForFunction(() => document.getElementById('placeName').textContent === 'Ma position', null, { timeout: 8000 }).catch(() => {});
  check(await pc.locator('#placeName').innerText() === 'Ma position' && await pc.evaluate(() => Math.abs(__ks.etat.obs.latitude + 4.322) < .01), 'position acceptée : le ciel est calé sur Kinshasa');
  const sv = await saved(pc);
  check(sv?.place?.name === 'Ma position' && sv.place.lat === -4.322 && sv.place.lon === 15.313, 'position sauvegardée, arrondie au millième');

  // Échap ferme le panneau même quand le champ de recherche a le focus (bogue corrigé)
  await pc.click('#bSearch'); await sleep(200); await pc.focus('#q'); await pc.keyboard.press('Escape'); await sleep(100);
  check(!(await isOpen(pc, '#pSearch')), 'Échap ferme la recherche quand on est dans le champ');

  // le ciel est vraiment dessiné (WebGL) : des étoiles claires sur fond sombre
  await pc.evaluate(() => { __ks.etat.yaw = 0; __ks.etat.pitch = 40; __ks.etat.fov = 70; }); await sleep(800);
  const png = await pc.locator('#c').screenshot({ timeout: 60000 });
  const px = await pc.evaluate(async b64 => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height / 2).data; let bright = 0, dark = 0;
    for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l > 150) bright++; else if (l < 40) dark++; }
    return { bright, dark, n: d.length / 4 };
  }, png.toString('base64'));
  check(px.bright > 30 && px.dark > px.n * .5, `le ciel est dessiné : ${px.bright} points brillants sur un fond sombre`);
  check(pc.errors.length === 0, `aucune erreur (${pc.errors.slice(0, 3).join(' | ')})`);

  await gctx.close();

  // ---------- 4. Économie d'énergie ----------
  // En WebGL logiciel une image coûte cher : on vérifie le plafond d'images immobiles (10 par seconde) et la reprise en mouvement.
  console.log('▶ Économie d\'énergie');
  const ectx = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/Paris' });
  const pe = await openPage(ectx, url);
  await pe.click('#goTouch');
  await sleep(2500);   // plus rien ne bouge
  const p0 = await pe.evaluate(() => ({ ...__ks.perf })); await sleep(2000);
  const p1 = await pe.evaluate(() => ({ ...__ks.perf }));
  const idleR = p1.renders - p0.renders, idleF = p1.frames - p0.frames;
  check(idleR <= 22 && idleR >= 3 && idleF > idleR, `immobile : ${idleR} images dessinées en 2 s pour ${idleF} tours de boucle (10 par seconde au plus)`);
  await pe.mouse.move(640, 400); await pe.mouse.down();
  const m0 = await pe.evaluate(() => ({ ...__ks.perf }));
  for (let k = 1; k <= 20; k++) { await pe.mouse.move(640 - k * 8, 400); await sleep(30); }
  await pe.mouse.up();
  const m1 = await pe.evaluate(() => ({ ...__ks.perf }));
  check((m1.renders - m0.renders) >= (m1.frames - m0.frames) * .5 && (m1.renders - m0.renders) > 5, `en mouvement : une image à chaque tour (${m1.renders - m0.renders} / ${m1.frames - m0.frames})`);
  await pe.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  const h0 = await pe.evaluate(() => ({ ...__ks.perf })); await sleep(1000);
  const h1 = await pe.evaluate(() => ({ ...__ks.perf }));
  check(!h1.running && h1.frames === h0.frames, 'onglet caché : la boucle s\'arrête complètement');
  await pe.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(500);
  const v1 = await pe.evaluate(() => ({ ...__ks.perf }));
  check(v1.running && v1.renders > h1.renders, 'onglet de retour : le ciel repart');
  await ectx.close();

  // ---------- 3. Boussole simulée, puis refusée ----------
  console.log('▶ Boussole');
  const cctx = await browser.newContext({ ...devices['Pixel 7'], timezoneId: 'Europe/Paris', permissions: ['accelerometer', 'gyroscope', 'magnetometer'] });
  const cp = await openPage(cctx, url, { init: () => { setInterval(() => { const e = new Event('deviceorientationabsolute'); Object.assign(e, { alpha: 90, beta: 80, gamma: 0, absolute: true }); dispatchEvent(e); }, 50); } });
  await cp.tap('#goCompass');
  await cp.waitForFunction(() => __ks.etat.mode === 'compass', null, { timeout: 8000 }).catch(() => {});
  check(await cp.evaluate(() => __ks.etat.mode) === 'compass' && await cp.locator('#bCompass').evaluate(e => e.classList.contains('on')), `capteurs présents : mode boussole (${await cp.locator('#toast').textContent()})`);
  await cp.waitForFunction(() => { const a = __ks.altAz(__ks.camDir()); return Math.abs(a.az - 270) < 15; }, null, { timeout: 5000 }).catch(() => {});
  // téléphone dressé (beta 80°), haut tourné vers l'ouest (alpha 90°) : la caméra regarde l'ouest, un peu sous l'horizon
  const look = await cp.evaluate(() => __ks.altAz(__ks.camDir()));
  check(Math.abs(look.az - 270) < 15 && look.alt < 0 && look.alt > -20, `la caméra suit le téléphone (azimut ${look.az | 0}°, hauteur ${look.alt | 0}°)`);
  const ccdp = await cctx.newCDPSession(cp);
  await swipe(ccdp, 200, 400, -100, 0);
  check(/Mode doigt/.test(await toastText(cp, /Mode doigt/)) && await cp.evaluate(() => __ks.etat.mode) === 'touch', 'glisser au doigt quitte la boussole, avec un message');
  check(cp.errors.length === 0, `aucune erreur (${cp.errors.slice(0, 3).join(' | ')})`);
  await cctx.close();

  const ictx = await browser.newContext({ ...devices['iPhone SE'], timezoneId: 'Europe/Paris' });
  const ip = await openPage(ictx, url, { init: () => { window.DeviceOrientationEvent = window.DeviceOrientationEvent || function () {}; DeviceOrientationEvent.requestPermission = async () => 'denied'; } });
  await ip.tap('#goCompass');
  check(/refuse l’accès à la boussole/.test(await toastText(ip, /boussole/)), 'iPhone : boussole refusée, on explique comment explorer au doigt');
  check(await ip.evaluate(() => __ks.etat.mode) === 'touch' && ip.errors.length === 0, 'iPhone : mode doigt, aucune erreur');
  await ictx.close();

  // ---------- 5. Sans WebGL ----------
  console.log('▶ Navigateur sans WebGL');
  const nctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const np = await openPage(nctx, url, { ready: false, init: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; } });
  await sleep(1000);
  check(await np.evaluate(() => document.documentElement.classList.contains('nogl')) && /WebGL/.test(await np.locator('#introNote').innerText()), 'sans WebGL : message clair sur l\'accueil');
  check(!(await np.locator('#goTouch').isVisible()), 'sans WebGL : pas de bouton qui mène à une page vide');
  check(np.errors.length === 0, `sans WebGL : aucune erreur (${np.errors.slice(0, 3).join(' | ')})`);
  await capture(np, 'capteurs-sans-webgl');
  await nctx.close();
} finally {
  await browser.close();
  stop();
}
if (fails.length) { console.error(`\n${fails.length} échec(s)`); process.exit(1); }
console.log('\nCapteurs, mobile et économie d\'énergie : tout est bon.');
