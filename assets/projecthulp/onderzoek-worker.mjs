// Twee echte, afgebakende browserwerkers. Geen opslag, uploads of code-uitvoering.
import {analyzeArchive,fetchPublicRepo} from "./analyse.mjs";
import {analyzeSingleFile,SINGLE_FILE_LIMIT} from "./los-bestand.mjs";
self.addEventListener("message",async(event)=>{
 const data=event.data;
 if(!data||!Number.isSafeInteger(data.id)||!["zip","github","file"].includes(data.kind))return;
 const started=performance.now();
 try{
  let result;
  if(data.kind==="zip"){
   if(!(data.buffer instanceof ArrayBuffer)||data.buffer.byteLength>16*1024*1024)
    throw new Error("Dit ZIP-bestand is te groot.");
   const input={name:String(data.name||"project.zip"),size:data.buffer.byteLength,arrayBuffer:async()=>data.buffer};
   result=await analyzeArchive(input);
  }else if(data.kind==="file"){
   if(!(data.buffer instanceof ArrayBuffer)||data.buffer.byteLength>SINGLE_FILE_LIMIT)
    throw new Error("Dit losse bestand is te groot.");
   result=await analyzeSingleFile({name:String(data.name||""),size:data.buffer.byteLength,arrayBuffer:async()=>data.buffer});
  }else{
   result=await fetchPublicRepo(data.url);
  }
  self.postMessage({id:data.id,ok:true,result,elapsedMs:Math.round(performance.now()-started)});
 }catch(error){
  self.postMessage({id:data.id,ok:false,error:error instanceof Error?error.message:"De controle kon niet worden afgerond."});
 }
});
