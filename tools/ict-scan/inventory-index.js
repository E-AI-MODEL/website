'use strict';
/* The one derived ICT index. It contains no independent facts: every node is
   an existing source record (or a clearly marked legacy embedded reference).
   All components read the same typed links and their evidence boundaries. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.IctInventoryIndex=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const VERSION='1.0.0';
  const STORES=Object.freeze({
    apps:'apps',ai:'ai',connections:'connections',parts:'parts',
    additionalCandidates:'candidates',checks:'checks',dpia:'dpia',
    aiControls:'aiControls',devices:'devices',hardwareGroups:'hardwareGroups',
    licenseReview:'licenseReview',workActions:'workActions',softwareReview:'softwareReview',
    faqs:'faqs',sourceRegister:'sourceRegister'
  });
  const ALIASES=Object.freeze({candidates:'additionalCandidates'});
  const TYPES=Object.freeze(Object.keys(STORES));
  const STATUSES=Object.freeze(['Vermoedelijk','Geregistreerd','Bevestigd','Historisch']);
  const key=(type,id)=>JSON.stringify([ALIASES[type]||type,String(id)]);
  const rows=value=>value instanceof Map?[...value.values()]:Array.isArray(value)?value:[];
  const filled=value=>typeof value==='string'&&value.trim().length>0;
  const equalType=type=>ALIASES[type]||type;
  const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  function recordText(value){
    if(Array.isArray(value))return value.map(recordText).join(' ');
    if(value&&typeof value==='object')return Object.values(value).map(recordText).join(' ');
    return value===null||value===undefined?'':String(value);
  }
  function matchesRecord(record,query,options={}){
    const raw=String(query??'').trim(),q=normalize(raw);if(!q)return true;
    // In a register browser a complete ID identifies the record itself,
    // not a reference in another record's audit history. Keep the broader
    // reference-search behavior for other index consumers.
    if(options.exactId&&/^[a-z][a-z0-9]*\s*-\s*\d+(?:-[a-z0-9]+)*$/i.test(raw))return normalize(record?.id)===q;
    const searchable=options.excludeMetadata&&record&&typeof record==='object'
      ?Object.fromEntries(Object.entries(record).filter(([field])=>!['auditTrail','recordMeta'].includes(field)))
      :record;
    const haystack=normalize(recordText(searchable));
    return q.split(' ').every(term=>haystack.includes(term));
  }
  function build(state,options={}){
    const nodes=new Map(),groups=new Map(),outgoing=new Map(),incoming=new Map();
    const edges=[],errors=[],sourceAliases=new Map(),sourceIds=new Set(),registeredKeys=new Set();
    for(const type of TYPES){
      const list=rows(state[STORES[type]]),typed=new Map();
      for(const record of list){
        if(!record||!filled(record.id)){errors.push({code:'INVALID_ID',type});continue;}
        const k=key(type,record.id);
        if(nodes.has(k)){errors.push({code:'DUPLICATE_ID',type,id:record.id});continue;}
        const node={type,id:record.id,record,derived:false};
        nodes.set(k,node);typed.set(record.id,record);
      }
      groups.set(type,typed);
    }
    for(const source of rows(state.sourceRegister)){
      if(!filled(source.id))continue;
      sourceIds.add(source.id);
      for(const alias of source.referenceKeys||[]){
        if(!filled(alias))continue;
        if(sourceAliases.has(alias)&&sourceAliases.get(alias)!==source.id){
          errors.push({code:'AMBIGUOUS_SOURCE_ALIAS',alias});continue;
        }
        sourceAliases.set(alias,source.id);
      }
    }
    function addLegacy(type,record){
      const k=key(type,record.id);
      if(nodes.has(k))return nodes.get(k);
      const node={type,id:record.id,record,derived:true};
      nodes.set(k,node);
      if(!groups.has(type))groups.set(type,new Map());
      groups.get(type).set(record.id,record);
      return node;
    }
    // Compatibility layer for evidence already stored on the app. It creates
    // no second persisted register. The migration can remove these arrays.
    for(const app of rows(state.apps)){
      for(const item of app.serviceLinks||[]){
        if(!filled(item.id))continue;
        addLegacy('parts',{...item,kind:'Microsoft 365-onderdeel',parent:app.id,local:item.status||'Niet vastgesteld',sources:item.evidence?[item.evidence]:[],derivedFrom:'apps.serviceLinks'});
      }
      for(const item of app.hardwareLinks||[]){
        if(!filled(item.id))continue;
        addLegacy('hardwareGroups',{...item,kind:'Hardwaregroep',sources:item.evidence?[item.evidence]:[],derivedFrom:'apps.hardwareLinks'});
      }
    }
    function add(fromType,fromId,toType,toId,relationType,status,evidence,note,origin){
      fromType=equalType(fromType);toType=equalType(toType);
      if(!filled(fromId)||!filled(toId))return;
      const from=nodes.get(key(fromType,fromId)),to=nodes.get(key(toType,toId));
      if(!from||!to){
        errors.push({code:'MISSING_RELATION_TARGET',fromType,fromId,toType,toId,relationType});return;
      }
      if(!STATUSES.includes(status)){
        errors.push({code:'INVALID_RELATION_STATUS',fromType,fromId,relationType,status});return;
      }
      const signature=JSON.stringify([fromType,fromId,toType,toId,relationType]);
      if(registeredKeys.has(signature))return;
      registeredKeys.add(signature);
      const edge={fromType,fromId,toType,toId,relationType,status,
        evidence:filled(evidence)?evidence:'',note:filled(note)?note:'',origin};
      edges.push(edge);
      if(!outgoing.has(key(fromType,fromId)))outgoing.set(key(fromType,fromId),[]);
      if(!incoming.has(key(toType,toId)))incoming.set(key(toType,toId),[]);
      outgoing.get(key(fromType,fromId)).push(edge);
      incoming.get(key(toType,toId)).push(edge);
    }
    const firstSource=row=>Array.isArray(row?.sources)&&filled(row.sources[0])?row.sources[0]:'';
    for(const type of TYPES){
      for(const row of rows(state[STORES[type]])){
        for(const link of row.relations||[]){
          add(type,row.id,link.targetType,link.targetId,link.relationType,
            link.status||'Vermoedelijk',link.evidence,link.note,'declared');
        }
      }
    }
    for(const r of rows(state.ai))add('ai',r.id,'apps',r.parentId,'part_of','Geregistreerd',firstSource(r),'Beschrijving van een AI-functie; gebruik niet bewezen.','foreign-key');
    for(const r of rows(state.parts)){
      add('parts',r.id,'apps',r.parent,'part_of','Geregistreerd',firstSource(r),'Productonderdeel; actieve werking niet bewezen.','foreign-key');
      if(r.connectionId)add('parts',r.id,'connections',r.connectionId,'registered_as','Geregistreerd',firstSource(r),'Entra-registratie zonder bewezen gegevensuitwisseling.','foreign-key');
    }
    for(const app of rows(state.apps)){
      if(app.parent)add('apps',app.id,'apps',app.parent,'part_of','Geregistreerd',firstSource(app),'Expliciete parent-ID.','foreign-key');
      for(const item of app.serviceLinks||[]){
        add('parts',item.id,'apps',app.id,'part_of','Geregistreerd',item.evidence,item.note,'embedded-legacy');
      }
      for(const item of app.hardwareLinks||[]){
        add('hardwareGroups',item.id,'apps',app.id,'managed_by','Geregistreerd',
          item.evidence,item.note,'embedded-legacy');
      }
    }
    for(const r of rows(state.connections))if(r.matchedId){
      add('connections',r.id,'apps',r.matchedId,'possible_match','Vermoedelijk',firstSource(r),'Entra-match betekent geen actieve technische koppeling.','foreign-key');
    }
    for(const r of rows(state.aiControls)){
      const aiRefs=[...new Set(String(r.aiRefs||'').match(/AI-\d+/gi)||[])];
      for(const id of aiRefs)add('aiControls',r.id,'ai',id,'reviews','Geregistreerd',firstSource(r),'Registratie van AI-beheer, geen afgeronde normbeoordeling.','foreign-key');
    }
    for(const r of rows(state.hardwareGroups)){
      for(const ref of r.appRefs||[]){
        add('hardwareGroups',r.id,'apps',ref,'managed_by','Geregistreerd',firstSource(r),'Beheerrelatie uit hardware-inventaris, actuele configuratie niet bevestigd.','foreign-key');
      }
    }
    function get(type,id){return nodes.get(key(type,id))||null;}
    const searchTextCache=new Map();
    function findById(query){const q=normalize(query);return [...nodes.values()].filter(node=>!node.derived&&normalize(node.id)===q);}
    function searchRecords(query,{type}={}){
      const q=normalize(query),terms=q.split(' '),matches=[];
      for(const node of nodes.values()){
        if(node.derived||(type&&node.type!==equalType(type)))continue;
        if(!searchTextCache.has(node))searchTextCache.set(node,normalize(recordText(node.record)));
        if(q&&!terms.every(term=>searchTextCache.get(node).includes(term)))continue;
        const id=normalize(node.id),name=normalize(node.record.name),score=id===q?1000:name===q?500:name.includes(q)?100:q.split(' ').filter(t=>name.includes(t)).length*10;
        matches.push({type:node.type,id:node.id,record:node.record,score});
      }
      return matches.sort((a,b)=>b.score-a.score||String(a.record.name||a.id).localeCompare(String(b.record.name||b.id),'nl')||a.id.localeCompare(b.id));
    }
    function records(type){return [...(groups.get(equalType(type))||new Map()).values()];}
    function connected(type,id,options={}){
      const nodeKey=key(type,id),direction=options.direction||'both';
      const chosen=[];
      if(direction!=='incoming')for(const edge of outgoing.get(nodeKey)||[]){
        const other=get(edge.toType,edge.toId);
        if(other)chosen.push({...edge,direction:'outgoing',otherType:other.type,otherId:other.id,other:other.record});
      }
      if(direction!=='outgoing')for(const edge of incoming.get(nodeKey)||[]){
        const other=get(edge.fromType,edge.fromId);
        if(other)chosen.push({...edge,direction:'incoming',otherType:other.type,otherId:other.id,other:other.record});
      }
      return chosen.filter(x=>(!options.type||x.otherType===equalType(options.type))&&
        (!options.relationType||x.relationType===options.relationType));
    }
    // Children are reached only through recorded part_of edges; the direction
    // stays distinct from ordinary integrations and possible matches.
    function descendants(type,id,options={}){
      const result=[],seen=new Set([key(type,id)]),maxDepth=Math.min(5,Math.max(1,options.maxDepth||3));
      const queue=[{type,id,depth:0}];
      while(queue.length){
        const current=queue.shift();
        if(current.depth>=maxDepth)continue;
        for(const link of connected(current.type,current.id,{direction:'incoming',relationType:'part_of'})){
          if(!['apps','parts'].includes(link.otherType))continue;
          const k=key(link.otherType,link.otherId);
          if(seen.has(k))continue;
          seen.add(k);
          const item={type:link.otherType,id:link.otherId,record:link.other,depth:current.depth+1};
          result.push(item);queue.push(item);
        }
      }
      return result;
    }
    function sourcesFor(type,id){
      const node=get(type,id);
      if(!node)return {matched:[],unmatched:[]};
      const r=node.record;
      const refs=[...(Array.isArray(r.sources)?r.sources:[]),...(Array.isArray(r.sourceRefs)?r.sourceRefs:[])];
      const matched=new Set((r.sourceIds||[]).filter(x=>sourceIds.has(x))),unmatched=[];
      for(const x of refs){
        const sourceId=sourceAliases.get(x);
        if(sourceId)matched.add(sourceId);
        else if(filled(x))unmatched.push(x);
      }
      return {matched:[...matched],unmatched};
    }
    const sourceCoverage={directReferences:0,matched:0,unmatched:0,
      relationEvidence:0,relationEvidenceMatched:0};
    for(const node of nodes.values()){
      if(node.derived)continue;
      const vals=[...(node.record.sources||[]),...(node.record.sourceRefs||[])];
      sourceCoverage.directReferences+=vals.length;
      sourceCoverage.matched+=vals.filter(x=>sourceAliases.has(x)).length;
      sourceCoverage.unmatched+=vals.filter(x=>!sourceAliases.has(x)).length;
    }
    for(const edge of edges){
      if(edge.origin!=='declared'||!edge.evidence)continue;
      sourceCoverage.relationEvidence++;
      if(sourceAliases.has(edge.evidence))sourceCoverage.relationEvidenceMatched++;
    }
    if(options.catalog){
      const valid=new Set((options.catalog.relationTypes||[]).map(x=>x.id));
      for(const edge of edges)if(!valid.has(edge.relationType))
        errors.push({code:'UNKNOWN_RELATION_TYPE',relationType:edge.relationType});
    }
    // The AI overview is a projection of the registered cards, not another dataset.
    function aiProgress(){
      const groups={good:[],open:[],unknown:[]};
      const unknown=value=>!String(value||'').trim()||/^\?|niet inzichtelijk|onbekend|niet vastgesteld|niet gecontroleerd|niet bekend/i.test(String(value));
      for(const type of TYPES){
        if(type==='sourceRegister')continue;
        for(const record of records(type)){
          const links=(record.frameworkLinks||[]).filter(link=>link.frameworkId==='AIACT');
          if(!links.length)continue;
          const status=String(record.status||record.local||'').trim();
          const bucket=/niet inzichtelijk|onbekend/i.test(status)?'unknown':
            links.every(link=>['Afgerond','In uitvoering'].includes(link.followUpStatus))?'good':'open';
          const note=[...new Set(links.map(link=>link.note).filter(Boolean))].join(' ');
          const followUp=[...new Set(links.filter(link=>link.followUpStatus!=='Afgerond').map(link=>link.followUp).filter(Boolean))].join(' ');
          groups[bucket].push({type,id:record.id,name:record.name,note,followUp,status:status||links[0].followUpStatus||'Open'});
        }
      }
      const features=records('ai').filter(record=>!get('ai',record.id)?.derived);
      const feature=record=>({id:record.id,name:record.name,product:record.product,local:record.local});
      const unknownLocal=features.filter(record=>unknown(record.local)).map(feature);
      return {groups,featureCount:features.length,unknownCount:unknownLocal.length,unknownLocal,
        possibleHighRisk:features.filter(record=>/mogelijk hoog risico/i.test(record.aiAct||'')).map(feature)};
    }
    return Object.freeze({
      version:VERSION,nodes,edges,errors,sourceCoverage,
      get,records,connected,descendants,sourcesFor,aiProgress,searchRecords,findById,
      count:type=>records(type).length,
      countLinked:(type,id,targetType)=>new Set(connected(type,id,{type:targetType}).map(x=>x.otherId)).size
    });
  }
  return Object.freeze({VERSION,STORES,TYPES,STATUSES,key,build,matchesRecord});
});