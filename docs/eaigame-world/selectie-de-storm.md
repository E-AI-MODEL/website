# Eerste inkooploze selectie: De Storm
**Versie 0.1 · 15 november 2026 · geen definitieve assetkeuze**

Dit is de korte set waarmee we het verschil tussen een mooie illustratie en een **werkelijk speelbare 3D-scène** kunnen aantonen. De volledige bronnenverzameling staat in [bronregister.json](./bronregister.json). Dit document kiest wat als eerste op bruikbaarheid wordt getest. Het kiest nog **geen productiemodellen**.

## De proef die iedere kandidaat moet doorstaan
Een speler komt aan op een steiger. In de verte is een brug beschadigd. Hij loopt naar een waterrad, draait de camera, bekijkt een peilstok, verplaatst een sluisschuif, test de reactie en ziet de brug zichtbaar van toestand veranderen. Hij slaat het spel op. Na herladen staat alles nog precies zo. De interface blijft beperkt tot een concrete opdracht en een gerichte handeling.

Dezelfde scène moet op een telefoon goed te spelen zijn en op desktop voldoende rijk ogen. De oorspronkelijke Sites-versie blijft ongemoeid.

## Kandidaten in de eerste kijk- en importproef

| Onderdeel | Startkandidaat | Alternatief | Nog te beslissen |
|---|---|---|---|
| Natuur / oever | [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | [KayKit Forest Nature Pack](https://kaylousberg.com/game-assets/forest-nature-pack) | Kleur, vorm en detailniveau naast elkaar zetten |
| Kade en gebouwen | [Kenney Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit) | [KayKit Medieval Hexagon](https://kaylousberg.com/game-assets/medieval-hexagon) | Losse gebouwen en props gebruiken, nooit verplichte hexagon-grond |
| Brughoofden / boog | [Kenney Castle Kit](https://kenney.nl/assets/castle-kit) | Zelf kleine brugonderdelen modelleren | Werkelijke draaipunten, botsingen en open/dicht |
| Waterrad | [KayKit Medieval Hexagon](https://kaylousberg.com/game-assets/medieval-hexagon) ter inspectie | Eigen rig op basis van bruikbaar rad | Niet aannemen dat het bestaande rad als afzonderlijk draaiend object beschikbaar is |
| Speler en animatie | [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) + [Animation Pack](https://kaylousberg.itch.io/kaykit-character-animations) | Stijl en silhouet zelf aanpassen | Personage leest goed bij camera en op mobiel |
| Materiaal en licht | [Poly Haven](https://polyhaven.com/) of [ambientCG](https://ambientcg.com/) | Eigen geschilderde materialen | Niet fotorealistisch of kleurmatig afwijkend |
| Contextactie | [Kenney UI Pack Adventure](https://kenney.nl/assets/ui-pack-adventure) als stijlexperiment | Zelf dunne, rustige UI | Eén actie, geen dashboard over het beeld |
| Inputhulp | [Kenney Input Prompts](https://kenney.nl/assets/input-prompts) | Eigen tekst en iconen | Moet overeenkomen met toetsenbord en touch |
| Geluid | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) + [Impact Sounds](https://kenney.nl/assets/impact-sounds) | Eigen CC0 foley zoeken | Water en wind ontbreken nog als bevestigde afzonderlijke assets |
| Camera | [Three.js](https://threejs.org/) en eigen camerastand | [Third Person Camera Rig](https://github.com/m2-md/third-person-camera-rig-threejs) onderzoeken | Camerabotsing, overgangen, camera achter pion |
| Route | Eigen routegraph/navmesh | [three-pathfinding](https://github.com/donmccurdy/three-pathfinding) | Brugtoestand bepaalt welke routes echt bereikbaar zijn |
| Scene-optimalisatie | [glTF Transform](https://gltf-transform.dev/) | [meshoptimizer](https://github.com/zeux/meshoptimizer) | Visueel vergelijken vóór en ná compressie |

### Wat niet uit een bestaand pakket zal komen
- Het verhaal, de concrete opdrachten, het verschil tussen vmbo, havo en vwo.
- De bron- en bewijsregistratie van observaties.
- Het water-, rad- en brugmodel met dezelfde berekening als de meetwaarden en animatie.
- De toestand van het eiland, keuzegevolgen, de volgorde van gebeurtenissen en bewaren/hervatten.
- De compositie van de wereld en de herkenbare regio-overgangen.
- De validatie van de onderwijskundige inhoud.

## Per bron bewaren voordat een bestand wordt gekopieerd
- Exacte pakketnaam, versie, maker, licentie-URL en datum waarop dit is gelezen.
- Welke bestanden werkelijk gewenst zijn, niet het complete pakket automatisch meenemen.
- Of het materiaal in een publiek GitHub-repository mag staan, in tegenstelling tot alleen in de gebundelde game.
- Formaat, bestandsgrootte, polygonen, textuurafmetingen, animaties en draaipunten.
- Screenshot onder gelijke camerastand en belichting, inclusief telefoon.
- Resultaat: **afgewezen / kandidaat / goedgekeurd na test**, met reden.

**Licentieknelpunt:** Quaternius biedt bruikbare voorbeelden, maar de actuele Quaternius Asset License uit augustus 2026 beperkt het zelfstandig verspreiden van assets. Sommige oudere informatie noemt CC0. Daarom staat deze bron voorlopig **niet** in de eerste importselectie, zeker niet voor losse openbare bestanden.

## De gewenste asset-bibliotheek
Onder `docs/eaigame-world/` staat het **bronregister en de ontwerpkennis**. De grote gedownloade bronbestanden komen voorlopig **niet** in `website` of `main`. Bij de eerste echte proef kan een afzonderlijke experimentele werkmap of opslagplaats worden gebruikt. Alleen de geselecteerde, geoptimaliseerde en juridisch gecontroleerde spelonderdelen komen later in de productie-website.

## Wat we vooraf wél volledig verzamelen
1. Alle verwachte onderdelen in de [complete onderdeleninventaris](./complete-onderdeleninventaris.md).
2. Meerdere bronkandidaten per zwaar of stijlgevoelig onderdeel, met directe links en licentiebeoordeling.
3. De [beeldregie](./beeldregie.md), [regiostudies](./regio-studies.svg) en [camerastudies](./camera-studies.svg) als vaste vergelijkingspunten.
4. Een controleerbare technische aanname voor ieder spelsysteem: navigatie, water, interactie, levelvragen, opslaan, mobiele prestaties.
5. Een expliciete lijst van wat nog niet te vinden is, zodat we geen gehaaste vervanging accepteren.

## Openstaande gaten na deze eerste bronronde
- Een aantoonbaar rigbaar 3D-brugmodel dat onze gewenste brugvorm heeft.
- Een aantoonbaar los geanimeerd waterrad, ketting en verstelbare sluisschuif op dezelfde schaal.
- Eenvoudige, herbruikbare wind- en watergeluidsbestanden met bewijs van de licentie.
- Een stijlpassend glazen kasgebouw en archiefinterieur.
- Bronbetrouwbare onderwijsopgaven voor de eerste drie niveaus bij de waterproef.
- Vastgelegde mobiele prestatierichtlijn op echte apparaten.
- Gedocumenteerde licenties van de daadwerkelijke geoptimaliseerde downloadbestanden.

Dit zijn **zoekopdrachten**, geen ontbrekende functies die we met willekeurige objecten moeten vullen.

## Beslisregel
Eerst **bruikbaarheid** en **stijlmatch**, dan pas import. Alleen wat aantoonbaar bij het eiland past, gaat door naar het werkende prototype. Het doel is een complete voorbereiding, niet een onnodig zware repository.
