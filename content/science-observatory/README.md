# Science Observatory: proefpublicatie

Dit is de publieke proefbibliotheek voor natuurkunde en wiskunde A/B. De oorspronkelijke Galactische HTML is als zelfstandig bestand opgenomen.

## Onderscheid tussen beheer en publiek

De publieke pagina en vijf onderzoeksmodellen bevatten uitsluitend onderzoeks- en leerfuncties. Er staat geen beheeraccount, publicatietoken of opslagservice in. Docentbeheer en broncontrole blijven buiten deze publieksroute.

## Bestanden

- `landing.html`: bron voor de catalogus op `/tools/science-observatory/`.
- `labs/melkweg.html`: de oorspronkelijke referentie, inhoudelijk niet gewijzigd.
- `labs/gravitatie-banen.html`, `labs/wiskunde-a.html`, `labs/wiskunde-b.html`: bestaande proefmodellen.
- `labs/natuurkunde.html`: natuurkunde V3 met 53 interactieve onderwijsmodellen, een onderzoekswerkruimte met tabbladen en beperkte directe manipulatie/3D-bediening.
- `scripts/build_site.py` neemt de bestanden op in de productiebuild; de uitvoermap `tools/` is geen bron.

## Ontwerpen vanuit de leerling

De 53 natuurkundeproeven vormen samen één onderzoeksruimte. Verbeter de bestaande proeven per onderwerp in plaats van voor elke verbetering een aparte proefomgeving te openen.

- De leerling kan zelf experimenteren: variabelen veranderen, in het model slepen, grafieken onderzoeken en metingen bewaren of vergelijken.
- Laat de proef en grafiek zo veel mogelijk direct zien. Een proef hoeft niet uit te leggen wat een knop doet voordat de leerling kan beginnen.
- Laat per proef de twee of drie nodige instellingen direct zien. Zet overige parameters, toelichting en extra uitleg in uitklapbare onderdelen. Op telefoons zijn maximaal twee snelle instellingen zichtbaar; de volledige proefbediening blijft bereikbaar. Verberg geen benodigde handeling.
- Houd proef, relevante bediening en grafiek binnen één scherm. Vermijd paginascroll. Vergrootbare grafieken en compacte panelen hebben de voorkeur boven kleine, moeilijk leesbare inhoud.
- Kies de knoppen per proef op basis van het te onderzoeken verschijnsel. Een slinger heeft lengte en uitwijkhoek vooraan, een schakeling spanning en weerstand, een gasproef het gekozen proces en de grootheid die daarbij mag veranderen. Serie/parallel en gasproces zijn gewone keuzelijsten, geen numerieke codes.
- Een grafiek met een instelbare grootheid op de horizontale as verandert die grootheid bij slepen. Een tijdgrafiek laat de leerling de simulatie op dat tijdstip bekijken. Een grafiek van positie of intensiteit laat een punt aflezen zonder ongemerkt de fysieke parameters te veranderen.
- Controleer bij gekoppelde grootheden ook de natuurkundige relaties, bijvoorbeeld pV=nRT: bij een isobaar gasproces hoort T mee te veranderen met V zodat de druk constant blijft.
- Een grootheid met alleen gehele waarden, zoals het aantal dragende touwdelen of een Bohr-energieniveau, staat als losse punten in de grafiek. Tussenliggende waarden zijn geen mogelijke instellingen.
- Behoud de verschillende natuurkundige eigenschappen per proef en test veranderde metingen, grafieken en bediening afzonderlijk. Een geslaagde schermtest bewijst geen natuurkundige nauwkeurigheid.
- De losse schuine-worpstudio blijft voorlopig als eerdere proefvariant bestaan, maar is geen tweede hoofdingang naast de gezamenlijke 53 proeven.

## Grenzen

De proefmodellen hebben niet allemaal dezelfde wetenschappelijke diepgang. De 53 natuurkundeonderwerpen zijn in deze versie zichtbaar en bedienbaar, maar niet allemaal afzonderlijk inhoudelijk gevalideerd. Het Galactisch Observatorium blijft het referentieniveau voor een rijke onderzoeksomgeving. De officiële eindtermen en schoolse verdeling over vwo 5/6 worden pas definitief gekoppeld na toetsing aan het PTA. De site bewaart geen leerlingantwoorden centraal.

## Aanpassen en publiceren

Bewerk de bronnen onder `content/science-observatory/`. Controleer de modellen en laat de websitebuild en browsertests slagen. Publicatie volgt pas na review en merge van de betreffende PR.
## Navigatie

Science Observatory blijft bereikbaar onder `/tools/science-observatory/`. Van daaruit opent natuurkunde onder `/tools/science-observatory/labs/natuurkunde/`. De afzonderlijke proeven hebben directe hash-links. De Nederlandse en Engelstalige Tools-pagina's verwijzen naar de observatoria onder een eigen rubriek. Het publieke deel bevat alleen proef- en leerfuncties; beheer en publicatie horen niet in deze leerlingenpagina.

Bij wijzigingen aan de catalogus of het menu draait `node --test tests/test_science_observatory_navigation.mjs` mee in de sitecontrole.

## Rekenkundige controles (november 2026)

De automatische test `tests/test_science_physics_models.mjs` opent de rekenmodellen van alle 53 proefonderwerpen en vergelijkt geselecteerde uitkomsten met zelfstandig te berekenen referentiegevallen. De test controleert onder andere hydrostatische druk, worpbeweging, lenzen/wet van Snellius, elektrische weerstand, magnetisch veld, tijdrek en Bragg-reflectie.

Drie concrete fouten zijn hersteld:

- Bij een drijvend lichaam is de opwaartse kracht in evenwicht gelijk aan het gewicht; het maximale waterverplaatsingsvolume wordt alleen bij volledige onderdompeling gebruikt.
- De intensiteit precies midden tussen twee gelijke coherente bronnen hangt bij een nul-weglengteverschil van hun faseverschil af.
- De verticale positie van het getekende gewicht van een ideale veer volgt nu ook de ingestelde amplitude.

De controles bewijzen geen volledige natuurkundige validatie van alle situaties. De schema's en grafieken van de andere proeven worden nog per onderwerp inhoudelijk nagezien.

## Natuurkundige controle: vervolgronde

De nieuwe test `tests/test_science_physics_round3.mjs` controleert 53 simulatiemodellen bij minimale, middelste en maximale parameterinstellingen en op drie animatietijdstippen (477 combinaties). Deze test controleert geldige berekende en getekende waarden, geen volledige wetenschappelijke juistheid.

Verder zijn de volgende proeven aangepast:

- **Dopplereffect**: de bron beweegt met de ingestelde snelheid; golfcirkels groeien met de geluidssnelheid en behouden de positie waar ze zijn uitgezonden. De frequentiegrafiek gebruikt nu de ingestelde bronsnelheid.
- **Bolle lens**: het model onderscheidt werkelijk doorgelaten stralen van gestippelde terugverlengingen bij een virtueel beeld; de grafiek toont voorwerpsafstanden aan beide zijden van het brandpunt.
- **Lorentzkracht**: bij een snelheid evenwijdig aan het magneetveld toont de projectie geen cirkelbeweging. Het model beschrijft alleen de dwarsprojectie.
- **Foto-elektrisch effect**: bij een remspanning wordt de anode met een negatieve polariteit getoond ten opzichte van de kathode.

De lens- en Dopplerweergaven blijven schematische onderwijsmodellen. De controle van alle 53 simulaties op fysische nauwkeurigheid, realistische tijdschalen en didactische diepgang is nog niet afgerond.

## Grafieken en meetwaarden: november 2026

Alle 53 natuurkundeproeven hebben nu een eigen beschrijving van de horizontale en verticale as. De zichtbare assen gebruiken de werkelijke tijd, afstand, hoek, frequentie of andere grootheid van de grafiekfunctie. Bij vereenvoudigde modellen staat expliciet *relatief* of *modelafstand*. Sommige grafieken tonen een parameterstudie, niet een tijdverloop.

Een kleine stip toont de huidige proefinstelling of animatietijd waar die horizontale positie betekenisvol is. Een bewaarde curve wordt bij het vergelijken op haar eigen oorspronkelijke horizontale schaal gehouden. De getoonde schaal bevat beide meetbereiken; er worden geen waarden buiten het oorspronkelijke bereik verzonnen.

De regressietest `tests/test_science_physical_graphs.mjs` controleert alle 53 asbeschrijvingen bij drie parameterinstellingen, een aantal onafhankelijk berekende referentiepunten, veranderlijke meetbereiken, en het omgaan met onderbrekingen zoals totale interne reflectie.

Deze controles zeggen niets over volledige natuurkundige validatie van alle simulaties. De modellen met relatieve weergaven moeten inhoudelijk en didactisch verder worden beoordeeld.

## Grafiek, meting en beweging: vervolgcontrole

De regressietest `tests/test_science_graph_animation_alignment.mjs` controleert op meerdere tijdstippen en instellingen of grafiekwaarden overeenkomen met daadwerkelijk getekende posities, veldsterktes en meetwaarden. Zij is toegevoegd aan zowel de websitecontrole als de productiebuild.

- **Staande golven:** snaarbeweging en momentopname van de grafiek gebruiken dezelfde uitwijking. De uitgebreide scène gebruikt nu ook dezelfde tijdsfactor.
- **Longitudinale golven:** de grafiek toont de verplaatsing van luchtdeeltjes, niet een ongemeten drukafwijking. Deeltjesposities en grafiek komen overeen.
- **Wisselstroom:** gemeten stroom, golfvorm en bewegende stip gebruiken dezelfde vertraagde weergavetijd. De grafiek noemt dit expliciet gesimuleerde tijd.
- **Elektromagnetische golven:** 2D-weergave, ruimtelijke golf en grafiek gebruiken dezelfde fase en golflengte.
- **Interferentie:** de kleuren van het golfveld en de meetlijn worden met dezelfde som van twee golven berekend.
- **Zwevingen:** een stip en een actuele meetwaarde laten de som van de twee trillingen op hetzelfde tijdstip zien.
- **Radioactief verval:** de terugkerende animatie gebruikt dezelfde zes halveringstijden als de grafiek.

De getoonde vertraging van snelle trillingen is een hulpmiddel om hun beweging te kunnen volgen. Het is niet de werkelijke oscillatiefrequentie op het beeldscherm. Deze controle betreft de genoemde modellen en steekproeven, niet een volledige vakinhoudelijke audit van alle 53 proeven.

## Per proef: tweede weergave en rekenstappen (13 november 2026)

Alle 53 proeven hebben een bewust gekozen tweede weergave en een uitklapbare berekening met de actuele formule, ingevulde waarden, resultaat en modelaannames. De data komen uit dezelfde `renderExperiment`-aanroep als de gemeten waarden, zodat de uitlegregel niet los van de simulatie rekent.

Bij 20 proeven opent de tweede ruimte met een passende andere voorstelling (krachten, energie, momenten, weerstanden, spanning, tijd, niveaus of verval). Bij 33 proeven blijft de grafiek het eerste beeld, omdat deze het verloop of een relatie het beste toont. De interactieve grafiek blijft bij alle 53 bereikbaar.

`tests/test_science_physics_insights.mjs` controleert of alle proeven de berekeningsstappen tonen, de gekozen tweede weergave beschikbaar is en of de weergegeven antwoorden bij gewijzigde instellingen uit de meetwaarden komen. `scripts/test_science_fixed_workspace.mjs` opent voor grafiekbediening expliciet het grafiektabblad. De controles vervangen geen afzonderlijke volledige wetenschappelijke of didactische validatie van iedere proef.

## Bronnen en inhoudelijke controle (13 november 2026)

De proeven blijven publieke onderwijsmodellen. Voor vijf onderwerpen is een compacte docentverdieping toegevoegd onder **Zo bereken je dit**: hefboom, elastische/onelastische botsingen, ideaal gas, Bohr-model en radioactieve reeksen. De leerling behoudt de actuele formule, ingevoerde getallen, meetwaarden en simulatie zonder nieuw hoofdmenu.

De docentverdieping vermeldt per proef de natuurkundige relatie, een korte afleiding, de geldigheidsvoorwaarden en **specifieke** bronhoofdstukken. Voor de eerste vier zijn dat onder meer hoofdstukken uit *OpenStax College Physics 2e*. Voor de vervalreeksen is naast OpenStax een college over Batemanvergelijkingen van MIT OpenCourseWare opgenomen. De restitutiecoëfficiënt in de botsingsproef is een aanvullende modelparameter; een bron die impulsbehoud uitlegt, bewijst nog niet de implementatie van die parameter.

Alle 53 proeven hebben in `natuurkunde-kwaliteit.json` expliciet een bronstatus, referentieteststatus en vakdocentstatus. Voor 5 zijn bronlinks geselecteerd en zijn onafhankelijke tests toegevoegd; voor 48 staat de bronselectie nog open. De inhoudelijke aftekening staat bij alle 53 nog op `false`. De bronverwijzingen zijn een controlehulpmiddel, geen automatisch wetenschappelijk keurmerk.

`tests/test_science_physics_evidence.mjs` toetst onafhankelijk de hefboom, impuls/energie bij botsingen, het ideale gas, discrete Bohr-overgangen en de moeder-dochterpopulaties, ook voor bijna gelijke halveringstijden. Bij vervalreeksen gebruikt de implementatie nu `Math.expm1` om numerieke uitval door het aftrekken van vrijwel gelijke exponenten te voorkomen. De eigen onderzoeksgrafiek en de docentverdieping worden afzonderlijk bijgewerkt. `scripts/test_science_fixed_workspace.mjs` test dat de docentverdieping tijdens het verslepen van het steunpunt open blijft.

Vervolg voor de andere proeven: kies per proef een exact bronhoofdstuk, bereken onafhankelijke grensgevallen, controleer formule/grafiek/animatie op overeenstemming, laat een natuurkundedocent de inhoudelijke uitspraak aftekenen en controleer waar nodig begrip bij leerlingen. Pas daarna wordt `inhoudelijk_gevalideerd` voor die proef gewijzigd. Het algemene OpenStax-boek alleen is niet voldoende als bronverwijzing.
