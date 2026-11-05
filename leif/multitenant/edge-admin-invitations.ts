// Trusted administration interface. Must NEVER be exposed as a browser feature.
// Configure LEIF_ADMIN_INVITE_SECRET as a separate random server-side secret.
const url=Deno.env.get("SUPABASE_URL")||"";
function serviceKey(){
 const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(legacy)return legacy;
 try {return Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")).find(x=>typeof x==="string"&&x.startsWith("sb_secret_"))||""}catch{return ""}
}
function answer(x,status){return new Response(JSON.stringify(x),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
async function digest(data){
 const arr=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(data)));
 return Array.from(arr,b=>b.toString(16).padStart(2,"0")).join("");
}
async function equal(a,b){
 const aa=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(a)));
 const bb=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(b)));
 let diff=0; for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0;
}
async function db(path,method,payload,service){
 const headers={"apikey":service,"Content-Type":"application/json","Accept":"application/json"};
 if(!service.startsWith("sb_secret_"))headers["Authorization"]="Bearer "+service;
 if(method!=="GET")headers["Prefer"]="return=representation";
 const r=await fetch(url+"/rest/v1/"+path,{method,headers,body:payload?JSON.stringify(payload):undefined});
 if(!r.ok)throw Error("db_"+r.status);
 return r.json();
}
function inviteCode(){
 const b=crypto.getRandomValues(new Uint8Array(24));
 return Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
}
Deno.serve(async req=>{
 if(req.method!=="POST")return answer({error:"method_not_allowed"},405);
 if(req.headers.get("Origin"))return answer({error:"server_only"},403);
 const adminSecret=Deno.env.get("LEIF_ADMIN_INVITE_SECRET")||"",header=req.headers.get("authorization")||"";
 if(adminSecret.length<40||!header.startsWith("Bearer ")||!(await equal(header.slice(7),adminSecret)))return answer({error:"unauthorized"},401);
 if(Number(req.headers.get("content-length")||0)>4000)return answer({error:"too_large"},413);
 let body;try{body=await req.json()}catch{return answer({error:"invalid_json"},400)}
 const service=serviceKey();if(!service||!url)return answer({error:"unavailable"},503);
 if(!body||typeof body!=="object")return answer({error:"invalid_request"},400);
 const slug=body.tenant_slug;
 if(typeof slug!=="string"||!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug))return answer({error:"invalid_tenant"},400);
 try{
  if(body.action==="create_tenant"){
    if(typeof body.name!=="string"||body.name.trim().length<2||body.name.length>120)return answer({error:"invalid_name"},400);
    const rows=await db("leif_tenants","POST",{slug,name:body.name.trim()},service);
    return answer({ok:true,tenant_id:rows[0].id},201);
  }
  const tenants=await db("leif_tenants?slug=eq."+encodeURIComponent(slug)+"&select=id","GET",null,service);
  if(!Array.isArray(tenants)||tenants.length!==1)return answer({error:"tenant_not_found"},404);
  const tenant=tenants[0].id;
  if(body.action==="invite"){
    const name=body.display_name;
    if(name!==undefined&&(typeof name!=="string"||name.length>120))return answer({error:"invalid_name"},400);
    const code=inviteCode();
    const rows=await db("leif_participants","POST",{tenant_id:tenant,display_name:name||null,access_hash:await digest(code)},service);
    return answer({ok:true,participant_id:rows[0].id,access_code:code},201);
  }
  if(body.action==="rotate"||body.action==="revoke"){
    const participant=body.participant_id;
    if(typeof participant!=="string"||!/^[a-f0-9-]{36}$/i.test(participant))return answer({error:"invalid_participant"},400);
    const found=await db("leif_participants?id=eq."+encodeURIComponent(participant)+"&tenant_id=eq."+tenant+"&select=id,state","GET",null,service);
    if(!Array.isArray(found)||found.length!==1)return answer({error:"not_found"},404);
    if(body.action==="revoke"){
      await db("leif_participants?id=eq."+encodeURIComponent(participant)+"&tenant_id=eq."+tenant,"PATCH",{state:"revoked"},service);
      return answer({ok:true,revoked:true},200);
    }
    const code=inviteCode();
    await db("leif_participants?id=eq."+encodeURIComponent(participant)+"&tenant_id=eq."+tenant,"PATCH",{access_hash:await digest(code),state:"active"},service);
    return answer({ok:true,participant_id:participant,access_code:code},200);
  }
  return answer({error:"invalid_action"},400);
 }catch(e){
  console.error("LEIF administration failure",e instanceof Error?e.message:"unknown");
  return answer({error:"server_error"},503);
 }
});
