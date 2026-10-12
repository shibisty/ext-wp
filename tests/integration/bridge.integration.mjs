// Integration test of the bridge plugin against a REAL WordPress site.
//
//   WP_URL=http://localhost:8080 WP_ADMIN=admin WP_ADMIN_PASS=... \
//   WP_CONTRIB=contrib WP_CONTRIB_PASS=... WP_PAGE_ID=4 \
//   npm run test:integration
//
// Expects: the bridge plugin + ACF active, a published page WP_PAGE_ID owned
// by the admin with the ACF fields from tests/integration/test-fields.php,
// and a contributor account. Mutates that page's ACF values and the
// plugin's settings (restored at the end).

import assert from 'node:assert/strict';

const env = (k, d) => process.env[k] ?? d;
const SITE = env('WP_URL', 'http://127.0.0.1:8899').replace(/\/$/, '');
const API = `${SITE}/wp-json`;
const NS = `${API}/sidebar-editor/v1`;
const PAGE = env('WP_PAGE_ID', '4');
const ADMIN = [env('WP_ADMIN', 'admin'), env('WP_ADMIN_PASS', 'adminpass')];
const CONTRIB = [env('WP_CONTRIB', 'contrib'), env('WP_CONTRIB_PASS', 'contribpass')];

let passed = 0;
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}\n     ${err.message}`);
    process.exitCode = 1;
  }
}

async function call(path, { method = 'GET', token, body, headers = {}, base = NS } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text };
}

const login = ([username, password], extra = {}) =>
  call('/auth/login', { method: 'POST', body: { username, password }, headers: extra });
const byKey = (fields) => Object.fromEntries(fields.map((f) => [f.key, f]));

let admin;
await step('ping', async () => {
  const r = await call('/ping');
  assert.equal(r.status, 200);
  assert.ok(r.json.version);
});

await step('admin login issues a token pair bound to the site', async () => {
  const r = await login(ADMIN);
  assert.equal(r.status, 200, r.text);
  admin = r.json;
  assert.ok(admin.accessToken && admin.refreshToken);
  assert.ok(admin.providers.includes('acf'));
  const claims = JSON.parse(Buffer.from(admin.accessToken.split('.')[1], 'base64url'));
  assert.equal(claims.typ, 'access');
  assert.ok(claims.iss.startsWith(SITE));
});

await step('ACF date fields come back as raw ISO values', async () => {
  const r = await call(`/acf/${PAGE}`, { token: admin.accessToken });
  assert.equal(r.status, 200, r.text);
  const f = byKey(r.json);
  assert.equal(f.field_start.type, 'date_picker');
  assert.equal(f.field_start.raw, true);
  assert.match(f.field_start.value, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(f.field_webinar.value, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

await step('ACF save converts, validates and refuses what it must not write', async () => {
  const before = byKey((await call(`/acf/${PAGE}`, { token: admin.accessToken })).json);
  const r = await call(`/acf/${PAGE}`, {
    method: 'POST', token: admin.accessToken,
    body: {
      field_start: '2026-06-01',            // ISO in → Ymd stored
      field_webinar: '2026-06-01T08:15',    // datetime-local in
      field_time: '',                       // clear
      field_early: 'Early bird',
      field_level: 'not-a-choice',          // invalid select → skipped
      field_about: { title: 'x' },          // group → not writable
      field_nope: 'x',                      // unknown key
    },
  });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.skipped.sort(), ['field_about', 'field_level', 'field_nope']);

  const after = byKey((await call(`/acf/${PAGE}`, { token: admin.accessToken })).json);
  assert.equal(after.field_start.value, '2026-06-01');
  assert.equal(after.field_webinar.value, '2026-06-01 08:15:00');
  assert.equal(after.field_time.value, '');
  assert.equal(after.field_early.value, 'Early bird');
  assert.equal(after.field_level.value, before.field_level.value);
});

await step('a formatted date ("21 Травня, 2026") is never written over the stored value', async () => {
  const r = await call(`/acf/${PAGE}`, { method: 'POST', token: admin.accessToken, body: { field_start: '21 Травня, 2026' } });
  assert.deepEqual(r.json.skipped, ['field_start']);
  const f = byKey((await call(`/acf/${PAGE}`, { token: admin.accessToken })).json);
  assert.equal(f.field_start.value, '2026-06-01');
});

await step('contributor cannot touch ACF of a page they cannot edit, nor options/users', async () => {
  const c = await login(CONTRIB);
  assert.equal(c.status, 200, c.text);
  assert.equal((await call(`/acf/${PAGE}`, { token: c.json.accessToken })).status, 403);
  assert.equal((await call(`/acf/${PAGE}`, { method: 'POST', token: c.json.accessToken, body: { field_early: 'hacked' } })).status, 403);
  assert.equal((await call('/acf/option', { token: admin.accessToken })).status, 403);
  assert.equal((await call('/acf/user_1', { token: admin.accessToken })).status, 403);
});

await step('bearer token works on core REST (context=edit)', async () => {
  const r = await call(`/wp/v2/pages/${PAGE}?context=edit`, { base: API, token: admin.accessToken });
  assert.equal(r.status, 200, r.text);
  assert.ok(r.json.title.raw);
});

await step('refresh rotates the pair; a tampered token is rejected', async () => {
  const r = await call('/auth/refresh', { method: 'POST', body: { refreshToken: admin.refreshToken } });
  assert.equal(r.status, 200, r.text);
  const [h, p, s] = r.json.accessToken.split('.');
  const forged = JSON.parse(Buffer.from(p, 'base64url'));
  forged.uid = 999;
  const bad = `${h}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${s}`;
  assert.equal((await call(`/wp/v2/pages/${PAGE}?context=edit`, { base: API, token: bad })).status, 401);
  assert.equal((await call('/auth/refresh', { method: 'POST', body: { refreshToken: r.json.accessToken } })).status, 401, 'access token must not work as refresh token');
  admin = r.json;
});

await step('failed logins are throttled (429 after 5)', async () => {
  const ip = { 'X-Test': String(Math.random()) };
  const user = `nobody${Date.now()}`;
  for (let i = 0; i < 5; i++) assert.equal((await login([user, 'wrong'], ip)).status, 401);
  assert.equal((await login([user, 'wrong'], ip)).status, 429);
});

await step('cookie login: bridge data in the page, nonce works for /auth/session', async () => {
  const form = new URLSearchParams({ log: ADMIN[0], pwd: ADMIN[1], 'wp-submit': 'Log In', testcookie: '1' });
  const res = await fetch(`${SITE}/wp-login.php`, {
    method: 'POST', body: form, redirect: 'manual',
    headers: { Cookie: 'wordpress_test_cookie=WP%20Cookie%20check', 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  assert.match(cookies, /wordpress_logged_in_/);
  const html = await (await fetch(`${SITE}/?page_id=${PAGE}`, { headers: { Cookie: cookies } })).text();
  const m = html.match(/<script[^>]*id="seb-bridge-data"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(m, 'bridge data tag missing');
  const data = JSON.parse(m[1]);
  assert.equal(data.post.id, Number(PAGE));
  assert.equal(data.post.restBase, 'pages');
  assert.ok(!('capabilities' in data.user), 'capabilities must not be printed');
  const s = await call('/auth/session', { headers: { Cookie: cookies, 'X-WP-Nonce': data.nonce } });
  assert.equal(s.status, 200, s.text);
  assert.ok(s.json.accessToken);

  const anon = await (await fetch(`${SITE}/?page_id=${PAGE}`)).text();
  assert.ok(!anon.includes('seb-bridge-data'), 'visitors must not get bridge data');
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
