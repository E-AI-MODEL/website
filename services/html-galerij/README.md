# Beveiligde HTML-galerij op eaimodel.nl

De publieke pagina \`/tools/html-galerij/\` is uitsluitend een ingang. De bestanden, uploads, voorbeelden en het beheer worden aangeboden door de Cloudflare Worker \`eai-html-galerij\` op \`https://eai-html-galerij.vis-c9d.workers.dev/\`.

## Aanmelden

Er is **geen openbare registratie** en er is geen verborgen beheerstand. Alleen het e-mailadres dat als \`GALLERY_ADMIN_EMAIL\` is ingesteld kan inloggen, met een afzonderlijk wachtwoord. Gebruik **niet** het wachtwoord van je Microsoft 365-schoolaccount.

De Worker controleert elke API-aanvraag en elke rechtstreekse \`/view/{id}\`-link server-side. Een geverifieerde sessie verloopt uiterlijk na acht uur, is opgeslagen als een SHA-256-hash in D1 en wordt in de browser bewaard als \`Secure; HttpOnly; SameSite=Strict\`-cookie met \`__Host-\`-prefix. Afmelden verwijdert de sessie direct uit D1. Aanmeldpogingen hebben een limiet per client en een extra globale limiet, beide per vijftien minuten.

Het wachtwoord wordt **niet** in GitHub of de website opgeslagen. De Worker ontvangt alleen een met PBKDF2-SHA-256 en 310.000 iteraties berekende, gezouten hash via een geheim in Cloudflare.

## Eenmalig activeren

De huidige Cloudflare-account heeft Cloudflare Access nog niet geactiveerd. Microsoft 365 SSO is daardoor **nog niet beschikbaar**. De onderstaande e-mail/wachtwoordroute werkt zonder Cloudflare Access en zonder een nieuwe DNS-koppeling.

1. Maak in Cloudflare de bestaande D1-database \`eai-html-galerij\` beschikbaar via binding \`DB\`. Voer de aanvullende tabellen uit met \`npx wrangler d1 execute eai-html-galerij --remote --file=schema.sql\` vanuit deze map. Het schema gebruikt \`CREATE TABLE IF NOT EXISTS\` en behoudt bestaande uploads.
2. Kies een **ander** wachtwoord dan je Microsoft 365-wachtwoord. Draai in een lokale terminal \`node scripts/password-hash.mjs\`. De invoer wordt niet getoond; kopieer de volledige resulterende PBKDF2-regel.
3. Stel in Cloudflare bij Worker \`eai-html-galerij\` onder **Settings → Variables and Secrets** deze drie secrets in:
   - \`GALLERY_ADMIN_EMAIL\`: het exacte e-mailadres waarmee je wilt aanmelden
   - \`GALLERY_PASSWORD_HASH\`: de PBKDF2-regel uit het script
   - \`RATE_LIMIT_SALT\`: nieuwe willekeurige geheime waarde van minimaal 32 bytes, bijvoorbeeld gegenereerd met \`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"\`
4. Publiceer de **volledige Worker-bron**, inclusief imports uit \`src/auth.js\` en \`src/ui.js\`, via \`npx wrangler deploy\` vanuit \`services/html-galerij/\`. Kopieer alleen \`index.js\` naar de online code-editor werkt niet, omdat de module imports dan ontbreken.
5. Test zonder sessie: de aanmeldpagina moet verschijnen; \`/api/uploads\`, \`/api/admin/uploads/{id}\` en \`/view/{id}\` moeten toegang weigeren. Test vervolgens echte aanmelding, bekijken, upload, verbergen en afmelden. Controleer de statuscodes én het gedrag vanuit een tweede browser zonder sessie.
6. Pas na een geslaagde proef de publieke websitepagina toe. De bestaande Theory7-publicatie publiceert **niet** automatisch de Worker-code of de D1-tabellen.

De Worker sluit zonder geconfigureerde secrets of D1 de toegang af met HTTP 503. Zonder deze installatie is de nieuwe login niet werkzaam. Publiceer de statische ingang dus niet als laatste controle zonder de Worker te testen.

### Wachtwoord wijzigen en sessies intrekken

Maak lokaal een nieuwe hash aan, vervang \`GALLERY_PASSWORD_HASH\` in Cloudflare en trek actieve sessies in met \`DELETE FROM gallery_sessions;\` op D1. Wachtwoordrotatie alleen beëindigt bestaande sessies niet.

Er is bewust geen wachtwoordherstel per e-mail: herstel gebeurt via de beheerder van de Cloudflare-account. Bewaar het wachtwoord in een wachtwoordmanager.

## Techniek en grenzen

- Geaccepteerd: UTF-8 HTML-bestanden van maximaal 1 MB; vijf uploads per uur per client; de bron wordt als tekst in D1 bewaard.
- Elk voorbeeld heeft een sandbox-CSP zonder \`allow-same-origin\`, een iframe-sandbox en \`nosniff\`. HTML kan externe inhoud downloaden. Open geen bestanden die vertrouwelijke informatie bevatten.
- Openbare CORS-toegang is verwijderd. Wijzigingen vereisen een juiste \`Origin\`-header en een geldige sessie.
- Niet ingelogde bezoekers kunnen geen titels, uploads of voorbeelden ophalen. Er is geen openbare lijst.
- De systeembeheerder is de enige rol. Voor een latere galerie met meerdere eigenaren is een aparte gebruikers- en rechtenstructuur nodig.
- De Worker heeft geen automatisch moderatiesysteem, virusscan of beveiligingsreview door derden gekregen.
- Test: \`node tests/test_html_galerij_admin.mjs\` vanaf de repository-root. De publicatieproef is \`python -m unittest discover -s tests -p test_html_galerij_publish.py\` na de websitebuild.

## Later Microsoft 365

Microsoft Entra ID kan via Cloudflare Access worden gekoppeld zodra Access in de Cloudflare-account is geactiveerd en er toestemming is voor een app-registratie in de schooltenant. Configureer daarna een beleid voor **uitsluitend de bedoelde gebruiker of groep**. Cloudflare Access vervangt dan na een aparte geteste codewijziging de wachtwoordroute. Een geverifieerd domein of \`@emmauscollege.nl\` alleen geeft geen beheerrecht.

Officiële handleidingen:
- https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/entra-id/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
