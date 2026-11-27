// Parcours complet dans un vrai navigateur (Chromium, WebGL logiciel), à une date fixe :
// accueil -> explorer au doigt -> glisser, zoomer, flèches -> chercher Orion (fiche et visée) -> viser Jupiter puis la toucher
// -> l'ISS (orbites servies localement) -> changer de lieu (Douala) -> calques -> voyage dans le temps
// -> rechargement : lieu et calques retrouvés -> ancien format repris -> sauvegarde abîmée mise de côté.
// Puis au doigt sur iPhone SE.
// Lancer : npm run partie
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { mkdirSync } from 'node:fs';

const PORT = await new Promise(res => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const URL = `http://127.0.0.1:${PORT}/index.html`;
const OUT = process.env.SMOKE_SHOTS || 'test-results';
const KEY = 'kevsmos.sauvegarde';
const WHEN = new Date('2026-11-27T21:00:00Z');
const ISS_TLE = `ISS (ZARYA)
1 25544U 98067A   26330.50000000  .00016717  00000+0  30172-3 0  9993
2 25544  51.6400 208.9163 0006317  69.9862 290.1958 15.50000000400000
`;
mkdirSync(OUT, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 100; i++) {
  const ok = await new Promise(res => { const c = connect(PORT, '127.0.0.1', () => { c.end(); res(true); }); c.on('error', () => res(false)); });
  if (ok) break; await sleep(100);
}
const fails = [];
const check = (ok, msg) => { console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${msg}`); if (!ok) fails.push(msg); };

/** Nouvelle page à la date fixe, orbites servies localement, polices coupées (hors ligne). */
/** Capture pour l'archive de la CI : une capture lente (WebGL logiciel) est signalée, elle ne fait pas échouer la partie. */
async function capture(pg, name) {
  try { await pg.screenshot({ path: `${OUT}/${name}.png`, timeout: 60000 }); }
  catch (e) { console.log(`NOTE  capture ${name} ignorée (${String(e.message || e).split('\n')[0]})`); }
}

async function open(ctx) {
  const page = await ctx.newPage();
  await page.clock.setFixedTime(WHEN);
  await page.route(/celestrak\.org/, r => r.fulfill({ status: 200, contentType: 'text/plain', body: ISS_TLE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.|ERR_FAILED|ERR_TUNNEL/.test(m.text() + (m.location()?.url || ''))) page.errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__ks && __ks.etat.ready, null, { timeout: 30000 });
  return page;
}
const cam = page => page.evaluate(() => ({ yaw: __ks.etat.yaw, pitch: __ks.etat.pitch, fov: __ks.etat.fov }));
const saved = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const angle = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });  // mêmes réglages que la fumée
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/Paris' });
  let page = await open(ctx);
  check(/^v\d+\.\d+\.\d+$/.test(await page.locator('#ver').innerText()), 'numéro de version sur l\'accueil');
  check(await page.locator('#placeName').innerText() === 'Paris', 'lieu par défaut selon le fuseau : Paris');
  await page.click('#goTouch'); await sleep(900);
  check(await page.evaluate(() => document.getElementById('intro').classList.contains('gone')), 'explorer au doigt');

  // glisser, zoomer, flèches
  let c0 = await cam(page);
  await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(440, 330, { steps: 10 }); await page.mouse.up(); await sleep(400);
  let c1 = await cam(page);
  check(angle(c1.yaw, c0.yaw) > 5 && c1.pitch < c0.pitch, `glisser fait tourner le ciel (${c0.yaw | 0}° -> ${c1.yaw | 0}°)`);
  await page.mouse.wheel(0, -600); await sleep(100);
  check((await cam(page)).fov < c1.fov - 10, 'la molette zoome');
  c1 = await cam(page); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  check(angle((await cam(page)).yaw, c1.yaw) > 3, 'flèches du clavier');

  // chercher Orion
  await page.click('#bSearch'); await page.fill('#q', 'orion'); await sleep(200);
  check(await page.locator('#results .it').first().innerText().then(t => t.startsWith('Orion')), 'recherche « orion » : Orion en premier');
  await page.locator('#results .it').first().click(); await sleep(1500);
  check(await page.locator('#sheet h2').innerText() === 'Orion' && /chasseur/.test(await page.locator('#sheet p').innerText()), 'fiche d\'Orion avec son histoire');
  check(await page.evaluate(() => __ks.etat.sel && __ks.etat.sel.id === 'Ori' && __ks.etat.aim === null), 'la caméra s\'est tournée vers Orion');
  await capture(page, 'partie-orion');
  await page.click('#x');

  // viser la planète la plus brillante au-dessus de l'horizon, puis la toucher à l'écran
  const pl = await page.evaluate(() => __ks.BODIES.slice(2).filter(b => b.alt > 8).sort((a, b) => a.mag - b.mag)[0]?.fr);
  check(!!pl, `une planète est levée (${pl})`);
  await page.click('#bSearch'); await page.fill('#q', pl); await sleep(150);
  await page.locator('#results .it').first().click(); await sleep(1500);
  await page.click('#x'); await sleep(300);
  const jp = await page.evaluate(fr => { const j = __ks.BODIES.find(b => b.fr === fr); return { s: __ks.screenOf(j.world), alt: j.alt }; }, pl);
  check(jp.alt > 0 && jp.s.front && jp.s.x > 0 && jp.s.x < 1280 && jp.s.y > 0 && jp.s.y < 800, `${pl} à l'écran (hauteur ${jp.alt | 0}°)`);
  await page.mouse.click(jp.s.x, jp.s.y); await sleep(400);
  check(await page.locator('#sheet h2').innerText() === pl && /Planète/.test(await page.locator('#sheet .kind').innerText()), `toucher ${pl} ouvre sa fiche`);
  await page.click('#x');

  // ISS (orbites servies localement)
  await page.click('#bSearch'); await page.fill('#q', 'station'); await sleep(150);
  check(/Station spatiale internationale/.test(await page.locator('#results').innerText()), 'l\'ISS est connue (orbites CelesTrak)');
  await page.click('#pSearch .close');

  // changer de lieu
  await page.click('#where'); await page.fill('#qc', 'doua'); await sleep(100);
  await page.locator('#cities .it').first().click(); await sleep(300);
  check(await page.locator('#placeName').innerText() === 'Douala', 'lieu : Douala');
  check((await saved(page))?.place?.name === 'Douala', 'lieu sauvegardé');
  check(await page.evaluate(() => Math.abs(__ks.etat.obs.latitude - 4.05) < .01), 'le ciel est recalculé pour Douala');

  // calques
  await page.click('#bLayers'); await page.click('.tg[data-k="mw"]'); await page.click('.tg[data-k="lines"]');
  const sv = await saved(page);
  check(sv && sv.version === 1 && sv.layers.mw === false && sv.layers.lines === false && sv.layers.names === true, 'calques sauvegardés (Voie lactée et tracés masqués)');
  await page.keyboard.press('Escape');
  check(!(await page.locator('#pLayers').getAttribute('class')).includes('open'), 'Échap ferme le panneau');

  // voyage dans le temps
  await page.click('#tMinus'); await sleep(400);
  check(await page.evaluate(() => __ks.etat.offset) === -3600000 && /^21:00/.test(await page.locator('#clock').innerText()), 'une heure en arrière (21:00 à Paris)');
  await page.click('#tPlay'); await sleep(500);
  check(await page.evaluate(() => __ks.etat.playing && __ks.etat.offset > -3600000), 'le temps accélère');
  await page.click('#tNow');
  check(await page.evaluate(() => __ks.etat.offset === 0 && !__ks.etat.playing), 'retour à maintenant');
  await capture(page, 'partie-douala');
  check(page.errors.length === 0, `aucune erreur (${page.errors.slice(0, 3).join(' | ')})`);

  // rechargement
  await page.reload(); await page.waitForFunction(() => window.__ks && __ks.etat.ready);
  check(await page.locator('#placeName').innerText() === 'Douala' && await page.evaluate(() => !__ks.LAYERS.mw && !__ks.LAYERS.lines), 'après rechargement : Douala, calques retrouvés');
  check(await page.locator('.tg[data-k="mw"]').getAttribute('aria-pressed') === 'false', 'interrupteur Voie lactée à jour');

  // ancien format
  await page.evaluate(k => { localStorage.removeItem(k); localStorage.setItem('kevsmos.place', JSON.stringify({ name: 'Yaoundé', lat: 3.87, lon: 11.52 })); localStorage.setItem('kevsmos.layers', JSON.stringify({ lines: true, names: false, mw: true, ground: true, sats: true })); }, KEY);
  await page.reload(); await page.waitForFunction(() => window.__ks && __ks.etat.ready);
  const mig = await saved(page);
  check(await page.locator('#placeName').innerText() === 'Yaoundé' && mig?.layers.names === false && await page.evaluate(() => localStorage.getItem('kevsmos.place')) === null, 'ancien format repris, anciennes clés effacées');

  // sauvegarde abîmée
  await page.evaluate(k => localStorage.setItem(k, '{abîmée'), KEY);
  await page.reload(); await page.waitForFunction(() => window.__ks && __ks.etat.ready);
  check(await page.evaluate(k => localStorage.getItem(k + '.abimee'), KEY) === '{abîmée' && await page.locator('#placeName').innerText() === 'Paris', 'sauvegarde abîmée mise de côté, retour à Paris');
  await ctx.close();

  // iPhone SE au doigt
  const tctx = await browser.newContext({ ...devices['iPhone SE'], timezoneId: 'Africa/Douala' });
  const tel = await open(tctx);
  check(await tel.locator('#placeName').innerText() === 'Douala', 'iPhone SE : fuseau de Douala, ciel de Douala');
  await tel.tap('#goTouch'); await sleep(900);
  const cdp = await tctx.newCDPSession(tel);
  const t0 = await cam(tel);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 300, id: 1 }] });
  for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200 - k * 10, y: 300 - k * 4, id: 1 }] }); await sleep(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
  check(angle((await cam(tel)).yaw, t0.yaw) > 5, 'iPhone SE : glisser au doigt fait tourner le ciel');
  await tel.tap('#bSearch'); await sleep(300);
  const box = await tel.locator('#pSearch').boundingBox();
  check(box && box.x >= 0 && box.x + box.width <= 321, 'iPhone SE : panneau de recherche dans l\'écran');
  check(await tel.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'iPhone SE : pas de défilement horizontal');
  await capture(tel, 'partie-iphone');
  check(tel.errors.length === 0, `iPhone SE : aucune erreur (${tel.errors.slice(0, 3).join(' | ')})`);
  await tctx.close();
} finally {
  await browser.close();
  server.kill();
}
if (fails.length) { console.error(`\n${fails.length} échec(s)`); process.exit(1); }
console.log('\nParcours complet : tout est bon.');
