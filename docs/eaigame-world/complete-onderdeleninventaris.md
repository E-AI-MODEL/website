# Complete onderdeleninventaris: EAIgame 2.0
**Versie 0.1 · 15 november 2026 · te verzamelen, ontwerpen en toetsen**

Het doel van deze lijst is **niets vergeten vóór het bouwen**, maar ook niet honderden ongeschikte assets downloaden. Alle onderdelen krijgen een herkomst of ontwerpkeuze, eigenaar van de uitvoering, afhankelijkheid en toets. "Geregistreerd" is niet "werkend". De bekende bronnen staan in [bronregister.json](./bronregister.json).

## Statusdefinities
- **Bron**: vindplaats onderzocht, nog niet gedownload of gevalideerd als bruikbaar bestand.
- **Maken**: EAIgame-eigen code, spelregels of 3D-werk nodig.
- **Vergelijken**: minstens twee kandidaten moeten in dezelfde proefscène worden bekeken.
- **Controleren**: bron, licentie, prestatie of inhoud moet eerst worden bevestigd.
- **Aanwezig**: in de oude EAIgame-code, maar niet automatisch geschikt voor het nieuwe spel.

## A. Een wereld die direct bestaat

| ID | Nodig | Vorm | Eerste proef | Besluit / toets |
|---|---|---|---|---|
| W01 | Wereldindeling, eilandsilhouet en hoogteverschillen | Zelf maken | Aankomst en rivierdal | Geen zichtbare randen, routes en schaal logisch |
| W02 | Terrainmeshes, kliffen, rotsen, grond en steen | 3D bron + aanpassen | Brugdal | Eén materiaalstijl; geen zeshoekig speelbord |
| W03 | Bomen, heesters, bloemen, gras, riet | Bronnen vergelijken | Kade en oever | Detail mag wegschalen op mobiel |
| W04 | Wateroppervlak, oevers en stromingsrichtingen | Effect + eigen simulatiestatus | Waterrad | Waterstroming volgt instellingen |
| W05 | Waterpartikels, schuim, waterval, regendruppels | Selectief effect | Waterrad en klif | Geen decoratieve waterval die natuurkunde tegenspreekt |
| W06 | Zon, wolken, schaduw, mist en kleurcorrectie | Belichtingsproef | Na-storm-lucht | Duidelijk beeld op telefoon; effect kan uit |
| W07 | Paden, hellingen, trappen, oversteekplaatsen | Modulaire bron + maatwerk | Kade naar brug | Navmesh werkt zonder los 'vakjessysteem' |
| W08 | Brughoofden, houten planken, balken, touwen | Bron + rig | Kapotte brug | Onderdelen kunnen correct bewegen |
| W09 | Eilandgeluiden: vogels, water, wind, ambacht | CC0 bronnen zoeken | Aankomst | Audio is optioneel; visuele equivalenten |
| W10 | Daglichtvariatie en wolkenbeweging | Zelf combineren | Aankomst | Geen onnodige real-time dag-nachtserver |
| W11 | Decor met sporen van bewoners en de storm | Bron + art direction | Steiger en werkplaats | Wereld voelt bewoond vóór spelstart |
| W12 | Verre omgeving en horizon | Bron + eenvoudige achtergrond | Alle camera's | Geen zichtbare vierkante rand of leeg vlak |

## B. De Storm: één volledig onderzoekbare opdracht

| ID | Nodig | Vorm | Eerste proef | Besluit / toets |
|---|---|---|---|---|
| S01 | Vastgelopen waterrad met as en draaipunt | Geschikt model aanpassen | Draaisnelheid | Zelfde hoek als berekende simulatiewaarde |
| S02 | Sluisschuif met veranderbare opening | 3D maatwerk | Waterinstelling | Invoer, water en meetwaarde gekoppeld |
| S03 | Peilstok, meter en afleesbare waarden | 3D + UI | Meting | Geen 'fake' meetwaarde |
| S04 | Ketting/kabel en liermechaniek | Model + rig | Brugbeweging | Ketting reageert op lier |
| S05 | Brugdeel met aanrijd- en botsingsgrenzen | Animatie + collisions | Reparatie | Route pas open bij veilige positie |
| S06 | Mechanische defecten: borgpen, lagering, slijtage | 3D maatwerk | Onderzoek | Aanwijzing zichtbaar zonder uitlegoverlay |
| S07 | Verwachting, instelling, proef, resultaat, verklaring | Eigen interactieflow | Watertest | Fout is herstelbaar en begrijpelijk |
| S08 | Werkend model van debiet, snelheid en krachten | Zelf bouwen en toetsen | Watertest | Onafhankelijke berekening en modelgrenzen |
| S09 | Drie niveauvarianten met werkelijk andere denkhandelingen | Eigen inhoud | Eén proef per niveau | Docent-/broncontrole, geen woordvariant |
| S10 | Minstens twee oplossingsroutes | Eigen verhaal en logic | Brug of omweg | Beide routes eindigen in geloofwaardige toestand |
| S11 | Veranderingen buiten het object | Eigen spelstatus | Andere bewoner reageert | Brug, kaart, NPC en route zijn consistent |
| S12 | Opslaan/hervatten na iedere betekenisvolle keuze | Eigen save | Halverwege reparatie | Na herladen precies dezelfde toestand |

## C. Personages en een bewoonde omgeving

| ID | Nodig | Vorm | Toets |
|---|---|---|---|
| P01 | Een spelerfiguur met herkenbaar silhouet | KayKit proef | Duidelijk vanuit beide camera's |
| P02 | Lopen, wachten, stoppen, draaien, aanwijzen | Animatiebron + besturing | Geen glijden bij lage framerate |
| P03 | Mare, Ada, Bo en Ise als NPC's | Bron aanpassen / enkele modellen zelf | Personen zien er verwant uit maar hebben eigen karakter |
| P04 | Dagelijkse animaties van bewoners | Selectieve clips | Praten, verplaatsen en werken zonder eindeloze loop |
| P05 | Geluid, ondertiteling en korte dialogen | Zelf schrijven; audio optioneel | Geen lang verhaalvenster of verplichte gesproken uitleg |
| P06 | Interacteerbare voorwerpen, herkenbare nabijheid | Eigen logic | Actie verschijnt alleen bij juist object |
| P07 | Aanwijzingen en terugvinden | Eigen bewijs-/bronoverzicht | Feit, hypothese en conclusie blijven apart |

## D. Vier plekken, ieder anders

| Gebied | Benodigde hoofdobjecten | Onderzoeksituatie | Blijvende verandering |
|---|---|---|---|
| Getijtuinen / Natuur | Glazen kas, terrassen, planten, kanaal, schuif, peilmeter | Waterstand en doorstroom onderzoeken | Nieuw stroompad, droge/natte terrassen |
| Haven van Vier / Wereld | Oude huizen, pont, steigers, lading, touwen, aanlegplaatsen, routekaart | Een toegankelijke oversteek kiezen met broninformatie en belangen | Andere pont- of looproute, zichtbaar verkeer |
| Echoarchief / Taal | Archiefgebouw, kasten, tafel, kaarten, documenten, schaalverdeling | Tegenstrijdige instructies en herkomst controleren | Juiste instructie gekoppeld aan machine |
| Tandradkliffen / Rekenen | Raderen, gewichten, katrollen, lier, meetinstrumenten, brug | Verhouding, kracht en belasting voorspellen en testen | Veilige machine-instelling en een bereikbare route |

**Specifiek zoeken** naar bruikbare waterpompen, glazen kassen, waterraderen, lieren, houten bruggen, boten, oude kadehuizen en leesbare kaarten. Ze staan niet automatisch allemaal in de huidige assetcatalogus. Ontbrekende objecten krijgen een gerichte zoekopdracht, geen willekeurige vervanging.

## E. Herkenbare, rustige bediening

| ID | Nodig | Bron of bouw | Toets |
|---|---|---|---|
| U01 | Kleine doelindicatie linksboven | Eigen UI | In één zin begrijpelijk |
| U02 | Kaart met werkelijk bereikbare routes | Eigen UI + navmesh | Kaart en wereld zijn identiek |
| U03 | Een contextactie naast het object | Eigen UI + eventueel Kenney | Met muis, toetsenbord en aanraking |
| U04 | Dialoogpaneel dat de wereld niet blokkeert | Eigen UI | Snel te verlaten, tekst leesbaar |
| U05 | Meet- en schuifbediening direct bij de proef | Eigen UI | Waarden en 3D volgen dezelfde toestand |
| U06 | Volgcamera, vrije draai, overzicht, reset | Three.js | Geen camera in objecten, mobiel bruikbaar |
| U07 | Duidelijke tekst en iconen zonder kleurafhankelijkheid | Bestaande iconen aanpassen | Contrast en leesbaarheid in vier gebieden |
| U08 | Pauze, geluid uit, rustig beeld, minder beweging | Eigen instellingen | Werkt in alle spelfasen |
| U09 | Telefoonbediening met duimzone en context | Eigen responsive UI | Geen knoppenstapel over spelbeeld |
| U10 | Opslaan, doorgaan, stoppen en verhaaloverzicht | Eigen UI | Nooit onduidelijk of voortgang bewaard is |
| U11 | Vrijwillige hint en uitleg ná de handeling | Eigen onderwijs-UI | Geen verstopping van de wereld door lappen tekst |

## F. Spelregels en technische systemen

| ID | Nodig | Aanpak | Toets |
|---|---|---|---|
| T01 | Deterministische toestand en wereldseed | Zelf | Zelfde seed + zelfde acties = zelfde toestand |
| T02 | Versieerbare wereldopslag en gebeurtenislog | Zelf, lokaal beginnen | Herladen werkt zonder historie te verliezen |
| T03 | Geografisch juiste routes en nabije objecten | Bestaande pathfinding evalueren | Brug open/dicht verandert navmesh correct |
| T04 | Inputmodel voor muis, toetsenbord en aanraking | Zelf op Three.js | Eén logica, drie invoermethoden |
| T05 | Botsing, interactiebereik en camerabeperking | Eenvoudige geometrie; fysica alleen indien nodig | Door muren lopen of klikdoorval onmogelijk |
| T06 | Animaties die afgeleide waarden weergeven | Three.js AnimationMixer | Geen losse decoranimatie |
| T07 | Staat van vragen, doelen en uitleg per schoolniveau | Eigen inhoud + controles | 3 niveaus met andere denkhandeling |
| T08 | Sceneregelaar en gevolgen voor bewoners | Zelf | Dialoog en kaart passen bij eerder besluit |
| T09 | Onderzoeksvragen los van taalmodel-output | Redactionele bank + gevalideerde configuraties | Geen oncontroleerbare AI-vragen in vrijgave |
| T10 | Import/export en terugval bij foutieve opslag | Zelf | Niet stilzwijgend een spel kwijt |
| T11 | Dataset met bron, curriculumversie en reviewstatus | Zelf | Beweer geen SLO-koppeling zonder controle |
| T12 | Foutafhandeling WebGL, offline of langzaam toestel | Zelf | Terugval werkt zonder verlies van voortgang |
| T13 | On-demand laden, optimalisatie, aantal drawcalls | glTF tooling + renderprofiling | Meten, niet gokken |
| T14 | Licentieprovenance per gebruikt bestand | Manifest | Herkomst en gebruiksrechten controleerbaar |
| T15 | Integratie in bestaande site, zonder hoofdmenu-overload | Apart prototype | PR #277 niet beschadigen |
| T16 | Analytische events uitsluitend op noodzakelijk/AVG-passend niveau | Apart besluit | Geen verzameling van leerlingprofielen of leerresultaten |

## G. Proeven en definitie van 'klaar'

| Test | Bewijs vóór vrijgave |
|---|---|
| Visuele kwaliteit | Drie echte browserbeelden van dezelfde scène plus vergelijking met goedgekeurde stijl |
| Interactieketen | Aanraken → voorspellen → instellen → meten → gevolg in wereld → hervatten |
| Schoolniveau | 3 inhoudelijke opdrachten, elk met eigen handelingen, gecontroleerde uitkomst en feedback |
| Natuurkunde | Onafhankelijke berekening plus grensgevallen, grafiek, water en rad gekoppeld |
| Regels | Geen onbereikbare eindtoestand; brug openen sluit niemand zonder verhaalreden op |
| Camerastand | Speler ziet route en object, ook bij draaiing en op kleine schermen |
| Prestatie | FPS, geheugengebruik, laadtijd, bestandsomvang en mobiele hardware meten |
| Toegankelijkheid | Tekst, kleurcontrast, minder beweging, geen verplicht geluid, toetsenbord-/aanraakalternatief |
| Regresstest | Oude EAIgame en website onveranderd, geen ongevraagde publicatie |
| Bewijsvoering | Testscripts, screenshots, license-/assetmanifest en exacte commit-SHA in PR |

## Aanpak verzamelen
**Vooraf registreren:** alle vermoedelijk benodigde onderdelen, bijpassende bronnen, licenties, voorbeelden, beslispunten en risico's. **Bij eerste proef selecteren:** één set spelers, objecten en materialen die werkelijk bij elkaar passen. **Pas na de visuele en technische test downloaden/importeren:** uitgekozen productie-assets. Geen mega-ZIP met honderden overbodige varianten in de openbare site-repository.

Deze inventaris is volledig genoeg om gerichte zoekopdrachten uit te zetten. Hij is **niet** de claim dat ieder benodigd model al gevonden, beoordeeld of gedownload is. Nieuwe afhankelijkheden worden hier toegevoegd wanneer ze uit een echte spelproef blijken.
