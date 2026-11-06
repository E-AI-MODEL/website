# LLM Observatorium, interactieve 3D-proef

Deze zelfstandige HTML is een herbouw van het eerdere LLM-prototype. Het oorspronkelijke Galactisch Observatorium diende als referentie voor een grote, vrij bestuurbare 3D-wereld, zes onderzoeksmodes, gekoppelde grafieken en een inspector. Dit project wijzigt de Melkwegbron niet.

Open `index.html` in een browser. Er zijn geen externe scripts of accounts nodig.

## Onderzoeken

- Modelstelsel: lagen en expertposities in een ruimtelijke structuur, selecteren met de muis of een vinger
- Tokenreis: reproduceerbare voorbeeldroute door de modelstructuur
- Experts: top-4-routerselectie per laag, met bijbehorende scores
- Attention: lokale of volledige causale toegang tot eerdere posities
- Context: relatie tussen beschikbare context en een venster van 128 posities
- Generatie: kansverdeling met temperatuur en top-p

De visualisatie draait en zoomt. Op het grote beeld start de knop **Volg een token** een zichtbaar lichtspoor door de lagen. Je kunt pauzeren, per laag verdergaan, een ander woord kiezen of op een routestation klikken. De laag en routerkeuze zijn direct gekoppeld aan de grafiek.

De grafiek heeft nu leesbare waarden en een samenvatting. Klik of tik op een waarde om de laag of expert in de 3D-wereld te selecteren. Op mobiel zijn Modules, Grafiek, Instellen, Leren en Bronnen afzonderlijke panelen. De tokenbediening verdwijnt zodra zo'n paneel openstaat.

## Herkomst en beperkingen

De aantallen lagen, experts, attention heads, dimensies, contextposities en vocabulairegrootte zijn overgenomen uit de openbare modelconfiguraties van OpenAI's gpt-oss-120b en gpt-oss-20b:

- https://huggingface.co/openai/gpt-oss-120b/blob/main/config.json
- https://huggingface.co/openai/gpt-oss-20b/blob/main/config.json
- https://openai.com/open-models/

De plaats van een expertpunt, het aanvullende lichtveld, de route en de berekende kansen zijn **niet** afkomstig uit opnames van een werkelijk draaiend model. De projectie dient voor onderzoek naar architectuur en rekenprincipes en is geen fysieke afbeelding van modelgewichten. Er wordt geen verborgen GPT-6-architectuur getoond.

In deze proef is het ingevoerde voorbeeld opgedeeld in woorden. Het is geen echte gpt-oss-tokenisatie.

## Controle

Lokale Chromium-tests zijn uitgevoerd op 320, 390, 768 en 1440 pixels. Getest: zes modules, mobiele paneelbediening, wisselen tussen 120b en 20b, ontbreken van paginascroll en JavaScript-runtimefouten. Een aanvullende Node-syntaxcheck is geslaagd.

Dit is geen validatie van modelactivaties, wetenschappelijke verklaringskracht of leerwinst.

## Status

**Concept.** Er is geen publieke route toegevoegd aan de sitebouwer. Eerst de interactieve voorvertoning beoordelen en zo nodig verbeteren. Daarna pas een afzonderlijk besluit over publicatie.
