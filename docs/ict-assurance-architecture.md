# Herbruikbare controles voor het ICT-dashboard

## Keuze

De toepassing gebruikt gedeelde controlecode en afzonderlijke organisatieprofielen. Emmauscollege blijft de eerste toepassing. De bestaande bronregistraties, relaties, kaarteditor, rapportages en GitHub-voorstellen blijven behouden.

Deze keuze maakt de regels herhaalbaar in browser en CI. Zij voorkomt dat een nieuwe organisatie een kopie met afwijkende controlelogica nodig heeft. Dezelfde wijziging maakt het volledige dashboard nog niet geschikt voor iedere sector. Onderwijslabels, importconventies en gebruikershandelingen vragen bij een volgende toepassing een eigen beproeving.

Een volledige herschrijving zou bestaande bronbewaring en gebruikershandelingen opnieuw onzeker maken. Alleen lampjes toevoegen aan de huidige schoolcode laat organisatiespecifieke aannames onzichtbaar. De afgebakende wijziging haalt bronconfiguratie uit de beslislogica en voegt controles met een expliciet resultaatcontract toe.

## Verantwoordelijkheden

| Onderdeel | Bevat | Bevat niet |
| --- | --- | --- |
| Organisatieprofiel | Identiteit, bronmap, repository, registermapping en verklaarde controledrempels | Bronrecords, toegangssleutels of bewijs van naleving |
| Bronadapter | Bestanden lezen, werkelijke revisie vastleggen, records aanbieden | Nieuwe feiten of onbewezen lokale instellingen |
| Controlefunctie | Vaste regels toepassen op records, context, policy en eerdere versie | Modelaanroepen, zelfstandig netwerkverkeer of wijziging van de bron |
| Resultaatweergave | Uitkomst, reden, bereik en peildatum tonen | Een algemeen keurmerk voor juridische of onderwijskundige kwaliteit |
| Wijzigingsroute | Concept, bronvergelijking, logboek en controle van nieuwe bevestigingen vóór een GitHub-voorstel | Identiteitscontrole of een verplicht tweede menselijk oordeel |

Een Web Worker of CI-job is een plaats waar code draait. De workernaam geeft geen extra inhoudelijke betrouwbaarheid. De onderzochte invoer, uitgevoerde regels en bewaarde resultaten leveren het bewijs.

## Herkomst van onderdelen

De bestaande websitecode is onderzocht op branch `feat/ict-scan-en18286-observatie-20261121`, vóór deze wijziging op commit `e68b39aa93e8b70a2237144978e18339166c7026`. Onderstaande indeling voorkomt dat ideeën uit andere projecten worden gepresenteerd als gekopieerde, al gevalideerde code.

| Bron | Status in deze wijziging | Concrete bijdrage | Bewijsgrens |
| --- | --- | --- | --- |
| `tools/ict-scan/github-sync.js` | Bestaande code behouden | Manifest-SHA's en aantallen vergelijken; vorige gegevens na een mislukte import herstellen | Controleert bronconsistentie, niet de inhoudelijke waarheid van bronrecords. |
| `tools/ict-scan/record-github.js` | Bestaande code aangepast voor profielconfiguratie | Conceptwijzigingen, vergelijking met eerdere bronvelden, herkomstbewaring en voorstel via PR | Een PR is nog geen goedkeuring of productiepublicatie. |
| `tools/ict-scan/answer-engine.js` | Bestaande code behouden | Vaste FAQ-antwoorden en selecties uit ingelezen gegevens zonder generatief antwoord | Antwoordkwaliteit hangt ook af van de broninhoud en de ondersteunde vraagroute. |
| `tools/ict-scan/assurance/profile.js` | Nieuwe code | Profielvalidatie, onveranderlijke configuratie en gescheiden bronidentiteiten | Een geldig profiel bewijst geen rechten op de genoemde repository. |
| `tools/ict-scan/assurance/engine.js` | Nieuwe code | Herhaalbare controle-uitkomsten op expliciete invoer | Resultaten gelden voor de geïmplementeerde regels en de onderzochte versie. |
| `tools/ict-scan/assurance/source-register.js` | Nieuwe code | Exacte bronverwijzingen oplossen, bronmetadata controleren en bronbevestigingen vergelijken | Verifieert geen broninhoud, rechten of identiteit buiten de aangeleverde registratie. |
| EAI Standard `system-profiles/` | Ontwerp en mogelijke mapping onderzocht; geen runtime overgenomen | Capaciteit, configuratie, observatie en bewijs onderscheiden | Kandidaatcontract; geen bewijs dat dit dashboard de hele EAI Standard implementeert. |

De aanwezige import- en kaarttests zijn als regressies relevant. Het actuele uitvoeringsbewijs bestaat uit de testresultaten voor de geleverde commit. Een groene historische run, een gelezen test of een bestandsnaam is geen vervanging daarvoor. Voor overname van extra code uit andere repositories moet dezelfde tabel worden aangevuld met broncommit, exacte bestanden, licentie, aanpassingen en een test die de bedoelde bijdrage controleert.

## Taxonomie en corpus

`catalog/taxonomie.json` beschrijft de websitecatalogus. Die indeling verandert niet door het toevoegen van controle-uitkomsten. De betekenis van inhoudelijke EAI-begrippen wordt evenmin aangepast om bij een lampkleur te passen.

De actuele EAI Standard is gericht onderzocht op commit `bb200eac693c63acafbebbf49e06bdeed87b16f8`. Daar vermeldt de [openbare interface](https://github.com/E-AI-MODEL/EAI-standard/blob/bb200eac693c63acafbebbf49e06bdeed87b16f8/standard/public-interface.yaml) `0.4.0-candidate`. De laag [system-profiles](https://github.com/E-AI-MODEL/EAI-standard/blob/bb200eac693c63acafbebbf49e06bdeed87b16f8/system-profiles/README.md) is expliciet een optionele, niet-normatieve kandidaat. Andere producten of skills met een eigen versienummer mogen hiermee niet zonder mapping worden gelijkgesteld.

| Gegeven in de toepassing | Mogelijke relatie met EAI-contract | Voorwaarde |
| --- | --- | --- |
| Functie wordt door leverancier beschreven | `capability_status` met passende `evidence_basis` | Een leverancierstekst wordt niet omgezet in waargenomen lokaal gebruik. |
| Instelling in de concrete installatie | `deployment_status` | Vereist bewijs uit die installatie. |
| Handeling in een afgebakende observatie | `observation_status` | Een niet waargenomen handeling betekent niet automatisch dat de functie uitstaat. |
| Uitgevoerde gegevenscontrole | Verificatie-event met methode, resultaat en uitvoerder | Een interne consistentiecontrole wordt niet als onafhankelijke externe verificatie beschreven. |
| Menselijke beoordeling of leerbewijs | Afzonderlijke inhoudelijke analyse | Technisch slagen bewijst geen beheersing, retentie, transfer of verantwoord professioneel oordeel. |

Bronnen voor deze mapping zijn het [status-evidence-contract](https://github.com/E-AI-MODEL/EAI-standard/blob/bb200eac693c63acafbebbf49e06bdeed87b16f8/system-profiles/status-evidence-contract.yaml), het [verificatieschema](https://github.com/E-AI-MODEL/EAI-standard/blob/bb200eac693c63acafbebbf49e06bdeed87b16f8/system-profiles/verification-event.schema.json) en de [beschrijving van het evidence-register](https://github.com/E-AI-MODEL/EAI-standard/blob/bb200eac693c63acafbebbf49e06bdeed87b16f8/evidence/README.md). De tabel beschrijft een ontwerpaansluiting, geen al uitgevoerde conversie.

Het bronregister ondersteunt versie, herkomst, rechten, gebruiksgrenzen en een bevestigde beoordeling. Originele broninhoud, annotaties en evaluatievoorbeelden blijven afzonderlijk. Het synthetische evaluatiecorpus is uitgebreid tot 31 gevallen met 35 vooraf vastgelegde verwachtingen, waaronder ontbrekende, verouderde en ongeldige bevestigingen. Dit corpus toetst de controlecode. Het is geen inhoudelijke evaluatie van een extern AI-systeem. De wijziging herschrijft geen oorspronkelijke corpusbron en voegt geen volledige normtekst aan de repository toe.

## Vastgelegde bronnen en beoordelingen

De twee geleverde profielen bevatten veertien registermappings: de bestaande
dertien en `sourceRegister`. Oudere profielen met dertien mappings blijven
leesbaar. De eerste toepassing bevat 450 oorspronkelijke inventarisrecords en
51 voorgestelde bronregistraties. De 468 bestaande verwijzingen zijn exact aan
die voorstellen gekoppeld via `referenceKeys`; een record kan ook expliciete
`sourceIds` gebruiken. Dubbele, onbekende of dubbelzinnige verwijzingen leiden
tot een melding. Er is geen semantische of modelgestuurde overeenkomst.

Twee expliciete bestandsidentiteiten in de bestaande herkomstgegevens leveren
twee brongroepen. De overige 49 verwijzingen blijven apart. De registratie
verzint geen bronhouder, gebruiksrecht, bronversie of goedkeuring. Een ontbrekend
bronregister blijft te onderscheiden van een bewust ingelezen leeg register.

Native JSON-import bewaart de oorspronkelijke waarden per record-ID. Een korter
veld, ingetrokken besluit, lege waarde of onbekend veld wordt niet door oudere
inhoud overschreven. De geïmporteerde bestandsnaam staat in de laadgeschiedenis,
niet als nieuwe bewijsverwijzing in iedere registratie. Export en herimport
onder een andere bestandsnaam behouden de 501 records exact.

Een bronbevestiging bewaart organisatie, toepassingsbereik en de brongegevens.
Een normbeoordeling bewaart daarnaast de registratie, gekoppelde brongegevens,
effectief beleid, volledige geladen kadercatalogus, registermapping en versies
van de controlecode. Gewijzigde opgenomen inhoud of regels maken een eerdere
bevestiging verouderd. De editor maakt een nieuwe bevestiging uitsluitend na een apart
aangevinkt besluit van de gebruiker.

De vergelijking negeert alleen de bovenste velden `auditTrail` en
`frameworkLinks` van registraties en bronnen. De bronbevestiging sluit ook haar
eigen `approvalBinding` uit; de normbeoordeling sluit haar eigen `reviewBinding`
uit. Andere onbekende velden blijven onderdeel van de vergelijking.
De volgorde van objectsleutels is niet betekenisvol; lijstvolgorde blijft behouden.
De afzonderlijke lijst van opgeloste bronnen wordt op bron-ID gesorteerd.
Afwezig, `null` en leeg zijn verschillende waarden. De module begrenst omvang,
diepte en aantal waarden en weigert waarden die niet geldig als JSON kunnen
worden bewaard.

De peildatum, globale bestandsrevisie en globale invoerhash maken geen deel uit
van de reviewbinding. De gekoppelde bronregels met hun eigen versie en eventuele
inhoudshash wel. Datumcontroles gebruiken de actuele peildatum afzonderlijk.
De adapter levert catalogus en registermapping via `reviewRules`. Een
rechtstreekse engine-aanroep kan dit object weglaten; de binding legt die
afwezigheid vast en bevat dan geen catalogus of mapping.
`current` betekent dat de vastgelegde inhoud overeenkomt. De afzonderlijke
metadata-, datum- en broncontroles kunnen nog steeds aandacht of een fout melden.

Vóór een GitHub-voorstel worden nieuwe bevestigingen opnieuw vergeleken met de
opgehaalde repositorygegevens plus de volledige voorgenomen wijzigingsbatch.
Een gewijzigde bron binnen diezelfde batch telt dus mee. De schrijver neemt
geen nieuwe bevestiging over uit een vervalste lokale vergelijkingsbasis en
maakt zelf geen vervangende bevestiging. Bestaande beoordelingen mogen als
verouderd bewaard blijven.

Het profiel wijst met `source.configurationFiles` expliciet de profiel-,
catalogus-, engine- en bronmodulebestanden in de ingestelde repository aan.
De schrijver leest deze op dezelfde `baseSha` als de bronbestanden, vóór de
eerste schrijfactie. Het volledige gevalideerde profiel en de volledige
catalogus moeten overeenkomen met de lokaal gebruikte configuratie. Voor de
engine en bronmodule worden de opgegeven versies vergeleken, zonder remote
JavaScript uit te voeren. De schrijver volgt geen gewijzigde paden of
repository uit een opgehaald profiel.

Een oudere configuratie zonder deze expliciete paden blijft leesbaar, maar
blokkeert publiceren. Een afzonderlijke datarepository moet de aangewezen
configuratiebestanden bevatten. Dit voorkomt een stilzwijgende aanname dat
een website-URL ook een repositorypad is. De versiecontrole van modules is
geen vergelijking van alle uitvoerbare bytes; CI toetst de nieuwe commit.

Dit is een controle op de geldigheid van een opgeslagen vergelijking. Het is
geen cryptografisch bewijs van de identiteit of bevoegdheid van een beoordelaar.
Een bevestigde bron met beperkt gebruik blijft een aandachtspunt. Een afgewezen
bron blijft rood, ook wanneer de technische verwerking van dat besluit slaagt.

## Normverwijzingen

Een normverwijzing identificeert een bron en een concrete bepaling. Toepasselijkheid, verantwoordelijke actor, beoordeling, bewijs en opvolging zijn afzonderlijke gegevens. Een ingevulde verwijzing bewijst geen naleving van EN 18286, de AI-verordening, de AVG of een sectornorm.

De automatische regels kunnen ontbrekende onderbouwing en verlopen beoordelingen signaleren. Ze stellen niet zelfstandig vast welke juridische rol een organisatie heeft, of een systeem hoog risico is, of het geleverde bewijs voldoende is. Status en broncontrole van de gebruikte kaders worden apart vastgelegd in [het bronnenonderzoek](ict-assurance-sources.md).

## Acceptatiecriteria

De verandering is klaar voor beoordeling wanneer de relevante tests en gebruikershandelingen zijn uitgevoerd op dezelfde bronversie:

- Dezelfde records, policy, peildatum en eerdere versie geven dezelfde uitslagen.
- Lege gegevens, ontbrekende bewijsverwijzingen, ongeldige datums en ontbrekende evaluatie-invoer leiden niet tot een ongegrond groen resultaat.
- Een eerdere versie van een andere organisatie, bron of policy wordt niet stilzwijgend gebruikt.
- Een tweede fictief organisatieprofiel wordt zonder schoolgebonden terugval geaccepteerd.
- Een ongeldig profiel of pad wordt vóór brongebruik geweigerd.
- Bestaande records, bronvelden en auditgeschiedenis blijven na bewerken en exporteren behouden.
- Lampjes hebben tekst en een reden, zodat betekenis niet alleen van kleur afhangt.
- De kaarteditor en het controlescherm zijn daadwerkelijk bediend op desktop en een smal scherm.
- De oplevering vermeldt afzonderlijk wat lokaal getest, via CI getest, in een PR aangeboden, gemerged en gepubliceerd is.

De eerste profieltests gebruiken een fictieve organisatie en echte bestandsmappings, zonder externe repository te benaderen. Dat bewijst de geteste configuratiescheiding. Toegang voor meerdere organisaties, een algemene vertaling van de interface, een nieuwe plugin en volledige offline herstart zijn afzonderlijke werkzaamheden met eigen acceptatiecriteria.
