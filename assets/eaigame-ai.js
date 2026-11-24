// WebLLM gebruikt alleen expliciete gebruikersactivatie en lokale WebGPU-inferentie.
// AI-uitkomsten zijn niet inhoudelijk nagekeken; structuurcontrole != inhoudscontrole.
const MODEL='Qwen3-4B-q4f16_1-MLC';
let engine=null,loading=null;
export function isReady(){return Boolean(engine)}
export async function loadModel(onProgress=()=>{}){
 if(engine)return true;if(loading)return loading;
 if(!globalThis.navigator?.gpu)throw Error('Deze browser heeft geen WebGPU. Gebruik de vaste vragenbank.');
 loading=(async()=>{
  const webllm=await import('https://esm.sh/@mlc-ai/web-llm@0.2.88');
  const selected=webllm.prebuiltAppConfig?.model_list?.find(m=>m.model_id===MODEL);
  if(!selected)throw Error('Dit Qwen-model staat niet in de beschikbare WebLLM-configuratie.');
  engine=await webllm.CreateMLCEngine(MODEL,{initProgressCallback:p=>onProgress(p?.text||p?.progress?.toString()||'Model wordt geladen')});
  return true;
 })();
 try{return await loading}catch(err){engine=null;throw err}finally{loading=null}
}
export function parseResponse(raw,realm,level){
 const cleaned=String(raw||'').replace(/<think>[\s\S]*?<\/think>/g,'').replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
 const match=cleaned.match(/\{[\s\S]*\}/);if(!match)throw Error('Model heeft geen bruikbaar JSON-object gemaakt');
 const v=JSON.parse(match[0]);const options=v.options;
 if(typeof v.question!=='string'||v.question.trim().length<18||v.question.length>320||!Array.isArray(options)||options.length!==4||options.some(x=>typeof x!=='string'||x.trim().length<1||x.length>110)||new Set(options.map(x=>x.toLowerCase().trim())).size!==4||!Number.isInteger(v.answer)||v.answer<0||v.answer>3||typeof v.explanation!=='string'||v.explanation.length<20||typeof v.hint!=='string'||v.hint.length<7)throw Error('AI-vraag voldoet niet aan de minimale structuur');
 // Een merkbaar langer (of korter) juist antwoord verraadt de uitkomst.
 // Een afgekeurd concept valt terug op de vaste vragenbank.
 const lengths=options.map(o=>Array.from(o.trim()).length);
 const correctLength=lengths[v.answer],wrong=lengths.filter((_,i)=>i!==v.answer);
 if(correctLength>Math.max(...wrong)+5||correctLength<Math.min(...wrong)-5){
   throw Error('AI-antwoord is herkenbaar aan lengte; gebruik een redactionele basisvraag');
 }
 return {id:'local-ai-'+Date.now(),area:realm.id,level,type:'choice',question:v.question.slice(0,320),options:options.map(o=>o.slice(0,110)),answer:v.answer,explanation:v.explanation.slice(0,500),hint:v.hint.slice(0,220),source:{publisher:'Lokaal taalmodel, niet geverifieerd',context:'SLO leergebied',subject:realm.slo},reviewed:'ai-unverified'};
}
export async function generateQuestion(realm,level){
 if(!engine)return null;
 const levels={vmbo:'concrete, korte voorbeelden en herkenbare situaties',havo:'een toepassing in een herkenbare context, met één afweging',vwo:'een kleine analyse met een denkstap en plausibele afleiders'};
 const prompt='/no_think\nMaak precies EEN Nederlandstalige meerkeuzevraag voor onderbouw '+level+'. Leergebied: '+realm.slo+'. Thema: '+realm.subject+'. Niveau: '+levels[level]+'.\nGeef ALLEEN een geldig JSON-object met velden "question" (string), "options" (array van exact vier verschillende korte antwoorden), "answer" (index 0 tot 3), "explanation" (minimaal twintig tekens), "hint" (geen antwoord verklappen). Feitelijk en controleerbaar, geen eigennamen of gevoelige persoonlijke informatie. Vermijd dubbelzinnige antwoorden. Maak alle vier antwoordopties even specifiek en ongeveer even lang; geef het juiste antwoord niet extra uitleg.';
 const resp=await engine.chat.completions.create({messages:[{role:'system',content:'Je maakt compacte educatieve conceptvragen. Geef alleen JSON, zonder markdown.'},{role:'user',content:prompt}],temperature:.2,max_tokens:450});
 return parseResponse(resp?.choices?.[0]?.message?.content||'',realm,level);
}