// LEIF beheer. Auth via Supabase, toegang per organisatie. Geen browsertoegang tot service secrets.
const projectUrl=Deno.env.get("SUPABASE_URL")||"";
const origins=new Set(["https://eaimodel.nl","https://www.eaimodel.nl"]);
const allowedTextFields=["inleiding","blik_van_een_ander","verder_kijken","slotwoord"];
function svc(){const old=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(old)return old;try{return Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")).find(x=>typeof x==="string"&&x.startsWith("sb_secret_"))||""}catch{return ""}}
function publicKey(){return Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||""}
function send(data,status,origin){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Origin":origins.has(origin)?origin:"https://eaimodel.nl","Access-Control-Allow-Headers":"content-type,authorization","Access-Control-Allow-Methods":"POST,OPTIONS"}})}
function object(v){return v!==null&&typeof v==="object"&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype}
async function hash(v){const a=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));return Array.from(a,x=>x.toString(16).padStart(2,"0")).join("")}
function newCode(){return Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,"0")).join("")}
function idValid(v){return typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)}
async function database(path,method,body,service){const headers={"apikey":service,"Content-Type":"application/json","Accept":"application/json"};if(!service.startsWith("sb_secret_"))headers.Authorization="Bearer "+service;if(method!=="GET")headers.Prefer="return=representation";const r=await fetch(projectUrl+"/rest/v1/"+path,{method,headers,body:body?JSON.stringify(body):undefined,cache:"no-store"});if(!r.ok)throw Error("database_"+r.status);return r.json()}
async function authRequest(route,body,key,token){const headers={"apikey":key,"Content-Type":"application/json"};if(token)headers.Authorization="Bearer "+token;const r=await fetch(projectUrl+"/auth/v1/"+route,{method:body?"POST":"GET",headers,body:body?JSON.stringify(body):undefined,cache:"no-store"});if(!r.ok)throw Error("auth_"+r.status);return r.json()}
async function membershipList(userId,service){
 const found=await database("leif_admin_memberships?user_id=eq."+encodeURIComponent(userId)+"&select=tenant_id,role&limit=50","GET",null,service);
 if(!Array.isArray(found)||!found.length)return [];
 const allowed=[];
 for(const row of found){
  const tenants=await database("leif_tenants?id=eq."+encodeURIComponent(row.tenant_id)+"&select=id,slug,name","GET",null,service);
  if(tenants.length===1)allowed.push({...tenants[0],role:row.role});
 }
 return allowed;
}
async function authUser(jwt,key){if(typeof jwt!=="string"||jwt.length<100||jwt.length>8000)throw Error("invalid_jwt");const u=await authRequest("user",null,key,jwt);if(!idValid(u.id)||u.is_anonymous)return null;return u}
function validText(doc){
 if(!object(doc)||Object.keys(doc).some(k=>!allowedTextFields.includes(k)))return false;
 const values=Object.values(doc);
 return values.every(x=>typeof x==="string"&&x.length<=45000)&&JSON.stringify(doc).length<=130000;
}
Deno.serve(async req=>{
 const origin=req.headers.get("Origin")||"";
 if(req.method==="OPTIONS")return origins.has(origin)?send({ok:true},200,origin):send({error:"forbidden"},403,origin);
 if(req.method!=="POST")return send({error:"method_not_allowed"},405,origin);
 if(origin&&!origins.has(origin))return send({error:"forbidden"},403,origin);
 if(!req.headers.get("content-type")?.startsWith("application/json"))return send({error:"invalid_content_type"},415,origin);
 if(Number(req.headers.get("content-length")||"0")>180000)return send({error:"too_large"},413,origin);
 let input;try{input=await req.json()}catch{return send({error:"invalid_json"},400,origin)}
 if(!object(input)||JSON.stringify(input).length>180000)return send({error:"invalid_request"},400,origin);
 const service=svc(),key=publicKey();if(!service||!key||!projectUrl)return send({error:"not_configured"},503,origin);
 try{

  // Alleen gepubliceerde algemene websiteteksten. Antwoorden en concepten nooit openbaar.
  if(input.action==="site_public"){
   if(typeof input.page!=="string"||!["start","mijn","vervolg","verhaal","beheer"].includes(input.page))return send({error:"invalid_page"},400,origin);
   const items=await database("leif_site_texts?page=eq."+input.page+"&published_text=not.is.null&select=field_key,published_text&limit=500","GET",null,service);
   return send({ok:true,items},200,origin);
  }
  // Beheerders melden zich aan met een bestaand, bevestigd Supabase Auth-account.
  if(input.action==="login"||input.action==="refresh"){
   if(input.action==="login"&&(typeof input.email!=="string"||input.email.length>254||typeof input.password!=="string"||input.password.length>1000))return send({error:"invalid_credentials"},400,origin);
   if(input.action==="refresh"&&(typeof input.refresh_token!=="string"||input.refresh_token.length>10000))return send({error:"invalid_refresh"},400,origin);
   const route=input.action==="login"?"token?grant_type=password":"token?grant_type=refresh_token";
   const body=input.action==="login"?{email:input.email.trim(),password:input.password}:{refresh_token:input.refresh_token};
   let tokens;try{tokens=await authRequest(route,body,key)}catch{return send({error:"invalid_credentials"},401,origin)}
   const user=await authUser(tokens.access_token,key);
   const memberships=user?await membershipList(user.id,service):[];
   if(!memberships.length)return send({error:"no_admin_access"},403,origin);
   return send({ok:true,access_token:tokens.access_token,refresh_token:tokens.refresh_token,expires_in:tokens.expires_in,user_email:user.email||"",tenants:memberships},200,origin);
  }
  const jwt=req.headers.get("Authorization")||"";
  if(!jwt.startsWith("Bearer "))return send({error:"not_authenticated"},401,origin);
  let user;try{user=await authUser(jwt.slice(7),key)}catch{return send({error:"not_authenticated"},401,origin)}
  if(!user)return send({error:"not_authenticated"},401,origin);
  const memberships=await membershipList(user.id,service);
  if(!memberships.length)return send({error:"not_authorized"},403,origin);
  if(input.action==="session")return send({ok:true,tenants:memberships,user_email:user.email||""},200,origin);
  const scope=memberships.find(t=>t.id===input.tenant_id);
  if(!scope)return send({error:"not_authorized"},403,origin);


  if(["site_list","site_save","site_publish","site_unpublish","site_history","site_restore"].includes(input.action)){
   if(scope.slug!=="leif"||scope.role!=="manager")return send({error:"not_authorized"},403,origin);
   const pages=["start","mijn","vervolg","verhaal","beheer"];
   if(typeof input.page!=="string"||!pages.includes(input.page))return send({error:"invalid_page"},400,origin);
   const page=input.page;
   if(input.action==="site_list"){
    const items=await database("leif_site_texts?page=eq."+page+"&select=page,field_key,original_text,draft_text,published_text,revision,updated_at,published_at&order=updated_at.desc&limit=500","GET",null,service);
    return send({ok:true,items},200,origin);
   }
   if(typeof input.field_key!=="string"||!/^[0-9a-f]{16}$/.test(input.field_key))return send({error:"invalid_field"},400,origin);
   const path="leif_site_texts?page=eq."+page+"&field_key=eq."+input.field_key;
   if(input.action==="site_history"){
    const items=await database("leif_site_text_history?page=eq."+page+"&field_key=eq."+input.field_key+"&select=id,revision,draft_text,published_text,event,changed_at&order=id.desc&limit=60","GET",null,service);
    return send({ok:true,items},200,origin);
   }
   const rows=await database(path+"&select=page,field_key,original_text,draft_text,published_text,revision,published_at","GET",null,service);
   const existing=rows[0]||null;
   if(!Number.isInteger(input.revision)||input.revision<0||input.revision>1000000||input.revision!==(existing?.revision||0))return send({error:"revision_conflict",revision:existing?.revision||0},409,origin);
   let update;
   if(input.action==="site_save"){
    if(typeof input.text!=="string"||input.text.length>6000)return send({error:"invalid_text"},400,origin);
    if(!existing){
     if(typeof input.original!=="string"||input.original.trim().length<3||input.original.length>6000)return send({error:"invalid_original"},400,origin);
     const initial={page,field_key:input.field_key,original_text:input.original,draft_text:input.text,revision:1,changed_by:user.id};
     try{
      const created=await database("leif_site_texts","POST",initial,service);
      if(created.length===1)return send({ok:true,item:created[0]},200,origin);
     }catch{return send({error:"revision_conflict"},409,origin)}
     return send({error:"save_failed"},503,origin);
    }
    update={draft_text:input.text};
   }else if(!existing)return send({error:"not_found"},404,origin);
   else if(input.action==="site_publish"){
    update={published_text:existing.draft_text,published_at:new Date().toISOString()};
   }else if(input.action==="site_unpublish"){
    update={published_text:null,published_at:null};
   }else if(input.action==="site_restore"){
    if(!Number.isSafeInteger(input.history_id)||input.history_id<1)return send({error:"invalid_version"},400,origin);
    const history=await database("leif_site_text_history?id=eq."+input.history_id+"&page=eq."+page+"&field_key=eq."+input.field_key+"&select=draft_text&limit=1","GET",null,service);
    if(history.length!==1)return send({error:"not_found"},404,origin);
    update={draft_text:history[0].draft_text};
   }else return send({error:"invalid_action"},400,origin);
   const result=await database(path+"&revision=eq."+existing.revision,"PATCH",{...update,revision:existing.revision+1,changed_by:user.id,updated_at:new Date().toISOString()},service);
   if(result.length!==1)return send({error:"revision_conflict"},409,origin);
   return send({ok:true,item:result[0]},200,origin);
  }
  if(input.action==="list_testers" || input.action==="create_tester" || input.action==="get_tester"){
    if(scope.slug!=="leif" || scope.role!=="manager")return send({error:"not_authorized"},403,origin);
    if(input.action==="list_testers"){
      const testers=await database("leif_demo_sessions?select=id,tester_name,status,created_at,updated_at&order=created_at.desc&limit=250","GET",null,service);
      return send({ok:true,testers},200,origin);
    }
    if(input.action==="get_tester"){
      if(!idValid(input.tester_id))return send({error:"invalid_tester"},400,origin);
      const rows=await database("leif_demo_sessions?id=eq."+encodeURIComponent(input.tester_id)+"&select=id,tester_name,status,answers,updated_at","GET",null,service);
      if(rows.length!==1)return send({error:"not_found"},404,origin);
      return send({ok:true,tester:rows[0]},200,origin);
    }
    const name=typeof input.name==="string"?input.name.trim():"";
    if(!name || name.length>120)return send({error:"invalid_name"},400,origin);
    const code="LEIF-TEST-"+newCode();
    const rows=await database("leif_demo_sessions","POST",{
      continuation_hash:await hash(code),tester_name:name,
      source_note:"LEIF-proef. Aangemaakt via beheer."
    },service);
    if(rows.length!==1)return send({error:"creation_failed"},503,origin);
    return send({ok:true,code},201,origin);
  }
  if(input.action==="list"){
   const participants=await database("leif_participants?tenant_id=eq."+scope.id+"&select=id,display_name,state,expires_at,created_at&order=created_at.desc&limit=250","GET",null,service);
   return send({ok:true,participants,role:scope.role},200,origin);
  }
  if(input.action==="invite"){
   if(scope.role!=="manager")return send({error:"not_authorized"},403,origin);
   const name=typeof input.name==="string"?input.name.trim():"";
   if(!name||name.length>120)return send({error:"invalid_name"},400,origin);
   const code=newCode(),hashValue=await hash(code);
   const inserted=await database("leif_participants","POST",{tenant_id:scope.id,display_name:name,access_hash:hashValue},service);
   if(inserted.length!==1)return send({error:"creation_failed"},503,origin);
   return send({ok:true,participant:inserted[0].id,code},201,origin);
  }
  if(!idValid(input.participant_id))return send({error:"invalid_participant"},400,origin);
  const rows=await database("leif_participants?id=eq."+input.participant_id+"&tenant_id=eq."+scope.id+"&select=id,display_name,state,expires_at","GET",null,service);
  if(!Array.isArray(rows)||rows.length!==1)return send({error:"not_found"},404,origin);
  const participant=rows[0];
  if(input.action==="rename"){
   if(scope.role!=="manager"||typeof input.name!=="string"||!input.name.trim()||input.name.length>120)return send({error:"invalid_name"},400,origin);
   await database("leif_participants?id=eq."+participant.id+"&tenant_id=eq."+scope.id,"PATCH",{display_name:input.name.trim()},service);
   return send({ok:true,name:input.name.trim()},200,origin);
  }
  if(input.action==="rotate"||input.action==="revoke"){
   if(scope.role!=="manager")return send({error:"not_authorized"},403,origin);
   if(input.action==="revoke"){
    await database("leif_participants?id=eq."+participant.id+"&tenant_id=eq."+scope.id,"PATCH",{state:"revoked"},service);
    return send({ok:true,revoked:true},200,origin);
   }
   const code=newCode();
   await database("leif_participants?id=eq."+participant.id+"&tenant_id=eq."+scope.id,"PATCH",{access_hash:await hash(code),state:"active"},service);
   return send({ok:true,code},200,origin);
  }
  const documents=await database("leif_documents?participant_id=eq."+participant.id+"&select=participant_id,answers,exercises,report,position,personal_texts,revision,updated_at","GET",null,service);
  if(documents.length!==1)return send({error:"document_not_found"},404,origin);
  const doc=documents[0];
  if(input.action==="get")return send({ok:true,participant,document:doc},200,origin);
  if(!["save_draft","publish_story","unpublish_story"].includes(input.action))return send({error:"invalid_action"},400,origin);
  if(!Number.isSafeInteger(input.revision)||input.revision<0||input.revision!==doc.revision)return send({error:"revision_conflict",revision:doc.revision},409,origin);
  const previous=object(doc.personal_texts)?doc.personal_texts:{};
  const data={...previous};
  if(input.action==="save_draft"){
   if(!validText(input.draft))return send({error:"invalid_text"},400,origin);
   data.draft=input.draft;
   data.draft_saved_at=new Date().toISOString();
  }else if(input.action==="publish_story"){
   const draft=previous.draft;
   if(!validText(draft)||Object.values(draft).every(v=>!v.trim()))return send({error:"no_draft"},400,origin);
   data.published={...draft};data.published_at=new Date().toISOString();
  }else{
   data.published={};data.published_at=null;
  }
  const result=await database("leif_documents?participant_id=eq."+participant.id+"&revision=eq."+doc.revision,"PATCH",{personal_texts:data,revision:doc.revision+1,updated_at:new Date().toISOString()},service);
  if(!Array.isArray(result)||result.length!==1)return send({error:"revision_conflict"},409,origin);
  return send({ok:true,revision:result[0].revision,personal_texts:data},200,origin);
 }catch(e){
  console.error("LEIF beheerfout",e instanceof Error?e.message:"unknown");
  return send({error:"server_unavailable"},503,origin);
 }
});
