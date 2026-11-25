// A bounded, cancellable queue for final translations; drafts never overwrite a newer final.
export const LANGUAGES=Object.freeze(['nl-NL','en-US','fr-FR','de-DE','es-ES','pt-PT']);
export function languageCode(value){if(!LANGUAGES.includes(value))throw new Error('Kies een ondersteunde taal.');return value.split('-')[0];}
export function validateTranslationPair(route,source,target){
  const from=languageCode(source),to=languageCode(target);
  if(from===to)throw new Error('Kies twee verschillende talen om te vertalen.');
  if(!['chrome','onnx'].includes(route))throw new Error('Onbekende vertaalroute.');
  if(route==='onnx'&&(from!=='nl'||to!=='fr'))throw new Error('Dit browsermodel ondersteunt alleen Nederlands naar Frans.');
  return {sourceLanguage:from,targetLanguage:to};
}
export function localTranscriptEndpoint(value){
  const url=new URL(value);
  if(!['ws:','wss:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash)throw new Error('De lokale transcriptiebridge moet op deze computer draaien, zonder tokens in de URL.');
  return url.toString();
}
export function captionLines(text,max=88){
  const lines=[];let line='';
  for(const word of String(text).trim().split(/\s+/).filter(Boolean)){if(line&&line.length+word.length+1>max){lines.push(line);line='';}line+=(line?' ':'')+word;}
  if(line)lines.push(line);return lines;
}
export function createFinalQueue({translate,onFinal,onError,maxPending=8}){
  let epoch=0,pending=0,tail=Promise.resolve();
  return {
    add(text){const token=epoch;if(pending>=maxPending){onError(new Error('Vertaling kan de spraak niet bijhouden. Stop en kies een snellere route.'));return false;}
      pending++;tail=tail.then(async()=>{if(token!==epoch)return;const output=await translate(text);if(token===epoch){if(typeof output!=='string'||!output.trim())throw new Error('Geen tekst ontvangen.');onFinal(text,output);}}).catch(error=>{if(token===epoch)onError(error);}).finally(()=>{if(token===epoch)pending--;});return true;},
    stop(){epoch++;pending=0;tail=Promise.resolve();},
    get pending(){return pending;},
    idle(){return tail;}
  };
}
