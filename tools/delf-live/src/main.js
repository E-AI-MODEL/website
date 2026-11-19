import { PhononTTS } from 'phonon-tts';
import { opening, reply, closing as closingScript, interrupt, handback, speech, speechSegments, modelFiles, stageAdvance, replyPauseMs } from './script.mjs';

const $ = id => document.getElementById(id);
const stage = $('stage');
$('speechText').value = speech;
$('openingText').value = opening;
$('replyText').textContent = reply;
$('closingText').value = closingScript;
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
let preparedFrenchContext = null;
let errors = [];
let replyMic = null;
let replyStartedAt = 0;
let replyHeard = false;
let dutchSpeaking = false;
let dutchPulseAt = -Infinity;
let frenchAnalyser = null;
let visualFrame = null;
let smoothedLevel = 0;

// De centrale lijnen reageren tijdens Frans op de audiobuffers.
 // Nederlandse browser-TTS levert geen audiobuffers: dan volgen ze woordgrenzen.
const voiceCanvas = $('voiceVisual');
const voiceContext = voiceCanvas.getContext('2d', { alpha: true });
const voiceSamples = new Float32Array(512);
function voiceLevel() {
  if (paused) return 0;
  if (phase === 'french' && frenchAnalyser && soundContext?.state === 'running') {
    frenchAnalyser.getFloatTimeDomainData(voiceSamples);
    let power = 0;
    for (const sample of voiceSamples) power += sample * sample;
    return Math.min(1, Math.sqrt(power / voiceSamples.length) * 8);
  }
  if (dutchSpeaking && (phase === 'interrupted' || phase === 'handback')) {
    const age = performance.now() - dutchPulseAt;
    return Math.min(.64, .14 + .42 * Math.max(0, 1 - age / 400));
  }
  return 0;
}
function drawVoice() {
  visualFrame = null;
  if (!['interrupted','french','handback'].includes(phase) || !voiceContext) return;
  const box = voiceCanvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(box.width * scale));
  const height = Math.max(1, Math.round(box.height * scale));
  if (voiceCanvas.width !== width || voiceCanvas.height !== height) {
    voiceCanvas.width = width;
    voiceCanvas.height = height;
  }
  const ctx = voiceContext;
  ctx.clearRect(0, 0, width, height);
  const current = voiceLevel();
  smoothedLevel += (current - smoothedLevel) * (current > smoothedLevel ? .23 : .085);
  if (current > .015 || smoothedLevel > .01) {
    const cx = width / 2, cy = height / 2;
    const now = performance.now() / 1100;
    const span = Math.min(width * .38, (66 + 115 * smoothedLevel) * scale);
    for (let i = -6; i <= 6; i++) {
      const lane = i * (2.4 + smoothedLevel * 3.8) * scale;
      const progress = 1 - Math.abs(i) / 8;
      for (const direction of [-1, 1]) {
        const reach = span * (.75 + .25 * progress);
        const sway = Math.sin(now * 1.4 + i * .59) * smoothedLevel * 9 * scale;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.bezierCurveTo(
          cx + direction * reach * .25, cy + lane * .19,
          cx + direction * reach * .66, cy + lane + sway,
          cx + direction * reach, cy + lane * .82
        );
        ctx.lineWidth = Math.max(.65 * scale, .8);
        ctx.strokeStyle = 'rgba(72,105,115,' + (0.13 + smoothedLevel * .36) + ')';
        ctx.stroke();
      }
    }
  }
  visualFrame = requestAnimationFrame(drawVoice);
}
function refreshVoiceVisual() {
  if (visualFrame !== null) {
    cancelAnimationFrame(visualFrame);
    visualFrame = null;
  }
  if (voiceContext) voiceContext.clearRect(0, 0, voiceCanvas.width, voiceCanvas.height);
  smoothedLevel = 0;
  if (['interrupted','french','handback'].includes(phase) && voiceContext) {
    visualFrame = requestAnimationFrame(drawVoice);
  }
}
function stopReplyMic() {
  const active = replyMic;
  replyMic = null;
  if (active) {
    active.onresult = null;
    active.onerror = null;
    active.onend = null;
    try { active.abort(); } catch {}
  }
}
function beginReplyWindow(expectedEpoch) {
  replyStartedAt = performance.now();
  replyHeard = false;
  scheduleAuto(() => {
    if (phase === 'interrupted' && epoch === expectedEpoch) goFrench();
  }, replyPauseMs);
  // De reactie kan de pauze verlengen, maar de AI zegt geen andere zinnen.
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SR) return;
  const instance = new SR();
  replyMic = instance;
  instance.lang = 'nl-NL';
  instance.continuous = false;
  instance.interimResults = true;
  instance.onresult = event => {
    if (phase !== 'interrupted' || epoch !== expectedEpoch || replyMic !== instance) return;
    const heard = Array.from(event.results).some(result => result[0]?.transcript?.trim());
    if (!heard) return;
    replyHeard = true;
    const elapsed = performance.now() - replyStartedAt;
    const remaining = Math.max(0, 12000 - elapsed);
    if (remaining < 300) return;
    const final = Array.from(event.results).some(result => result.isFinal);
    scheduleAuto(() => {
      if (phase === 'interrupted' && epoch === expectedEpoch) goFrench();
    }, Math.min(remaining, final ? 1250 : 2300));
  };
  instance.onerror = () => { stopReplyMic(); };
  instance.onend = () => {
    if (replyMic !== instance) return;
    replyMic = null;
    if (!replyHeard) return;
    const elapsed = performance.now() - replyStartedAt;
    const remaining = Math.max(0, 12000 - elapsed);
    scheduleAuto(() => {
      if (phase === 'interrupted' && epoch === expectedEpoch) goFrench();
    }, Math.min(remaining, 1250));
  };
  try { instance.start(); } catch { stopReplyMic(); }
}

function feedback(id, message, type = '') {
  const el = $(id);
  el.textContent = message;
  el.classList.remove('good', 'bad');
  if (type) el.classList.add(type);
}
let glowTimer = null;
function pulseText() {
  if (glowTimer) clearTimeout(glowTimer);
  stage.classList.remove('text-arriving');
  // Retrigger only after a new sentence, not on every interim update.
  void stage.offsetWidth;
  stage.classList.add('text-arriving');
  glowTimer = setTimeout(() => { stage.classList.remove('text-arriving'); glowTimer = null; }, 850);
}
function blankStage() {
  stage.dataset.display = 'statement';
  const surface = $('displayText');
  surface.classList.remove('caption-layout');
  surface.replaceChildren();
  $('translationMeta').textContent = '';
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
  pulseText();
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
  const currentChanged = current.textContent !== states[1] && Boolean(states[1]);
  [previous, current, draft].forEach((el, index) => {
    const next = states[index];
    if (el.textContent !== next) el.textContent = next;
    el.classList.toggle('empty', !next);
  });
  $('translationMeta').textContent = draftText ? 'TRADUCTION EN DIRECT' : 'NÉERLANDAIS · FRANÇAIS';
  if (currentChanged) pulseText();
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
  if (!open) stopMicrophoneCheck();
  document.body.classList.toggle('panel-visible', open);
  $('panel').classList.toggle('open', open);
  $('panel').setAttribute('aria-hidden', open ? 'false' : 'true');
  const trigger = $('mobileSettings');
  trigger.setAttribute('aria-expanded', String(open));
  trigger.setAttribute('aria-label', open ? 'Instellingen sluiten' : 'Instellingen openen');
  if (open) {
    $('panelClose').focus({preventScroll:true});
  } else if (getComputedStyle(trigger).display !== 'none') {
    trigger.focus({preventScroll:true});
  } else {
    stage.tabIndex = -1;
    stage.focus({preventScroll:true});
  }
}
$('mobileSettings').addEventListener('click', () => panel(!$('panel').classList.contains('open')));
$('panelClose').onclick = () => panel(false);
function setPhase(p, publicLabel) {
  phase = p; epoch++;
  stage.dataset.phase = p;
  refreshVoiceVisual();
  feedback('phaseStatus', `Onderdeel: ${publicLabel}`);
}
function reportError(message) {
  errors.push(message);
  feedback('runtimeStatus', message, 'bad');
  console.error('[DELF]', message);
}

let preparingTranslation = null;
async function prepareTranslation() {
  if (translator) {
    feedback('translationStatus', 'Franse vertaling is geladen.', 'good');
    return true;
  }
  if (preparingTranslation) return preparingTranslation;
  preparingTranslation = (async () => {
    feedback('translationStatus', 'Franse vertaling voorbereiden…');
    const opts = { sourceLanguage: 'nl', targetLanguage: 'fr' };
    if (typeof globalThis.Translator !== 'undefined') {
      try {
        const availability = await Translator.availability(opts);
        if (availability !== 'unavailable') {
          feedback('translationStatus', availability === 'available' ? 'Chrome-vertaling openen…' : 'Chrome-taalpakket downloaden…');
          translator = await Translator.create({ ...opts, monitor(m) {
            m.addEventListener('downloadprogress', e => feedback('translationStatus', 'Chrome-taalpakket ' + Math.floor(e.loaded * 100) + '%'));
          }});
          translator.kind = 'chrome';
          feedback('translationStatus', 'Nederlandse spraak → Franse tekst. Chrome-vertaling klaar.', 'good');
          return true;
        }
      } catch (e) {
        feedback('translationStatus', 'Chrome-vertaling niet beschikbaar (' + (e.message || e) + '). Browsermodel proberen…');
      }
    }
    // De tweede route draait op het toestel via WebAssembly, zonder API-sleutel.
    feedback('translationStatus', 'Browsermodel Nederlands → Frans laden. Eerste keer grotere download; gebruik wifi.');
    try {
      const { createBrowserTranslator } = await import('./translation-fallback.js');
      translator = await createBrowserTranslator(progress => feedback('translationStatus', progress));
      feedback('translationStatus', 'Nederlands → Frans geladen via browsermodel. Probeer een korte zin.', 'good');
      return true;
    } catch (e) {
      translator = null;
      const msg = 'Browservertaling niet geladen: ' + (e.message || e);
      feedback('translationStatus', msg, 'bad');
      reportError(msg);
      return false;
    }
  })();
  try { return await preparingTranslation; } finally { preparingTranslation = null; }
}
$('prepareTranslate').onclick = prepareTranslation;
let microphoneCheck = null;
let microphoneCheckTimer = null;
function stopMicrophoneCheck() {
  if (microphoneCheckTimer) { clearTimeout(microphoneCheckTimer); microphoneCheckTimer = null; }
  const previous = microphoneCheck;
  microphoneCheck = null;
  if (previous) {
    previous.onstart = null;
    previous.onresult = null;
    previous.onend = null;
    previous.onerror = null;
    try { previous.abort(); } catch {}
  }
  $('prepareMic').textContent = 'Nederlandse spraak testen';
}
$('prepareMic').onclick = () => {
  if (microphoneCheck) {
    stopMicrophoneCheck();
    feedback('microphoneStatus','Test gestopt.','');
    return;
  }
  if (phase !== 'intro') {
    feedback('microphoneStatus','Stop eerst de voorstelling. Daarna kun je de microfoon testen.','bad');
    return;
  }
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SR) {
    feedback('microphoneStatus','Deze browser heeft geen ondersteunde spraakherkenning. Toestemming voor de microfoon alleen is niet genoeg.','bad');
    return;
  }
  const instance = new SR();
  microphoneCheck = instance;
  let heard = false;
  instance.lang = 'nl-NL';
  instance.continuous = false;
  instance.interimResults = true;
  instance.onstart = () => {
    if (microphoneCheck !== instance) return;
    $('prepareMic').textContent = 'Stop spraaktest';
    feedback('microphoneStatus','Luistert naar Nederlands… Spreek een korte zin uit.');
  };
  instance.onresult = event => {
    if (microphoneCheck !== instance) return;
    const words = Array.from(event.results).map(result => result[0]?.transcript || '').join(' ').trim();
    if (!words) return;
    heard = true;
    const final = Array.from(event.results).every(result => result.isFinal);
    feedback('microphoneStatus', (final ? 'Herkend Nederlands: ' : 'Herkenning bezig: ') + words, final ? 'good' : '');
  };
  instance.onerror = event => {
    if (microphoneCheck !== instance) return;
    const msg = event.error || 'onbekende fout';
    feedback('microphoneStatus','Spraakherkenning mislukt ('+ msg +'). De toestemmingspop-up bewijst alleen toegang tot de microfoon.','bad');
    stopMicrophoneCheck();
  };
  instance.onend = () => {
    if (microphoneCheck !== instance) return;
    stopMicrophoneCheck();
    if (!heard) feedback('microphoneStatus','De microfoon is gestopt, maar er zijn geen woorden herkend. Probeer het opnieuw.','bad');
  };
  try {
    instance.start();
    $('prepareMic').textContent = 'Stop spraaktest';
    feedback('microphoneStatus','Toegang en spraakherkenning starten…');
    microphoneCheckTimer = setTimeout(() => {
      if (microphoneCheck !== instance) return;
      stopMicrophoneCheck();
      if (!heard) feedback('microphoneStatus','Geen Nederlandse woorden ontvangen binnen 12 seconden.','bad');
    },12000);
  } catch (error) {
    stopMicrophoneCheck();
    feedback('microphoneStatus','Kon de spraaktest niet starten: ' + error.message,'bad');
  }
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
// Publieke Phonon-variant voor de proef: echt TTS, geen browser-systeemstem.
$('loadPublicFrench').onclick = async () => {
  if (phase !== 'intro') {
    feedback('frenchStatus','Laad de stem vóór de uitvoering. Gebruik 0 om opnieuw te beginnen.','bad');
    return;
  }
  const button = $('loadPublicFrench');
  button.disabled = true;
  feedback('frenchStatus','Frans Phonon-model laden. Eerste keer ongeveer 75 MB; gebruik wifi.');
  const source = 'https://huggingface.co/ldenoue/phonon-40m-multilingual/resolve/main/';
  const voice = 'https://huggingface.co/gradium/phonon-voices/resolve/main/voices/';
  const model = {
    weights:{q8:source+'model.q8.gguf'},
    config:source+'config.json',
    tokenizer:source+'tokenizer.json',
    voices:{helene:voice+'Vvakv7iWZCUrBooR.safetensors'},
    defaultVoice:'helene'
  };
  try {
    if (french) { await french.dispose(); french = null; }
    const started = performance.now();
    french = await PhononTTS.load({
      model,lang:'fr',quant:'q8',device:'auto',threads:1,
      onProgress: progress => {
        const pct = progress.total ? ' ' + Math.round(progress.loaded / progress.total * 100) + '%' : '';
        feedback('frenchStatus','Model laden · '+(progress.file || 'Phonon')+pct);
      }
    });
    const elapsed = Math.round((performance.now()-started)/1000);
    feedback('frenchStatus','Franse Phonon-stem klaar na '+elapsed+' s. Druk op Franse stem beluisteren.','good');
    feedback('latencyStatus','Franse stem geladen. Eerste klank nog niet gemeten.','good');
  } catch (error) {
    french = null;
    feedback('frenchStatus','Franse Phonon-stem niet geladen: '+(error.message || error),'bad');
    reportError('Frans model laden mislukt');
  } finally { button.disabled = false; }
};
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
  dutchSpeaking = false;
  const started = performance.now();
  utterance.onstart = () => {
    dutchSpeaking = true;
    dutchPulseAt = performance.now();
    feedback('latencyStatus', `Nederlandse stem gestart na ${Math.round(performance.now() - started)} ms`, 'good');
  };
  utterance.onboundary = () => { dutchPulseAt = performance.now(); };
  utterance.onend = () => {
    if (dutchUtterance === utterance) {
      dutchSpeaking = false;
      dutchUtterance = null;
      onEnd?.();
    }
  };
  utterance.onerror = e => { dutchSpeaking = false; reportError(`Nederlandse stem: ${e.error}`); };
  try { speechSynthesis.speak(utterance); return true; } catch(e) { reportError(`Nederlandse stem: ${e.message}`); return false; }
}
$('previewDutch').onclick = () => { speakDutch('Goedenavond. Mag ik je even onderbreken?'); };

function scheduleAuto(callback, durationMs) {
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
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
function releasePreparedAudio() {
  const ctx = preparedFrenchContext;
  preparedFrenchContext = null;
  if (ctx) void ctx.close().catch(() => {});
}
function prewarmFrenchAudio() {
  if (!french) return;
  try {
    releasePreparedAudio();
    const ctx = new AudioContext({sampleRate:french.sampleRate});
    preparedFrenchContext = ctx;
    // Deze functie wordt direct door de tik op Overname of toets → aangeroepen.
    void ctx.resume().catch(e => reportError('Franse audio voorbereiden: ' + e.message));
  } catch(e) {
    reportError('Franse audio kon niet worden voorbereid: ' + e.message);
  }
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
  dutchSpeaking = false;
  frenchAnalyser = null;
  stopReplyMic();
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
  feedback('phaseStatus', paused ? 'Gepauzeerd · spatie om door te gaan' : 'Hervat');
}
function followAudioClock(ctx, controller) {
  if (cueTimer) clearInterval(cueTimer);
  cueTimer = setInterval(() => {
    if (controller.signal.aborted || soundContext !== ctx) { clearInterval(cueTimer); cueTimer = null; return; }
    while (captionCues.length && ctx.currentTime + 0.025 >= captionCues[0].at) {
      captionCues.shift(); // Stem blijft hoorbaar, maar geen tekst bij de AI.
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
  soundContext = preparedFrenchContext && preparedFrenchContext.state !== 'closed'
    ? preparedFrenchContext
    : new AudioContext({ sampleRate:french.sampleRate });
  preparedFrenchContext = null;
  const ctx = soundContext;
  await ctx.resume();
  if (ctx.state !== 'running') throw Error('Franse audio is geblokkeerd. Tik eerst op de overnameknop in het menu.');
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = .68;
  analyser.connect(ctx.destination);
  frenchAnalyser = analyser;
  let t = ctx.currentTime + 0.11;
  let totalChunks = 0;
  const segments = speechSegments(speech); // Vaste, goedgekeurde Franse speech
  const started = performance.now();
  followAudioClock(ctx, controller);
  blankStage();
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
        node.connect(analyser);
        t = Math.max(t, ctx.currentTime + 0.045);
        if (firstChunk) {
          captionCues.push({ at: t });
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
  if (!translator) {
    reportError('Laad eerst de Franse vertaling.');
    panel(true);
    void prepareTranslation().then(ok => {
      if (ok && phase === 'intro') feedback('runtimeStatus','Vertaling klaar. Tik nogmaals op Start ondertiteling om de microfoon te openen.','good');
    });
    return;
  }
  if (stageAdvance(phase, 'start') === null) return;
  stopVoices(); clearLiveState(); closing = false;
  setPhase('live', 'TRADUCTION EN DIRECT');
  renderCaptions();
  if (startMic()) panel(false);
  else { setPhase('intro', 'VOORBEREIDING'); blankStage(); panel(true); }
}
function goInterrupt() {
  if (closing || stageAdvance(phase, 'interrupt') === null) return;
  if (!french) {
    reportError('Laad eerst de Franse stem. De overname is nog niet klaar.');
    feedback('frenchStatus','Frans stemmodel niet geladen. De overname start niet.','bad');
    panel(true);
    return;
  }
  if (!selectedDutchVoice) {
    reportError('Selecteer eerst een Nederlandse stem.');
    panel(true);
    return;
  }
  stopMic(); stopVoices();
  prewarmFrenchAudio();
  setPhase('interrupted', 'UN INSTANT…');
  blankStage();
  const now = epoch;
  const started = speakDutch(interrupt, () => {
    // Een eigen reactie is welkom. Daarna volgt altijd de goedgekeurde Franse speech.
    beginReplyWindow(now);
  });
  if (!started) { releasePreparedAudio(); reportError('De onderbreking kon niet starten.'); }
  panel(false);
}
function goFrench() {
  if (!french) { reportError('Laad eerst het Franse Phonon-model.'); return; }
  if (stageAdvance(phase, 'french') === null) return;
  stopMic(); stopVoices(); firstAudioMs = null;
  setPhase('french', 'DISCOURS EN FRANÇAIS');
  panel(false);
  void streamFrench().catch(error => {
    reportError('Franse audio kon niet starten: ' + (error.message || error));
    panel(true);
  });
}
function goHandback() {
  if (!selectedDutchVoice) { reportError('Nederlandse teruggavestem ontbreekt.'); return; }
  if (stageAdvance(phase, 'handback') === null) return;
  stopVoices();
  setPhase('handback', 'À VOUS');
  blankStage();
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
  releasePreparedAudio();
  stopMic(); stopVoices(); clearLiveState(); closing = false;
  setPhase('intro', 'CÉRÉMONIE');
  blankStage();
  panel(false);
}
function panic() {
  releasePreparedAudio();
  stopMic(); stopVoices(); previewSequence++;
  setPhase('stopped', 'PAUSE');
  blankStage();
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
  if (event.key === 'Escape') { event.preventDefault(); panel(!$('panel').classList.contains('open')); return; }
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
  if (event.code === 'ArrowRight') {
    event.preventDefault();
    if (phase === 'live' && !closing) goInterrupt();
    return;
  }
  if (event.code === 'Space') { event.preventDefault(); togglePause(); return; }
  const map = {'1':goStart,'2':goInterrupt,'3':goFrench,'4':goHandback,'5':goFinish,'0':goReset,'x':panic,'X':panic,'f':$('fullscreen').onclick,'F':$('fullscreen').onclick};
  if (map[event.key]) { event.preventDefault(); map[event.key](); }
});
