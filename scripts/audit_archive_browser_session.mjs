// Keep asynchronous errors, storage and pending requests attached to the
// document under test. Never reuse a Page or BrowserContext across audit entries.
export async function inspectIsolatedPage(browser, options, entry, inspect, localOrigin=null){
  let context;
  const errors=[],details=[];
  try{
    context=await browser.newContext(options);
    if(localOrigin)await context.route('**/*',route=>{
      let sameOrigin=false;
      try{sameOrigin=new URL(route.request().url()).origin===localOrigin;}catch{}
      return sameOrigin?route.continue():route.abort();
    });
    const page=await context.newPage();
    page.on('pageerror',error=>{
      errors.push(error.message);
      details.push({message:error.message,stack:error.stack||null,pageUrl:page.url()});
    });
    await inspect(page);
  }catch(error){
    entry.failure=String(error?.message||error);
  }finally{
    // The listener remains attached while this context closes. Any errors from
    // closing pending resources belong here, never to a subsequent page.
    if(context){
      try{await context.close();}
      catch(error){entry.failure??='Browsercontext sluiten mislukt: '+String(error?.message||error);}
    }
    entry.jsErrors=errors;
    entry.jsErrorDetails=details;
  }
  return entry;
}

// Each isolated audit context starts without a LEIF session. These protected
// routes intentionally redirect to the login page; a commit of the initial
// document is not a signal that it is ready to measure.
const guestTargets=new Map([
  ['leif/continue/index.html','/leif/'],
  ['leif/verhaal/index.html','/leif/'],
  ['leif/mijn/index.html','/leif/'],
  ['leif/beheer/index.html','/leif/?beheer=1'],
]);

// Both legacy aliases end at the public research hub. DOMContentLoaded on
// the first redirect is not readiness of the final, fully styled document.
const researchAliases=new Set(['verdieping/index.html','kennis/index.html']);
const researchPages=new Set([...researchAliases,'nl/onderzoek/index.html']);

export async function openArchivePage(page,path,base,timeout=12000){
  await page.goto(base+'/'+path,{
    waitUntil:(guestTargets.has(path)||researchAliases.has(path))?'commit':'domcontentloaded',
    timeout
  });
  return waitForArchivePage(page,path,base,timeout);
}

export async function waitForArchivePage(page, path, base, timeout=12000){
  const guestTarget=guestTargets.get(path);
  if(guestTarget){
    const expected=new URL(guestTarget,base);
    await page.waitForURL(url=>url.origin===expected.origin&&
      url.pathname===expected.pathname&&url.search===expected.search&&
      !url.hash,{waitUntil:'load',timeout});
    await page.locator('#accessGate').waitFor({state:'visible',timeout});
    const admin=expected.searchParams.has('beheer');
    await page.locator(admin?'#adminLoginForm':'#accessForm').waitFor({state:'visible',timeout});
    const other=page.locator(admin?'#accessForm':'#adminLoginForm');
    await other.waitFor({state:'attached',timeout});
    await other.waitFor({state:'hidden',timeout});
    const privateContent=page.locator('#appRoot');
    await privateContent.waitFor({state:'attached',timeout});
    await privateContent.waitFor({state:'hidden',timeout});
    return {guestRedirect:page.url()};
  }
  if(researchPages.has(path)){
    await page.waitForURL(url=>url.origin===base&&
      url.pathname.replace(/index\.html$/,'')==='/nl/onderzoek/'&&!url.search&&!url.hash,
      {waitUntil:'load',timeout});
    await page.locator('main .knowledge-routes').waitFor({state:'visible',timeout});
    // Wait for fonts and layout of the destination, not a fixed delay on a redirect.
    await page.evaluate(async()=>{
      await document.fonts.ready;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    });
    return {researchDestination:page.url()};
  }
  if(path==='eai-tools-modules/index.html'){
    await page.waitForURL(url=>url.origin===base&&url.pathname==='/nl/tools/',{waitUntil:'load',timeout:12000});
    await page.locator('[data-eai-explore]').waitFor({state:'visible',timeout:12000});
    await page.evaluate(()=>document.fonts.ready);
  }
  if(path==='eai-blog/rapportage-wang-fan-2025/index.html'||path==='publicaties/wang-fan-2025/index.html'){
    await page.waitForURL(url=>url.origin===base&&url.pathname.replace(/index\.html$/,'')==='/publicaties/wang-fan-2025/',{waitUntil:'load',timeout:12000});
    await page.locator('#archive-review-note').waitFor({state:'visible',timeout:12000});
    await page.evaluate(()=>document.fonts.ready);
    const details=page.locator('details.archive-original');
    const summary=details.locator('summary');
    if(await details.getAttribute('open')!==null)throw Error('Historical text must be collapsed by default');
    await summary.click();
    const table=details.locator('.archive-table-scroll > table');
    await table.waitFor({state:'visible'});
    const layout=await table.evaluate(el=>{
      const wrap=el.parentElement;
      return {viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth,
        tableWidth:el.getBoundingClientRect().width,containerWidth:wrap.clientWidth,scrollWidth:wrap.scrollWidth,
        overflow:getComputedStyle(wrap).overflowX,rows:el.rows.length};
    });
    if(layout.rows<2||layout.document>layout.viewport+2||
       (layout.tableWidth>layout.containerWidth+2&&(layout.overflow!=='auto'&&layout.overflow!=='scroll'||layout.scrollWidth<layout.tableWidth-2))){
      throw Error('Historical article table is not accessible within the viewport: '+JSON.stringify(layout));
    }
    await summary.click();
    if(await details.getAttribute('open')!==null)throw Error('Historical text could not be collapsed');
    return {historicalTable:layout};
  }
  // This lab fetches its large, local atlas after DOMContentLoaded. Test the
  // actual loaded model before collecting layout evidence or closing the page.
  // A failed/fallback model is a failure, not a waived JavaScript exception.
  if(new URL(page.url()).pathname.replace(/index\.html$/,'')==='/tools/anatomie/labs/hartslag/'){
    const ready=await page.waitForFunction(()=>{
      const s=window.__EAI_HEART_LAB__?.state;
      return s&&(s.atlasReady||s.atlasError)?{atlasRich:s.atlasRich,atlasReady:s.atlasReady,atlasError:s.atlasError,atlasPartCount:s.atlasPartCount}:false;
    },undefined,{timeout:40000});
    let state;
    try{state=await ready.jsonValue();}finally{await ready.dispose();}
    if(!state.atlasReady||!state.atlasRich||state.atlasPartCount!==34){
      throw Error('Hartslaglab: uitgebreid hartmodel niet geladen: '+JSON.stringify(state));
    }
    await page.locator('#atlasLoading').waitFor({state:'hidden',timeout:12000});
    return {heartAtlas:state};
  }
  return {};
}
