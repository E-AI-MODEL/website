# HTML-galerij op eaimodel.nl

Deze dienst bewaart interactieve HTML van bezoekers. De website zelf blijft statisch. Alle ingestuurde code wordt via een afzonderlijke Cloudflare Worker en een afgeschermd browserdocument weergegeven.

## Wat er gebouwd is

- Website: `/tools/html-galerij/`.
- Publieke API: `GET /api/config`, `GET /api/uploads`, `POST /api/uploads`.
- Geïsoleerde HTML-weergave: `GET /view/{id}`.
- Database: D1 voor titel, auteur, bestandsnaam en verwijzing.
- Bestandsopslag: R2 voor de daadwerkelijke HTML.
- Cloudflare Turnstile tegen automatische uploads.
- Limiet: 2 MB per bestand, vijf uploads per bezoeker per uur.
- Statusveld `published` maakt handmatig offline halen mogelijk.

## Eenmalige installatie

1. Maak een Cloudflare D1-database `eai-html-galerij` en een R2-bucket `eai-html-galerij`.
2. Kopieer de D1-database-ID naar `wrangler.toml`.
3. Voer vanuit deze map uit:
   ```sh
   npx wrangler d1 execute eai-html-galerij --remote --file=schema.sql
   ```
4. Maak een Turnstile-widget voor `eaimodel.nl` en `www.eaimodel.nl`.
5. Stel in Cloudflare de publieke variabele `TURNSTILE_SITE_KEY` in en voeg de geheime waarde toe:
   ```sh
   npx wrangler secret put TURNSTILE_SECRET
   npx wrangler secret put RATE_LIMIT_SALT
   ```
6. Activeer via Workers Routes of Custom Domains het webadres `html.eaimodel.nl` voor deze Worker.
7. Publiceer de Worker met `npx wrangler deploy`.
8. Controleer `https://html.eaimodel.nl/api/config`, `/api/uploads`, een testupload en de geïsoleerde weergave.
9. Publiceer daarna de websitebranch met de HTML-galerij.

De pagina is vóór deze stappen bewust niet bruikbaar voor uploaden. De server weigert uploads zonder Turnstile-credentials.

## Beheer

Publicatie verwijderen uit de galerij:
```sql
UPDATE uploads SET status = 'hidden' WHERE id = 'UPLOAD_ID';
```
Voor definitieve verwijdering moet ook het bijbehorende R2-object via de Cloudflare-console of beheer-API worden verwijderd. Door het statusfilter is een verborgen upload niet langer publiek opvraagbaar.

## Beveiliging en grenzen

- JavaScript uit uploads wordt niet op de hoofdwebsite uitgevoerd. De Worker verstuurt een CSP met `sandbox` zonder `allow-same-origin` en beschermt de inhoud met `nosniff`.
- De site gebruikt een extra sandbox op de preview-iframe.
- Titel, maker en bestandsnaam worden als tekst weergegeven, niet als HTML.
- Externe afhankelijkheden zoals CDN-scripts moeten openbaar bereikbaar blijven.
- Uploads kunnen misleidende inhoud of externe verzoeken bevatten. Geen enkel HTML-uploadplatform kan dat zonder beperkingen volledig voorkomen. Beperk daarom cookies van eaimodel.nl tot host-only cookies; vermijd `Domain=.eaimodel.nl`. Gebruik voor zwaardere isolatie liever een volledig los registrabel domein voor de weergave.
- De huidige eerste versie publiceert direct na een geldige upload. Voor publieke uitrol is aanvullende moderatie, een meldknop en een beheerinterface verstandig.
- Auteursnamen zijn opgegeven namen, niet geverifieerde identiteiten.

## Controle

De implementatie is nog niet tegen een echte Cloudflare-omgeving getest. De bestanden maken geen Cloudflare-resources aan. Controleer Workers/D1/R2/Turnstile in een testomgeving voordat de dienst publiek wordt ingeschakeld.
