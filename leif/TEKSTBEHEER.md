# LEIF: vastgelegde afspraken en tekstbeheer

## Wat behouden blijft
- De bestaande LEIF-site op eaimodel.nl/leif, zonder tweede website of apart testdomein.
- Eén centraal toegangsscherm.
- KEI: oorspronkelijke inhoud, leeservaring, oefeningen en de bestaande versleutelde verhaalbron blijven behouden.
- LIS: bestaande persoonlijke proefomgeving van Kars.
- Chermaine: bestaande vervolgvragen en antwoorden blijven behouden.
- VIS: toegang tot het bestaande beheer met managerrechten. Een bestaande, geldige beheersessie geeft direct toegang. Alleen de drie letters VIS zijn niet voldoende om privégegevens veilig beschikbaar te maken.

## Vormgeving
- Eén rustig inlogvlak, zonder losse informatieblokken eromheen.
- Het ronde LEIF-logo uit de bestaande leesomgeving.
- Zachte, warme kleuren en een bijna onmerkbare achtergrondbeweging.
- De animatie stopt bij `prefers-reduced-motion`.
- De introductietekst gaat over zelfkennis, het handelen tegenover anderen en persoonlijk leiderschap. De beheerder kan deze tekst later aanscherpen.

## Teksten beheren
- Het menu **Teksten beheren** staat in de bestaande beheeromgeving.
- Kies een pagina, blader door een voorbeeld zonder antwoorden van echte deelnemers en klik op een tekst.
- Ook algemene vraagteksten en toelichtingen die op de pagina verschijnen kunnen in het voorbeeld worden geselecteerd.
- Met Opslaan voor iedereen wordt de tekst in één serverbewerking bewaard en gepubliceerd. Bewaar concept blijft beschikbaar voor werk dat je nog wilt nakijken.
- Je kunt een publicatie intrekken en een vorige versie als nieuw concept herstellen.
- Teksten worden als platte tekst weergegeven. HTML, JavaScript, toegangsrechten en antwoorden kunnen niet vanuit het tekstveld worden aangepast.
- De versleutelde inhoud van het KEI-verhaal valt buiten deze algemene site-redactie. Het bestaande beheer voor persoonlijke verhalen per deelnemer blijft functioneren.

## Opslag en rechten
- De websitecode blijft in GitHub.
- In Supabase komen `leif_site_texts` en `leif_site_text_history` naast de bestaande deelnemersgegevens.
- De database is niet rechtstreeks toegankelijk voor anonieme bezoekers.
- De publieke API geeft alleen `published_text` terug, nooit concepten.
- Bewaren, publiceren, intrekken en herstellen vereisen een gecontroleerde LEIF-beheerderssessie met managerrechten.
- Iedere wijziging verhoogt de revisie. Een verouderde revisie wordt geweigerd.

## Beheerinlog
- Een geldige bestaande tabbladsessie wordt overgenomen in blijvende browseropslag.
- De website vernieuwt toegangstokens en bewaart een sessie bij verbindingsproblemen. Uitloggen wist de browseropslag en trekt de huidige refreshsessie in.
- Mijn beheerinlog wijzigt het eigen bestaande Supabase Auth-account. De managerrol en dossiers blijven aan dezelfde gebruiker gekoppeld.
- De beheerder stelt zelf het e-mailadres en wachtwoord in. Wachtwoorden worden niet door LEIF in browseropslag bewaard. Een ander mailadres vraagt de normale e-mailbevestiging.
- VIS opent de e-mail/wachtwoordlogin op het bestaande startscherm. De eenmalige link naar het oorspronkelijke beheeradres blijft beschikbaar voor de eerste instelling.

## Vaste teksten bij nieuwe releases
- De database bewaart de ingevulde en gepubliceerde teksten naast de websitecode.
- `tekstvelden.js` bevat vaste codes voor bestaande statische tekstvelden. Redactie in de HTML mag die codes niet vervangen.
- Bij verplaatsen van een veld in de HTML moet zijn bestaande code meeverhuizen naar de nieuwe vindplaats. `scripts/update_leif_text_keys.py` voegt uitsluitend nieuwe velden toe.
- De browsertest wijzigt de oorspronkelijke welkomsttekst en controleert dat de opgeslagen beheertekst zichtbaar blijft.
