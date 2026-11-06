# LEIF: vastgelegde afspraken en tekstbeheer

## Wat behouden blijft
- De bestaande LEIF-site op eaimodel.nl/leif, zonder tweede website of apart testdomein.
- Eén centraal toegangsscherm.
- KEI: oorspronkelijke inhoud, leeservaring, oefeningen en de bestaande versleutelde verhaalbron blijven behouden.
- LIS: bestaande persoonlijke proefomgeving van Kars.
- Chermaine: bestaande vervolgvragen en antwoorden blijven behouden.
- VIS: opent de wachtwoordlogin voor het bestaande beheeraccount met managerrechten. Een bestaande, geldige beheersessie geeft direct toegang. Alleen de drie letters VIS zijn niet voldoende om privégegevens veilig beschikbaar te maken.

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
- Bewaar een concept. Publiceren is een aparte handeling.
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

## Nog vóór publicatie
- Voer de migratie `multitenant/site-texts.sql` gecontroleerd uit.
- Publiceer de bijgewerkte Edge Function `leif-admin-console`.
- Controleer de Chromium-browsertest en test de eerste publicatie en het herstellen met fictieve tekst.
- Houd de huidige productiepagina intact tot die controles zijn geslaagd.
- VIS toont het beheerderswachtwoord op hetzelfde startscherm. De server verifieert het bestaande Auth-account en controleert of de gebruiker managerrechten heeft binnen LEIF.
- Geen e-mailaanvraag of wachttijd bij het gewone inloggen. Alleen VIS invoeren geeft geen toegang tot privégegevens.
- Een beheerder die het wachtwoord niet meer weet, moet het veilig herstellen via Supabase Auth Admin. De site mag hiervoor geen wachtwoorden of geheime sleutels in JavaScript opslaan.
- Oude, al verzonden eenmalige inloglinks blijven zolang geldig bruikbaar; nieuwe links zijn niet nodig voor de normale beheerlogin.
- Voor daadwerkelijke publicatie: browsercontrole op mobiele schermen, fout wachtwoord, ontbrekende managerrechten en een geldige beheersessie.
