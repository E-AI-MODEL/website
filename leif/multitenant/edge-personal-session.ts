// LEIF personal session API. Deploy as Supabase Edge Function "leif-personal-session".
// All reads and writes occur under a server-held secret. No browser database access.
const projectUrl = Deno.env.get("SUPABASE_URL") || "";
const allowedOrigins = new Set(["https://eaimodel.nl", "https://www.eaimodel.nl"]);
const questionIds = new Set(["zichtbaar","observeren","onzichtbaar","sterk","schuur","raak","reactie","emotie","behoefte","keuzes","denkenhelpt","denkenweg","waarde","zorggeven","zorgontvangen","zorgvragen","zorggrens","vertrouwen","afstand","verlies","contactreactie","vragen","geschiedenis","geleerd","oudepatronen","licht","jezelf","eigenweg","behouden","veranderen","uitspreken","stap"]);
function secretKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return Object.values(keys).find(v => typeof v === "string" && v.startsWith("sb_secret_")) || "";
  } catch { return ""; }
}
function reply(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status, headers: {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
      "Vary":"Origin","Access-Control-Allow-Origin":allowedOrigins.has(origin)?origin:"https://eaimodel.nl",
      "Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST,OPTIONS"}
  });
}
async function hashCode(code) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(buffer),x=>x.toString(16).padStart(2,"0")).join("");
}
async function db(path, method, data, service) {
  const headers = {"apikey":service,"Content-Type":"application/json","Accept":"application/json"};
  if(!service.startsWith("sb_secret_")) headers["Authorization"] = "Bearer " + service;
  if(method!=="GET") headers["Prefer"]="return=representation";
  const res=await fetch(projectUrl+"/rest/v1/"+path,{method,headers,body:data?JSON.stringify(data):undefined,cache:"no-store"});
  if(!res.ok) throw Error("database_"+res.status);
  return res.json();
}
const plainObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function validStringMap(value, maxPerValue, validKey) {
  if(!plainObject(value)||Object.keys(value).length>70)return false;
  return Object.entries(value).every(([id,v])=>validKey(id)&&typeof v==="string"&&v.length<=maxPerValue);
}
function checkChanges(changes) {
  if(!plainObject(changes)||Object.keys(changes).length===0||Object.keys(changes).length>4) return false;
  const keys=new Set(["answers","exercises","report","position"]);
  if(Object.keys(changes).some(k=>!keys.has(k)))return false;
  if("answers" in changes&&!validStringMap(changes.answers,20000,k=>questionIds.has(k))) return false;
  if("exercises" in changes&&!validStringMap(changes.exercises,20000,k=>/^[a-z0-9_-]{1,80}$/.test(k)))return false;
  if("report" in changes){
    if(!plainObject(changes.report)||JSON.stringify(changes.report).length>70000) return false;
    if(Object.keys(changes.report).some(k=>!["name","generated_at","questionnaire_version","sections"].includes(k)))return false;
    if("name" in changes&&(typeof changes.report.name!=="string"||changes.report.name.length>120))return false;
    if("sections" in changes&&(!Array.isArray(changes.report.sections)||changes.report.sections.length>42||changes.report.sections.some(s=>!plainObject(s)||typeof s.title!=="string"||s.title.length>200||typeof s.text!=="string"||s.text.length>25000)))return false;
  }
  if("position" in changes){
    const v=changes.position;
    if(!plainObject(v)||Object.keys(v).some(k=>!["screen","question_index","chapter"].includes(k))) return false;
    if(v.screen!==undefined&&!["start","questions","report","exercises","story"].includes(v.screen))return false;
    if(v.question_index!==undefined&&(!Number.isInteger(v.question_index)||v.question_index<0||v.question_index>100))return false;
    if(v.chapter!==undefined&&(typeof v.chapter!=="string"||v.chapter.length>50))return false;
  }
  return true;
}
Deno.serve(async req=>{
  const origin=req.headers.get("Origin")||"";
  if(req.method==="OPTIONS"){
    return allowedOrigins.has(origin)?reply({ok:true},200,origin):reply({error:"origin_not_allowed"},403,origin);
  }
  if(req.method!=="POST")return reply({error:"method_not_allowed"},405,origin);
  if(origin&&!allowedOrigins.has(origin))return reply({error:"origin_not_allowed"},403,origin);
  if(!req.headers.get("content-type")?.startsWith("application/json"))return reply({error:"invalid_content_type"},415,origin);
  if(Number(req.headers.get("content-length")||0)>120000)return reply({error:"request_too_large"},413,origin);
  let body;
  try{body=await req.json()}catch{return reply({error:"invalid_json"},400,origin)}
  if(JSON.stringify(body).length>120000)return reply({error:"request_too_large"},413,origin);
  if(!plainObject(body)||!["load","save"].includes(body.action)||typeof body.code!=="string"||!/^(?:[a-f0-9]{48}|lis)$/.test(body.code))
    return reply({error:"invalid_request"},400,origin);
  const service=secretKey();
  if(!service||!projectUrl)return reply({error:"service_unavailable"},503,origin);
  try {
    // LIS is uitsluitend een gedeelde demo-ingang naar het gemarkeerde testdossier.
    // Normale deelnemers gebruiken hun eigen 48-cijferige toegangscode.
    const demoCode=body.code==="lis";
    const lookup=demoCode?
      "leif_participants?test_alias=eq.LIS&is_demo=eq.true&select=id,tenant_id,display_name,state,expires_at":
      "leif_participants?access_hash=eq."+await hashCode(body.code)+"&select=id,tenant_id,display_name,state,expires_at";
    const participants=await db(lookup,"GET",null,service);
    if(!Array.isArray(participants)||participants.length!==1)return reply({error:"access_denied"},404,origin);
    const member=participants[0];
    if(member.state!=="active"||(member.expires_at&&Date.parse(member.expires_at)<Date.now()))return reply({error:"access_denied"},404,origin);
    const path="leif_documents?participant_id=eq."+encodeURIComponent(member.id)+"&select=participant_id,questionnaire_version,answers,exercises,report,personal_texts,position,revision,updated_at";
    const docs=await db(path,"GET",null,service);
    if(!Array.isArray(docs)||docs.length!==1)return reply({error:"document_unavailable"},503,origin);
    const doc=docs[0];
    if(body.action==="load"){ const texts=doc.personal_texts; const pub=texts&&typeof texts==="object"&&texts.published&&typeof texts.published==="object"?texts.published:{}; return reply({ok:true,participant:{id:member.id,name:member.display_name||""},document:{...doc,personal_texts:{...pub,blocks:Array.isArray(texts?.blocks_published)?texts.blocks_published:[]}}},200,origin); }
    if(!Number.isSafeInteger(body.expected_revision)||body.expected_revision<0||!checkChanges(body.changes))
      return reply({error:"invalid_save"},400,origin);
    if(doc.revision!==body.expected_revision)return reply({error:"revision_conflict",revision:doc.revision},409,origin);
    const changes={...body.changes,revision:body.expected_revision+1,updated_at:new Date().toISOString()};
    const saved=await db("leif_documents?participant_id=eq."+encodeURIComponent(member.id)+"&revision=eq."+body.expected_revision,"PATCH",changes,service);
    if(!Array.isArray(saved)||saved.length!==1)return reply({error:"revision_conflict"},409,origin);
    return reply({ok:true,revision:saved[0].revision,updated_at:saved[0].updated_at},200,origin);
  }catch(e){
    console.error("LEIF personal session failed",e instanceof Error?e.message:"unknown");
    return reply({error:"service_unavailable"},503,origin);
  }
});
