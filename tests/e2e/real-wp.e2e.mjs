// End-to-end against a REAL WordPress with the bridge plugin + ACF:
// the extension's own "Add connection" form → content browser → page →
// change an ACF date in the picker → Save → the stored value is checked
// over REST. Also screenshots the plugin's settings page.
//
//   npm run build:chrome
//   WP_URL=http://localhost:8080 WP_ADMIN=admin WP_ADMIN_PASS=... WP_PAGE_TITLE=Курс npm run test:e2e:wp
//
// The page must have the ACF date_picker field "field_start" (see tests/integration/test-fields.php).

import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const SITE = (process.env.WP_URL || 'http://127.0.0.1:8899').replace(/\/$/, '');
const USER = process.env.WP_ADMIN || 'admin';
const PASS = process.env.WP_ADMIN_PASS || 'adminpass';
const TITLE = process.env.WP_PAGE_TITLE || 'Курс';
const EXT = resolve(import.meta.dirname, '../../dist/chrome');
const OUT = resolve(import.meta.dirname, 'out');
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  viewport: { width: 400, height: 1000 },
  locale: 'ru-RU',
});

try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'));
  const extId = new URL(sw.url()).host;
  const panel = await ctx.newPage();
  const errors = [];
  panel.on('pageerror', (e) => errors.push(e.message));
  await panel.goto(`chrome-extension://${extId}/sidebar/index.html`);
  await panel.evaluate(() => chrome.storage.local.set({ seb_settings: { lang: 'ru', theme: 'light', sections: { acf: true } } }));
  await panel.reload();

  // Add the connection through the real form.
  await panel.click('button[title="Соединения"]');
  await panel.click('.seb-conn-add');
  await panel.fill('.seb-popup input[type="url"]', SITE);
  await panel.fill('.seb-popup input[type="text"]', USER);
  await panel.fill('.seb-popup input[type="password"]', PASS);
  await panel.click('#seb-save');
  await panel.waitForSelector('.seb-hint');

  await panel.click('button[title="Соединения"]');
  await panel.click('.seb-conn-name');
  await panel.fill('.seb-browser-toolbar input[type="search"]', TITLE);
  await panel.locator('.seb-browser-item', { hasText: TITLE }).first().click();
  const start = panel.locator('input[data-field="field_start"]');
  await start.waitFor();
  assert.equal(await start.getAttribute('type'), 'date');
  const original = await start.inputValue();
  assert.match(original, /^\d{4}-\d{2}-\d{2}$/);

  const next = original === '2026-09-01' ? '2026-09-02' : '2026-09-01';
  await start.fill(next);
  await panel.screenshot({ path: resolve(OUT, 'real-wp-panel.png'), fullPage: true });
  await panel.click('#seb-save');
  await panel.waitForFunction(() => document.body.textContent.includes('Сохранено'));

  // Verify on the server with a fresh token.
  const login = await (await fetch(`${SITE}/wp-json/sidebar-editor/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }),
  })).json();
  const pages = await (await fetch(`${SITE}/wp-json/wp/v2/pages?search=${encodeURIComponent(TITLE)}`, { headers: { Authorization: `Bearer ${login.accessToken}` } })).json();
  const fields = await (await fetch(`${SITE}/wp-json/sidebar-editor/v1/acf/${pages[0].id}`, { headers: { Authorization: `Bearer ${login.accessToken}` } })).json();
  assert.equal(fields.find((f) => f.key === 'field_start').value, next);
  assert.deepEqual(errors, []);

  // Settings page screenshot (cookie login in a normal tab).
  const admin = await ctx.newPage();
  await admin.goto(`${SITE}/wp-login.php`);
  await admin.fill('#user_login', USER);
  await admin.fill('#user_pass', PASS);
  await admin.click('#wp-submit');
  await admin.waitForURL(/wp-admin/);
  await admin.setViewportSize({ width: 1100, height: 900 });
  await admin.goto(`${SITE}/wp-admin/options-general.php?page=sidebar-editor-bridge`);
  await admin.screenshot({ path: resolve(OUT, 'real-wp-settings.png'), fullPage: true });

  // Unchecking "Connections" really disables token login, re-checking restores it.
  const tokenLogin = () => fetch(`${SITE}/wp-json/sidebar-editor/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }),
  }).then((r) => r.status);
  const box = admin.locator('input[type="checkbox"][name$="[allow_connections]"]');
  await box.uncheck();
  await admin.click('#submit');
  await admin.waitForSelector('#setting-error-settings_updated');
  assert.equal(await tokenLogin(), 403);
  await admin.locator('input[type="checkbox"][name$="[allow_connections]"]').check();
  await admin.click('#submit');
  await admin.waitForSelector('#setting-error-settings_updated');
  assert.equal(await tokenLogin(), 200);

  // "Sign out all extension sessions" revokes an existing token.
  const before = await (await fetch(`${SITE}/wp-json/sidebar-editor/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }),
  })).json();
  await admin.click('text=Sign out all extension sessions');
  await admin.waitForSelector('.notice-success');
  const probe = await fetch(`${SITE}/wp-json/wp/v2/users/me?context=edit`, { headers: { Authorization: `Bearer ${before.accessToken}` } });
  assert.equal(probe.status, 401);

  console.log(`real WP e2e: OK (field_start ${original} → ${next})`);
} finally {
  await ctx.close();
}
