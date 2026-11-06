(function(){
'use strict';
const endpoint='https://ngcyfbstajfcfdhlelbz.supabase.co/functions/v1/eai-site-insights';
const en=document.documentElement.lang==='en';
const t=en?{page:'Page views',tools:'Tool opens',reads:'Reads 20s+',daily:'Daily activity',top:'Most viewed pages',devices:'Device categories',empty:'No measured activity in this period',error:'Data unavailable',live:'Updated',note:'Events, not unique visitors. No cookies, visitor profiles or IP storage.',desktop:'Desktop',mobile:'Mobile'}:{page:'Paginaweergaven',tools:'Toolopeningen',reads:'Leestijd 20s+',daily:'Activiteit per dag',top:'Meest bekeken pagina’s',devices:'Apparaattype',empty:'Nog geen gemeten activiteit in deze periode',error:'Gegevens zijn niet beschikbaar',live:'Bijgewerkt',note:'Gebeurtenissen, geen unieke bezoekers. Geen cookies, bezoekersprofielen of opgeslagen IP-adressen.',desktop:'Desktop',mobile:'Mobiel'};
let selected=30,all=[];
const $=id=>document.getElementById(id);
function add(name){return all.filter(x=>x.event===name).reduce((s,x)=>s+Number(x.count||0),0)}
function set(id,s){const e=$(id);if(e)e.textContent=s;}
function render(){
 const cutoff=new Date();cutoff.setUTCHours(0,0,0,0);cutoff.setUTCDate(cutoff.getUTCDate()-selected+1);
 const rows=all.filter(x=>new Date(x.day+'T00:00:00Z')>=cutoff);
 const sum=(name)=>rows.filter(x=>x.event===name).reduce((s,x)=>s+Number(x.count||0),0);
 const fmt=new Intl.NumberFormat(en?'en-US':'nl-NL');
 set('views',fmt.format(sum('pagina')));set('opens',fmt.format(sum('tool')));set('reads',fmt.format(sum('gelezen')));
 const byDay=new Map();
 rows.filter(x=>x.event==='pagina').forEach(x=>byDay.set(x.day,(byDay.get(x.day)||0)+Number(x.count||0)));
 const chart=$('daily-chart');chart.textContent='';
 const max=Math.max(1,...byDay.values());
 for(let i=selected-1;i>=0;i--){
  const date=new Date();date.setUTCHours(0,0,0,0);date.setUTCDate(date.getUTCDate()-i);
  const key=date.toISOString().slice(0,10),value=byDay.get(key)||0;
  const slot=document.createElement('div');slot.className='chart-slot';
  slot.title=key+' · '+fmt.format(value);
  const bar=document.createElement('div');bar.className='chart-bar';bar.style.height=(value?Math.max(4,100*value/max):1)+'%';
  bar.setAttribute('aria-label',key+': '+value);slot.append(bar);chart.append(slot);
 }
 const labels=$('axis-labels');labels.textContent='';
 [selected-1,Math.floor((selected-1)/2),0].forEach(n=>{
  const date=new Date();date.setDate(date.getDate()-n);
  const span=document.createElement('span');span.textContent=date.toLocaleDateString(en?'en-GB':'nl-NL',{day:'numeric',month:'short'});labels.append(span);
 });
 const totals=new Map();rows.filter(x=>x.event==='pagina').forEach(x=>totals.set(x.path,(totals.get(x.path)||0)+Number(x.count||0)));
 const ordered=[...totals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8),list=$('top-pages');list.textContent='';
 if(!ordered.length){const p=document.createElement('p');p.className='quiet';p.textContent=t.empty;list.append(p)}
 ordered.forEach(([path,n],index)=>{
  const item=document.createElement('div');item.className='ranked-item';
  const num=document.createElement('span');num.className='index';num.textContent=String(index+1).padStart(2,'0');
  const label=document.createElement('div');label.className='path';label.textContent=path;
  const track=document.createElement('div');track.className='rank-track';const fill=document.createElement('div');fill.style.width=(n/ordered[0][1]*100)+'%';track.append(fill);label.append(track);
  const count=document.createElement('b');count.textContent=fmt.format(n);
  item.append(num,label,count);list.append(item);
 });
 let mobile=0,desktop=0;rows.filter(x=>x.event==='pagina').forEach(x=>{if(x.device==='mobiel')mobile+=Number(x.count||0);else desktop+=Number(x.count||0)});
 const total=mobile+desktop;const pct=total?Math.round(mobile/total*100):0;
 $('device-ring').style.setProperty('--pct',pct+'%');
 set('device-mobile',(total?pct+'%':'–'));set('device-desktop',(total?(100-pct)+'%':'–'));
 set('device-legend',t.mobile+' / '+t.desktop);
}
function change(days){
 selected=days;
 document.querySelectorAll('[data-days]').forEach(b=>{const on=Number(b.dataset.days)===days;b.setAttribute('aria-pressed',String(on));b.classList.toggle('selected',on)});
 render();
}
document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>change(Number(b.dataset.days))));
async function load(){
 try{
  const response=await fetch(endpoint+'?days=90',{cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok)throw Error(String(response.status));
  const data=await response.json();
  if(!Array.isArray(data.rows))throw Error('rows');
  all=data.rows.filter(r=>typeof r.path==='string'&&typeof r.day==='string'&&['pagina','tool','gelezen'].includes(r.event));
  set('status',t.live+' '+new Date().toLocaleTimeString(en?'en-GB':'nl-NL',{hour:'2-digit',minute:'2-digit'}));
  render();
 }catch{set('status',t.error);render();}
}
set('note',t.note);change(30);load();
})();