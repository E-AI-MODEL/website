# Homepage: AI in de hele school

Ontwerpvoorstel van 1 november 2026. De homepage begint bij vragen van bezoekers met weinig voorkennis over AI. Bestuur, schoolleiding, teams, medewerkers, docenten en leerlingen horen bij dezelfde schoolcontext.

## Wat bezoekers eerst zien

De opening is **AI op school. Waar begin je?** De schooltekening toont drie verbonden niveaus. Afspraken werken door naar het dagelijkse werk; ervaringen gaan terug naar de schoolleiding. Elk niveau opent een passend voorbeeld.

Vijf vragen geven toegang tot schoolafspraken, dagelijks werk, leren en toetsen, een AI-toepassing kiezen en AI begrijpen. Er staat steeds één voorbeeld open. Zonder JavaScript zijn dezelfde voorbeelden toegankelijk via native uitklappers.

## Wat de beelden uitleggen

De tekeningen maken taakverdeling, volgorde, een keuzemoment of een verschil tussen leerfasen zichtbaar. Korte woorden staan bij de betreffende handeling. Mensen zijn groen, AI is paars en inbreng is neutraal. Labels en vormen dragen de betekenis ook zonder kleur. Smalle schermen krijgen verticaal opgebouwde schema’s.

De grafiekcasus maakt duidelijk dat een uitgewerkt voorbeeld tijdens uitleg een andere rol heeft dan tijdens zelfstandig oefenen. Wanneer het doel het lezen van een grafiek is, kan AI het tekenen overnemen. De ouderberichtcasus laat zien dat AI de tekst kan schrijven en dat een medewerker bepaalt welke communicatie past.

## Inhoudelijke grenzen

De volgorde **Proces → Fase → Kernhandeling → AI** blijft behouden. De homepage maakt de eerste kennismaking eenvoudiger; de volledige modeluitleg en definities blijven op de modelpagina staan. Leren en ander schoolwerk hebben verschillende doelen. Een efficiënt of verzorgd resultaat bewijst geen leeropbrengst. De voorbeelden zijn illustratief en vormen geen bewijs voor een effect van AI of van deze homepage.

## Bron en review

De homepage wordt opgebouwd uit `content/home-model/home-nl.html` en `home-en.html`, met `assets/school-home.css` en de bestaande opbouwscripts. De werkvorm *Van proces naar prompt* opent vanuit drie voorbeelden met een passende voorinvulling.

`previews/eai-homepage-20261101.html` is een zelfstandig te openen Nederlandse momentopname met ingebouwde stijlen en interactie. Links naar andere pagina’s verwijzen naar de publieke website. De volledige wijzigingen en de nieuwe voorinvullingen moeten gezamenlijk worden uitgebracht om ook die vervolgstappen op de publieke site beschikbaar te maken.

Gecontroleerd: lokale build, 11 bestaande Python-tests, UI-validatie van 111 pagina’s, Nederlands en Engels, toetsenbordbediening, directe links naar voorbeelden, mobiele breedtes van 320 en 390 pixels en de terugval zonder JavaScript. Dit vervangt geen gebruikerstest met bezoekers die nog weinig voorkennis hebben.
