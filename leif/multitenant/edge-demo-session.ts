const allowedOrigins = new Set(["https://eaimodel.nl", "https://www.eaimodel.nl"]);
const questionIds = new Set(["zichtbaar","observeren","onzichtbaar","sterk","schuur","raak","reactie","emotie","behoefte","keuzes","denkenhelpt","denkenweg","waarde","zorggeven","zorgontvangen","zorgvragen","zorggrens","vertrouwen","afstand","verlies","contactreactie","vragen","geschiedenis","geleerd","oudepatronen","licht","jezelf","eigenweg","behouden","veranderen","uitspreken","stap"]);
const projectUrl = Deno.env.get("SUPABASE_URL");
function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const values = Object.values(keys);
    return values.find(v => typeof v === "string" && v.startsWith("sb_secret_")) || "";
  } catch { return ""; }
}
function response(body, status, origin) {
  const headers = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin",
    "Access-Control-Allow-Origin":allowedOrigins.has(origin) ? origin : "https://eaimodel.nl",
    "Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"content-type"};
  return new Response(JSON.stringify(body),{status,headers});
}
async function digestHex(secret) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function postgrest(path, method, payload, key) {
  const headers = {"apikey":key,"Content-Type":"application/json", "Accept":"application/json"};
  if (!key.startsWith("sb_secret_")) headers["Authorization"] = "Bearer " + key;
  if (method !== "GET") headers["Prefer"] = "return=representation";
  const r = await fetch(projectUrl + "/rest/v1/" + path,{method,headers,body:payload ? JSON.stringify(payload) : undefined});
  if (!r.ok) { throw new Error("Database unavailable (" + r.status + ")"); }
  return await r.json();
}
Deno.serve(async req => {
  const origin = req.headers.get("Origin") || "";
  if (req.method === "OPTIONS") {
    if (!allowedOrigins.has(origin)) return response({error:"origin_not_allowed"},403,origin);
    return response({ok:true},200,origin);
  }
  if (req.method !== "POST") return response({error:"method_not_allowed"},405,origin);
  if (origin && !allowedOrigins.has(origin)) return response({error:"origin_not_allowed"},403,origin);
  if (Number(req.headers.get("content-length") || "0") > 75000) return response({error:"request_too_large"},413,origin);
  let input;
  try { input = await req.json(); } catch { return response({error:"invalid_json"},400,origin); }
  const token = input?.token;
  const action = input?.action;
  if (typeof token !== "string" || token.length < 38 || token.length > 160 || !["load","save","submit"].includes(action))
    return response({error:"invalid_request"},400,origin);
  const key = serviceKey();
  if (!key || !projectUrl) return response({error:"service_unavailable"},503,origin);
  try {
    const hash = await digestHex(token);
    const list = await postgrest("leif_demo_sessions?continuation_hash=eq." + hash + "&select=id,answers,answer_sources,status,source_note,updated_at,submitted_at,personal_texts", "GET", null, key);
    if (!Array.isArray(list) || list.length !== 1) return response({error:"not_found"},404,origin);
    const row = list[0];
    if (action === "load") return response({ok:true,status:row.status,answers:row.answers,answer_sources:row.answer_sources,source_note:row.source_note,updated_at:row.updated_at,personal_texts:{blocks:Array.isArray(row.personal_texts?.blocks_published)?row.personal_texts.blocks_published:[]}},200,origin);
    if (action === "save") {
      const patch = input.patch;
      if (!patch || typeof patch !== "object" || Array.isArray(patch) || Object.keys(patch).length > 32)
        return response({error:"invalid_patch"},400,origin);
      const merged = {...row.answers};
      for (const [id,val] of Object.entries(patch)) {
        if (!questionIds.has(id)) return response({error:"invalid_question"},400,origin);
        if (val === null) delete merged[id];
        else if (typeof val === "string" && val.length <= 20000) merged[id] = val;
        else return response({error:"invalid_answer"},400,origin);
      }
      if (JSON.stringify(merged).length > 70000) return response({error:"too_much_text"},413,origin);
      const result = await postgrest("leif_demo_sessions?id=eq." + row.id,"PATCH",{answers:merged,updated_at:new Date().toISOString()},key);
      return response({ok:true,status:row.status,updated_at:result[0]?.updated_at || null},200,origin);
    }
    const result = await postgrest("leif_demo_sessions?id=eq." + row.id,"PATCH",{status:"submitted",submitted_at:new Date().toISOString(),updated_at:new Date().toISOString()},key);
    return response({ok:true,status:result[0]?.status || "submitted"},200,origin);
  } catch {
    return response({error:"service_unavailable"},503,origin);
  }
});