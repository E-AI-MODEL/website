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
 return send({error:"not_implemented"},501,origin);
});
