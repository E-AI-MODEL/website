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
const attempts = new Map();
const uploads = new Map([[itemId, {
  id: itemId, title: 'Voorbeeld', author: 'Maker', filename: 'proef.html',
  html_content: '<!doctype html><html><body>Voorbeeld</body></html>',
  created_at: '2026-11-15 12:00:00', status: 'published'
}]]);
const DB = {
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
      }
    };
  }
};
const env = { DB, GALLERY_ADMIN_EMAIL: EMAIL, GALLERY_PASSWORD_HASH: hash,
  RATE_LIMIT_SALT: 'a-dedicated-secret-only-for-this-test' };
function req(path, method = 'GET', { cookie = '', origin = null, body = undefined } = {}) {
  const headers = {};
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
let response = await worker.fetch(req('/'), env);
assert.equal(response.status, 200);
assert.match(await response.text(), /Inloggen bij de HTML-galerij/);
assert.equal(response.headers.get('Cache-Control'), 'no-store');

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
assert.equal(await statusOf(req('/api/uploads', 'GET', { cookie })), 200);
assert.equal(await statusOf(req('/view/' + itemId, 'GET', { cookie })), 200);
response = await worker.fetch(req('/', 'GET', { cookie }), env);
const dashboard = await response.text();
assert.equal(response.status, 200);
assert.match(dashboard, /Mijn HTML-galerij/);
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
assert.equal(await statusOf(req('/view/' + itemId, 'GET', { cookie })), 404);
assert.equal(await statusOf(req('/api/admin/uploads/' + itemId, 'DELETE',
  { cookie, origin: BASE })), 404);

// Logout revokes sessions rather than only deleting the browser cookie.
response = await worker.fetch(req('/auth/logout', 'POST', { cookie, origin: BASE }), env);
assert.equal(response.status, 303);
assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
assert.equal(sessions.size, 0);
assert.equal(await statusOf(req('/api/uploads', 'GET', { cookie })), 401);

// Invalid or absent Origin must never authorize a login POST.
assert.equal(await statusOf(req('/auth/login', 'POST',
  { body: (() => { const x = new FormData(); x.set('email', EMAIL); x.set('password', PASSWORD); return x; })() })), 403);
console.log('Gallery login, session, CSRF, access and logout regression tests pass.');
