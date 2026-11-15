// Authenticated website administration: explicit sources, limited read APIs, no third-party write tokens.
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff"
};
const INSIGHTS = "https://ngcyfbstajfcfdhlelbz.supabase.co/functions/v1/eai-site-insights";
const GITHUB = "https://api.github.com/repos/E-AI-MODEL/website";
const SITE = "https://eaimodel.nl";
const CHECKS = [
  { id: "home", name: "Homepage", path: "/" },
  { id: "science", name: "Science Observatory", path: "/tools/science-observatory/" },
  { id: "anatomie", name: "Anatomie", path: "/tools/anatomie/" },
  { id: "monitor", name: "AI Model Monitor", path: "/model-monitor/" },
  { id: "galerij", name: "HTML-galerij (ingang)", path: "/tools/html-galerij/" },
  { id: "statistieken", name: "Website-inzichten", path: "/nl/insights/" }
];
function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });
}
function fail(text = "Beheerinformatie niet beschikbaar.", status = 503) {
  return json({ error: text }, status);
}
function safeId(value) { return /^[0-9]{13}-[a-f0-9-]{36}$/.test(value); }
function sameOrigin(request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}
function count(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n < 1e12 ? Math.floor(n) : 0;
}
async function requestJson(url, ms = 4000, headers = {}) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(ms)
  });
  if (!response.ok) throw new Error("Upstream HTTP " + response.status);
  const type = response.headers.get("Content-Type") || "";
  if (!type.toLowerCase().includes("json")) throw new Error("Response is not JSON");
  return response.json();
}
export async function recordAdminAction(env, actor, action, target = "") {
  // No request data, IP, credentials or uploaded HTML in the audit trail.
  await env.DB.prepare(
    "INSERT INTO site_admin_audit(actor, action, target) VALUES (?, ?, ?)"
  ).bind(actor, action, target).run();
}
async function overview(env) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(Date.now() / 900000);
    const [gallery, active, attempts, audit] = await Promise.all([
      env.DB.prepare(
        "SELECT COUNT(*) AS total, " +
        "SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) AS published, " +
        "SUM(CASE WHEN status='hidden' THEN 1 ELSE 0 END) AS hidden, " +
        "MAX(created_at) AS newest FROM uploads"
      ).first(),
      env.DB.prepare(
        "SELECT COUNT(*) AS total FROM gallery_sessions WHERE expires_at > ?"
      ).bind(now).first(),
      env.DB.prepare(
        "SELECT count FROM gallery_login_attempts WHERE bucket='global' AND window=?"
      ).bind(window).first(),
      env.DB.prepare(
        "SELECT id, actor, action, target, created_at FROM site_admin_audit ORDER BY id DESC LIMIT 5"
      ).all()
    ]);
    return json({
      source: "Cloudflare D1 · eai-html-galerij",
      checkedAt: new Date().toISOString(),
      gallery: {
        total: count(gallery?.total), published: count(gallery?.published),
        hidden: count(gallery?.hidden), newest: gallery?.newest || null
      },
      security: { activeSessions: count(active?.total), loginAttempts15min: count(attempts?.count) },
      latestActions: audit?.results || [],
      boundaries: {
        site: "Theory7 (aparte publicatieroute)",
        gallery: "Cloudflare Worker en D1",
        accounts: "Eén beheerder; LEIF behoudt eigen autorisatie"
      }
    });
  } catch {
    return fail("Databasegegevens niet beschikbaar. Controleer de D1-migratie.");
  }
}
async function traffic(url) {
  const days = Number(url.searchParams.get("days") || 30);
  if (![7, 30, 90].includes(days)) return fail("Kies 7, 30 of 90 dagen.", 400);
  try {
    const response = await requestJson(INSIGHTS + "?days=" + days, 5000);
    if (!Array.isArray(response?.rows)) throw new Error("Missing rows");
    const summary = { page: 0, tool: 0, read: 0 };
    const daily = new Map();
    const pages = new Map();
    const tools = new Map();
    const devices = { desktop: 0, mobiel: 0 };
    let lastEventDay = null;
    for (const row of response.rows.slice(0, 4000)) {
      const day = typeof row.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.day) ? row.day : null;
      const path = typeof row.path === "string" && /^\/[a-zA-Z0-9/_.-]{0,119}$/.test(row.path) ? row.path : null;
      if (!day || !path || !["pagina", "tool", "gelezen"].includes(row.event)) continue;
      const n = count(row.count);
      if (row.event === "pagina") {
        summary.page += n;
        daily.set(day, (daily.get(day) || 0) + n);
        pages.set(path, (pages.get(path) || 0) + n);
        if (row.device === "desktop" || row.device === "mobiel") devices[row.device] += n;
      } else if (row.event === "tool") {
        summary.tool += n;
        tools.set(path, (tools.get(path) || 0) + n);
      } else summary.read += n;
      if (!lastEventDay || day > lastEventDay) lastEventDay = day;
    }
    const top = map => [...map.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([path, total]) => ({ path, count: total }));
    return json({
      source: "EAI Site Insights · Supabase (geaggregeerd)",
      periodDays: days, checkedAt: new Date().toISOString(),
      lastEventDay, events: summary,
      devices, topPages: top(pages), topTools: top(tools),
      daily: [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([day, total]) => ({ day, count: total })),
      note: "Dit zijn geregistreerde gebeurtenissen, geen unieke personen of bezoeken. Bouncepercentage niet meetbaar."
    });
  } catch {
    return fail("Bezoekersgegevens konden niet worden opgehaald. Geen schatting getoond.");
  }
}
async function health() {
  const checkedAt = new Date().toISOString();
  const pages = await Promise.all(CHECKS.map(async ({ id, name, path }) => {
    const started = Date.now();
    try {
      const response = await fetch(SITE + path, {
        method: "HEAD", redirect: "manual", cache: "no-store",
        signal: AbortSignal.timeout(4000)
      });
      return {
        id, name, path, status: response.status,
        state: response.status >= 200 && response.status < 400 ? "bereikbaar" : "afwijking",
        durationMs: Date.now() - started
      };
    } catch {
      return { id, name, path, status: null, state: "onbekend", durationMs: null };
    }
  }));
  return json({
    source: "HTTP HEAD vanaf de Cloudflare Worker",
    checkedAt, pages,
    note: "Een HTTP-antwoord bewijst bereikbaarheid, niet of simulaties, knoppen of berekeningen werken."
  });
}
async function deployment() {
  // Public GitHub metadata only. No token and no write capability.
  const headers = { "User-Agent": "EAI-beheer/1.0", "X-GitHub-Api-Version": "2022-11-28" };
  const [commit, workflow] = await Promise.allSettled([
    requestJson(GITHUB + "/commits/main", 4500, headers),
    requestJson(GITHUB + "/actions/workflows/deploy-theory7.yml/runs?branch=main&per_page=1", 4500, headers)
  ]);
  if (commit.status !== "fulfilled" && workflow.status !== "fulfilled") {
    return fail("GitHub-publicatiestatus is tijdelijk niet bereikbaar.");
  }
  const c = commit.status === "fulfilled" ? commit.value : null;
  const rawRun = workflow.status === "fulfilled" ? workflow.value?.workflow_runs?.[0] : null;
  const run = rawRun && Number.isSafeInteger(rawRun.id) ? {
    id: rawRun.id,
    status: ["queued", "in_progress", "completed", "waiting", "pending"].includes(rawRun.status) ? rawRun.status : "unknown",
    conclusion: typeof rawRun.conclusion === "string" ? rawRun.conclusion : null,
    createdAt: rawRun.created_at || null,
    updatedAt: rawRun.updated_at || null,
    commit: typeof rawRun.head_sha === "string" ? rawRun.head_sha.slice(0, 12) : null,
    url: "https://github.com/E-AI-MODEL/website/actions/runs/" + rawRun.id
  } : null;
  return json({
    source: "GitHub · openbare repository E-AI-MODEL/website",
    checkedAt: new Date().toISOString(),
    main: c && typeof c.sha === "string" ? {
      commit: c.sha.slice(0, 12),
      message: String(c.commit?.message || "").split("\n")[0].slice(0, 180),
      url: "https://github.com/E-AI-MODEL/website/commit/" + c.sha.slice(0, 40)
    } : null,
    deploy: run,
    note: "Een commit op main of geslaagde CI is niet op zichzelf bewijs dat alle productiepagina's bijgewerkt zijn."
  });
}
async function files(env, url) {
  const status = url.searchParams.get("status") || "all";
  if (!["all", "published", "hidden"].includes(status)) return fail("Onbekende status.", 400);
  try {
    const query = status === "all"
      ? "SELECT id,title,author,filename,status,created_at FROM uploads ORDER BY created_at DESC LIMIT 250"
      : "SELECT id,title,author,filename,status,created_at FROM uploads WHERE status=? ORDER BY created_at DESC LIMIT 250";
    const statement = env.DB.prepare(query);
    const result = status === "all" ? await statement.all() : await statement.bind(status).all();
    return json({ items: result.results || [], limit: 250, source: "D1 · uploads" });
  } catch { return fail("Bestandenlijst kon niet worden opgehaald."); }
}
async function auditLog(env) {
  try {
    const result = await env.DB.prepare(
      "SELECT id,actor,action,target,created_at FROM site_admin_audit ORDER BY id DESC LIMIT 50"
    ).all();
    return json({ items: result.results || [], source: "D1 · beheerlogboek", limit: 50 });
  } catch { return fail("Logboek niet beschikbaar. Controleer de D1-migratie."); }
}
async function restore(request, env, actor, id) {
  if (!sameOrigin(request)) return fail("Herkomst niet toegestaan.", 403);
  if (!safeId(id)) return fail("Ongeldig bestandsnummer.", 400);
  try {
    const result = await env.DB.prepare(
      "UPDATE uploads SET status='published' WHERE id=? AND status='hidden'"
    ).bind(id).run();
    if (count(result.meta?.changes) !== 1) return fail("Verborgen bestand niet gevonden.", 404);
    let auditSaved = true;
    try { await recordAdminAction(env, actor, "upload.restored", id); }
    catch { auditSaved = false; }
    return json({ ok: true, auditSaved });
  } catch {
    return fail("Terugzetten niet mogelijk. Controleer de tijdelijke D1-blokkade.");
  }
}
async function revokeSessions(request, env, actor) {
  if (!sameOrigin(request)) return fail("Herkomst niet toegestaan.", 403);
  try {
    await env.DB.prepare("DELETE FROM gallery_sessions").run();
    let auditSaved = true;
    try { await recordAdminAction(env, actor, "sessions.revoked", "all"); }
    catch { auditSaved = false; }
    return json({ ok: true, auditSaved, signedOut: true });
  } catch { return fail("Sessies konden niet worden ingetrokken."); }
}
export async function handleAdmin(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/api/admin/")) return null;
  if (request.method === "GET") {
    if (path === "/api/admin/overview") return overview(env);
    if (path === "/api/admin/traffic") return traffic(url);
    if (path === "/api/admin/health") return health();
    if (path === "/api/admin/deploy") return deployment();
    if (path === "/api/admin/files") return files(env, url);
    if (path === "/api/admin/audit") return auditLog(env);
  }
  const match = path.match(/^\/api\/admin\/files\/([^/]+)\/restore$/);
  if (request.method === "POST" && match) return restore(request, env, user, match[1]);
  if (request.method === "POST" && path === "/api/admin/sessions/revoke") return revokeSessions(request, env, user);
  return fail("Onbekende beheerfunctie.", 404);
}
