import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import fs from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'site-build'),out=resolve('test-results');
mkdirSync(out,{recursive:true});
const base=process.env.EAI_LIVE_URL||'http://127.0.0.1:8766';
const server=process.env.EAI_LIVE_URL?null:spawn('python3',['-m','http.server','8766','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;const errors=[];
try{
 let ready=false;for(let i=0;i<50;i++){try{ready=(await fetch(base)).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100))}assert(ready);
 browser=await chromium.launch({headless:true});
 const p=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 p.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/nl/tools/','/en/tools/','/tools/']){
  await p.goto(base+route);for(const slug of ['eaimesh','eaistudio','wihtml'])assert(await p.locator(`main a[href="/tools/${slug}/"]`).count(),route+' '+slug);
 }
 await p.goto(base+'/tools/eaimesh/');await p.locator('main a[href="/tools/eaimesh/start/"]').click();
 await p.locator('#bm').waitFor();const bookmarklet=await p.locator('#bm').getAttribute('href');assert(bookmarklet.startsWith('javascript:'));
 const code=decodeURIComponent(bookmarklet.slice('javascript:'.length));new Function(code);
 await p.locator('#show').click();assert.equal(await p.locator('#txt').inputValue(),bookmarklet);await p.locator('#close').click();
 await p.screenshot({path:join(out,'eaimesh-start.png'),fullPage:true});
 // The bookmarklet opens its configuration on a GitHub-shaped test page, with no repository reads yet.
 const fixture=await browser.newPage();fixture.on('pageerror',e=>errors.push(e.message));
 await fixture.route('https://github.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><title>E-AI-MODEL/wihtml</title></head><body><main><a href="/E-AI-MODEL/wihtml/blob/main/README.md">README.md</a></main></body></html>'}));
 await fixture.goto('https://github.com/E-AI-MODEL/wihtml');await fixture.evaluate(code);
 await fixture.locator('#__eaimesh_host__').waitFor();await fixture.screenshot({path:join(out,'eaimesh-configuratie.png')});await fixture.close();
 await p.goto(base+'/tools/eaistudio/');await p.locator('main a[href="/tools/eaistudio/studio/"]').click();
 await p.locator('[data-key="meta.title"]').waitFor();
 await p.locator('[data-key="meta.title"]').fill('Mijn presentatie\nMet interactie');
 await p.locator('[data-key="meta.subtitle"]').fill('Gebouwd op eaimodel.nl');
 await p.locator('[data-page="edit"]').click();await p.screenshot({path:join(out,'eaistudio-bouwen.png')});
 await p.locator('[data-page="play"]').click();await p.locator('[data-player="start"]').click();
 await p.screenshot({path:join(out,'eaistudio-presenteren.png')});
 await p.locator('[data-page="start"]').click();await p.locator('[data-act="export"]').first().click();
 const [download]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'Exporteer presentatie-HTML',exact:true}).click()]);
 const html=join(out,'eaistudio-presentatie.html');await download.saveAs(html);
 const standalone=await browser.newPage();standalone.on('pageerror',e=>errors.push('presentatie: '+e.message));
 await standalone.route(/^https?:/,r=>r.abort());await standalone.goto(pathToFileURL(html).href);
 await standalone.getByRole('button',{name:'Start presentatie'}).click();
 assert.match(await standalone.locator('body').innerText(),/Mijn presentatie/);
 await standalone.screenshot({path:join(out,'eaistudio-export.png')});await standalone.close();
 await p.locator('[data-act="save-menu"]').first().click();
 const [jsonDownload]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'Projectbestand',exact:true}).click()]);
 const project=join(out,'eaistudio-project.json');await jsonDownload.saveAs(project);
 assert.equal(JSON.parse(await fs.readFile(project,'utf8')).meta.title,'Mijn presentatie\nMet interactie');
 // PWA helper files are present and the editor shell can reopen without a connection.
 await p.waitForFunction(()=>window.EAIdeckPWA?.isOfflineReady());
 await p.reload();await p.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 await p.context().setOffline(true);await p.reload();await p.locator('[data-key="meta.title"]').waitFor();await p.context().setOffline(false);
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:join(out,'eaistudio-mobiel.png'),fullPage:true});
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'EAIstudio heeft horizontale overflow');
 assert.deepEqual(errors,[]);console.log('Toolpublicatie geslaagd: NL/EN-overzicht, EAImesh-bladwijzer en configuratie, EAIstudio bewerken, presenteren, projectbestand, offline HTML en app-shell.');
}finally{await browser?.close();server?.kill()}
