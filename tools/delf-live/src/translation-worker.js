import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1;

let translator = null;
let initStarted = false;
let lastProgressAt = 0;
self.onmessage = async ({data}) => {
  if (!data) return;
  if (data.type === 'init') {
    if (initStarted) return;
    initStarted = true;
    try {
      translator = await pipeline('translation', 'Xenova/opus-mt-nl-fr', {
        device: 'wasm', dtype: 'q8',
        progress_callback: state => {
          if (!state || !state.status) return;
          const now = performance.now();
          if (now - lastProgressAt < 280 && state.status !== 'done') return;
          lastProgressAt = now;
          const name = String(state.file || '').split('/').pop();
          const pct = Number.isFinite(state.progress) ? ' · ' + Math.round(state.progress) + '%' : '';
          self.postMessage({type:'progress',message:'Nederlands → Frans downloaden' + (name ? ' · ' + name : '') + pct});
        }
      });
      self.postMessage({type:'ready'});
    } catch(e) {
      self.postMessage({type:'fatal',error:e?.message || String(e)});
    }
    return;
  }
  if (data.type === 'translate') {
    if (!translator) {
      self.postMessage({type:'error',id:data.id,error:'Vertaalmodel is niet geladen'});
      return;
    }
    try {
      const result = await translator(String(data.text).slice(0,650), {max_new_tokens:140});
      const text = Array.isArray(result) ? result[0]?.translation_text : result?.translation_text;
      if (typeof text !== 'string' || !text.trim()) throw Error('Geen Franse tekst teruggekregen');
      self.postMessage({type:'result',id:data.id,text});
    } catch(e) {
      self.postMessage({type:'error',id:data.id,error:e?.message || String(e)});
    }
  }
};
