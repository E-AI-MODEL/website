# Storyboard: Een eiland dat reageert
**Versie 0.1 | Ontwerpvoorstel, nog niet goedgekeurd**

Dit document beschrijft een **speelbare opeenvolging**, geen film of serie tekstschermen. De spelers bepalen zelf hun route. De nummering is de ontdekroute voor de eerste prototypeproef, geen verplichte volgorde voor het hele spel.

## Verhaalvorm
- **Binnenkomen:** de camera laat een probleem zien voordat er uitleg verschijnt.
- **Verkennen:** spelers vinden aanwijzingen via plaatsen, gesprekken en objecten.
- **Kiezen:** er zijn meerdere werkbare routes met andere kosten en gevolgen.
- **Proberen:** een opdracht is een handeling in de wereld, geen willekeurige onderbrekende vraag.
- **Gevolg:** een machine, landschap, pad of personage reageert op die handeling.
- **Terugkomen:** de gewijzigde wereld is er nog.

## Scènes en opnames

| ID | Gebeurtenis en bedoeling | Camera / geluid / kleur | Zichtbare bediening | Speltoestand en toetsbaar gevolg |
|---|---|---|---|---|
| 00 | **Aanloop over het water.** De speler ziet het eiland en de brug die halfopen hangt. Geen verplicht verhaalvenster. | Camera glijdt van water naar aanlegsteiger; stormwolken trekken weg, drie onregelmatige belslagen | 'Begin', geluid aan/uit, toegankelijkheid | De wereldseed, het tijdstip na de storm en vaste objecten worden geladen |
| 01 | **De aanlegplaats.** Mare kijkt naar de vastgelopen brug. De speler kan direct om zich heen kijken. | Camera achter de speler met vrije draai; wind, knarsend rad, geruis | Eén kleine aanwijzing: 'Kijk rond'; optioneel 'Praat met Mare' | Gezien startlocatie, introductie optioneel; geen beloningspunten voor klikken |
| 02 | **Eerste verkenning.** Een gebroken kabel, een waterpeilstreep en een onleesbaar bord zijn waarneembaar. | Close-up op object na interactie, niet automatisch filmisch inzoomen | Contextknop: 'Onderzoek kabel' of 'Bekijk peil' | Drie aanwijzingen kunnen onafhankelijk worden gevonden; log vermeldt bron |
| 03 | **De route splitst.** Via steiger, brugmachine of waterkant zijn verschillende routes bereikbaar. | Overzicht als speler kaart opent, anders gewoon third-person | Compacte kaart en drie locaties met afstanden | Routekeuze wijzigt de actieve bestemming, niet de inhoud van de wereld |
| 04 | **Bij het waterrad.** Water stroomt te hard en schuurt langs een kapotte lagering. | Nabij geluid van rad, schuivend water; koel petrol en verweerd koper | 'Meet', 'Verplaats schuif', 'Test' | Debiet, rotatiesnelheid en veilige bandbreedte zijn gekoppeld; de animatie volgt de simulatiewaarden |
| 05 | **Eerste proef, inclusief fout.** Speler voorspelt wat het verschuiven van de schuif doet. | Camera houdt peilstreep en rad samen in beeld | Proefbediening direct aan het rad; daarna 'Controleer wat er gebeurde' | Verkeerde instelling geeft te hoge snelheid en duidelijke feedback; opnieuw proberen zonder straflus |
| 06 | **De brug reageert.** Bij een veilige instelling draait het rad trager, de lier pakt de ketting op. | Kort mechanisch geluid, zichtbaar aandraaien en iets bewegen van de brug | 'Ga naar brug' / 'Onderzoek verder' | `waterControlStable=true`, `bridgeMovementEnabled=true`; brugpositie blijft na sluiten van het venster |
| 07 | **Ada’s werkplaats.** De brug beweegt maar de belasting is nog onbekend. | Droger licht, schaduwen van tandwielen; ritmische hamerslag | 'Vergelijk tandwielen', 'Probeer een belasting' | Speler ontdekt verschil tussen beweging en veilig functioneren |
| 08 | **Mechanische proef.** Een bouwsel met twee verschillende verhoudingen is te testen. | Animatie van ketting en gewichten volgt gekozen verhouding | Voorwerp manipuleren, één duidelijke toetsknop | Verhouding bepaalt koppel/snelheid en of het model stabiel blijft; voorspelling en uitkomst apart bewaard |
| 09 | **Een gesprek in de haven.** Niet iedere bewoner kan de smalle omweg gebruiken. | Warmere steen- en houtkleuren, stemmen en geluid van touwen | 'Luister', 'Vraag naar route', 'Bekijk kaart' | Speler ziet belangen en concrete toegankelijkheidsbeperkingen; geen 'juiste mening' punten |
| 10 | **Het Echoarchief.** Twee werkbladen noemen een andere schaal of maat. | Gedempt blauw, zacht glaslicht, papier en klokken | Twee bronnen naast elkaar; 'Waar komt dit vandaan?' | Herkomst en foutieve schaal kunnen worden vastgesteld; bronvermelding blijft terugvindbaar |
| 11 | **Het besluit.** Speler heeft voldoende informatie voor een eerste reparatie of omweg. | Camera op brug, bewoners en water tegelijk in beeld | Kies een plan, laat gevolgen vooraf zien, bevestig | Plan bevat aannames en verwachte neveneffecten; gebruiker kan reden wijzigen |
| 12 | **Uitvoering.** Brug, water, bebouwing en routes bewegen volgens het gekozen plan. | Geen tekstvuurwerk: relevante animatie, korte geluiden en subtiele feedback | Alleen 'Stop' en 'Bekijk resultaat' tijdens animatie | Objecten bewaren overgang naar hun nieuwe toestand; water, brug en routes blijven gekoppeld |
| 13 | **Het effect voor anderen.** Bewoners reageren op de geopende of afgesloten route. | Tijd verstrijkt zichtbaar, afhankelijk van gekozen oplossing | 'Bekijk gevolgen', 'Praat met Bo' of 'Ga verder' | Belangen, bereikbaarheid, openstaande problemen zijn daadwerkelijk gewijzigd |
| 14 | **Verdieping.** Speler ontdekt eerdere reparatiekeuze, gekopieerde instructie en uitgesteld onderhoud. | Oude kaart, machineonderdeel, gesprek; geen plotdump | Drie losse aanwijzingen zijn in willekeurige volgorde te verzamelen | Verschil tussen feit, hypothese en interpretatie wordt zichtbaar gemaakt |
| 15 | **Grote Oversteek.** Alle vier gebieden leveren informatie voor de laatste controle. | Camera beweegt tussen rivier, brug en haven; daglicht breekt door | Onderbouwd plan met een testbare controle | Snelle oversteek, veilige omweg of gezamenlijk herstel. Uitkomst volgt spelregels, niet toeval |
| 16 | **Terugkeer.** Speler keert naar de steiger terug; wereld toont actuele veranderingen. | Dezelfde camerahoek als 01, maar ander geluid en andere objecttoestand | 'Verder ontdekken', 'Wereld bewaren', 'Andere route proberen' | Bestaande wereld blijft bestaan; nieuwe expeditie maakt een aparte geschiedenis |

## Een scène als speelbare handeling: de eerste waterproef

1. **Waarnemen.** De speler ziet dat het waterrad hapert. Een peilmeter staat te hoog. Tikken op de meter laat de meting zien, niet meteen het antwoord.
2. **Voorspellen.** Wat gebeurt er met de snelheid van het rad bij minder toevoer? De speler kiest een verwachting en kan die toelichten.
3. **Instellen.** Verplaats de schuif. De hoeveelheid water, het rad en de meetwaarden reageren op dezelfde ingestelde waarde.
4. **Testen.** De speler laat het systeem kort draaien. Een verkeerde instelling toont overbelasting zonder dat het spel vastloopt.
5. **Beoordelen.** Het spel toont de gemeten waarde naast de verwachting en vraagt wat er volgens de speler is gebeurd.
6. **Gevolg.** Bij een veilige instelling ontgrendelt een volgende brughandeling. De opgeslagen wereldtoestand bevat die beslissing.
7. **Terugkeren.** Na een ander gesprek of een herstart draait het rad nog met dezelfde instellingen.

Het model van waterstroom, snelheid en krachten wordt vóór inhoudelijke vrijgave getoetst aan passende natuurkundige bronnen. Voor een eerste prototype mag een vereenvoudigd model worden gebruikt, mits de grenzen duidelijk zijn en grafiek, animatie en berekening bij elkaar passen.

## Variatie naar schoolniveau, niet alleen andere woorden
- **Vmbo onderbouw:** herkenbare effecten voorspellen met concrete bediening en overzichtelijke waarnemingen; rekenen alleen waar het bij de situatie past.
- **Havo onderbouw:** twee veranderlijke waarden vergelijken, een passende verhouding kiezen en een conclusie onderbouwen.
- **Vwo onderbouw:** meer afhankelijkheden onderzoeken, een grensgeval of afwijkende meting verklaren en het eigen model bevragen.

Geen niveaus mogen met alleen een woordvervanging of langere vraagtekst worden geclaimd. Elke versie krijgt een eigen doel, toetsbare handeling, verwachte uitkomst en redactionele controle.

## Regels voor camera en interface
- Overzicht, vrij verkennen en dichtbij onderzoeken zijn **standen van dezelfde wereld**, niet drie losstaande spellen.
- Camera mag niet automatisch tegen een object of door een muur bewegen. Speler kan altijd terug naar overzicht.
- De eerste informatie staat in het beeld zelf. Tekst of een modal verschijnt uitsluitend bij een gerichte actie.
- Op mobiel is het primaire object bereikbaar zonder met de vinger de hele scène te bedekken.
- Een geanimeerde ingreep heeft een pauzeoptie of een direct zichtbare eindtoestand bij voorkeur voor minder beweging.
- Elk scherm ondersteunt leesbaarheid, toetsenbord waar passend, ondertiteling voor betekenisvol geluid en duidelijke focus.

## Controlestaat voor implementatie
| Scène | Inhoudelijk gecontroleerd | 3D-uitvoering | Desktop-test | Mobiel-test |
|---|---|---|---|---|
| 00–03 aankomst en verkenning | Nee, verhaalvoorstel | Niet gebouwd | Niet uitgevoerd | Niet uitgevoerd |
| 04–08 water en machine | Nee, technisch model te kiezen | Niet gebouwd | Niet uitgevoerd | Niet uitgevoerd |
| 09–15 routes en Grote Oversteek | Nee, verhaalvoorstel | Niet gebouwd | Niet uitgevoerd | Niet uitgevoerd |
| 16 terugkeer en behoud | Opslagregels in apart document | Niet gebouwd | Niet uitgevoerd | Niet uitgevoerd |

De bestaande oude EAIgame- en PR #277-browserproeven bewijzen **niet** dat dit storyboard werkt. 
