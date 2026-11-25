import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {chromium,webkit} from 'playwright';

const folder=resolve(process.argv[2]||'dist');
const base='http://127.0.0.1:4178';
const server=spawn('python3',['-m','http.server','4178','--bind','127.0.0.1','--directory',folder],{stdio:'ignore'});
try{
  let up=false;
  for(let i=0;i<80&&!up;i++){try{up=(await fetch(base)).ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,100));}
  assert.ok(up,'artifact server started');
  for(const [name,driver,viewport] of [['Chromium',chromium,{width:1280,height:900}],['WebKit',webkit,{width:390,height:844}]]){
    const browser=await driver.launch({headless:true});
    try{
      const page=await browser.newPage({viewport,reducedMotion:'reduce'});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{
        class Recognition {
          start(){window.__recognition=this;this.onstart?.();}
          emit(text,final=true){this.onresult?.({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:final})]});}
          stop(){this.emit('laatste woorden');this.onend?.();}
          abort(){window.__recognition=null;}
        }
        Object.defineProperty(window,'SpeechRecognition',{value:Recognition,configurable:true});
        Object.defineProperty(window,'webkitSpeechRecognition',{value:Recognition,configurable:true});
        Object.defineProperty(window,'Translator',{configurable:true,value:{
          availability:async()=> 'available',
          create:async()=>({translate:async text=>'Vertaald: '+text,destroy(){}})
        }});
      });
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.locator('#panel.open').waitFor();
      assert.equal(await page.locator('#liveMode option').count(),3);
      await page.locator('#liveMode').selectOption('captions');
      await page.locator('#start').click();
      await page.waitForFunction(()=>window.__recognition);
      await page.evaluate(()=>window.__recognition.emit('Dit is een proefzin.'));
      await page.waitForFunction(()=>document.querySelector('#displayText').textContent.includes('Dit is een proefzin.'));
      await page.locator('#stageStop').click();
      await page.waitForFunction(()=>document.querySelector('#phaseStatus').textContent==='Gestopt');
      assert.match(await page.locator('#liveTranscript').inputValue(),/laatste woorden/);
      await page.locator('#liveMode').selectOption('translate');
      assert.equal(await page.locator('#start').textContent(),'Verbind en bereid voor');
      await page.locator('#start').click();
      await page.waitForFunction(()=>document.querySelector('#translationStatus').textContent.includes('Route voorbereid'));
      assert.equal(await page.evaluate(()=>window.__recognition),null,'preparation does not open the mic');
      await page.locator('#start').click();
      await page.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='live' && window.__recognition);
      await page.evaluate(()=>window.__recognition.emit('Goedemorgen.'));
      await page.waitForFunction(()=>document.querySelector('#displayText').textContent.includes('Vertaald: Goedemorgen.'));
      await page.locator('#stageStop').click();
      await page.waitForFunction(()=>document.querySelector('#phaseStatus').textContent==='Gestopt');
      await page.locator('#tab-gesprek').click();
      await page.locator('#freeTalkOptions > summary').click();
      await page.locator('.mist-voice-portal').waitFor({state:'visible'});
      assert.equal(await page.locator('#freeTalkInputLang').count(),1);
      await page.locator('#freeTalkMenuClose').click();
      assert.ok(await page.locator('#freeTalkSpeak').isDisabled());
      await page.route('http://localhost:11434/**',async route=>{
        const url=route.request().url();
        const headers={'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET, POST, OPTIONS'};
        if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
        if(url.endsWith('/api/tags'))return route.fulfill({json:{models:[{name:'test:local'}]},headers});
        if(url.endsWith('/api/generate'))return route.fulfill({json:{response:'De verbinding werkt.'},headers});
        return route.abort();
      });
      await page.evaluate(()=>{const e=document.getElementById('freeTalkEngine');e.value='ollama';e.dispatchEvent(new Event('change',{bubbles:true}));});
      await page.locator('#talkGuidePrepare').click();
      await page.waitForFunction(()=>document.getElementById('freeTalkOllamaModel').value==='test:local');
      await page.locator('#freeTalkMenuClose').click();
      await page.locator('#talkGuidePrepare').click();
      await page.waitForFunction(()=>document.getElementById('talkGuideStatus').dataset.state==='ready');
      assert.equal(await page.locator('#freeTalkSpeak').isDisabled(),false);
      await page.evaluate(()=>{const e=document.getElementById('freeTalkOutputLang');e.value=e.value==='nl-NL'?'en-US':'nl-NL';e.dispatchEvent(new Event('change',{bubbles:true}));});
      assert.ok(await page.locator('#freeTalkSpeak').isDisabled());
      await page.locator('#extraStudioTabs > summary').click();
      await page.locator('#tab-sessie').click();
      await page.locator('#readText').fill('Een eigen tekst.');
      assert.equal(await page.locator('#readText').inputValue(),'Een eigen tekst.');
      assert.deepEqual(errors,[],name+' runtime errors');
      console.log(name+': actual built UI, synthetic recognition, translation, stop/flush, mist menu and reading controls passed');
    }finally{await browser.close();}
  }
}finally{server.kill();}
