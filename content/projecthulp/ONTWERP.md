# EAIgit als EAI Work-proef

Status: ontwerp- en integratieproef op de ontwikkeltak van de website, geen productie-uitrol of rechtstreekse EAI Work-serverkoppeling.

## Gebruikersdoel
De gebruiker wil niet primair een ZIP-bestand ergens neerzetten. De bestanden moeten bruikbaar worden in GitHub en het project moet blijven doen wat de gebruiker ermee bedoelt.

GitHub bewaart een ZIP als bestand. GitHub maakt daar niet vanzelf een broncoderepository of werkende website van.

## Welke vraag levert werkelijk iets op?

| Fase | Minimale menselijke invoer | Wat het systeem zelfstandig doet | Besluit dat menselijk blijft |
| --- | --- | --- | --- |
| 1. Doel | Kies beoogd gebruik; eventueel concrete voorbeelden | Vertaal het gebruik naar gerichte controles | Beschrijf wat het resultaat moet kunnen |
| 2. Bronnen | Kies ZIP; plak eventueel openbare repositorylink | Lees ZIP veilig lokaal en GitHub via read-only API; noteer versie | Bepaal of de bestanden onderzocht mogen worden |
| 3. Analyse | Alleen bij tegenstrijdige of ontbrekende informatie | Vergelijk bestanden, herken projectsoort, leg ongeteste functies apart | Beoordeel welk bronbestand leidend is bij conflict |
| 4. Voorbereiden en testen | Geen extra vraag voor read-only controles | Maak afhankelijkheden zichtbaar; draai beperkte syntaxiscontroles en beschikbare tests | Keur een nieuwe of onbekende testprocedure goed voordat die projectcode uitvoert |
| 5. GitHub en publicatie | Expliciete toestemming voor wijzigingen, apart van publicatie | Bereid een wijziging, testbewijs en mogelijke pull request voor | Geef toestemming voor repositoryschrijven, zichtbaarheid, licenties en publicatie |
| 6. Gebruik | Eén controle van het bedoelde gedrag | Toon uitgevoerde controles, bronversies, mislukte checks en open punten | Beoordeel of de toepassing voor het bedoelde gebruik voldoet |

Vermijd vooraf vragen naar framework, mappenindeling of programmeerervaring. De meeste antwoorden zijn uit bestanden afleidbaar of veranderen de uitvoering niet. De optionele eigen doelbeschrijving is zonder AI **niet semantisch gecontroleerd**.

## Echte uitvoering in deze proef

- **Browserworker 1**: ZIP parser, bestandsnamen, projectmanifest en statische verwijzingen. Loopt lokaal op het apparaat.
- **Browserworker 2**: openbare GitHub-repository via read-only REST API. Beide starten onafhankelijk en gelijktijdig.
- **Beslisregels in browser**: vergelijken bestandspaden, doelafhankelijke aanwijzingen, onzekerheden en stappen. Dat bewijst niet dat een website of applicatie werkt.
- **GitHub Actions voor de website**: eigen code en gebruikersroute worden getest op desktop en een mobiel scherm met een nagebootst API-antwoord.
- **EAI Work zelf**: een plan met 6 fasen, 11 taken en 2 source-anchored toestemmingsblokkades in `content/projecthulp/eaiwork-mission.json`. De workflow `.github/workflows/projecthulp-eaiwork-proof.yml` haalt de echte EAI Work-code op, vastgepind op commit `b80d3d9afb6289d1fda8bdc14a8c890043b56e22`. De uitvoerbare `text-normalize`- en `text-metrics`-adapters worden in een afzonderlijke testmissie geregistreerd, met fixtures vrijgegeven en via de lokale taakuitvoering gestart; het Operations-journal registreert hun uitkomst. De andere adapters zijn niet beschikbaar binnen deze EAI Work-runtime.
- **GitHub Actions voor de repository van de gebruiker**: de website kan desgewenst een minimaal, read-only controlebestand voor JavaScript- of Python-syntaxis aanbieden. Dit wordt alleen actief nadat de eigenaar het zelf aan `.github/workflows/projectcontrole.yml` toevoegt. Het voert geen `npm run test`, applicatiecode of installatiescripts uit.

De browserworker en de EAI Work Operations-worker zijn **verschillende runtimes**. Hun aanwezigheid betekent niet dat het publieke scherm een echte EAI Work-serversessie heeft. EAI Work-statussen, ondertekend bewijs, veilige codeworker en private GitHub-toegang worden hier nog niet als werkend product aangeboden.

## Grenzen en vervolg

1. Schrijf- of publicatieacties vereisen een veilige GitHub-autorisatie met passende scope, en expliciete toestemming. Geen persoonlijk toegangstoken verzamelen in een publiek webformulier.
2. Een bruikbare, ondersteunde adapter voor ZIP-inname en één voor openbare GitHub-repositories ontbreekt nog in de **EAI Work-serverruntime**. De browserimplementaties zijn mogelijke broncode om het contract te ontwerpen, maar niet automatisch serverworkers.
3. Volledige lint, bouw en tests van onbekende code vereisen een sandbox en projectafhankelijke instellingen. Dit gebeurt niet op de website.
4. Een echte vervolgstap is een gereviewde PR naar EAI Work waarin de ingangen, workercontracten, tests, bewijzen en faalgedrag verbonden zijn. Werkelijke externe GitHub-schrijfacties blijven achter aparte toestemming.
5. De eindproef moet de volledige gebruikershandeling meten: gebruiker levert bronnen aan, het systeem voert de passende controles uit, de gebruiker beoordeelt een voorstel, GitHub ontvangt na akkoord de correcte uitgepakte bestanden, CI is daadwerkelijk uitgevoerd, en de gebruiker beoordeelt de werking.

## Stopregels

Geen automatisch repositoryschrijven, automatische publicatie, uitvoeren van projectcode uit een ZIP, inhoudelijk werkend-label op basis van een bestandsnaam, of bewering dat een syntaxiscontrole een functionele test is.

De proef bewijst iets over EAI Work pas als de daadwerkelijk uitgevoerde worker- en journalstappen met de gebruikerstaak verbonden zijn. Een geslaagde contractvalidatie zonder uitvoer wordt apart vermeld.
