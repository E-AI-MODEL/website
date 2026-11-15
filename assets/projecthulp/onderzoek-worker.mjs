// Twee echte, afgebakende browserwerkers. Geen opslag, uploads of code-uitvoering.
import {analyzeArchive,fetchPublicRepo} from "./analyse.mjs";
self.addEventListener("message",async(event)=>{
 const data=event.data;
 if(!data||!Number.isSafeInteger(data.id)||!["zip","github"].includes(data.kind))return;
 const started=performance.now();
 try{
  let result;
  if(data.kind==="zip"){
   if(!(data.buffer instanceof ArrayBuffer)||data.buffer.byteLength>16*1024*1024)
    throw new Error("Dit ZIP-bestand is te groot.");
   const input={name:String(data.name||"project.zip"),size:data.buffer.byteLength,arrayBuffer:async()=>data.buffer};
   result=await analyzeArchive(input);
  }else{
   result=await fetchPublicRepo(data.url);
  }
  self.postMessage({id:data.id,ok:true,result,elapsedMs:Math.round(performance.now()-started)});
 }catch(error){
  self.postMessage({id:data.id,ok:false,error:error instanceof Error?error.message:"De controle kon niet worden afgerond."});
 }
});
