'use strict';
/* Print and role workbooks are projections of the shared inventory index.
   No new register, inferred risk classification, or external data transfer. */
(function(root){
 const definitions=Object.freeze({"bestuur":["Bestuurlijke stand van zaken","Schoolleiding en bevoegd gezag","Bestuur en verantwoording","Bespreek wat bekend is, welke besluiten nog nodig zijn en wie vervolgacties oppakt.","Geen verklaring dat de school aan de wetgeving voldoet."],"ibp":["IBP-voortgang en verantwoording","Bevoegd gezag / IBP / ICT","Bestuur en verantwoording","Vastgelegde IBP-normverwijzingen, technische maatregelen, controles en opvolging.","Geen volledige IBP-normmeting, volwassenheidsscore of auditverklaring."],"aiAct":["AI Act: gebruik en verplichtingen","AI-functionaris / bevoegd gezag / FG","AI en onderwijs","Beoordeel AI-inzet, rol, toepasselijke artikelen, risicoklasse, bewijs en voorbereiding.","Geen automatische juridische classificatie, registratie in de EU-databank of conformiteitsverklaring."],"aiLiteracy":["AI-geletterdheid en scholing","AI-functionaris / schoolleiding / P&O","AI en onderwijs","Maak zichtbaar welke maatregelen en scholingsacties zijn vastgelegd en welke onderbouwing ontbreekt.","Geen bewijs van deelname of een bereikt bekwaamheidsniveau zonder aanvullende gegevens."],"aiGovernance":["AI-beleid en uitvoering","AI-functionaris","AI en onderwijs","Bekijk schoolinstellingen, menselijk toezicht en acties voor verantwoord gebruik.","Een leveranciersmogelijkheid is niet automatisch lokaal actief of toegestaan."],"ai":["AI in het onderwijs en de school","Onderwijs / AI-functionaris","AI en onderwijs","Bekijk AI-functies per lesfase, docentrol, leerlinghandeling en schoolorganisatie.","Een beschreven functie of didactisch doel bewijst geen leerwinst."],"privacy":["Privacy en toezicht (FG)","Functionaris gegevensbescherming (FG)","Privacy en gegevensbescherming","Bronnen, DPIA-onderwerpen, gegevensstromen, bewijs en vragen voor onafhankelijk toezicht.","Geen FG-advies of goedkeuring; het bevoegd gezag beslist."],"processing":["Verwerkingen en DPIA-voorbereiding","Verwerkingsverantwoordelijke / FG","Privacy en gegevensbescherming","Inventariseer bekende gegevens, gebruiksdoelen, gebruikers, verwerkers en ontbrekende informatie.","Applicatieregistraties zijn geen verwerkingsactiviteitenregister conform art. 30 AVG; dit rapport is geen uitgevoerde DPIA."],"ict":["ICT-beheer en inrichting","ICT / functioneel beheer","ICT-beheer","Toegang, hardware, licenties, instellingen en technische vervolgacties.","Registraties en actuele configuratie of feitelijk gebruik zijn niet hetzelfde."],"koppelingen":["Entra en toegang","ICT / functioneel beheer","ICT-beheer","Geregistreerde Entra-objecten, mogelijke koppelingen en toegangsstatus.","Een geregistreerde koppeling bewijst geen actief gegevensverkeer."],"devices":["Apparaten en beheer","ICT / facilitair","ICT-beheer","Meetwaarden, apparaatgroepen en bronpeildata.","Entra-records zijn geen schoolbrede telling van fysieke apparaten."],"schoolbreed":["Applicaties en diensten","ICT / schoolleiding","Inventaris en opvolging","Toepassingen, onderdelen, softwarevermeldingen en licentiecontroles.","Mogelijke dubbele vermeldingen en ontbrekende gebruiksbevestiging blijven zichtbaar."],"controles":["Controles en vervolgacties","ICT / schoolleiding","Inventaris en opvolging","Openstaande controles, signalen, werkacties en gegevenscontrole.","Een automatisch signaal is geen vastgestelde overtreding."],"all":["Volledige ICT-inventarisatie","Schoolleiding en betrokken functionarissen","Inventaris en opvolging","Volledige rapportage van beschikbare registerinformatie en toetsingsverwijzingen.","Geen juridische goedkeuring of volledige audit."]});
 const titles=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([id,d])=>[id,d.slice(0,2)])));
 const catalog=Object.freeze(Object.entries(definitions).map(([id,[title,audience,group,purpose,limit]])=>Object.freeze({id,title,audience,group,purpose,limit})));
 const legalReviewDate='24 november 2026';

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
  const r=t=>sort(index.records(t).filter(x=>!index.get(t,x.id)?.derived)), a=r('apps'), p=r('parts'), c=r('connections'), d=r('devices'), h=r('hardwareGroups'), ai=r('ai'), ctl=r('checks'), dp=r('dpia'), ac=r('aiControls'), wa=r('workActions'), sw=r('softwareReview'), lic=r('licenseReview'), cand=r('additionalCandidates');
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
  const workFields=[['Vervolgactie','action'],['Betrokken rollen','involvedRoles'],['Status','status'],['Actiehouder','owner'],['Termijn','dueDate'],['Uitvoeringsbewijs','completionEvidence']];
  const checkFields=[['Categorie / prioriteit',x=>[x.category,x.priority].filter(Boolean).join(' · ')],['Wat controleren','explanation'],['Status','status']];
  const appSection=()=>section('Applicaties en onderdelen','De telling betreft applicatieregistraties. Onderdelen tellen niet als extra applicaties. Een registratie bewijst geen gebruik.',[
   chart('Toepassingen naar gebruiksgebied',counts(a,'area')),chart('Toepassingen naar soort',counts(a,'kind')),
   cards('apps',a,appFields),list('parts',p,[['Bovenliggende toepassing','parent'],['Beschrijving','description'],['Lokale status','local']])]);
  const connectionSection=()=>section('Identiteit en toegang','Entra-registraties zijn geen bewijs van actieve gegevensuitwisseling of toegang van een specifieke gebruiker.',[
   chart('Status volgens Entra-registratie',counts(c,'enabled')),list('connections',c,[['Ingeschakeld','enabled'],['Zichtbaarheid','visible'],['Mogelijke applicatie','matched']])]);
  const deviceSection=()=>section('Apparaten en hardware','Meetwaarden kunnen elkaar overlappen. Entra-records zijn geen telling van unieke fysieke apparaten.',[
   cards('devices',d,[['Meetwaarde','quantity'],['Type','type'],['Peildatum','measurementDate'],['Beschrijving','description'],['Beperking','limitation']]),
   cards('hardwareGroups',h,[['Aantal / meetwaarde',x=>x.quantity??x.count],['Categorie',x=>x.category??x.type],['Beheer',x=>x.manager??x.management??x.managedBy],['Eigenaar','owner'],['Beschrijving','description'],['Lokale status',x=>x.local??x.status],['Beperking','limitation']])]);
  const licenseSection=()=>section('Licenties en softwarecontrole','Een aangeboden functie of licentie bewijst geen lokale toewijzing. Geen bedragen of boekingsgegevens.',[
   cards('licenseReview',lic,[['Wat bekend is',x=>x.known??x.description],['Licentie',x=>x.license2026??x.license??x.plan],['Lokale AI-status','localAI'],['Te controleren',x=>x.action??x.check],['Status',x=>x.status??x.local]]),
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
   chart('Automatische signalen per onderwerp',counts(options.signals||[],'category')),table(['Signaal','Categorie','Toelichting'],(options.signals||[]).map(x=>[value(x.id)+' · '+value(x.name),value(x.category),value(x.explanation)]))]);
  const sourceReviewSection=()=>section('Beoordeling van bronnen','De bronregistratie vermeldt wat over herkomst, gebruiksrecht en goedkeuring is vastgelegd. Een leeg veld betekent dat dit niet is aangetoond in de registratie.',[
   chart('Vastgelegde goedkeuringsstatus',counts(r('sourceRegister'),'approvalStatus')),
   {kind:'cards',items:r('sourceRegister').map(x=>({id:x.id,name:cleanSource(x.name),fields:[
    ['Bronhouder',value(x.owner)],['Versie / inhoudsvingerafdruk',value(x.version||x.contentSha256)],['Gebruiksrecht',value(x.rightsStatus)],['Grondslag voor gebruik',value(x.rightsBasis)],['Toegestaan gebruik',value(x.allowedUse)],['Toepassingsgebied',value(x.scope)],['Bewaarafspraak',value(x.retention)],['Goedkeuringsstatus',value(x.approvalStatus)],['Goedgekeurd door',value(x.approvedBy)],['Goedkeuringsdatum',value(x.approvedAt)],['Bewijs van goedkeuring',value(x.approvalEvidence)],['Opnieuw beoordelen op',value(x.nextReviewAt)]
   ]}))}]);
  const workSection=()=>section('Werkregister','Status en betrokken rollen komen rechtstreeks uit de registratie; ontbrekende actiehouders of termijnen worden niet ingevuld.',[cards('workActions',wa,workFields)]);
  // A reference is recorded evidence, never a computed legal finding.
  const refs=[...index.nodes.values()].filter(n=>!n.derived).flatMap(n=>(n.record.frameworkLinks||[]).map(link=>({type:n.type,record:n.record,link})));
  const refFor=(id)=>refs.filter(x=>x.link.frameworkId===id);
  const article=(link,n)=>new RegExp('^art\\.?\\s*'+n+'(?:\\b|$)','i').test(str(link.article).trim());
  const refItems=items=>({kind:'cards',items:items.map(({type,record:x,link:l})=>({id:x.id,name:x.name||x.id,fields:[
    field('Kader / artikel',str(l.frameworkId)+' '+str(l.article)),field('Vastgelegde beoordeling',l.status),field('Rol volgens registratie',l.role),
    field('Toelichting',l.note),field('Bewijsverwijzing',l.evidence),field('Vervolgactie',l.followUp),field('Actiehouder',l.followUpOwner),field('Status vervolgactie',l.followUpStatus),
    field('Uitvoeringsbewijs',l.completionEvidence),field('Bron',src(type,x))
  ]}))});
  const frameworkSection=(filter,title)=>section(title,'Vastgelegde norm- en artikelverwijzingen. Geen automatische vaststelling van toepasselijkheid of naleving.',[refItems(refs.filter(x=>filter(x.link)))]);
  const aiRefs=refFor('AIACT'),ibpRefs=refFor('IBP'),avgRefs=refs.filter(x=>['AVG','UAVG'].includes(x.link.frameworkId));
  const literacyRefs=aiRefs.filter(x=>article(x.link,4));
  const aiLegalFields=[
    ['Product','product'],['Beschreven inzet','action'],['Gebruikers','users'],['Lokale status','local'],['AI Act-indicatie','aiAct'],['Toelichting bij de indicatie','aiActExplanation'],
    ['Rol en menselijk toezicht','teacher'],['Rol leerling','student'],['Beoordelaar','reviewer'],['Instellingen','input'],['Onbekende informatie','unknown'],
    ['Directe artikelverwijzingen',x=>(x.frameworkLinks||[]).filter(l=>l.frameworkId==='AIACT').map(l=>str(l.article)+' ('+value(l.status)+')').join('; ')],
    ['Artikelverwijzingen bovenliggende toepassing',x=>{const p=index.get('apps',x.parentId)?.record;return p?(p.frameworkLinks||[]).filter(l=>l.frameworkId==='AIACT').map(l=>str(l.article)+' ('+value(l.status)+')').join('; '):'';}]
  ];
  const aiLegalSection=()=>section('AI Act: onderwerpen, toepasselijkheid en bewijs','Stand wetgeving gecontroleerd op '+legalReviewDate+'. Verordening (EU) 2024/1689 zoals gewijzigd bij (EU) 2026/1744. Deze vragen zijn een werkagenda, niet per definitie verplichtingen voor ieder systeem.',[
    table(['Onderwerp','Wat de school moet nagaan','Geregistreerde verwijzingen'],[
      ['Art. 4 · AI-geletterdheid','Maatregelen ter ondersteuning van AI-geletterdheid van personeel en anderen die namens de organisatie AI gebruiken; passend bij kennis, ervaring en context. Geen verplichting een vast niveau te garanderen.',literacyRefs.length],
      ['Art. 5 · Verboden praktijken','Controleer de concrete inzet, waaronder verboden emotie-inferentie in onderwijs (behoudens medische of veiligheidsredenen). De nieuwe verbodsbepalingen van art. 5 lid 1 b bis/b ter en bijbehorende leden gelden vanaf 2 december 2026.',aiRefs.filter(x=>article(x.link,5)).length],
      ['Art. 6 en bijlage III, punt 3 · Risicoklasse','Beoordeel beoogd doel en gebruik: toegang/toelating, beoordeling van leerresultaten, passend onderwijsniveau en toezicht op verboden gedrag bij toetsen. Onderzoek uitzonderingen van art. 6 lid 3. Geen classificatie uit de naam van een functie.',aiRefs.filter(x=>article(x.link,6)||/bijlage\s+iii/i.test(str(x.link.article))).length],
      ['Art. 26 · Gebruiksverantwoordelijke','Bij toepasselijke hoogrisicosystemen: onder meer instructies, menselijk toezicht, monitoring, relevante invoergegevens en logbewaring voor zover onder eigen controle. Voorbereiden op 2 december 2027 voor bijlage III.',aiRefs.filter(x=>article(x.link,26)).length],
      ['Art. 27 en 49 · Effectbeoordeling en registratie','Bepaal of de organisatie en het systeem onder de specifieke voorwaarden voor grondrechteneffectbeoordeling en EU-registratie vallen. Geen algemene plicht voor elk AI-systeem. Hoogrisicoregels voor bijlage III vanaf 2 december 2027.',aiRefs.filter(x=>article(x.link,27)||article(x.link,49)).length],
      ['Art. 50 · Transparantie','Controleer verplichtingen per systeem en rol, bijvoorbeeld AI-interactie, synthetische inhoud en deepfakes. Voor aanbieders van bepaalde vóór 2 augustus 2026 aangeboden systemen geldt voor art. 50 lid 2 een overgang tot 2 december 2026.',aiRefs.filter(x=>article(x.link,50)).length]
    ]),
    note('Datums volgen art. 113 van de gewijzigde verordening. Hoogrisicosystemen onder art. 6 lid 1 en bijlage I: relevante regels vanaf 2 augustus 2028. Controleer uitzonderingen, overgangsrecht en latere wijzigingen vóór een besluit.'),
    note('Een ontbrekende artikelverwijzing betekent: geen verwijzing gevonden in deze registratie. Niet: niet van toepassing, toegestaan of in overtreding.')
  ]);
  const literacySection=()=>section('AI-geletterdheid: maatregelen en bewijs','Artikel 4 vraagt maatregelen ter ondersteuning van de ontwikkeling van AI-geletterdheid. Dit rapport toont de geregistreerde maatregelen en opvolging; het stelt geen bekwaamheidsniveau vast.',[
    refItems(literacyRefs),
    note(literacyRefs.length?'Raadpleeg de vastgelegde acties voor uitvoering en bewijs.':'Geen expliciete art. 4-verwijzingen in de ingelezen gegevens.'),
    table(['Te onderbouwen','Waarvoor nodig'],[
      ['Doelgroepen en rol','Kennis, ervaring en inzetcontext van OP, OOP en andere personen die namens de school AI gebruiken.'],
      ['Maatregelen','Welke instructie, scholing of ondersteuning wordt aangeboden en op welke AI-toepassingen die betrekking heeft.'],
      ['Uitvoering en opvolging','Aangeboden en uitgevoerde activiteiten, deelname/voortgang indien geregistreerd, evaluatie en bijstelling.'],
      ['Menselijk toezicht','Wie een AI-uitkomst controleert en welke kennis en bevoegdheid daarvoor nodig is.']
    ]),
    note('Deze registratie bevat geen afzonderlijk deelnemers- of scholingsresultatenregister. Aantallen deelnemers, deelnamegraad en bekwaamheid worden niet uit actieomschrijvingen afgeleid.')
  ]);
  const processingSection=()=>section('Voorbereiding verwerkingsregister en DPIA','De AVG vereist onder voorwaarden een register van verwerkingsactiviteiten en bij waarschijnlijk hoog risico vooraf een DPIA. Een applicatie is geen verwerkingsactiviteit. Onderstaande informatie is een startpunt per geregistreerde toepassing.',[
    table(['AVG-bepaling','Benodigde informatie en toetsvraag'],[
      ['Art. 5, 6 en 9','Per verwerking: doel, noodzakelijkheid, grondslag en eventueel uitzondering voor bijzondere persoonsgegevens.'],
      ['Art. 13 en 14','Welke informatie krijgen betrokkenen?'],
      ['Art. 28','Rol leverancier en toepasselijke verwerkersafspraken.'],
      ['Art. 30','Contactgegevens verantwoordelijke en FG, verwerkingsdoelen, categorieën betrokkenen en persoonsgegevens, ontvangers, eventuele internationale doorgiften, waar mogelijk bewaartermijnen en beveiligingsmaatregelen.'],
      ['Art. 32','Beveiligingsmaatregelen afgestemd op het risico.'],
      ['Art. 35 en 36','DPIA bij waarschijnlijk hoog risico, waar nodig advies FG en voorafgaande raadpleging bij resterend hoog risico.']
    ]),
    note('De scan heeft geen afzonderlijk register op verwerkingsactiviteitsniveau. Doelen, grondslagen, ontvangers, doorgiften, termijnen en maatregelen moeten daar worden vastgesteld; een ontbrekend veld is geen bewezen overtreding.'),
    cards('apps',a,[['Beschrijving','description'],['Proces volgens registratie','process'],['Gebruikers volgens registratie','users'],['Gegevens volgens registratie','data'],['Eigenaar','owner'],['Lokale status','local'],['Koppelingen','links'],['Verwerkersovereenkomst','processorAgreement'],['DPIA-status volgens registratie','dpiaStatus'],['Vervolgactie','reviewAction']])
  ]);
  const compactFollowUp=()=>section('Bespreekpunten en opvolging','Niet-afgesloten werkacties en controlepunten uit de registratie. De betrokken rollen zijn geen automatisch toegewezen verantwoordelijken.',[
    table(['Werkactie','Vervolgactie','Betrokken rollen','Status'],openWork.map(x=>[value(x.id)+' · '+value(x.name),value(x.action),value(x.involvedRoles),value(x.status)])),
    ...openWork.length?[note('Bronnen van werkacties: '+openWork.map(x=>x.id+' — '+src('workActions',x)).join('; '))]:[],
    list('checks',pending,[['Categorie','category'],['Wat controleren','explanation'],['Status','status']])
  ]);
  const ibpSection=()=>section('IBP: geregistreerde normverwijzingen','Het Normenkader IBP is een sectoraal toetsingskader. Dit rapport toont alleen de normverwijzingen en informatie die in deze inventaris aanwezig zijn; andere normdocumentatie of een formele beoordeling kan buiten de scan worden bewaard.',[
    refItems(ibpRefs),
    note('Geen volledige normmeting of volwassenheidsbeoordeling. De aanwezigheid van een product, Entra-registratie of technisch controlepunt bewijst niet dat een IBP-maatregel effectief is.')
  ]);
  const assuranceSection=()=>{const result=options.assurance, labels={pass:'Geslaagd',attention:'Aandacht',fail:'Afgekeurd',not_run:'Niet uitgevoerd'};
   section('Automatische gegevenscontroles','De uitslag betreft de registraties en is geen systeem- of organisatiegoedkeuring.',result?[note('Controledatum: '+value(result.context?.asOf)+' · Gegevensversie: '+value(result.context?.sourceFingerprint)+' · Regelversie: '+value(result.rulesetVersion)),table(['Controle','Uitslag','Bevindingen'],(result.checks||[]).map(x=>[value(x.id)+' · '+value(x.title),value(labels[x.status]||x.status),[...((x.findings||[]).reduce((m,f)=>{m.set(f.message,(m.get(f.message)||0)+1);return m;},new Map()))].map(([message,n])=>n+' × '+message).join('\n')||'Geen bevindingen vermeld']))]:[note('Geen actuele controleuitslag beschikbaar. Voer de gegevenscontrole uit om een uitslag te kunnen opnemen.')]);};
  let kpis=[],summary='';
  const k=(label,n)=>[label,n];
  switch(scope){
   case 'bestuur':
    kpis=[k('Applicatieregistraties',a.length),k('Beschreven AI-functies',ai.length),k('Niet afgesloten werkacties',openWork.length),k('Niet afgesloten controles',pending.length)];
    summary='Bestuurlijk overzicht voor besluitvorming over ICT, AI en privacy. De rapportage maakt geregistreerde opvolging zichtbaar; besluiten en bewijs van uitvoering blijven afzonderlijk vast te leggen.';
    section('Stand van zaken','De aantallen hebben verschillende eenheden en worden niet opgeteld.',[
      table(['Onderwerp','Beschikbare registratie','Wat nog vast te stellen'],[
        ['Software',a.length+' applicatieregistraties en '+cand.length+' overige vermeldingen (mogelijke overlap)','Feitelijk gebruik en unieke systemen'],
        ['AI',ai.length+' beschreven functies; '+ai.filter(x=>unknown(x.local)).length+' met onbekende lokale status','Toegestaan en actief gebruik, classificatie en toezicht'],
        ['Privacy',dp.length+' DPIA-brononderwerpen','Lokale DPIA, verwerkingen en besluiten waar van toepassing'],
        ['IBP',ibpRefs.length+' IBP-normverwijzingen','Volledige normmeting en bewijs van maatregelen'],
        ['Toegang',c.length+' Entra-registraties','Actuele toegang en technische werking'],
        ['Hardware',h.length+' hardwaregroepen','Unieke fysieke apparaten en actuele meetstand']
      ]),
      chart('Werkacties naar status',counts(wa,'status')),chart('Controles naar status',counts(ctl,'status'))
    ]);compactFollowUp();assuranceSection();break;
   case 'ibp':
    kpis=[k('Vastgelegde IBP-verwijzingen',ibpRefs.length),k('Niet afgesloten werkacties (schoolbreed)',openWork.length),k('Niet afgesloten controles (schoolbreed)',pending.length)];
    summary='Stand van geregistreerde IBP-normverwijzingen, informatie over ICT-beheer en vervolgacties. Dit is geen volledige normmeting; controleer per norm de actuele versie en het onderliggende bewijs.';
    ibpSection();connectionSection();deviceSection();compactFollowUp();assuranceSection();break;
   case 'aiAct':
    kpis=[k('Beschreven AI-functies',ai.length),k('Onbekende lokale status',ai.filter(x=>unknown(x.local)).length),k('Vastgelegde AI Act-verwijzingen',aiRefs.length),k('AI Act-verwijzingen met niet afgesloten vervolgactie',aiRefs.filter(x=>!closed(x.link.followUpStatus)&&x.link.followUpStatus!=='Niet van toepassing').length)];
    summary='Overzicht voor beoordeling van concrete AI-inzet, toepasselijke verplichtingen, vastgelegde artikelverwijzingen en bewijs. Geen juridische risicoclassificatie of conformiteitsverklaring.';
    aiLegalSection();frameworkSection(l=>l.frameworkId==='AIACT','Vastgelegde AI Act-verwijzingen en opvolging');
    section('Inventarisatie voor beoordeling per AI-functie','De geregistreerde indicatie en lokale status zijn brongegevens. Beoordeel de rol, het beoogde doel en feitelijk gebruik per systeem; een verwijzing op de bovenliggende toepassing is geen beoordeling van de functie.',[
      chart('Lokale status volgens de registratie',counts(ai,'local')),chart('Indicatie volgens registratie',counts(ai,'aiAct')),cards('ai',ai,aiLegalFields)
    ]);literacySection();assuranceSection();break;
   case 'aiLiteracy':
    kpis=[k('Vastgelegde art. 4-verwijzingen',literacyRefs.length),k('Verwijzingen met vervolgactie niet afgesloten',literacyRefs.filter(x=>!closed(x.link.followUpStatus)&&x.link.followUpStatus!=='Niet van toepassing').length)];
    summary='Maatregelen en geregistreerde opvolging voor AI-geletterdheid. Niet verwarren met een deelnameoverzicht of toets van bekwaamheid.';
    literacySection();break;
   case 'processing':
    kpis=[k('Applicatieregistraties',a.length),k('Gegevensveld onbekend',a.filter(x=>unknown(x.data)).length),k('DPIA-brononderwerpen',dp.length),k('AVG/UAVG-verwijzingen',avgRefs.length)];
    summary='Voorbereidende informatie voor het verwerkingsregister, privacytoetsen en eventuele DPIA’s. De scan is geen register op verwerkingsactiviteitsniveau en vervangt geen beoordeling per verwerking.';
    processingSection();privacySection();frameworkSection(l=>['AVG','UAVG'].includes(l.frameworkId),'Vastgelegde AVG- en UAVG-verwijzingen');break;
   case 'ict':
    kpis=[k('Applicaties',a.length),k('Entra-registraties',c.length),k('Hardwaregroepen',h.length),k('Licentiecontroles',lic.length),k('Niet afgesloten controles',pending.length),k('Niet afgesloten werkacties',openWork.length)];
    summary='Voor technisch beheer: applicaties, identiteit, toegang, apparaten, licenties en opvolging. Controleer vooral of geregistreerde mogelijkheden daadwerkelijk zijn ingericht en wie verantwoordelijk is.';
    connectionSection();deviceSection();licenseSection();appSection();findingsSection();workSection();assuranceSection();break;
   case 'privacy':
    kpis=[k('DPIA-brononderwerpen',dp.length),k('Applicatieregistraties',a.length),k('Gegevensveld onbekend',a.filter(x=>unknown(x.data)).length),k('Niet afgesloten controles (schoolbreed)',pending.length)];
    summary='Voor onafhankelijk advies en toezicht: beschikbare externe privacybeoordelingen, lokaal bewijs, gegevensstromen en vragen aan het bevoegd gezag. Dit is geen FG-advies, verwerkingsregister of uitgevoerde DPIA.';
    privacySection();sourceReviewSection();
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
   default:kpis=[k('Applicaties',a.length),k('Entra-registraties',c.length),k('AI-functies',ai.length),k('Niet afgesloten controles',pending.length)];summary='Schoolbreed beeld van toepassingen, toegang, hardware, AI, privacy en openstaande controles. Registraties en feitelijk gebruik zijn niet hetzelfde.';appSection();connectionSection();deviceSection();licenseSection();aiSection();aiControlSection();privacySection();sourceReviewSection();findingsSection();frameworkSection(()=>true,'Toetsingskaders en geregistreerde vervolgacties');assuranceSection();
  }
  const sourceRecords=r('sourceRegister').filter(x=>usedSources.has(x.id));
  section('Bronnen en afbakening','Bron-ID’s verwijzen naar het bestaande bronregister. Een gekoppelde bronverwijzing bewijst niet dat de bron is beoordeeld. Niet gekoppelde verwijzingen blijven bij het betreffende record staan.',[
   note('Gegevensbasis: '+value(options.sourceLabel)+' · Indexversie: '+value(index.version)+' · '+referencedRecords.size+' opgenomen record-ID’s.'),
   table(['Bron-ID','Bron'],sourceRecords.map(x=>[value(x.id),cleanSource(x.name)])),
   table(['Toetsingsbron','Link'],(options.legalSources||[]).map(x=>[x.name,x.url])),
   note('Geen financiële bedragen of boekingsregels opgenomen. Raadpleeg het actuele bronregister en de geldende wet- en regelgeving vóór een formeel besluit.')]);
  return {scope,title,audience,summary,limit:definitions[scope][4],legalReviewDate, kpis,sections,date:options.date||new Date().toLocaleDateString('nl-NL'),sourceLabel:value(options.sourceLabel)};
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
  return '<div class="report-document"><header class="report-cover"><div class="report-brand"><div class="report-logo-wrap"><img class="print-logo" src="./emmaus-logo.svg" alt="Emmauscollege Rotterdam"><strong>Emmauscollege Rotterdam</strong></div><span>ICT-SCAN / RAPPORTAGE</span></div><div class="report-cover-title"><div class="report-eyebrow">'+e(model.audience)+'</div><h1>'+e(model.title)+'</h1><p>Emmauscollege · '+e(model.date)+'</p></div><h2>In één oogopslag</h2><p class="report-summary">'+e(model.summary)+'</p><p class="report-note">'+e(model.limit)+'</p><div class="report-kpis">'+model.kpis.map(([l,n])=>'<div><strong>'+e(n)+'</strong><span>'+e(l)+'</span></div>').join('')+'</div><p class="report-note">Gegevensbasis: '+e(model.sourceLabel)+'. De exportdatum is niet de peildatum van alle brongegevens.</p><h2>Inhoud</h2><ol class="report-toc">'+model.sections.map(s=>'<li>'+e(s.title)+'</li>').join('')+'</ol></header>'+model.sections.map((s,i)=>'<section class="report-chapter"><div class="report-chapter-label">ICT-SCAN / '+String(i+1).padStart(2,'0')+'</div><h2>'+e(s.title)+'</h2><p class="report-intro-text">'+e(s.lead)+'</p>'+s.blocks.map(block).join('')+'</section>').join('')+'</div>';
 }
 root.IctPrintReports=Object.freeze({titles,catalog,build,render});
 if(typeof module==='object'&&module.exports)module.exports=root.IctPrintReports;
})(globalThis);
