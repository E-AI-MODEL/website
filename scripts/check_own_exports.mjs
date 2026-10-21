// Only owned pages. Real exports, synthetic input, no external apps or AI calls.
import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.EAI_TEST_URL || 'http://127.0.0.1:8789';
const out = 'own-export-results';
mkdirSync(out, { recursive: true });
const server = process.env.EAI_TEST_URL ? null : spawn('python3', ['-m','http.server','8789','--bind','127.0.0.1','--directory','site-build'], { stdio:'ignore' });
const reports = [];
async function saveDownload(page, selector, name) {
  const pending = page.waitForEvent('download', { timeout: 20000 });
  await page.locator(selector).click();
  const download = await pending;
  const error = await download.failure();
  assert.equal(error, null, `${name}: ${error}`);
  await download.saveAs(`${out}/${name}`);
  const data = readFileSync(`${out}/${name}`);
  assert(data.length > 100, `${name}: empty file`);
  return data;
}
try {
  for(let i=0;i<40;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    const context = await browser.newContext({ viewport: {width:390,height:844}, acceptDownloads:true });
    await context.route('**/*', route => {
      const u = new URL(route.request().url());
      const allowed = u.origin === base || u.protocol === 'data:' || u.protocol === 'blob:' ||
        (u.hostname === 'cdnjs.cloudflare.com' && /^\/ajax\/libs\/(gsap\/3\.11\.4\/gsap\.min\.js|jspdf\/2\.5\.1\/jspdf\.umd\.min\.js|html2canvas\/1\.4\.1\/html2canvas\.min\.js)$/.test(u.pathname));
      return allowed && ['GET','HEAD'].includes(route.request().method()) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const dialogs = [];
    page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
    try {
      await page.goto(base+'/publicaties/eai-stappenplan/', {waitUntil:'load',timeout:30000});
      await page.waitForFunction(() => typeof html2canvas === 'function' && typeof window.jspdf?.jsPDF === 'function', {timeout:15000});
      await page.locator('#next-btn').click();
      await page.locator('#next-btn').click();
      assert.match(dialogs.at(-1), /Kies eerst minimaal een taak/);
      for(const button of await page.locator('.add-task-btn').all()) await button.click();
      await page.locator('#next-btn').click();
      for(const card of await page.locator('.config-card').all()) {
        const radio = card.locator('input[value=samen]');
        await card.locator(`label[for="${await radio.getAttribute('id')}"]`).click();
        await card.locator('input[type=range]').fill('65');
        await card.locator('input[type=range]').dispatchEvent('input');
      }
      await page.locator('.config-card input[type=checkbox]').first().check();
      await page.locator('#next-btn').click();
      const summary = await page.locator('#final-summary-visual').innerText();
      assert.equal((summary.match(/65%/g)||[]).length,6);
      assert.match(summary,/Reflecteren/);
      await page.screenshot({path:`${out}/${engine.name()}-summary.png`,fullPage:true});
      const png = await saveDownload(page,'#export-png-btn',`${engine.name()}-workflow.png`);
      assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
      const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
      reports.push({engine:engine.name(),test:'png_download',passed:true,bytes:png.length,width,height});
      const pdf = await saveDownload(page,'#export-pdf-btn',`${engine.name()}-workflow.pdf`);
      assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
      const pdfText = pdf.toString('latin1');
      assert(pdfText.includes('%%EOF'));
      const pages = (pdfText.match(/\/Type\s*\/Page\b/g)||[]).length;
      const minimumPages = Math.ceil(height / width * 210 / 297 - 0.001);
      reports.push({engine:engine.name(),test:'pdf_download',passed:pages>=minimumPages,bytes:pdf.length,pages,minimumPages});
      assert(pages>=minimumPages, `Long workflow is clipped: ${pages} PDF pages; at least ${minimumPages} needed`);
    } catch(e) { reports.push({engine:engine.name(),test:'workflow_export',passed:false,error:e.message}); }
    try {
      await page.goto(base+'/tools/prompt-framework/',{waitUntil:'domcontentloaded'});
      await page.locator('#pf-goal').fill('Twee historische bronnen vergelijken.');
      await page.locator('#pf-central').fill('De leerling weegt beide perspectieven.');
      await page.locator('#pf-generate').click();
      const text = await saveDownload(page,'#pf-download',`${engine.name()}-prompt.txt`);
      assert(text.toString().includes('Twee historische bronnen vergelijken.'));
      reports.push({engine:engine.name(),test:'prompt_download',passed:true,bytes:text.length});
      await page.goto(base+'/tools/van-proces-naar-prompt/',{waitUntil:'domcontentloaded'});
      await page.locator('#example-lesson').click();
      await page.locator('#human').fill('De leerling vergelijkt twee bronperspectieven.');
      await page.locator('#human').dispatchEvent('input');
      const txt = await saveDownload(page,'#download',`${engine.name()}-process.txt`);
      assert(txt.toString().includes('twee bronperspectieven'));
      reports.push({engine:engine.name(),test:'process_download',passed:true,bytes:txt.length});
    } catch(e) { reports.push({engine:engine.name(),test:'prompt_tools',passed:false,error:e.message}); }
    reports.push({engine:engine.name(),test:'javascript_errors',passed:errors.length===0,errors});
    await browser.close();
  }
} finally {
  if(server)server.kill();
  writeFileSync(`${out}/results.json`,JSON.stringify({base,reports},null,2));
  console.log(JSON.stringify({base,reports},null,2));
  if(!reports.length || reports.some(r=>r.passed===false)) process.exitCode=1;
}
