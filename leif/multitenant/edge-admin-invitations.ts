// LEIF beheer-API. Supabase Auth authenticates; database memberships authorize.
// Deploy as Supabase Edge Function "leif-admin-console".
const projectUrl=Deno.env.get("SUPABASE_URL")||"";
const allowedOrigins=new Set(["https://eaimodel.nl","https://www.eaimodel.nl"]);
function serviceKey(){
 const old=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(old)return old;
 try{return Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")).find(x=>typeof x==="string"&&x.startsWith("sb_secret_"))||""}catch{return ""}
}
function reply(body,status,origin){
 return new Response(JSON.stringify(body),{status,headers:{
 "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin",
 "Access-Control-Allow-Origin":allowedOrigins.has(origin)?origin:"https://eaimodel.nl",
 "Access-Control-Allow-Headers":"authorization,content-type,apikey",
 "Access-Control-Allow-Methods":"POST,OPTIONS"}});
}
function isRecord(x){return x!==null&&typeof x==="object"&&!Array.isArray(x)}
async function db(path,method,payload,service){
 const h={"apikey":service,"Content-Type":"application/json","Accept":"application/json"};
 if(!service.startsWith("sb_secret_"))h.Authorization="Bearer "+service;
 if(method!=="GET")h.Prefer="return=representation";
 const r=await fetch(projectUrl+"/rest/v1/"+path,{method,headers:h,cache:"no-store",body:payload===null?undefined:JSON.stringify(payload)});
 if(!r.ok)throw Error("database_"+r.status);return r.json();
}
async function hash(v){
 const b=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));
 return Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
}
function newCode(){return Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,"0")).join("")}
async function authUser(token){
 if(typeof token!=="string"||token.length<40||token.length>5000)return null;
 const pub=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
 if(!pub)return null;
 const r=await fetch(projectUrl+"/auth/v1/user",{method:"GET",headers:{"apikey":pub,"Authorization":"Bearer "+token},cache:"no-store"});
 if(!r.ok)return null;
 const u=await r.json().catch(()=>null);
 return typeof u?.id==="string"&&/^[a-f0-9-]{36}$/i.test(u.id)?u:null;
}
async function tenantsForUser(userId,service){
 const memberships=await db("leif_admin_memberships?user_id=eq."+userId+"&select=tenant_id,role","GET",null,service);
 if(!Array.isArray(memberships)||!memberships.length)return [];
 const t=await db("leif_tenants?id=in.("+memberships.map(m=>m.tenant_id).join(",")+")&select=id,slug,name","GET",null,service);
 return t.map(x=>({...x,role:memberships.find(m=>m.tenant_id===x.id)?.role||"editor"}));
}
async function authTokens(grant,credentials,service){
 const pub=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
 if(!pub)return null;
 const path=grant==="password"?"/auth/v1/token?grant_type=password":"/auth/v1/token?grant_type=refresh_token";
 const r=await fetch(projectUrl+path,{method:"POST",headers:{"apikey":pub,"Content-Type":"application/json"},body:JSON.stringify(credentials),cache:"no-store"});
 if(!r.ok)return null;
 const data=await r.json();
 const user=await authUser(data.access_token);
 if(!user)return null;
 const tenants=await tenantsForUser(user.id,service);
 if(!tenants.length)return {forbidden:true};
 return {access_token:data.access_token,refresh_token:data.refresh_token,expires_in:data.expires_in,tenants,user_email:user.email||""};
}
function validDraft(v){
 const names=["inleiding","blik_van_een_ander","verder_kijken","slotwoord"];
 return isRecord(v)&&Object.keys(v).length===names.length&&names.every(k=>typeof v[k]==="string"&&v[k].length<=35000);
}
async function accessFor(userId,tenantId,service){
 if(typeof tenantId!=="string"||!/^[a-f0-9-]{36}$/i.test(tenantId))return null;
 const rows=await db("leif_admin_memberships?user_id=eq."+userId+"&tenant_id=eq."+tenantId+"&select=role","GET",null,service);
 return Array.isArray(rows)&&rows.length===1?rows[0].role:null;
}
async function participantFor(tenantId,personId,service){
 if(typeof personId!=="string"||!/^[a-f0-9-]{36}$/i.test(personId))return null;
 const rows=await db("leif_participants?id=eq."+personId+"&tenant_id=eq."+tenantId+
 "&select=id,tenant_id,display_name,state,created_at","GET",null,service);
 return Array.isArray(rows)&&rows.length===1?rows[0]:null;
}
Deno.serve(async req=>{
 const origin=req.headers.get("Origin")||"";
 if(req.method==="OPTIONS")return allowedOrigins.has(origin)?reply({ok:true},200,origin):reply({error:"origin_not_allowed"},403,origin);
 if(req.method!=="POST")return reply({error:"method_not_allowed"},405,origin);
 if(origin&&!allowedOrigins.has(origin))return reply({error:"origin_not_allowed"},403,origin);
 if(!req.headers.get("content-type")?.startsWith("application/json"))return reply({error:"invalid_content_type"},415,origin);
 if(Number(req.headers.get("content-length")||"0")>165000)return reply({error:"too_large"},413,origin);
 let body;try{body=await req.json()}catch{return reply({error:"invalid_json"},400,origin)}
 if(!isRecord(body)||JSON.stringify(body).length>165000)return reply({error:"invalid_request"},400,origin);
 const service=serviceKey();if(!service||!projectUrl)return reply({error:"unavailable"},503,origin);
 try{
  if(body.action==="login"||body.action==="refresh"){
   let result;
   if(body.action==="login"){
    if(typeof body.email!=="string"||body.email.length>254||typeof body.password!=="string"||body.password.length>1024)return reply({error:"invalid_login"},400,origin);
    result=await authTokens("password",{email:body.email,password:body.password},service);
   }else{
    if(typeof body.refresh_token!=="string"||body.refresh_token.length>5000)return reply({error:"invalid_refresh"},400,origin);
    result=await authTokens("refresh",{refresh_token:body.refresh_token},service);
   }
   if(!result)return reply({error:"unauthorized"},401,origin);
   if(result.forbidden)return reply({error:"forbidden"},403,origin);
   return reply(result,200,origin);
  }
  const token=(req.headers.get("authorization")||"").match(/^Bearer ([A-Za-z0-9._-]{40,5000})$/)?.[1];
  const user=await authUser(token);
  if(!user)return reply({error:"unauthorized"},401,origin);
  const role=await accessFor(user.id,body.tenant_id,service);
  if(!role)return reply({error:"forbidden"},403,origin);
  const tenantId=body.tenant_id;
  if(body.action==="list"){
    const people=await db("leif_participants?tenant_id=eq."+tenantId+"&select=id,display_name,state,created_at,expires_at&order=created_at.desc&limit=500","GET",null,service);
    return reply({ok:true,participants:people},200,origin);
  }
  if(body.action==="invite"){
    if(role!=="manager")return reply({error:"forbidden"},403,origin);
    if(typeof body.name!=="string"||body.name.trim().length<1||body.name.length>120)return reply({error:"invalid_name"},400,origin);
    const code=newCode();
    const created=await db("leif_participants","POST",{tenant_id:tenantId,display_name:body.name.trim(),access_hash:await hash(code)},service);
    if(!Array.isArray(created)||created.length!==1)return reply({error:"creation_failed"},503,origin);
    return reply({ok:true,participant:created[0].id,code},201,origin);
  }
  if(!["get","rename","rotate","revoke","save_draft","publish_story","unpublish_story"].includes(body.action))
    return reply({error:"unknown_action"},400,origin);
  const person=await participantFor(tenantId,body.participant_id,service);
  if(!person)return reply({error:"not_found"},404,origin);
  if(body.action==="get"){
    const rows=await db("leif_documents?participant_id=eq."+person.id+"&select=participant_id,revision,updated_at,answers,exercises,report,personal_texts,position","GET",null,service);
    if(!Array.isArray(rows)||rows.length!==1)return reply({error:"document_missing"},503,origin);
    return reply({ok:true,participant:person,document:rows[0]},200,origin);
  }
  if(["rename","rotate","revoke"].includes(body.action)&&role!=="manager")return reply({error:"forbidden"},403,origin);
  if(body.action==="rename"){
    if(typeof body.name!=="string"||body.name.trim().length<1||body.name.length>120)return reply({error:"invalid_name"},400,origin);
    const p=await db("leif_participants?id=eq."+person.id+"&tenant_id=eq."+tenantId,"PATCH",{display_name:body.name.trim()},service);
    return reply({ok:p.length===1},p.length===1?200:409,origin);
  }
  if(body.action==="revoke"){
    const p=await db("leif_participants?id=eq."+person.id+"&tenant_id=eq."+tenantId,"PATCH",{state:"revoked"},service);
    return reply({ok:p.length===1},p.length===1?200:409,origin);
  }
  if(body.action==="rotate"){
    const code=newCode();
    const p=await db("leif_participants?id=eq."+person.id+"&tenant_id=eq."+tenantId,"PATCH",{access_hash:await hash(code),state:"active"},service);
    return reply({ok:p.length===1,code:p.length===1?code:undefined},p.length===1?200:409,origin);
  }
  if(!Number.isSafeInteger(body.revision)||body.revision<0)return reply({error:"invalid_revision"},400,origin);
  const existing=await db("leif_documents?participant_id=eq."+person.id+
   "&select=participant_id,revision,updated_at,personal_texts","GET",null,service);
  if(!Array.isArray(existing)||existing.length!==1)return reply({error:"document_missing"},503,origin);
  const before=existing[0];
  if(before.revision!==body.revision)return reply({error:"revision_conflict",revision:before.revision},409,origin);
  const previous=isRecord(before.personal_texts)?before.personal_texts:{};
  let next;
  if(body.action==="save_draft"){
    if(!validDraft(body.draft))return reply({error:"invalid_story"},400,origin);
    next={...previous,draft:{...body.draft},draft_updated_at:new Date().toISOString()};
  }else if(body.action==="publish_story"){
    if(!validDraft(previous.draft))return reply({error:"empty_draft"},400,origin);
    next={...previous,published:{...previous.draft},published_at:new Date().toISOString()};
  }else{
    next={...previous,published:{},published_at:null};
  }
  const patched=await db("leif_documents?participant_id=eq."+person.id+
    "&revision=eq."+body.revision,"PATCH",{personal_texts:next,revision:body.revision+1,updated_at:new Date().toISOString()},service);
  if(!Array.isArray(patched)||patched.length!==1)return reply({error:"revision_conflict"},409,origin);
  return reply({ok:true,revision:patched[0].revision,personal_texts:next},200,origin);
 }catch(e){
  console.error("LEIF admin operation failed",e instanceof Error?e.message:"unknown");
  return reply({error:"service_unavailable"},503,origin);
 }
});
