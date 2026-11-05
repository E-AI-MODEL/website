// LEIF beheer-API, voor beheerders met Supabase Auth en een tenant-lidmaatschap.
// Deze functie gebruikt de service key alleen op de server; geen directe browserrechten op tabellen.
const originAllow = new Set(["https://eaimodel.nl","https://www.eaimodel.nl"]);
const project = Deno.env.get("SUPABASE_URL") || "";
const validId = x=>typeof x==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const validName = x=>typeof x==="string" && x.trim().length>=1 && x.trim().length<=120;
const isObject = x=>x!==null&&typeof x==="object"&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const allowedStory = new Set(["intro","deel_1","deel_2","deel_3","afsluiting"]);
function serviceKey(){
 const old=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(old)return old;
 try{return Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")).find(x=>typeof x==="string"&&x.startsWith("sb_secret_"))||""}catch{return ""}
}
function out(data,status,origin){
 return new Response(JSON.stringify(data),{status,headers:{
  "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin",
  "Access-Control-Allow-Origin":originAllow.has(origin)?origin:"https://eaimodel.nl",
  "Access-Control-Allow-Headers":"content-type,authorization,apikey","Access-Control-Allow-Methods":"POST,OPTIONS"
 }});
}
async function digest(code){
 const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(code));
 return Array.from(new Uint8Array(buf),x=>x.toString(16).padStart(2,"0")).join("");
}
function newCode(){
 return Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,"0")).join("");
}
async function db(path,method,data,secret){
 const headers={"apikey":secret,"Content-Type":"application/json","Accept":"application/json"};
 if(!secret.startsWith("sb_secret_"))headers.Authorization="Bearer "+secret;
 if(method!=="GET")headers.Prefer="return=representation";
 const res=await fetch(project+"/rest/v1/"+path,{method,headers,cache:"no-store",body:data?JSON.stringify(data):undefined});
 if(!res.ok){throw Error("database_"+res.status)}
 return await res.json();
}
async function userFromToken(jwt,secret){
 const anon=Deno.env.get("SUPABASE_ANON_KEY") || secret;
 const response=await fetch(project+"/auth/v1/user",{method:"GET",cache:"no-store",
  headers:{"apikey":anon,Authorization:"Bearer "+jwt}});
 if(!response.ok)return null;
 const user=await response.json().catch(()=>null);
 return validId(user?.id)?user:null;
}
async function memberships(uid,secret){
 const rows=await db("leif_admin_memberships?user_id=eq."+encodeURIComponent(uid)+"&select=tenant_id,role","GET",null,secret);
 return Array.isArray(rows)?rows:[];
}
async function scopedParticipant(id,tenant,secret){
 const rows=await db("leif_participants?id=eq."+encodeURIComponent(id)+"&tenant_id=eq."+encodeURIComponent(tenant)+"&select=id,display_name,state,created_at","GET",null,secret);
 return Array.isArray(rows)&&rows.length===1?rows[0]:null;
}
function storyOK(o){
 if(!isObject(o)||Object.keys(o).length>5)return false;
 return Object.entries(o).every(([k,v])=>allowedStory.has(k)&&typeof v==="string"&&v.length<=50000)
    &&JSON.stringify(o).length<=160000;
}
Deno.serve(async req=>{
 const origin=req.headers.get("Origin")||"";
 if(req.method==="OPTIONS")return originAllow.has(origin)?out({ok:true},200,origin):out({error:"origin_not_allowed"},403,origin);
 if(req.method!=="POST")return out({error:"method_not_allowed"},405,origin);
 if(origin&&!originAllow.has(origin))return out({error:"origin_not_allowed"},403,origin);
 if(!req.headers.get("content-type")?.startsWith("application/json"))return out({error:"invalid_type"},415,origin);
 const auth=req.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer ")||auth.length>5000)return out({error:"unauthorized"},401,origin);
 const secret=serviceKey();
 if(!secret||!project)return out({error:"service_unavailable"},503,origin);
 const uid=await userFromToken(auth.slice(7),secret);
 if(!uid)return out({error:"unauthorized"},401,origin);
 if(Number(req.headers.get("content-length")||"0")>180000)return out({error:"too_large"},413,origin);
 let body;try{body=await req.json()}catch{return out({error:"invalid_json"},400,origin)}
 if(!isObject(body)||JSON.stringify(body).length>180000)return out({error:"invalid_request"},400,origin);
 const action=body.action;
 try{
  const teams=await memberships(uid.id,secret);
  if(action==="tenants"){
   const list=[];
   for(const m of teams){
    const rows=await db("leif_tenants?id=eq."+encodeURIComponent(m.tenant_id)+"&select=id,name,slug","GET",null,secret);
    if(rows?.length===1)list.push({...rows[0],role:m.role});
   }
   return out({ok:true,tenants:list},200,origin);
  }
  const tenant=body.tenant_id;
  if(!validId(tenant))return out({error:"invalid_tenant"},400,origin);
  const member=teams.find(m=>m.tenant_id===tenant);
  if(!member)return out({error:"not_found"},404,origin);
  const manager=member.role==="manager";
  const editor=manager||member.role==="editor";
  if(!editor)return out({error:"forbidden"},403,origin);

  if(action==="list"){
   const items=await db("leif_participants?tenant_id=eq."+encodeURIComponent(tenant)+"&select=id,display_name,state,created_at,expires_at&order=created_at.desc&limit=200","GET",null,secret);
   return out({ok:true,participants:items},200,origin);
  }
  if(action==="create"){
   if(!manager)return out({error:"forbidden"},403,origin);
   if(!validName(body.display_name))return out({error:"invalid_name"},400,origin);
   const code=newCode();
   const rows=await db("leif_participants","POST",{tenant_id:tenant,display_name:body.display_name.trim(),access_hash:await digest(code)},secret);
   return out({ok:true,participant:rows[0]?.id,access_code:code},201,origin);
  }
  if(action==="rename"||action==="rotate"||action==="revoke"){
   if(!manager)return out({error:"forbidden"},403,origin);
   if(!validId(body.participant_id))return out({error:"invalid_participant"},400,origin);
   const record=await scopedParticipant(body.participant_id,tenant,secret);
   if(!record)return out({error:"not_found"},404,origin);
   if(action==="rename"){
    if(!validName(body.display_name))return out({error:"invalid_name"},400,origin);
    await db("leif_participants?id=eq."+record.id,"PATCH",{display_name:body.display_name.trim()},secret);
    return out({ok:true},200,origin);
   }
   if(action==="revoke"){
    await db("leif_participants?id=eq."+record.id,"PATCH",{state:"revoked"},secret);
    return out({ok:true},200,origin);
   }
   const code=newCode();
   await db("leif_participants?id=eq."+record.id,"PATCH",{access_hash:await digest(code),state:"active"},secret);
   return out({ok:true,access_code:code},200,origin);
  }
  if(action==="open_story"||action==="save_story"){
   if(!validId(body.participant_id))return out({error:"invalid_participant"},400,origin);
   const record=await scopedParticipant(body.participant_id,tenant,secret);
   if(!record)return out({error:"not_found"},404,origin);
   const rows=await db("leif_documents?participant_id=eq."+record.id+"&select=answers,personal_texts,questionnaire_version,revision,updated_at","GET",null,secret);
   if(!Array.isArray(rows)||rows.length!==1)return out({error:"no_document"},404,origin);
   const existing=rows[0];
   if(action==="open_story")return out({ok:true,participant:record,document:existing},200,origin);
   if(!storyOK(body.personal_texts)||!Number.isSafeInteger(body.expected_revision)||body.expected_revision<0)
    return out({error:"invalid_story"},400,origin);
   if(existing.revision!==body.expected_revision)return out({error:"revision_conflict"},409,origin);
   // Wijzig uitsluitend de persoonlijke teksten, nooit de antwoorden van de deelnemer.
   const saved=await db("leif_documents?participant_id=eq."+record.id+"&revision=eq."+body.expected_revision,"PATCH",
    {personal_texts:body.personal_texts,revision:body.expected_revision+1,updated_at:new Date().toISOString()},secret);
   if(!Array.isArray(saved)||saved.length!==1)return out({error:"revision_conflict"},409,origin);
   return out({ok:true,revision:saved[0].revision,updated_at:saved[0].updated_at},200,origin);
  }
  return out({error:"unknown_action"},400,origin);
 }catch(err){
  console.error("LEIF administration failed",err instanceof Error?err.message:"unknown");
  return out({error:"server_error"},503,origin);
 }
});
