import { PhononTTS } from 'phonon-tts';
import { speechSegments, speech } from './script.mjs';

const $ = id => document.getElementById(id);
const source = 'https://huggingface.co/ldenoue/phonon-40m-multilingual/resolve/main/';
const voiceBase = 'https://huggingface.co/gradium/phonon-voices/resolve/main/voices/';
const model = {
  weights: {q8: source + 'model.q8.gguf'},
  config: source + 'config.json',
  tokenizer: source + 'tokenizer.json',
  voices: {
    helene: voiceBase + 'Vvakv7iWZCUrBooR.safetensors',
    lucien: voiceBase + 'LIv4NaG8ay4Mhqtd.safetensors',
    noemie: voiceBase + 'FXxJ9mANRq6BCTX5.safetensors'
  },
  defaultVoice: 'helene'
};
const samples = speechSegments(speech).filter(text => text.length >= 30);
let sampleIndex = 0;
let tts = null;
let busy = false;
let controller = null;
let context = null;
let nodes = [];
let playbackId = 0;
let glowTimer = null;
const status = msg => { $('status').textContent = msg; };
function pulse() {
  $('sample').classList.remove('arriving');
  void $('sample').offsetWidth;
  $('sample').classList.add('arriving');
  if (glowTimer) clearTimeout(glowTimer);
  glowTimer = setTimeout(() => $('sample').classList.remove('arriving'), 850);
}
function showFrench() {
  $('visibleFrench').textContent = $('frenchText').value.trim() || '…';
  pulse();
}
$('frenchText').addEventListener('input', showFrench);
$('another').addEventListener('click', () => {
  sampleIndex = (sampleIndex + 1) % samples.length;
  $('frenchText').value = samples[sampleIndex];
  showFrench();
});
async function stopAudio() {
  playbackId++;
  controller?.abort();
  controller = null;
  const ctx = context;
  context = null;
  for (const node of nodes) { try { node.stop(); } catch {} }
  nodes = [];
  if (ctx) { try { await ctx.close(); } catch {} }
  $('listen').disabled = !tts || busy;
}
$('stop').addEventListener('click', () => { void stopAudio(); status('Geluid gestopt.'); });
$('load').addEventListener('click', async () => {
  if (busy || tts) { if (tts) status('Het model is klaar. Je kunt een Franse stem beluisteren.'); return; }
  busy = true;
  $('load').disabled = true;
  $('listen').disabled = true;
  status('Frans Phonon-model laden. De eerste keer is ongeveer 75 MB…');
  const started = performance.now();
  try {
    tts = await PhononTTS.load({
      model, lang:'fr', quant:'q8', device:'cpu', threads:1,
      onProgress: p => {
        const amount = p.total ? ' · ' + Math.round(100 * p.loaded / p.total) + '%' : '';
        status((p.cached ? 'Uit cache: ' : 'Laden: ') + (p.file || 'model') + amount);
      }
    });
    if (tts.languages && !tts.languages.includes('fr')) throw Error('Het model ondersteunt geen Frans');
    status('Phonon klaar na ' + (Math.round((performance.now() - started)/100)/10).toFixed(1) + ' s. Kies een stem en druk op Beluister Frans.');
    $('load').textContent = 'Model geladen';
    $('listen').disabled = false;
  } catch (e) {
    tts = null;
    status('Model laden mislukt: ' + (e.message || String(e)) + '. Probeer de officiële Phonon-demo of Chrome op de MacBook.');
    $('load').disabled = false;
  } finally { busy = false; }
});
$('listen').addEventListener('click', async () => {
  if (!tts || busy) return;
  await stopAudio();
  const text = $('frenchText').value.trim();
  if (!text) { status('Schrijf eerst een Franse zin.'); return; }
  const sequence = ++playbackId;
  controller = new AbortController();
  const signal = controller.signal;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) { status('Deze browser kan geen audiostream afspelen.'); return; }
  try {
    context = new AudioCtx({sampleRate:tts.sampleRate});
    await context.resume(); // Beluister is een rechtstreekse tik, ook in iOS Safari.
    const ctx = context;
    const started = performance.now();
    let nextTime = ctx.currentTime + .08;
    let count = 0;
    $('listen').disabled = true;
    status('Franse spraak wordt nu live gemaakt…');
    const stream = tts.stream(text, {voice:$('voice').value,signal});
    for await (const pcm of stream) {
      if (signal.aborted || playbackId !== sequence || ctx.state === 'closed') return;
      if (count === 0) status('Eerste audiodeel na ' + Math.round(performance.now()-started) + ' ms. Stem speelt.');
      const buffer = ctx.createBuffer(1,pcm.length,tts.sampleRate);
      buffer.copyToChannel(pcm,0);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(ctx.destination);
      nextTime = Math.max(nextTime,ctx.currentTime + .04);
      node.start(nextTime);
      nextTime += buffer.duration;
      nodes.push(node);
      node.onended = () => { const index=nodes.indexOf(node); if(index>=0) nodes.splice(index,1); };
      count++;
    }
    await stream.done;
    while (!signal.aborted && ctx === context && ctx.state !== 'closed' && ctx.currentTime < nextTime) {
      await new Promise(resolve => setTimeout(resolve,70));
    }
    if (!signal.aborted && playbackId === sequence) status('Klaar. ' + count + ' live gemaakte audiostukken. Probeer eventueel een andere stem.');
  } catch(e) {
    if (!signal.aborted) status('Spraak mislukt: ' + (e.message || String(e)));
  } finally {
    if (playbackId === sequence) {
      controller = null;
      $('listen').disabled = false;
    }
  }
});
window.addEventListener('pagehide', () => { void stopAudio(); });
showFrench();
