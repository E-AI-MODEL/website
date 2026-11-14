# Openbare bezoekersstatistieken

Deze pagina staat op `/statistieken/`. Bezoekers hebben geen account of inlog nodig. De website toont alleen samengevatte cijfers van Cloudflare Web Analytics (RUM). Er staat geen Cloudflare-token in HTML, JavaScript of openbare JSON.

## Eenmalig aansluiten

1. Open **Cloudflare → Web Analytics** en controleer of `eaimodel.nl` is toegevoegd en bezoeken worden gemeten. Bij verkeer dat via Cloudflare wordt geproxied, kan Cloudflare de meetcode automatisch toevoegen. Bij een DNS-only configuratie is de JS-beacon op de site nodig. Bevestig via Cloudflare dat er echte gegevens binnenkomen voordat je het dashboard activeert.
2. Maak via Cloudflare **My Profile → API Tokens** een token dat alleen **Account Analytics: Read** mag uitvoeren voor het juiste account. Gebruik geen Global API Key.
3. Open **GitHub → E-AI-MODEL/website → Settings → Secrets and variables → Actions** en voeg deze repository secrets toe:
   - `CLOUDFLARE_ANALYTICS_TOKEN` (alleen lezen)
   - `CLOUDFLARE_ACCOUNT_ID` (Cloudflare account-id)
   - `CLOUDFLARE_SITE_TAG` (de Web Analytics site-tag, niet de zone-id)
4. Open **Actions → Publish public website statistics → Run workflow**. Zodra de taak slaagt en `statistieken/data.json` is gepubliceerd, verschijnt de eerste gemeten periode op de pagina. De workflow wordt daarna ongeveer elke zes uur gestart.
5. Controleer dat GitHub Actions onder **Settings → Actions → General** toestemming heeft om met `GITHUB_TOKEN` naar de standaardbranch te schrijven. Branch-protection kan hiervoor een aparte aanpak nodig maken.

## Wat staat openbaar?

- Totaal aantal bezoeken en paginaweergaven, plus dagverloop van maximaal dertig dagen.
- Populaire *bestaande openbare pagina's* die in de sitemap zijn opgenomen. Vrije of persoonlijke URL's komen niet in de ranglijst.
- Verwijzingen uit zoekmachines, sociale media, AI-assistenten en overige externe websites. De oorspronkelijke domeinnamen worden niet gepubliceerd.
- Tijdstip van de laatste geslaagde gegevensverversing.

Cloudflare Web Analytics meet browsers met een JavaScript-beacon. De gegevens zijn niet hetzelfde als alle HTTP-verzoeken op de server. Cloudflare bevat geen klik- of bouncemeting; daarvoor is de aparte PHP-teller toegevoegd. Die retourneert alleen samengevatte waarden.

De knop **7 dagen** verkort de totalen en het dagverloop. De lijst met pagina's en verwijzers blijft een uitsplitsing over de hele periode van dertig dagen, omdat de snapshot daarvoor maar één ranglijst bevat. De pagina maakt dat verschil zichtbaar.

Bij een API-fout of ontbrekende toegang blijft de laatst geslaagde publicatie behouden. Zonder een bestaande publicatie geeft het dashboard aan dat de meting nog niet is aangesloten. Er worden nooit verzonnen nulstanden of voorbeeldcijfers gepubliceerd.


## Voorbeeldstand en nieuwe paginacijfers

De gewone URL `/statistieken/` toont Cloudflare-cijfers en aanvullende echte metingen van Theory7.
`/statistieken/?demo=1` toont een duidelijk gemarkeerde proefopstelling met **500 verzonnen bezoeken en 143 verzonnen unieke bezoekers**. De demonstratie haalt alleen `/statistieken/demo.json` op en schrijft niets naar Cloudflare of naar `data.json`. Het bestand wordt met de site gepubliceerd; `data.json` komt uitsluitend uit de afzonderlijke Cloudflare-verversing.

Per openbare pagina met ten minste vijf gemeten weergaven toont het overzicht nu paginaweergaven en, voor nieuwe snapshots, het door Cloudflare gerapporteerde aantal bezoeken aan die pagina. Die paginabezoeken zijn geen unieke mensen en de aantallen zijn niet zomaar optelbaar tot het sitebrede totaal.

Cloudflare Web Analytics kent geen eigen klikgebeurtenissen of standaard bouncepercentage. De aanvullende PHP-teller rapporteert klik- en sessiegegevens met een eigen definitie. Waarden uit `demo.json` worden nooit opgenomen in echte statistieken, API-uitvoer of rapportages.

Bij een apart meetinstrument moeten de definities vooraf vaststaan: wat telt als klik, wat betekent een betrokken sessie, hoe wordt een terugkerende bezoeker geteld en hoe wordt omgegaan met AVG en privacy. Voor simulaties is één lang bezoek niet automatisch een mislukte sessie.

## Klikken, browsers en bounce

Naast Cloudflare Web Analytics gebruikt de site een eigen, kleine PHP-meting op Theory7:

- `assets/site-analytics.js` telt bezoeken en vaste, openbare link-, knop- en instellingenacties. Er wordt nooit een ingevulde waarde, paginaparameter of verwijzer verzonden.
- `statistieken/collect.php` accepteert uitsluitend verzoeken vanaf eaimodel.nl of www.eaimodel.nl, en uitsluitend openbare paden uit `sitemap.xml`. De willekeurige browser- en sessiecodes worden met een serversleutel gehasht. De ruwe codes, IP-adressen en individuele formulierinhoud worden niet opgeslagen.
- Dagbestanden en de geheime hash-sleutel worden buiten de publiek bereikbare documentmap opgeslagen. Lukt dit niet op het hostingpakket, dan geeft de PHP-service HTTP 503 terug in plaats van ongecontroleerd naar een openbare map uit te wijken.
- De browsercode blijft maximaal 30 dagen in `localStorage`. Dagbestanden worden na 32 dagen verwijderd. Met `Meting uitzetten` op de dashboardpagina kun je de aanvullende meting stoppen. Ook Global Privacy Control en Do Not Track worden gerespecteerd.
- Een sessie eindigt na 30 minuten zonder activiteit. Bounce betekent één bezochte pagina zonder vastgelegde klik of minstens tien seconden actieve kijktijd. Nog niet afgesloten sessies tellen niet mee voor het bouncepercentage. Bij minder dan vijf afgeronde sessies blijft dit percentage leeg.
- **Unieke bezoekers** betekent hier getelde browsers. Eén persoon met twee browsers kan tweemaal meetellen. Browserinstellingen kunnen de telling beïnvloeden.

Het publieke PHP-antwoord bevat alleen geaggregeerde cijfers, nooit browsersleutels, IP-adressen of sessie-ID's. Kliklabels bestaan uit veilige routepaden en vaste elementnamen, niet uit tekst die een bezoeker heeft ingevoerd. Per-pagina-gegevens worden pas in de detailweergave getoond bij minimaal vijf paginaweergaven.

Cloudflare-cijfers worden periodiek bijgewerkt via GitHub Actions. De aanvullende cijfers komen rechtstreeks uit de eigen teller. De beide methoden kunnen iets verschillen door hun eigen sessiedefinitie en meetbereik. De aanvullende meting bevat geen gegevens van vóór het moment van activering.

**Privacy:** deze toepassing is beperkt tot het eigen domein, zonder reclame, profilering, doorgifte aan derden of individuele gebruikersrapporten. De meetmethode en de bezwaarmogelijkheid moeten zichtbaar blijven. Controleer bij grotere aanpassingen opnieuw of de toepassing nog binnen de beperkte analytische uitzondering van de Telecommunicatiewet en AVG valt.

De voorbeeldmodus (`?demo=1`) blijft technisch gescheiden met `demo:true` en leest uitsluitend `demo.json`. De openbare pagina toont in die modus één korte aanduiding `Voorbeeld`. De productiegegevens worden nooit vervangen door voorbeeldcijfers.

## Bronnen

- [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/about/)
- [Cloudflare GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/getting-started/)
- [Cloudflare API-tokenrechten](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)

De actuele GraphQL-query staat in `scripts/publish_web_analytics.py`. De gegevensverversing staat in `.github/workflows/publish-public-analytics.yml`. De publicatie wordt getest in `tests/test_public_analytics.py`.
