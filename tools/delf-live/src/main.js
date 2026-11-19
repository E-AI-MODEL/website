import { PhononTTS } from 'phonon-tts';
import { interrupt, handback, speech, speechSegments, modelFiles, stageAdvance, replyPauseMs } from './script.mjs';

const $ = id => document.getElementById(id);
const stage = $('stage');
const controls = $('stageControls');
let controlHideTimer = null;
function hideControls() {
  if (controlHideTimer) clearTimeout(controlHideTimer);
  controlHideTimer = null;
  controls.classList.remove('visible');
  if (controls.contains(document.activeElement)) document.activeElement.blur();
}
function revealControls() {
  if ($('panel').classList.contains('open')) return;
  controls.classList.add('visible');
  if (controlHideTimer) clearTimeout(controlHideTimer);
  controlHideTimer = setTimeout(() => {
    if (!controls.matches(':focus-within')) hideControls();
  }, 2800);
}
document.addEventListener('pointermove', revealControls, { passive: true });
document.addEventListener('pointerdown', revealControls, { passive: true });
document.addEventListener('touchstart', revealControls, { passive: true });
controls.addEventListener('focusin', revealControls);
function refreshQuickControls() {
  $('quickStart').hidden = phase !== 'intro';
  $('quickTakeover').hidden = phase !== 'live' || closing;
  $('quickPause').hidden = !['interrupted','french','handback'].includes(phase);
  $('quickPause').setAttribute('aria-label', paused ? 'Hervat de stem' : 'Pauzeer de stem');
  $('quickPause').querySelector('path').setAttribute('d', paused ? 'M8 5.7 18 12 8 18.3Z' : 'M9 5v14M15 5v14');
}
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
let finalInFlight = 0;
let draftText = '';
let latestInterim = '';
let previewInFlight = false;
let previewSequence = 0;
let closing = false;
let autoTimer = null;
let autoCallback = null;
let autoDeadline = 0;
let autoRemainingMs = 0;
let paused = false;
let captionCues = [];
let cueTimer = null;
let selectedDutchVoice = null;
let french = null;
let modelUrls = [];
let speechAbort = null;
let soundContext = null;
let playingNodes = [];
let dutchUtterance = null;
let firstAudioMs = null;
let errors = [];

function feedback(id, message, type = '') {
  const el = $(id);
  el.textContent = message;
  el.classList.remove('good', 'bad');
  if (type) el.classList.add(type);
}
function screen(text, meta = '') {
  stage.dataset.display = 'statement';
  const parent = $('displayText');
  parent.classList.remove('caption-layout');
  parent.replaceChildren();
  const item = document.createElement('span');
  item.className = 'statement';
  item.textContent = String(text);
  parent.append(item);
  $('translationMeta').textContent = meta;
}
function splitFrenchCaption(value) {
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (text.length <= 92) return text ? [text] : [];
  const words = text.split(' ');
  const lines = [];
  let part = '';
  for (const word of words) {
    if (part && (part.length + word.length > 88)) {
      lines.push(part);
      part = word;
    } else part = part ? part + ' ' + word : word;
  }
  if (part) lines.push(part);
  return lines;
}
function renderCaptions() {
  if (phase !== 'live') return;
  stage.dataset.display = 'captions';
  const parent = $('displayText');
  if (!parent.classList.contains('caption-layout')) {
    parent.replaceChildren();
    parent.classList.add('caption-layout');
    for (const cls of ['caption-previous', 'caption-current', 'caption-draft']) {
      const row = document.createElement('div');
      row.className = 'caption-row ' + cls;
      parent.append(row);
    }
  }
  const lines = finalTranslations.slice(-2);
  const [previous, current, draft] = parent.children;
  const states = [lines.length > 1 ? lines[0] : '', lines.at(-1) || '', draftText];
  [previous, current, draft].forEach((el, index) => {
    const next = states[index];
    if (el.textContent !== next) el.textContent = next;
    el.classList.toggle('empty', !next);
  });
  $('translationMeta').textContent = draftText ? 'TRADUCTION EN DIRECT' : 'NÉERLANDAIS · FRANÇAIS';
}
function clearLiveState() {
  finalTranslations = [];
  finalInFlight = 0;
  draftText = '';
  latestInterim = '';
  previewSequence++;
  pendingFinal = Promise.resolve();
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = null;
  $('displayText').classList.remove('caption-layout');
}
function panel(open) {
  if (open) hideControls();
  document.body.classList.toggle('panel-visible', open);
  $('panel').classList.toggle('open', open);
  $('panel').setAttribute('aria-hidden', open ? 'false' : 'true');
  if (!open) { stage.tabIndex = -1; stage.focus({preventScroll:true}); }
}
$('panelToggle').onclick = () => panel(true);
$('panelClose').onclick = () => panel(false);
function setPhase(p, publicLabel) {
  phase = p; epoch++;
  stage.dataset.phase = p;
  $('publicStatus').textContent = publicLabel;
  feedback('phaseStatus', `Onderdeel: ${publicLabel}`);
  refreshQuickControls();
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
  latestInterim = '';
  previewSequence++;
  const previous = mic;
  mic = null;
  if (previous) { previous.onend = null; previous.onresult = null; previous.onerror = null; try { previous.abort(); } catch {} }
}
function translateFinal(fragment) {
  const text = fragment.trim();
  if (!text || !translator || phase !== 'live') return;
  const localEpoch = epoch;
  // A finished Dutch fragment always wins over an older interim preview.
  latestInterim = '';
  draftText = '';
  previewSequence++;
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = null;
  finalInFlight++;
  pendingFinal = pendingFinal.catch(() => {}).then(async () => {
    if (phase !== 'live' || epoch !== localEpoch) return;
    try {
      const translated = await translator.translate(text);
      if (phase !== 'live' || epoch !== localEpoch) return;
      finalTranslations.push(...splitFrenchCaption(translated));
      finalTranslations = finalTranslations.slice(-2);
      renderCaptions();
      feedback('runtimeStatus', `Herkend: ${text}`, 'good');
    } catch (e) { reportError(`Vertaling mislukt: ${e.message}`); }
  }).finally(() => { finalInFlight = Math.max(0, finalInFlight - 1); });
}
function translatePreview(fragment) {
  if (!translator || phase !== 'live') return;
  latestInterim = fragment.trim();
  if (latestInterim.split(/\s+/).length < 3) return;
  if (previewTimer || previewInFlight || finalInFlight) return;
  const localEpoch = epoch;
  previewTimer = setTimeout(async () => {
    previewTimer = null;
    if (phase !== 'live' || epoch !== localEpoch || previewInFlight || finalInFlight) return;
    const snapshot = latestInterim;
    const sequence = ++previewSequence;
    previewInFlight = true;
    try {
      const translated = await translator.translate(snapshot);
      if (phase === 'live' && epoch === localEpoch && sequence === previewSequence && !finalInFlight && snapshot === latestInterim) {
        draftText = splitFrenchCaption(translated).at(-1) || '';
        renderCaptions();
      }
    } catch { /* Alleen echte vertalingen verschijnen. */ }
    finally {
      previewInFlight = false;
      if (phase === 'live' && epoch === localEpoch && latestInterim !== snapshot && !finalInFlight) translatePreview(latestInterim);
    }
  }, 180);
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

// Listen to the real French model before the ceremony, without saving audio.
$('previewFrench').onclick = async () => {
  if (!french) { feedback('frenchStatus', 'Laad eerst het Franse model.', 'bad'); return; }
  if (phase !== 'intro') { feedback('frenchStatus', 'De Franse stem kun je vóór de toespraak beluisteren.', 'bad'); return; }
  stopVoices();
  speechAbort = new AbortController();
  const controller = speechAbort;
  const ctx = new AudioContext({ sampleRate: french.sampleRate });
  soundContext = ctx;
  await ctx.resume();
  let playTime = ctx.currentTime + .08;
  const started = performance.now();
  try {
    const sample = french.stream('Chers élèves, félicitations pour votre diplôme. Ce soir, nous célébrons votre réussite.', { signal: controller.signal });
    let pieces = 0;
    for await (const pcm of sample) {
      if (controller.signal.aborted || ctx.state === 'closed') return;
      if (pieces === 0) feedback('latencyStatus', `Franse stem: eerste klank na ${Math.round(performance.now() - started)} ms`, 'good');
      const buffer = ctx.createBuffer(1, pcm.length, french.sampleRate);
      buffer.copyToChannel(pcm, 0);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(ctx.destination);
      playTime = Math.max(playTime, ctx.currentTime + .03);
      node.start(playTime);
      playTime += buffer.duration;
      playingNodes.push(node);
      node.onended = () => { const index = playingNodes.indexOf(node); if (index !== -1) playingNodes.splice(index, 1); };
      pieces++;
    }
    await sample.done;
    await waitForPlayback(ctx, controller, playTime);
    if (!controller.signal.aborted) feedback('frenchStatus', 'Franse stem beluisterd. Beoordeel accent en intonatie.', 'good');
  } catch (e) { if (!controller.signal.aborted) reportError(`Franse stemproef: ${e.message || e}`); }
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

function scheduleAuto(callback, durationMs) {
  autoCallback = callback;
  autoRemainingMs = durationMs;
  resumeAuto();
}
function resumeAuto() {
  if (paused || !autoCallback || autoTimer) return;
  autoDeadline = performance.now() + autoRemainingMs;
  autoTimer = setTimeout(() => {
    autoTimer = null;
    const callback = autoCallback;
    autoCallback = null;
    autoRemainingMs = 0;
    callback?.();
  }, autoRemainingMs);
}
function pauseAuto() {
  if (!autoTimer) return;
  clearTimeout(autoTimer);
  autoTimer = null;
  autoRemainingMs = Math.max(0, autoDeadline - performance.now());
}
function stopVoices() {
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  autoCallback = null;
  autoRemainingMs = 0;
  if (cueTimer) { clearInterval(cueTimer); cueTimer = null; }
  captionCues = [];
  paused = false;
  if (speechAbort) { speechAbort.abort(); speechAbort = null; }
  if (soundContext) { const ctx = soundContext; soundContext = null; void ctx.close().catch(() => {}); }
  playingNodes.forEach(n => { try { n.stop(); } catch {} });
  playingNodes = [];
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  dutchUtterance = null;
}
function togglePause() {
  if (!['interrupted', 'french', 'handback'].includes(phase)) return;
  paused = !paused;
  if (paused) pauseAuto(); else resumeAuto();
  if (phase === 'french' && soundContext) {
    void (paused ? soundContext.suspend() : soundContext.resume()).catch(e => reportError(e.message));
  } else if ('speechSynthesis' in window) {
    if (paused) speechSynthesis.pause(); else speechSynthesis.resume();
  }
  $('publicStatus').textContent = paused ? 'PAUSE' : (phase === 'french' ? 'DISCOURS EN FRANÇAIS' : 'UN INSTANT…');
  feedback('phaseStatus', paused ? 'Gepauzeerd · spatie om door te gaan' : 'Hervat');
  refreshQuickControls();
}
function followAudioClock(ctx, controller) {
  if (cueTimer) clearInterval(cueTimer);
  cueTimer = setInterval(() => {
    if (controller.signal.aborted || soundContext !== ctx) { clearInterval(cueTimer); cueTimer = null; return; }
    while (captionCues.length && ctx.currentTime + 0.025 >= captionCues[0].at) {
      screen(captionCues.shift().text, 'DELF SCOLAIRE · DISCOURS EN FRANÇAIS');
    }
  }, 35);
}
function waitForPlayback(ctx, controller, targetTime) {
  return new Promise(resolve => {
    const check = () => {
      if (controller.signal.aborted || soundContext !== ctx || ctx.state === 'closed' || ctx.currentTime >= targetTime) return resolve();
      setTimeout(check, 45);
    };
    check();
  });
}
async function streamFrench() {
  if (!french) { reportError('De Franse stem is niet geladen. Er wordt geen andere stem gebruikt.'); return; }
  speechAbort = new AbortController();
  const controller = speechAbort;
  soundContext = new AudioContext({ sampleRate: french.sampleRate });
  const ctx = soundContext;
  await ctx.resume();
  let t = ctx.currentTime + 0.11;
  let totalChunks = 0;
  const segments = speechSegments($('speechText').value);
  const started = performance.now();
  followAudioClock(ctx, controller);
  screen('À vous maintenant, chers diplômés.', 'DELF SCOLAIRE');
  try {
    for (const line of segments) {
      if (controller.signal.aborted || phase !== 'french') return;
      const stream = french.stream(line, { signal: controller.signal });
      let firstChunk = true;
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
        t = Math.max(t, ctx.currentTime + 0.045);
        if (firstChunk) {
          captionCues.push({ at: t, text: line });
          firstChunk = false;
        }
        node.start(t);
        t += buffer.duration;
        playingNodes.push(node);
        node.onended = () => { const index = playingNodes.indexOf(node); if (index !== -1) playingNodes.splice(index, 1); };
        totalChunks++;
      }
      t += 0.24;
      await stream.done;
    }
    feedback('runtimeStatus', `Franse speech loopt. ${totalChunks} live audiostukken.`, 'good');
    await waitForPlayback(ctx, controller, t);
    if (!controller.signal.aborted && phase === 'french') goHandback();
  } catch (e) { if (!controller.signal.aborted) reportError(`Franse stem onderbroken: ${e.message || e}`); }
}
function goStart() {
  if (!translator) { reportError('Start eerst het vertaalmodel. Geen voorbereid Frans als vervanging.'); return; }
  if (stageAdvance(phase, 'start') === null) return;
  stopVoices(); clearLiveState(); closing = false;
  setPhase('live', 'TRADUCTION EN DIRECT');
  renderCaptions();
  startMic();
  panel(false);
}
function goInterrupt() {
  if (closing || stageAdvance(phase, 'interrupt') === null) return;
  if (!french) { reportError('Laad eerst de Franse stem. De onderbreking begint pas als de overname klaarstaat.'); return; }
  if (!selectedDutchVoice) { reportError('Selecteer eerst een Nederlandse stem.'); return; }
  stopMic(); stopVoices();
  setPhase('interrupted', 'UN INSTANT…');
  screen('Un instant, s’il vous plaît.', '');
  const now = epoch;
  const started = speakDutch(interrupt, () => {
    // One key triggers the complete takeover, including a brief reply opportunity.
    scheduleAuto(() => {
      if (phase === 'interrupted' && epoch === now) goFrench();
    }, replyPauseMs);
  });
  if (!started) reportError('De onderbreking kon niet starten.');
  panel(false);
}
function goFrench() {
  if (!french) { reportError('Laad eerst het Franse Phonon-model.'); return; }
  if (stageAdvance(phase, 'french') === null) return;
  stopMic(); stopVoices(); firstAudioMs = null;
  setPhase('french', 'DISCOURS EN FRANÇAIS');
  panel(false);
  void streamFrench();
}
function goHandback() {
  if (!selectedDutchVoice) { reportError('Nederlandse teruggavestem ontbreekt.'); return; }
  if (stageAdvance(phase, 'handback') === null) return;
  stopVoices();
  setPhase('handback', 'À VOUS');
  screen('Merci. À vous de conclure.', '');
  const now = epoch;
  speakDutch(handback, () => {
    if (phase === 'handback' && epoch === now) goFinish();
  });
  panel(false);
}
function goFinish() {
  if (!translator) { reportError('Vertaalmodel ontbreekt.'); return; }
  if (stageAdvance(phase, 'finish') === null) return;
  stopVoices(); clearLiveState(); closing = true;
  setPhase('live', 'TRADUCTION EN DIRECT');
  renderCaptions();
  startMic();
  panel(false);
}
function goReset() {
  stopMic(); stopVoices(); clearLiveState(); closing = false;
  setPhase('intro', 'CÉRÉMONIE');
  screen('Une langue de plus.\nUn monde de plus.', 'Ce soir, nous célébrons votre réussite');
  panel(false);
}
function panic() {
  stopMic(); stopVoices(); previewSequence++;
  setPhase('stopped', 'PAUSE');
  feedback('runtimeStatus', 'Alles gestopt. Toets 0 om opnieuw te beginnen.', 'bad');
}
// Aanraakbediening gebruikt exact dezelfde functies als het toetsenbord.
$('quickStart').onclick = () => { goStart(); hideControls(); };
$('quickTakeover').onclick = () => { goInterrupt(); hideControls(); };
$('quickPause').onclick = () => { togglePause(); $('quickPause').blur(); revealControls(); };
$('quickSettings').onclick = () => panel(true);
refreshQuickControls();
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
  if (event.key === 'Escape') { event.preventDefault(); panel(!$('panel').classList.contains('open')); return; }
  if (event.code === 'ArrowRight') {
    event.preventDefault();
    if (phase === 'live' && !closing) goInterrupt();
    return;
  }
  if (event.code === 'Space') { event.preventDefault(); togglePause(); return; }
  const map = {'1':goStart,'2':goInterrupt,'3':goFrench,'4':goHandback,'5':goFinish,'0':goReset,'x':panic,'X':panic,'f':$('fullscreen').onclick,'F':$('fullscreen').onclick};
  if (map[event.key]) { event.preventDefault(); map[event.key](); }
});
