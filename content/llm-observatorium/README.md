# LLM Observatorium, interactieve 3D-proef

Deze zelfstandige HTML is een herbouw van het eerdere LLM-prototype. Het oorspronkelijke Galactisch Observatorium diende als referentie voor een grote, vrij bestuurbare 3D-wereld, zeven onderzoeksmodes, gekoppelde grafieken en een inspector. De oude visual met concentrische ringen is vervangen door een schematische reeks modellagen. Dit project wijzigt de Melkwegbron niet.

Open `index.html` in een browser. Voor echte tokenisatie laadt de pagina eenmaal `gpt-tokenizer@4.1.0` via jsDelivr. Er is geen account of modelsleutel nodig. Zonder netwerkverbinding blijft de voorbeeldweergave werken, maar zie je geen echte token-ID's.

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

Het LLM Observatorium staat op eaimodel.nl. Deze herziening staat als concept in pull request #125. Ze is nog niet op de openbare site gepubliceerd.

## Visuele weergave, november 2026

De oude cirkelvormige en sterrenstelselachtige presentatie is vervangen door een reeks rechthoekige modellagen. Per laag zijn de expertposities als kleine vierkantjes gerangschikt. De gekozen laag en expert zijn duidelijk gemarkeerd. Bij Attention verschijnt een rij tokenposities met het bereik als vlak; bij Generatie een gerangschikte lijst kansbalken. De overige onderzoeken blijven bereikbaar. Er wordt niet automatisch afgespeeld. Alleen de tokenroute kan op verzoek stapsgewijs worden doorlopen.

**Let op:** dit is een didactische weergave van openbare modelstructuur en berekende voorbeelden. De exacte geometrische posities, routerscores en tokenactivaties worden niet uit een draaiend model gelezen.
