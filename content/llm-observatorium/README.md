# LLM Observatorium, interactieve 3D-proef

> **Ontwerp voor de herziening:** [LEERROUTE-ONTWERP.md](LEERROUTE-ONTWERP.md). Dit document beschrijft de negen stappen, de illustraties, de gegevensbronnen, gratis gebruik en de eisen voor mobiel. De huidige applicatie is nog niet volledig volgens dit storyboard ingericht.

Deze zelfstandige HTML is een herbouw van het eerdere LLM-prototype. Het oorspronkelijke Galactisch Observatorium diende als referentie voor een grote, vrij bestuurbare 3D-wereld, zeven onderzoeksmodes, gekoppelde grafieken en een inspector. De oude visual met concentrische ringen is vervangen door een schematische reeks modellagen. Dit project wijzigt de Melkwegbron niet.

Open `index.html` in een browser. Voor echte tokenisatie laadt de pagina eenmaal `gpt-tokenizer@4.1.0` via jsDelivr. Er is geen account of modelsleutel nodig. Zonder netwerkverbinding blijft de voorbeeldweergave werken, maar zie je geen echte token-ID's.

## Leerroute van negen stappen (concept-PR #297)

De interactieve beginnersroute behandelt achtereenvolgens: **jouw vraag, echte tokens, getallen, volgorde, eerdere tekst, experts, rekenlagen, volgend token en het antwoord**.

De huidige interactieve versie rekent in de browser met een **klein, deterministisch viergetallenvoorbeeld**. Hiermee laten we echt berekende attention-gewichten, top-4-routerkeuzes en veranderingen per voorbeeldlaag zien. Het is geen echte gpt-oss-activatie en het maakt geen eigen modelantwoord. De tokenizer `o200k_harmony` blijft wel echt; zijn tokennummers worden gebruikt als invoer voor het minivoorbeeld. Zonder tokenizer blijft de fallback expliciet.

De zelfstandige rekenmodule is `assets/llm-learning-math.js`. De wiskunde wordt gecontroleerd met `node scripts/test_llm_learning_math.mjs` en de leerroute met Chromium- en WebKit-tests. Berekeningen vragen geen account, API-sleutel, betaalde inferentie of groot model in de browser. De gewone websitehosting en beschikbare CI-quota blijven van toepassing.

**Gebouwd:** de automatische introductie en de begeleide route hebben nu dezelfde negen stappen en delen hun titels en uitleggegevens. De animatie gebruikt dezelfde lokale berekeningen als de gids. Er zijn nog geen echte gpt-oss-routeractivaties, attentiongewichten of logits ingelezen. Laadtijden op fysieke telefoons en aantoonbaar leerresultaat zijn nog niet gevalideerd. De PR mag pas gepubliceerd worden nadat alle tests slagen en de beelden zijn beoordeeld.

**Van leren naar onderzoeken:** de knop rechtsboven in de leerroute opent nu het passende technische onderdeel. Bij experts ga je naar de expertweergave, bij eerdere tekst naar het bereik van attention en bij tokenkansen naar de kansgrafiek. Bij de tokenroute blijft het gekozen token geselecteerd. Via **Stap voor stap** kom je terug bij de uitleg. Na stap 9 opent de 3D-verdieping.

**De twee voorbeelden zijn niet hetzelfde:** de miniatuurrekenmodule van de leerroute en de 3D-router gebruiken verschillende voorbeeldscores. Ze kunnen andere experts aanwijzen. De interface vermeldt dit bij beide weergaven.

## Echte modelmetingen, zonder betaalde diensten

Naast de kleine rekenvoorbeelden biedt de leerroute op de relevante stappen de knop **Bekijk echte modelmeting (ander model)**. Deze knop opent een klein, vooraf opgeslagen JSON-bestand op dezelfde website. Er draait **geen taalmodel bij het bezoek**, er wordt niets van de bezoeker verstuurd en de browser hoeft geen modelgewichten te downloaden.

De meetgegevens worden één keer berekend met het getrainde open model [EphAsad/IllaryiaStories-1M](https://huggingface.co/EphAsad/IllaryiaStories-1M). De openbare modelkaart vermeldt de **MIT-licentie**. De modelversie en de SHA-256 van het checkpoint staan in het JSON-bestand. Het model is een GPT-Neo met acht lagen en een eigen tokenizer, **niet** gpt-oss en **zonder experts**.

De vaste Engelse invoer is `Once upon a time,`. De opname bevat vier werkelijk uitgevoerde voorspellingen: token-ID's, een deel van de echte embedding, aandachtgewichten van één head, gemeten waarden per laag, de grootste volgende-tokenkansen en de gekozen tokens. De opname is niet gekoppeld aan de vraag van de bezoeker. **De vier gemeten tokens zijn direct selecteerbaar**: per voorspelling laat de viewer de tekst zien die al geschreven was, het nieuw gekozen token en zijn echte ID. Bij attention zijn de gewichten van head 1 uit de eerste en laatste laag te vergelijken. Het zijn twee verschillende rekenonderdelen, ook al hebben ze hetzelfde nummer. Bij de rekenlagen toont de viewer acht getallen met hun verschil ten opzichte van de vorige laag. De kansgrafiek vermeldt ook hoeveel kans overblijft voor de niet-getoonde tokens. De originele `o200k_harmony`-tokenizer blijft gebruikt worden voor de eigen vraag in het gpt-oss-voorbeeld.

De opname wordt geproduceerd met `scripts/generate_llm_real_trace.py` en gecontroleerd met `scripts/test_llm_real_trace.py`. De zware GitHub Actions-run in `.github/workflows/llm-real-trace.yml` wordt **alleen handmatig gestart**. De gewone websitecontroles toetsen het reeds opgeslagen JSON-bestand zonder opnieuw modelgewichten te downloaden. Het statische bestand staat onder `assets/llm-real-trace.json`. De viewer laadt dit pas **na een klik**, zodat de gewone leerroute ook op een langzame telefoon snel en volledig gratis blijft.

**Belangrijk:** een gemeten aandachtgewicht is niet automatisch een verklaring voor een antwoord. Een hogere lengte van de getallenrij in een laag betekent niet dat het model meer begrijpt. De route gebruikt de echte meetwaarden alleen voor vragen die die waarden daadwerkelijk ondersteunen.

## Onderzoeken

- Modelstelsel: opeenvolgende lagen met expertroosters in 3D. Selecteer met de muis of een vinger
- Tokenreis: kies een token en laag; bekijk het bereik van attention en vier expertroutes naast de 3D-wereld
- Experts: top-4-routerselectie per laag, met bijbehorende scores
- Attention: lokale of volledige causale toegang tot eerdere posities
- Context: relatie tussen beschikbare context en een venster van 128 posities
- Generatie: kansverdeling met temperatuur en top-p
- Redenering & kosten: officiële API-gebruiksvelden en een instelbaar kostenexperiment, met vijf gekoppelde tokenstromen. Het openbare voorbeeld gebruikt 75 inputtokens en 1186 outputtokens, inclusief 1024 redeneertokens

De lagenweergave kun je draaien, zoomen en met een muis of vinger onderzoeken. De rechthoekige vlakken verbeelden opeenvolgende lagen, niet de werkelijke posities van rekeneenheden. In Tokenreis staat de selectie stil totdat je zelf een ander token, expert of laag kiest. Onder de 3D-wereld staat een dunne laagstrook met de gekozen tokenpositie, attention-bereik en vier voorbeeldgewichten. De bereikstrook rekent met een instelbare voorbeeldcontext, niet met afgelezen aandachtsscores. Bij een lokaal venster is maximaal 128 posities direct bereikbaar; een volledige attentionlaag kan alle eerdere posities in dit scenario bereiken. De grafiek en de oude afspeelknoppen zijn voor Tokenreis verdwenen. De overige zes onderzoeken behouden hun eigen weergaven.

Op mobiel zie je de laagstrook boven het onderste menu. Details maakt de laagstrook groter. Instellen opent de tekstinvoer en het voorbeeld voor de contextlengte. Andere modules hebben nog een grafiek waar die informatie toevoegt. De vragenquiz is verwijderd; Uitleg bevat nu korte tekst over de gekozen onderzoeksmodus.

## Redenering en kosten

Het officiële OpenAI-gebruiksvoorbeeld laat zien dat redeneertokens binnen de outputtoken-telling vallen. In het observatorium is dat de standaardinstelling. Je kunt input, cache-lezen, cache-schrijven, redeneertokens, overige output en de voorbeeldprijzen afzonderlijk veranderen. De grafiek en de 3D-tokenstromen rekenen mee.

Bronnen:
- https://developers.openai.com/api/docs/guides/reasoning
- https://developers.openai.com/api/docs/guides/prompt-caching

**Bewijsgrens:** de 75/1186/1024 zijn een gepubliceerd gebruiksvoorbeeld. De overige tokenverdelingen en tarieven zijn vrij te kiezen scenario's, geen live meting, rekening of weergave van interne redeneerstappen. Het schrijfvoorbeeld gebruikt 1,25× en het leesvoorbeeld 0,1× de standaardinvoerprijs, zoals bij de 30-minutencache van ondersteunde recentere modellen. Bij andere modellen of instellingen kunnen die tarieven afwijken.

## Herkomst en beperkingen

De aantallen lagen, experts, attention heads, dimensies, contextposities en vocabulairegrootte zijn overgenomen uit de openbare modelconfiguraties van OpenAI's gpt-oss-120b en gpt-oss-20b:

- https://huggingface.co/openai/gpt-oss-120b/blob/main/config.json
- https://huggingface.co/openai/gpt-oss-20b/blob/main/config.json
- https://openai.com/open-models/

De plaats van een expertpunt, het aanvullende lichtveld, de route en de berekende kansen zijn **niet** afkomstig uit opnames van een werkelijk draaiend model. De projectie dient voor onderzoek naar architectuur en rekenprincipes en is geen fysieke afbeelding van modelgewichten. Er wordt geen verborgen GPT-6-architectuur getoond.

De tokeninvoer gebruikt, zodra het bibliotheekbestand is geladen, de echte `o200k_harmony`-tokenisatie van gpt-oss. Je kunt tokenstukken aanklikken en het token-ID bekijken. Zonder bibliotheek valt de invoer terug op afzonderlijke woorden en staat er uitdrukkelijk bij dat het geen echte tokenisatie is. De token-ID's zijn niet afkomstig uit een draaiend model; de getekende expertkeuze blijft een berekend voorbeeld. Een individueel token kan slechts een deel van een UTF-8-teken bevatten; de tekstweergave van zulke stukken is niet altijd leesbaar.

## Controle

De broncodecontrole, sitebuild en JavaScript-syntaxiscontrole voor deze herziening zijn geslaagd. De bijgewerkte Chromium-test controleert de tokenkeuze, de vier experts, laagselectie, het verschil tussen lokale en volledige attention en geen automatische beweging op 390 en 1280 pixels. De testresultaten blijven gekoppeld aan de commit waarop ze zijn uitgevoerd.

Dit is geen validatie van echte modelactivaties, wetenschappelijke verklaringskracht of leerwinst.

## Status

Het LLM Observatorium staat op eaimodel.nl. De negenstapsleerroute en het storyboard staan in [concept-pull request #297](https://github.com/E-AI-MODEL/website/pull/297) en worden daar getest. De eerdere verwijzing naar PR #125 beschrijft een oudere herziening; controleer de actuele main-branch en gepubliceerde site voordat wordt gepubliceerd.

## Visuele weergave, november 2026

De oude cirkelvormige en sterrenstelselachtige presentatie is vervangen door een reeks rechthoekige modellagen. Per laag zijn de expertposities als kleine vierkantjes gerangschikt. De gekozen laag en expert zijn duidelijk gemarkeerd. Bij Attention verschijnt een rij tokenposities met het bereik als vlak; bij Generatie een gerangschikte lijst kansbalken. De overige onderzoeken blijven bereikbaar. Er wordt niet automatisch afgespeeld. Alleen de tokenroute kan op verzoek stapsgewijs worden doorlopen.

**Let op:** dit is een didactische weergave van openbare modelstructuur en berekende voorbeelden. De exacte geometrische posities, routerscores en tokenactivaties worden niet uit een draaiend model gelezen.
