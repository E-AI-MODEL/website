import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('EAIspeak laat alle zes richtingen tussen NL EN en FR kiezen',()=>{
  const chat=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');
  for(const id of ['freeTalkInputLang','freeTalkOutputLang','freeTalkEngine','freeTalkVoice','freeTalkBrowserModel']){
    assert.match(html,new RegExp('id="'+id+'"'));
    assert.match(chat,new RegExp(id));
  }
  for(const lang of ['nl-NL','en-US','fr-FR']){
    assert.match(html,new RegExp('value="'+lang+'"'));
    assert.match(chat,new RegExp(lang));
  }
  assert.match(chat,/rec\.lang=inputLang\.value/);
  assert.match(chat,/outputLang\.value/);
  assert.match(chat,/history\.length=0/);
  assert.match(chat,/engine\.value==='browser'/);
  assert.match(chat,/localReply\(messages,browserModel\.value/);
  assert.match(chat,/api\.ai\.chat\(messages/);
});
test('browser-LLM laadt alleen na expliciete keuze en ondersteunt statusweergave',()=>{
  const local=readFileSync(new URL('../src/browser-llm.js',import.meta.url),'utf8');
  assert.match(local,/Qwen2\.5-0\.5B-Instruct-q4f16_1-MLC/);
  assert.match(local,/Qwen2\.5-1\.5B-Instruct-q4f16_1-MLC/);
  assert.match(local,/checkWebGpuAvailability\(navigator\.gpu\)/);
  assert.match(local,/await import\('@mlc-ai\/web-llm'\)/);
  assert.match(local,/initProgressCallback/);
  assert.match(local,/model\.chat\.completions\.create/);
  assert.doesNotMatch(local,/fetch\(.+api\/generate/);
});

test('Vrij praten gebruikt een compact zwevend taal- en modelmenu',()=>{
  const css=readFileSync(new URL('../cloud-shell.css',import.meta.url),'utf8');
  const chat=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');
  assert.match(html,/id="freeTalkOptions"/);
  assert.doesNotMatch(html,/id="freeTalkOptions" open/);
  assert.match(html,/id="freeTalkSummary"/);
  assert.match(html,/free-talk-floating-content/);
  assert.match(css,/\.free-talk-floating>\.mist-detail-body/);
  assert.match(css,/backdrop-filter:blur\(24px\)/);
  assert.match(chat,/modelSummary\.textContent=languages\[inputLang\.value\]/);
});

test('EAIspeak laadt Puter uit vaste websitebundle, niet van extern CDN',()=>{
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  const talk=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');
  assert.equal(pkg.dependencies['@heyputer/puter.js'],'2.6.5');
  assert.match(talk,/import\('@heyputer\/puter\.js'\)/);
  assert.doesNotMatch(html,/js\.puter\.com\/v2/);
  assert.match(html,/id="freeTalkConnect"/);
  assert.match(html,/id="freeTalkCloudModel"/);
  assert.match(talk,/api\.auth\.signIn\(\)/);
  assert.match(talk,/api\.auth\.isSignedIn\(\)/);
  assert.match(talk,/api\.ai\.listModels\(\)/);
  assert.match(talk,/model:cloudModel\.value/);
});
test('lokaal praten vraagt geen Puter-login en stop onderbreekt echte generatie',()=>{
  const chat=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');
  const local=readFileSync(new URL('../src/browser-llm.js',import.meta.url),'utf8');
  assert.match(html,/<option value="browser">Op dit apparaat/);
  assert.match(html,/<option value="browser">Stem van deze browser/);
  assert.match(chat,/if\(engine\.value==='puter'&&!puterSdk\?\.auth\?\.isSignedIn\(\)\)/);
  assert.match(chat,/function stopConversation\(\)[\s\S]{0,90}interruptBrowserReply\(\)/);
  assert.match(local,/checkWebGpuAvailability\(navigator\.gpu\)/);
  assert.match(local,/prebuiltAppConfig\.model_list\.some/);
  assert.match(local,/engine\.interruptGenerate\(\)/);
  assert.match(local,/finally\{generating=false;\}/);
});

test('vooraf laden houdt gespreksknoppen en live vertalen onafhankelijk',()=>{
  const talk=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');
  assert.match(html,/id="freeTalkPreload"/);
  assert.match(html,/id="freeTalkPreloadStatus"/);
  assert.match(html,/id="start"/);
  assert.match(talk,/preload\.addEventListener\('click',async/);
  assert.match(talk,/await ensureBrowserModel\(selected,report\)/);
  assert.match(talk,/preload\.disabled=true;browserModel\.disabled=true;/);
  assert.match(talk,/browserModel\.disabled=false;preload\.disabled=false;/);
  assert.doesNotMatch(talk,/preload\.addEventListener[\s\S]{0,500}SpeechRecognition/);
});

test('EAIspeak meldt vooraf ontbrekende WebGPU-adapter',()=>{
  const talk=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');
  const helper=readFileSync(new URL('../src/gpu-capability.mjs',import.meta.url),'utf8');
  assert.match(talk,/function probeGpu\(/);
  assert.match(talk,/preload\.disabled=!support\.usable/);
  assert.match(talk,/preloadStatus\.textContent=support\.message/);
  assert.match(helper,/gpu\.requestAdapter\(\)/);
});
test('Puter wordt bij keuze online geladen vóór de aanmeldknop actief is',()=>{
  const talk=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');
  assert.match(talk,/if\(engine\.value==='puter'\)void primePuter\(\)/);
  assert.match(talk,/connect\.disabled=true;[\s\S]{0,60}connect\.textContent='Puter laden/);
  assert.match(talk,/connect\.textContent=signed\?'Puter verbonden':'Aanmelden bij Puter'/);
  assert.doesNotMatch(talk,/Klik nogmaals op Verbind met Puter/);
});

test('EAIspeak toont toesteladvies zonder live functies of vrije keuze te verwijderen',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const chat=readFileSync(new URL('../src/free-talk.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../cloud-shell.css',import.meta.url),'utf8');
  assert.match(html,/id="freeTalkDeviceStatus"/);
  assert.match(html,/id="freeTalkDeviceAdvice"/);
  assert.match(html,/id="freeTalkOptions"/);
  assert.match(html,/id="start"/);
  assert.match(chat,/describeDevice\(/);
  assert.match(chat,/suggestDeviceSetup\(/);
  assert.match(chat,/modelDeviceAdvice\(/);
  assert.match(chat,/option\.disabled=!result\.usable/);
  assert.match(chat,/if\(!userSelectedEngine&&!saved\.engine&&!pending\)engine\.value=recommended\.engine/);
  assert.match(chat,/userSelectedEngine=true/);
  assert.match(chat,/userSelectedModel=true/);
  assert.match(css,/\.free-talk-device-details/);
});
