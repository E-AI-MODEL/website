'use strict';
/* Print and role workbooks are projections of the shared inventory index.
   No new register, inferred risk classification, or external data transfer. */
(function(root){
 const titles={
  all:['Schoolbrede ICT-inventarisatie','Schoolleiding en betrokken functionarissen'],
  ict:['ICT-beheer en inrichting','ICT / functioneel beheer'],
  privacy:['Privacy en toezicht','Functionaris gegevensbescherming (FG)'],
  aiGovernance:['AI-beleid en toezicht op uitvoering','AI-functionaris'],
  schoolbreed:['Applicaties en diensten','ICT / schoolleiding'],
  koppelingen:['Entra en toegang','ICT / functioneel beheer'],
  ai:['AI in het onderwijs en de school','Onderwijs / AI-functionaris'],
  devices:['Apparaten en beheer','ICT / facilitair'],
  controles:['Controles en vervolgacties','ICT / schoolleiding']
 };
 const str=v=>v==null?'':Array.isArray(v)?v.map(str).join('; '):typeof v==='object'?Object.values(v).map(str).join(' · '):String(v);
 const e=v=>str(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const value=v=>str(v).trim()||'Niet vastgelegd';
 const sort=rows=>rows.slice().sort((a,b)=>str(a.name||a.id).localeCompare(str(b.name||b.id),'nl'));
 const counts=(rows,field)=>{const m=new Map();for(const r of rows){const k=value(r[field]);m.set(k,(m.get(k)||0)+1);}return [...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'nl'));};
 const unknown=v=>!str(v).trim()||/^\?|onbekend|niet inzichtelijk|niet vastgesteld|niet gecontroleerd|niet bekend/i.test(str(v));
 const closed=v=>/^(afgerond|gesloten|voltooid)$/i.test(str(v).trim());
 const financial=s=>/financieel|financi[eë]n|boekingsregel|factuurbedrag|grootboek/i.test(str(s));
 const cleanSource=s=>financial(s)?'ICT-registratie 2026':str(s);
 function build(index,options={}){
  const scope=titles[options.scope]?options.scope:'all', [title,audience]=titles[scope];
  const r=t=>sort(index.records(t)), a=r('apps'), p=r('parts'), c=r('connections'), d=r('devices'), h=r('hardwareGroups'), ai=r('ai'), ctl=r('checks'), dp=r('dpia'), ac=r('aiControls'), wa=r('workActions'), sw=r('softwareReview'), lic=r('licenseReview'), cand=r('additionalCandidates');
  const cls=ai.filter(x=>options.taxonomy?.isClassroomAi(x)), org=ai.filter(x=>options.taxonomy?.isSchoolAi(x)), other=ai.filter(x=>!cls.includes(x)&&!org.includes(x));
  const pending=ctl.filter(x=>!closed(x.status)), openWork=wa.filter(x=>!closed(x.status));
  const sections=[], usedSources=new Set(), referencedRecords=new Set();
  const src=(type,x)=>{const links=index.sourcesFor(type,x.id);links.matched.forEach(id=>usedSources.add(id));referencedRecords.add(type+':'+x.id);return [...links.matched,...links.unmatched.map(cleanSource)].join('; ')||'Niet vastgelegd';};
  const field=(label,v)=>[label,value(v)];
  const section=(title,lead,blocks)=>sections.push({title,lead,blocks});
  const table=(headers,rows)=>({kind:'table',headers,rows});
  const chart=(label,entries)=>({kind:'bars',label,entries});
  const note=text=>({kind:'note',text});
  const cards=(type,rows,fields)=>({kind:'cards',items:rows.map(x=>({id:x.id,name:x.name||x.id,fields:[...fields.map(([label,key])=>field(label,typeof key==='function'?key(x):x[key])),field('Bron',src(type,x))]}))});
  const list=(type,rows,fields)=>table(['ID / naam',...fields.map(f=>f[0]),'Bron'],rows.map(x=>[value(x.id)+' · '+value(x.name),...fields.map(([,key])=>value(typeof key==='function'?key(x):x[key])),src(type,x)]));
  const appFields=[['Soort / gebruik',x=>[x.kind,x.area].filter(Boolean).join(' · ')],['Beschrijving','description'],['Lokale status','local'],['Eigenaar','owner'],['Gegevens','data'],['Koppelingen','links'],['Onderdeel van','parent']];
  const aiFields=[['Product / lesfase',x=>[x.product,x.phase].filter(Boolean).join(' · ')],['Wat AI doet','action'],['Wie gebruikt AI','users'],['Instellingen / invoer','input'],['Controle door docent of medewerker','teacher'],['Handeling van leerling','student'],['Didactisch doel','learning'],['Didactisch aandachtspunt','attention'],['Onderbouwing','didactics'],['Formatief handelen','formative'],['Niet inzichtelijk','unknown'],['Stuurbaarheid','steer'],['AI Act-indicatie','aiAct'],['Lokale status','local']];
  const workFields=[['Vervolgactie','action'],['Betrokken rollen','involvedRoles'],['Status','status']];
  const checkFields=[['Categorie / prioriteit',x=>[x.category,x.priority].filter(Boolean).join(' · ')],['Wat controleren','explanation'],['Status','status']];
  const appSection=()=>section('Applicaties en onderdelen','De telling betreft applicatieregistraties. Onderdelen tellen niet als extra applicaties. Een registratie bewijst geen gebruik.',[
   chart('Toepassingen naar gebruiksgebied',counts(a,'area')),chart('Toepassingen naar soort',counts(a,'kind')),
   cards('apps',a,appFields),list('parts',p,[['Bovenliggende toepassing','parent'],['Beschrijving','description'],['Lokale status','local']])]);
  const connectionSection=()=>section('Identiteit en toegang','Entra-registraties zijn geen bewijs van actieve gegevensuitwisseling of toegang van een specifieke gebruiker.',[
   chart('Status volgens Entra-registratie',counts(c,'enabled')),list('connections',c,[['Ingeschakeld','enabled'],['Zichtbaarheid','visible'],['Mogelijke applicatie','matched']])]);
  const deviceSection=()=>section('Apparaten en hardware','Meetwaarden kunnen elkaar overlappen. Entra-records zijn geen telling van unieke fysieke apparaten.',[
   cards('devices',d,[['Meetwaarde','quantity'],['Type','type'],['Peildatum','measurementDate'],['Beschrijving','description'],['Beperking','limitation']]),
   cards('hardwareGroups',h,[['Aantal / meetwaarde',x=>x.quantity??x.count],['Type','type'],['Beheer',x=>x.management??x.managedBy],['Beschrijving','description'],['Lokale status',x=>x.local??x.status],['Beperking','limitation']])]);
  const licenseSection=()=>section('Licenties en softwarecontrole','Een aangeboden functie of licentie bewijst geen lokale toewijzing. Geen bedragen of boekingsgegevens.',[
   cards('licenseReview',lic,[['Wat bekend is',x=>x.known??x.description],['Licentie',x=>x.license??x.plan],['Te controleren',x=>x.action??x.check],['Status',x=>x.status??x.local]]),
   cards('softwareReview',sw,[['Wat bekend is','known'],['Te controleren','action'],['Status','status']]),
   cards('additionalCandidates',cand,[['Beschrijving','description'],['Status',x=>x.status??x.local],['Te controleren','action']])]);
  const aiSection=()=>{const phases=new Map();for(const x of cls)for(const phase of options.taxonomy?.chartPhases(x)||[])phases.set(phase,(phases.get(phase)||0)+1);
   section('AI in het onderwijs','Een functie kan bij meer lesfasen horen. De fase of leveranciersbeschrijving bewijst geen leerwinst of lokaal gebruik.',[
   chart('Geregistreerde functies per lesfase',[...phases].sort((a,b)=>b[1]-a[1])),cards('ai',cls,aiFields)]);
   section('AI voor organisatie en beheer','Deze functies vallen buiten het onderwijsleerproces.',[cards('ai',org,aiFields),...(other.length?[note('Nog niet ingedeelde functies:'),cards('ai',other,aiFields)]:[])]);};
  const aiControlSection=()=>section('AI-instellingen en opvolging','Advies, leveranciersmogelijkheden en geverifieerde schoolinstellingen blijven afzonderlijk.',[
   cards('aiControls',ac,[['Functie','description'],['Advies','advice'],['Lokale status','local'],['Te controleren','action']]),
   cards('workActions',wa,workFields),cards('softwareReview',sw,[['Wat bekend is','known'],['Vervolgactie','action'],['Status','status']])]);
  const privacySection=()=>section('DPIA-bronnen en lokale toepassing','Externe beoordelingen zijn geen lokale DPIA of toestemming. De FG adviseert en houdt onafhankelijk toezicht; het bevoegd gezag beslist.',[
   chart('Bewijsstatus volgens de bron',counts(dp,'evidence')),
   cards('dpia',dp,[['Externe beoordeling','assessment'],['Bewijsstatus','evidence'],['Beschrijving','description'],['Lokale toepassing','local']])]);
  const findingsSection=()=>section('Onderzoekspunten en opvolging','Geregistreerde controles en automatisch afgeleide signalen zijn verschillende soorten informatie. Een open vraag is geen bewezen probleem.',[
   chart('Geregistreerde controles naar categorie',counts(ctl,'category')),cards('checks',ctl,checkFields),
   table(['Signaal','Categorie','Toelichting'],(options.signals||[]).map(x=>[value(x.id)+' · '+value(x.name),value(x.category),value(x.explanation)]))]);
  const workSection=()=>section('Werkregister','Status en betrokken rollen komen rechtstreeks uit de registratie; ontbrekende actiehouders of termijnen worden niet ingevuld.',[cards('workActions',wa,workFields)]);
  const frameworkSection=(filter,title)=>{const rows=[];for(const t of ['apps','ai','checks','dpia','aiControls','workActions','softwareReview','licenseReview'])for(const x of r(t))for(const link of x.frameworkLinks||[]){if(!filter(link))continue;rows.push([value(x.id)+' · '+value(x.name),value(link.frameworkId)+' '+str(link.article),value(link.status),value(link.note),value(link.followUp),value(link.followUpOwner),value(link.followUpStatus),[str(link.evidence),src(t,x)].filter(Boolean).join('; ')]);}
   section(title,'Dit zijn geregistreerde verwijzingen naar normen en artikelen. Geen automatische vaststelling van toepasselijkheid of naleving.',[{kind:'cards',items:rows.map(row=>({id:row[0].split(' · ')[0],name:row[0],fields:[['Kader / artikel',row[1]],['Beoordeling',row[2]],['Toelichting',row[3]],['Vervolg',row[4]],['Actiehouder',row[5]],['Status',row[6]],['Bewijs',row[7]]]}))}]);};
  const assuranceSection=()=>{const result=options.assurance, labels={pass:'Geslaagd',attention:'Aandacht',fail:'Afgekeurd',not_run:'Niet uitgevoerd'};
   section('Automatische gegevenscontroles','De uitslag betreft de registraties en is geen systeem- of organisatiegoedkeuring.',result?[note('Controledatum: '+value(result.context?.asOf)+' · Gegevensversie: '+value(result.context?.sourceFingerprint)+' · Regelversie: '+value(result.rulesetVersion)),table(['Controle','Uitslag','Bevindingen'],(result.checks||[]).map(x=>[value(x.id)+' · '+value(x.title),value(labels[x.status]||x.status),[...((x.findings||[]).reduce((m,f)=>{m.set(f.message,(m.get(f.message)||0)+1);return m;},new Map()))].map(([message,n])=>n+' × '+message).join('\n')||'Geen bevindingen vermeld']))]:[note('Geen actuele controleuitslag beschikbaar. Voer de gegevenscontrole uit om een uitslag te kunnen opnemen.')]);};
  let kpis=[],summary='';
  const k=(label,n)=>[label,n];
  switch(scope){
   case 'ict':
    kpis=[k('Applicaties',a.length),k('Entra-registraties',c.length),k('Hardwaregroepen',h.length),k('Licentiecontroles',lic.length),k('Niet afgesloten controles',pending.length),k('Niet afgesloten werkacties',openWork.length)];
    summary='Voor technisch beheer: applicaties, identiteit, toegang, apparaten, licenties en opvolging. Controleer vooral of geregistreerde mogelijkheden daadwerkelijk zijn ingericht en wie verantwoordelijk is.';
    connectionSection();deviceSection();licenseSection();appSection();findingsSection();workSection();assuranceSection();break;
   case 'privacy':
    kpis=[k('DPIA-brononderwerpen',dp.length),k('Applicatieregistraties',a.length),k('Gegevensveld onbekend',a.filter(x=>unknown(x.data)).length),k('Niet afgesloten controles (schoolbreed)',pending.length)];
    summary='Voor onafhankelijk advies en toezicht: beschikbare externe privacybeoordelingen, lokaal bewijs, gegevensstromen en vragen aan het bevoegd gezag. Dit is geen FG-advies, verwerkingsregister of uitgevoerde DPIA.';
    privacySection();
    section('Gegevens en toegang','Het applicatieregister beschrijft gegevens en koppelingen voor zover bekend. Grondslag, doelen, bewaartermijnen, verwerkersovereenkomsten en doorgiften moeten per verwerking afzonderlijk worden gecontroleerd.',[cards('apps',a,[['Gegevens','data'],['Koppelingen','links'],['Lokale status','local'],['Eigenaar','owner']]),list('connections',c,[['Ingeschakeld','enabled'],['Mogelijke applicatie','matched']])]);
    frameworkSection(x=>/AVG|UAVG|IBP|GDPR/i.test(str(x.frameworkId)),'Geregistreerde privacy- en IBP-verwijzingen');findingsSection();workSection();assuranceSection();break;
   case 'aiGovernance':
    kpis=[k('AI-functies',ai.length),k('Lokale status onbekend',ai.filter(x=>unknown(x.local)).length),k('AI-beheerpunten',ac.length),k('Niet afgesloten werkacties (schoolbreed)',openWork.length)];
    summary='Voor de AI-functionaris: concrete toepassingen, lokaal gebruik en instellingen, menselijke controle, scholing en opvolging van de AI-verordening. Een leveranciersfunctie is niet automatisch toegestaan of actief.';
    aiControlSection();
    frameworkSection(x=>/AIACT/i.test(str(x.frameworkId)),'AI-verordening: vastgelegde verwijzingen en acties');
    section('AI-indicaties en gebruik','De indicatie uit het register is geen definitieve juridische risicoklasse. Beoordeel per concrete inzet, doel en gebruikersgroep.',[chart('Lokale status volgens registratie',counts(ai,'local')),chart('AI Act-indicatie volgens registratie',counts(ai,'aiAct')),list('ai',ai,[['Product','product'],['Indicatie','aiAct'],['Lokale status','local']]),note('Scholing en AI-geletterdheid: registreer doelgroep, inhoud, maatregelen en bewijs van uitvoering. Deze rapportage leidt geen bekwaamheid af uit een geplande activiteit.')]);
    aiSection();privacySection();assuranceSection();break;
   case 'schoolbreed':kpis=[k('Applicaties',a.length),k('Onderdelen',p.length),k('Niet ingedeelde kandidaten',cand.length)];summary='Overzicht van geregistreerde toepassingen, onderdelen en technische functie.';appSection();licenseSection();break;
   case 'koppelingen':kpis=[k('Entra-registraties',c.length),k('Applicatieverwijzing onbekend',c.filter(x=>unknown(x.matched)).length)];summary='Overzicht van de geregistreerde Entra-koppelingen en hun bekende status.';connectionSection();break;
   case 'ai':kpis=[k('AI-functies',ai.length),k('Onderwijs',cls.length),k('Organisatie en beheer',org.length),k('Niet ingedeeld',other.length)];summary='Functies en de verdeling van handelingen tussen AI, docent en leerling.';aiSection();aiControlSection();break;
   case 'devices':kpis=[k('Apparaatmetingen',d.length),k('Hardwaregroepen',h.length)];summary='Meetwaarden, peildata en beperkingen van de hardware-inventarisatie.';deviceSection();break;
   case 'controles':kpis=[k('Geregistreerde controles',ctl.length),k('Niet afgesloten controles',pending.length),k('Automatische signalen',(options.signals||[]).length),k('Werkacties',wa.length)];summary='Onderzoeksvragen, vervolgacties en de meest recente beschikbare automatische gegevenscontrole.';findingsSection();workSection();assuranceSection();break;
   default:kpis=[k('Applicaties',a.length),k('Entra-registraties',c.length),k('AI-functies',ai.length),k('Niet afgesloten controles',pending.length)];summary='Schoolbreed beeld van toepassingen, toegang, hardware, AI, privacy en openstaande controles. Registraties en feitelijk gebruik zijn niet hetzelfde.';appSection();connectionSection();deviceSection();licenseSection();aiSection();aiControlSection();privacySection();findingsSection();frameworkSection(()=>true,'Toetsingskaders en geregistreerde vervolgacties');assuranceSection();
  }
  const sourceRecords=r('sourceRegister').filter(x=>usedSources.has(x.id));
  section('Bronnen en afbakening','Bron-ID’s verwijzen naar het bestaande bronregister. Een gekoppelde bronverwijzing bewijst niet dat de bron is beoordeeld. Niet gekoppelde verwijzingen blijven bij het betreffende record staan.',[
   note('Gegevensbasis: '+value(options.sourceLabel)+' · Indexversie: '+value(index.version)+' · '+referencedRecords.size+' opgenomen record-ID’s.'),
   table(['Bron-ID','Bron'],sourceRecords.map(x=>[value(x.id),cleanSource(x.name)])),
   table(['Toetsingsbron','Link'],(options.legalSources||[]).map(x=>[x.name,x.url])),
   note('Geen financiële bedragen of boekingsregels opgenomen. Raadpleeg het actuele bronregister en de geldende wet- en regelgeving vóór een formeel besluit.')]);
  return {scope,title,audience,summary,kpis,sections,date:options.date||new Date().toLocaleDateString('nl-NL'),sourceLabel:value(options.sourceLabel)};
 }
 function render(model){
  const table=b=>b.rows.length?'<table class="report-table'+(b.headers.length>5?' report-wide':'')+'"><thead><tr>'+b.headers.map(h=>'<th scope="col">'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+b.rows.map(row=>'<tr>'+row.map(v=>'<td>'+e(value(v))+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p class="report-empty">Geen registraties in de ingelezen gegevens.</p>';
  const block=b=>{
   if(b.kind==='table')return table(b);
   if(b.kind==='note')return '<p class="report-note">'+e(b.text)+'</p>';
   if(b.kind==='cards')return b.items.length?b.items.map(x=>'<article class="report-record"><header><span class="report-id">'+e(x.id)+'</span><h3>'+e(x.name)+'</h3></header><dl>'+x.fields.map(([k,v])=>'<div><dt>'+e(k)+'</dt><dd>'+e(v)+'</dd></div>').join('')+'</dl></article>').join(''):'<p class="report-empty">Geen registraties in de ingelezen gegevens.</p>';
   if(b.kind==='bars'){const max=Math.max(1,...b.entries.map(x=>x[1]));return '<figure class="report-figure"><figcaption>'+e(b.label)+'</figcaption>'+(b.entries.length?b.entries.map(([k,n])=>'<div class="report-bar"><span>'+e(k)+'</span><div class="report-track"><i style="width:'+Math.max(0,Math.min(100,n/max*100))+'%"></i></div><b>'+e(n)+'</b></div>').join(''):'<p class="report-empty">Geen registraties.</p>')+'</figure>';}
   return '';
  };
  return '<div class="report-document"><header class="report-cover"><div class="report-brand"><img class="print-logo" src="./emmaus-logo.svg" alt="Emmauscollege Rotterdam"><span>ICT-SCAN / RAPPORTAGE</span></div><div class="report-cover-title"><div class="report-eyebrow">'+e(model.audience)+'</div><h1>'+e(model.title)+'</h1><p>Emmauscollege · '+e(model.date)+'</p></div><h2>In één oogopslag</h2><p class="report-summary">'+e(model.summary)+'</p><div class="report-kpis">'+model.kpis.map(([l,n])=>'<div><strong>'+e(n)+'</strong><span>'+e(l)+'</span></div>').join('')+'</div><p class="report-note">Gegevensbasis: '+e(model.sourceLabel)+'. De exportdatum is niet de peildatum van alle brongegevens.</p><h2>Inhoud</h2><ol class="report-toc">'+model.sections.map(s=>'<li>'+e(s.title)+'</li>').join('')+'</ol></header>'+model.sections.map((s,i)=>'<section class="report-chapter"><div class="report-chapter-label">ICT-SCAN / '+String(i+1).padStart(2,'0')+'</div><h2>'+e(s.title)+'</h2><p class="report-intro-text">'+e(s.lead)+'</p>'+s.blocks.map(block).join('')+'</section>').join('')+'</div>';
 }
 root.IctPrintReports=Object.freeze({titles,build,render});
 if(typeof module==='object'&&module.exports)module.exports=root.IctPrintReports;
})(globalThis);
