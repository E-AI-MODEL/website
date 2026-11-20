// EAIspeak: browsermodel uit PiM-ontwerp, op aanvraag geladen.
// Geen tekst gaat naar Hugging Face: enkel modelbestanden worden opgehaald.
export const BROWSER_MODELS=Object.freeze([
  {id:'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',name:'Qwen 0,5B · licht',size:'circa 400 MB',backend:'WebGPU'},
  {id:'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',name:'Qwen 1,5B · uitgebreid',size:'circa 1 GB',backend:'WebGPU'}
]);
let engine=null,activeModel='',loading=null;
export async function ensureBrowserModel(modelId,report=()=>{}){
  if(!BROWSER_MODELS.some(model=>model.id===modelId))throw new Error('Dit browsermodel staat niet in de catalogus.');
  if(!navigator.gpu)throw new Error('WebGPU is niet beschikbaar. Probeer Chrome of kies de online route.');
  if(engine&&activeModel===modelId)return engine;
  if(loading)throw new Error('Er wordt al een browsermodel geladen.');
  loading=(async()=>{
    report('Modelbestanden worden gedownload. Dit gebeurt alleen de eerste keer…');
    const {CreateMLCEngine}=await import('@mlc-ai/web-llm');
    const loaded=await CreateMLCEngine(modelId,{
      initProgressCallback:p=>{
        const percentage=Number.isFinite(p?.progress)?Math.round(p.progress*100):null;
        report(percentage===null?String(p?.text||'Model laden…'):'Model laden: '+percentage+'%');
      }
    });
    engine=loaded;activeModel=modelId;
    report('Browsermodel geladen. Het gesprek blijft op dit apparaat.');
    return loaded;
  })();
  try{return await loading;}catch(error){engine=null;activeModel='';throw error;}finally{loading=null;}
}
export async function localReply(messages,modelId,report){
  const model=await ensureBrowserModel(modelId,report);
  const response=await model.chat.completions.create({
    messages,max_tokens:150,temperature:0.65,top_p:0.9
  });
  const content=response?.choices?.[0]?.message?.content;
  if(typeof content!=='string'||!content.trim())throw new Error('Het browsermodel gaf geen antwoord.');
  return content.trim();
}
export function browserModelStatus(){
  return {model:activeModel,ready:!!engine,loading:!!loading};
}
