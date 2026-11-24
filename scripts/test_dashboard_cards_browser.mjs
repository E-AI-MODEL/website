import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const root = process.argv[2] || "site-build";
const base = "http://127.0.0.1:8789";
const server = spawn("python3", ["-m", "http.server", "8789", "--bind", "127.0.0.1", "--directory", root], { stdio:"ignore" });
let browser;
try {
  for (let n=0;n<50;n++) {
    try { const response=await fetch(base); if(response.ok)break; }catch {}
    await new Promise(resolve=>setTimeout(resolve,110));
  }
  browser=await chromium.launch({headless:true});
  mkdirSync("test-results",{recursive:true});
  const errors=[];
  for(const width of [1440, 768, 390, 320]) {
    const context=await browser.newContext({viewport:{width,height:900}});
    const page=await context.newPage();
    page.on("pageerror",error=>errors.push(width+": "+error.message));
    await page.route("**/*",route=>route.request().url().startsWith(base)?route.continue():route.abort());
    await page.goto(base+"/",{waitUntil:"load"});
    assert(await page.locator("body.eai-dash-page main.eai-dashboard-home").isVisible(),"Dashboard layout missing");
    assert.equal(await page.locator("main h1").count(),1);
    assert.equal(await page.locator("main .eai-landing-route").count(),4);
    assert.equal(await page.locator("header.eai-masthead").count(),1);
    assert.equal(await page.locator("main .eai-dash-step").count(),4);
    await page.screenshot({path:"test-results/dashboard-cards-"+width+".png",fullPage:true});
    const bounds=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
    assert(bounds.page<=bounds.viewport+1,"Horizontal scrolling at "+width+": "+JSON.stringify(bounds));
    if(width<=390){
      const widths=await page.locator(".eai-landing-route p").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
      assert(widths.every(w=>w>=145),"Card descriptions must remain readable: "+widths.join(","));
      const positions=await page.evaluate(()=>({direct:document.querySelector(".eai-dash-direct").getBoundingClientRect().top,side:document.querySelector(".eai-dash-side").getBoundingClientRect().top}));
      assert(positions.direct<positions.side,"Direct links should precede optional widgets on a phone");
    }
    assert.equal(await page.locator("main .eai-dash-rail").count(),0,"Homepage must not duplicate site navigation");
    assert.equal(await page.locator("main .eai-dash-route-controls").count(),0,"Only four routes need no filters");
    assert.equal(await page.locator("main .eai-landing-route:visible").count(),4,"All four destinations must stay visible");
    for(const href of ["/nl/model/","/nl/onderwijs/","/nl/onderzoek/","/nl/tools/"]){
      assert.equal(await page.locator('main .eai-landing-route[href="'+href+'"]').count(),1);
    }
    await page.locator('[data-dash-step="2"]').click();
    assert.match(await page.locator("#eai-dash-step-detail").innerText(),/Handeling/);
    assert.equal(await page.locator('.eai-dash-step[aria-pressed="true"]').count(),1);
    assert.equal(await page.locator('.eai-dash-table>a[href="/tools/eaigit/"]').count(),1);
    await context.close();
  }
  // Dutch and English home share the same information structure and actions.
  {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.route("**/*",route=>route.request().url().startsWith(base)?route.continue():route.abort());
    await page.goto(base+"/en/",{waitUntil:"load"});
    assert.equal(await page.locator("main.eai-dashboard-home .eai-landing-route").count(),4);
    assert.equal(await page.locator("main.eai-dashboard-home .eai-dash-rail").count(),0);
    await page.locator('[data-dash-step="2"]').click();
    assert.match(await page.locator("#eai-dash-step-detail").innerText(),/Core action/);
    assert.equal(await page.locator("main.eai-dashboard-home .eai-landing-route[href='/en/education/']").count(),1);
    await page.close();
  }
  for(const route of ["/nl/tools/","/nl/onderwijs/","/nl/onderzoek/","/nl/toepassingen/"]) {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.route("**/*",route=>route.request().url().startsWith(base)?route.continue():route.abort());
    await page.goto(base+route,{waitUntil:"load"});
    assert.equal(await page.locator("body.eai-card-index").count(),1,"Missing card index scope "+route);
    assert.equal(await page.locator('link[href*="site-dashboard-cards."]').count(),1);
    assert.equal(await page.locator('script[src*="site-dashboard-cards."]').count(),0);
    const sizes=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert(sizes.doc<=sizes.client+1,"Index horizontal overflow "+route+": "+JSON.stringify(sizes));
    await page.close();
  }
  for(const route of ["/tools/anatomie/","/tools/eaigame/","/tools/science-observatory/labs/natuurkunde/"]) {
    const page=await browser.newPage();
    await page.route("**/*",route=>route.request().url().startsWith(base)?route.continue():route.abort());
    const labResponse=await page.goto(base+route,{waitUntil:"domcontentloaded"});
    assert(labResponse?.ok(),"Lab route must exist: "+route);
    assert.equal(await page.locator("body.eai-dash-page,body.eai-card-index").count(),0,route);
    assert.equal(await page.locator('link[href*="site-dashboard-cards."]').count(),0,route);
    await page.close();
  }
  assert.deepEqual(errors,[],"No unhandled JavaScript errors on dashboard");
  console.log("Dashboard cards: desktop, tablet, mobile, unique navigation, route links, model buttons and lab isolation OK");
} finally {
  if(browser) await browser.close();
  server.kill();
}