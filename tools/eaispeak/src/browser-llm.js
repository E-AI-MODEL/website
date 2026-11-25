// EAIspeak: browsermodel uit PiM-ontwerp, op aanvraag geladen.
// Geen tekst gaat naar Hugging Face: enkel modelbestanden worden opgehaald.
import {checkWebGpuAvailability} from './gpu-capability.mjs';
export const BROWSER_MODELS=Object.freeze([
  {id:'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',name:'Qwen 0,5B · licht',size:'circa 945 MB werkgeheugen',backend:'WebGPU'},
  {id:'Llama-3.2-1B-Instruct-q4f16_1-MLC',name:'Llama 1B · licht',size:'circa 880 MB werkgeheugen',backend:'WebGPU'},
  {id:'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',name:'Qwen 1,5B · middel',size:'circa 1,6 GB werkgeheugen',backend:'WebGPU'},
  {id:'Qwen2.5-3B-Instruct-q4f16_1-MLC',name:'Qwen 3B · groter',size:'circa 2,4 GB werkgeheugen',backend:'WebGPU'}
]);
let engine=null,activeModel='',loading=null,generating=false;
export async function ensureBrowserModel(modelId,report=()=>{}){
  if(!BROWSER_MODELS.some(model=>model.id===modelId))throw new Error('Dit browsermodel staat niet in de catalogus.');
  const hardware=await checkWebGpuAvailability(navigator.gpu);
  if(!hardware.usable)throw new Error(hardware.message);
  if(engine&&activeModel===modelId)return engine;
  if(loading)throw new Error('Er wordt al een browsermodel geladen.');
  loading=(async()=>{
    if(engine&&activeModel!==modelId){
      report('Vorige model wordt vrijgegeven…');
      await engine.unload?.();
      engine=null;activeModel='';
    }
    report('Model laden uit browsercache. Ontbrekende bestanden worden gedownload…');
    const {CreateMLCEngine,prebuiltAppConfig}=await import('@mlc-ai/web-llm');
    if(!prebuiltAppConfig.model_list.some(entry=>entry.model_id===modelId)){
      throw new Error('Dit model staat niet in de WebLLM-bibliotheek van deze website. Kies een ander model.');
    }
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
  generating=true;
  try{
    const response=await model.chat.completions.create({
      messages,max_tokens:150,temperature:0.65,top_p:0.9
    });
    const content=response?.choices?.[0]?.message?.content;
    if(typeof content!=='string'||!content.trim())throw new Error('Het browsermodel gaf geen antwoord.');
    return content.trim();
  }finally{generating=false;}
}
export function interruptBrowserReply(){
  if(generating&&engine?.interruptGenerate)engine.interruptGenerate();
}
export function browserModelStatus(){
  return {model:activeModel,ready:!!engine,loading:!!loading,generating};
}
