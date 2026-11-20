import {
  getActiveSession, listSessions, selectSession, storeSession, deleteSession,
  exportSessionData, importSessionData
} from './session-store.js';

const $ = id => document.getElementById(id);
const panel = $('panel');
const stage = $('stage');
const scroll = $('studioScroll');
const tabs = Array.from(document.querySelectorAll('.studio-tab'));
const pages = Array.from(document.querySelectorAll('.studio-page'));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let revealObserver = null;
let idleControlsTimer = null;
let idleCaptionsTimer = null;
let idleStudioTimer = null;
let captionIdleSeconds = 12;
let editingId = null;
let lastOpenState = null;

try {
  const stored = localStorage.getItem('eai-cloud-caption-idle-seconds');
  if (stored !== null) {
    const value = Number(stored);
    if ([0,8,12,20,30].includes(value)) captionIdleSeconds = value;
  }
} catch {}

function markActivity() {
  document.body.classList.remove('cloud-idle');
  scroll.classList.remove('is-idle');
  stage.classList.remove('captions-evaporated');
  clearTimeout(idleControlsTimer);
  clearTimeout(idleCaptionsTimer);
  clearTimeout(idleStudioTimer);
  idleControlsTimer = setTimeout(() => {
    if (!panel.classList.contains('open')) document.body.classList.add('cloud-idle');
  }, 7200);
  idleStudioTimer = setTimeout(() => {
    if (panel.classList.contains('open') &&
      !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
      scroll.classList.add('is-idle');
    }
  }, 22000);
  if (captionIdleSeconds > 0 && !reduceMotion.matches && stage.dataset.phase === 'live') {
    idleCaptionsTimer = setTimeout(() => {
      if (stage.dataset.phase === 'live' && !panel.classList.contains('open')) {
        stage.classList.add('captions-evaporated');
      }
    },captionIdleSeconds*1000);
  }
}
for (const type of ['pointermove','pointerdown','touchstart','keydown','focusin']) {
  window.addEventListener(type,markActivity,{passive:true});
}
// A new piece of recognized and translated text is activity, even if nobody touches the screen.
const captionObserver = new MutationObserver(() => {
  if (stage.dataset.phase === 'live') markActivity();
});
captionObserver.observe($('displayText'), {subtree:true,childList:true,characterData:true});

function revealVisible() {
  if (revealObserver) revealObserver.disconnect();
  const active = pages.find(page => !page.hidden);
  if (!active) return;
  const elements = Array.from(active.querySelectorAll('.cloud-reveal'));
  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    elements.forEach(el => el.classList.add('is-revealed'));
    return;
  }
  elements.forEach(el => el.classList.remove('is-revealed'));
  revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        revealObserver.unobserve(entry.target);
      }
    }
  }, {root:scroll,threshold:.06,rootMargin:'0px 0px 38px 0px'});
  elements.forEach(el => revealObserver.observe(el));
}

function activateView(name, options={focus:false}) {
  const tab = tabs.find(item => item.dataset.studioView === name);
  if (!tab) return;
  for (const item of tabs) {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
  }
  for (const page of pages) page.hidden = page.dataset.studioPage !== name;
  scroll.scrollTop = 0;
  if (options.focus) tab.focus({preventScroll:true});
  markActivity();
  requestAnimationFrame(revealVisible);
}
for (const tab of tabs) {
  tab.addEventListener('click',() => activateView(tab.dataset.studioView,{focus:true}));
  tab.addEventListener('keydown',event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1
      : (index + (event.key === 'ArrowRight'?1:-1) + tabs.length)%tabs.length;
    activateView(tabs[next].dataset.studioView,{focus:true});
  });
}

function onStudioVisibility() {
  const open = panel.classList.contains('open');
  if (lastOpenState === open) return;
  lastOpenState = open;
  panel.inert = !open;
  document.body.classList.toggle('cloud-studio-open',open);
  if (open) {
    // Keep the last selected section while working; the stage is still empty.
    const current = tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0];
    activateView(current.dataset.studioView);
    markActivity();
  } else {
    revealObserver?.disconnect();
    markActivity();
  }
}
new MutationObserver(onStudioVisibility).observe(panel,{attributes:true,attributeFilter:['class']});
onStudioVisibility();
markActivity();

// Bescheiden, herbruikbare sessies. De standaard DELF-tekst wordt nooit gewijzigd.
const sessionSelect = $('sessionSelect');
const editor = $('sessionEditor');
const status = $('sessionStatus');
const fields = {
  name:$('sessionTitle'),
  opening:$('editOpening'),
  reply:$('editReply'),
  interrupt:$('editInterrupt'),
  speech:$('editSpeech'),
  handback:$('editHandback'),
  closing:$('editClosing')
};
function report(message,kind='') {
  status.textContent = message;
  status.classList.remove('good','bad');
  if (kind) status.classList.add(kind);
}
function canEditSession() {
  if (['intro','stopped'].includes(stage.dataset.phase)) return true;
  report('Stop eerst de lopende voorstelling. Daarna kun je een sessie kiezen.','bad');
  return false;
}
function syncSessionUI() {
  const chosen = getActiveSession();
  sessionSelect.replaceChildren();
  listSessions().forEach(item => {
    const option = new Option(item.name, item.id, false, item.id === chosen.id);
    sessionSelect.add(option);
  });
  $('studioSessionLabel').textContent = chosen.name;
  if (!editor.hidden && editingId === chosen.id) {
    // Do not overwrite changes in the editor while the user is typing.
    return;
  }
  report(chosen.id === 'delf'
    ? 'De goedgekeurde DELF-tekst staat vast. Je kunt voor een volgende gelegenheid een nieuwe sessie maken.'
    : 'Deze sessie is alleen op dit apparaat bewaard. Exporteer de tekst om hem mee te nemen.','');
}
sessionSelect.addEventListener('change',() => {
  if (!canEditSession()) { syncSessionUI(); return; }
  try {
    selectSession(sessionSelect.value);
    editor.hidden = true;editingId = null;
    report('Sessie geopend. De teksten voor de AI-overname zijn aangepast.','good');
  } catch(error){report(error.message,'bad');syncSessionUI();}
});
function showEditor(mode) {
  if (!canEditSession()) return;
  const current = getActiveSession();
  editingId = mode === 'edit' && current.id !== 'delf' ? current.id : null;
  const from = editingId ? current : {
    name:'',opening:'',reply:'',interrupt:'',speech:'',handback:'',closing:''
  };
  for (const [key,element] of Object.entries(fields)) element.value = from[key] || '';
  editor.hidden = false;
  editor.classList.add('is-revealed');
  scrollToEditor();
}
function scrollToEditor() {
  requestAnimationFrame(() => {
    editor.scrollIntoView({behavior:reduceMotion.matches?'auto':'smooth',block:'start'});
  });
}
$('newSession').addEventListener('click',()=>showEditor('new'));
$('cancelSession').addEventListener('click',()=>{
  editor.hidden = true;
  editingId = null;
  report('Niet opgeslagen.');
});
$('saveSession').addEventListener('click',() => {
  if (!canEditSession()) return;
  const values = Object.fromEntries(Object.entries(fields).map(([key,element]) => [key,element.value]));
  try {
    const saved = storeSession(values,editingId);
    editor.hidden = true; editingId = null;
    syncSessionUI();
    report('Sessie '+saved.name+' is bewaard op dit apparaat.','good');
  } catch(error){report(error.message,'bad');}
});
$('exportSession').addEventListener('click',() => {
  try {
    const current = getActiveSession();
    const blob = new Blob([exportSessionData()],{type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url;
    a.download='podium-'+current.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40)+'.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    report('Sessie opgeslagen als bestand.','good');
  } catch(error){report(error.message,'bad');}
});
$('editSession').addEventListener('click',() => {
  if (getActiveSession().id === 'delf') {
    report('Maak een nieuwe sessie om de goedgekeurde DELF-tekst te behouden.','bad');
    return;
  }
  showEditor('edit');
});
$('deleteSession').addEventListener('click',() => {
  if (!canEditSession()) return;
  const current = getActiveSession();
  if (current.id === 'delf') {
    report('De DELF-sessie kan niet worden verwijderd.','bad');return;
  }
  if (!confirm('Sessie "'+current.name+'" van dit apparaat verwijderen?')) return;
  try {
    deleteSession(current.id);
    syncSessionUI();
    report('De sessie is verwijderd. DELF scolaire is weer geselecteerd.','good');
  } catch(error){report(error.message,'bad');}
});
$('importSession').addEventListener('click',()=>$('sessionImportFile').click());
$('sessionImportFile').addEventListener('change',async event=>{
  const file=event.target.files?.[0];
  if (!file) return;
  if (!canEditSession()) {event.target.value='';return;}
  try {
    if (file.size>200000) throw new Error('Dit bestand is te groot.');
    const imported=importSessionData(await file.text());
    editor.hidden=true;editingId=null;
    syncSessionUI();
    report('Sessie '+imported.name+' is geladen.','good');
  } catch(error){report(error.message,'bad');}
  finally{event.target.value='';}
});
window.addEventListener('cloud-session-change',syncSessionUI);
syncSessionUI();

// Vrije keuze van stilstandduur voor podiumtekst. Geen vooraf ingevulde ondertitels.
const captionSelect = $('idleCaptionSeconds');
captionSelect.value = String(captionIdleSeconds);
captionSelect.addEventListener('change',() => {
  const n=Number(captionSelect.value);
  if (![0,8,12,20,30].includes(n)) return;
  captionIdleSeconds=n;
  try {localStorage.setItem('eai-cloud-caption-idle-seconds',String(n));} catch {}
  markActivity();
});
