# Controlecode voor ICT-registers

Deze map bevat deterministische controles en organisatieprofielen. Emmauscollege is de eerste toepassing. De controlefunctie gebruikt gewone JavaScript-regels. Een model bepaalt geen uitkomsten, drempels of lampkleuren tijdens een run.

De browser, een commandoregelprogramma en CI kunnen dezelfde controlefunctie aanroepen. Invoer, regels, peildatum en eerdere versie bepalen het resultaat. De browser regelt de bediening; een adapter leest bestanden of GitHub. De controlefunctie doet zelf geen netwerkverzoeken en slaat niets op.

## Bestanden en verantwoordelijkheid

| Onderdeel | Verantwoordelijkheid |
| --- | --- |
| `engine.js` | Controles uitvoeren op aangeleverde records, context, beleid en eventueel een eerdere versie. |
| `profile.js` | Organisatieprofielen valideren en een identiteit voor het toepassingsbereik vormen. |
| `profiles/emmauscollege.json` | Organisatie, GitHub-bron en registermapping voor de bestaande inventaris. |
| `profiles/example-organisation.json` | Fictieve configuratie om hergebruik te toetsen. Dit bestand bevat geen inventaris. |
| `adapter.js` | De dertien inventarisregisters en het bronregister omzetten voor browser en CLI; de gebruikte catalogus en registermapping meegeven. |
| `source-register.js` | Bronmetadata controleren, exacte verwijzingen oplossen en bronbevestigingen maken en vergelijken. |
| `worker.js` | De engine in een lokale browserworker uitvoeren en invoer/policy/regels/corpus van een SHA-256 voorzien. |
| `record-contract.js` | Dezelfde beoordelingsvelden controleren vóór lokaal opslaan en vóór een GitHub-voorstel. |
| `evaluation-corpus.json` | Vaste, synthetische testgevallen met vooraf vastgelegde verwachtingen. |

Gebruik de generieke API `AssuranceProfile` voor profielen. De bestaande naam `EmmausCardGitLogic` is een oudere browserinterface. Zo'n naam maakt de controlecode niet automatisch organisatiespecifiek, maar moet ook niet als bewijs van volledige overdraagbaarheid worden gebruikt.

## Organisatieprofiel

Een profiel heeft de schemaversie `eai-ict-assurance-profile-v1` en zes onderdelen:

| Veld | Betekenis |
| --- | --- |
| `profileVersion` | Versie van de profielconfiguratie. |
| `organisation` | Stabiel ID, zichtbare naam en taalinstelling. |
| `source` | Repository, branch of tag, bronmap, toepassingsbereik en mapping van registers naar JSON-bestanden. |
| `policy` | ID, versie, beoordelingstermijn, herkomst van die termijn en uitleg. |
| `synthetic` | Geeft aan of het om een fictief voorbeeld gaat. |
| `schema` | Identificeert dit uitwisselingscontract. |

`sourceDir` is een relatief pad zonder afsluitende slash. `registerFiles` bevat de dertien inventarisregisters en kan de veertiende mapping `sourceRegister` bevatten. Beide geleverde profielen bevatten die mapping; oudere profielen met dertien blijven leesbaar. Meerdere registers mogen hetzelfde bestand gebruiken. Het fictieve profiel gebruikt `inventory.json` en een apart `source-register.json`. De validator weigert onbekende profielvelden.

```js
const profile = AssuranceProfile.validate(parsedJson);
const scopeId = AssuranceProfile.scopeKey(profile);
```

`validate` geeft een onafhankelijke, diep bevroren kopie terug. Ongeldige invoer geeft een fout; er volgt geen stille terugval naar Emmauscollege. `scopeKey` combineert organisatie, repository, branch of tag, bronmap en toepassingsbereik. Een eerdere versie van een andere bron mag daardoor niet als nulmeting voor de huidige bron dienen.

Een profiel verleent geen toegangsrechten. De aanroepende code controleert ook of de werkelijk ingelezen bron bij het actieve profiel hoort. Alleen een gelijke organisatienaam volstaat daarvoor niet.

Voor een GitHub-wijzigingsvoorstel geeft `source.configurationFiles` vier
repositorypaden op: `profile`, `catalog`, `engine` en `sourceRegister`.
Deze verwijzen naar het gebruikte organisatieprofiel, de kadercatalogus,
de controlecode en de bronmodule in `source.repository`. De writer leest die
bestanden op dezelfde vaste `baseSha` als de inventarisbestanden, vóór een
branch, bestand of pull request te maken. De website-URL of bronmap bepaalt
deze paden niet.

Het volledige gevalideerde profiel en de volledige catalogus moeten canoniek
gelijk zijn aan de geladen configuratie. De opgegeven moduleversies moeten
ook overeenkomen. Remote JavaScript wordt daarbij niet uitgevoerd. De writer
neemt geen repository, paden of beleidswaarden uit het opgehaalde profiel over.
Een afwijking vraagt om opnieuw laden en beoordelen.

De mapping is optioneel voor bestaande leesprofielen. Publiceren zonder deze
mapping wordt geweigerd. Een afzonderlijke inventarisrepository moet de vier
expliciet aangewezen configuratiebestanden bevatten om de schrijfactie te
ondersteunen. Deze controle bewijst configuratiegelijkheid en gelijke opgegeven
moduleversies op de basiscommit; zij bewijst geen gelijke uitvoerbare bytes of
de herkomst van de website. CI controleert de voorgestelde commit afzonderlijk.

Lokale momentopnames gebruiken dezelfde profielscope. De browser herstelt alleen een momentopname met de passende organisatie en bron. Wissen geldt ook alleen voor die scope. Dit voorkomt onbedoelde vermenging; het is geen toegangsbeveiliging tussen gebruikers van dezelfde browser of website-origin.

Een oudere momentopname zonder profielbinding wordt niet automatisch geladen. Zij blijft bereikbaar via **Rapporten → Rapport ophalen → Deze inventaris bewaren → Eerdere lokale kopie → Oude lokale kopie downloaden**. Deze actie downloadt de volledige oorspronkelijke momentopname als archiefbestand en wijst de inhoud niet aan het actieve profiel toe. Dit archief is geen reguliere JSON-export voor automatische herimport.

### Beoordelingstermijn

Beide geleverde profielen gebruiken 365 dagen met `basis: "project-default"`. Dit is een instelbare termijn voor signalering, geen wettelijke termijn of vastgesteld besluit van een organisatie. Een expliciete datum voor de volgende beoordeling blijft een afzonderlijke invoer voor de controle.

Leg een andere termijn met een nieuwe policyversie vast. Gebruik `organisation-policy` uitsluitend met een beschrijving van het echte besluit. Een gewijzigde drempel mag niet ongemerkt de betekenis van een oude meting veranderen.

## Invoer voor de controlefunctie

De adapter zet bronrecords om naar `{type, id, data}`. Hij maakt een onafhankelijke kopie van de recordinhoud in `data`. Voor oude importen wordt een bekende, gemapte JSON-bestandsnaam in `sources` uit de controlekopie verwijderd. De huidige native JSON-import voegt zo'n bestandsnaam niet meer toe aan de bronverwijzingen. Browser en CLI vergelijken dezelfde oorspronkelijke gegevens.

Een native `eai-school-ict-v1`-document vervangt ieder aangeleverd record met dezelfde ID exact. De import valideert de lijsten en dubbele IDs vóór wijziging van de staat. Onbekende velden, expliciet leeggemaakte waarden en ingetrokken beoordelingen blijven behouden. De laadgeschiedenis staat apart van de inhoud van de records. Oudere spreadsheetimporten behouden hun eigen samenvoegregels.

```js
const result = AssuranceEngine.evaluate({
  records,
  context: {
    asOf: '2026-11-21',
    organisationId: profile.organisation.id,
    scopeId: AssuranceProfile.scopeKey(profile),
    sourceVersion: inspectedSourceVersion
  },
  policy: AssuranceAdapter.policyFor(profile, frameworkCatalog),
  reviewRules: {
    catalog: frameworkCatalog,
    registerFiles: profile.source.registerFiles
  },
  baseline,
  evaluation
});
```

`inspectedSourceVersion` moet de werkelijk onderzochte bronversie beschrijven. Gebruik bij GitHub de opgehaalde revisie of de expliciete bestandsidentiteiten. Een branchnaam alleen legt geen onveranderlijke inhoud vast. `baseline` en `evaluation` zijn optioneel. Het ontbreken ervan levert geen geslaagde driftcontrole of evaluatie op.

De gedeelde adapter selecteert de beleidsvelden die de controlefunctie ondersteunt. Geef `profile.policy` niet rechtstreeks door: dat object bevat ook de toelichting en de herkomst van de termijn. `frameworkCatalog` is het daadwerkelijk geladen register met toetsingskaders en relatietypen. `AssuranceAdapter.fromState` en `fromDocuments` gebruiken dezelfde selectie voor browser en commandoregel.

De aanroeper geeft de peildatum mee. De controlefunctie leest niet zelf de klok. Hierdoor kunnen dezelfde invoer en dezelfde datum opnieuw worden beoordeeld.

## Bronregister

`source-register.js` biedt de browser-API `AssuranceSourceRegister` en dezelfde
API via CommonJS. Laad de module vóór `engine.js`, ook in een worker. De module
doet geen netwerkverzoeken en gebruikt geen taalmodel.

Een bron bevat een stabiele `id`, naam, `referenceKeys`, bronhouder, versie,
rechtenstatus, rechtsgrond voor gebruik, toegestaan gebruik, toepassingsbereik,
bewaartermijn en beoordelingsgegevens. `contentSha256` kan de inhoud nader
vastleggen. Het invullen van een hash of versie haalt de bron niet op en
controleert niet zelfstandig of die waarde juist is.

Een registratie verwijst met `sourceIds` naar bron-IDs, of met bestaande
`sources` of `sourceRefs` naar exact gelijke `referenceKeys`. De resolver gebruikt geen
hoofdlettercorrectie, samenvatting of semantische overeenkomst. Een dubbele
alias of meerdere overeenkomsten wordt niet opgelost met de eerste match.

De eerste bronregistratie bevat 51 voorstellen voor 468 bestaande verwijzingen.
Alle voorstellen hebben rechtenstatus `Onbekend` en goedkeuringsstatus
`Nog te beoordelen`. De bronhouder, versie, gebruiksgrenzen en werkelijke
goedkeuring moeten nog worden vastgesteld. De 450 oorspronkelijke
inventarisrecords zijn niet herschreven.

```js
const options = {
  asOf: '2026-11-21',
  organisationId: profile.organisation.id,
  scopeId: AssuranceProfile.scopeKey(profile)
};
const findings = AssuranceSourceRegister.validate(source, options);
const resolved = AssuranceSourceRegister.resolve(records, record, options);

// Alleen na een expliciete menselijke bevestiging van deze brongegevens.
source.approvalBinding = AssuranceSourceRegister.createApprovalBinding(source, options);
const sourceState = AssuranceSourceRegister.inspectApprovalBinding(source, options);
```

`createApprovalBinding` vereist complete gegevens met de status `Goedgekeurd`.
De vergelijking legt organisatie, bereik en de exacte broninhoud vast. Alleen
de bovenste velden `approvalBinding`, `auditTrail` en `frameworkLinks` blijven
erbuiten. `Niet toegestaan` en `Afgewezen` zijn rode inhoudelijke uitkomsten;
het dashboard moet zulke besluiten wel kunnen bewaren. `Beperkt` blijft een
aandachtspunt, ook na een geldige bevestiging.
`inspectApprovalBinding` geeft een object met `status` en `findings` terug;
een actuele binding vervangt de afzonderlijke bron- en datumcontroles niet.

## Een beoordeling verbinden aan haar gegevens

De engine biedt `createReviewBinding(input, wrapper, link)` en
`inspectReviewBinding(input, wrapper, link)`. Een wrapper moet uniek voorkomen
in `input.records` en dezelfde recordinhoud bevatten. Leg een voorgenomen
wijziging eerst in die invoer vast. De gedeelde adapter kan daarvoor de
registers of documenten omzetten.

```js
// input bevat hier de volledige actuele gegevens, inclusief het beoordeelde concept.
const wrapper = input.records.find(row => row.type === 'apps' && row.id === appId);
const link = wrapper.data.frameworkLinks[0];
// Alleen na de afzonderlijke bevestiging door de beoordelaar.
link.reviewBinding = AssuranceEngine.createReviewBinding(input, wrapper, link);
const state = AssuranceEngine.inspectReviewBinding(input, wrapper, link);
```

De binding bewaart de organisatie, het bereik, versies van engine en bronmodule,
het effectieve beleid, `reviewRules`, de registratie, alle gekoppelde bronnen
en de betreffende beoordeling. De gedeelde adapter vult `reviewRules` met de
volledige geladen kadercatalogus en registermapping. Een rechtstreekse
engine-aanroep mag `reviewRules` weglaten; de binding bewaart die afwezigheid
expliciet en bevat dan geen vastgelegde catalogus of mapping. Een leeg object
is daarbij een andere waarde dan een ontbrekend object.
Onbekende JSON-velden blijven onderdeel van deze vergelijking. Alleen de
bovenste `auditTrail` en `frameworkLinks` van registraties en bronnen worden
weggelaten; de beoordeelde link zelf blijft aanwezig zonder zijn eigen
`reviewBinding`. Daardoor maakt het toevoegen van een auditregel de bevestiging
niet direct ongeldig. Een wijziging in de opgenomen inhoud, gekoppelde bronnen,
regels of mapping maakt haar verouderd. De peildatum, globale bestandsrevisie
en globale invoerhash worden niet in de binding opgenomen. De eigen versies en
eventuele inhoudshashes van gekoppelde bronregels blijven er wel in staan.

De inspectie geeft `{status, findings}` terug, met als status `missing`, `current`,
`stale` of `invalid`. Aanmaken kan een fout met `code` en `findings` geven,
bijvoorbeeld bij een ontbrekende of dubbelzinnige bronkoppeling. Een
eindbeoordeling `Onderbouwd` of `Niet van toepassing` zonder actuele binding
mag geen groene dekking geven. De losse tekst van een eerdere beoordeling
blijft bewaard bij een wijziging. De editor vinkt de nieuwe bevestiging nooit
automatisch aan en vernieuwt haar niet door gewoon op Bewaren te klikken.

`createReviewBinding` vervangt de metadata- en datumcontroles in
`record-contract.js` en `evaluate` niet. Ook `current` kan samengaan met een
afgekeurde beoordeling. Ontbrekende en verouderde eindbevestigingen geven
`attention`; een misvormde binding geeft `fail`. Zijn alle actuele beoordelingen
gemotiveerd `Niet van toepassing` zonder verdere bevindingen, dan blijft de
beoordelingscontrole `not_run`.
Bekende bronnen met uitsluitend aandachtspunten kunnen in een reviewbinding
worden opgenomen; hun broncontrole blijft een aandachtspunt. Een registratie
van type `sourceRegister` vereist geen eigen bronverwijzing naar zichzelf.

Vóór het GitHub-voorstel vergelijkt de schrijver nieuwe bevestigingen met de
daadwerkelijk opgehaalde bronbestanden en alle wijzigingen in dezelfde batch.
Een afwijking buiten de lokaal gewijzigde velden telt ook mee. De schrijver
maakt geen vervangende binding en vertrouwt niet op een meegegeven lokale
`before`-kopie voor de geldigheid van een nieuwe bevestiging.

De vergelijkingen gebruiken canonieke JSON. De volgorde van objectsleutels telt
niet mee; lijstvolgorde blijft behouden. De afzonderlijke lijst van opgeloste
bronnen wordt op bron-ID gesorteerd. Afwezig, `null` en leeg blijven verschillend.
Er geldt een grens van 1 MiB aan
canonieke UTF-8-inhoud, 32 niveaus en 50.000 waarden. Cycli, getters, symbolen
en waarden die niet als JSON kunnen worden bewaard worden geweigerd. Dit is
geen eigen cryptografisch handtekeningsysteem. `reviewedBy` en `approvedBy`
zijn opgegeven namen, geen geverifieerde accounts of bevoegdheden.

Een eerdere nulmeting van engine 1.0.0 is niet rechtstreeks vergelijkbaar met
engine 1.1.0. De driftcontrole geeft `attention` met `BASELINE_RULESET_MISMATCH` en
voert geen ongeldige vergelijking uit.

## Uitslagen lezen

| Uitkomst | Presentatie | Betekenis |
| --- | --- | --- |
| `pass` | Groen met tekst | De uitgevoerde regel is geslaagd voor deze invoer. |
| `attention` | Oranje met tekst | Er is een beschreven aandachtspunt of een verandering die beoordeling vraagt. |
| `fail` | Rood met tekst | Een uitgevoerde regel is mislukt. |
| `not_run` | Grijs met tekst | De controle kon niet worden uitgevoerd of had geen passende invoer. |

Toon de regel en reden bij de kleur. Een lege gegevensverzameling, ontbrekende nulmeting of ontbrekend evaluatiecorpus mag geen groen resultaat opleveren. Een rood resultaat mag niet door middeling verdwijnen. Een controle op bronverwijzingen bewijst niet dat de bewering in een bron waar is. Een inhoudswijziging is geen gemeten daling van modelprestaties.

### Exitcode van de commandoregel

`scripts/check_ict_assurance.mjs` bewaart de uitkomsten plus een afzonderlijke
`execution.technicalGate`. Onder beleid `source-decisions-v1` kunnen alleen de
expliciete rode bronbesluiten `SOURCE_USE_DENIED` en `SOURCE_APPROVAL_REJECTED`
technisch slagen. De broncontrole moet minstens één van die twee rode meldingen
bevatten; de overige meldingen moeten zulke bekende rode besluiten of expliciet
`attention` zijn. Andere controlefouten, onbekende codes of ernstwaarden,
ongeldige gegevens en mislukte corpusverwachtingen blijven blokkeren.

Dit verandert de rode bronlamp en totaalstatus niet. Het maakt het mogelijk een
weigering correct vast te leggen. Exitcode 0 is geen toestemming voor brongebruik.
Het rapport vermeldt zowel `failedChecks` als `nonBlockingRedChecks`,
`businessFindings` en `operationalFailures`.

Een uitgevoerde technische controle of corpusverwachting die faalt geeft
exitcode 1. Ongeldige argumenten, onleesbare invoer, manifestfouten en fouten
bij het uitvoeren of bewaren geven exitcode 2. Een expliciete
`--write-baseline` kan ook een technisch geldige rode bronafwijzing vastleggen;
die vergelijkingsstand is geen goedkeuring.

## Hergebruik en bewijs

De bestaande GitHub-import, controle van manifesteigenschappen, conceptwijzigingen, herkomstbewaring en vaste antwoordroutes blijven bruikbare onderdelen van de website. De nieuwe controlecode sluit daarop aan. Zij vervangt die bestaande werking niet door een extra agentendienst.

Na een geslaagde PR-aanvraag worden alleen exact de ingediende conceptversies verwijderd. Nieuwere concepten en nog niet opgeslagen invoer blijven staan. Een bewerking houdt haar oorspronkelijke vergelijkingsbasis, ook wanneer de publicatie van een eerder voorstel tijdens die bewerking voltooit.

Het onderscheid tussen werkelijk hergebruik, aangepaste code en alleen een ontleend ontwerp staat in [de architectuurbeschrijving](../../../../docs/ict-assurance-architecture.md). Daar staat ook welke EAI-contracten als mogelijke mapping zijn onderzocht. Een gelezen schema of aanwezige test is geen bewijs dat de nieuwe combinatie al werkt.

## Een andere organisatie aansluiten

Kopieer het fictieve profiel en vul de eigen identiteit, bron en registermapping in. Houd de inventaris gescheiden van algemene code en algemene regels. Geef het nieuwe profiel een eigen `organisation.id` en toepassingsbereik. Controleer alle mappings met een kleine representatieve dataset, inclusief een leeg bestand, een ontbrekende bron en een ongeldige relatie.

De controlefunctie en profielvalidator zijn herbruikbaar. De bestaande dashboardinterface bevat nog onderwijslabels en functies uit de eerste toepassing. Een nieuw profiel bewijst dus niet dat iedere sector en workflow al volledig wordt ondersteund. Een taalinstelling vertaalt de bestaande interface evenmin automatisch.

Een ChatGPT- of Codex-plugin kan later als extra adapter dezelfde controlefunctie aanroepen. Er is voor deze map geen plugin, MCP-server of nieuwe hosting vereist. Een toekomstige plugin krijgt hetzelfde invoer- en resultaatcontract en afzonderlijk vastgelegde lees- en schrijfrechten.

## Gerichte profielcontrole

```bash
node --check tools/ict-scan/assurance/profile.js
node --test tests/test_ict_scan_assurance_profiles.mjs
```

De profieltests controleren onder meer de echte registermapping, een tweede fictieve organisatie, ongeldige paden, ontbrekende configuratie, onveranderlijkheid en scheiding van bronidentiteiten. Ze beproeven geen GitHub-aanmelding, productiepublicatie of juridische naleving. De controles op de engine en de echte gebruikershandelingen horen bij de overige tests en releasecontrole.
