// LEIF administration API, accessed only with a verified Supabase Auth session.
// Deploy as "leif-admin". Only manager/editor memberships grant tenant access.
const base = Deno.env.get("SUPABASE_URL") || "";
const allowedOrigins = new Set(["https://eaimodel.nl", "https://www.eaimodel.nl"]);
function serviceKey() {
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(legacy)return legacy;
  try{return Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")).find(x=>typeof x==="string"&&x.startsWith("sb_secret_"))||""}catch{return ""}
}
function reply(body,status,origin) {
  return new Response(JSON.stringify(body), {status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
    "Vary":"Origin","Access-Control-Allow-Origin":allowedOrigins.has(origin)?origin:"https://eaimodel.nl",
    "Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"authorization,content-type,apikey"}});
}
function record(x){return x!==null&&typeof x==="object"&&!Array.isArray(x)}
async function hash(value){
  const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
  return [...bytes].map(v=>v.toString(16).padStart(2,"0")).join("");
}
function code(){
  return [...crypto.getRandomValues(new Uint8Array(24))].map(v=>v.toString(16).padStart(2,"0")).join("");
}
async function db(path,method,payload,service) {
  const h={"apikey":service,"Content-Type":"application/json","Accept":"application/json"};
  if(!service.startsWith("sb_secret_"))h["Authorization"]="Bearer "+service;
  if(method!=="GET")h["Prefer"]="return=representation";
  const response=await fetch(base+"/rest/v1/"+path,{method,headers:h,body:payload===null?undefined:JSON.stringify(payload),cache:"no-store"});
  if(!response.ok)throw Error("database_"+response.status);
  return response.json();
}
async function loggedInUser(req){
  const match=/^Bearer ([A-Za-z0-9._-]{40,5000})$/.exec(req.headers.get("authorization")||"");
  if(!match)return null;
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
  if(!anon)return null;
  const result=await fetch(base+"/auth/v1/user",{headers:{"apikey":anon,"Authorization":"Bearer "+match[1]},cache:"no-store"});
  if(!result.ok)return null;
  const user=await result.json().catch(()=>null);
  return typeof user?.id==="string"&&/^[a-f0-9-]{36}$/i.test(user.id)?user.id:null;
}
function safeName(s){return typeof s==="string"&&s.trim().length>0&&s.trim().length<=120}
function validSections(v){
  if(!record(v)||Object.keys(v).length!==3||Object.keys(v).some(k=>!["part1","part2","part3"].includes(k)))return false;
  return Object.values(v).every(s=>typeof s==="string"&&s.length<=45000);
}
async function tenantAccess(slug,userId,service) {
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug))return null;
  const tenant=await db("leif_tenants?slug=eq."+encodeURIComponent(slug)+"&select=id,slug,name","GET",null,service);
  if(!Array.isArray(tenant)||tenant.length!==1)return null;
  const access=await db("leif_admin_memberships?tenant_id=eq."+tenant[0].id+"&user_id=eq."+userId+"&select=role","GET",null,service);
  if(!Array.isArray(access)||access.length!==1)return null;
  return {...tenant[0],role:access[0].role};
}
async function oneMember(id,tenantId,service) {
  if(typeof id!=="string"||!/^[a-f0-9-]{36}$/i.test(id))return null;
  const rows=await db("leif_participants?id=eq."+encodeURIComponent(id)+"&tenant_id=eq."+tenantId+
    "&select=id,display_name,state,created_at,expires_at","GET",null,service);
  return Array.isArray(rows)&&rows.length===1?rows[0]:null;
}
Deno.serve(async req=>{
  const origin=req.headers.get("Origin")||"";
  if(req.method==="OPTIONS")return allowedOrigins.has(origin)?reply({ok:true},200,origin):reply({error:"origin_not_allowed"},403,origin);
  if(req.method!=="POST")return reply({error:"method_not_allowed"},405,origin);
  if(origin&&!allowedOrigins.has(origin))return reply({error:"origin_not_allowed"},403,origin);
  if(!req.headers.get("content-type")?.startsWith("application/json"))return reply({error:"invalid_content_type"},415,origin);
  if(Number(req.headers.get("content-length")||"0")>160000)return reply({error:"too_large"},413,origin);
  let body;
  try{body=await req.json()}catch{return reply({error:"invalid_json"},400,origin)}
  if(!record(body)||JSON.stringify(body).length>160000)return reply({error:"invalid_request"},400,origin);
  const service=serviceKey();
  if(!service||!base)return reply({error:"unavailable"},503,origin);
  let userId;
  try{userId=await loggedInUser(req)}catch{return reply({error:"auth_unavailable"},503,origin)}
  if(!userId)return reply({error:"unauthorized"},401,origin);
  try{
    if(body.action==="my_tenants"){
      const memberships=await db("leif_admin_memberships?user_id=eq."+userId+"&select=tenant_id,role","GET",null,service);
      if(!Array.isArray(memberships)||!memberships.length)return reply({ok:true,tenants:[]},200,origin);
      const ids=memberships.map(x=>x.tenant_id);
      const tenants=await db("leif_tenants?id=in.("+ids.join(",")+")&select=id,slug,name","GET",null,service);
      return reply({ok:true,tenants:tenants.map(t=>({...t,role:memberships.find(m=>m.tenant_id===t.id)?.role||"editor"}))},200,origin);
    }
    if(typeof body.tenant_slug!=="string")return reply({error:"invalid_tenant"},400,origin);
    const tenant=await tenantAccess(body.tenant_slug,userId,service);
    if(!tenant)return reply({error:"forbidden"},403,origin);
    if(body.action==="list_participants"){
      const people=await db("leif_participants?tenant_id=eq."+tenant.id+
        "&select=id,display_name,state,created_at,expires_at&order=created_at.desc&limit=500","GET",null,service);
      return reply({ok:true,tenant:{slug:tenant.slug,name:tenant.name,role:tenant.role},participants:people},200,origin);
    }
    if(body.action==="create_participant"){
      if(tenant.role!=="manager")return reply({error:"forbidden"},403,origin);
      if(!safeName(body.display_name))return reply({error:"invalid_name"},400,origin);
      const accessCode=code();
      const created=await db("leif_participants","POST",{tenant_id:tenant.id,display_name:body.display_name.trim(),access_hash:await hash(accessCode)},service);
      return reply({ok:true,participant_id:created[0].id,access_code:accessCode},201,origin);
    }
    if(!["get_participant","rename_participant","rotate_code","revoke_code","reactivate","save_story","publish_story"].includes(body.action))
      return reply({error:"unknown_action"},400,origin);
    const member=await oneMember(body.participant_id,tenant.id,service);
    if(!member)return reply({error:"not_found"},404,origin);
    const docPath="leif_documents?participant_id=eq."+encodeURIComponent(member.id)+"&select=participant_id,revision,updated_at,personal_texts,answers,report,exercises";
    if(body.action==="get_participant"){
      const docs=await db(docPath,"GET",null,service);
      if(!Array.isArray(docs)||docs.length!==1)return reply({error:"document_unavailable"},503,origin);
      return reply({ok:true,participant:member,document:docs[0]},200,origin);
    }
    if(tenant.role!=="manager" && ["rename_participant","rotate_code","revoke_code","reactivate"].includes(body.action))
      return reply({error:"forbidden"},403,origin);
    if(body.action==="rename_participant"){
      if(!safeName(body.display_name))return reply({error:"invalid_name"},400,origin);
      const rows=await db("leif_participants?id=eq."+member.id+"&tenant_id=eq."+tenant.id,"PATCH",{display_name:body.display_name.trim()},service);
      return reply({ok:rows.length===1},rows.length===1?200:409,origin);
    }
    if(body.action==="revoke_code"||body.action==="reactivate"||body.action==="rotate_code"){
      const patch=body.action==="revoke_code"?{state:"revoked"}:{state:"active"};
      let issuedCode=null;
      if(body.action==="rotate_code"){issuedCode=code();patch.access_hash=await hash(issuedCode)}
      const changed=await db("leif_participants?id=eq."+member.id+"&tenant_id=eq."+tenant.id,"PATCH",patch,service);
      if(changed.length!==1)return reply({error:"conflict"},409,origin);
      return reply({ok:true,participant_id:member.id,state:changed[0].state,...issuedCode?{access_code:issuedCode}:{}},200,origin);
    }
    if(!Number.isInteger(body.expected_revision)||body.expected_revision<0)return reply({error:"invalid_revision"},400,origin);
    const docs=await db(docPath,"GET",null,service);
    if(!Array.isArray(docs)||docs.length!==1)return reply({error:"document_unavailable"},503,origin);
    const current=docs[0];
    if(current.revision!==body.expected_revision)return reply({error:"revision_conflict",revision:current.revision},409,origin);
    const existing=record(current.personal_texts)?current.personal_texts:{};
    let next;
    if(body.action==="save_story"){
      if(!validSections(body.sections))return reply({error:"invalid_text"},400,origin);
      next={...existing,draft:{...body.sections},updated_at:new Date().toISOString()};
    }else {
      if(!validSections(existing.draft))return reply({error:"empty_draft"},400,origin);
      next={...existing,published:{...existing.draft},published_at:new Date().toISOString()};
    }
    const changed=await db("leif_documents?participant_id=eq."+member.id+
      "&revision=eq."+body.expected_revision,"PATCH",{personal_texts:next,revision:body.expected_revision+1,updated_at:new Date().toISOString()},service);
    if(!Array.isArray(changed)||changed.length!==1)return reply({error:"revision_conflict"},409,origin);
    return reply({ok:true,revision:changed[0].revision,personal_texts:next,updated_at:changed[0].updated_at},200,origin);
  }catch(e){
    console.error("LEIF admin request failed",e instanceof Error?e.message:"unknown");
    return reply({error:"service_unavailable"},503,origin);
  }
});
