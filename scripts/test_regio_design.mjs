import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(process.argv[2] || '.');
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  const relative = pathname.endsWith('/') ? pathname+'index.html' : pathname;
  const target = path.resolve(root, '.'+relative);
  if (!target.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  fs.readFile(target,(error,bytes)=>{
    if(error){res.writeHead(404).end();return;}
    const mime = target.endsWith('.html')?'text/html; charset=utf-8':target.endsWith('.css')?'text/css; charset=utf-8':target.endsWith('.js')?'text/javascript; charset=utf-8':'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime});res.end(bytes);
  });
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base = 'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const folder='test-results/onderwijsregio';
fs.mkdirSync(folder,{recursive:true});
try{
 for(const device of [{name:'desktop',width:1440,height:900},{name:'iphone-small',width:375,height:812},{name:'iphone-mini',width:320,height:700}]){
   const page=await browser.newPage({viewport:{width:device.width,height:device.height},deviceScaleFactor:1,isMobile:device.name!=='desktop',hasTouch:device.name!=='desktop'});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   const response=await page.goto(base+'/nl/onderwijsregio-proef/',{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200);
   await page.locator('#faq details').first().waitFor();
   assert.equal(await page.locator('#faq details').count()>20,true,'FAQ loaded');
   assert.equal(await page.locator('#bookingForm').count(),1,'Booking simulator present');
   assert.equal(await page.locator('#vacancyCards').count(),1,'Filterable vacancy simulator present');
   assert.equal(await page.locator('#phaseDetails').isVisible(),true,'Step content displayed');
   assert.equal(await page.locator('#mastNav').isHidden(),true);
   await page.screenshot({path:folder+'/'+device.name+'-page.png',fullPage:true});
   assert.equal(await page.locator('.sample-vacancy').count(),3,'All sample vacancies visible');
   await page.locator('#vacancySector').selectOption('PO');
   assert.equal(await page.locator('.sample-vacancy').count(),1,'PO filter works');
   await page.locator('#vacancySector').selectOption('');
   await page.locator('#demoSubject').selectOption('route');
   await page.locator('#demoDate').selectOption({index:1});
   await page.locator('#demoSlot').selectOption('09:30');
   await page.locator('#bookingForm button[type="submit"]').click();
   assert.equal(await page.locator('#bookingConfirmation').isVisible(),true,'Booking simulation confirms choice');
   assert.ok((await page.locator('#bookingStatus').textContent()).includes('niets verzonden'),'No booking made');
   await page.locator('#editBooking').click();
   assert.equal(await page.locator('#bookingForm').isVisible(),true,'Booking can be edited');
   await page.locator('#bookingForm').evaluate(el=>el.reset());
   await page.locator('#mastMenu').click();
   assert.equal(await page.locator('#mastNav').isVisible(),true,'navigation opens');
   await page.screenshot({path:folder+'/'+device.name+'-menu.png'});
   await page.locator('#openSearch').click();
   await page.locator('#query').fill('deeltijd');
   await page.locator('#search button').click();
   assert.ok((await page.locator('#searchStatus').textContent()).trim().length>0,'search has a message');
   await page.locator('#mastMenu').click();
   await page.locator('#toggle').click();
   assert.equal(await page.locator('#dot').isVisible(),true,'assist control appears');
   assert.equal(await page.locator('#pie').isHidden(),true,'no unwanted popup');
   await page.locator('#dot').click();
   assert.equal(await page.locator('#pie').isVisible(),true,'radial menu opens');
   assert.equal(await page.locator('#pie svg g[role="button"]').count(),4,'three sectors plus close');
   const wheelRect=await page.locator('#pie').boundingBox();
   assert.ok(wheelRect.x>=0&&wheelRect.x+wheelRect.width<=device.width+1,'Pie fits screen');
   assert.ok(wheelRect.width<=280,'Wheel must not be huge');
   assert.ok(wheelRect.y<=120,'Wheel opens close to toolbar, not over article');
   await page.screenshot({path:folder+'/'+device.name+'-wheel.png'});
   await page.locator('#guideButton').click();
   assert.equal(await page.locator('#panel').isVisible(),true,'help appears');
   await page.locator('#close').click();
   await page.locator('#dot').click();
   await page.locator('#prefsButton').click();
   assert.equal(await page.locator('#prefs').isVisible(),true,'preferences accessible');
   await page.locator('#done').click();
   assert.equal(await page.locator('#pie').isHidden(),true,'Preferences close to quiet reading mode');
   const overflow=await page.evaluate(()=>({body:document.body.scrollWidth,html:document.documentElement.scrollWidth,width:innerWidth}));
   assert.ok(overflow.body<=overflow.width+2&&overflow.html<=overflow.width+2,'No page overflow at '+device.name+': '+JSON.stringify(overflow));
   assert.deepEqual(errors,[],'No runtime errors at '+device.name);
   console.log(device.name+': navigation, search, booking, vacancies, compact help, preferences and width verified');
   await page.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
