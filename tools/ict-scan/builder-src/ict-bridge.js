/* Same-origin bridge for the pinned Dashboard Builder.
 * Original chart rendering, GridStack and local editor remain upstream code.
 * Source rows only travel within the current browser, never into layout PRs. */
const CHANNEL='emmaus-ict-builder-v1';
const SAFE_TYPES=new Set(['bar','column','dot','donut','table','kpi','text']);
const asText=(v,max=400)=>String(v??'').slice(0,max);
const clone=x=>JSON.parse(JSON.stringify(x));
const compare=(a,b)=>String(a).localeCompare(String(b),'nl');
function summarize(rows,field){
  const groups=new Map();
  for(const r of rows){
    const name=asText(r[field]||'Niet ingedeeld',120);
    groups.set(name,(groups.get(name)||0)+1);
  }
  return [...groups].sort((a,b)=>b[1]-a[1]||compare(a[0],b[0])).map(([label,value])=>({label,value}));
}
function byType(rows,field,value){
  if(!value)return rows;
  return rows.filter(r=>asText(r[field]||'Niet ingedeeld',120)===value);
}
function element(tag,cls,text){
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(text!==undefined)el.textContent=String(text);
  return el;
}
export function mountEmmausBridge({saveDataset,serializeLayout,replaceLayout,validateLayout,setStatus,getThemeId,rowHeight}){
  if(new URLSearchParams(location.search).get('emmaus')!=='1'||window.parent===window)return;
  document.body.classList.add('emmaus-integrated');
  const state={registers:[],selected:'',filter:'',roleRefs:{},saved:null,loading:false,revision:''};
  const talk=(type,extra={})=>window.parent.postMessage({channel:CHANNEL,type,...extra},location.origin);
  const header=document.getElementById('app-header');
  const bar=element('div','emmaus-bridge-bar');
  bar.setAttribute('role','group');bar.setAttribute('aria-label','Brongegevens van het applicatielandschap');
  const title=element('span','emmaus-bridge-name','Applicatielandschap');
  const selector=element('select','emmaus-bridge-select');
  selector.setAttribute('aria-label','Kies register');
  const filter=element('select','emmaus-bridge-select');
  filter.setAttribute('aria-label','Filter op categorie');
  const entries=element('select','emmaus-bridge-select');
  entries.setAttribute('aria-label','Kies bronregistratie');
  const edit=element('button','emmaus-bridge-action','Kaart bewerken');
  edit.type='button';
  const send=element('button','emmaus-bridge-submit','Schrijf terug');
  send.type='button';
  const source=element('span','emmaus-bridge-source','Bron nog niet geladen');
  bar.append(title,selector,filter,entries,edit,send,source);
  header.insertAdjacentElement('afterend',bar);
  const active=()=>state.registers.find(r=>r.key===state.selected);
  const option=(value,label)=>{
    const o=element('option','',label);o.value=value;return o;
  };
  const eligible=layout=>layout&&layout.schema==='eai-ict-dashboard-layout-v1'&&layout.source===state.selected&&Array.isArray(layout.tiles);
  const roleFor=tile=>{
    if(tile.type==='text')return 'none';
    const role=Object.entries(state.roleRefs).find(([,ref])=>tile.dataset===ref)?.[0]||'';
    if(!role)throw Error('Deze grafiek gebruikt voorbeeldgegevens of een niet-gekoppelde bron. Koppel hem eerst aan een van de geladen registers.');
    const permitted=role==='records'?new Set(['table']):role==='headlines'?new Set(['kpi']):new Set(['bar','column','dot','donut','table']);
    if(!permitted.has(tile.type))throw Error('De grafiek '+asText(tile.title,80)+' is niet geschikt voor zijn gegevensbron. Kies een passende visualisatie.');
    return role;
  };
  function projectLayout(){
    const layout=serializeLayout();
    const tiles=layout.tiles.map(tile=>{
      if(!SAFE_TYPES.has(tile.type))throw Error('Het terugschrijven van '+tile.type+' is nog niet geschikt voor de geregistreerde gegevens.');
      const sourceRole=roleFor(tile);
      return {
        id:asText(tile.id,100),type:tile.type,title:asText(tile.title,180),
        sourceRole,x:tile.x,y:tile.y,w:tile.w,h:tile.h,pageId:asText(tile.pageId,100),
        tileOptions:clone(tile.tileOptions||{})
      };
    });
    if(!tiles.length)throw Error('Er staan geen grafieken in dit dashboard.');
    const refs=new Set(tiles.map(t=>t.sourceRole));
    if(!refs.has('records')&&!refs.has('distribution')&&!refs.has('headlines'))throw Error('Het dashboard heeft geen gekoppelde registergegevens.');
    return {schema:'eai-ict-dashboard-layout-v1',version:1,source:state.selected,
      title:asText(active()?.label||'Dashboard',90),theme:asText(layout.theme||'paper',35),
      pages:layout.pages.map(p=>({id:asText(p.id,100),name:asText(p.name,80)})),
      currentPageId:asText(layout.currentPageId,100),tiles};
  }
  function basicLayout(){
    const reg=active(),name=reg?.label||'Registraties',roleRefs=state.roleRefs;
    const tile=(id,type,title,role,x,y,w,h)=>({
      id,type,title,source:name,sourceRole:role,dataset:roleRefs[role],
      binding:{mode:'explicit',ref:roleRefs[role]},sizing:'manual',
      tileOptions:{},pageId:'page-1',x,y,w,h
    });
    return {app:'dashboard-builder',version:5,rowHeight,theme:getThemeId(),
      defaultDataset:{kind:'dataset',ref:roleRefs.records},filters:[],parameters:[],savedViews:[],
      pages:[{id:'page-1',name:'Overzicht'}],currentPageId:'page-1',
      tiles:[
        tile('emmaus-headlines','kpi','Geregistreerd','headlines',0,0,12,4),
        tile('emmaus-distribution','bar','Verdeling','distribution',0,4,6,13),
        tile('emmaus-records','table','Bronregistraties','records',6,4,6,13)
      ]};
  }
  function savedLayout(){
    if(!eligible(state.saved))return null;
    const roles=state.roleRefs;
    try{
      const pages=state.saved.pages?.length?state.saved.pages:[{id:'page-1',name:'Overzicht'}];
      const tiles=state.saved.tiles.map(t=>{
        if(!SAFE_TYPES.has(t.type)||!['records','distribution','headlines','none'].includes(t.sourceRole))throw Error('Niet ondersteunde kaart');
        const dataset=t.sourceRole==='none'?null:roles[t.sourceRole];
        if(t.sourceRole!=='none'&&!dataset)throw Error('Gegevensbron ontbreekt');
        return {id:t.id,type:t.type,title:t.title,source:active()?.label||'Register',dataset,
          binding:dataset?{mode:'explicit',ref:dataset}:{mode:'none'},
          sizing:'manual',tileOptions:t.tileOptions||{},pageId:t.pageId,x:t.x,y:t.y,w:t.w,h:t.h};
      });
      return {app:'dashboard-builder',version:5,rowHeight,theme:state.saved.theme||getThemeId(),
        defaultDataset:{kind:'dataset',ref:roles.records},filters:[],parameters:[],savedViews:[],
        pages,currentPageId:state.saved.currentPageId||pages[0].id,tiles};
    }catch{return null;}
  }
  function updateRecordOptions(){
    const reg=active();entries.replaceChildren();
    for(const row of byType(reg?.rows||[],reg?.field,state.filter).slice().sort((a,b)=>compare(a.name||a.id,b.name||b.id))){
      entries.append(option(row.id,(row.name||row.id)+' · '+row.id));
    }
    edit.disabled=!entries.options.length;
  }
  function fillFilters(){
    const reg=active();filter.replaceChildren(option('','Alle categorieën'));
    for(const {label} of summarize(reg?.rows||[],reg?.field))filter.append(option(label,label));
    if(state.filter&&![...filter.options].some(o=>o.value===state.filter))state.filter='';
    filter.value=state.filter;
    updateRecordOptions();
  }
  function rebind(){
    const reg=active();if(!reg)return;
    const filtered=byType(reg.rows,reg.field,state.filter);
    const raw=filtered.map(r=>({...r}));
    const group=summarize(filtered,reg.field);
    const headline=[
      {label:'Registraties',value:String(filtered.length)},
      {label:'Volledige selectie',value:String(reg.rows.length)},
      {label:'Categorieën',value:String(group.length)}
    ];
    const create=(name,rows)=>{
      const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];
      const result=saveDataset({name,columns,rows,fieldKeys:columns,mapping:{},raw:{columns,rows}});
      return 'upload:'+result.id;
    };
    // This is deliberately in-memory only; no implicit IndexedDB persistence
    // and no source data embedded in saved dashboard layouts or GitHub PRs.
    state.roleRefs={
      records:create(reg.label+' · bronregels',raw.length?raw:[{id:'-',name:'Geen registraties'}]),
      distribution:create(reg.label+' · verdeling',group.length?group:[{label:'Geen registraties',value:0}]),
      headlines:create(reg.label+' · aantallen',headline)
    };
    const candidate=savedLayout()||basicLayout();
    replaceLayout(validateLayout(candidate));
    setStatus(reg.label+' · '+filtered.length+' geregistreerd · gegevens blijven in deze browser');
    updateRecordOptions();
    source.textContent=filtered.length+' van '+reg.rows.length+' · '+(state.revision||'GitHub');
  }
  selector.addEventListener('change',()=>{
    if(serializeLayout().tiles.length&&!window.confirm('Andere bron openen? De huidige indeling blijft alleen bewaard als je die eerst terugschrijft of exporteert.')){selector.value=state.selected;return;}
    state.selected=selector.value;state.filter='';fillFilters();rebind();
  });
  filter.addEventListener('change',()=>{state.filter=filter.value;rebind();});
  edit.addEventListener('click',()=>{
    const reg=active();if(reg&&entries.value)talk('edit-record',{register:reg.key,id:entries.value});
  });
  send.addEventListener('click',()=>{
    try{const layout=projectLayout();talk('writeback-request',{layout,count:active()?.rows.length||0,
      displayed:byType(active()?.rows||[],active()?.field,state.filter).length});}
    catch(error){setStatus(error.message);talk('bridge-error',{message:error.message});}
  });
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window.parent)return;
    const data=event.data;
    if(!data||data.channel!==CHANNEL)return;
    if(data.type==='source-data'){
      try{
        if(!Array.isArray(data.registers)||data.registers.length>20)throw Error('Ongeldige bronselectie.');
        state.registers=data.registers.filter(r=>r&&typeof r.key==='string'&&Array.isArray(r.rows));
        state.selected=state.registers.some(r=>r.key===data.selected)?data.selected:state.registers[0]?.key||'';
        state.filter=asText(data.filter||'',120);
        state.saved=data.layout||null;state.revision=asText(data.revision,80);
        selector.replaceChildren();
        for(const reg of state.registers)selector.append(option(reg.key,reg.label+' ('+reg.rows.length+')'));
        selector.value=state.selected;
        fillFilters();
        if(state.selected)rebind();else setStatus('Geen geregistreerde bronnen ontvangen.');
        talk('source-loaded',{registers:state.registers.length,source:state.selected});
      }catch(error){setStatus(error.message);talk('bridge-error',{message:error.message});}
    }
    if(data.type==='writeback-result')setStatus(asText(data.message,250));
  });
  talk('ready');
}
