'use strict';
/* Evidence-bound Dutch question search. No model, external service or free-text inference.
   Fixed FAQ answers are separate from facts evaluated from the current JSON revision. */
(function(){
  const stop=new Set(['de','het','een','en','of','in','op','met','voor','van','tot','bij','aan','wat','wie','waar','hoe','welke','welk','zijn','is','hebben','heeft','we','wij','er','deze','die','ons','onze','dit','ik','nog','kan','kun','moet','doet','over']);
  function norm(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
  function words(value){return norm(value).split(' ').filter(w=>w&&!stop.has(w));}
  function unknown(value){const v=norm(value);return String(value??'').trim().startsWith('?')||!v||v.startsWith('nog ')||v.startsWith('niet vastgesteld')||v.startsWith('onbekend')||v.startsWith('schoolgebruik nog niet')||v.startsWith('afhankelijk van')||v.startsWith('standaard volgens leverancier');}
  const label={apps:'Toepassing',ai:'AI-functie',connections:'Entra-registratie',candidates:'Kandidaat',faqs:'FAQ',parts:'Technisch onderdeel'};
  const result=(kind,answer,records=[],status='Brongebonden',sources=[],question='')=>({kind,answer,status,records:records.slice(0,12),sources:[...new Set(sources.filter(Boolean))].slice(0,5),question});
  function entry(type,x){return {type,id:x.id,name:x.name||x.question||x.id,detail:type==='apps'?(x.description||''):type==='ai'?(x.product||''):type==='connections'?(x.matched||''):type==='faqs'?(x.topic||''):(x.kind||'')};}
  function recordSources(items){return items.flatMap(x=>Array.isArray(x.sources)?x.sources:[]).slice(0,5);}
  function candidateAnswer(value,yes,no){return unknown(value)?no:yes+String(value).trim();}
  function exactFaq(q,faqs){
    return faqs.find(f=>[f.name,...String(f.aliases||'').split('|')].some(v=>norm(v)===q))||null;
  }
  function fuzzyFaq(q,faqs){
    const qTokens=words(q),qt=new Set(qTokens);
    if(!qTokens.length||qTokens.length>7)return null;
    const scored=faqs.map(f=>{
      const phrasings=[f.name,...String(f.aliases||'').split('|')];
      let best=0;
      for(const phrase of phrasings){
        const set=new Set(words(phrase));
        const shared=qTokens.filter(t=>set.has(t)).length;
        if(!shared)continue;
        const precision=shared/qTokens.length,recall=shared/Math.max(1,set.size);
        const score=precision*0.55+recall*0.45;
        if(score>best)best=score;
      }
      return {faq:f,score:best};
    }).sort((a,b)=>b.score-a.score);
    // One unambiguous, nearly identical phrase is required for an automatic fixed answer.
    if(scored[0]?.score>=0.88 && (!scored[1]||scored[0].score-scored[1].score>=0.11))return scored[0].faq;
    return null;
  }
  function findApp(q,apps){
    let hits=[];
    const hay=' '+q+' ';
    for(const app of apps){
      const name=norm(app.name);
      if(name.length<3)continue;
      if(hay.includes(' '+name+' '))hits.push({app,score:name.length+20});
    }
    if(!hits.length){
      const aliases=[['microsoft 365','office 365|m365|ms 365'],['canon uniflow','uniflow|canon printer'],['3cx','telefooncentrale 3cx']];
      for(const [name,forms] of aliases){
        if(forms.split('|').some(x=>hay.includes(' '+x+' '))){
          const app=apps.find(x=>norm(x.name)===name);
          if(app)hits.push({app,score:100});
        }
      }
    }
    if(!hits.length && !(/\b(welke|alle|hoeveel)\b/.test(q)&&/\b(applicaties|toepassingen|apps|diensten)\b/.test(q))){
      const phraseTokens=words(q).filter(x=>x.length>3);
      const matched=apps.filter(app=>phraseTokens.some(w=>norm(app.name).split(' ').includes(w)));
      if(matched.length===1)hits=[{app:matched[0],score:2}];
    }
    hits.sort((a,b)=>b.score-a.score||a.app.name.localeCompare(b.app.name,'nl'));
    return hits[0]?.app||null;
  }
  function shortList(items,limit=5){const names=items.slice(0,limit).map(x=>x.name);return names.join(', ')+(items.length>limit?' en '+(items.length-limit)+' andere':'');}
  function describeApp(q,app,data){
    const own=app.name,base=[entry('apps',app)],src=recordSources([app]);
    const ix=data.index;
    const related=type=>ix?ix.connected('apps',app.id,{type}).map(x=>x.other):
      (type==='ai'?data.ai.filter(x=>x.parentId===app.id):
       type==='connections'?data.connections.filter(x=>x.matchedId===app.id):
       type==='parts'?data.parts.filter(x=>x.parent===app.id):[]);
    const ai=related('ai'),entra=related('connections');
    const parts=related('parts').filter(x=>x.kind==='Microsoft 365-onderdeel'||x.parent===app.id);
    if(/\b(wie|verantwoordelijk|beheerder|beheert|eigenaar|beheer)\b/.test(q)){
      return result('field',candidateAnswer(app.owner,'Bij '+own+' staat als verantwoordelijke: ','Voor '+own+' is de verantwoordelijke nog niet vastgesteld in de inventarisatie.'),base,unknown(app.owner)?'Niet vastgesteld':'Geregistreerd',src);
    }
    if(/\b(verwerkersovereenkomst|verwerkerscontract|dpa|verwerker)\b/.test(q)){
      return result('field',candidateAnswer(app.processorAgreement,'Bij '+own+' staat over de verwerkersovereenkomst: ','Voor '+own+' is de status van de verwerkersovereenkomst nog niet vastgesteld.'),base,unknown(app.processorAgreement)?'Niet vastgesteld':'Geregistreerd',src);
    }
    if(/\b(dpia|gegevensbeschermingseffectbeoordeling)\b/.test(q)){
      return result('field',candidateAnswer(app.dpiaStatus,'Bij '+own+' is de geregistreerde DPIA-status: ','Voor '+own+' is de DPIA-status nog niet vastgesteld. Dat betekent niet automatisch dat een DPIA vereist of afgerond is.'),base,unknown(app.dpiaStatus)?'Niet vastgesteld':'Geregistreerd',src);
    }
    if(/\b(avg|ibp|ai act|ai verordening|wetgeving|wetten|normen|wet)\b/.test(q)){
      const rules=(app.frameworkLinks||[]).filter(x=>x.frameworkId&&x.article);
      if(!rules.length)return result('legal','Bij '+own+' is nog geen concrete wets- of normbeoordeling in de JSON-kaart vastgelegd. Dat zegt niets over de toepasselijkheid van wettelijke verplichtingen.',base,'Niet beoordeeld',src);
      return result('legal','Bij '+own+' staan '+rules.length+' toetsingsverwijzingen: '+rules.map(x=>x.frameworkId+' '+x.article+' ('+(x.status||'nog te beoordelen')+')').join('; ')+'. Een verwijzing betekent geen automatische naleving.',base,'Beoordelingsregistratie',src);
    }
    if(/\b(bron|bronnen|herkomst|vandaan|afkomst)\b/.test(q)){
      return result('source','Bronnen en originele bestandsverwijzingen zijn bewaard voor de interne controle. De gewone kaart toont geen Excel-herkomst.',base,'Broncontrole apart',[],q);
    }
    if(/\b(gegevens|persoonsgegevens|data|verwerkt|gegevenscategorie)\b/.test(q)&&!/\b(koppel|koppelingen|deelt|uitwisseling)\b/.test(q)){
      return result('field',candidateAnswer(app.data,'Bij '+own+' zijn de volgende gegevens geregistreerd: ','Voor '+own+' is nog niet vastgesteld welke gegevens worden verwerkt.'),base,unknown(app.data)?'Niet vastgesteld':'Geregistreerd',src);
    }
    if(/\b(entra|sso|aanmeld|login)\b/.test(q)){
      if(!entra.length)return result('relations','Bij '+own+' is in deze bronstand geen Entra-match vastgelegd. Dat bewijst niet dat er geen technische koppeling bestaat.',base,'Niet vastgesteld',src);
      return result('relations','Bij '+own+' staan '+entra.length+' mogelijke Entra-matches: '+shortList(entra)+'. Dit zijn technische registraties; hun actuele werking is niet bevestigd.',entra.map(x=>entry('connections',x)).concat(base),'Mogelijke koppeling',recordSources(entra).concat(src));
    }
    if(/\b(koppel|koppelingen|deelt|uitwisseling|uitwisselen|integratie|api)\b/.test(q)){
      const linked=ix?ix.connected('apps',app.id).filter(x=>['integration','sso','possible_match','registered_as'].includes(x.relationType)):[];
      if(linked.length){
        return result('relations','Voor '+own+' zijn '+linked.length+' mogelijke technische verbanden geregistreerd, waaronder '+shortList(linked.map(x=>x.other))+
          '. De actieve werking is niet aangetoond.',base.concat(linked.slice(0,8).map(x=>entry(x.otherType,x.other))),
          'Mogelijke verbindingen',src);
      }
      return result('field',candidateAnswer(app.links,'Bij '+own+' staat over koppelingen: ','Voor '+own+' is de feitelijke gegevensuitwisseling nog niet vastgesteld.'),base,unknown(app.links)?'Niet vastgesteld':'Geregistreerd',src);
    }
    if(/\b(ai|copilot|kunstmatige|functie|functies)\b/.test(q)){
      if(!ai.length)return result('relations','Aan '+own+' zijn in het AI-register geen AI-functies gekoppeld. Dat bewijst niet dat de leverancier geen AI-functies aanbiedt.',base,'Geen bronkoppeling',src);
      return result('relations','Voor '+own+' zijn '+ai.length+' AI-functies beschreven, waaronder '+shortList(ai)+'. Beschrijving betekent niet dat de functies op school zijn ingeschakeld.',base.concat(ai.map(x=>entry('ai',x))),'Beschreven functies',recordSources(ai).concat(src));
    }
    if(/\b(onderdelen|modules|onderdeel|module|familie|parent|child)\b/.test(q)){
      if(!parts.length)return result('relations','Bij '+own+' zijn nog geen technische onderdelen in het bronregister gekoppeld. Eventuele andere modules zijn hiermee niet uitgesloten.',base,'Geen bronkoppeling',src);
      return result('relations','Bij '+own+' staan '+parts.length+' technische registraties: '+shortList(parts)+'. Hun productrelatie en actieve werking vragen afzonderlijke bevestiging.',parts.map(x=>entry('parts',x)).concat(base),'Geregistreerde onderdelen',recordSources(parts).concat(src));
    }
    if(app.id==='APP-034'&&/\b(welke|wat|overzicht|beschikbaar|toegang)\b/.test(q)&&
      /\b(apps|applicaties|diensten|onderdelen|software|mogelijkheden|leerlingen|docenten|medewerkers)\b/.test(q)){
      const modules=(ix?.descendants('apps',app.id,{maxDepth:3})||[])
        .filter(x=>x.type==='parts'&&x.record.kind==='Microsoft 365-onderdeel')
        .map(x=>x.record);
      const audience=/\b(leerling|leerlingen)\b/.test(q)?'leerlingen':/\b(docent|docenten|medewerker|medewerkers)\b/.test(q)?'medewerkers':'alle gebruikers';
      const relevant=modules.filter(x=>audience==='alle gebruikers'||
        (Array.isArray(x.audience)&&x.audience.includes(audience)));
      const description=modules.length?
        'In het bronpakket zijn '+modules.length+' Microsoft 365-onderdelen beschreven, waaronder '+shortList(relevant.length?relevant:modules,8)+'. ':
        'De volledige Microsoft 365-productlijst ontbreekt in de huidige bronregistratie. ';
      return result('relations',description+
        'Dit is geen bevestiging dat ieder onderdeel is geactiveerd of dat '+audience+' werkelijk toegang hebben. Licenties, leeftijdsinstellingen en rechten moeten afzonderlijk worden gecontroleerd.',
        (relevant.length?relevant:modules).slice(0,12).map(x=>entry('parts',x)).concat(base),
        'Productcatalogus; daadwerkelijke toegang niet vastgesteld',src);
    }
    if(/\b(gebruiken|gebruikt|gebruik|actief|ingeschakeld|aanwezig|hebben|heeft|installatie)\b/.test(q)){
      if(unknown(app.local))return result('usage',own+' is geregistreerd in het applicatieregister ('+app.id+'). Het daadwerkelijke schoolgebruik is nog niet bevestigd.',base,'Niet vastgesteld',src);
      return result('usage','Bij '+own+' staat als lokale gebruiksstatus: '+app.local+'.',base,'Geregistreerde status',src);
    }
    if(/\b(wat|waarvoor|functie|beschrijving|doel)\b/.test(q)){
      return result('description',own+' is geregistreerd met de omschrijving: '+(app.description||'Geen beschrijving aanwezig')+'.'+(unknown(app.local)?' Het daadwerkelijke schoolgebruik is nog niet bevestigd.':''),base,unknown(app.local)?'Gebruik niet vastgesteld':'Bronbeschrijving',src);
    }
    return result('record',own+' staat in de basisinventaris ('+app.id+'). '+(app.description||'Er is nog geen beschrijving.')+(unknown(app.local)?' Het schoolgebruik is nog niet afzonderlijk bevestigd.':''),base,'Geregistreerd',src);
  }
  function countQuery(q,data){
    if(!/\b(hoeveel|aantal|totaal)\b/.test(q))return null;
    const apps=data.apps,ai=data.ai;
    // Een specifiek product krijgt nooit het totaal van het schoolbrede licentieregister.
    const mentioned=findApp(q,apps);
    if(mentioned&&/\b(licenties|licentie|licentieplaatsen)\b/.test(q)){
      const linked=data.index?data.index.connected('apps',mentioned.id,{type:'licenseReview'}).map(x=>x.other):[];
      const summary=linked.length?'Er zijn '+linked.length+' licentiecontrole-registraties voor deze toepassing. ':'';
      const counted=mentioned.licenseSnapshot;
      if(counted&&Number.isSafeInteger(counted.assigned)&&counted.verified===true){
        return result('count','Voor '+mentioned.name+' zijn '+counted.assigned+' toegewezen licenties geverifieerd op '+counted.asOf+'.', 
          [entry('apps',mentioned)],'Geverifieerde licentietelling',recordSources([mentioned]));
      }
      return result('count',summary+'Het aantal daadwerkelijk toegewezen of betaalde licenties van '+mentioned.name+
        ' is niet geverifieerd in deze openbare index. Het totale aantal licentiecontrolepunten is geen licentietelling.',
        [entry('apps',mentioned),...linked.map(x=>entry('licenseReview',x))],
        'Niet vastgesteld',recordSources([mentioned]));
    }
    if(/\b(ai|kunstmatige|copilot)\b/.test(q)&&/\b(applicaties|toepassingen|apps|diensten)\b/.test(q)){
      const ids=new Set(apps.map(x=>x.id)),withAi=new Set(ai.filter(x=>ids.has(x.parentId)).map(x=>x.parentId));
      return result('count',withAi.size+' van '+apps.length+' basisregistraties hebben een koppeling naar ten minste één beschreven AI-functie. Dit zegt niet of die functie op school actief is.',apps.filter(x=>withAi.has(x.id)).slice(0,12).map(x=>entry('apps',x)),'Afgeleide telling',recordSources(apps));
    }
    const categories=[
      {rx:/\b(eigenaar|verantwoordelijke|beheerder|beheert)\b/,rows:apps.filter(x=>unknown(x.owner)),name:'basisregistraties zonder vastgestelde verantwoordelijke',type:'apps'},
      {rx:/\b(ai|copilot|ai functies)\b/,rows:ai,name:'beschreven AI-functies',type:'ai'},
      {rx:/\b(entra|sso)\b/,rows:data.connections,name:'Entra-registraties',type:'connections'},
      {rx:/\b(kandidaat|kandidaten|onderzoekssignalen)\b/,rows:data.candidates,name:'aanvullende kandidaten',type:'candidates'},
      {rx:/\b(dpia|privacychecks)\b/,rows:data.dpia,name:'DPIA-registraties',type:'dpia'},
      {rx:/\b(licenties|licentie)\b/,rows:data.licenseReview,name:'licentieregistraties ter controle',type:'licenseReview'},
      {rx:/\b(faq|veelgestelde|vragen)\b/,rows:data.faqs,name:'vaste FAQ-antwoorden',type:'faqs'},
      {rx:/\b(werkacties|werkregister|acties)\b/,rows:data.workActions,name:'werkregisteracties',type:'workActions'},
      {rx:/\b(apparaten|apparaatmetingen|hardware)\b/,rows:data.devices,name:'apparaatmetingen, geen volledige hardwarelijst',type:'devices'},
      {rx:/\b(applicatie|applicaties|toepassing|toepassingen|software|diensten|apps)\b/,rows:apps,name:'basisregistraties van toepassingen en diensten; geen bewezen volledig schooltotaal',type:'apps'}
    ];
    const match=categories.find(x=>x.rx.test(q));
    if(!match)return null;
    return result('count',match.rows.length+' '+match.name+'.',match.rows.slice(0,10).map(x=>entry(match.type,x)),'Telling per register',recordSources(match.rows));
  }
  function listQuery(q,data){
    if(!/\b(welke|toon|lijst|overzicht|zoek|vinden|geef|voor)\b/.test(q))return null;
    const apps=data.apps;
    if(/\b(eigenaar|verantwoordelijke|beheerder)\b/.test(q)&&/\b(niet|geen|onbekend|zonder|ontbreken)\b/.test(q)){
      const rows=apps.filter(x=>unknown(x.owner));
      return result('list',rows.length+' van '+apps.length+' basisregistraties hebben nog geen vastgestelde verantwoordelijke. Bijvoorbeeld: '+shortList(rows)+'.',rows.map(x=>entry('apps',x)),'Open controles',recordSources(rows));
    }
    if(/\b(printer|printers|printersoftware|printsoftware|printen|afdruk|afdrukken|afdruksoftware|kopieren|kopieer)\b/.test(q)){
      const rows=apps.filter(x=>/\b(print|afdruk|uniflow|kuario|printer|kopieer)/.test(norm([x.name,x.description,x.process].join(' '))));
      return result('list',rows.length?'Bij printen en afdrukken staan in het overzicht: '+shortList(rows)+'. Of alle voorzieningen nu op school worden gebruikt, is nog niet bevestigd.':'Ik kan geen print- of afdruksoftware vinden in de huidige gegevens.',rows.map(x=>entry('apps',x)),rows.length?'Uit de inventarisatie':'Geen bronmatch',recordSources(rows));
    }
    if(/\b(telefonie|telefoon|bellen|bereikbaarheid|telefoniesoftware)\b/.test(q)){
      const rows=apps.filter(x=>/\b(telefonie|telefoon|bereikbaarheid|3cx)\b/.test(norm([x.name,x.description].join(' '))));
      return result('list',rows.length?'Bij telefonie en bereikbaarheid staat in het overzicht: '+shortList(rows)+'. Het daadwerkelijke schoolgebruik is nog niet voor elke voorziening bevestigd.':'Ik kan geen telefoniesoftware vinden in de huidige gegevens.',rows.map(x=>entry('apps',x)),rows.length?'Uit de inventarisatie':'Geen bronmatch',recordSources(rows));
    }
    if(/\b(ai|kunstmatige|copilot)\b/.test(q)){
      const ids=new Set(data.ai.map(x=>x.parentId).filter(Boolean));
      const rows=apps.filter(x=>ids.has(x.id));
      return result('list',rows.length+' toepassingen hebben een relatie met beschreven AI-functies: '+shortList(rows)+'. Dit is geen bewijs van ingeschakelde functies.',rows.map(x=>entry('apps',x)),'Beschreven AI-relaties',recordSources(rows));
    }
    if(/\b(entra|sso)\b/.test(q)){
      const ids=new Set(data.connections.map(x=>x.matchedId).filter(Boolean));
      const rows=apps.filter(x=>ids.has(x.id));
      return result('list',rows.length+' basisregistraties hebben een mogelijke Entra-match: '+shortList(rows)+'. Een match is geen bevestiging van een actieve koppeling.',rows.map(x=>entry('apps',x)),'Mogelijke koppelingen',recordSources(rows));
    }
    if(/\b(applicatie|applicaties|toepassing|toepassingen|software|apps|diensten)\b/.test(q)){
      return result('list','Er zijn '+apps.length+' basisregistraties: '+shortList(apps)+'. De inventarisatie is nog niet als volledig vastgesteld.',apps.slice(0,12).map(x=>entry('apps',x)),'Basisinventaris',recordSources(apps));
    }
    return null;
  }
  function ranked(q,data){
    const tokens=words(q).filter(t=>t.length>=3);
    if(!tokens.length)return[];
    const defs=[['apps',data.apps],['ai',data.ai],['connections',data.connections],['faqs',data.faqs]];
    return defs.flatMap(([type,rows])=>rows.map(r=>{
      const name=norm(r.name),extra=norm([r.description,r.product,r.answer,r.aliases,r.matched,r.action].join(' '));
      let score=0;
      for(const token of tokens){if(name.split(' ').includes(token))score+=7;else if(name.includes(token))score+=3;if(extra.includes(token))score+=1;}
      if(name.includes(q))score+=15;
      return {type,row:r,score};
    })).filter(x=>x.score>=3).sort((a,b)=>b.score-a.score||a.row.name.localeCompare(b.row.name,'nl')).slice(0,8).map(x=>entry(x.type,x.row));
  }
  function search(question,dataset){
    const q=norm(question);
    const data={apps:dataset.apps||[],ai:dataset.ai||[],connections:dataset.connections||[],parts:dataset.parts||[],candidates:dataset.candidates||[],faqs:dataset.faqs||[],
      dpia:dataset.dpia||[],licenseReview:dataset.licenseReview||[],workActions:dataset.workActions||[],devices:dataset.devices||[],index:dataset.index||null};
    if(q.length<2)return result('empty','');
    const faq=exactFaq(q,data.faqs);
    if(faq)return result('faq',faq.answer,[entry('faqs',faq)],faq.status||'Vast antwoord',faq.sources||[],question);
    // Een vraag naar aantallen moet vóór de naamherkenning worden afgehandeld:
    // anders kan 'Entra ID / LDAP' het overzicht van alle Entra-registraties onderscheppen.
    const count=countQuery(q,data);if(count)return count;
    const app=findApp(q,data.apps);
    if(app)return describeApp(q,app,data);
    const list=listQuery(q,data);if(list)return list;
    const near=fuzzyFaq(q,data.faqs);
    if(near)return result('faq',near.answer,[entry('faqs',near)],near.status||'Vast antwoord',near.sources||[],question);
    const suggestions=ranked(q,data);
    if(suggestions.length)return result('suggestions','Geen rechtstreeks antwoord gevonden. Dit zijn registraties die mogelijk bij je vraag passen.',suggestions,'Zoeksuggesties',[],question);
    return result('none','Geen betrouwbaar antwoord gevonden in de huidige gegevens. Probeer een toepassingsnaam of een kortere vraag.',[],'Niet gevonden',[],question);
  }
  // Present natural questions before answering. Every suggestion maps to an existing
  // fact query or a fixed FAQ. No language model or invented source information.
  function predict(typed,dataset,limit=5){
    const raw=norm(typed),terms=words(typed);
    const data={apps:dataset.apps||[],ai:dataset.ai||[],connections:dataset.connections||[],faqs:dataset.faqs||[]};
    const found=[],unique=new Set();
    const add=(question,keywords='',context='')=>{
      const n=norm(question);
      if(!n||unique.has(n))return;
      unique.add(n);
      found.push({question,keywords:norm(keywords),context,order:found.length});
    };
    const apps=data.apps;
    const printing=apps.some(a=>/\b(print|afdruk|uniflow|kuario|printer)/.test(norm([a.name,a.description,a.process].join(' '))));
    const phone=apps.some(a=>/\b(telefonie|telefoon|3cx|bereikbaarheid)\b/.test(norm([a.name,a.description,a.process].join(' '))));
    if(printing){
      add('Welke printsoftware gebruiken we?','printers printen afdrukken kopieren uniflow kuario','Software');
      add('Welke programma’s gebruiken we om te printen?','printsoftware printers printen afdrukken kopieer','Software');
    }
    if(phone)add('Welke software gebruiken we voor telefonie?','telefoon telefooncentrale bellen 3cx bereikbaarheid','Software');
    if(apps.some(a=>norm(a.name)==='3cx'))add('Wie beheert 3CX?','verantwoordelijke eigenaar 3cx telefonie','Toepassing');
    if(apps.length){
      add('Hoeveel toepassingen staan er in het overzicht?','aantal applicaties software diensten apps','Overzicht');
      add('Welke toepassingen hebben AI-functies?','ai copilot toepassingen software','AI');
      add('Welke toepassingen hebben nog geen verantwoordelijke?','beheer eigenaars beheerder eigenaar ontbreekt','Controle');
      add('Welke toepassingen hebben een Entra-match?','entra sso koppelingen','Verbanden');
    }
    if(data.connections.length)add('Hoeveel Entra-registraties zijn er?','entra sso connecties','Overzicht');
    if(data.ai.length)add('Hoeveel AI-functies zijn beschreven?','ai copilot functies','AI');
    for(const faq of data.faqs){
      const aliases=String(faq.aliases||'').split('|').join(' ');
      add(faq.name,aliases+' '+faq.topic,'Veelgestelde vraag');
    }
    if(raw){
      const candidates=apps.filter(a=>{
        const name=norm(a.name);
        if(name.length<2)return false;
        return name.split(' ').some(w=>w.length>=2&&terms.some(t=>w.startsWith(t)||t.startsWith(w)))||raw.includes(name);
      }).sort((a,b)=>{
        const relevance=a=>norm(a.name)===raw?3:norm(a.name).startsWith(raw)?2:norm(a.name).includes(raw)?1:0;
        return relevance(b)-relevance(a)||a.name.length-b.name.length;
      }).slice(0,4);
      for(const app of candidates){
        add('Wat doet '+app.name+'?',app.name+' omschrijving waarvoor doel','Toepassing');
        add('Wie beheert '+app.name+'?',app.name+' eigenaar verantwoordelijke beheer','Toepassing');
        add('Gebruiken we '+app.name+'?',app.name+' actief aanwezig gebruikt','Toepassing');
        add('Welke AI-functies heeft '+app.name+'?',app.name+' copilot ai functies','AI');
      }
    }
    if(!raw){
      const preferred=[
        'Welke printsoftware gebruiken we?',
        'Wie beheert 3CX?',
        'Wat betekent een Entra-registratie?',
        'Welke toepassingen hebben AI-functies?'
      ];
      const starter=preferred.map(q=>found.find(x=>norm(x.question)===norm(q))).filter(Boolean);
      if(starter.length)return starter.slice(0,limit).map(({question,context})=>({question,context}));
      return found.slice(0,Math.min(3,limit)).map(({question,context})=>({question,context}));
    }
    const score=entry=>{
      const hay=norm(entry.question)+' '+entry.keywords;
      const hayWords=new Set(hay.split(' ').filter(Boolean));
      const matched=terms.filter(term=>[...hayWords].some(w=>w===term||w.startsWith(term)||(term.length>3&&term.startsWith(w)))).length;
      if(!matched)return 0;
      const coverage=matched/Math.max(1,terms.length);
      let points=coverage*7+matched*1.3;
      if(norm(entry.question).startsWith(raw))points+=12;
      else if(norm(entry.question).includes(raw))points+=5;
      if(terms.some(x=>entry.keywords.split(' ').includes(x)))points+=1;
      if(entry.context==='Veelgestelde vraag')points+=0.25;
      return points;
    };
    const ranked=found.map(x=>({...x,score:score(x)})).filter(x=>x.score>=3.8).sort((a,b)=>b.score-a.score||a.order-b.order);
    return ranked.slice(0,limit).map(({question,context})=>({question,context}));
  }
  const api=Object.freeze({search,predict,norm,unknown,words});
  if(typeof window!=='undefined')window.EmmausAnswerLogic=api;
  const input=document.getElementById('globalSearch'),host=document.getElementById('globalResults');
  if(!input||!host)return;
  const make=(tag,cls,txt)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(txt!==undefined)node.textContent=String(txt);return node;};
  const wrap=input.closest('.global-search-wrap');
  let mode='closed',options=[],active=-1;
  input.setAttribute('role','combobox');
  input.setAttribute('aria-controls','globalResults');
  input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-expanded','false');
  function snapshot(){
    const ix=window.IctInventoryIndex?.build(state);
    const from=name=>ix?ix.records(name):(state[name] instanceof Map?[...state[name].values()]:[]);
    return {index:ix,apps:from('apps'),ai:from('ai'),connections:from('connections'),
      parts:from('parts'),candidates:from('additionalCandidates'),faqs:from('faqs'),
      dpia:from('dpia'),licenseReview:from('licenseReview'),workActions:from('workActions'),
      devices:from('devices'),hardwareGroups:from('hardwareGroups')};
  }
  function show(){
    host.hidden=false;wrap?.classList.add('has-answer');input.setAttribute('aria-expanded','true');
  }
  function hide(){
    mode='closed';options=[];active=-1;host.hidden=true;host.replaceChildren();wrap?.classList.remove('has-answer');
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
  }
  function openResult(item){
    if(item.type==='apps'||item.type==='ai'||item.type==='connections'){
      if(typeof openRecord==='function')openRecord(item.type,item.id);
    }else if(window.EmmausRecordCards) {
      const mapping={faqs:'faqs',candidates:'additionalCandidates'};
      window.EmmausRecordCards.open(mapping[item.type]||item.type,item.id);
    }
    hide();input.value='';
  }
  function answer(question){
    const q=String(question||'').trim();
    if(norm(q).length<2){hide();return;}
    input.value=q;options=[];active=-1;mode='answer';
    input.removeAttribute('aria-activedescendant');
    const found=search(q,snapshot());
    host.replaceChildren();show();
    const card=make('section','answer-result');
    card.append(make('p','answer-kicker',found.kind==='faq'?'Vast antwoord':found.kind==='suggestions'?'Mogelijke resultaten':'Antwoord uit de gegevens'));
    card.append(make('p','answer-query',q));
    card.append(make('p','answer-body',found.answer));
    card.append(make('p','answer-status',found.status));
    if(found.records.length){
      const list=make('div','answer-records');
      for(const record of found.records.slice(0,8)){
        const button=make('button','answer-record');
        button.type='button';button.dataset.resultKind=record.type;button.dataset.resultId=record.id;
        button.append(make('strong','',record.name),make('small','',record.id));
        button.addEventListener('click',()=>openResult(record));list.append(button);
      }
      card.append(list);
      if(found.records.length>8)card.append(make('p','answer-foot','Bekijk de overige resultaten in het register.'));
    }
    if(found.kind==='none'||found.kind==='suggestions')card.append(make('p','answer-foot','Er is geen controleerbaar antwoord gevonden.'));
    // Herkomst blijft in de bronregistratie, niet in openbare zoekresultaten.
    const back=make('button','answer-again','Andere vraag');
    back.type='button';back.addEventListener('click',()=>{
      input.value='';suggest();input.focus();
    });
    card.append(back);host.append(card);
    return found;
  }
  function select(index){
    if(!options[index])return false;
    answer(options[index].question);
    return true;
  }
  function highlight(index){
    if(!options.length)return;
    active=(index+options.length)%options.length;
    const list=host.querySelectorAll('[data-question-index]');
    list.forEach((node,i)=>{
      node.classList.toggle('is-active',i===active);
      node.setAttribute('aria-selected',String(i===active));
    });
    input.setAttribute('aria-activedescendant','answer-prediction-'+active);
  }
  function suggest(){
    const q=input.value.trim();
    options=predict(q,snapshot());
    active=-1;input.removeAttribute('aria-activedescendant');
    host.replaceChildren();
    if(!options.length){
      if(q.length>1){
        mode='predict';show();
        const wrap=make('section','answer-result');
        wrap.append(make('p','answer-kicker','Vraag stellen'));
        wrap.append(make('p','answer-foot','Druk op Enter om je vraag te zoeken.'));
        host.append(wrap);
      }else hide();
      return options;
    }
    mode='predict';show();
    const panel=make('section','answer-result answer-predict');
    panel.append(make('p','answer-kicker',q?'Bedoel je een van deze vragen?':'Je kunt bijvoorbeeld vragen:'));
    const list=make('div','answer-predictions');list.setAttribute('role','listbox');
    list.setAttribute('aria-label','Voorgestelde vragen');
    options.forEach((option,index)=>{
      const button=make('button','answer-prediction');
      button.type='button';button.dataset.questionIndex=String(index);
      button.id='answer-prediction-'+index;
      button.setAttribute('role','option');
      button.setAttribute('aria-selected','false');
      button.append(make('span','',option.question),make('small','',option.context));
      button.addEventListener('click',()=>select(index));
      button.addEventListener('mouseenter',()=>highlight(index));
      list.append(button);
    });
    panel.append(list);
    if(q)panel.append(make('p','answer-foot','Kies een vraag of druk op Enter voor je eigen vraag.'));
    host.append(panel);
    return options;
  }
  function render(){return suggest();}
  function handleKeydown(event){
    if(event.key==='Escape'){
      if(!host.hidden){event.preventDefault();event.stopPropagation();hide();return true;}
      return false;
    }
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      if(mode!=='predict'||!options.length)return false;
      event.preventDefault();event.stopPropagation();
      highlight(active<0?(event.key==='ArrowDown'?0:options.length-1):active+(event.key==='ArrowDown'?1:-1));
      return true;
    }
    if(event.key==='Enter'){
      event.preventDefault();event.stopPropagation();
      if(mode==='predict'&&active>=0&&select(active))return true;
      answer(input.value);return true;
    }
    return false;
  }
  window.EmmausAnswerEngine=Object.freeze({render,search,predict,answer,handleKeydown});
  input.addEventListener('focus',()=>{
    if(mode!=='answer')suggest();
  });
  document.addEventListener('ict-scan:local-restored',()=>{
    if(document.activeElement===input&&mode!=='answer')suggest();
  });
})();
