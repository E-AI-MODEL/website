// EAIspeak voice engines. A listing is not a promise of a running local model.
export const SPEECH_ENGINES=Object.freeze({
  moshi:Object.freeze({
    label:'Moshi · Engels gesprek',kind:'conversation',availability:'bridge-required',
    inputs:['en-US'],outputs:['en-US'],source:'https://github.com/kyutai-labs/moshi',
    detail:'Full-duplex gesprek in het Engels. Eigen Moshi-server en EAIspeak-bridge vereist.'
  }),
  hibiki:Object.freeze({
    label:'Hibiki · Frans naar Engels',kind:'translation',availability:'bridge-required',
    inputs:['fr-FR'],outputs:['en-US'],source:'https://github.com/kyutai-labs/hibiki',
    detail:'Gelijktijdig Frans naar Engels. Eigen Hibiki-server en EAIspeak-bridge vereist.'
  }),
  'hibiki-zero':Object.freeze({
    label:'Hibiki-Zero · vier talen naar Engels',kind:'translation',availability:'bridge-required',
    inputs:['fr-FR','es-ES','pt-PT','de-DE'],outputs:['en-US'],
    source:'https://github.com/kyutai-labs/hibiki-zero',
    detail:'Frans, Spaans, Portugees en Duits naar Engels. Eigen server en EAIspeak-bridge vereist.'
  }),
  dessa:Object.freeze({
    label:'Dessa · onderzoeksversie',kind:'conversation',availability:'unreleased',
    inputs:[],outputs:[],source:'https://block.xyz/dessa',
    detail:'Nog geen openbaar bruikbare API of modelgewichten. Niet te starten.'
  })
});
export function isSpeechEngine(value){return Object.hasOwn(SPEECH_ENGINES,value);}
export function speechEngine(value){return SPEECH_ENGINES[value]||null;}
export function validateSpeechPair(value,inputLanguage,outputLanguage){
  const item=speechEngine(value);
  if(!item)throw new Error('Onbekende spraakengine.');
  if(item.availability==='unreleased')throw new Error('Dessa is nog niet beschikbaar om te starten.');
  if(!item.inputs.includes(inputLanguage)||!item.outputs.includes(outputLanguage)){
    const labels={'nl-NL':'Nederlands','en-US':'Engels','fr-FR':'Frans','es-ES':'Spaans','pt-PT':'Portugees','de-DE':'Duits'};
    throw new Error(item.label+' ondersteunt deze taalrichting niet. Mogelijk: '+item.inputs.map(l=>labels[l]||l).join(', ')+' naar '+item.outputs.map(l=>labels[l]||l).join(', ')+'.');
  }
  return item;
}
export function validateSpeechEndpoint(input){
  let url;
  try{url=new URL(String(input).trim());}catch{throw new Error('Vul een geldig WebSocket-adres in.');}
  if(!['ws:','wss:'].includes(url.protocol))throw new Error('Gebruik een ws:// of wss:// adres.');
  if(url.username||url.password||url.search||url.hash)throw new Error('Geen wachtwoorden of tokens in de URL. Gebruik een afgeschermde bridge.');
  if(url.protocol==='ws:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))
    throw new Error('Onversleuteld WebSocket-verkeer mag alleen via localhost. Gebruik wss:// voor een andere server.');
  return url.toString();
}

export const TRANSCRIPT_LANGUAGES=Object.freeze(['nl-NL','en-US','fr-FR','de-DE','es-ES','pt-PT']);
export function validateBridgePair(engine,source,target){
  if(engine!=='whisper')return validateSpeechPair(engine,source,target);
  if(source!==target||!TRANSCRIPT_LANGUAGES.includes(source))throw new Error('Whisper herkent de brontaal; vertalen gebeurt afzonderlijk.');
  return {kind:'transcription',label:'Lokale Whisper'};
}
