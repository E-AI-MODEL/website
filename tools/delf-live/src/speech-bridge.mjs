// Browser audio transport for a self-hosted EAIspeak bridge.
// This is NOT the native Moshi or Hibiki websocket protocol.
// The server must translate between this documented protocol and the selected model.
import {validateSpeechEndpoint,validateBridgePair} from './speech-engines.mjs';

export function floatToPcm16(samples){
  const output=new Int16Array(samples.length);
  for(let i=0;i<samples.length;i++){
    const n=Math.max(-1,Math.min(1,samples[i]));
    output[i]=n<0?Math.round(n*32768):Math.round(n*32767);
  }
  return output;
}
export function pcm16ToFloat(buffer){
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength%2)throw new Error('Ongeldig PCM16-audioblok ontvangen.');
  const pcm=new DataView(buffer),samples=new Float32Array(buffer.byteLength/2);
  for(let i=0;i<samples.length;i++)samples[i]=pcm.getInt16(i*2,true)/32768;
  return samples;
}
export function bridgeHandshake({engine,sourceLanguage,targetLanguage,sampleRate}){
  validateBridgePair(engine,sourceLanguage,targetLanguage);
  if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000)throw new Error('Ongeldige microfoonfrequentie.');
  return {
    type:'start',protocol:'eaispeak-pcm-v1',engine,
    source_language:sourceLanguage,target_language:targetLanguage,
    input:{codec:'pcm_s16le',sample_rate:sampleRate,channels:1},
    output:{codec:'pcm_s16le',sample_rate:24000,channels:1}
  };
}
export function parseBridgeMessage(text){
  let data;
  try{data=JSON.parse(text);}catch{throw new Error('Onleesbaar bridge-bericht.');}
  if(!data||typeof data!=='object'||!['ready','status','transcript','translation','error','end','audio'].includes(data.type))
    throw new Error('Ongeldig bridge-bericht.');
  return data;
}
export async function startSpeechBridge({
  endpoint,engine,sourceLanguage,targetLanguage,signal,onStatus=()=>{},onTranscript=()=>{},
  onTranslation=()=>{},onActivity=()=>{},onEnd=()=>{}
}){
  const target=validateSpeechEndpoint(endpoint);
  validateBridgePair(engine,sourceLanguage,targetLanguage);
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Deze browser kan de microfoon niet openen.');
  if(!window.AudioContext&&!window.webkitAudioContext)throw new Error('Deze browser ondersteunt geen Web Audio.');
  // AudioContext must be opened during the user's button click for Safari/iOS.
  const Context=window.AudioContext||window.webkitAudioContext;
  if(signal?.aborted)throw new Error('Spraaksessie geannuleerd.');
  const context=new Context();
  const resume=context.resume();
  let stream=null,source=null,processor=null,socket=null,ended=false,ready=false;
  let nextAudioAt=0,outputRate=24000;
  let connectionTimeout=null;
  const onAbort=()=>finish('Spraaksessie geannuleerd.');
  signal?.addEventListener('abort',onAbort,{once:true});
  function finish(message){
    if(ended)return;
    ended=true;
    ready=false;
    clearTimeout(connectionTimeout);
    signal?.removeEventListener('abort',onAbort);
    try{processor?.disconnect();source?.disconnect();}catch{}
    for(const track of stream?.getTracks()||[])track.stop();
    try{if(socket&&socket.readyState<2)socket.close(1000,'Stopped');}catch{}
    void context.close().catch(()=>{});
    onActivity('idle');
    onEnd(message);
  }
  function playPCM(buffer){
    if(ended)return;
    const samples=pcm16ToFloat(buffer);
    if(!samples.length)return;
    const chunk=context.createBuffer(1,samples.length,outputRate);
    chunk.copyToChannel(samples,0);
    const player=context.createBufferSource();
    player.buffer=chunk;
    player.connect(context.destination);
    // Avoid running far behind live speech if the server sends too much audio.
    if(nextAudioAt>context.currentTime+2.5)nextAudioAt=context.currentTime+.04;
    nextAudioAt=Math.max(context.currentTime+.04,nextAudioAt);
    player.start(nextAudioAt);
    nextAudioAt+=chunk.duration;
    onActivity('answer');
  }
  try{
    await resume;
    if(ended||signal?.aborted)throw new Error('Gesprek is gestopt.');
    stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
    if(ended||signal?.aborted){
      for(const track of stream.getTracks())track.stop();
      throw new Error('Gesprek is gestopt.');
    }
    source=context.createMediaStreamSource(stream);
    // ScriptProcessor is used as a compatibility fallback for older Safari.
    // A worklet can replace this transport without changing the wire protocol.
    processor=context.createScriptProcessor(2048,1,1);
    processor.onaudioprocess=e=>{
      if(!ready||socket?.readyState!==WebSocket.OPEN)return;
      if(socket.bufferedAmount>256*1024)return; // backpressure: do not build up seconds of audio
      const pcm=floatToPcm16(e.inputBuffer.getChannelData(0));
      socket.send(pcm.buffer);
      e.outputBuffer.getChannelData(0).fill(0);
    };
    source.connect(processor);
    const mute=context.createGain();mute.gain.value=0;
    processor.connect(mute);mute.connect(context.destination);
    socket=new WebSocket(target);socket.binaryType='arraybuffer';
    connectionTimeout=setTimeout(()=>{if(!ready)finish('Spraakserver heeft binnen 25 seconden geen gereedmelding gegeven.');},25000);
    onStatus('Verbinden met de eigen spraakserver…');
    socket.addEventListener('open',()=>{
      if(ended)return;
      socket.send(JSON.stringify(bridgeHandshake({engine,sourceLanguage,targetLanguage,sampleRate:context.sampleRate})));
      onStatus('Model starten op de spraakserver…');
    });
    socket.addEventListener('message',event=>{
      if(ended)return;
      try{
        if(event.data instanceof ArrayBuffer){if(ready)playPCM(event.data);return;}
        if(typeof event.data!=='string')throw new Error('Onbekend audioformaat van de server.');
        const msg=parseBridgeMessage(event.data);
        if(msg.type==='ready'){
          if(msg.protocol!=='eaispeak-pcm-v1')throw new Error('De server ondersteunt dit EAIspeak-protocol niet.');
          if(msg.output_sample_rate!==undefined){
            if(!Number.isInteger(msg.output_sample_rate)||msg.output_sample_rate<8000||msg.output_sample_rate>96000)
              throw new Error('Ongeldige samplefrequentie van de spraakserver.');
            outputRate=msg.output_sample_rate;
          }
          ready=true;clearTimeout(connectionTimeout);
          onStatus('Verbonden. Je kunt praten.');onActivity('listening');
        }else if(msg.type==='status'){onStatus(String(msg.message||'Spraakserver bezig.').slice(0,250));}
        else if(msg.type==='transcript'){onTranscript(String(msg.text||'').slice(0,5000));}
        else if(msg.type==='translation'){onTranslation(String(msg.text||'').slice(0,5000));}
        else if(msg.type==='audio'){
          if(Number.isInteger(msg.sample_rate)&&msg.sample_rate>=8000&&msg.sample_rate<=96000)outputRate=msg.sample_rate;
        }
        else if(msg.type==='error')finish('Spraakserver: '+String(msg.message||'onbekende fout').slice(0,250));
        else if(msg.type==='end')finish('Spraaksessie voltooid.');
      }catch(error){finish('Bridge-protocol: '+String(error?.message||error));}
    });
    socket.addEventListener('error',()=>finish('Kan de spraakserver niet bereiken. Controleer de URL en de installatie.'));
    socket.addEventListener('close',e=>{if(!ended)finish('Spraakverbinding verbroken ('+e.code+').');});
    return {stop:()=>finish('Gesprek gestopt.'),get active(){return !ended;}};
  }catch(error){
    finish('Verbinden mislukt.');
    throw error;
  }
}


/**
 * Probe the real model handshake through the EAIspeak bridge, without ever
 * opening the microphone. A successful probe proves transport readiness,
 * not generation quality or a successful spoken conversation.
 */
export async function probeSpeechBridge({
  endpoint,engine,sourceLanguage,targetLanguage,onStatus=()=>{},
  timeoutMs=20000,WebSocketClass=globalThis.WebSocket
}){
  const url=validateSpeechEndpoint(endpoint);
  validateBridgePair(engine,sourceLanguage,targetLanguage);
  if(typeof WebSocketClass!=='function')throw new Error('Deze browser ondersteunt geen WebSocket.');
  if(!Number.isFinite(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw new Error('Ongeldige verbindingstimeout.');
  return new Promise((resolve,reject)=>{
    let settled=false,socket;
    const timeout=setTimeout(()=>done(new Error('Geen gereedmelding ontvangen. Controleer de server en het gekozen model.')),timeoutMs);
    function done(error,result){
      if(settled)return;
      settled=true;clearTimeout(timeout);
      try{if(socket?.readyState<2)socket.close(1000,'Probe complete');}catch{}
      if(error)reject(error);else resolve(result);
    }
    try{
      socket=new WebSocketClass(url);
      socket.addEventListener('open',()=>{
        if(settled)return;
        const hello=bridgeHandshake({engine,sourceLanguage,targetLanguage,sampleRate:48000});
        hello.type='probe';
        socket.send(JSON.stringify(hello));
        onStatus('Spraakmodel controleren…');
      });
      socket.addEventListener('message',event=>{
        if(settled)return;
        try{
          if(typeof event.data!=='string')throw new Error('Onverwacht binair bericht tijdens controle.');
          const msg=parseBridgeMessage(event.data);
          if(msg.type==='status'){onStatus(String(msg.message||'Modelserver bezig.').slice(0,250));return;}
          if(msg.type==='error')throw new Error('Modelserver: '+String(msg.message||'onbekende fout').slice(0,250));
          if(msg.type==='ready'){
            if(msg.protocol!=='eaispeak-pcm-v1'||msg.probe!==true)throw new Error('De server ondersteunt de veilige EAIspeak-modelcontrole niet.');
            done(null,{engine,sourceLanguage,targetLanguage});
          }else if(msg.type==='end')throw new Error('De modelserver sloot de controle af zonder gereedmelding.');
        }catch(error){done(error);}
      });
      socket.addEventListener('error',()=>done(new Error('Kan de spraakserver niet bereiken. Controleer het adres, HTTPS/WSS en of de server draait.')));
      socket.addEventListener('close',()=>done(new Error('De spraakserver sloot de verbinding voordat het model gereed was.')));
    }catch(error){done(error);}
  });
}
