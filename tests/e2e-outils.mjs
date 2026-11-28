// Outils communs des parcours dans le navigateur : serveur local sur un port libre (5200-5999),
// page à date fixe avec orbites servies localement, relevé des erreurs, vérifications nommées.
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const WHEN = new Date('2026-11-27T21:00:00Z');
export const KEY = 'kevsmos.sauvegarde';
export const ISS_TLE = `ISS (ZARYA)
1 25544U 98067A   26330.50000000  .00016717  00000+0  30172-3 0  9993
2 25544  51.6400 208.9163 0006317  69.9862 290.1958 15.50000000400000
`;

const free = port => new Promise(res => { const s = createServer().once('error', () => res(false)).listen(port, '127.0.0.1', () => s.close(() => res(true))); });

/** Démarre un serveur statique sur un port libre tiré entre 5200 et 5999 ; renvoie l'URL de la page et de quoi l'arrêter. */
export async function startServer() {
  let port = 0;
  for (let i = 0; i < 50 && !port; i++) { const p = 5200 + Math.floor(Math.random() * 800); if (await free(p)) port = p; }
  if (!port) throw new Error('aucun port libre entre 5200 et 5999');
  const proc = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    const ok = await new Promise(res => { const c = connect(port, '127.0.0.1', () => { c.end(); res(true); }); c.on('error', () => res(false)); });
    if (ok) break; await sleep(100);
  }
  return { url: `http://127.0.0.1:${port}/index.html`, stop: () => proc.kill() };
}

/** Compteur de vérifications : affiche chaque résultat, garde les échecs. */
export function checker() {
  const fails = [];
  const check = (ok, msg) => { console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${msg}`); if (!ok) fails.push(msg); };
  return { check, fails };
}

/** Nouvelle page à la date fixe, orbites servies localement, polices coupées (hors ligne), erreurs relevées dans page.errors.
 * @param {import('playwright').BrowserContext} ctx @param {string} url @param {{ready?:boolean, init?:Function, initArg?:any}} [o] */
export async function openPage(ctx, url, o = {}) {
  const page = await ctx.newPage();
  await page.clock.setFixedTime(WHEN);
  if (o.init) await page.addInitScript(o.init, o.initArg);
  await page.route(/celestrak\.org/, r => r.fulfill({ status: 200, contentType: 'text/plain', body: ISS_TLE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.|ERR_FAILED|ERR_TUNNEL/.test(m.text() + (m.location()?.url || ''))) page.errors.push(m.text()); });
  await page.goto(url);
  if (o.ready !== false) await page.waitForFunction(() => window.__ks && __ks.etat.ready, null, { timeout: 30000 });
  return page;
}

/** Texte du message éphémère (toast) une fois qu'il contient le motif, ou '' au bout du délai. */
export async function toastText(page, re, timeout = 4000) {
  try { await page.waitForFunction(src => new RegExp(src).test(document.getElementById('toast').textContent), re.source, { timeout }); }
  catch { /* le motif n'est pas venu */ }
  return page.locator('#toast').textContent();
}
