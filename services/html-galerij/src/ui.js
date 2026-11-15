// Private gallery interface, served only after the Worker verified the session.
export function privatePage(email) {
  const safeEmail=String(email).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return '<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Mijn HTML-galerij | EAI</title>' +
  '<style>' +
  ':root{--bg:#f7f8f4;--ink:#193027;--muted:#65766a;--line:#dbe6dc;--green:#27573f}*{box-sizing:border-box}' +
  'body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,sans-serif}button,input{font:inherit}' +
  'button{cursor:pointer}button:disabled{opacity:.55;cursor:default}a{color:var(--green)}' +
  ':focus-visible{outline:3px solid #8aba9d;outline-offset:3px}' +
  '.wrap{max-width:1120px;margin:auto;padding:0 24px}.top{background:#fff;border-bottom:1px solid var(--line)}' +
  '.nav{display:flex;min-height:70px;align-items:center;gap:18px;flex-wrap:wrap}.brand{font-weight:750;color:var(--ink);text-decoration:none}' +
  '.account{color:var(--muted);font-size:12px;margin-left:auto}.exit{border:1px solid var(--line);background:#fff;padding:8px 12px;border-radius:7px}' +
  'h1,h2{font-family:Georgia,serif;font-weight:400;letter-spacing:-.025em}h1{font-size:clamp(37px,5vw,53px);margin:13px 0 10px}h2{font-size:29px;margin:0 0 8px}' +
  '.eyebrow{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#4d7960;font-weight:750}' +
  '.hero{padding:50px 0 38px}.hero p{max-width:62ch;color:var(--muted);font-size:16px;margin:0}' +
  '.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:28px;align-items:start;padding-bottom:70px}' +
  '.panel{background:#fff;border:1px solid var(--line);padding:25px;border-radius:12px;box-shadow:0 8px 30px #18382908}' +
  '.panel p{color:var(--muted);font-size:13px}.field{margin:17px 0}label{display:block;font-size:13px;font-weight:650;margin-bottom:6px}' +
  'input[type=text],input[type=search],input[type=file]{width:100%;min-height:42px;border:1px solid #c7d9cd;border-radius:7px;background:#fff;padding:10px;color:var(--ink)}' +
  'input[type=file]{font-size:12px}.primary{background:var(--green);border:0;border-radius:7px;color:#fff;padding:12px 18px;font-weight:650;min-height:43px}' +
  '.status{min-height:26px;color:#355e46;font-size:13px}.error{color:#a33232}.gallery-head{display:flex;gap:16px;justify-content:space-between;align-items:center;margin-bottom:14px}' +
  '.gallery-head input{max-width:210px}.cards{display:grid;gap:12px}.card{border:1px solid var(--line);border-radius:9px;padding:17px;display:flex;gap:12px;justify-content:space-between;align-items:center}' +
  '.card h3{font-size:16px;margin:0 0 4px}.card p{font-size:12px;margin:0 0 8px;overflow-wrap:anywhere}.actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center}' +
  '.actions button{border:0;background:none;padding:0;text-decoration:underline;color:var(--green);font-size:12px}' +
  '.remove{white-space:nowrap;background:#fff7f5;border:1px solid #efc9c4;border-radius:6px;color:#992e29;padding:9px;font-size:12px}' +
  '.empty{padding:25px;border:1px dashed var(--line);border-radius:9px;color:var(--muted)}' +
  'dialog{width:min(980px,94vw);max-height:90vh;padding:0;border-radius:10px;border:1px solid var(--line);background:white}dialog::backdrop{background:#101d18b8}' +
  '.dialog-head{display:flex;align-items:center;gap:16px;padding:12px 16px;border-bottom:1px solid var(--line)}.dialog-head button{margin-left:auto;border:1px solid var(--line);background:white;padding:7px 12px;border-radius:6px}' +
  'iframe{display:block;width:100%;height:70vh;border:0}' +
  '@media(max-width:800px){.cols{grid-template-columns:1fr}.nav{gap:10px}.account{flex-basis:100%;order:3;margin:0 0 12px}.hero{padding:32px 0}.gallery-head{align-items:stretch;flex-direction:column}.gallery-head input{max-width:none}}' +
  '</style></head><body>' +
  '<header class="top"><div class="wrap nav"><a class="brand" href="https://eaimodel.nl/">EAI</a><span>HTML-galerij</span>' +
  '<span class="account">Ingelogd als ' + safeEmail + '</span><form method="post" action="/auth/logout"><button class="exit">Uitloggen</button></form></div></header>' +
  '<main class="wrap"><section class="hero"><span class="eyebrow">Beveiligde omgeving</span><h1>Mijn HTML-galerij</h1>' +
  '<p>Voeg een HTML-bestand toe, bekijk je bestanden of haal een pagina offline. Alleen jij hebt toegang.</p></section>' +
  '<div class="cols"><section class="panel" aria-label="Toevoegen"><h2>Bestand toevoegen</h2><p>Maximaal 1 MB. De pagina is alleen bereikbaar na inloggen.</p>' +
  '<form id="upload-form"><div class="field"><label for="author">Naam maker</label><input id="author" name="author" type="text" autocomplete="name" maxlength="80" required></div>' +
  '<div class="field"><label for="title">Titel</label><input id="title" name="title" type="text" maxlength="120" required></div>' +
  '<div class="field"><label for="file">HTML-bestand</label><input id="file" name="file" type="file" accept=".htm,.html,text/html" required></div>' +
  '<button id="publish" class="primary" type="submit">Toevoegen</button><p class="status" id="status" role="status" aria-live="polite"></p></form>' +
  '<p>Gebruik geen persoonsgegevens, wachtwoorden of sleutels in geüploade HTML. Scripts in een voorbeeld draaien in een afgeschermd venster.</p></section>' +
  '<section class="panel" aria-labelledby="gallery-title"><div class="gallery-head"><h2 id="gallery-title">Mijn bestanden</h2>' +
  '<input id="search" type="search" aria-label="Bestanden zoeken" placeholder="Zoeken"></div>' +
  '<div id="cards" class="cards" aria-live="polite"><p class="empty">Bestanden laden…</p></div></section></div></main>' +
  '<dialog id="viewer"><div class="dialog-head"><strong id="viewer-title">Voorbeeld</strong>' +
  '<button id="close-viewer">Sluiten</button></div>' +
  '<iframe id="viewer-frame" title="HTML-voorbeeld" sandbox="allow-scripts allow-forms allow-modals allow-downloads" referrerpolicy="no-referrer"></iframe></dialog>' +
  '<script>' +
  '(function(){ "use strict";' +
  'const form=document.querySelector("#upload-form");const cards=document.querySelector("#cards");' +
  'const status=document.querySelector("#status");const search=document.querySelector("#search");' +
  'const viewer=document.querySelector("#viewer");const frame=document.querySelector("#viewer-frame");' +
  'let items=[];' +
  'const validId=id=>/^[0-9]{13}-[a-f0-9-]{36}$/.test(id);' +
  'function message(text,failed){status.textContent=text;status.classList.toggle("error",!!failed);}' +
  'async function request(path,options){const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...options});' +
  'if(response.status===401){location.assign("/auth/login");throw Error("Je sessie is verlopen.");}' +
  'if(!response.ok){const body=await response.json().catch(()=>({}));throw Error(body.error||"Verzoek mislukt.");}return response;}' +
  'function render(){cards.replaceChildren();const q=search.value.trim().toLowerCase();' +
  'const filtered=items.filter(x=>(x.title+" "+x.author+" "+x.filename).toLowerCase().includes(q));' +
  'if(!filtered.length){const empty=document.createElement("p");empty.className="empty";empty.textContent=q?"Geen resultaten.":"Nog geen bestanden toegevoegd.";cards.append(empty);return;}' +
  'for(const item of filtered){if(!validId(item.id))continue;const el=document.createElement("article");el.className="card";' +
  'const desc=document.createElement("div");const title=document.createElement("h3");title.textContent=item.title;desc.append(title);' +
  'const p=document.createElement("p");p.textContent="Door "+item.author+" · "+item.filename;desc.append(p);' +
  'const actions=document.createElement("div");actions.className="actions";' +
  'const open=document.createElement("button");open.textContent="Voorbeeld";open.addEventListener("click",()=>{document.querySelector("#viewer-title").textContent=item.title;frame.src="/view/"+item.id;viewer.showModal();});' +
  'const tab=document.createElement("a");tab.href="/view/"+item.id;tab.target="_blank";tab.rel="noopener noreferrer";tab.textContent="Open in tabblad";' +
  'actions.append(open,tab);desc.append(actions);' +
  'const remove=document.createElement("button");remove.className="remove";remove.textContent="Verbergen";remove.setAttribute("aria-label","Verberg "+item.title);' +
  'remove.addEventListener("click",async()=>{if(!confirm("Wil je "+item.title+" offline halen?"))return;remove.disabled=true;' +
  'try{await request("/api/admin/uploads/"+item.id,{method:"DELETE"});await load();message("Bestand offline gehaald.");}' +
  'catch(error){message(error.message,true);}finally{remove.disabled=false;}});' +
  'el.append(desc,remove);cards.append(el);}}' +
  'async function load(){try{const res=await request("/api/uploads");const data=await res.json();items=Array.isArray(data.items)?data.items:[];render();}' +
  'catch(error){cards.replaceChildren();const p=document.createElement("p");p.className="empty";p.textContent=error.message;cards.append(p);}}' +
  'search.addEventListener("input",render);' +
  'form.addEventListener("submit",async event=>{event.preventDefault();const file=document.querySelector("#file").files[0];' +
  'if(!file||file.size>1024*1024){message("Kies een HTML-bestand van maximaal 1 MB.",true);return;}' +
  'const button=document.querySelector("#publish");button.disabled=true;message("Bestand toevoegen…");' +
  'try{const data=new FormData(form);await request("/api/uploads",{method:"POST",body:data});form.reset();await load();message("Bestand toegevoegd.");}' +
  'catch(error){message(error.message,true);}finally{button.disabled=false;}});' +
  'document.querySelector("#close-viewer").addEventListener("click",()=>viewer.close());' +
  'viewer.addEventListener("close",()=>frame.removeAttribute("src"));load();' +
  '})();' +
  '</script></body></html>';
}
