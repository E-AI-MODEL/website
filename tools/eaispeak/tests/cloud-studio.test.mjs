import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../cloud-shell.css',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/cloud-shell.js',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('podium is werkelijk leeg en open studio is geen zijpaneel',()=>{
  assert.match(html,/<div class="display-surface" id="displayText"><\/div>/);
  assert.ok(html.includes('cloud-atmosphere'));
  assert.ok(!html.includes('Une langue de plus.'));
  assert.ok(css.includes('.cloud-studio.panel{'));
  assert.ok(css.includes('width:100vw;height:100dvh'));
  assert.ok(css.includes('clip-path:circle('));
  assert.ok(main.includes("$('panel').inert = !open;"));
});

test('algemene studio-onderdelen zijn toegankelijk met toetsen en aanraking',()=>{
  const names=['podium','gesprek','taal','stem','sessie','meer'];
  for(const name of names){
    assert.ok(html.includes('data-studio-view="'+name+'"'),name+' tab');
    assert.ok(html.includes('data-studio-page="'+name+'"'),name+' page');
    assert.ok(html.includes('aria-controls="page-'+name+'"'),name+' aria control');
    assert.ok(html.includes('aria-labelledby="tab-'+name+'"'),name+' aria label');
  }
  assert.ok(shell.includes("event.key === 'ArrowRight'"));
  assert.ok(shell.includes("'ArrowLeft'"));
  assert.ok(shell.includes('revealObserver = new IntersectionObserver('));
  assert.ok(css.includes('.cloud-reveal.is-revealed'));
});

test('geen verloren bediening bij een open of gesloten studio',()=>{
  const all=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(all).size,all.length,'alle id-attributen zijn uniek');
  for(const id of ['stage','mobileSettings','panel','panelClose','prepareMic','prepareTranslate',
    'loadPublicFrench','previewFrench','previewDutch','nlVoice','start','panic',
    'reset','stageStop','readStart','readStop','fullscreen','runtimeStatus','translationStatus']){
    assert.ok(all.includes(id),'geen ontbrekende bediening: '+id);
  }
  assert.ok(html.includes('id="panel" class="panel cloud-studio"'));
  assert.ok(shell.includes("new MutationObserver(onStudioVisibility)"));
  assert.ok(main.includes("panel(!$('panel').classList.contains('open'))"));
});

test('wolken golven vanuit het midden en tekst ontstaat bij scroll',()=>{
  assert.ok(css.includes('@keyframes cloud-inhale'));
  assert.ok(css.includes('left:50%;top:50%'));
  assert.ok(css.includes('translate(-50%,-50%)'));
  assert.ok(css.includes('@keyframes cloud-caption-arrive'));
  assert.ok(css.includes('filter:blur(12px)'));
  assert.ok(css.includes('.cloud-reveal'));
  assert.ok(shell.includes('requestAnimationFrame(revealVisible)'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
});

test('verdampen gebeurt bij stilte, niet terwijl livewoorden binnenkomen',()=>{
  assert.ok(shell.includes('captions-evaporated'));
  assert.ok(shell.includes("stage.dataset.phase === 'live'"));
  assert.ok(shell.includes("captionObserver.observe($('displayText')"));
  assert.ok(shell.includes('markActivity()'));
  assert.ok(html.includes('id="idleCaptionSeconds"'));
  assert.ok(html.includes('<option value="0">Nooit</option>'));
  assert.ok(css.includes('transition:opacity 2.2s ease'));
});

test('geen vooraf gemaakte vertaaltekst op het podium door studio-proef',()=>{
  assert.ok(html.includes('id="translationTestResult"'));
  assert.ok(main.includes("$('translationTestResult').textContent = translated;"));
  assert.ok(!main.includes("screen(await translator.translate($('testDutch').value)"));
  assert.ok(main.includes('submitFinal(words,s)'));
  assert.ok(main.includes('submitDraft(interim.trim(),s)'));
});

test('pijltoetsen in Cloud Studio kunnen de AI niet overnemen',()=>{
  assert.ok(main.includes("if ($('panel').classList.contains('open')) return;"));
  assert.ok(main.includes('stage.inert = open;'));
  const keyboard = main.slice(main.lastIndexOf("document.addEventListener('keydown'"));
  assert.ok(!keyboard.includes("if (event.code === 'ArrowRight')"));
});


test('compacte techstudio en ronde knoppen zijn geen zware kaarten',()=>{
  assert.ok(css.includes('.cloud-studio .studio-tab{'));
  assert.ok(css.includes('font:400 11px/1.3 Roboto'));
  assert.ok(css.includes('border-radius:999px'));
  assert.ok(css.includes('.cloud-studio .cloud-heading{'));
  assert.ok(css.includes('font:400 clamp(20px,2.7vw,27px)'));
  assert.ok(html.includes('Spreek, vertaal of leg tekst vast.'));
});

test('menu-inhoud komt uit mist en verdampt ook weer bij sluiten',()=>{
  assert.ok(css.includes('@keyframes cloud-disclosure-appear'));
  assert.ok(css.includes('@keyframes cloud-disclosure-evaporate'));
  assert.ok(css.includes('@keyframes cloud-page-approach'));
  assert.ok(shell.includes("detail.classList.add('is-dissolving')"));
  assert.ok(shell.includes('detail.open = false;'));
  assert.ok(shell.includes('body.className = \'mist-detail-body\''));
  assert.ok(css.includes('@keyframes mist-detail-in'));
  assert.ok(css.includes('@keyframes mist-detail-out'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
});

test('snelle inactiviteit laat alleen lichte schim van podiumtekst zien',()=>{
  assert.ok(shell.includes('}, 3400);'));
  assert.ok(shell.includes('}, 4600);'));
  assert.ok(shell.includes('let captionIdleSeconds = 6;'));
  assert.ok(html.includes('<option value="6" selected>6 seconden</option>'));
  assert.ok(css.includes('opacity:.095;'));
  assert.ok(css.includes('filter:blur(4px)'));
  assert.ok(css.includes('.studio-scroll.is-idle'));
});

test('één animatie per uitklapmenu en geen dubbele sluiting',()=>{
  const occurrences = shell.match(/querySelectorAll\('\.studio-disclosure'\)/g) || [];
  assert.equal(occurrences.length,1);
  assert.ok(shell.includes("detail.classList.add('is-dissolving')"));
  assert.ok(!shell.includes('const closingDetails = new WeakMap()'));
});

test('navigatie en titel blijven als schim zichtbaar na inactiviteit',()=>{
  assert.ok(shell.includes("document.body.classList.add('cloud-studio-idle')"));
  assert.ok(shell.includes("classList.remove('cloud-idle','cloud-studio-idle')"));
  assert.ok(css.includes('body.cloud-studio-idle.panel-visible:not(:has(:focus-visible))'));
  assert.ok(css.includes('opacity:.13'));
});


test('Chrome-microfoon: toegang en spraakherkenning zijn afzonderlijk gecontroleerd',()=>{
  assert.ok(html.includes('id="microphoneDeviceStatus"'));
  assert.ok(main.includes('navigator.mediaDevices.getUserMedia({audio:true})'));
  assert.ok(main.includes('window.SpeechRecognition || window.webkitSpeechRecognition'));
  assert.ok(main.includes("Microfoon bereikbaar: "));
  assert.ok(main.includes("Spraakherkenning: "));
  assert.ok(main.includes("Spraakherkenning reageert niet"));
  assert.ok(main.includes("openedStream.getTracks().forEach(track=>track.stop())"));
  assert.ok(main.includes("componentStatus('microphoneStatus','error'"));
  assert.ok(main.includes("instance.onresult = event =>"));
});
test('desktop en mobiel behouden dezelfde instellingen en bewegende mist',()=>{
  assert.ok(html.includes('id="mobileSettings"'));
  assert.ok(html.includes('id="studioSessionLabel" hidden'));
  assert.ok(css.includes('@keyframes studio-cloud-current'));
  assert.ok(css.includes('@keyframes studio-cloud-wave'));
  assert.ok(css.includes('.cloud-studio .studio-clouds::before'));
  assert.ok(css.includes('.cloud-studio .studio-current[hidden]'));
  assert.ok(css.includes('.mobile-settings.cloud-entry{display:grid!important'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
});
