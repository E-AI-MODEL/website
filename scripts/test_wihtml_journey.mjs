import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'site-build'),out=resolve('test-results');
await fs.mkdir(out,{recursive:true});
const base=process.env.EAI_LIVE_URL||'http://127.0.0.1:8767';
const server=process.env.EAI_LIVE_URL?null:spawn('python3',['-m','http.server','8767','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
const fixture={id:'journey-test',title:'Eigen les $& $` $\' <wiskunde>',level:'5 havo',route:'practice',layout:'equal',
 features:{drawing:false,voting:false,clock:true,focus:true,picker:true,notes:true,printing:true},
 slides:[
 {id:'q',type:'question',title:'Eigen vraag',prompt:'Kies en verklaar',options:['Regel 1\nRegel 2','Nee'],correct:-1,later:true,explanation:'Nog niet tonen'},
 {id:'quiz',type:'quizset',title:'Begripsvragen',questions:[{prompt:'Twee keuzes\nMet een tweede regel | in de vraag',options:['Ja','Nee'],correct:1,explanation:'Omdat | dit klopt\nTweede regel'}]},
 {id:'task',type:'practice',title:'Eigen opgaven',tasks:['Eerste regel\nTweede regel','Tweede opgave'],hints:['','Hulp bij twee'],solutions:['','Uitwerking twee']},
 {id:'table',type:'table',title:'Tabel',columnLabels:['t','N'],tableRows:[['0','0'],['1 | a','12\n13']],tableExplanation:'Tabeluitleg'},
 {id:'compare',type:'compare',title:'Vergelijken',compareLabels:['Voor','Na'],compareItems:[['Eerst | keuze','Later\nverklaring']],compareConclusion:'Conclusie'},
 {id:'steps',type:'steps',title:'Stappen',steps:['Stap 1\nVervolg','Stap 2']},
 {id:'graph',type:'graph',title:'Eigen grafiek',g:2.2,b:75000,target:2,experiments:[{label:'Eigen proef',question:'Wat gebeurt er?',instruction:'Verklaar',g:2.2,b:75000,target:2}]},
 {id:'error',type:'error',title:'Foutenanalyse',wrong:'0,15^t = 0,5',challenge:'Wat klopt niet?',correction:'Gebruik 0,85'},
 {id:'text',type:'text',title:'Tekst',body:'Letterlijke formule $& en $` en $\' <tekst>\nVolgende regel'}
 ]};
let browser;const errors=[];
const file=async(p,button,name)=>{const [d]=await Promise.all([p.waitForEvent('download'),button.click()]);const target=join(out,name);await d.saveAs(target);return target};
try{
 let ready=false;for(let i=0;i<50;i++){try{ready=(await fetch(base)).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100))}assert(ready);
 browser=await chromium.launch({headless:true});
 const p=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto(base+'/tools/wihtml/studio/');
 await p.locator('#startImport').click();
 await p.locator('#import').setInputFiles({name:'eigen-les.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 await p.waitForFunction(t=>document.querySelector('#title').value===t,fixture.title);
 await p.locator('#modeStudio').click();
 let slides=0;
 for(let step=0;step<90;step++){
  const kind=await p.locator('body').getAttribute('data-guide-kind');
  if(kind==='result')break;
  if(kind==='slide'){
   const type=await p.locator('#designType').inputValue();slides++;
   if(type==='practice')await p.locator('[data-design-array="tasks"][data-index="0"]').fill('Nieuwe opgave\nMet twee regels');
   if(type==='quizset')await p.locator('[data-design-quiz="option"][data-option="1"]').fill('Nee, verklaar je keuze');
   if(type==='graph'){
    await p.locator('.design-experiments summary').click();
    await p.locator('[data-experiment="0"][data-experiment-field="b"]').fill('80000');
   }
  }
  if(kind==='design')await p.locator('[data-guide-theme="board"]').click();
  await p.locator('#guideNext').click();
 }
 assert.equal(slides,9);assert.equal(await p.locator('body').getAttribute('data-guide-kind'),'result');
 await p.screenshot({path:join(out,'wihtml-begeleide-route.png'),fullPage:true});
 const jsonPath=await file(p,p.locator('#guideDownloadJSON'),'wihtml-begeleide-les.json');
 const doc=JSON.parse(await fs.readFile(jsonPath,'utf8'));
 assert.equal(doc.route,'practice');assert.deepEqual(doc.slides.map(x=>x.id),fixture.slides.map(x=>x.id));
 assert.deepEqual(doc.slides[0].options,fixture.slides[0].options);
 assert.equal(doc.slides[1].questions[0].options.length,2);assert.equal(doc.slides[1].questions[0].explanation,fixture.slides[1].questions[0].explanation);
 assert.equal(doc.slides[2].tasks[0],'Nieuwe opgave\nMet twee regels');assert.deepEqual(doc.slides[2].hints,['','Hulp bij twee']);
 assert.deepEqual(doc.slides[3].tableRows,fixture.slides[3].tableRows);assert.deepEqual(doc.slides[4].compareItems,fixture.slides[4].compareItems);
 const html=await file(p,p.locator('#guideDownloadHTML'),'wihtml-begeleide-export.html');
 const lesson=await browser.newPage({viewport:{width:1920,height:1080}});lesson.on('pageerror',e=>errors.push(e.message));
 await lesson.route(/^https?:/,r=>r.abort());await lesson.goto(pathToFileURL(html).href);await lesson.locator('.viewer.show').waitFor();
 assert.equal(await lesson.locator('#deckTitle').innerText(),fixture.title);
 assert.equal(await lesson.locator('#questionPoll').isVisible(),false);await lesson.keyboard.press('p');assert.equal(await lesson.locator('#draw.armed').count(),0);
 await lesson.locator('#next').click();assert.equal(await lesson.locator('.quiz-choice').count(),2);await lesson.locator('#quizRevealAll').click();assert.match(await lesson.locator('.quiz-feedback').innerText(),/Omdat \| dit klopt/);
 await lesson.locator('#next').click();await lesson.locator('[data-hint="1"]').click();assert.match(await lesson.locator('#slidecontent').innerText(),/Hulp bij twee/);
 for(let i=0;i<4;i++)await lesson.locator('#next').click();
 assert.equal(await lesson.locator('#graphG').inputValue(),'2.2');assert.equal(await lesson.locator('#graphB').inputValue(),'80000');assert.equal(await lesson.locator('#graphPollActions').isVisible(),false);
 await lesson.locator('#graphMarks').click();await lesson.locator('#graphLinear').click();await lesson.locator('#graphLines').click();
 assert.match(await lesson.locator('#graphResult').innerText(),/Verdubbeling/);
 await lesson.screenshot({path:join(out,'wihtml-begeleide-grafiek.png')});await lesson.close();
 await p.reload();await p.locator('#startRestore').click();
 assert.equal(await p.locator('body').getAttribute('data-guide-kind'),'result');
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:join(out,'wihtml-begeleide-mobiel.png'),fullPage:true});
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 assert.deepEqual(errors,[]);console.log('WiHTML begeleide route geslaagd: negen werkvormen, eigen gegevens, vormgeving, lokale hervatting en offline HTML met werkende grafiek en vragen.');
}finally{await browser?.close();server?.kill()}
