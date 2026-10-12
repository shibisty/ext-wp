// End-to-end smoke test: real Chromium + the built extension + a fake
// WordPress REST API. Exercises connection mode (bearer token), the content
// browser, provider loading, the date pickers, and save payloads.
//
//   npm run build:chrome
//   npx playwright install chromium   (once)
//   npm run test:e2e
//
// Screenshots land in tests/e2e/out/.

import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import http from 'node:http';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '../..');
const EXT = resolve(root, 'dist/chrome');
const OUT = resolve(import.meta.dirname, 'out');
mkdirSync(OUT, { recursive: true });

const posted = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const u = new URL(req.url, 'http://x');
    const send = (j, headers = {}) => {
      res.writeHead(200, { 'Content-Type': 'application/json', ...headers });
      res.end(JSON.stringify(j));
    };
    if (req.method === 'POST') posted.push({ path: u.pathname, body: JSON.parse(body || '{}'), auth: req.headers.authorization });
    const p = u.pathname;
    if (p.endsWith('/wp/v2/search')) {
      return send([{ id: 42, title: 'Курс', subtype: 'page', _links: { self: [{ href: `${base}/wp/v2/pages/42` }] } }], { 'X-WP-TotalPages': '1' });
    }
    if (p.endsWith('/wp/v2/pages/42') && req.method === 'GET') {
      return send({ id: 42, title: { raw: 'Курс' }, excerpt: { raw: '' }, content: { raw: '' }, status: 'publish', date: '2026-05-01T09:00:00', featured_media: 0 });
    }
    if (p.endsWith('/sidebar-editor/v1/acf/42') && req.method === 'GET') {
      return send([
        { key: 'field_start', name: 'start', label: 'Дата старту', type: 'date_picker', value: '2026-05-21', raw: true },
        { key: 'field_webinar', name: 'webinar', label: 'Вебінар', type: 'date_time_picker', value: '2026-05-21 19:00:00', raw: true },
        { key: 'field_time', name: 'time', label: 'Час', type: 'time_picker', value: '19:00:00', raw: true },
        { key: 'field_old', name: 'old', label: 'Old bridge date', type: 'date_picker', value: '21 Травня, 2026' },
      ]);
    }
    return send({ ok: true });
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/wp-json`;

const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium', // the "new" headless mode, which can load extensions
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  viewport: { width: 380, height: 1100 },
  locale: 'ru-RU',
});

try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'));
  const extId = new URL(sw.url()).host;
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`chrome-extension://${extId}/sidebar/index.html`);
  await page.evaluate(async (b) => {
    await chrome.storage.local.set({
      seb_connections: [{ restRoot: b + '/', siteUrl: b.replace('/wp-json', ''), userLogin: 'admin', accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600e3, providers: ['core', 'acf'] }],
      seb_settings: { lang: 'ru', theme: 'dark', sections: { acf: true } },
    });
  }, base);
  await page.reload();

  await page.click('button[title="Соединения"]');
  await page.click('.seb-conn-name');
  await page.click('.seb-browser-item');
  await page.waitForSelector('input[data-field="field_start"]');

  assert.equal(await page.inputValue('input[data-field="field_start"]'), '2026-05-21');
  assert.equal(await page.getAttribute('input[data-field="field_start"]', 'type'), 'date');
  assert.equal(await page.inputValue('input[data-field="field_webinar"]'), '2026-05-21T19:00');
  assert.equal(await page.inputValue('input[data-field="field_time"]'), '19:00');
  assert.equal(await page.locator('input[data-field="field_old"]').count(), 0, 'unparsable date must not become a picker');
  await page.screenshot({ path: resolve(OUT, 'panel.png'), fullPage: true });

  await page.fill('input[data-field="field_start"]', '2026-06-01');
  await page.locator('input[data-field="field_time"]').locator('xpath=..').locator('.seb-date-clear').click();
  await page.click('#seb-save');
  await page.waitForFunction(() => document.body.textContent.includes('Сохранено'));

  const acf = posted.find((p) => p.path.endsWith('/acf/42'));
  assert.deepEqual(acf.body, { field_start: '20260601', field_webinar: '2026-05-21 19:00:00', field_time: '' });
  assert.equal(acf.auth, 'Bearer A');
  const core = posted.find((p) => p.path.endsWith('/pages/42'));
  assert.ok(!('date' in core.body), 'untouched publish date must not be sent');
  assert.deepEqual(errors, []);
  console.log('e2e smoke: OK');
} finally {
  await ctx.close();
  server.close();
}
