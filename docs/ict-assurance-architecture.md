# Herbruikbare controles voor het ICT-dashboard

## Keuze

De toepassing krijgt gedeelde controlecode en afzonderlijke organisatieprofielen. Emmauscollege blijft de eerste toepassing. De bestaande bronregistraties, relaties, kaarteditor, rapportages en GitHub-voorstellen blijven behouden.

Deze keuze maakt de regels herhaalbaar in browser en CI. Zij voorkomt dat een nieuwe organisatie een kopie met afwijkende controlelogica nodig heeft. Dezelfde wijziging maakt het volledige dashboard nog niet geschikt voor iedere sector. Onderwijslabels, importconventies en gebruikershandelingen vragen bij een volgende toepassing een eigen beproeving.

Een volledige herschrijving zou bestaande bronbewaring en gebruikershandelingen opnieuw onzeker maken. Alleen lampjes toevoegen aan de huidige schoolcode laat organisatiespecifieke aannames onzichtbaar. De afgebakende wijziging haalt bronconfiguratie uit de beslislogica en voegt controles met een expliciet resultaatcontract toe.

## Verantwoordelijkheden

| Onderdeel | Bevat | Bevat niet |
| --- | --- | --- |
| Organisatieprofiel | Identiteit, bronmap, repository, registermapping en verklaarde controledrempels | Bronrecords, toegangssleutels of bewijs van naleving |
| Bronadapter | Bestanden lezen, werkelijke revisie vastleggen, records aanbieden | Nieuwe feiten of onbewezen lokale instellingen |
| Controlefunctie | Vaste regels toepassen op records, context, policy en eerdere versie | Modelaanroepen, zelfstandig netwerkverkeer of wijziging van de bron |
| Resultaatweergave | Uitkomst, reden, bereik en peildatum tonen | Een algemeen keurmerk voor juridische of onderwijskundige kwaliteit |
| Wijzigingsroute | Concept, bronvergelijking, logboek en reviewbaar voorstel | Rechtstreekse goedkeuring van een eigen beoordeling |

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

Een corpus kan versie, herkomst, rechten, peildatum, claimverwijzingen en een beoordeling krijgen. Bewaar originele broninhoud, annotaties en evaluatievoorbeelden afzonderlijk. Een testverzameling krijgt vooraf vastgelegde verwachte uitkomsten. De uitkomsten mogen niet achteraf worden aangepast om een wijziging groen te laten lijken. Deze wijziging herschrijft geen corpusbron en voegt geen volledige normtekst aan een openbare dataset toe.

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
