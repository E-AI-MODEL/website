// Alleen ingeschakelde functies worden getest. Een statische browsercontrole start geen model.
export const SERVICES = [
  {id:'mic', name:'Spraakherkenning', hint:'Microfoon en browser', action:'Test via Instellingen'},
  {id:'translation',name:'Vertaling',hint:'Chrome Translator of lokaal browsermodel',action:'Laad via Live en test via Instellingen'},
  {id:'french',name:'Franse stem',hint:'Phonon op dit apparaat',action:'Laad en beluister via Stem'},
  {id:'dutch',name:'Nederlandse stem',hint:'Systeemstem van de browser',action:'Kies en beluister via Stem'},
  {id:'sessions',name:'Lokale voorkeuren',hint:'Opslag op dit apparaat',action:'Controleer opslag'},
  {id:'ollama',name:'Ollama',hint:'Optionele lokale modelserver',action:'Test verbinding'},
  {id:'lmstudio',name:'LM Studio',hint:'Optionele lokale modelserver',action:'Test verbinding'},
  {id:'llamacpp',name:'llama.cpp',hint:'Optionele lokale modelserver',action:'Test verbinding'}
];
export const STATUS = Object.freeze({idle:'idle',ready:'ready',busy:'busy',error:'error',unavailable:'unavailable'});
export function classifyError(error,service='') {
  const message=String(error?.message||error||'Onbekende fout');
  if(service==='ollama'&&/HTTP\s*403|forbidden/i.test(message)) return {code:'SYS-OLLAMA-403',advice:'Ollama weigert deze website-origin. Sluit de server volledig af, stel OLLAMA_ORIGINS in en start de server opnieuw.'};
  if (/abort|timeout|time.out/i.test(message)) return {code:'SYS-TIMEOUT-001',advice:'De controle duurde te lang. Probeer het opnieuw en kijk of het model geladen is.'};
  if (/failed to fetch|networkerror|load failed|cors/i.test(message)) return {code:'SYS-NET-002',advice:'De verbinding is niet bereikbaar of de browser blokkeert de aanvraag (CORS of lokale-netwerktoestemming). Controleer de server, origin en site-instellingen.'};
  if (/permission|not.allowed|denied/i.test(message)) return {code:'SYS-PERM-003',advice:service==='mic'?'Controleer de browsertoestemming voor de microfoon.':'Controleer de site-instellingen voor toegang tot lokale apps.'};
  if (/404|model.*not found|gekozen model staat niet/i.test(message)) return {code:'SYS-MODEL-004',advice:'Het gekozen model ontbreekt op de server. Laad of kies een beschikbaar model.'};
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
// Use the granular permission where supported, not the obsolete combined name.
export async function loopbackPermission(permissions=globalThis.navigator?.permissions) {
  try{return (await permissions?.query({name:'loopback-network'}))?.state||'unknown';}
  catch{return 'unknown';}
}
export function localFetchOptions(url,init={}) {
  const parsed=new URL(url);
  if(!['http:','https:'].includes(parsed.protocol)||!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)||parsed.username||parsed.password)
    throw new Error('Alleen een lokale HTTP(S)-server is toegestaan');
  const options={...init,cache:'no-store',credentials:'omit',redirect:'error'};
  // Older browsers may reject the new enum or ignore it. Feature-detect
  // without performing a request; only send it when the browser accepts it.
  try{
    const candidate=new Request(url,{targetAddressSpace:'loopback'});
    if(candidate.targetAddressSpace==='loopback')options.targetAddressSpace='loopback';
  }catch{}
  return options;
}
async function request(url,init={},ms=8000) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  try {
    const response=await fetch(url,localFetchOptions(url,{...init,signal:controller.signal}));
    if(!response.ok) throw new Error('HTTP '+response.status);
    return response.json();
  } finally {clearTimeout(timer);}
}
export async function listLocalModels(provider,endpoint) {
  const origin=validateLocalEndpoint(endpoint);
  if(!['ollama','lmstudio','llamacpp'].includes(provider)) throw new Error('Onbekende aanbieder');
  const models=provider==='ollama' ? await request(origin+'/api/tags') : await request(origin+'/v1/models');
  const candidates=provider==='ollama' ? models.models : models.data;
  if(!Array.isArray(candidates)||!candidates.length) throw new Error('Geen modellen gevonden');
  const names=candidates.map(entry=>provider==='ollama' ? (entry?.name||entry?.model) : entry?.id)
    .filter(name=>typeof name==='string'&&name.length>0);
  if(!names.length) throw new Error('Geen geldig model gevonden');
  return [...new Set(names)];
}
export async function probeLocalModel(provider,endpoint,selectedModel=null,prompt='Antwoord alleen met OK.') {
  const origin=validateLocalEndpoint(endpoint);
  const candidates=await listLocalModels(provider,origin);
  const model=selectedModel||candidates[0];
  if(!candidates.includes(model)) throw new Error('Gekozen model staat niet op de server');
  const payload=provider==='ollama'
    ? {model,prompt,stream:false,options:{num_predict:128},...(model.startsWith('qwen3:')?{think:false}:{})}
    : {model,messages:[{role:'user',content:prompt}],max_tokens:80,stream:false};
  const result=await request(origin+(provider==='ollama'?'/api/generate':'/v1/chat/completions'),{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
  },60000);
  const answer=provider==='ollama'?result.response:result.choices?.[0]?.message?.content;
  if(typeof answer!=='string'||!answer.trim()) throw new Error('Het model gaf geen tekst terug');
  return {model,answer};
}

/**
 * Bereikbaarheid is geen modeltest. Een lege modellenlijst betekent wel dat
 * Ollama bereikbaar is; modellen worden nooit automatisch gedownload.
 */
export async function inspectOllamaServer(endpoint='http://localhost:11434/') {
  const origin=validateLocalEndpoint(endpoint);
  const result=await request(origin+'/api/tags',{},5000);
  if(!Array.isArray(result?.models)) throw new Error('Ongeldig Ollama-antwoord op /api/tags');
  return {
    online:true,
    models:result.models.map(model=>model?.name||model?.model).filter(name=>typeof name==='string'&&name.length>0)
  };
}
