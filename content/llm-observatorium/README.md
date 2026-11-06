# LLM Observatorium, interactieve 3D-proef

Deze zelfstandige HTML is een herbouw van het eerdere LLM-prototype. Het oorspronkelijke Galactisch Observatorium diende als referentie voor een grote, vrij bestuurbare 3D-wereld, zeven onderzoeksmodes, gekoppelde grafieken en een inspector. Dit project wijzigt de Melkwegbron niet.

Open `index.html` in een browser. Voor echte tokenisatie laadt de pagina eenmaal `gpt-tokenizer@4.1.0` via jsDelivr. Er is geen account of modelsleutel nodig. Zonder netwerkverbinding blijft de voorbeeldweergave werken, maar zie je geen echte token-ID's.

## Onderzoeken

- Modelstelsel: lagen en expertposities in een ruimtelijke structuur, selecteren met de muis of een vinger
- Tokenreis: reproduceerbare voorbeeldroute door de modelstructuur
- Experts: top-4-routerselectie per laag, met bijbehorende scores
- Attention: lokale of volledige causale toegang tot eerdere posities
- Context: relatie tussen beschikbare context en een venster van 128 posities
- Generatie: kansverdeling met temperatuur en top-p
- Redenering & kosten: officiële API-gebruiksvelden en een instelbaar kostenexperiment, met vijf gekoppelde tokenstromen. Het openbare voorbeeld gebruikt 75 inputtokens en 1186 outputtokens, inclusief 1024 redeneertokens

De visualisatie draait en zoomt. Op het grote beeld start de knop **Volg een token** een zichtbaar lichtspoor door de lagen. Je kunt pauzeren, per laag verdergaan, een ander woord kiezen of op een routestation klikken. De laag en routerkeuze zijn direct gekoppeld aan de grafiek.

De grafiek heeft nu leesbare waarden en een samenvatting. Klik of tik op een waarde om de laag of expert in de 3D-wereld te selecteren. Op mobiel zijn Modules, Grafiek, Instellen, Leren en Bronnen afzonderlijke panelen. De tokenbediening verdwijnt zodra zo'n paneel openstaat.

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

Lokale Chromium-tests zijn uitgevoerd op 320, 390, 768 en 1440 pixels. Getest: zeven modules, mobiele paneelbediening, wisselen tussen 120b en 20b, ontbreken van paginascroll en JavaScript-runtimefouten. Een aanvullende Node-syntaxcheck is geslaagd.

Dit is geen validatie van modelactivaties, wetenschappelijke verklaringskracht of leerwinst.

## Status

**Concept.** Er is geen publieke route toegevoegd aan de sitebouwer. Eerst de interactieve voorvertoning beoordelen en zo nodig verbeteren. Daarna pas een afzonderlijk besluit over publicatie.
