import {initMistVoiceUI} from './mist-voice-ui.mjs';

const $ = id => document.getElementById(id);
const panel = $('panel');
const stage = $('stage');
const scroll = $('studioScroll');
const tabs = Array.from(document.querySelectorAll('.studio-tab'));
const pages = Array.from(document.querySelectorAll('.studio-page'));
const moreMenu=$('extraStudioTabs'),moreLabel=$('studioMoreLabel');
const moreSummary=moreMenu.querySelector('summary'),moreLinks=moreMenu.querySelector('.studio-extra-links');
let moreClosingTimer=null;
const extraViews=new Set(['stem','sessie','meer']);
const extraNames={stem:'Stem',sessie:'Voorlezen',meer:'Techniek'};
function positionMoreMenu(){
  if(!moreMenu.open)return;
  const anchor=moreSummary.getBoundingClientRect();
  const width=165,margin=12;
  const left=Math.max(margin,Math.min(anchor.right-width,window.innerWidth-width-margin));
  const top=Math.max(margin,Math.min(anchor.bottom+7,window.innerHeight-moreLinks.offsetHeight-margin));
  moreLinks.style.setProperty('--extra-menu-left',left+'px');
  moreLinks.style.setProperty('--extra-menu-top',top+'px');
}
function closeMoreMenu(immediate=false){
  clearTimeout(moreClosingTimer);
  if(!moreMenu.open){moreMenu.classList.remove('is-closing');return;}
  if(immediate||window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    moreMenu.open=false;moreMenu.classList.remove('is-closing');return;
  }
  moreMenu.classList.add('is-closing');
  moreClosingTimer=setTimeout(()=>{moreMenu.open=false;moreMenu.classList.remove('is-closing');},210);
}
moreMenu.addEventListener('toggle',()=>{
  if(moreMenu.open){clearTimeout(moreClosingTimer);moreMenu.classList.remove('is-closing');requestAnimationFrame(positionMoreMenu);}
});
document.addEventListener('pointerdown',event=>{
  if(moreMenu.open&&!moreMenu.contains(event.target))closeMoreMenu();
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&moreMenu.open){event.preventDefault();event.stopPropagation();closeMoreMenu(true);moreSummary.focus();}
},true);
window.addEventListener('resize',()=>{if(moreMenu.open)positionMoreMenu();});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let revealObserver = null;
let idleControlsTimer = null;
let idleCaptionsTimer = null;
let idleStudioTimer = null;
let captionIdleSeconds = 6;
let lastOpenState = null;

try {
  const stored = localStorage.getItem('eai-cloud-caption-idle-seconds');
  if (stored !== null) {
    const value = Number(stored);
    if ([0,4,6,10,20].includes(value)) captionIdleSeconds = value;
  }
} catch {}

function markActivity() {
  document.body.classList.remove('cloud-idle','cloud-studio-idle');
  scroll.classList.remove('is-idle');
  stage.classList.remove('captions-evaporated');
  clearTimeout(idleControlsTimer);
  clearTimeout(idleCaptionsTimer);
  clearTimeout(idleStudioTimer);
  idleControlsTimer = setTimeout(() => {
    if (!panel.classList.contains('open')) document.body.classList.add('cloud-idle');
  }, 3400);
  idleStudioTimer = setTimeout(() => {
    if (panel.classList.contains('open') &&
      !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName) &&
      !(document.activeElement?.isContentEditable)) {
      scroll.classList.add('is-idle');
      document.body.classList.add('cloud-studio-idle');
    }
  }, 4600);
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
  for (const page of pages) {
    const active = page.dataset.studioPage === name;
    page.hidden = !active;
    if (active) {
      page.classList.remove('mist-page-arriving');
      void page.offsetWidth;
      page.classList.add('mist-page-arriving');
    } else page.classList.remove('mist-page-arriving');
  }
  scroll.scrollTop = 0;
  if(name!=='gesprek'){
    const talk=$('freeTalkOptions');
    if(talk?.open){talk.open=false;talk.classList.remove('is-dissolving');}
  }
  const extra=extraViews.has(name);
  moreLabel.textContent=extra?extraNames[name]:'Overige opties';
  moreMenu.classList.toggle('has-selected-extra',extra);
  closeMoreMenu();
  if (options.focus) (extra?moreSummary:tab).focus({preventScroll:true});
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


/* De inhoud van een openklapregel verschijnt als mist in plaats van een standaard HTML-sprong. */
const prefersReducedMist = reduceMotion;
for (const detail of document.querySelectorAll('.studio-disclosure')) {
  const summary = detail.querySelector(':scope > summary');
  if (!summary) continue;
  const body = document.createElement('div');
  body.className = 'mist-detail-body';
  while (summary.nextSibling) body.append(summary.nextSibling);
  detail.append(body);
  let closingTimer = null;
  summary.addEventListener('click', event => {
    if(detail.id==='freeTalkOptions')return; // dedicated floating fog palette owns its close transition
    if (!detail.open || prefersReducedMist.matches) return;
    event.preventDefault();
    if (detail.classList.contains('is-dissolving')) return;
    detail.classList.add('is-dissolving');
    closingTimer = setTimeout(() => {
      detail.open = false;
      detail.classList.remove('is-dissolving');
      closingTimer = null;
    }, 300);
  });
  detail.addEventListener('toggle', () => {
    if (detail.open && closingTimer) {
      clearTimeout(closingTimer);
      closingTimer = null;
      detail.classList.remove('is-dissolving');
    }
    if (detail.open) markActivity();
  });
}

// Het spreekmenu is geen formulier in het scrollvak meer. De zachte glaslaag
// hangt rechtstreeks in de full-screen studio: nergens afgeknipt op mobiel.
const talkOptions=$('freeTalkOptions');
const talkSummary=talkOptions.querySelector(':scope > summary');
const talkPopup=talkOptions.querySelector(':scope > .mist-detail-body');
talkPopup.classList.add('mist-voice-portal');
talkPopup.hidden=true;
panel.appendChild(talkPopup);
let talkClosingTimer=null;
function positionTalkPopup(){
  if(!talkOptions.open||$('page-gesprek').hidden)return;
  const anchor=talkSummary.getBoundingClientRect();
  const navBottom=document.querySelector('.studio-nav').getBoundingClientRect().bottom;
  const width=Math.min(428,window.innerWidth-24);
  const maxHeight=Math.max(168,Math.min(608,window.innerHeight-navBottom-24));
  const top=Math.max(navBottom+9,Math.min(anchor.bottom+12,window.innerHeight-maxHeight-12));
  const left=Math.max(12,Math.min(anchor.left,window.innerWidth-width-12));
  talkPopup.style.width=width+'px';
  talkPopup.style.maxHeight=maxHeight+'px';
  talkPopup.style.left=left+'px';
  talkPopup.style.top=top+'px';
}
let mistUI=null;
function closeTalkMenu(immediate=false,restoreFocus=false){
  clearTimeout(talkClosingTimer);
  mistUI?.closePicker();
  if(!talkOptions.open)return;
  if(immediate||reduceMotion.matches){
    talkOptions.open=false;
    talkPopup.hidden=true;
    talkPopup.classList.remove('is-dissolving');
    if(restoreFocus)talkSummary.focus({preventScroll:true});
    return;
  }
  talkPopup.classList.add('is-dissolving');
  talkClosingTimer=setTimeout(()=>{
    talkOptions.open=false;
    talkPopup.hidden=true;
    talkPopup.classList.remove('is-dissolving');
    if(restoreFocus)talkSummary.focus({preventScroll:true});
  },710);
}
talkSummary.addEventListener('click',event=>{
  if(talkOptions.open){
    event.preventDefault();
    closeTalkMenu(false,true);
  }
});
talkOptions.addEventListener('toggle',()=>{
  clearTimeout(talkClosingTimer);
  if(talkOptions.open){
    talkPopup.hidden=false;
    talkPopup.classList.remove('is-dissolving');
    requestAnimationFrame(()=>requestAnimationFrame(positionTalkPopup));
  }else{
    talkPopup.hidden=true;
    talkPopup.classList.remove('is-dissolving');
  }
});
document.addEventListener('pointerdown',event=>{
  if(talkOptions.open&&!talkOptions.contains(event.target)&&!talkPopup.contains(event.target)
      &&!$('mistVoiceSelectLayer')?.contains(event.target)){
    closeTalkMenu();
  }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&talkOptions.open&&!event.defaultPrevented){
    if(!$('mistVoiceSelectLayer')?.hidden)return;
    event.preventDefault();closeTalkMenu(false,true);
  }
});
window.addEventListener('resize',positionTalkPopup);
window.addEventListener('eaispeak-mist-layout',()=>requestAnimationFrame(positionTalkPopup));
mistUI=initMistVoiceUI({panel,root:talkPopup,details:talkOptions,closeMenu:()=>closeTalkMenu(false,true)});

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
    closeMoreMenu(true);
    revealObserver?.disconnect();
    markActivity();
  }
}
new MutationObserver(onStudioVisibility).observe(panel,{attributes:true,attributeFilter:['class']});
onStudioVisibility();
markActivity();

// Vrije keuze van stilstandduur voor podiumtekst. Geen vooraf ingevulde ondertitels.
const captionSelect = $('idleCaptionSeconds');
captionSelect.value = String(captionIdleSeconds);
captionSelect.addEventListener('change',() => {
  const n=Number(captionSelect.value);
  if (![0,4,6,10,20].includes(n)) return;
  captionIdleSeconds=n;
  try {localStorage.setItem('eai-cloud-caption-idle-seconds',String(n));} catch {}
  markActivity();
});
