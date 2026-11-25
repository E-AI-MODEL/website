export function modelFiles(files){
 const arr=Array.from(files||[]);
 const locate=(name)=>arr.find(f=>f.name===name);
 const weights=locate('model.q8.gguf'),config=locate('config.json'),tokenizer=locate('tokenizer.json');
 const voice=locate('default-voice.safetensors')||arr.find(f=>/\.safetensors$/i.test(f.name)&&f.name!=='model.safetensors');
 const missing=[['model.q8.gguf',weights],['config.json',config],['tokenizer.json',tokenizer],['default-voice.safetensors of een stem uit voices/',voice]].filter(x=>!x[1]).map(x=>x[0]);
 return {weights,config,tokenizer,voice,missing};
}

export function createPhononVoice({status=()=>{},onReady=()=>{},latency=()=>{}}={}){
  let model=null,urls=[],audio=null,controller=null,loading=false;
  const release=()=>{for(const url of urls)URL.revokeObjectURL(url);urls=[];};
  function stop(){controller?.abort();controller=null;const ctx=audio;audio=null;if(ctx)void ctx.close().catch(()=>{});}
  async function load(config){
    if(loading)return;loading=true;stop();
    try{if(model)await model.dispose();model=null;status('Franse Phonon-stem laden…');
      const {PhononTTS}=await import('phonon-tts');model=await PhononTTS.load({model:config,lang:'fr',quant:'q8',device:'auto',threads:1,onProgress:p=>status('Model laden · '+(p.file||'Phonon')+(p.total?' '+Math.round(p.loaded/p.total*100)+'%':''))});
      status('Franse stem geladen. Beluister de stem.','good');
    }catch(e){model=null;release();status(e.message||String(e),'bad');}finally{loading=false;}
  }
  async function loadPublic(){
    if(loading)return;
    release();
    const base='https://huggingface.co/ldenoue/phonon-40m-multilingual/resolve/main/',voice='https://huggingface.co/gradium/phonon-voices/resolve/main/voices/';
    await load({weights:{q8:base+'model.q8.gguf'},config:base+'config.json',tokenizer:base+'tokenizer.json',voices:{helene:voice+'Vvakv7iWZCUrBooR.safetensors'},defaultVoice:'helene'});
  }
  async function loadFiles(list){
    if(loading)return;
    const files=modelFiles(list);if(files.missing.length){status('Ontbrekende bestanden: '+files.missing.join(', '),'bad');return;}
    release();const url=f=>{const u=URL.createObjectURL(f);urls.push(u);return u;};
    await load({weights:{q8:url(files.weights)},config:url(files.config),tokenizer:url(files.tokenizer),voices:{french:url(files.voice)},defaultVoice:'french'});
  }
  async function speak(text){
    if(!model||loading)throw new Error('Laad eerst de Franse Phonon-stem.');
    stop();const own=new AbortController(),ctx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:model.sampleRate});controller=own;audio=ctx;
    try{await ctx.resume();let at=ctx.currentTime+.08,first=true;const started=performance.now();const stream=model.stream(text,{signal:own.signal});
      for await(const pcm of stream){if(own.signal.aborted)return;if(first){first=false;onReady();latency('Eerste audio na '+Math.round(performance.now()-started)+' ms');}
        const buffer=ctx.createBuffer(1,pcm.length,model.sampleRate);buffer.copyToChannel(pcm,0);const node=ctx.createBufferSource();node.buffer=buffer;node.connect(ctx.destination);at=Math.max(at,ctx.currentTime+.03);node.start(at);at+=buffer.duration;
      }await stream.done;
      while(!own.signal.aborted&&ctx.currentTime<at)await new Promise(resolve=>setTimeout(resolve,100));
      if(!own.signal.aborted)status('Stem afgespeeld.','good');
    }finally{if(controller===own)stop();}
  }
  return {loadPublic,loadFiles,speak,stop};
}
