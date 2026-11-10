# HTML-galerij op eaimodel.nl

Deze dienst bewaart interactieve HTML van bezoekers. De website zelf blijft statisch. Alle ingestuurde code wordt via een afzonderlijke Cloudflare Worker en een afgeschermd browserdocument weergegeven.

## Wat er gebouwd is

- Website: `/tools/html-galerij/`.
- Publieke API: `GET /api/config`, `GET /api/uploads`, `POST /api/uploads`.
- Geïsoleerde HTML-weergave: `GET /view/{id}`.
- Database: D1 voor titel, auteur, bestandsnaam en HTML-inhoud.
- Bestandsopslag: D1 bewaart ook de HTML als tekst.
- Cloudflare Turnstile tegen automatische uploads.
- Limiet: 1 MB per bestand, vijf uploads per bezoeker per uur.
- Statusveld `published` maakt handmatig offline halen mogelijk.

## Eenmalige installatie

1. Gebruik de al aangemaakte Cloudflare D1-database `eai-html-galerij`.
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
6. Activeer via Workers Routes of Custom Domains het webadres `eai-html-galerij.vis-c9d.workers.dev` voor deze Worker.
7. Publiceer de Worker met `npx wrangler deploy`.
8. Controleer `https://eai-html-galerij.vis-c9d.workers.dev/api/config`, `/api/uploads`, een testupload en de geïsoleerde weergave.
9. Publiceer daarna de websitebranch met de HTML-galerij.

De pagina is vóór deze stappen bewust niet bruikbaar voor uploaden. De server weigert uploads zonder Turnstile-credentials.

## Beheer

Publicatie verwijderen uit de galerij:
```sql
UPDATE uploads SET status = 'hidden' WHERE id = 'UPLOAD_ID';
```
Voor definitieve verwijdering kun je de bijbehorende rij uit D1 verwijderen. Door het statusfilter is een verborgen upload niet langer publiek opvraagbaar.

## Beveiliging en grenzen

- JavaScript uit uploads wordt niet op de hoofdwebsite uitgevoerd. De Worker verstuurt een CSP met `sandbox` zonder `allow-same-origin` en beschermt de inhoud met `nosniff`.
- De site gebruikt een extra sandbox op de preview-iframe.
- Titel, maker en bestandsnaam worden als tekst weergegeven, niet als HTML.
- Externe afhankelijkheden zoals CDN-scripts moeten openbaar bereikbaar blijven.
- Uploads kunnen misleidende inhoud of externe verzoeken bevatten. Geen enkel HTML-uploadplatform kan dat zonder beperkingen volledig voorkomen. Beperk daarom cookies van eaimodel.nl tot host-only cookies; vermijd `Domain=.eaimodel.nl`. Gebruik voor zwaardere isolatie liever een volledig los registrabel domein voor de weergave.
- De huidige eerste versie publiceert direct na een geldige upload. Voor publieke uitrol is aanvullende moderatie, een meldknop en een beheerinterface verstandig.
- Auteursnamen zijn opgegeven namen, niet geverifieerde identiteiten.

## Controle

De implementatie is nog niet tegen een echte Cloudflare-omgeving getest. De bestanden maken geen Cloudflare-resources aan. Controleer Workers/D1/Turnstile in een testomgeving voordat de dienst publiek wordt ingeschakeld.


## Verborgen beheer zonder inloggen

Klik drie keer kort op het label **HTML-galerij** bovenaan de pagina. Bij alle bestanden verschijnt een rood kruis. Eén klik op het kruis en de daaropvolgende bevestiging verbergt het bestand. Met nog drie klikken verdwijnen de kruisjes weer.

Er is bewust geen wachtwoord of beheersleutel. **Iedere bezoeker die de handeling kent, kan bestanden verbergen.** Ook de DELETE-API is zonder geheim bereikbaar. De inhoud wordt niet definitief uit D1 gewist, maar de status wordt `hidden`: de pagina verdwijnt uit de publieke lijst en het directe adres geeft 404.

De Cloudflare Worker wordt niet automatisch bijgewerkt via de Theory7-websitepublicatie. Publiceer de huidige code uit `services/html-galerij/src/index.js` afzonderlijk via **Workers & Pages → eai-html-galerij → Edit code → Deploy**. Daarna werkt het rode kruis ook echt.

Na het publiceren: test met een onschuldig voorbeeldbestand en controleer dat de lijst en het directe HTML-adres na verbergen niet meer toegankelijk zijn.
