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

Cloudflare Web Analytics meet browsers met een JavaScript-beacon. De gegevens zijn niet hetzelfde als alle HTTP-verzoeken op de server. Geen cijfers voor individuele personen, IP-adressen, sessies, privélinks, exacte verwijzende adressen of bouncepercentage.

De knop **7 dagen** verkort de totalen en het dagverloop. De lijst met pagina's en verwijzers blijft een uitsplitsing over de hele periode van dertig dagen, omdat de snapshot daarvoor maar één ranglijst bevat. De pagina maakt dat verschil zichtbaar.

Bij een API-fout of ontbrekende toegang blijft de laatst geslaagde publicatie behouden. Zonder een bestaande publicatie geeft het dashboard aan dat de meting nog niet is aangesloten. Er worden nooit verzonnen nulstanden of voorbeeldcijfers gepubliceerd.


## Voorbeeldstand en nieuwe paginacijfers

De gewone URL `/statistieken/` toont uitsluitend echte Cloudflare-gegevens.
`/statistieken/?demo=1` toont een duidelijk gemarkeerde proefopstelling met **500 verzonnen bezoeken en 143 verzonnen unieke bezoekers**. De demonstratie haalt alleen `/statistieken/demo.json` op en schrijft niets naar Cloudflare of naar `data.json`. Het bestand wordt met de site gepubliceerd; `data.json` komt uitsluitend uit de afzonderlijke Cloudflare-verversing.

Per openbare pagina met ten minste vijf gemeten weergaven toont het overzicht nu paginaweergaven en, voor nieuwe snapshots, het door Cloudflare gerapporteerde aantal bezoeken aan die pagina. Die paginabezoeken zijn geen unieke mensen en de aantallen zijn niet zomaar optelbaar tot het sitebrede totaal.

**Geen verzonnen productiemeting:** Cloudflare Web Analytics ondersteunt momenteel geen eigen klikgebeurtenissen, individuele unieke bezoekers of standaard bouncepercentage. In de gewone weergave blijven deze velden leeg totdat er een afzonderlijke, zorgvuldig afgebakende meting bestaat. De voorbeeldstand laat wél zien hoe per-paginaklikken en bouncepercentage er straks uit kunnen zien. De bezoekerscijfers uit `demo.json` mogen nooit worden opgenomen in echte statistieken, API-uitvoer of rapportages.

Bij een apart meetinstrument moeten de definities vooraf vaststaan: wat telt als klik, wat betekent een betrokken sessie, hoe wordt een terugkerende bezoeker geteld en hoe wordt omgegaan met AVG en privacy. Voor simulaties is één lang bezoek niet automatisch een mislukte sessie.

## Bronnen

- [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/about/)
- [Cloudflare GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/getting-started/)
- [Cloudflare API-tokenrechten](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)

De actuele GraphQL-query staat in `scripts/publish_web_analytics.py`. De gegevensverversing staat in `.github/workflows/publish-public-analytics.yml`. De publicatie wordt getest in `tests/test_public_analytics.py`.
