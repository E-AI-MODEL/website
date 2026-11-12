// LO Aanvalslab - two independent teams per room; no personal data collected.
// Public Edge Function. All writes are authenticated by high-entropy per-role tokens.
import { createClient } from 'npm:@supabase/supabase-js@2.78.0';

const URL = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(URL, KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const ORIGINS = new Set(['https://eaimodel.nl','https://www.eaimodel.nl']);
const CORS = { 'Access-Control-Allow-Origin': 'https://eaimodel.nl', 'Access-Control-Allow-Headers':'content-type,apikey,authorization', 'Access-Control-Allow-Methods':'POST,OPTIONS', 'Vary':'Origin' };
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const bad = (message:string,status=400) => Response.json({error:message},{status,headers:CORS});
const ok = (data:unknown) => Response.json(data,{headers:{...CORS,'Cache-Control':'no-store'}});
const rand = (length:number) => {let s='';const bytes=crypto.getRandomValues(new Uint8Array(length));for(const b of bytes)s+=ABC[b%ABC.length];return s};
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
async function digest(s:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,'0')).join('')}
const intentsA = new Set(['pas','drijf','bewaar','zijde','diep','breed','bal','stil','kruis','ruimte']);
const intentsD = new Set(['dek','lijn','druk','zone','volg','terug']);
const shape=(raw:unknown,role:'a'|'d')=>{
 if(!Array.isArray(raw)||raw.length!==4)return null;
 const seen=new Set();const result=[];
 for(const p of raw){
  if(typeof p!=='object'||!p)return null;
  const {id,x,y,intent}=p as Record<string,unknown>;
  if(typeof id!=='string'||!new RegExp('^'+role+'[0-3]$').test(id)||seen.has(id))return null;
  seen.add(id);
  if(typeof x!=='number'||typeof y!=='number'||!Number.isFinite(x)||!Number.isFinite(y)||x<69||x>931||y<76||y>574)return null;
  if(typeof intent!=='string'||!(role==='d'?intentsD:id==='a0'?new Set(['pas','drijf','bewaar','zijde']):new Set(['diep','breed','bal','stil','kruis','ruimte'])).has(intent))return null;
  result.push({id,x,y,intent});
 }
 return result.sort((a,b)=>a.id.localeCompare(b.id));
};
const columns='id,code,attack_hash,defence_hash,scenario,attack_plan,defence_plan,attack_ready,defence_ready,status,seed,start_at,revision,expires_at';
async function getRoom(code:string){if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code))return null;const {data,error}=await db.from('lo_duo_rooms').select(columns).eq('code',code).gt('expires_at',new Date().toISOString()).maybeSingle();if(error)throw Error(error.message);return data}
const access=(room:any,hash:string):'a'|'d'|null=>hash===room.attack_hash?'a':hash===room.defence_hash&&room.defence_hash?'d':null;
function view(room:any,role:'a'|'d'){
 const both=room.status==='playing';
 return {code:room.code,role,scenario:room.scenario,status:room.status,revision:room.revision,
   mineReady:role==='a'?room.attack_ready:room.defence_ready,otherReady:role==='a'?room.defence_ready:room.attack_ready,
   joined:!!room.defence_hash, ownPlan:role==='a'?room.attack_plan:room.defence_plan,
   // An opponent's strategy must never leave the server before both players confirm.
   opponentPlan:both?(role==='a'?room.defence_plan:room.attack_plan):null,
   seed:both?room.seed:null,startAt:both?room.start_at:null,
   expiresAt:room.expires_at,serverNow:new Date().toISOString()};
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:CORS});
 if(req.method!=='POST')return bad('Gebruik POST.',405);
 const origin=req.headers.get('origin');if(origin&&!ORIGINS.has(origin))return bad('Onbekende herkomst.',403);
 if(origin&&ORIGINS.has(origin))CORS['Access-Control-Allow-Origin']=origin;
 if(Number(req.headers.get('content-length')||0)>12500)return bad('Verzoek te groot.',413);
 let body:any;try{body=await req.json()}catch{return bad('Ongeldige aanvraag.')}
 if(!body||typeof body!=='object')return bad('Ongeldige aanvraag.');
 try{
 const action=body.action;
 if(action==='create'){
  const scenario=Number(body.scenario||0);if(!Number.isInteger(scenario)||scenario<0||scenario>3)return bad('Ongeldige spelsituatie.');
  for(let i=0;i<7;i++){
   const code=rand(8),secret=token(),attack_hash=await digest(secret);
   const {data,error}=await db.from('lo_duo_rooms').insert({code,attack_hash,scenario}).select(columns).single();
   if(!error)return ok({room:view(data,'a'),token:secret});
   if(error.code!=='23505')throw Error(error.message);
  }
  return bad('Kamer aanmaken lukte niet.',503);
 }
 const code=String(body.code||'').toUpperCase().trim();if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code))return bad('Controleer de kamercode.');
 const room=await getRoom(code);if(!room)return bad('Kamer niet gevonden of verlopen.',404);
 if(action==='join'){
  if(room.defence_hash)return bad('Deze kamer heeft al twee spelers.',409);
  const secret=token(),defence_hash=await digest(secret);
  const {data,error}=await db.from('lo_duo_rooms').update({defence_hash,status:'planning'}).eq('id',room.id).is('defence_hash',null).eq('revision',room.revision).select(columns).maybeSingle();
  if(error)throw Error(error.message);
  if(!data)return bad('Deze kamer is net bezet. Maak een nieuwe kamer.',409);
  return ok({room:view(data,'d'),token:secret});
 }
 const presented=String(body.token||'');if(!/^[a-f0-9]{64}$/.test(presented))return bad('Toegang geweigerd.',403);
 const role=access(room,await digest(presented));if(!role)return bad('Toegang geweigerd.',403);
 if(action==='get')return ok({room:view(room,role)});
 if(action==='save'){
  if(room.status==='playing')return bad('Deze aanval is al gestart.',409);
  if((role==='a'?room.attack_ready:room.defence_ready))return bad('Je plan staat vast. Kies eerst Bewerken.',409);
  const plan=shape(body.plan,role);if(!plan)return bad('Ongeldige spelersopstelling.');
  const changes=role==='a'?{attack_plan:plan}:{defence_plan:plan};
  const {data,error}=await db.from('lo_duo_rooms').update(changes).eq('id',room.id).eq('revision',room.revision).select(columns).maybeSingle();
  if(error)throw Error(error.message);
  if(!data)return bad('Plan elders gewijzigd. Probeer opnieuw.',409);
  return ok({room:view(data,role)});
 }
 if(action==='unready'){
  if(room.status==='playing')return bad('De aanval is al begonnen.',409);
  const changes=role==='a'?{attack_ready:false}:{defence_ready:false};
  const {data,error}=await db.from('lo_duo_rooms').update(changes).eq('id',room.id).eq('revision',room.revision).select(columns).maybeSingle();
  if(error)throw Error(error.message);if(!data)return bad('Status gewijzigd. Probeer opnieuw.',409);
  return ok({room:view(data,role)});
 }
 if(action==='ready'){
  if(room.status==='playing')return ok({room:view(room,role)});
  const current=role==='a'?room.attack_plan:room.defence_plan;
  if(!shape(current,role))return bad('Sla eerst een geldig plan op.');
  const otherReady=role==='a'?room.defence_ready:room.attack_ready;
  const changes:any=role==='a'?{attack_ready:true}:{defence_ready:true};
  if(otherReady){changes.status='playing';changes.start_at=new Date(Date.now()+2500).toISOString();changes.seed=1+crypto.getRandomValues(new Uint32Array(1))[0]%10000000;}
  const {data,error}=await db.from('lo_duo_rooms').update(changes).eq('id',room.id).eq('revision',room.revision).select(columns).maybeSingle();
  if(error)throw Error(error.message);if(!data)return bad('De andere speler was tegelijk bezig. Probeer opnieuw.',409);
  return ok({room:view(data,role)});
 }
 if(action==='again'){
  if(room.status!=='playing')return bad('Er loopt nog geen aanval.',409);
  const changes={status:'planning',attack_ready:false,defence_ready:false,start_at:null,seed:1337};
  const {data,error}=await db.from('lo_duo_rooms').update(changes).eq('id',room.id).eq('revision',room.revision).select(columns).maybeSingle();
  if(error)throw Error(error.message);if(!data)return bad('De kamer is intussen gewijzigd.',409);
  return ok({room:view(data,role)});
 }
 return bad('Onbekende actie.');
 }catch(e){console.error('lo-duo server error',e);return bad('Er ging iets mis op de server.',500)}
});