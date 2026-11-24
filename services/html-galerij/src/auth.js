// A single-owner login for the HTML gallery. Credentials are secrets, not source code.
const COOKIE = '__Host-eai_gallery_session';
const MAX_AGE = 8 * 60 * 60;
const encoder = new TextEncoder();
const noCache = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive' };

function reply(message, status = 200, extra = {}) {
  return new Response(message, { status, headers: { ...noCache, ...extra } });
}
function escaped(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function configured(env) {
  return !!(env.DB && env.GALLERY_ADMIN_EMAIL && env.GALLERY_PASSWORD_HASH && env.RATE_LIMIT_SALT);
}
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}
function decodeBase64(value) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Invalid base64');
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
// Cloudflare Workers caps native PBKDF2 at 100,000 iterations on the
// standard runtime. The 310,000 format is retained for legacy hashes only
// where the runtime supports it. Never report a failed KDF as a bad password.
async function passwordMatches(password, spec) {
  if (typeof password !== 'string' || password.length > 1024) return false;
  if (typeof spec !== 'string') throw new Error('Credential configuration');
  const [type, iter, saltText, hashText, extra] = spec.split('$');
  if (extra !== undefined || type !== 'pbkdf2_sha256' ||
      !['100000', '310000'].includes(iter)) throw new Error('Credential configuration');
  const salt = decodeBase64(saltText);
  const expected = decodeBase64(hashText);
  if (salt.length !== 24 || expected.length !== 32) throw new Error('Credential configuration');
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', salt, iterations: Number(iter)
  }, key, 256));
  return constantTimeEqual(actual, expected);
}
async function rateLimited(request, env) {
  // Both per-client and global limits to constrain credential guessing.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const window = Math.floor(Date.now() / (15 * 60 * 1000));
  const hash = await sha256(env.RATE_LIMIT_SALT + ':' + ip);
  const buckets = ['ip:' + hash, 'global'];
  let blocked = false;
  for (const key of buckets) {
    const row = await env.DB.prepare(
      'INSERT INTO gallery_login_attempts (bucket, window, count) VALUES (?, ?, 1) ' +
      'ON CONFLICT (bucket, window) DO UPDATE SET count=count+1 RETURNING count'
    ).bind(key, window).first();
    if (Number(row?.count || 0) > (key === 'global' ? 120 : 6)) blocked = true;
  }
  return blocked;
}
function cookieToken(request) {
  const value = (request.headers.get('Cookie') || '').split(';').map(x => x.trim())
    .find(x => x.startsWith(COOKIE + '='));
  const token = value ? value.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
async function currentUser(request, env) {
  if (!configured(env)) return null;
  const token = cookieToken(request);
  if (!token) return null;
  try {
    const row = await env.DB.prepare(
      'SELECT email FROM gallery_sessions WHERE token_hash = ? AND expires_at > ?'
    ).bind(await sha256(env.GALLERY_PASSWORD_HASH + ':' + token), Math.floor(Date.now() / 1000)).first();
    return row?.email === env.GALLERY_ADMIN_EMAIL.toLowerCase() ? row.email : null;
  } catch {
    return null;
  }
}
function loginPage(message = '') {
  const status = message ? '<p role="alert" class="error">' + escaped(message) + '</p>' : '';
  return '<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Inloggen | EAI Beheer</title>' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f8f4;color:#1b2a23;font:16px/1.5 system-ui,sans-serif}' +
    'main{width:min(420px,calc(100vw - 40px));background:#fff;border:1px solid #d9e4dc;border-radius:14px;padding:32px;box-shadow:0 18px 50px #142b1a0c}' +
    'h1{font:400 34px/1.2 Georgia,serif;margin:4px 0 14px}p{color:#53665a}label{display:block;font-size:13px;font-weight:650;margin:20px 0 6px}' +
    'input{display:block;width:100%;box-sizing:border-box;padding:12px;border:1px solid #b5c8b9;border-radius:7px;font:inherit}' +
    'button{margin-top:25px;cursor:pointer;width:100%;padding:13px;border:0;border-radius:7px;background:#27563e;color:#fff;font:600 15px system-ui}' +
    '.error{color:#a02927}a{color:#27563e}</style></head><body><main><div>EAI · Beveiligde omgeving</div>' +
    '<h1>Inloggen bij EAI Beheer</h1><p>Bekijk je websitegegevens, controles en publicaties en beheer je HTML-bestanden. Alleen de beheerder heeft toegang.</p>' +
    status +
    '<form method="post" action="/auth/login" autocomplete="on"><label for="email">E-mailadres</label>' +
    '<input id="email" name="email" type="email" autocomplete="username" required maxlength="254">' +
    '<label for="password">Wachtwoord</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024">' +
    '<button type="submit">Inloggen</button></form><p><a href="https://eaimodel.nl/">Terug naar EAI</a></p></main></body></html>';
}
function loginResponse(message = '', status = 200) {
  return reply(loginPage(message), status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
  });
}
function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin === new URL(request.url).origin) return true;
  // iOS Safari can send Origin: null for an ordinary same-origin HTML form POST.
  // Accept only top-level, same-origin browser navigations to login/logout.
  // Cross-site forms report Sec-Fetch-Site: cross-site and remain blocked.
  const path = new URL(request.url).pathname;
  return origin === 'null' &&
    request.method === 'POST' &&
    (path === '/auth/login' || path === '/auth/logout') &&
    request.headers.get('Sec-Fetch-Site') === 'same-origin' &&
    request.headers.get('Sec-Fetch-Mode') === 'navigate' &&
    request.headers.get('Sec-Fetch-Dest') === 'document';
}
async function login(request, env) {
  if (!configured(env)) return loginResponse('Aanmelden is nog niet ingesteld.', 503);
  if (!sameOrigin(request)) return reply('Niet toegestaan.', 403);
  if (Number(request.headers.get('Content-Length') || 0) > 4096) return reply('Ongeldig verzoek.', 413);
  let data;
  try { data = await request.formData(); } catch { return loginResponse('Ongeldig verzoek.', 400); }
  const email = String(data.get('email') || '').trim().toLowerCase();
  const password = data.get('password');
  try {
    const blocked = await rateLimited(request, env);
    if (blocked) return loginResponse('Te veel pogingen. Probeer het over vijftien minuten opnieuw.', 429);
    let valid;
    try {
      valid = await passwordMatches(password, env.GALLERY_PASSWORD_HASH);
    } catch {
      console.error('EAI_GALLERY_PASSWORD_VERIFICATION_UNAVAILABLE');
      return loginResponse('De wachtwoordcontrole is tijdelijk niet beschikbaar. Controleer de beheerinstellingen.', 503);
    }
    if (email !== env.GALLERY_ADMIN_EMAIL.toLowerCase() || !valid) return loginResponse('E-mailadres of wachtwoord onjuist.', 401);
    const random = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(random, x => x.toString(16).padStart(2, '0')).join('');
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO gallery_sessions(token_hash,email,expires_at) VALUES (?,?,?)')
      .bind(await sha256(env.GALLERY_PASSWORD_HASH + ':' + token), email, now + MAX_AGE).run();
    return reply(null, 303, {
      'Location': '/',
      'Set-Cookie': COOKIE + '=' + token + '; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=' + MAX_AGE
    });
  } catch {
    return loginResponse('De aanmelding is tijdelijk niet beschikbaar.', 503);
  }
}
async function logout(request, env) {
  if (!sameOrigin(request)) return reply('Niet toegestaan.', 403);
  const token = cookieToken(request);
  try {
    if (token && env.DB) await env.DB.prepare('DELETE FROM gallery_sessions WHERE token_hash = ?')
      .bind(await sha256(env.GALLERY_PASSWORD_HASH + ':' + token)).run();
  } catch { return reply('Afmelden is tijdelijk niet beschikbaar.', 503); }
  return reply(null, 303, {
    'Location': '/',
    'Set-Cookie': COOKIE + '=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'
  });
}
export { configured, currentUser, login, logout, loginResponse, sameOrigin };
