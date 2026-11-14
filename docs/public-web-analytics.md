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

## Bronnen

- [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/about/)
- [Cloudflare GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/getting-started/)
- [Cloudflare API-tokenrechten](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)

De actuele GraphQL-query staat in `scripts/publish_web_analytics.py`. De gegevensverversing staat in `.github/workflows/publish-public-analytics.yml`. De publicatie wordt getest in `tests/test_public_analytics.py`.
