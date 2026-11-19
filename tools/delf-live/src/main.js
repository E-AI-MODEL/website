import { PhononTTS } from 'phonon-tts';
import { interrupt, handback, speech, paragraphs, modelFiles, stageAdvance } from './script.mjs';

const $ = id => document.getElementById(id);
const stage = $('stage');
$('speechText').value = speech;
let phase = 'intro';
let epoch = 0;
let translator = null;
let mic = null;
let wantsMic = false;
let restartTimer = null;
let previewTimer = null;
let finalTranslations = [];
let pendingFinal = Promise.resolve();
let translationId = 0;
let selectedDutchVoice = null;
let french = null;
let modelUrls = [];
let speechAbort = null;
let soundContext = null;
let playingNodes = [];
let dutchUtterance = null;
let firstAudioMs = null;
let stageStarted = 0;
let errors = [];

function feedback(id, message, type = '') {
  const el = $(id);
  el.textContent = message;
  el.classList.remove('good', 'bad');
  if (type) el.classList.add(type);
}
function screen(text, meta = '') {
  const parent = $('displayText');
  parent.replaceChildren();
  String(text).split('\n').forEach((line, i) => {
    if (i) parent.append(document.createElement('br'));
    parent.append(document.createTextNode(line));
  });
  $('translationMeta').textContent = meta;
}
function panel(open) {
  $('panel').classList.toggle('open', open);
  $('panel').setAttribute('aria-hidden', open ? 'false' : 'true');
}
$('panelToggle').onclick = () => panel(true);
$('panelClose').onclick = () => panel(false);
function setPhase(p, publicLabel) {
  phase = p; epoch++;
  stage.dataset.phase = p;
  $('publicStatus').textContent = publicLabel;
  feedback('phaseStatus', `Onderdeel: ${publicLabel}`);
}
function reportError(message) {
  errors.push(message);
  feedback('runtimeStatus', message, 'bad');
  console.error('[DELF]', message);
}

async function prepareTranslation() {
  feedback('translationStatus', 'Franse vertaling controleren…');
  if (typeof globalThis.Translator === 'undefined') {
    feedback('translationStatus', 'Chrome Translator ontbreekt. Zonder deze functie geen echte livevertaling.', 'bad');
    return false;
  }
  try {
    const opts = { sourceLanguage: 'nl', targetLanguage: 'fr' };
    const status = await Translator.availability(opts);
    if (status === 'unavailable') throw Error('Nederlands naar Frans is hier niet beschikbaar');
    feedback('translationStatus', status === 'available' ? 'Taalmodel openen…' : 'Taalpakket downloaden…');
    translator = await Translator.create({ ...opts, monitor(m) {
      m.addEventListener('downloadprogress', e => feedback('translationStatus', `Taalpakket ${Math.floor(e.loaded * 100)}%`));
    }});
    feedback('translationStatus', 'Vertaling gereed', 'good');
    return true;
  } catch (e) { reportError('Vertaalmodel: ' + (e.message || e)); feedback('translationStatus', 'Vertalen niet beschikbaar', 'bad'); return false; }
}
$('prepareTranslate').onclick = prepareTranslation;
$('prepareMic').onclick = async () => {
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SR) { feedback('microphoneStatus', 'Spraakherkenning ontbreekt in deze browser', 'bad'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    feedback('microphoneStatus', 'Microfoon beschikbaar. Gebruik Nederlands.', 'good');
  } catch (e) { feedback('microphoneStatus', 'Microfoon: ' + e.message, 'bad'); }
};

function stopMic() {
  wantsMic = false;
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
  const previous = mic;
  mic = null;
  if (previous) { previous.onend = null; previous.onresult = null; previous.onerror = null; try { previous.abort(); } catch {} }
}
function showTranslation(result, isPreview, localEpoch, id) {
  if (phase !== 'live' || localEpoch !== epoch || id !== translationId) return;
  const recent = [...finalTranslations.slice(-2), result];
  screen(recent.join('\n'), isPreview ? 'Traduction en direct · en cours' : 'Traduction en direct · néerlandais vers français');
}
async function translateFinal(fragment) {
  const text = fragment.trim();
  if (!text || !translator || phase !== 'live') return;
  const localEpoch = epoch;
  const id = ++translationId;
  pendingFinal = pendingFinal.catch(() => {}).then(async () => {
    if (phase !== 'live' || epoch !== localEpoch) return;
    try {
      const translated = await translator.translate(text);
      if (phase !== 'live' || epoch !== localEpoch) return;
      finalTranslations.push(translated);
      finalTranslations = finalTranslations.slice(-3);
      screen(finalTranslations.slice(-3).join('\n'), 'Traduction en direct · néerlandais vers français');
      feedback('runtimeStatus', `Herkend: ${text}`, 'good');
    } catch (e) { reportError(`Vertaling mislukt: ${e.message}`); }
  });
}
function translatePreview(fragment) {
  if (!translator || phase !== 'live' || fragment.split(/\s+/).length < 5) return;
  if (previewTimer) clearTimeout(previewTimer);
  const localEpoch = epoch;
  previewTimer = setTimeout(async () => {
    const id = ++translationId;
    try { const translated = await translator.translate(fragment.trim()); showTranslation(translated, true, localEpoch, id); }
    catch { /* eindresultaat blijft leidend */ }
  }, 550);
}
function startMic() {
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SR) { reportError('Spraakherkenning ontbreekt. Er wordt geen tekst verzonnen.'); return false; }
  stopMic();
  wantsMic = true;
  const instance = new SR();
  mic = instance;
  instance.lang = 'nl-NL';
  instance.continuous = true;
  instance.interimResults = true;
  instance.maxAlternatives = 1;
  instance.onresult = event => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const value = event.results[i];
      if (value.isFinal) translateFinal(value[0].transcript);
      else interim += value[0].transcript;
    }
    if (interim) { feedback('runtimeStatus', `Luistert: ${interim}`); translatePreview(interim); }
  };
  instance.onerror = e => {
    reportError(`Spraakherkenning: ${e.error}`);
    if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) wantsMic = false;
  };
  instance.onend = () => {
    if (!wantsMic || phase !== 'live' || mic !== instance) return;
    restartTimer = setTimeout(() => {
      if (wantsMic && phase === 'live' && mic === instance) {
        try { instance.start(); } catch (e) { reportError('Herstart spraakherkenning: ' + e.message); }
      }
    }, 300);
  };
  try { instance.start(); feedback('runtimeStatus', 'Live vertaling luistert naar Nederlands', 'good'); return true; }
  catch (e) { reportError('Microfoon kon niet beginnen: ' + e.message); wantsMic = false; return false; }
}

function releaseModelUrls() { modelUrls.forEach(url => URL.revokeObjectURL(url)); modelUrls = []; }
const folder = $('modelFolder');
folder.addEventListener('change', () => {
  const files = modelFiles(folder.files);
  feedback('frenchStatus', files.missing.length ? `Checkpointmap mist: ${files.missing.join(', ')}` : 'Franse modelbestanden gevonden. Klik op Franse stem laden.', files.missing.length ? 'bad' : 'good');
});
$('loadFrench').onclick = async () => {
  const files = modelFiles(folder.files);
  if (files.missing.length) { feedback('frenchStatus', `Ontbrekende modelbestanden: ${files.missing.join(', ')}`, 'bad'); return; }
  if (french) { await french.dispose(); french = null; }
  releaseModelUrls();
  const fileUrl = file => { const url = URL.createObjectURL(file); modelUrls.push(url); return url; };
  const model = {
    weights: { q8: fileUrl(files.weights) },
    config: fileUrl(files.config),
    tokenizer: fileUrl(files.tokenizer),
    voices: { french: fileUrl(files.voice) },
    defaultVoice: 'french'
  };
  const started = performance.now();
  feedback('frenchStatus', 'Phonon 40M French laden…');
  try {
    french = await PhononTTS.load({ model, lang: 'fr', quant: 'q8', device: 'auto', threads: 1,
      onProgress: p => feedback('frenchStatus', `${p.file || 'Model'} ${p.total ? Math.round(p.loaded / p.total * 100) + '%' : ''}`)
    });
    const ms = Math.round(performance.now() - started);
    feedback('frenchStatus', `Franse stem gereed in ${ms} ms · ${french.device} · ${french.threads} thread(s)`, 'good');
    feedback('latencyStatus', `Model laden: ${ms} ms. Nog geen spraak gemeten.`, 'good');
  } catch (e) { french = null; releaseModelUrls(); reportError(`Frans model kon niet starten: ${e.message}`); feedback('frenchStatus', 'Model niet geladen', 'bad'); }
};

function populateVoices() {
  const all = speechSynthesis.getVoices().filter(v => /^nl(?:-|$)/i.test(v.lang));
  const current = $('nlVoice').value;
  $('nlVoice').replaceChildren(new Option('Kies zelf een Nederlandse stem', ''));
  all.forEach(v => $('nlVoice').add(new Option(`${v.name} · ${v.lang}${v.localService ? ' · lokaal' : ''}`, v.voiceURI)));
  $('nlVoice').value = all.some(v => v.voiceURI === current) ? current : '';
}
if ('speechSynthesis' in window) {
  populateVoices();
  speechSynthesis.addEventListener?.('voiceschanged', populateVoices);
} else feedback('dutchStatus', 'Deze browser heeft geen spraakvoorziening voor Nederlandse stemmen', 'bad');
$('nlVoice').onchange = () => {
  selectedDutchVoice = speechSynthesis.getVoices().find(v => v.voiceURI === $('nlVoice').value && /^nl(?:-|$)/i.test(v.lang)) || null;
  feedback('dutchStatus', selectedDutchVoice ? `Gekozen: ${selectedDutchVoice.name}. Beluister deze stem vóór gebruik.` : 'Nog geen Nederlandse stem gekozen', selectedDutchVoice ? 'good' : 'bad');
};
function speakDutch(text, onEnd) {
  if (!selectedDutchVoice) { reportError('Kies eerst een Nederlandse stem. Geen automatische standaardstem.'); return false; }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = selectedDutchVoice;
  utterance.lang = 'nl-NL';
  utterance.rate = 0.95;
  utterance.pitch = 1;
  dutchUtterance = utterance;
  const started = performance.now();
  utterance.onstart = () => feedback('latencyStatus', `Nederlandse stem gestart na ${Math.round(performance.now() - started)} ms`, 'good');
  utterance.onend = () => { if (dutchUtterance === utterance) { dutchUtterance = null; onEnd?.(); } };
  utterance.onerror = e => reportError(`Nederlandse stem: ${e.error}`);
  try { speechSynthesis.speak(utterance); return true; } catch(e) { reportError(`Nederlandse stem: ${e.message}`); return false; }
}
$('previewDutch').onclick = () => { speakDutch('Goedenavond. Mag ik je even onderbreken?'); };

function stopVoices() {
  if (speechAbort) { speechAbort.abort(); speechAbort = null; }
  if (soundContext) { const ctx = soundContext; soundContext = null; void ctx.close().catch(() => {}); }
  playingNodes.forEach(n => { try { n.stop(); } catch {} });
  playingNodes = [];
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  dutchUtterance = null;
}
async function streamFrench() {
  if (!french) { reportError('De Franse stem is niet geladen. Er wordt geen andere stem gebruikt.'); return; }
  speechAbort = new AbortController();
  const controller = speechAbort;
  soundContext = new AudioContext({ sampleRate: french.sampleRate });
  const ctx = soundContext;
  await ctx.resume();
  let t = ctx.currentTime + 0.09;
  let totalChunks = 0;
  const paragraphsToSay = paragraphs($('speechText').value);
  const started = performance.now();
  try {
    for (let i = 0; i < paragraphsToSay.length; i++) {
      if (controller.signal.aborted || phase !== 'french') return;
      const line = paragraphsToSay[i];
      screen(line, 'DELF scolaire · Discours en français');
      const stream = french.stream(line, { signal: controller.signal });
      for await (const pcm of stream) {
        if (controller.signal.aborted || ctx.state === 'closed') return;
        if (firstAudioMs === null) {
          firstAudioMs = Math.round(performance.now() - started);
          feedback('latencyStatus', `Eerste Franse audio na ${firstAudioMs} ms · live gegenereerd`, 'good');
        }
        const buffer = ctx.createBuffer(1, pcm.length, french.sampleRate);
        buffer.copyToChannel(pcm, 0);
        const node = ctx.createBufferSource();
        node.buffer = buffer;
        node.connect(ctx.destination);
        t = Math.max(t, ctx.currentTime + 0.04);
        node.start(t);
        t += buffer.duration;
        playingNodes.push(node);
        node.onended = () => { const index = playingNodes.indexOf(node); if (index !== -1) playingNodes.splice(index, 1); };
        totalChunks++;
      }
      // The next paragraph has a deliberate pause, not a synthetic recording.
      t += 0.38;
      await stream.done;
    }
    const waitMs = Math.max(0, Math.ceil((t - ctx.currentTime) * 1000));
    feedback('runtimeStatus', `Franse speech loopt. ${totalChunks} live audiostukken.`, 'good');
    await new Promise(resolve => setTimeout(resolve, waitMs));
    if (!controller.signal.aborted && phase === 'french') goHandback();
  } catch (e) { if (!controller.signal.aborted) reportError(`Franse stem onderbroken: ${e.message || e}`); }
}
function goStart() {
  if (!translator) { reportError('Start eerst het vertaalmodel. Geen voorbereid Frans als vervanging.'); return; }
  if (stageAdvance(phase, 'start') === null) { reportError('Start is in deze fase niet beschikbaar.'); return; }
  stopVoices(); finalTranslations = []; translationId++;
  setPhase('live', 'TRADUCTION EN DIRECT');
  screen('À vous la parole.', 'Traduction en direct · Néerlandais → Français');
  startMic();
  panel(false);
}
function goInterrupt() {
  if (!selectedDutchVoice) { reportError('Selecteer eerst een Nederlandse stem.'); return; }
  if (!stageAdvance(phase, 'interrupt')) return;
  stopMic(); stopVoices();
  setPhase('interrupted', 'UN INSTANT…');
  screen('Un instant, s’il vous plaît.', '');
  speakDutch(interrupt);
  panel(false);
}
function goFrench() {
  if (!french) { reportError('Laad eerst het Franse Phonon-model.'); return; }
  if (!stageAdvance(phase, 'french')) return;
  stopMic(); stopVoices(); firstAudioMs = null;
  setPhase('french', 'DISCOURS EN FRANÇAIS');
  panel(false);
  void streamFrench();
}
function goHandback() {
  if (!selectedDutchVoice) { reportError('Nederlandse teruggavestem ontbreekt.'); return; }
  if (!stageAdvance(phase, 'handback')) return;
  stopVoices();
  setPhase('handback', 'À VOUS');
  screen('Merci. Et maintenant, à vous.', '');
  speakDutch(handback);
  panel(false);
}
function goFinish() {
  if (!translator) { reportError('Vertaalmodel ontbreekt.'); return; }
  if (!stageAdvance(phase, 'finish')) return;
  stopVoices(); finalTranslations = []; translationId++;
  setPhase('live', 'TRADUCTION EN DIRECT');
  screen('Félicitations à tous les diplômés.', 'Traduction en direct · Néerlandais → Français');
  startMic();
  panel(false);
}
function goReset() {
  stopMic(); stopVoices(); translationId++; finalTranslations = [];
  setPhase('intro', 'CÉRÉMONIE');
  screen('Une langue de plus.\nUn monde de plus.', 'Ce soir, nous célébrons votre réussite');
  panel(false);
}
function panic() {
  stopMic(); stopVoices(); translationId++;
  setPhase('stopped', 'PAUSE');
  feedback('runtimeStatus', 'Alles gestopt. Toets 0 om opnieuw te beginnen.', 'bad');
}
const actions = {start:goStart, interrupt:goInterrupt, french:goFrench, handback:goHandback, finish:goFinish, reset:goReset, panic};
for (const [name, fn] of Object.entries(actions)) $(name).onclick = fn;
$('fullscreen').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
$('testTranslate').onclick = async () => {
  if (!translator && !(await prepareTranslation())) return;
  try { screen(await translator.translate($('testDutch').value), 'Testvertaling'); feedback('runtimeStatus', 'Vertaaltest geslaagd', 'good'); }
  catch(e) { reportError('Vertaaltest: ' + e.message); }
};
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
  if (event.key === 'Escape') { panel(!$('panel').classList.contains('open')); return; }
  const map = {'1':goStart,'2':goInterrupt,'3':goFrench,'4':goHandback,'5':goFinish,'0':goReset,'x':panic,'X':panic,'f':$('fullscreen').onclick,'F':$('fullscreen').onclick};
  if (map[event.key]) { event.preventDefault(); map[event.key](); }
});
