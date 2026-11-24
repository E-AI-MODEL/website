import { cookieToken, sameOrigin, sha256 } from './auth.js';

const callback = 'https://eaimodel.nl/tools/ict-scan/edit-api.php';
const headers = {'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const reject = () => new Response('Geen geldige beheersessie.', {status:403,headers});
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b=>b.toString(16).padStart(2,'0')).join('');

export async function ictEditor(request, env, user, path) {
  if (request.method !== 'POST') return reject();
  const now = Math.floor(Date.now()/1000);
  if (path === '/ict-editor/open') {
    if (!user || !sameOrigin(request)) return reject();
    const code = random();
    const session = await sha256(env.GALLERY_PASSWORD_HASH + ':' + cookieToken(request));
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ict_editor_grants WHERE expires_at <= ?').bind(now),
      env.DB.prepare('INSERT INTO ict_editor_grants(grant_hash,session_hash,expires_at) VALUES(?,?,?)').bind(await sha256(env.GALLERY_PASSWORD_HASH+':code:'+code),session,now+90)
    ]);
    const nonce = random();
    const html = '<!doctype html><html lang="nl"><meta charset="utf-8"><title>ICT-scan openen</title><form method="post" action="'+callback+'"><input type="hidden" name="code" value="'+code+'"><button>Open de ICT-scan</button></form><script nonce="'+nonce+'">document.forms[0].submit()</script></html>';
    return new Response(html,{headers:{...headers,'Referrer-Policy':'strict-origin','Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action "+callback+"; script-src 'nonce-"+nonce+"'" }});
  }
  const bearer = request.headers.get('Authorization') || '';
  if (!/^Bearer [a-f0-9]{64}$/.test(bearer)) return reject();

  const live = 'session_hash IN (SELECT token_hash FROM gallery_sessions WHERE expires_at > ? AND email = ?)';
  const owner = env.GALLERY_ADMIN_EMAIL.toLowerCase();
  if (path === '/ict-editor/redeem') {
    const hash = await sha256(env.GALLERY_PASSWORD_HASH+':code:'+bearer.slice(7));
    const token = random();
    const row = await env.DB.prepare('UPDATE ict_editor_grants SET grant_hash=?, redeemed=1, expires_at=? WHERE grant_hash=? AND redeemed=0 AND expires_at>? AND '+live+' RETURNING session_hash').bind(await sha256(env.GALLERY_PASSWORD_HASH+":"+token),now+14400,hash,now,now,owner).first();
    return row ? Response.json({token},{headers}) : reject();
  }
  if (path !== '/ict-editor/check') return reject();
  const scoped = await sha256(env.GALLERY_PASSWORD_HASH+":"+bearer.slice(7));
  const row = await env.DB.prepare('SELECT 1 FROM ict_editor_grants WHERE grant_hash=? AND redeemed=1 AND expires_at>? AND '+live).bind(scoped,now,now,owner).first();
  return row ? Response.json({active:true},{headers}) : reject();
}
