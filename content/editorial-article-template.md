# EAI: redactionele visuals bij artikelen

Dit patroon is gemaakt voor `nl/blog/wat-ons-werk-ons-werk-maakt/` en werkt zonder JavaScript. De CSS staat in `assets/site-editorial.css`. Het patroon is ook te gebruiken in andere artikelen op EAI. De bestaande essays met eigen visuals blijven ongewijzigd.

## Gebruik

- **`.eai-story-header`**: compacte kop en korte leeswijzer naast de lead. Houd de titel en eerste alinea op mobiel op één leesbare breedte.
- **`.eai-story-examples`**: twee of drie echte keuzes in vergelijkbare situaties. De gemarkeerde stap toont welke handeling betekenis heeft.
- **`.eai-story-phases`**: een doel verdeeld over verschillende momenten. Maak per moment zichtbaar wat de leerling of professional zelf doet en waar AI eventueel helpt.
- **`.eai-story-mail`**: twee situaties die op elkaar lijken maar om een andere aanpak vragen. Vermijd algemene scores of schijnprecisie.
- **`.eai-story-compare`**: een begripsonderscheid, bijvoorbeeld efficiënt tegenover effectief, met voor beide een concrete controlevraag.
- **`.eai-story-questions`**: vier korte gespreksvragen die naar een werkafspraak leiden.

## Regel voor visuals

Elk diagram moet een afweging verduidelijken die in de tekst wordt besproken. Maak een illustratie niet alleen voor afwisseling. Gebruik HTML en CSS met gewone tekst en expliciete figcaptions. Alle belangrijke informatie blijft in tekst beschikbaar. Schermen vanaf 320 px breed mogen niet horizontaal scrollen. Geen emoji's, stockbeelden of decoratieve AI-symbolen.

De onderstaande pagina's gebruiken het ontwerp direct:
- `nl/blog/wat-ons-werk-ons-werk-maakt/index.html`: artikel, voorbeelden, fasen, mails en vragen.
- `nl/blog/index.html`: overzichten en typografische stijl.

## Voor nieuwe artikelen

Begin met `<main class="eai-story">`, een `.eai-story-header` en een `<article class="eai-story-body">`. Voeg één of meer componenten toe waar ze een inhoudelijke functie hebben. Geef elke figure een eigen `figcaption` en zorg dat een bezoeker de conclusie ook zonder kleur begrijpt. Gebruik de varianten `.eai-story-wide` alleen binnen `.eai-story-body`. Test 320, 390, 768 en 1440 px, toetsenbord, links en schermlezers.
