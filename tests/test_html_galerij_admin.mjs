import assert from 'node:assert/strict';
import { randomBytes, pbkdf2Sync, webcrypto } from 'node:crypto';
import worker from '../services/html-galerij/src/index.js';
import { privatePage } from '../services/html-galerij/src/ui.js';
import { readFileSync } from 'node:fs';

globalThis.crypto ||= webcrypto;
const BASE = 'https://eai-html-galerij.vis-c9d.workers.dev';
const EMAIL = 'beheer@example.test';
const PASSWORD = 'A deliberately long test password 7.%@!';
const salt = randomBytes(24);
const hash = 'pbkdf2_sha256$310000$' + salt.toString('base64') + '$' +
  pbkdf2Sync(PASSWORD, salt, 310000, 32, 'sha256').toString('base64');
const itemId = '1762800000000-11111111-1111-4111-8111-111111111111';
const sessions = new Map();
const auditActions=[];
const attempts = new Map();
const uploads = new Map([[itemId, {
  id: itemId, title: 'Voorbeeld', author: 'Maker', filename: 'proef.html',
  html_content: '<!doctype html><html><body>Voorbeeld</body></html>',
  created_at: '2026-11-15 12:00:00', status: 'published'
}]]);
const DB = {
  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  },
  prepare(sql) {
    return {
      bind(...args) {
        return {
          async first() {
            if (sql.startsWith('INSERT INTO gallery_login_attempts')) {
              const key = String(args[0]) + ':' + args[1];
              const count = (attempts.get(key) || 0) + 1;
              attempts.set(key, count);
              return { count };
            }
            if (sql.startsWith('SELECT email FROM gallery_sessions')) {
              const session = sessions.get(args[0]);
              return session && session.expires_at > args[1] ? { email: session.email } : null;
            }
            if (sql.startsWith('SELECT html_content')) {
              const upload = uploads.get(args[0]);
              return upload && upload.status === 'published' ? { html_content: upload.html_content } : null;
            }
            if (sql.startsWith('INSERT INTO upload_limits')) return { count: 1 };
            throw new Error('Unexpected DB first: ' + sql);
          },
          async run() {
            if (sql.startsWith('INSERT INTO gallery_sessions')) {
              sessions.set(args[0], { email: args[1], expires_at: args[2] });
              return { success: true };
            }
            if (sql.startsWith('DELETE FROM gallery_sessions')) {
              sessions.delete(args[0]);
              return { success: true };
            }
            if (sql.startsWith('INSERT INTO site_admin_audit')) {
              const conditional = sql.includes('WHERE EXISTS');
              if (conditional && uploads.get(args[3])?.status !== 'published') return {meta:{changes:0}};
              auditActions.push({actor:args[0],action:args[1],target:args[2]});
              return {meta:{changes:1}};
            }
            if (sql.startsWith('INSERT INTO uploads')) {
              const [id, title, author, filename, html_content] = args;
              uploads.set(id, { id, title, author, filename, html_content,
                status: 'published', created_at: new Date().toISOString() });
              return { success: true };
            }
            if (sql.startsWith('UPDATE uploads SET status')) {
              const item = uploads.get(args[0]);
              const changes = item && item.status === 'published' ? 1 : 0;
              if (changes) item.status = 'hidden';
              return { meta: { changes } };
            }
            throw new Error('Unexpected DB run: ' + sql);
          },
          async all() {
            if (sql.startsWith('SELECT id, title, author')) {
              return { results: Array.from(uploads.values())
                .filter(x => x.status === 'published')
                .map(({ id, title, author, filename, created_at }) =>
                  ({ id, title, author, filename, created_at })) };
            }
            throw new Error('Unexpected DB all: ' + sql);
          }
        };
      },
      run() { return this.bind().run(); }
    };
  }
};
const env = { DB, GALLERY_ADMIN_EMAIL: EMAIL, GALLERY_PASSWORD_HASH: hash,
  RATE_LIMIT_SALT: 'a-dedicated-secret-only-for-this-test' };
function req(path, method = 'GET', { cookie = '', origin = null, body = undefined, extraHeaders = {} } = {}) {
  const headers = { ...extraHeaders };
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  return new Request(BASE + path, { method, headers, body });
}
const statusOf = async (request, config = env) => (await worker.fetch(request, config)).status;

// The server must fail closed when secrets or database have not been provisioned.
assert.equal(await statusOf(req('/api/uploads'), { DB }), 503);
assert.equal(await statusOf(req('/api/admin/uploads/' + itemId, 'DELETE',
  { origin: BASE }), { DB }), 503);
assert.equal(await statusOf(req('/view/' + itemId), { DB }), 503);

// A public visitor cannot read the list, view uploaded HTML or delete anything.
assert.equal(await statusOf(req('/api/uploads')), 401);
assert.equal(await statusOf(req('/view/' + itemId)), 401);
assert.equal(await statusOf(req('/api/admin/uploads/' + itemId, 'DELETE', { origin: BASE })), 401);
assert.equal(uploads.get(itemId).status, 'published');
for (const path of ['/api/admin/overview', '/api/admin/traffic', '/api/admin/health', '/api/admin/deploy', '/api/admin/files', '/api/admin/audit']) {
  assert.equal(await statusOf(req(path)), 401, path);
}
assert.equal(await statusOf(req('/api/admin/uploads/' + itemId + '/restore', 'POST', { origin: BASE })), 401);
assert.equal(await statusOf(req('/api/admin/sessions/revoke', 'POST', { origin: BASE })), 401);
assert.equal(uploads.get(itemId).status, 'published');
assert.equal(auditActions.length, 0);

let response = await worker.fetch(req('/'), env);
assert.equal(response.status, 200);
assert.match(await response.text(), /Inloggen bij EAI Beheer/);
assert.equal(response.headers.get('Cache-Control'), 'no-store');
assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');

const loginForm = (email, password) => {
  const data = new FormData();
  data.set('email', email);
  data.set('password', password);
  return req('/auth/login', 'POST', { origin: BASE, body: data });
};
response = await worker.fetch(loginForm(EMAIL, 'wrong password'), env);
assert.equal(response.status, 401);
assert.equal(sessions.size, 0);
response = await worker.fetch(loginForm(EMAIL, PASSWORD), env);
assert.equal(response.status, 303);
assert.equal(response.headers.get('Location'), '/');
const setCookie = response.headers.get('Set-Cookie');
assert.match(setCookie, /^__Host-eai_gallery_session=[a-f0-9]{64};/);
for (const token of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/']) {
  assert.ok(setCookie.includes(token), token);
}
const cookie = setCookie.split(';')[0];
assert.equal(sessions.size, 1);
const savedSession = [...sessions.values()][0];
const originalExpiry = savedSession.expires_at;
savedSession.expires_at = 0;
assert.equal(await statusOf(req('/api/uploads', 'GET', { cookie })), 401);
assert.equal(await statusOf(req('/api/admin/uploads/' + itemId, 'DELETE', { cookie, origin: BASE })), 401);
assert.equal(uploads.get(itemId).status, 'published');
savedSession.expires_at = originalExpiry;

assert.equal(await statusOf(req('/api/uploads', 'GET', { cookie })), 200);
assert.equal(await statusOf(req('/view/' + itemId, 'GET', { cookie })), 200);
response = await worker.fetch(req('/', 'GET', { cookie }), env);
const dashboard = await response.text();
assert.equal(response.status, 200);
assert.match(dashboard, /Websiteoverzicht/);
assert.match(dashboard, /admin-client.js/);
assert.equal(await statusOf(req('/admin-client.js')), 401);
assert.equal(await statusOf(req('/admin-client.js','GET',{cookie})), 200);
const galleryPage = await worker.fetch(req('/gallery','GET',{cookie}),env);
assert.match(await galleryPage.text(), /Mijn HTML-galerij/);
assert.ok(!dashboard.includes(PASSWORD), 'password is never exposed');
assert.equal(response.headers.get('Content-Security-Policy').includes('frame-ancestors'), true);

// The page scripts are valid and the old anonymous three-click admin path is gone.
const script = privatePage(EMAIL).match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script);
new Function(script[1]);
assert.ok(dashboard.includes('method="post" action="/auth/logout"'));
const landing = readFileSync(new URL('../tools/html-galerij/index.html', import.meta.url), 'utf8');
assert.match(landing, /Inloggen/);
assert.ok(!landing.includes('secret-entrance'));
assert.ok(!landing.includes('id="upload-form"'));

// CSRF: an authenticated browser with a foreign Origin cannot change gallery data.
assert.equal(await statusOf(req('/api/admin/uploads/' + itemId, 'DELETE',
  { cookie, origin: 'https://malicious.example' })), 403);
assert.equal(uploads.get(itemId).status, 'published');

// A logged-in owner may hide a page; hiding it removes even its direct URL.
assert.equal(await statusOf(req('/api/admin/uploads/' + itemId, 'DELETE',
  { cookie, origin: BASE })), 200);
assert.equal(uploads.get(itemId).status, 'hidden');
assert.equal(auditActions.at(-1).action,'upload.hidden');
assert.equal(await statusOf(req('/view/' + itemId, 'GET', { cookie })), 404);
assert.equal(await statusOf(req('/api/admin/uploads/' + itemId, 'DELETE',
  { cookie, origin: BASE })), 404);

// Logout revokes sessions rather than only deleting the browser cookie.
response = await worker.fetch(req('/auth/logout', 'POST', { cookie, origin: BASE }), env);
assert.equal(response.status, 303);
assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
assert.equal(sessions.size, 0);
assert.equal(await statusOf(req('/api/uploads', 'GET', { cookie })), 401);

// Safari on iOS can send Origin: null on a same-origin HTML form navigation.
// Accept that narrow case without accepting cross-site forms or other mutations.
const safariNavigation = {
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document'
};
const safariForm = (site = 'same-origin', origin = 'null') => {
  const body = new URLSearchParams({ email: EMAIL, password: PASSWORD });
  return req('/auth/login', 'POST', {
    origin, body,
    extraHeaders: { ...safariNavigation, 'Sec-Fetch-Site': site }
  });
};
assert.equal(await statusOf(safariForm('cross-site')), 403);
assert.equal(await statusOf(safariForm('same-site')), 403);
assert.equal(await statusOf(req('/auth/login', 'POST', {
  origin: 'null', body: new URLSearchParams({ email: EMAIL, password: PASSWORD })
})), 403);
assert.equal(await statusOf(req('/auth/login', 'POST', {
  origin: 'https://malicious.example', body: new URLSearchParams({ email: EMAIL, password: PASSWORD }),
  extraHeaders: safariNavigation
})), 403);
response = await worker.fetch(safariForm(), env);
assert.equal(response.status, 303, 'iOS Safari same-origin form must log in');
const safariCookie = response.headers.get('Set-Cookie').split(';')[0];
assert.equal(await statusOf(req('/api/uploads', 'GET', { cookie: safariCookie })), 200);
assert.equal(await statusOf(req('/api/admin/uploads/' + itemId, 'DELETE', {
  origin: 'null', cookie: safariCookie, extraHeaders: safariNavigation
})), 403, 'Safari exception must never weaken admin POST/DELETE routes');
response = await worker.fetch(req('/auth/logout', 'POST', {
  origin: 'null', cookie: safariCookie, extraHeaders: safariNavigation
}), env);
assert.equal(response.status, 303);
assert.equal(sessions.size, 0);

// Invalid or absent Origin must never authorize a login POST.
assert.equal(await statusOf(req('/auth/login', 'POST',
  { body: (() => { const x = new FormData(); x.set('email', EMAIL); x.set('password', PASSWORD); return x; })() })), 403);
console.log('Gallery login, session, CSRF, access and logout regression tests pass.');
