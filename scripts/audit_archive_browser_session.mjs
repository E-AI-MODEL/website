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

export async function waitForArchivePage(page, path, base){
  if(path==='eai-tools-modules/index.html'){
    await page.waitForURL(url=>url.origin===base&&url.pathname==='/nl/tools/',{waitUntil:'load',timeout:12000});
    await page.locator('[data-eai-explore]').waitFor({state:'visible',timeout:12000});
    await page.evaluate(()=>document.fonts.ready);
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
