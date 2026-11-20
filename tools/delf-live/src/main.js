import { PhononTTS } from 'phonon-tts';
import { getActiveSession } from './session-store.js';
import { opening, reply, closing as closingScript, interrupt, handback, speech, speechSegments, modelFiles, stageAdvance, replyPauseMs } from './script.mjs';

const $ = id => document.getElementById(id);
const stage = $('stage');
function syncScriptPreview() {
  const selected = getActiveSession();
  $('speechText').value = selected.speech;
  $('openingText').value = selected.opening;
  $('replyText').textContent = selected.reply;
  $('closingText').value = selected.closing;
}
syncScriptPreview();
window.addEventListener('cloud-session-change', syncScriptPreview);
let phase = 'intro';
let epoch = 0;
let translator = null;
let mic = null;
let wantsMic = false;
let restartTimer = null;
let micSilentTimer = null;
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
let reserveSpeechActive = false;
let frenchSegmentIndex = 0;
let frenchSegmentTotal = 0;
let scriptedMode = 'off'; // off | armed | scene1 | reply | scene2 | finished
function acknowledgeArrow(){
  const wave=$('arrowWave');
  if(!wave)return;
  wave.classList.remove('is-pulsing');
  void wave.offsetWidth; // iedere druk geeft een nieuwe subtiele golf
  wave.classList.add('is-pulsing');
}

let scriptedPlayer = null;
let scriptedAudioUrls = [null,null];
function scriptedFeedback(message, problem=false) {
  feedback('scriptedStatus',message,problem?'bad':'good');
}
function releaseScriptedAudio() {
  stopScriptedPlayer();
  scriptedAudioUrls.forEach(url => { if(url) URL.revokeObjectURL(url); });
  scriptedAudioUrls=[null,null];
}
function stopScriptedPlayer() {
  if(scriptedPlayer) {
    scriptedPlayer.onended=null;
    scriptedPlayer.onerror=null;
    scriptedPlayer.pause();
    scriptedPlayer.removeAttribute('src');
    scriptedPlayer.load();
    scriptedPlayer=null;
  }
}
function scriptedStop() {
  stopScriptedPlayer();
  scriptedMode='off';
}
function scriptedShowReady() {
  return scriptedAudioUrls[0]&&scriptedAudioUrls[1];
}
for(const [index,id] of ['scriptedAudioOne','scriptedAudioTwo'].entries()){
  $(id).addEventListener('change',event=>{
    const file=event.target.files?.[0];
    if(scriptedAudioUrls[index]) URL.revokeObjectURL(scriptedAudioUrls[index]);
    scriptedAudioUrls[index]=file?URL.createObjectURL(file):null;
    scriptedFeedback(scriptedShowReady()?'Beide opnamen klaar. Start voorstelling.':'Laad ook de andere Franse opname.',!scriptedShowReady());
  });
}
function startScriptedShow(){
  if(scriptedMode!=='off' && scriptedMode!=='armed'){
    scriptedFeedback('De voorstelling loopt al. Gebruik Stop of Opnieuw om opnieuw te starten.',true);
    return;
  }
  if(!scriptedShowReady()){
    scriptedFeedback('Kies eerst de audio van scène 1 en scène 2 bij Audio voor de voorstelling.',true);
    $('scriptedShow').querySelector('details').open=true;
    panel(true);return;
  }
  if(phase!=='intro' && phase!=='live'){
    scriptedFeedback('Klik eerst op Opnieuw om de voorstelling vanaf het begin te starten.',true);
    return;
  }
  if(phase==='intro'){
    if(!translator){scriptedFeedback('Klik eerst op Voorbereiden om de live ondertiteling te laden.',true);panel(true);return;}
    goStart();
    if(phase!=='live')return;
  }
  scriptedMode='armed';
  scriptedFeedback('Je spreekt Nederlands. Druk op → zodra de Franse spreker mag ingrijpen.');
  panel(false);
}
function playScriptedScene(index) {
  if(!scriptedShowReady()) {scriptedFeedback('Franse opnamen ontbreken.',true);panel(true);return;}
  if(index===0 && scriptedMode!=='armed')return;
  if(index===1 && scriptedMode!=='reply')return;
  const target=index===0?'scene1':'scene2';
  stopMic();stopVoices();stopScriptedPlayer();
  scriptedMode=target;
  setPhase('interrupted',index===0?'SCÈNE 1 · ONDERBREKING':'SCÈNE 2 · FRANSE SPEECH');
  blankStage();
  const player=new Audio(scriptedAudioUrls[index]);
  player.preload='auto';
  scriptedPlayer=player;
  player.onended=()=>{
    if(scriptedPlayer!==player || scriptedMode!==target)return;
    stopScriptedPlayer();
    if(index===0){
      scriptedMode='reply';
      setPhase('interrupted','JOUW REACTIE');
      blankStage();
      scriptedFeedback('Jij antwoordt nu zelf. Er is geen timer. Druk pas daarna op →.');
    }else{
      scriptedMode='finished';
      setPhase('handback','JOUW NEDERLANDSE SLOT');
      blankStage();
      // Zonder knopdruk: dezelfde zachte golf geeft aan dat jij weer aan zet bent.
      acknowledgeArrow();
      scriptedFeedback('De Franse spreker is klaar. Rustig wit podium. Jij sluit zelf af.');
    }
  };
  player.onerror=()=>{
    if(scriptedPlayer!==player)return;
    scriptedFeedback('De opname kan niet worden afgespeeld. Kies het bestand opnieuw.',true);
    panel(true);
  };
  scriptedFeedback(index===0?'Scène 1: Franse spreker onderbreekt.':'Scène 2: Franse toespraak. De spreker geeft daarna het woord terug.');
  panel(false);
  void player.play().catch(error=>{
    if(scriptedPlayer!==player)return;
    scriptedFeedback('Safari kon de opname niet starten: '+String(error?.message||error)+'. Druk nogmaals op Volgende scène.',true);
    scriptedMode=index===0?'armed':'reply';
    stopScriptedPlayer();
    panel(true);
  });
}
function scriptedNext(){
  acknowledgeArrow();
  if(scriptedMode==='armed')playScriptedScene(0);
  else if(scriptedMode==='reply')playScriptedScene(1);
  else if(scriptedMode==='scene1'||scriptedMode==='scene2') scriptedFeedback('Deze scène speelt. Wacht tot de stem klaar is.');
  else if(scriptedMode==='finished') scriptedFeedback('De voorstelling is afgerond. Jij hebt het woord.');
  else scriptedFeedback('Klik eerst op Start voorstelling.',true);
}
$('scriptedStart').addEventListener('click',startScriptedShow);
$('scriptedNext').addEventListener('click',scriptedNext);

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
function componentStatus(id,state,message,error=null) {
  window.dispatchEvent(new CustomEvent('cloud-function-status',{
    detail:{id,state,message,error:error?String(error?.message||error):null}
  }));
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
  $('panel').inert = !open;
  stage.inert = open;
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
  if (translator && translator.kind !== $('translationEngine').value) {
    await translator.dispose?.();
    translator=null;
  }
  if (translator) {
    feedback('translationStatus', 'Franse vertaling is geladen.', 'good');
    componentStatus('translationStatus','idle','Model geladen. Nog niet vertaald.');
    return true;
  }
  if (preparingTranslation) return preparingTranslation;
  preparingTranslation = (async () => {
    feedback('translationStatus', 'Franse vertaling voorbereiden…');
    componentStatus('translationStatus','busy','Vertaling laden');
    const opts = { sourceLanguage: 'nl', targetLanguage: 'fr' };
    if ($('translationEngine').value === 'chrome' && typeof globalThis.Translator !== 'undefined') {
      try {
        const availability = await Translator.availability(opts);
        if (availability !== 'unavailable') {
          feedback('translationStatus', availability === 'available' ? 'Chrome-vertaling openen…' : 'Chrome-taalpakket downloaden…');
          translator = await Translator.create({ ...opts, monitor(m) {
            m.addEventListener('downloadprogress', e => feedback('translationStatus', 'Chrome-taalpakket ' + Math.floor(e.loaded * 100) + '%'));
          }});
          translator.kind = 'chrome';
          feedback('translationStatus', 'Nederlandse spraak → Franse tekst. Chrome-vertaling klaar.', 'good');
          componentStatus('translationStatus','idle','Chrome-model geladen. Nog niet vertaald.');
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
      componentStatus('translationStatus','idle','Browsermodel geladen. Nog niet vertaald.');
      return true;
    } catch (e) {
      translator = null;
      const msg = 'Browservertaling niet geladen: ' + (e.message || e);
      feedback('translationStatus', msg, 'bad');
      componentStatus('translationStatus','error','Vertaling niet geladen',e);
      reportError(msg);
      return false;
    }
  })();
  try { return await preparingTranslation; } finally { preparingTranslation = null; }
}
$('prepareTranslate').onclick = prepareTranslation;
$('translationEngine').addEventListener('change',()=>{
  feedback('translationStatus','Andere vertaalroute gekozen. Klik op Laad vertaling om over te schakelen.');
  componentStatus('translationStatus','idle','Andere route gekozen, nog niet getest');
});
let microphoneCheck = null;
let microphoneCheckTimer = null;
let microphoneTestGeneration = 0;
let microphonePreparing = false;
function microphoneAdvice(error) {
  const code = String(error?.name || error?.error || error || '').toLowerCase();
  if (/notallowed|permissiondenied|not-allowed|service-not-allowed/.test(code))
    return 'Chrome heeft geen toegang. Klik op het icoon links van het webadres, sta Microfoon toe en laad de pagina opnieuw.';
  if (/notfound|devicesnotfound|audio-capture/.test(code))
    return 'Geen microfoon gevonden. Controleer de invoer bij macOS > Systeeminstellingen > Geluid.';
  if (/notreadable|trackstarterror/.test(code))
    return 'De microfoon is bezet of niet beschikbaar. Sluit andere programma’s die de microfoon gebruiken.';
  if (/network/.test(code))
    return 'Chrome bereikt de spraakherkenningsdienst niet. De microfoon kan wel werken, maar er komt geen Nederlandse tekst terug. Controleer netwerk en browserinstellingen.';
  if (/no-speech/.test(code))
    return 'Er zijn geen woorden herkend. Controleer de gekozen microfoon en spreek duidelijk.';
  if (/timeout|aborted/.test(code))
    return 'De spraakherkenning reageert niet. Controleer de microfoontoestemming, je netwerk en probeer opnieuw.';
  return 'Controleer de microfoon in Chrome en probeer de spraaktest opnieuw.';
}
function stopMicrophoneCheck() {
  microphoneTestGeneration++;
  microphonePreparing = false;
  if (microphoneCheckTimer) { clearTimeout(microphoneCheckTimer); microphoneCheckTimer = null; }
  const previous = microphoneCheck;
  microphoneCheck = null;
  if (previous) {
    previous.onstart = null; previous.onresult = null;
    previous.onend = null; previous.onerror = null;
    try { previous.abort(); } catch {}
  }
  $('prepareMic').textContent = 'Test microfoon';
}
$('prepareMic').onclick = async () => {
  if (microphonePreparing || microphoneCheck) {
    stopMicrophoneCheck();
    feedback('microphoneStatus','Spraaktest gestopt.');
    componentStatus('microphoneStatus','idle','Test gestopt');
    return;
  }
  if (phase !== 'intro') {
    feedback('microphoneStatus','Stop eerst de voorstelling. Daarna kun je de microfoon testen.','bad');
    return;
  }
  const generation = ++microphoneTestGeneration;
  microphonePreparing = true;
  $('prepareMic').textContent = 'Stop spraaktest';
  feedback('microphoneStatus','Controleert de microfoontoegang…');
  componentStatus('microphoneStatus','busy','Microfoontoegang controleren');
  const setDeviceMessage = message => {
    if (generation === microphoneTestGeneration) $('microphoneDeviceStatus').textContent = message;
  };
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    microphonePreparing = false;
    setDeviceMessage('Microfoontoegang niet beschikbaar.');
    const reason = new Error('De browser heeft geen beveiligde microfoontoegang.');
    feedback('microphoneStatus','Open deze pagina via HTTPS in Chrome. Microfoontoegang is hier niet beschikbaar.','bad');
    componentStatus('microphoneStatus','error','Geen browsertoegang',reason);
    $('prepareMic').textContent = 'Test microfoon';
    return;
  }
  // Test de fysieke microfoon apart van Web Speech. Geen opname of audio wordt bewaard.
  let stream;
  try {
    const request = navigator.mediaDevices.getUserMedia({audio:true}).then(openedStream => {
      if (generation !== microphoneTestGeneration || !microphonePreparing) openedStream.getTracks().forEach(track=>track.stop());
      return openedStream;
    });
    const timeout = new Promise((_,reject) => {
      microphoneCheckTimer = setTimeout(() => reject(new Error('Timeout microfoontoestemming')),12000);
    });
    stream = await Promise.race([request,timeout]);
    if (microphoneCheckTimer) {clearTimeout(microphoneCheckTimer);microphoneCheckTimer=null;}
    if (generation !== microphoneTestGeneration) { stream.getTracks().forEach(track=>track.stop()); return; }
    const track = stream.getAudioTracks()[0];
    setDeviceMessage('Microfoon bereikbaar: '+(track?.label || 'audio-invoer')+'. Geen audio opgeslagen.');
    stream.getTracks().forEach(track=>track.stop());
  } catch(error) {
    if (generation !== microphoneTestGeneration) return;
    microphonePreparing = false;
    $('prepareMic').textContent = 'Test microfoon';
    setDeviceMessage('Microfoontoegang mislukt.');
    feedback('microphoneStatus',microphoneAdvice(error),'bad');
    componentStatus('microphoneStatus','error','Microfoontoegang mislukt',error);
    return;
  } finally {
    stream?.getTracks().forEach(track=>track.stop());
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    microphonePreparing = false;
    $('prepareMic').textContent='Test microfoon';
    feedback('microphoneStatus','De microfoon is bereikbaar. Deze Chrome-versie biedt geen spraakherkenning.','bad');
    componentStatus('microphoneStatus','unavailable','Spraakherkenning ontbreekt',new Error('SpeechRecognition ontbreekt'));
    return;
  }
  const instance = new SR();
  microphoneCheck = instance;
  microphonePreparing = false;
  let heard = false;
  instance.lang = 'nl-NL';
  instance.continuous = false;
  instance.interimResults = true;
  instance.onstart = () => {
    if (generation !== microphoneTestGeneration || microphoneCheck !== instance) return;
    feedback('microphoneStatus','Microfoon werkt. Chrome luistert nu naar Nederlands. Spreek een korte zin.');
    componentStatus('microphoneStatus','busy','Spraakherkenning luistert');
  };
  instance.onresult = event => {
    if (generation !== microphoneTestGeneration || microphoneCheck !== instance) return;
    const words = Array.from(event.results).map(result=>result[0]?.transcript||'').join(' ').trim();
    if (!words) return;
    heard = true;
    const final = Array.from(event.results).every(result=>result.isFinal);
    feedback('microphoneStatus',(final?'Herkend Nederlands: ':'Herkenning bezig: ')+words,final?'good':'');
    componentStatus('microphoneStatus','ready','Nederlandse woorden herkend');
  };
  instance.onerror = event => {
    if (generation !== microphoneTestGeneration || microphoneCheck !== instance) return;
    const code = event.error || 'onbekend';
    stopMicrophoneCheck();
    feedback('microphoneStatus','Spraakherkenning: '+code+'. '+microphoneAdvice(code),'bad');
    componentStatus('microphoneStatus','error','Spraakherkenning mislukt',new Error(code));
  };
  instance.onend = () => {
    if (generation !== microphoneTestGeneration || microphoneCheck !== instance) return;
    stopMicrophoneCheck();
    if (!heard) {
      feedback('microphoneStatus','De microfoon werkt, maar Chrome heeft geen woorden herkend. '+microphoneAdvice('no-speech'),'bad');
      componentStatus('microphoneStatus','error','Geen woorden herkend',new Error('no-speech'));
    }
  };
  microphoneCheckTimer = setTimeout(() => {
    if (generation !== microphoneTestGeneration || microphoneCheck !== instance) return;
    stopMicrophoneCheck();
    if (!heard) {
      feedback('microphoneStatus','De microfoon is bereikbaar, maar spraakherkenning reageert niet. '+microphoneAdvice('timeout'),'bad');
      componentStatus('microphoneStatus','error','Spraakherkenning reageert niet',new Error('Timeout'));
    }
  },15000);
  try {
    feedback('microphoneStatus','Chrome-spraakherkenning starten…');
    instance.start();
  } catch(error) {
    stopMicrophoneCheck();
    feedback('microphoneStatus','Spraakherkenning kon niet starten. '+microphoneAdvice(error),'bad');
    componentStatus('microphoneStatus','error','Spraakherkenning kon niet starten',error);
  }
};

function stopMic() {
  wantsMic = false;
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  if (micSilentTimer) { clearTimeout(micSilentTimer); micSilentTimer = null; }
  if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
  latestInterim = '';
  previewSequence++;
  const previous = mic;
  mic = null;
  if (previous) { previous.onend = null; previous.onresult = null; previous.onerror = null; try { previous.abort(); } catch {} }
}
function translateFinal(fragment) {
  const text = fragment.replace(/\\s+/g,' ').trim();
  if (text) $('recognizedDutch').textContent = text;
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
      if (!translated?.trim()) throw new Error('Het vertaalmodel gaf geen Franse tekst');
      if(translated?.trim()) componentStatus('translationStatus','ready','Live vertaling uitgevoerd');
       finalTranslations.push(...splitFrenchCaption(translated));
      finalTranslations = finalTranslations.slice(-2);
      renderCaptions();
      feedback('runtimeStatus', `Herkend: ${text}`, 'good');
    } catch (e) { componentStatus('translationStatus','error','Live vertaling mislukt',e);reportError(`Vertaling mislukt: ${e.message}`); }
  }).finally(() => { finalInFlight = Math.max(0, finalInFlight - 1); });
}
function translatePreview(fragment) {
  if (!$('translationDrafts').checked) return;
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
  // Tussen beide opgenomen scènes en tijdens het Nederlandse antwoord blijft de microfoon uit.
  if (['scene1','reply','scene2','finished'].includes(scriptedMode)) {
    feedback('runtimeStatus','De microfoon blijft uit tijdens de gescripte scènes en jouw antwoord.');
    return false;
  }
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SR) { componentStatus('microphoneStatus','unavailable','Geen spraakherkenning',new Error('SpeechRecognition ontbreekt'));reportError('Spraakherkenning ontbreekt. Er wordt geen tekst verzonnen.'); return false; }
  stopMic();
  wantsMic = true;
  const instance = new SR();
  mic = instance;
  instance.lang = 'nl-NL';
  instance.continuous = true;
  instance.interimResults = true;
  instance.maxAlternatives = 1;
  let recognized = false;
  const onIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  instance.onstart = () => {
    if (!onIOS) return;
    if (micSilentTimer) clearTimeout(micSilentTimer);
    micSilentTimer = setTimeout(() => {
      if (mic === instance && phase === 'live' && !recognized) {
        feedback('runtimeStatus','Geen Nederlandse woorden ontvangen. iOS kan spraakherkenning blokkeren ondanks een actieve microfoon. Open instellingen en gebruik Start ondertiteling om opnieuw te proberen.','bad');
        componentStatus('microphoneStatus','error','iOS: geen spraak ontvangen',new Error('Timeout'));
      }
    },18000);
  };
  instance.onresult = event => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const value = event.results[i];
      const words = value[0]?.transcript || '';
      if (words.trim()) {
        componentStatus('microphoneStatus','ready','Live Nederlandse woorden herkend');
        recognized = true;
        if (micSilentTimer) { clearTimeout(micSilentTimer); micSilentTimer = null; }
      }
      if (value.isFinal) translateFinal(words);
      else interim += words;
    }
    if (interim) { feedback('runtimeStatus', `Luistert: ${interim}`); translatePreview(interim); }
  };
  instance.onerror = e => {
    componentStatus('microphoneStatus','error','Spraakherkenning mislukt',new Error(e.error));
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
  try { instance.start(); componentStatus('microphoneStatus','busy','Live microfoon gestart, nog geen woorden');feedback('runtimeStatus', 'Live vertaling luistert naar Nederlands', 'good'); return true; }
  catch (e) { componentStatus('microphoneStatus','error','Microfoon kon niet starten',e);reportError('Microfoon kon niet beginnen: ' + e.message); wantsMic = false; return false; }
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
   componentStatus('frenchStatus','busy','Frans model laden');
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
     componentStatus('frenchStatus','idle','Model geladen. Nog niet beluisterd.');
    feedback('latencyStatus','Franse stem geladen. Eerste klank nog niet gemeten.','good');
  } catch (error) {
    french = null;
    feedback('frenchStatus','Franse Phonon-stem niet geladen: '+(error.message || error),'bad');
    componentStatus('frenchStatus','error','Franse stem niet geladen',error);
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
   componentStatus('frenchStatus','busy','Eigen Frans model laden');
  try {
    french = await PhononTTS.load({ model, lang: 'fr', quant: 'q8', device: 'auto', threads: 1,
      onProgress: p => feedback('frenchStatus', `${p.file || 'Model'} ${p.total ? Math.round(p.loaded / p.total * 100) + '%' : ''}`)
    });
    const ms = Math.round(performance.now() - started);
    feedback('frenchStatus', `Franse stem gereed in ${ms} ms · ${french.device} · ${french.threads} thread(s)`, 'good');
     componentStatus('frenchStatus','idle','Eigen model geladen. Nog niet beluisterd.');
    feedback('latencyStatus', `Model laden: ${ms} ms. Nog geen spraak gemeten.`, 'good');
  } catch (e) { french = null; releaseModelUrls(); componentStatus('frenchStatus','error','Eigen model kon niet starten',e);reportError(`Frans model kon niet starten: ${e.message}`); feedback('frenchStatus', 'Model niet geladen', 'bad'); }
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
      if (pieces === 0) {feedback('latencyStatus', `Franse stem: eerste klank na ${Math.round(performance.now() - started)} ms`, 'good');componentStatus('frenchStatus','ready','Franse audiobuffer geproduceerd');}
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
  } catch (e) { if (!controller.signal.aborted) {componentStatus('frenchStatus','error','Franse stemproef mislukt',e);reportError(`Franse stemproef: ${e.message || e}`);} }
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
   componentStatus('dutchStatus','idle',selectedDutchVoice?'Stem gekozen. Nog niet getest.':'Geen Nederlandse stem gekozen');
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
     componentStatus('dutchStatus','ready','Nederlandse spraakuitvoer gestart');
  };
  utterance.onboundary = () => { dutchPulseAt = performance.now(); };
  utterance.onend = () => {
    if (dutchUtterance === utterance) {
      dutchSpeaking = false;
      dutchUtterance = null;
      onEnd?.();
    }
  };
  utterance.onerror = e => { dutchSpeaking = false;componentStatus('dutchStatus','error','Nederlandse spraakuitvoer mislukt',new Error(e.error));reportError(`Nederlandse stem: ${e.error}`); };
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
  if (scriptedPlayer && (scriptedMode==='scene1' || scriptedMode==='scene2')) {
    if (scriptedPlayer.paused) {
      void scriptedPlayer.play().catch(e => reportError('Opname hervatten: '+String(e?.message||e)));
      feedback('phaseStatus','Opname hervat');
    } else {
      scriptedPlayer.pause();
      feedback('phaseStatus','Opname gepauzeerd');
    }
    return;
  }
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
  const segments = speechSegments(getActiveSession().speech); // Vaste tekst van de gekozen sessie
  frenchSegmentTotal = segments.length;
  updateSpeechProgress();
  const started = performance.now();
  feedback('latencyStatus','Franse speech: eerste audiostuk wordt gemaakt…');
  followAudioClock(ctx, controller);
  blankStage();
  try {
    for (let i = frenchSegmentIndex; i < segments.length; i++) {
      frenchSegmentIndex = i;
      updateSpeechProgress();
      const line = segments[i];
      if (controller.signal.aborted || phase !== 'french') return;
      feedback('runtimeStatus','Franse passage '+(i+1)+' van '+segments.length+' wordt uitgesproken.');
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
      if (controller.signal.aborted || phase !== 'french') return;
      frenchSegmentIndex = i + 1;
      updateSpeechProgress();
    }
    feedback('runtimeStatus', `Franse speech loopt. ${totalChunks} live audiostukken.`, 'good');
    await waitForPlayback(ctx, controller, t);
    if (!controller.signal.aborted && phase === 'french') {
      if (reserveSpeechActive) {
        feedback('runtimeStatus','Franse speech klaar. Klik op Woord terugnemen om weer live te vertalen.','good');
        feedback('phaseStatus','Speech afgerond · woord terugnemen');
      } else goHandback();
    }
  } catch (e) { if (!controller.signal.aborted) reportError(`Franse stem onderbroken: ${e.message || e}`); }
}
function updateSpeechProgress() {
  const target = $('speechProgress');
  if (target) target.textContent = frenchSegmentTotal
    ? 'Franse passage ' + Math.min(frenchSegmentIndex+1,frenchSegmentTotal) + ' van ' + frenchSegmentTotal
    : 'Franse speech nog niet begonnen';
}
function nextFrenchPassage() {
  if (phase !== 'french') return;
  const segments = speechSegments(getActiveSession().speech);
  const next = Math.min(segments.length, frenchSegmentIndex+1);
  stopVoices();
  frenchSegmentIndex = next;
  frenchSegmentTotal = segments.length;
  updateSpeechProgress();
  if (frenchSegmentIndex >= frenchSegmentTotal) {
    if(reserveSpeechActive) feedback('runtimeStatus','Franse speech klaar. Neem het woord terug wanneer je wilt.','good');
    else goHandback();
    return;
  }
  void streamFrench().catch(error=>{
    componentStatus('frenchStatus','error','Volgende passage kon niet starten',error);
    reportError('Franse speech kon niet hervatten: '+String(error?.message||error));
    panel(true);
  });
}
function previousFrenchPassage() {
  if (phase !== 'french') return;
  stopVoices();
  frenchSegmentIndex = Math.max(0,frenchSegmentIndex-1);
  updateSpeechProgress();
  void streamFrench().catch(error=>reportError('Vorige passage kon niet starten: '+String(error?.message||error)));
}
function reserveFrenchSpeech(){
  // De noodspeech werkt ook zonder vertaling of verbinding met Ollama.
  if(!french) {
    feedback('runtimeStatus','Laad eerst de Franse stem bij Stem. De reserve blijft beschikbaar zodra de stem klaar is.','bad');
    panel(true);return;
  }
  if(phase!=='live' && phase!=='intro') {
    feedback('runtimeStatus','Stop eerst de huidige speech of gebruik Woord terugnemen.','bad');
    panel(true);return;
  }
  reserveSpeechActive=true;
  stopMic();
  stopVoices();
  prewarmFrenchAudio();
  setPhase('interrupted','FRANSE SPEECH');
  feedback('runtimeStatus','De vaste Franse speech wordt voorbereid. Geen Ollama nodig.');
  goFrench();
}
function reserveTakeBack(){
  if(!reserveSpeechActive || phase!=='french'){
    feedback('runtimeStatus','De reserve-speech is niet actief.','bad');
    return;
  }
  stopVoices();
  const next=stageAdvance(phase,'handback');
  if(next===null) return;
  setPhase('handback','WOORD TERUG');
  blankStage();
  reserveSpeechActive=false;
  if(translator) goFinish();
  else goReset();
}
async function prepareShow(){
  if(phase!=='intro') {feedback('runtimeStatus','Druk eerst op Opnieuw om de vertaling opnieuw voor te bereiden.');return;}
  const button=$('prepareShow');
  button.disabled=true;
  const status=$('showReadyStatus');
  try{
    status.textContent='Nederlandse spraak naar Franse tekst laden…';
    if($('translationEngine').value==='chrome' && typeof globalThis.Translator==='undefined') $('translationEngine').value='onnx';
    const translated=await prepareTranslation();
    if(translated) {
      status.textContent='Franse ondertiteling klaar. Kies twee opnamen en start de voorstelling.';
      feedback('runtimeStatus','Franse ondertiteling klaar. De opgenomen scènes hebben geen stemmodel nodig.','good');
    } else {
      status.textContent='Vertaling niet beschikbaar. Kijk bij Instellingen.';
      feedback('runtimeStatus','De vertaling kon niet laden. Kijk bij Instellingen.','bad');
    }
  } catch(error) {
    status.textContent='Vertaling laden mislukt: '+String(error?.message||error);
    reportError('Voorbereiden: '+String(error?.message||error));
  } finally {button.disabled=false;}
}
$('prepareShow').addEventListener('click',prepareShow);
function goStart() {
  if (scriptedMode==='finished'){feedback('runtimeStatus','Je hebt het woord. Gebruik Opnieuw voor een nieuwe voorstelling.');return;}
  if (!translator) {
    feedback('runtimeStatus','Klik eerst op Voorbereiden. Daarna op Start Nederlands.','bad');
    panel(true);
    return;
  }
  // Bij vastgelopen spraakherkenning kan de gebruiker live opnieuw proberen.
  if (phase === 'live') {
    stopMic();
    if (startMic()) {
      feedback('runtimeStatus','Nederlandse spraakherkenning opnieuw gestart. Spreek een korte zin.','good');
      panel(false);
    } else panel(true);
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
  stopMic(); stopVoices();
  prewarmFrenchAudio();
  setPhase('interrupted', 'UN INSTANT…');
  blankStage();
  const now = epoch;
  if (selectedDutchVoice) {
    const started = speakDutch(getActiveSession().interrupt, () => beginReplyWindow(now));
    if (!started) { releasePreparedAudio(); reportError('De onderbreking kon niet starten.'); }
  } else {
    feedback('runtimeStatus','De Franse spreker is klaar voor de overname. Jij kunt nog reageren of doorgaan naar de speech.');
    beginReplyWindow(now);
  }
  panel(false);
}
function goFrench() {
  if (!french) { reportError('Laad eerst het Franse Phonon-model.'); return; }
  if (stageAdvance(phase, 'french') === null) return;
  stopMic(); stopVoices(); firstAudioMs = null;
  frenchSegmentIndex = 0;
  // Laat direct zien dat het stemmodel nog geluid maakt en niet is vastgelopen.
  feedback('runtimeStatus','Franse tekst wordt uitgesproken. De eerste klank kan even duren.');
  frenchSegmentTotal = speechSegments(getActiveSession().speech).length;
  updateSpeechProgress();
  setPhase('french', 'DISCOURS EN FRANÇAIS');
  panel(false);
  void streamFrench().catch(error => {
    componentStatus('frenchStatus','error','Franse speech kon niet starten',error);
    reportError('Franse audio kon niet starten: ' + (error.message || error));
    panel(true);
  });
}
function goHandback() {
  if (reserveSpeechActive) {reserveTakeBack();return;}
  if (stageAdvance(phase, 'handback') === null) return;
  stopVoices();
  setPhase('handback', 'À VOUS');
  blankStage();
  const now = epoch;
  if (selectedDutchVoice) {
    speakDutch(getActiveSession().handback, () => {
      if (phase === 'handback' && epoch === now) goFinish();
    });
  } else {
    feedback('runtimeStatus','De Franse spreker heeft het woord teruggegeven. Klik op Nederlands slot om verder te gaan.');
  }
  panel(false);
}
function goFinish() {
  if (!translator) { reportError('Vertaalmodel ontbreekt.'); return; }
  if (stageAdvance(phase, 'finish') === null) return;
  stopVoices(); clearLiveState(); closing = true;
  setPhase('live', 'TRADUCTION EN DIRECT');
  renderCaptions();
  if (startMic()) panel(false);
  else {
    reportError('De microfoon kon na de Franse speech niet opnieuw starten. Gebruik Start ondertiteling.');
    panel(true);
  }
}
function goReset() {
  scriptedStop();
  reserveSpeechActive=false;
  releasePreparedAudio();
  stopMic(); stopVoices(); clearLiveState(); closing = false;
  setPhase('intro', 'CÉRÉMONIE');
  blankStage();
  panel(false);
}
function panic() {
  scriptedStop();
  reserveSpeechActive=false;
  releasePreparedAudio();
  stopMic(); stopVoices(); previewSequence++;
  setPhase('stopped', 'PAUSE');
  blankStage();
  feedback('runtimeStatus', 'Alles gestopt. Toets 0 om opnieuw te beginnen.', 'bad');
}
const actions = {start:goStart, interrupt:reserveFrenchSpeech, french:goFrench, handback:goHandback, finish:goFinish, reset:goReset, panic, nextFrenchPassage, previousFrenchPassage, reserveSpeech:reserveFrenchSpeech, reserveTakeBack};
for (const [name, fn] of Object.entries(actions)) $(name).onclick = fn;
$('fullscreen').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
$('testTranslate').onclick = async () => {
  if (!translator && !(await prepareTranslation())) return;
  try {
    const translated = await translator.translate($('testDutch').value);
    $('translationTestResult').textContent = translated;
    feedback('runtimeStatus', 'Vertaaltest geslaagd. De uitslag staat in de studio.', 'good');
     componentStatus('translationStatus',translated?.trim()?'ready':'error',translated?.trim()?'Franse tekst geproduceerd':'Geen Franse tekst ontvangen',translated?.trim()?null:new Error('Lege vertaling'));
  } catch(e) {
    $('translationTestResult').textContent = 'Vertalen is niet gelukt: ' + e.message;
    componentStatus('translationStatus','error','Vertaaltest mislukt',e);
     reportError('Vertaaltest: ' + e.message);
  }
};
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); panel(!$('panel').classList.contains('open')); return; }
  // Tijdens de studio bedienen pijltoetsen de tabs, nooit de overname.
  if ($('panel').classList.contains('open')) return;
  if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
  if (event.code === 'ArrowRight') {
    event.preventDefault();
    if(scriptedMode!=='off'){scriptedNext();return;}
    acknowledgeArrow();
    if (phase === 'french') nextFrenchPassage();
    else if (phase === 'live' && !closing) reserveFrenchSpeech();
    return;
  }
  if (event.code === 'ArrowLeft' && phase === 'french') { event.preventDefault(); previousFrenchPassage(); return; }
  if (event.code === 'Space') { event.preventDefault(); togglePause(); return; }
  const map = {'1':goStart,'2':()=>scriptedMode!=='off'?scriptedNext():reserveFrenchSpeech(),'3':()=>phase==='live'?reserveFrenchSpeech():goFrench(),'4':()=>reserveSpeechActive?reserveTakeBack():goHandback(),'5':goFinish,'0':goReset,'x':panic,'X':panic,'f':$('fullscreen').onclick,'F':$('fullscreen').onclick};
  if (map[event.key]) { event.preventDefault(); map[event.key](); }
});
