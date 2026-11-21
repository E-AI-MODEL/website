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
| `adapter.js` | De bestaande dertien registers omzetten voor browser en CLI. |
| `worker.js` | De engine in een lokale browserworker uitvoeren en invoer/policy/corpus van een SHA-256 voorzien. |
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

`sourceDir` is een relatief pad zonder afsluitende slash. `registerFiles` bevat de dertien registers die de huidige dashboardadapter ondersteunt. Meerdere registers mogen hetzelfde bestand gebruiken. De bronmap is niet de plaats voor toegangssleutels of een persoonlijke inventaris. De validator weigert onbekende velden.

```js
const profile = AssuranceProfile.validate(parsedJson);
const scopeId = AssuranceProfile.scopeKey(profile);
```

`validate` geeft een onafhankelijke, diep bevroren kopie terug. Ongeldige invoer geeft een fout; er volgt geen stille terugval naar Emmauscollege. `scopeKey` combineert organisatie, repository, branch of tag, bronmap en toepassingsbereik. Een eerdere versie van een andere bron mag daardoor niet als nulmeting voor de huidige bron dienen.

Een profiel verleent geen toegangsrechten. De aanroepende code controleert ook of de werkelijk ingelezen bron bij het actieve profiel hoort. Alleen een gelijke organisatienaam volstaat daarvoor niet.

Lokale momentopnames gebruiken dezelfde profielscope. De browser herstelt alleen een momentopname met de passende organisatie en bron. Wissen geldt ook alleen voor die scope. Dit voorkomt onbedoelde vermenging; het is geen toegangsbeveiliging tussen gebruikers van dezelfde browser of website-origin.

Een oudere momentopname zonder profielbinding wordt niet automatisch geladen. Zij blijft bereikbaar via **Rapporten → Rapport ophalen → Deze inventaris bewaren → Eerdere lokale kopie → Oude lokale kopie downloaden**. Deze actie downloadt de volledige oorspronkelijke momentopname als archiefbestand en wijst de inhoud niet aan het actieve profiel toe. Dit archief is geen reguliere JSON-export voor automatische herimport.

### Beoordelingstermijn

Beide geleverde profielen gebruiken 365 dagen met `basis: "project-default"`. Dit is een instelbare termijn voor signalering, geen wettelijke termijn of vastgesteld besluit van een organisatie. Een expliciete datum voor de volgende beoordeling blijft een afzonderlijke invoer voor de controle.

Leg een andere termijn met een nieuwe policyversie vast. Gebruik `organisation-policy` uitsluitend met een beschrijving van het echte besluit. Een gewijzigde drempel mag niet ongemerkt de betekenis van een oude meting veranderen.

## Invoer voor de controlefunctie

De adapter zet bronrecords om naar `{type, id, data}`. Hij maakt een onafhankelijke kopie van de recordinhoud in `data`. Een door de import toegevoegde JSON-bestandsnaam in `sources` wordt uit de controlekopie verwijderd, zodat browser en CLI dezelfde oorspronkelijke bronverwijzingen vergelijken. Het ingelezen record zelf blijft intact. Bekende bronIDs, beschrijvingen, herkomst en menselijke beoordelingen mogen niet worden vervangen door een automatisch oordeel.

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
  baseline,
  evaluation
});
```

`inspectedSourceVersion` moet de werkelijk onderzochte bronversie beschrijven. Gebruik bij GitHub de opgehaalde revisie of de expliciete bestandsidentiteiten. Een branchnaam alleen legt geen onveranderlijke inhoud vast. `baseline` en `evaluation` zijn optioneel. Het ontbreken ervan levert geen geslaagde driftcontrole of evaluatie op.

De gedeelde adapter selecteert de beleidsvelden die de controlefunctie ondersteunt. Geef `profile.policy` niet rechtstreeks door: dat object bevat ook de toelichting en de herkomst van de termijn. `frameworkCatalog` is het daadwerkelijk geladen register met toetsingskaders en relatietypen. `AssuranceAdapter.fromState` en `fromDocuments` gebruiken dezelfde selectie voor browser en commandoregel.

De aanroeper geeft de peildatum mee. De controlefunctie leest niet zelf de klok. Hierdoor kunnen dezelfde invoer en dezelfde datum opnieuw worden beoordeeld.

## Uitslagen lezen

| Uitkomst | Presentatie | Betekenis |
| --- | --- | --- |
| `pass` | Groen met tekst | De uitgevoerde regel is geslaagd voor deze invoer. |
| `attention` | Oranje met tekst | Er is een beschreven aandachtspunt of een verandering die beoordeling vraagt. |
| `fail` | Rood met tekst | Een uitgevoerde regel is mislukt. |
| `not_run` | Grijs met tekst | De controle kon niet worden uitgevoerd of had geen passende invoer. |

Toon de regel en reden bij de kleur. Een lege gegevensverzameling, ontbrekende nulmeting of ontbrekend evaluatiecorpus mag geen groen resultaat opleveren. Een rood resultaat mag niet door middeling verdwijnen. Een controle op bronverwijzingen bewijst niet dat de bewering in een bron waar is. Een inhoudswijziging is geen gemeten daling van modelprestaties.

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
