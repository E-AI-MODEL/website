import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(process.argv[2]||'site-build');
const origin='http://127.0.0.1:8798';
const server=spawn('python3',['-m','http.server','8798','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;
try{
 let ready=false;
 for(let n=0;n<80;n++){
  try{ready=(await fetch(origin+'/tools/eaiwork/')).ok}catch{}
  if(ready)break;
  await new Promise(r=>setTimeout(r,100));
 }
 assert(ready,'EAIwork-dashboard ontbreekt in de sitebuild');
 browser=await chromium.launch({headless:true});
 mkdirSync('test-results',{recursive:true});
 for(const width of [320,390,430,768,1440]){
  const mobile=width<=850;
  const page=await browser.newPage({viewport:{width,height:844},isMobile:mobile,hasTouch:mobile});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.goto(origin+'/tools/eaiwork/',{waitUntil:'load'});
  await page.locator('#view .page-head h1').waitFor();
  const box=await page.evaluate(()=>{
   const rect=sel=>{const v=document.querySelector(sel)?.getBoundingClientRect();return v?{top:v.top,bottom:v.bottom,width:v.width,height:v.height}:null};
   return {
    sidebar:rect('.sidebar'),topbar:rect('#topbar'),view:rect('#view'),
    title:rect('.page-head h1'),firstCard:rect('#view .card'),
    scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
    display:getComputedStyle(document.querySelector('.app')).display,
   };
  });
  assert(box.scrollWidth<=box.clientWidth+1,'Horizontale pagina-overloop bij '+width);
  assert(box.view && box.title,'Dashboardinhoud ontbreekt bij '+width);
  if(mobile){
   assert.equal(box.display,'block','Mobiele grid veroorzaakt lege rij bij '+width);
   assert(box.sidebar.height<165,'Zijbalk neemt te veel ruimte in bij '+width+': '+box.sidebar.height);
   assert(box.view.top<345,'Dashboard begint te laag bij '+width+': '+box.view.top);
   assert(box.title.top>=box.topbar.bottom-2,'Titel staat onder header bij '+width);
   assert(box.firstCard && box.firstCard.top<700,'Kaarten niet bereikbaar in eerste scherm bij '+width);
  }else{
   assert.equal(box.display,'grid','Desktopzijbalk mag niet verdwijnen');
  }
  if(width===390||width===1440){
   await page.screenshot({path:'test-results/eaiwork-dashboard-'+width+'-overview.png'});
  }
  await page.locator('.sidebar-nav [data-action="nav"][data-id="opdrachten"]').click();
  await page.getByRole('heading',{name:'Opdrachten',exact:true}).waitFor();
  const selected=await page.evaluate(()=>{
   const menu=document.querySelector('.sidebar-nav');
   const active=menu.querySelector('.nav-item.active');
   const r=active.getBoundingClientRect(),nav=menu.getBoundingClientRect();
   return {visible:r.left>=nav.left-2&&r.right<=nav.right+2,titleTop:document.querySelector('#view .page-head h1').getBoundingClientRect().top};
  });
  assert(selected.visible,'Actieve navigatie buiten beeld bij '+width);
  if(mobile)assert(selected.titleTop<350,'Opdrachten blijven te ver naar beneden bij '+width);
  if(width===390)await page.screenshot({path:'test-results/eaiwork-dashboard-390-opdrachten.png'});
  assert.deepEqual(errors,[],'JavaScript-fouten bij '+width);
  await page.close();
  console.log('EAIwork mobile structure verified:',width,box.sidebar.height,box.view.top);
 }
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
