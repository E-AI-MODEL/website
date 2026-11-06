// Public, aggregate-only EAI site counts. No visitor identifiers.
const allowed = new Set(["https://eaimodel.nl","https://www.eaimodel.nl","http://localhost:8000","http://127.0.0.1:8000"]);
function headers(origin:string|null){
  const h:Record<string,string>={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
  if(origin && allowed.has(origin)){h["access-control-allow-origin"]=origin;h["vary"]="Origin";}
  h["access-control-allow-methods"]="GET, POST, OPTIONS";
  h["access-control-allow-headers"]="content-type";
  return h;
}
const response=(body:unknown,status:number,origin:string|null)=>new Response(JSON.stringify(body),{status,headers:headers(origin)});
const sitePath=(path:unknown):path is string =>
  typeof path==="string" &&
  path.length>0 && path.length<=120 &&
  /^\/[a-zA-Z0-9/_.-]*$/.test(path) &&
  !/^\/(leif|houseoftalents|admin|private)(\/|$)/i.test(path);
function serviceConfig(){
  const url=Deno.env.get("SUPABASE_URL");
  const secretMap=Deno.env.get("SUPABASE_SECRET_KEYS");
  let key="";
  if(secretMap)try{key=JSON.parse(secretMap).default||"";}catch(_){}
  if(!key)key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!key)throw Error("Missing database config");
  return {url,key};
}
async function rpc(fn:string,data:Record<string,unknown>){
  const {url,key}=serviceConfig();
  const headers:Record<string,string>={"apikey":key,"content-type":"application/json"};
  if(key.split(".").length===3)headers["authorization"]="Bearer "+key;
  const result=await fetch(url+"/rest/v1/rpc/"+fn,{method:"POST",headers,body:JSON.stringify(data)});
  if(!result.ok)throw Error("Aggregated data unavailable");
  const text = await result.text();
  return text ? JSON.parse(text) : null;
}
Deno.serve(async req=>{
  const origin=req.headers.get("origin");
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(origin)});
  if(req.method==="GET"){
    try{
      const u=new URL(req.url);
      const days=Math.max(1,Math.min(90,Number(u.searchParams.get("days")||30)||30));
      const rows=await rpc("eai_site_read",{p_days:Math.floor(days)});
      return response({period:Math.floor(days),rows,unit:"gebeurtenissen",updated:new Date().toISOString()},200,origin);
    }catch(_){return response({error:"Statistieken niet beschikbaar"},503,origin);}
  }
  if(req.method!=="POST")return response({error:"Methode niet toegestaan"},405,origin);
  // A site event is accepted only from the site's own origin.
  if(!origin||!allowed.has(origin))return response({error:"Herkomst niet toegestaan"},403,origin);
  try{
    const size=Number(req.headers.get("content-length")||0);
    if(size>512)return response({error:"Te groot"},413,origin);
    const raw=await req.text();
    if(raw.length>512)return response({error:"Te groot"},413,origin);
    const body=JSON.parse(raw);
    if(!sitePath(body.path)||!["pagina","tool","gelezen"].includes(body.event)||!["mobiel","desktop"].includes(body.device))
      return response({error:"Ongeldige gebeurtenis"},400,origin);
    await rpc("eai_site_increment",{p_path:body.path,p_event:body.event,p_device:body.device});
    return response({ok:true},200,origin);
  }catch(_){return response({error:"Registratie niet beschikbaar"},503,origin);}
});