// LEIF passkeys. Geeft nooit toegang zonder Supabase Auth en bestaande managercontrole.
const projectUrl=Deno.env.get("SUPABASE_URL")||"";
const publicKey=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
const origins=new Set(["https://eaimodel.nl","https://www.eaimodel.nl"]);
function send(data,status,origin){
 return new Response(JSON.stringify(data),{status,headers:{
  "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
  "Vary":"Origin","Access-Control-Allow-Origin":origins.has(origin)?origin:"https://eaimodel.nl",
  "Access-Control-Allow-Headers":"content-type,authorization",
  "Access-Control-Allow-Methods":"POST,OPTIONS"
 }});
}
Deno.serve(async req=>{
 const origin=req.headers.get("Origin")||"";
 if(req.method==="OPTIONS")return origins.has(origin)?send({ok:true},200,origin):send({error:"forbidden"},403,origin);
 if(req.method!=="POST")return send({error:"method_not_allowed"},405,origin);
 if(!origins.has(origin))return send({error:"forbidden"},403,origin);
 if(!publicKey||!projectUrl)return send({error:"not_configured"},503,origin);
 if(!req.headers.get("content-type")?.startsWith("application/json"))return send({error:"invalid_content_type"},415,origin);
 if(Number(req.headers.get("content-length")||"0")>40000)return send({error:"too_large"},413,origin);
 let input;try{input=await req.json()}catch{return send({error:"invalid_json"},400,origin)}
 if(!input||typeof input!=="object"||Array.isArray(input))return send({error:"invalid_request"},400,origin);
 const routes={
  passkey_signin_start:"passkeys/authentication/options",
  passkey_signin_finish:"passkeys/authentication/verify",
  passkey_register_start:"passkeys/registration/options",
  passkey_register_finish:"passkeys/registration/verify"
 };
 const action=input.action;
 if(typeof action!=="string"||!Object.hasOwn(routes,action))return send({error:"invalid_action"},400,origin);
 const registration=action.startsWith("passkey_register");
 const finish=action.endsWith("_finish");
 const bearer=req.headers.get("Authorization")||"";
 if(registration&&!bearer.startsWith("Bearer "))return send({error:"not_authenticated"},401,origin);
 async function managerCheck(token){
  const check=await fetch(projectUrl+"/functions/v1/leif-admin-console",{
   method:"POST",headers:{"Content-Type":"application/json","Authorization":token},
   body:JSON.stringify({action:"session"}),cache:"no-store"
  });
  if(!check.ok)return false;
  const data=await check.json().catch(()=>({}));
  return data.ok===true&&Array.isArray(data.tenants)&&
   data.tenants.some(t=>t.slug==="leif"&&t.role==="manager");
 }
 if(registration){
  let manager=false;try{manager=await managerCheck(bearer)}catch{}
  if(!manager)return send({error:"not_authorized"},403,origin);
 }
 if(finish){
  if(typeof input.challenge_id!=="string"||input.challenge_id.length<10||input.challenge_id.length>150||
     !input.credential||typeof input.credential!=="object"||Array.isArray(input.credential)||
     JSON.stringify(input.credential).length>32000)return send({error:"invalid_passkey"},400,origin);
 }
 const body=finish?{challenge_id:input.challenge_id,credential:input.credential}:{};
 let authResponse;
 try{
  authResponse=await fetch(projectUrl+"/auth/v1/"+routes[action],{
   method:"POST",cache:"no-store",
   headers:{"apikey":publicKey,"Content-Type":"application/json",...(registration?{"Authorization":bearer}:{})},
   body:JSON.stringify(body)
  });
 }catch{return send({error:"passkey_unavailable"},503,origin)}
 if(!authResponse.ok){
  let failed;try{failed=await authResponse.json()}catch{}
  if(failed?.code==="passkey_disabled"||failed?.error_code==="passkey_disabled")return send({error:"passkey_disabled"},503,origin);
  return send({error:finish?"passkey_failed":"passkey_unavailable"},finish?401:503,origin);
 }
 let data;try{data=await authResponse.json()}catch{return send({error:"passkey_unavailable"},503,origin)}
 if(!finish){
  if(typeof data.challenge_id!=="string"||!data.options||typeof data.options!=="object")return send({error:"passkey_unavailable"},503,origin);
  return send({ok:true,challenge_id:data.challenge_id,options:data.options},200,origin);
 }
 if(registration)return send({ok:true},200,origin);
 const session=data.session||data;
 if(typeof session.access_token!=="string"||typeof session.refresh_token!=="string")return send({error:"passkey_failed"},401,origin);
 let manager=false;
 try{manager=await managerCheck("Bearer "+session.access_token)}catch{}
 if(!manager)return send({error:"no_admin_access"},403,origin);
 return send({ok:true,access_token:session.access_token,refresh_token:session.refresh_token},200,origin);
});
