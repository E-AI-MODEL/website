// Cloudflare Worker: public HTML gallery, isolated from the primary website.
const MAX_BYTES = 1024 * 1024;
const MAX_ITEMS = 100;
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', ...extra } });
}
function cors(origin, env) {
  const permitted = [env.ALLOWED_ORIGIN || 'https://eaimodel.nl', 'https://www.eaimodel.nl'];
  return permitted.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
}
function error(text, status, extra) { return json({ error: text }, status, extra); }
function validText(input, max) {
  return typeof input === 'string' && input.trim().length >= 2 && input.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(input);
}
function validId(id) { return /^[0-9]{13}-[a-f0-9-]{36}$/.test(id); }
function htmlHeaders() {
  return {
    ...headers,
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "sandbox allow-scripts allow-forms allow-modals allow-downloads; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src *; img-src * data: blob:; media-src * data: blob:; frame-ancestors https://eaimodel.nl https://www.eaimodel.nl; base-uri 'none'; form-action *",
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cache-Control': 'no-store', // Verborgen uploads mogen niet als HTML in een browsercache blijven staan.
  };
}
async function visitorKey(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode((env.RATE_LIMIT_SALT || '') + ':' + ip));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function verifyTurnstile(token, request, env) {
  if (!env.TURNSTILE_SECRET || !env.TURNSTILE_SITE_KEY) return false;
  const body = new FormData();
  body.set('secret', env.TURNSTILE_SECRET);
  body.set('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  if (!res.ok) return false;
  const result = await res.json();
  return result.success === true;
}
async function publish(request, env, extra) {
  if (request.headers.get('Origin') !== (extra['Access-Control-Allow-Origin'] || '')) return error('Deze aanvraag is niet toegestaan.', 403, extra);
  if (!env.DB) return error('Opslag is niet ingesteld.', 503, extra);
  const type = request.headers.get('content-type') || '';
  const size = Number(request.headers.get('content-length') || 0);
  if (!type.startsWith('multipart/form-data') || size > MAX_BYTES + 12000) return error('Ongeldig of te groot bestand.', 413, extra);
  let data;
  try { data = await request.formData(); } catch { return error('Upload kon niet worden gelezen.', 400, extra); }
  const title = data.get('title');
  const author = data.get('author');
  const file = data.get('file');
  const token = data.get('turnstileToken');
  if (!validText(title, 120) || !validText(author, 80)) return error('Vul een geldige naam en titel in.', 400, extra);
  if (!(file instanceof File) || !/\.html?$/i.test(file.name) || file.size < 10 || file.size > MAX_BYTES) return error('Upload een .html-bestand van maximaal 1 MB.', 400, extra);
  if (typeof token !== 'string' || !await verifyTurnstile(token, request, env)) return error('Controle tegen automatische uploads mislukt.', 403, extra);
  let content;
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
  catch { return error('Bewaar je bestand als UTF-8 HTML.', 400, extra); }
  const preview = content.slice(0, 2048);
  if (!/(<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(preview)) return error('Dit lijkt geen volledig HTML-document.', 400, extra);
  const hash = await visitorKey(request, env);
  const hour = new Date().toISOString().slice(0, 13);
  const rate = await env.DB.prepare('INSERT INTO upload_limits(visitor_hash, hour, count) VALUES (?, ?, 1) ON CONFLICT(visitor_hash, hour) DO UPDATE SET count = count + 1 RETURNING count').bind(hash, hour).first();
  if ((rate?.count || 0) > 5) return error('Je kunt maximaal vijf bestanden per uur uploaden.', 429, extra);
  const id = Date.now().toString().padStart(13, '0') + '-' + crypto.randomUUID();
  try {
    await env.DB.prepare('INSERT INTO uploads (id, title, author, filename, html_content) VALUES (?, ?, ?, ?, ?)').bind(id, title.trim(), author.trim(), file.name.slice(0, 180), content).run();
  } catch (err) {
    console.error('Gallery upload failed', err);
    return error('Het opslaan is mislukt.', 500, extra);
  }
  return json({ id, url: '/view/' + id }, 201, extra);
}

/**
 * Beheertoegang via een apart geheim in Cloudflare. De verborgen knop is
 * uitsluitend een toegang tot het formulier, nooit de autorisatie zelf.
 * Gebruik een willekeurige sleutel van ten minste 32 tekens.
 */
async function adminAllowed(request, env) {
  const expected = env.ADMIN_DELETE_KEY || '';
  const supplied = (request.headers.get('Authorization') || '').replace(/^Bearer /i, '');
  if (expected.length < 32 || supplied.length < 32 || supplied.length > 256) return false;
  const encoder = new TextEncoder();
  const [left,right] = await Promise.all([
    crypto.subtle.digest('SHA-256',encoder.encode(supplied)),
    crypto.subtle.digest('SHA-256',encoder.encode(expected))
  ]);
  const a=new Uint8Array(left),b=new Uint8Array(right);
  let difference=0;
  for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
  return difference===0;
}
async function administrativeAction(request, env, extra, uploadId = null) {
  if (request.headers.get('Origin') !== extra['Access-Control-Allow-Origin'])
    return error('Niet toegestaan.', 403, extra);
  if (!env.DB) return error('Database niet beschikbaar.', 503, extra);
  // Ook foutieve inlogpogingen worden begrensd, zonder geheimen te loggen.
  const visitor = await visitorKey(request, env);
  const hour = new Date().toISOString().slice(0,13);
  const key = 'admin:' + visitor;
  const attempts = await env.DB.prepare(
    'INSERT INTO upload_limits(visitor_hash, hour, count) VALUES (?, ?, 1) ON CONFLICT(visitor_hash, hour) DO UPDATE SET count = count + 1 RETURNING count'
  ).bind(key,hour).first();
  if ((attempts?.count || 0) > 20) return error('Te veel beheerpogingen. Probeer later opnieuw.',429,extra);
  if (!await adminAllowed(request, env)) return error('Geen toegang. Controleer de beheersleutel.',401,extra);
  if (uploadId === null) return json({ok:true},200,extra);
  if (!validId(uploadId)) return error('Ongeldige pagina.',400,extra);
  const result = await env.DB.prepare(
    "UPDATE uploads SET status = 'hidden' WHERE id = ? AND status = 'published'"
  ).bind(uploadId).run();
  if ((result.meta?.changes || 0) !== 1) return error('Pagina niet gevonden.',404,extra);
  return json({ok:true},200,extra);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const extra = cors(origin, env);
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      if (!extra['Access-Control-Allow-Origin']) return error('Niet toegestaan.', 403);
      return new Response(null, { status: 204, headers: { ...headers, ...extra, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' } });
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/session') return administrativeAction(request,env,extra);
    const remove = url.pathname.match(/^\/api\/admin\/uploads\/([^/]+)$/);
    if (request.method === 'DELETE' && remove) return administrativeAction(request,env,extra,remove[1]);
    if (request.method === 'GET' && url.pathname === '/api/config') return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || null }, 200, extra);
    if (request.method === 'GET' && url.pathname === '/api/uploads') {
      if (!env.DB) return error('Galerij niet beschikbaar.', 503, extra);
      const result = await env.DB.prepare("SELECT id, title, author, filename, created_at FROM uploads WHERE status = 'published' ORDER BY created_at DESC LIMIT ?").bind(MAX_ITEMS).all();
      return json({ items: result.results }, 200, extra);
    }
    if (request.method === 'POST' && url.pathname === '/api/uploads') return publish(request, env, extra);
    const match = url.pathname.match(/^\/view\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      if (!validId(match[1])) return error('Niet gevonden.', 404);
      if (!env.DB) return error('Galerij niet beschikbaar.', 503);
      const record = await env.DB.prepare("SELECT html_content FROM uploads WHERE id = ? AND status = 'published'").bind(match[1]).first();
      if (!record) return error('Niet gevonden.', 404);
      return new Response(record.html_content, { headers: htmlHeaders() });
    }
    return error('Niet gevonden.', 404, extra);
  },
};
