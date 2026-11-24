# LEIF Studio | overdracht

De beheerder ziet alle deelnemers in één overzicht. Elk dossier kan losse onderdelen bevatten: tekst, kop en Spotify-nummer/album/afspeellijst. De lettergroottes en bediening zijn bewust compact.

## Opslag
- Nieuwe deelnemers: `leif_documents.personal_texts.blocks_draft` en `.blocks_published`, met bestaande `revision`.
- Oudere proefdeelnemers: `leif_demo_sessions.personal_texts` en `studio_revision` na additieve migratie `studio-legacy-additive.sql`.
- De gepubliceerde onderdelen zijn alleen zichtbaar voor de deelnemer via diens bestaande persoonlijke code. Dit is **geen publieke GitHub-publicatie**.
- De bestaande antwoorden, oude verhaalvelden, toegangscodes en KEI-lokale proef worden niet overschreven.

## Volgorde om te publiceren
1. Controleer tests en de bronwijzigingen op de PR.
2. Voer de additieve databasewijziging uit met `leif/multitenant/studio-legacy-additive.sql`. Controleer dat de bestaande demoantwoorden onaangeroerd zijn.
3. Deploy de Edge Functions `leif-admin-console` uit `edge-admin-console.ts`, `leif-personal-session` uit `edge-personal-session.ts` en `leif-demo-session` uit `edge-demo-session.ts`. Behoud voor alle drie de bestaande instelling `verify_jwt=false`, omdat de functies hun eigen toegangscontrole uitvoeren.
4. Publiceer de website op Theory7.
5. Test als VIS met twee aparte dossiers, waaronder een oude proef: voeg Spotify alleen bij het eerste toe, bewaar een concept, controleer dat het tweede dossier ongewijzigd blijft, publiceer, open beide deelnemercodes, verberg en herstel een onderdeel.
6. Controleer daarna de bestaande oude verhaalvelden, antwoordopslag, inlogcodes en beheerwachtwoord.

## Grenzen van deze versie
- Er is geen rechtstreekse Spotify API-koppeling. VIS plakt een bestaande openbare Spotify-link; de deelnemer activeert de embed zelf.
- Geen willekeurige HTML, scripts, afbeeldingen of videospelers toevoegen. Alleen de drie gecontroleerde onderdeeltypen.
- De bestaande lokale KEI-data zijn niet op de server beschikbaar. KEI blijft als historische lokale proef zichtbaar, maar kan niet zonder overdracht door VIS worden bewerkt.
- Geen verwerking van persoonlijke antwoorden naar de publieke GitHub-geschiedenis.
- De server valideert een maximum van 24 losse blokken en 130.000 tekens JSON per dossier. Sla ze apart op voor publicatie.
- De oude proef heeft voor de blokken een aparte versiecounter. Een volledige migratie van oude antwoorden naar het nieuwe documentenmodel is **niet** uitgevoerd.

## Terugdraaien
Laat bestaande gegevens staan. Schakel eerst terug naar de vorige drie Edge Function-versies en eerdere webbestanden. De additieve databasekolommen mogen blijven staan; verwijderen zou nieuw opgeslagen studio-onderdelen laten verdwijnen.
