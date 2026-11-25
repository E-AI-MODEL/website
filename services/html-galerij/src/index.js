import { ictEditor } from './ict-editor.js';
// Private HTML gallery. The Worker is the only host for data and administration.
import { configured, currentUser, login, logout, loginResponse, sameOrigin } from './auth.js';
import { privatePage } from './ui.js';
import { dashboardPage } from './dashboard.js';
import { adminClientJs } from './admin-client.js';
import { handleAdmin, auditStatement } from './admin.js';

const MAX_BYTES = 1024 * 1024;
const MAX_ITEMS = 100;
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Cache-Control': 'no-store',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
function error(message, status) { return json({ error: message }, status); }
function validText(value, max) {
  return typeof value === 'string' && value.trim().length >= 2 &&
    value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}
function validId(id) { return /^[0-9]{13}-[a-f0-9-]{36}$/.test(id); }
function htmlHeaders() {
  return {
    ...headers,
    'Content-Type': 'text/html; charset=utf-8',
    // Untrusted uploaded scripts run in an opaque sandboxed origin, not with session access.
    'Content-Security-Policy': "sandbox allow-scripts allow-forms allow-modals allow-downloads; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src *; img-src * data: blob:; media-src * data: blob:; frame-ancestors 'self'; base-uri 'none'; form-action *",
    'Cross-Origin-Resource-Policy': 'same-origin'
  };
}
function dashboardHeaders() {
  return {
    ...headers,
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  };
}
async function visitorKey(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.RATE_LIMIT_SALT + ':' + ip));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
async function publish(request, env) {
  if (!sameOrigin(request)) return error('Niet toegestaan.', 403);
  const type = request.headers.get('content-type') || '';
  const length = Number(request.headers.get('content-length') || 0);
  if (!type.startsWith('multipart/form-data') || length > MAX_BYTES + 12000)
    return error('Ongeldig of te groot bestand.', 413);
  let data;
  try { data = await request.formData(); }
  catch { return error('Bestand kon niet worden gelezen.', 400); }
  const title = data.get('title');
  const author = data.get('author');
  const file = data.get('file');
  if (!validText(title, 120) || !validText(author, 80))
    return error('Vul een geldige naam en titel in.', 400);
  if (!(file instanceof File) || !/\.html?$/i.test(file.name) || file.size < 10 || file.size > MAX_BYTES)
    return error('Upload een HTML-bestand van maximaal 1 MB.', 400);
  let content;
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
  catch { return error('Bewaar je bestand als UTF-8 HTML.', 400); }
  if (!/(<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(content.slice(0, 2048)))
    return error('Dit lijkt geen volledig HTML-document.', 400);
  const hash = await visitorKey(request, env);
  const hour = new Date().toISOString().slice(0, 13);
  try {
    const rate = await env.DB.prepare(
      'INSERT INTO upload_limits(visitor_hash, hour, count) VALUES (?, ?, 1) ' +
      'ON CONFLICT(visitor_hash, hour) DO UPDATE SET count = count + 1 RETURNING count'
    ).bind(hash, hour).first();
    if ((rate?.count || 0) > 5) return error('Maximaal vijf bestanden per uur.', 429);
    const id = Date.now().toString().padStart(13, '0') + '-' + crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO uploads (id, title, author, filename, html_content) VALUES (?, ?, ?, ?, ?)')
        .bind(id, title.trim(), author.trim(), file.name.slice(0, 180), content),
      auditStatement(env, env.GALLERY_ADMIN_EMAIL.toLowerCase(), 'upload.published', id)
    ]);
    return json({ id, url: '/view/' + id }, 201);
  } catch (err) {
    console.error('Gallery save failed', err);
    return error('Opslaan is tijdelijk niet beschikbaar.', 503);
  }
}
async function hideUpload(request, env, id) {
  if (!sameOrigin(request)) return error('Niet toegestaan.', 403);
  if (!validId(id)) return error('Ongeldige pagina.', 400);
  try {
    const [, result] = await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO site_admin_audit(actor, action, target) " +
        "SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM uploads WHERE id=? AND status='published')"
      ).bind(env.GALLERY_ADMIN_EMAIL.toLowerCase(), 'upload.hidden', id, id),
      env.DB.prepare("UPDATE uploads SET status = 'hidden' WHERE id = ? AND status = 'published'").bind(id)
    ]);
    if ((result.meta?.changes || 0) !== 1) return error('Pagina niet gevonden.', 404);
    return json({ ok: true });
  } catch { return error('Beheer is tijdelijk niet beschikbaar.', 503); }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/auth/login' && request.method === 'POST') return login(request, env);
    if (path === '/auth/logout' && request.method === 'POST') return logout(request, env);

    if (!configured(env)) {
      if (path === '/' || path === '/auth/login') return loginResponse('Aanmelden is nog niet ingesteld.', 503);
      return error('De galerij is nog niet ingericht.', 503);
    }
    const user = await currentUser(request, env);
    if (path.startsWith('/ict-editor/')) return ictEditor(request, env, user, path);
    if (path === '/' || path === '/auth/login' || path === '/gallery') {
      if (request.method !== 'GET') return error('Methode niet toegestaan.', 405);
      if (!user) return loginResponse();
      if (path === '/auth/login') return new Response(null, { status: 303, headers: { ...headers, Location: '/' } });
      if (path === '/gallery') return new Response(privatePage(user), { status: 200, headers: dashboardHeaders() });
      return new Response(dashboardPage(user), { status: 200, headers: dashboardHeaders() });
    }
    if (!user) return error('Aanmelden vereist.', 401);
    if (request.method === 'GET' && path === '/admin-client.js') return new Response(adminClientJs, {
      status: 200, headers: { ...headers, 'Content-Type': 'application/javascript; charset=utf-8' }
    });
    const remove = path.match(/^\/api\/admin\/uploads\/([^/]+)$/);
    if (request.method === 'DELETE' && remove) return hideUpload(request, env, remove[1]);
    if (path.startsWith('/api/admin/')) {
      const adminResponse = await handleAdmin(request, env, user);
      if (adminResponse) return adminResponse;
    }
    if (request.method === 'GET' && path === '/api/me') return json({ email: user });
    if (request.method === 'GET' && path === '/api/uploads') {
      try {
        const records = await env.DB.prepare(
          "SELECT id, title, author, filename, created_at FROM uploads WHERE status = 'published' " +
          'ORDER BY created_at DESC LIMIT ?'
        ).bind(MAX_ITEMS).all();
        return json({ items: records.results || [] });
      } catch { return error('De galerij is tijdelijk niet beschikbaar.', 503); }
    }
    if (request.method === 'POST' && path === '/api/uploads') return publish(request, env);
    const view = path.match(/^\/view\/([^/]+)$/);
    if (request.method === 'GET' && view) {
      if (!validId(view[1])) return error('Niet gevonden.', 404);
      try {
        const record = await env.DB.prepare(
          "SELECT html_content FROM uploads WHERE id = ? AND status = 'published'"
        ).bind(view[1]).first();
        if (!record) return error('Niet gevonden.', 404);
        return new Response(record.html_content, { status: 200, headers: htmlHeaders() });
      } catch { return error('Voorbeeld is tijdelijk niet beschikbaar.', 503); }
    }
    return error('Niet gevonden.', 404);
  }
};
