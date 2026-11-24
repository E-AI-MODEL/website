# LLM Observatorium: leerroute en storyboard

**Status:** fase 1 vastgesteld; negen interactieve leerstappen en kleine berekeningen gebouwd op concept-PR #297. Automatische introductie en interactieve leerroute delen nu dezelfde negen stapdefinities en kleine berekeningen. De technische 3D-verdieping blijft apart beschikbaar.  
**Datum:** 17 november 2026  
**Repository:** E-AI-MODEL/website  
**Bestaande URL:** /tools/llm-observatorium/  
**Werkbranch:** improve-llm-learning-journey-20261117, concept-PR #297

## Opdracht

De bezoeker voert een zin in, ziet hoe die in tokens uiteenvalt en volgt vervolgens hoe een taalmodel op basis van tekst telkens een nieuw token berekent. De website legt uit **waarom** iedere stap nodig is, niet alleen hoe het model eruitziet.

De bestaande EAI-vormgeving, 3D-omgeving, navigatie en onderzoeksfuncties blijven herkenbaar. De begeleide route krijgt voorrang. De technische weergave is een verdieping, geen drempel voor de eerste bezoeker.

Deze pagina is de bron voor de inhoud, het gedrag en de illustraties. De automatische introductie en de begeleide route volgen inmiddels dezelfde negen inhoudelijke stappen. Het is niet de bedoeling om negen losse pagina's of een tweede website te maken.

## Niet onderhandelbaar

- **Gratis voor iedereen:** geen betaalde API-aanroepen, GPU-server of andere kosten die door gewone bezoekers worden veroorzaakt. Gratis hosting en gratis ontwikkelmiddelen hebben wel grenzen; gebruik die binnen hun beschikbare quota. Geen stilzwijgende overstap naar betaalde middelen.
- **Snel op elk scherm:** de eerste illustratie moet zichtbaar zijn zonder het downloaden van een groot taalmodel. De basis blijft bruikbaar op telefoon, tablet en desktop. Browserondersteuning en prestaties worden getest, niet beloofd zonder meting.
- **Echte gegevens krijgen voorrang:** toon een gemeten of berekende waarde waar dat kan. Teken nooit verzonnen routeractivaties of kansen alsof ze uit gpt-oss komen.
- **Eenvoudige taal:** geen woord als embedding, router of attention voordat de bezoeker heeft gezien wat het doet. De technische naam mag daarna in een korte verdieping staan.
- **Oorzaak en gevolg:** de bezoeker verandert iets en ziet een concreet verschil. Een lichtpunt dat zonder uitleg verschuift is geen afgeronde leerstap.
- **Eén herkenbare EAI-stijl:** behoud de donkerblauwe basis, turquoise/groene accenten, het warme goud voor selectie, grote visuals, rustige beweging, bestaande bediening en 3D als aanvullende onderzoeksvorm.
- **Bron en beperking naast de illustratie:** geen onduidelijk voetnootje. Maak zichtbaar of iets een echte berekening, openbaar modelgegeven, opgeslagen modelmeting of rekenvoorbeeld is.
- **Geen verplichte toetsen of lange inleidingen:** de bezoeker leert door te kijken, te veranderen en te vergelijken. Eventuele controlevragen zijn klein en optioneel.

## Wat moet iemand na afloop kunnen uitleggen?

Een bezoeker die niets van taalmodellen weet, kan in eigen woorden vertellen:

1. waarom een zin eerst in tokens wordt verdeeld;
2. waarom het tokennummer op zichzelf nog geen betekenisvolle berekening is;
3. waarom volgorde en eerder geschreven tekst het volgende token beïnvloeden;
4. waarom een model steeds opnieuw met lange rijen getallen rekent;
5. waarom bij gpt-oss slechts vier experts uit een grotere verzameling meerekenen;
6. hoe mogelijke vervolgtokens worden gerangschikt en gekozen;
7. waarom het antwoord token voor token ontstaat en toch onjuist kan zijn;
8. welke delen van het observatorium echt zijn en welke alleen iets voordoen.

Beoordeling: laat leerlingen en docenten na de route zonder hulp uitleggen hoe het antwoord groeit. Het aantal aangeklikte knoppen of de schoonheid van de visualisatie is geen bewijs dat iemand het heeft begrepen.

## Eén invoer, één verhaal, zonder schijnzekerheid

**Standaardzin:** “Waarom is de lucht blauw?” De bezoeker mag zijn eigen zin invoeren. Dezelfde gekozen tekst en hetzelfde gekozen token blijven zichtbaar tijdens de uitleg, zolang de onderliggende gegevens dat toestaan.

Er zijn drie soorten continuïteit:

- **Echte eigen invoer:** tokenizeer exact wat de bezoeker heeft getypt, toon de echte token-ID's en gebruik diezelfde tokenvolgorde voor uitleg over eerdere en latere posities.
- **Correct uitgerekend klein voorbeeld:** laat bijvoorbeeld op een kleine matrix zien hoe een gewogen combinatie of kansverdeling werkt. Die berekening is echt, maar het is geen interne berekening van gpt-oss. Toon dat onderscheid in hetzelfde beeld.
- **Vooraf opgenomen modeluitvoering:** de route mag die alleen aan de eigen vraag koppelen als exact die vraag door dat model is verwerkt. Bij een andere gebruikerszin moet zichtbaar zijn dat we overschakelen naar een voorbeeldzin of naar een los rekenexperiment.

**Verboden:** gegenereerde demonstratiescores een-op-een koppelen aan de gekozen echte token-ID's alsof dat echte modelactivaties oplevert. Een vast vooraf geschreven antwoord mag niet als voorspelling voor de eigen vraag worden gepresenteerd.

## Negen inhoudelijke stappen

| Nr. | Zichtbare titel | Wat de bezoeker doet en ziet | Wat hij begrijpt | Gegevens |
| --- | --- | --- | --- | --- |
| 1 | Je stelt een vraag | Typ een zin; zie dezelfde zin de hele route terugkomen | Een taalmodel krijgt tekst om een volgend stukje te berekenen | Echte eigen tekst |
| 2 | Je zin valt uiteen | Tik op een token en bekijk het echte tokennummer | Woorden en tokens zijn niet hetzelfde | Echte o200k_harmony-tokenizer of gemarkeerde fallback |
| 3 | Een nummer wordt een rij getallen | Volg tokennummer naar een getallenrij | Het model rekent met getallen, niet met tokennummers als betekenissen | Schema; echte vector alleen als beschikbaar |
| 4 | De volgorde maakt verschil | Vergelijk twee zinnen met verwisselde woorden | De plek van een token beïnvloedt wat het model kan berekenen | Correct positievoorbeeld; geen verzonnen gpt-oss-vector |
| 5 | Eerdere tekst telt mee | Kies een token; bekijk bereik en, indien aanwezig, echte gewichten | Niet alle eerdere tokens dragen op dezelfde manier bij | Bereik volgens architectuur; gewichten alleen als gemeten |
| 6 | Vier rekennetwerken worden gekozen | Vergelijk vier geselecteerde experts met de andere experts | De router laat niet alle experts meerekenen | Echt aantal; routes alleen als meting of expliciet voorbeeld |
| 7 | De getallen veranderen per laag | Schakel tussen opeenvolgende lagen en zie het resultaat van een berekening | Iedere laag bouwt voort op de vorige; lagen zijn geen vaste betekeniscategorieën | Echte architectuur + rekenvoorbeeld of trace |
| 8 | Welk stukje komt hierna? | Verander variatie; bekijk hoe kansen veranderen | Het model berekent meerdere mogelijke vervolgen | Echte kansrekening op voorbeeldscores, tenzij logits gemeten |
| 9 | Het antwoord groeit | Laat één token toevoegen en start de berekening opnieuw | Een antwoord ontstaat niet in één keer | Echte tokenreeks uit trace of helder gemarkeerde demonstratie |

De route toont bij de eerste stap ook kort het verschil tussen **leren tijdens training** en **tekst verwerken tijdens gebruik**. Het model verandert niet bij iedere beantwoorde vraag automatisch zijn aangeleerde gewichten. Dit is geen tiende verplicht scherm, maar een optionele verdieping.

## Storyboard per stap

### 1. Je stelt een vraag

**Tekst op het scherm:** “Typ een vraag. We volgen hoe een taalmodel die tekst gebruikt om een antwoord te maken.”

**Illustratie:** één groot invoerveld. De tekst beweegt naar de eerste verwerkingsstap. Geen complexe 3D-wereld achter de invoer.

**Handeling:** de bezoeker typt of kiest de voorbeeldzin. De invoer blijft bewaard bij het wisselen van stappen.

**Zichtbaar verschil:** de volgende stap gebruikt precies dezelfde tekst. De bezoeker hoeft zijn zin niet opnieuw in te voeren.

**Waarom dit gebeurt:** het model kan pas iets aanvullen als er tekst is waarop het zijn berekening kan baseren.

**Herkomst:** echte tekst die lokaal in de browser is ingevoerd. Niet beweren dat een AI-server die vraag heeft verwerkt.

**Door naar:** “Bekijk hoe je zin wordt verdeeld.”

### 2. Je zin valt uiteen

**Tekst op het scherm:** “Een taalmodel gebruikt geen hele zinnen als één blok. Het verdeelt tekst in kleine stukjes. Zo'n stukje heet een token.”

**Illustratie:** de ingevoerde zin valt uiteen in de werkelijk teruggegeven tokens; zichtbaar blijft waar spaties en leestekens zitten. Ieder token heeft bij selectie een echt ID.

**Handeling:** kies een token. Kies daarna een ander woorddeel of leesteken. Zie dat een woord uit meerdere tokens kan bestaan.

**Zichtbaar verschil:** selectie en ID veranderen; het aantal tokens wordt getoond.

**Waarom dit gebeurt:** het model gebruikt token-ID's als verwijzingen naar onderdelen van zijn woordenlijst.

**Herkomst:** gpt-tokenizer 4.1.0 met o200k_harmony. Tijdens laden staat er “Tokenizer laden”; bij falen “Woordvoorbeeld, geen echte token-ID's”. Een fallback mag geen groen label “echte berekening” krijgen.

**Door naar:** “Wat doet het model met zo'n nummer?”

### 3. Een nummer wordt een rij getallen

**Tekst op het scherm:** “Het nummer vertelt welk stukje tekst dit is. Bij dat nummer hoort in het model een lange rij getallen. Daarmee kan het rekenen.”

**Illustratie:** het geselecteerde tokennummer links, een rij getallen in het midden, een eenvoudige berekening rechts. Het beeld toont niet willekeurig veranderende getallen die als echte gpt-oss-activaties worden gelezen.

**Handeling:** wissel het gekozen token. Bekijk wat het begrip “andere token, andere getallenrij” betekent. Bij een miniatuurvoorbeeld mogen concrete rijen verschijnen, duidelijk gelabeld als voorbeeld.

**Zichtbaar verschil:** de token-ID verandert; bij een gemeten embedding kan ook de echte rij veranderen. Zonder beschikbare waarden blijft het blok een schema.

**Waarom dit gebeurt:** met losse identificatienummers kan het model geen nuttige verbanden tussen tokenposities uitrekenen.

**Herkomst:** de token-ID is echt; eventuele ingevulde modelvectoren worden pas als echt aangeduid als ze daadwerkelijk zijn uitgelezen. “Embedding” is alleen een technische verdieping.

**Door naar:** “Waarom maakt de volgorde uit?”

### 4. De volgorde maakt verschil

**Tekst op het scherm:** “De man bijt de hond” en “De hond bijt de man” gebruiken grotendeels dezelfde woorden. Toch verandert wat de zin betekent.

**Illustratie:** twee rijen met verwisselde tokenposities. Markeer de positie van hetzelfde token in beide zinnen en toon waar positie-informatie bij attention meespeelt.

**Handeling:** wissel de volgorde. De labels van de posities bewegen mee.

**Zichtbaar verschil:** dezelfde token-ID kan op een andere positie staan. De tokenlijst alleen zegt nog niet alles over de zin.

**Waarom dit gebeurt:** een taalmodel moet verschil kunnen maken tussen dezelfde woorden in een andere volgorde.

**Herkomst:** de tokenposities zijn echt. Bij gpt-oss wordt positie-informatie in attention gebruikt (RoPE); zeg niet dat simpelweg een positienummer bij elk token-ID wordt opgeteld.

**Door naar:** “Welke woorden kan het model erbij gebruiken?”

### 5. Eerdere tekst telt mee

**Tekst op het scherm:** “Voor het volgende stukje gebruikt het model ook de tekst die ervoor staat. Niet iedere laag kan direct even ver terugkijken.”

**Illustratie:** laat bij een gekozen token de eerdere posities oplichten. Twee verschillende weergaven blijven duidelijk: **bereikbaar** en **berekend gewicht**. Een bereikstrook is geen attention-heatmap.

**Handeling:** selecteer een andere tokenpositie of wissel van laag. Zie welke eerdere posities rechtstreeks bereikbaar zijn.

**Zichtbaar verschil:** de bereikbare posities veranderen. Alleen bij echte attention-metingen verschijnen gewichten en bijbehorende head- of laagkeuze.

**Waarom dit gebeurt:** het model kan het volgende token beter berekenen wanneer het de eerdere tekst meeweegt.

**Herkomst:** bereik volgens het gekozen gpt-oss-configuratievoorbeeld. Geen gemeten attention-gewichten in de huidige website. “Attention” mag als technische term worden uitgelegd nadat de illustratie is getoond.

**Door naar:** “Welke rekennetwerken doen mee?”

### 6. Vier rekennetwerken worden gekozen

**Tekst op het scherm:** “Bij gpt-oss staan veel kleine rekennetwerken klaar. Voor ieder token kiest de router er vier om mee te rekenen.”

**Illustratie:** een overzicht van 32 experts voor gpt-oss-20b of 128 experts voor gpt-oss-120b. Laat vier experts oplichten, daarna hun bijdragen samenkomen. Het rooster stelt geen echte ruimtelijke positie voor.

**Handeling:** selecteer een ander token of een andere laag en bekijk de keuze. Alleen met echte routermetingen mogen de vier geselecteerde experts als werkelijke keuze worden gepresenteerd.

**Zichtbaar verschil:** vier van de 32 of 128 experts zijn gemarkeerd. Bij een miniatuurrouter veranderen de voorbeeldscores correct volgens de uitgevoerde berekening.

**Waarom dit gebeurt:** niet alle beschikbare experts hoeven bij elk token mee te rekenen.

**Herkomst:** architectuuraantallen zijn echte openbare gegevens. De huidige functie voor routerkeuze produceert rekenvoorbeelden, geen modelactivaties. “Expert” betekent hier een klein rekennetwerk, geen mens of onderwerp-specialist.

**Door naar:** “Waarom gebeurt dit in meerdere lagen?”

### 7. De getallen veranderen per laag

**Tekst op het scherm:** “Eén laag is niet genoeg. Iedere laag rekent verder met de getallen uit de vorige laag. Daardoor kan het model ingewikkelde patronen in de tekst verwerken.”

**Illustratie:** zoom eerst in op **één** laag: de binnenkomende getallen, een bijdrage van eerdere tekst, een bijdrage van rekennetwerken, de nieuwe getallen. Zoom daarna uit naar 24 of 36 opeenvolgende lagen.

**Handeling:** bekijk één laag stap voor stap; pas daarna kies je een volgende laag. Op mobiel één paneel tegelijk, op desktop eventueel een 3D-overzicht ernaast.

**Zichtbaar verschil:** een controleerbaar klein rekenvoorbeeld toont welk getal door welke bewerking verandert. Bij echte activatietraces tonen we de werkelijk berekende verschillen.

**Waarom dit gebeurt:** iedere laag bouwt voort op eerdere berekeningen. Niet zeggen dat laag 1 woorden leert en laag 2 feiten of dat een latere laag automatisch meer “begrip” heeft.

**Herkomst:** echte laag- en expertconfiguratie; demo-getallen blijven demo-getallen.

**Door naar:** “Hoe kiest het model het volgende token?”

### 8. Welk stukje komt hierna?

**Tekst op het scherm:** “Het model vergelijkt veel mogelijke vervolgen. Sommige krijgen een hogere score dan andere.”

**Illustratie:** balken met mogelijke vervolgtokens. Verander de temperatuur; laat de kansen zichtbaar en correct verschuiven. Top-p verschijnt alleen in een optionele verdieping.

**Handeling:** verander de variatie en vergelijk de balken. Probeer eventueel meerdere keren een token te kiezen uit dezelfde verdeling.

**Zichtbaar verschil:** de totale kans blijft ongeveer 100%; bij hogere temperatuur wordt de verdeling in dit voorbeeld vlakker. De hoogst scorende kandidaat hoeft niet altijd te worden gekozen.

**Waarom dit gebeurt:** het model kiest een volgend token uit meerdere mogelijkheden, niet meteen een hele voltooide zin.

**Herkomst:** correcte wiskundige berekening met voorbeeldscores. Pas werkelijke logits of topkansen van een model als “echt modelantwoord” aanmerken als die daadwerkelijk beschikbaar zijn.

**Door naar:** “Hoe wordt dat een antwoord?”

### 9. Het antwoord groeit

**Tekst op het scherm:** “Er komt één token bij. Nu berekent het model opnieuw welk token daarop kan volgen. Zo groeit de tekst.”

**Illustratie:** toon afzonderlijke tokens, inclusief de mogelijkheid dat een woord uit meerdere tokens bestaat. Laat het nieuwe token terugkeren in de context voor de volgende keuze. De gebruiker kan pauzeren, terugspoelen en de hele route kort terugzien.

**Handeling:** kies “Volgend token”, “Opnieuw” of “Bekijk de hele route”.

**Zichtbaar verschil:** per klik wordt precies één token toegevoegd aan de tekstweergave, niet ongemerkt een hele zinshelft.

**Waarom dit gebeurt:** een taalmodel produceert tekst stap voor stap. Waarschijnlijke tekst is niet altijd feitelijk juiste tekst.

**Herkomst:** opgeslagen echte modeltrace met getoonde bron, of een expliciet voorbeeld. De huidige vooraf geschreven zinsdelen voldoen nog niet aan dit token-voor-tokenontwerp.

**Afronding:** toon de oorspronkelijke vraag en een compacte terugblik op alle negen stappen. Daarna kan de bezoeker naar de bestaande technische onderzoeksomgeving gaan.

## Hoe de drie bestaande weergaven samenwerken

De huidige code heeft:
1. **Automatische introductie:** modelStory en STORY_PHASES, negen animatiefasen gebaseerd op GUIDE_STEPS.
2. **Begeleide route:** aiGuide en GUIDE_STEPS, op de werkbranch negen interactieve stappen.
3. **Technisch onderzoek:** MODES met zeven onderzoeksmodi en de 3D-weergave.

De negen stappen hierboven vormen de inhoudelijke volgorde. De automatische animatie en de begeleide route delen nu GUIDE_STEPS als bron voor titels, namen en uitleg. De kleine illustraties worden nog afzonderlijk gerenderd, zodat het formaat past bij automatisch bekijken of actief onderzoeken. De zeven technische modi blijven zelfstandig bereikbaar en worden per stap als verdieping gekoppeld.

**Niet doen:** twee los bijgehouden lijsten met tegenstrijdige uitleg, dubbele navigatie, een tweede vormgeving of een extra verplicht keuzemenu bij het openen.

### Waar zit de bestaande code?

| Bestand of functie | Rol en verwachte wijziging |
| --- | --- |
| content/llm-observatorium/index.html | Huidige bron van HTML, CSS en JavaScript |
| tools/llm-observatorium/index.html | Publieke kopie; byte-identiek houden aan de bron |
| GUIDE_STEPS / guideRender | De gedeelde definitie van negen stappen en hun interactieve weergaven |
| STORY_PHASES / storyPaint | Leid de animatiefasen af uit GUIDE_STEPS; negen visuele scènes met dezelfde lokale rekenmodule |
| tokenizeInput / loadRealTokenizer | Echte tokenizer behouden, laadstatus en fallback expliciet houden |
| chooseRoute / logits | Rekenvoorbeelden herkenbaar houden, nooit als echte gpt-oss-uitvoer labelen |
| drawAttention / drawExpertsGrid | Bereik en voorbeeldkeuzes duidelijk onderscheiden van echte modelmetingen |
| tests/test_llm_observatorium_source.py | Bron-, synchronisatie- en bewijsgrenscontroles |
| scripts/test_llm_observatorium.mjs | Browserproeven voor interactie, verhaal en verschillende schermen |

## Visueel ontwerp en taal

- Bestaande EAI-kleuren en typografie behouden; eerst verbeteren binnen de huidige CSS-variabelen en componenten.
- Een gekozen token blijft **goud**, eerdere of beschikbare tekst behoudt **groen/turquoise**, de achtergrond blijft donker. Kleuren zijn nooit de enige informatie: gebruik ook tekst of patronen.
- De eerste weergave toont telkens één concrete handeling met een groot beeld. Korte uitleg staat direct naast het relevante onderdeel, niet in lange tekstblokken onder de visualisatie.
- Geen alomvattende 3D-animatie bij het eerste laden. 3D is beschikbaar voor onderzoek en kan later worden geactiveerd.
- Woorden als “representatie”, “transformer”, “embedding”, “router”, “activatie” en “causale attention” staan niet zonder directe uitleg in de beginnersroute.
- De tekst zegt concreet **wat verandert**: “De vier gekozen rekennetwerken lichten op”, niet “de AI verwerkt informatie in een complex systeem”.
- Vermijd misleidende causale claims: een voorbeeldroute is geen waargenomen denkproces; een aandachtsscore bewijst niet waarom het model een uitspraak doet.
- De bezoeker mag zelf vooruit, terug en opnieuw. Animaties zijn pauzeerbaar en respecteren verminderde beweging.

## Gegevenslabels

De interface kent vier duidelijk onderscheidbare soorten informatie:

| Label bij het beeld | Betekenis | Voorbeeld |
| --- | --- | --- |
| **Echte berekening** | Deze browser berekent iets werkelijk uit de gekozen invoer of waarden | Tokenisatie, kansrekening op expliciet getoonde voorbeeldscores |
| **Openbare modelgegevens** | Een eigenschap uit een gepubliceerde modelconfiguratie | Aantal lagen of experts |
| **Gemeten modeluitvoer** | Waarde uit een aantoonbaar uitgevoerde modelrun, met model en invoer | Geselecteerde routerwaarden of logits uit een opgeslagen trace |
| **Rekenvoorbeeld / schema** | Een vereenvoudiging om een principe te laten zien | Getekende tokenroute, fictieve expertscores |

**Regel:** “Echte berekening” mag nooit stilzwijgend worden gelezen als “echt door gpt-oss berekend”. Een kansberekening over verzonnen scores moet tegelijk de aanduiding “voorbeeldscores” krijgen.

## Echte modelmetingen, vanaf de huidige werkbranch

De oorspronkelijke gpt-oss-illustraties tonen openbare modelafmetingen en controleerbare minivoorbeelden. Daarnaast is nu één afzonderlijke **echte modelmeting** beschikbaar, volledig zonder extra kosten voor bezoekers.

- Getraind model: [EphAsad/IllaryiaStories-1M](https://huggingface.co/EphAsad/IllaryiaStories-1M), acht lagen, 16 attention-heads, GPT-Neo, MIT-licentie.
- Vast bronmodel: revisie `20baf4ebd7123dac70aeba0d6fa1e1671afa64f9`; het JSON-bestand bevat de SHA-256 van de safetensors-gewichten.
- Vaste tekst: `Once upon a time,` (Engels). Vier echte tokenvoorspellingen vormen ` there was a little`.
- Gemeten gegevens: token-ID's, een deel van de token- en positiegetallen, aandachtgewichten van één head, acht lagen en de volgende-tokenkansen.
- **Dit model gebruikt geen experts en niet de gpt-oss-tokenizer.** Het maakt geen modeluitvoer voor de vraag die de bezoeker heeft ingevoerd.
- Het meetbestand `assets/llm-real-trace.json` is ongeveer 21 KB. Het wordt alleen na een bewuste klik vanaf dezelfde website geladen.
- Alleen het **handmatig te starten** GitHub-workflow `llm-real-trace.yml` voert het getrainde model opnieuw uit; de reguliere tests controleren het reeds opgenomen bestand zonder gewichten te downloaden.

Toon nooit een aandachtgewicht als reden waarom het model een bepaalde uitspraak doet. De lengte of grootte van een vector bewijst evenmin dat het model meer begrijpt.

## Gratis en snel: concrete uitvoeringseisen

- Geen API-sleutels in de frontend, geen betaalde inferentie per bezoeker, geen verplicht account.
- Statische bestanden en lokale JavaScript-berekeningen als basis; zware modellen worden niet automatisch gedownload.
- Echte tokenizer pas laden als nodig, met duidelijke laadstatus. Onderzoek of we de dependency lokaal kunnen hosten of betrouwbaar cachen, zodat een externe CDN-storing de leerroute niet blokkeert. De huidige decoderingsfallback blijft expliciet.
- Toon onmiddellijk een bruikbare eerste illustratie; laad technische 3D-onderdelen alleen wanneer ze nodig zijn.
- Richtwaarden voor testen (geen vooraf bewezen garanties): eerste bruikbare scherm binnen circa 2,5 seconden op een representatieve middelklasse-telefoon en 4G-profiel; direct zichtbare feedback op een tik; geen geblokkeerde bediening tijdens achtergrondladen.
- Bij een traag apparaat: eenvoudige 2D-weergave in plaats van verplichte zware animatie. Alle inhoud blijft bereikbaar met toetsenbord en touch.
- Controleer op 320, 390, 768, 1280 en 1440 px breed en ook op korte schermhoogten. Geen horizontale scroll, afgekapt navigatieknopje of tekst die buiten het scherm valt.
- Test de werkelijke laadtijd, browsergeheugen en fouten op apparaten of een bruikbare benadering; ga niet uit van prestaties op basis van alleen code-inspectie.
- Kosten van het **vooraf produceren** van meetbestanden zijn eveneens een randvoorwaarde. Gebruik alleen beschikbare gratis quota en documenteer eventuele beperkingen.

## Acceptatie: wanneer is fase 1 afgerond?

Dit ontwerp mag als **inhoudelijk vastgesteld** worden beschouwd als:

- [x] de gehele route van vraag tot herhaald genereren is beschreven;
- [x] per stap zichtbaar staat wat de bezoeker doet, wat verandert, waarom, en wat de gegevensbron is;
- [x] de bestaande code en drie weergaven op de route zijn afgebeeld;
- [x] de technische grenzen, begrijpelijkheid, gratis gebruik, stijl en mobiele vereisten zijn vastgelegd;
- [x] de hiaten in de huidige implementatie expliciet zijn benoemd.

**Werkstatus:** de negen stappen zijn inmiddels in de interactieve gids gebouwd, inclusief echte lokale minivoorbeeldberekeningen. De automatische animatie volgt inmiddels dezelfde negen stappen; echte gpt-oss-router- en attention-activaties zijn niet beschikbaar. De prestaties op fysieke apparaten en de leeropbrengst zijn nog niet getoetst.

## Afbakening van de volgende fases

**Fase 2: gegevens en berekeningen.** De echte tokenisatie is behouden en de kleine wiskundig correcte voorbeelden voor attention, top-4-routerkeuze en rekenlagen zijn inmiddels gebouwd in `assets/llm-learning-math.js`. Inventariseer of echte modeltraces gratis vooraf kunnen worden gemaakt; beloof niet dat ze bestaan voordat ze geleverd zijn. Scheid brongegevens, voorbeelduitvoer en schema's.

**Fase 3: illustraties en interactie.** De begeleide route bevat nu tokennummer → voorbeeldgetallen → attention → experts → laag → volgende-tokenkansen → tokengewijze voorbeeldtekst. De exacte visuele leesbaarheid wordt in CI en op screenshots gecontroleerd. Ontwerp daarna de overige stappen. Iedere visualisatie verklaart een zichtbare verandering.

**Fase 4: één ervaring.** Story en guide volgen dezelfde negen stappen; via 'Stap voor stap' behoudt de bezoeker de gekozen fase en na het laatste scherm gaat hij naar de bestaande 3D-verdieping. Test de bediening en begrijpelijkheid verder. Houd de zeven onderzoeksmodi beschikbaar als verdieping.

**Fase 5: gecontroleerde publicatie.** Tests op mobiel, tablet en desktop, wiskundige controles, performance, toegankelijkheid en een korte begripstest met nieuwe gebruikers. Pas na geslaagde controles publiceren.

## Bronnen voor wat nu al in de code zit

- OpenAI gpt-oss modelconfiguraties: https://huggingface.co/openai/gpt-oss-20b/blob/main/config.json en https://huggingface.co/openai/gpt-oss-120b/blob/main/config.json
- In de huidige website gebruikte tokenizer: gpt-tokenizer@4.1.0, o200k_harmony, geladen via jsDelivr
- Bestaande code en tests uit E-AI-MODEL/website
- Dit document schrijft een leerroute voor; het is geen bewijs van echte activaties of leerresultaten.
