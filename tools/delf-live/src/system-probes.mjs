// Alleen ingeschakelde functies worden getest. Een statische browsercontrole start geen model.
export const SERVICES = [
  {id:'mic', name:'Spraakherkenning', hint:'Microfoon en browser', action:'Test via Taal'},
  {id:'translation',name:'Vertaling',hint:'Chrome Translator of lokaal browsermodel',action:'Laad en test via Taal'},
  {id:'french',name:'Franse stem',hint:'Phonon op dit apparaat',action:'Laad en beluister via Stem'},
  {id:'dutch',name:'Nederlandse stem',hint:'Systeemstem van de browser',action:'Kies en beluister via Stem'},
  {id:'sessions',name:'Sessies',hint:'Opslag op dit apparaat',action:'Controleer opslag'},
  {id:'ollama',name:'Ollama',hint:'Optionele lokale modelserver',action:'Test verbinding'},
  {id:'lmstudio',name:'LM Studio',hint:'Optionele lokale modelserver',action:'Test verbinding'}
];
export const STATUS = Object.freeze({idle:'idle',ready:'ready',busy:'busy',error:'error',unavailable:'unavailable'});
export function classifyError(error,service='') {
  const message=String(error?.message||error||'Onbekende fout');
  if (/abort|timeout|time.out/i.test(message)) return {code:'SYS-TIMEOUT-001',advice:'De controle duurde te lang. Probeer het opnieuw en kijk of het model geladen is.'};
  if (/failed to fetch|networkerror|load failed|cors/i.test(message)) return {code:'SYS-NET-002',advice:'De verbinding is niet bereikbaar of de browser blokkeert de aanvraag (CORS). Controleer adres, server en toegestane browserorigin.'};
  if (/permission|not.allowed|denied/i.test(message)) return {code:'SYS-PERM-003',advice:'Controleer de browsertoestemming voor de microfoon.'};
  if (/404|model.*not found/i.test(message)) return {code:'SYS-MODEL-004',advice:'Het gekozen model ontbreekt op de server. Laad of kies een beschikbaar model.'};
  return {code:'SYS-'+service.toUpperCase().replace(/[^A-Z]/g,'').slice(0,8)+'-005',advice:'Open de betreffende functie, controleer de instellingen en probeer de test opnieuw.'};
}
export function validateLocalEndpoint(value) {
  let url;
  try {url=new URL(String(value));} catch {throw new Error('Ongeldig serveradres');}
  if (!['http:','https:'].includes(url.protocol)) throw new Error('Alleen HTTP of HTTPS is toegestaan');
  if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Alleen een adres op dit apparaat is toegestaan');
  if (url.username||url.password||url.search||url.hash||url.pathname!=='/') throw new Error('Vul uitsluitend het basisadres in, zonder pad of inloggegevens');
  return url.origin;
}
async function request(url,init={},ms=8000) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  try {
    const response=await fetch(url,{...init,signal:controller.signal,cache:'no-store',credentials:'omit',redirect:'error'});
    if(!response.ok) throw new Error('HTTP '+response.status);
    return response.json();
  } finally {clearTimeout(timer);}
}
export async function probeLocalModel(provider,endpoint) {
  const origin=validateLocalEndpoint(endpoint);
  if(!['ollama','lmstudio'].includes(provider)) throw new Error('Onbekende aanbieder');
  const models=provider==='ollama'
    ? await request(origin+'/api/tags')
    : await request(origin+'/v1/models');
  const candidates=provider==='ollama' ? models.models : models.data;
  if(!Array.isArray(candidates)||!candidates.length) throw new Error('Geen modellen gevonden');
  const model=provider==='ollama' ? (candidates[0].name||candidates[0].model) : candidates[0].id;
  if(typeof model!=='string'||!model) throw new Error('Geen geldig model gevonden');
  // Een bereikbare server is nog geen bewijs dat een model antwoord geeft.
  const payload=provider==='ollama'
    ? {model,prompt:'Antwoord alleen met OK.',stream:false,options:{num_predict:8}}
    : {model,messages:[{role:'user',content:'Antwoord alleen met OK.'}],max_tokens:8,stream:false};
  const result=await request(origin+(provider==='ollama'?'/api/generate':'/v1/chat/completions'),{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
  },20000);
  const answer=provider==='ollama'?result.response:result.choices?.[0]?.message?.content;
  if(typeof answer!=='string'||!answer.trim()) throw new Error('Het model gaf geen tekst terug');
  return {model,answer};
}
