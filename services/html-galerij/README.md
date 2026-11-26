# Beveiligde HTML-galerij op eaimodel.nl

De publieke pagina `/tools/html-galerij/` is uitsluitend een ingang. De bestanden, uploads, voorbeelden en het beheer worden aangeboden door de Cloudflare Worker `eai-html-galerij` op `https://eai-html-galerij.vis-c9d.workers.dev/`.

## Aanmelden

Er is **geen openbare registratie** en er is geen verborgen beheerstand. Alleen het e-mailadres dat als `GALLERY_ADMIN_EMAIL` is ingesteld kan inloggen, met een afzonderlijk wachtwoord. Gebruik **niet** het wachtwoord van je Microsoft 365-schoolaccount.

De Worker controleert elke API-aanvraag en elke rechtstreekse `/view/{id}`-link server-side. Een geverifieerde sessie verloopt uiterlijk na acht uur, is opgeslagen als een SHA-256-hash in D1 en wordt in de browser bewaard als `Secure; HttpOnly; SameSite=Strict`-cookie met `__Host-`-prefix. Afmelden verwijdert de sessie direct uit D1. Aanmeldpogingen hebben een limiet per client en een extra globale limiet, beide per vijftien minuten.

Het wachtwoord wordt **niet** in GitHub of de website opgeslagen. Voor deze afzonderlijke beheerlogin gebruikt de Worker PBKDF2-SHA-256 met 100.000 iteraties, een willekeurige salt van 24 bytes en een hash van 32 bytes, opgeslagen als Cloudflare Secret. Cloudflare beperkt de standaardruntime tot 100.000 iteraties; gebruik daarom uitsluitend een uniek, willekeurig wachtwoord van ten minste 24 tekens uit een wachtwoordmanager. Deze instelling is niet geschikt als algemeen advies voor gebruikersgekozen wachtwoorden. Oude hashes met 310.000 iteraties moeten opnieuw worden berekend op runtimes waar die waarde niet wordt ondersteund. Een fout in de wachtwoordcontrole geeft een aparte 503-melding; een verkeerd wachtwoord geeft 401. De inloglimieten blijven ongewijzigd.

## Uitrolstatus op 15 november 2026

De oude Worker toonde eerder HTML zonder login en kon bestanden zonder beheerdersrechten verbergen. De openbare `workers.dev`-route is tijdelijk uitgezet om die situatie te stoppen. De bestaande uploads zijn behouden.

Op 15 november is de nieuwe, beveiligde Worker met de zes ES-modules in Cloudflare gepubliceerd. De oorspronkelijke D1-binding en alle bestaande secrets zijn bewaard, inclusief de door de beheerder ingevoerde `GALLERY_PASSWORD_HASH`. De `workers.dev`-route is weer ingeschakeld; de nieuwe inlogpagina is bereikbaar op `https://eai-html-galerij.vis-c9d.workers.dev/auth/login`.

**Live zonder aanmelding gecontroleerd:** de inlogpagina laadt; de lijst `/api/uploads`, het beheeroverzicht `/api/admin/overview` en een rechtstreekse `/view/{id}`-link geven zonder sessie `Aanmelden vereist` terug. De gerichte authenticatietests en websitebuild zijn geslaagd.

**24 november:** persoonlijke aanmelding is bevestigd door de beheerder en een geldige sessie in D1. De PBKDF2-reparatie is actief. De ingestelde verifier is teruggezet van gewone variabele naar Secret, zonder de waarde te wijzigen. De anonieme productiecontrole is geslaagd. De tijdelijke D1-trigger is daarna opgeheven; de twee bestaande uploads zijn ongewijzigd gebleven.

**Uitgevoerd:** de anonieme productiecontrole en de SQLite-integratietest zijn geslaagd. Na controle van de actieve Worker is de tijdelijke trigger opgeheven. Met uitsluitend een synthetische rij zijn upload, statuswijzigingen en auditregistratie ook in productie-D1 beproefd; proefrij en proefaudit zijn verwijderd. De persoonlijke browsersessie blijft bij de beheerder. De laatste functionele stap is de echte browserproef met een proefbestand. De statische ingangen volgen na de vereiste PR-controles.

## Eenmalig activeren

De huidige Cloudflare-account heeft Cloudflare Access nog niet geactiveerd. Microsoft 365 SSO is daardoor **nog niet beschikbaar**. De onderstaande e-mail/wachtwoordroute werkt zonder Cloudflare Access en zonder een nieuwe DNS-koppeling.

1. Maak in Cloudflare de bestaande D1-database `eai-html-galerij` beschikbaar via binding `DB`. Voer de aanvullende tabellen uit met `npx wrangler d1 execute eai-html-galerij --remote --file=schema.sql` vanuit deze map. Het schema gebruikt `CREATE TABLE IF NOT EXISTS` en behoudt bestaande uploads.
2. Kies een **ander** wachtwoord dan je Microsoft 365-wachtwoord. Draai in een lokale terminal `node scripts/password-hash.mjs`. De invoer wordt niet getoond; kopieer de volledige resulterende PBKDF2-regel.
3. Stel in Cloudflare bij Worker `eai-html-galerij` onder **Settings → Variables and Secrets** deze drie secrets in:
   - `GALLERY_ADMIN_EMAIL`: het exacte e-mailadres waarmee je wilt aanmelden
   - `GALLERY_PASSWORD_HASH`: de PBKDF2-regel uit het script
   - `RATE_LIMIT_SALT`: nieuwe willekeurige geheime waarde van minimaal 32 bytes, bijvoorbeeld gegenereerd met `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
4. Publiceer de **volledige Worker-bron**, inclusief imports uit `src/auth.js` en `src/ui.js`, via `npx wrangler deploy` vanuit `services/html-galerij/`. Kopieer alleen `index.js` naar de online code-editor werkt niet, omdat de module imports dan ontbreken.
5. **Verwijder pas na deployment van de beveiligde Worker de tijdelijke blokkade in D1**: `DROP TRIGGER IF EXISTS eai_gallery_block_public_hide;`. Deze tijdelijke trigger is op 15 november 2026 geplaatst, omdat de oude Worker verwijdering zonder login toestond. De trigger blokkeert ook geldig ingelogde verwijderacties totdat hij wordt opgeheven.
6. Test zonder sessie: de aanmeldpagina moet verschijnen; `/api/uploads`, `/api/admin/uploads/{id}` en `/view/{id}` moeten toegang weigeren. Test vervolgens echte aanmelding, bekijken, upload, verbergen en afmelden. Controleer de statuscodes én het gedrag vanuit een tweede browser zonder sessie.
7. Pas na een geslaagde proef de publieke websitepagina toe. De bestaande Theory7-publicatie publiceert **niet** automatisch de Worker-code of de D1-tabellen.

De Worker sluit zonder geconfigureerde secrets of D1 de toegang af met HTTP 503. Zonder deze installatie is de nieuwe login niet werkzaam. Publiceer de statische ingang dus niet als laatste controle zonder de Worker te testen.

### Wachtwoord wijzigen en sessies intrekken

Maak lokaal een nieuwe hash aan en vervang `GALLERY_PASSWORD_HASH` in Cloudflare. Bestaande sessies worden automatisch ongeldig doordat hun token aan de oude wachtwoordhash is gekoppeld. Trek sessies indien gewenst ook administratief in met `DELETE FROM gallery_sessions;` op D1.

Er is bewust geen wachtwoordherstel per e-mail: herstel gebeurt via de beheerder van de Cloudflare-account. Bewaar het wachtwoord in een wachtwoordmanager.

## EAI Beheer, meer dan de HTML-galerij

De login beschermt nu een bredere beheeromgeving. De statische website toont een ingang op `/beheer/` en publiceert **geen** beheerdata of API-sleutels. Na inloggen op de Worker opent `/` het dashboard. De eigen HTML-werkplek staat op `/gallery`.

De volgende functies worden uit echte bronnen opgehaald:

| Onderdeel | Bron | Wat beschikbaar is |
| --- | --- | --- |
| Overzicht | Cloudflare D1, Supabase, GitHub | Bestanden, sessies, bezoekersgebeurtenissen, controlepunten |
| Bezoekers | Bestaande publieke Supabase Edge Function `eai-site-insights` | 7/30/90 dagen, dagverloop, toolklikken, populaire pagina's, apparaatgroep |
| Websitecontrole | HTTP HEAD vanaf de Worker naar Theory7 | Status van zes vaste pagina's; onbekend blijft onbekend |
| Publicaties | Openbare GitHub API | Commit op main, status laatste Theory7-deployment en de laatste build-/websitetests; geen automatische publicatie |
| HTML-beheer | Cloudflare D1 | Bestanden bekijken, online/offline halen en verborgen uploads herstellen |
| Beveiliging | Cloudflare D1 | Actieve sessies, recente aanmeldpogingen, alle sessies intrekken |
| Logboek | Cloudflare D1 | Handelingen van de beheerder zonder persoonsgegevens van bezoekers |

De externe bronnen worden server-side opgehaald. Het dashboard heeft **geen** GitHub-token, Cloudflare-accounttoken, Supabase-servicekey, DNS-bewerkrechten of LEIF-accounts. Automatische controles bieden geen bewijs dat een HTML-simulatie fysisch klopt of dat iedere mobiele interactie goed werkt. De bezoekersmetingen registreren geen unieke personen of bouncepercentage.

### Beheer-API (alleen aangemelde beheerder)

- `GET /api/admin/overview`, `/traffic?days=7|30|90`, `/health`, `/deploy`, `/files?status=all|published|hidden`, `/audit`
- `POST /api/admin/files/{id}/restore` voor één verborgen bestand
- `POST /api/admin/sessions/revoke` om alle sessies af te melden
- `DELETE /api/admin/uploads/{id}` om een gepubliceerd bestand offline te halen (oude route, nu ook afgeschermd)

Elke mutatie gebruikt een server-side sessie, een juiste `Origin` en een SQL-transactie met auditregistratie. Er zijn geen generieke SQL-, code-uitvoer-, shell-, GitHub-write- of Cloudflare-instellingenroutes beschikbaar.

### Extra databasevoorbereiding

De tabel `site_admin_audit` en de index zijn op 15 november 2026 in de bestaande D1-database toegevoegd en staan tevens in `schema.sql`. De tijdelijke blokkade `eai_gallery_block_public_hide` mag pas worden opgeheven na controle van de actieve Worker, de persoonlijke aanmelding en anonieme toegang.

De Worker en dashboardmodule moeten samen gedeployed worden. Alleen bestanden uit de websitebuild op Theory7 publiceren is niet voldoende.

## Uitbreidingen voor later

Meer geavanceerd beheer, zoals echte WAF-resultaten, Cloudflare-prestaties, controle van live browsergedrag, DNS, meldingen en veilige publicatie vanuit het dashboard, vraagt aparte server-side koppelingen, gerichte rechten en tests. Die functies zijn nog **niet** actief. LEIF-beheer blijft een zelfstandige, gescheiden omgeving.

## Techniek en grenzen

- Geaccepteerd: UTF-8 HTML-bestanden van maximaal 1 MB; vijf uploads per uur per client; de bron wordt als tekst in D1 bewaard.
- Elk voorbeeld heeft een sandbox-CSP zonder `allow-same-origin`, een iframe-sandbox en `nosniff`. HTML kan externe inhoud downloaden. Open geen bestanden die vertrouwelijke informatie bevatten.
- Openbare CORS-toegang is verwijderd. Wijzigingen vereisen een juiste `Origin`-header en een geldige sessie.
- Niet ingelogde bezoekers kunnen geen titels, uploads of voorbeelden ophalen. Er is geen openbare lijst.
- De systeembeheerder is de enige rol. Voor een latere galerie met meerdere eigenaren is een aparte gebruikers- en rechtenstructuur nodig.
- De Worker heeft geen automatisch moderatiesysteem, virusscan of beveiligingsreview door derden gekregen.
- Test: `node tests/test_html_galerij_admin.mjs` vanaf de repository-root. De publicatieproef is `python -m unittest discover -s tests -p test_html_galerij_publish.py` na de websitebuild.

## Later Microsoft 365

Microsoft Entra ID kan via Cloudflare Access worden gekoppeld zodra Access in de Cloudflare-account is geactiveerd en er toestemming is voor een app-registratie in de schooltenant. Configureer daarna een beleid voor **uitsluitend de bedoelde gebruiker of groep**. Cloudflare Access vervangt dan na een aparte geteste codewijziging de wachtwoordroute. Een geverifieerd domein of `@emmauscollege.nl` alleen geeft geen beheerrecht.

Officiële handleidingen:
- https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/entra-id/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/


## Verificatie 24 november 2026

- De actieve Worker heeft de zes JavaScript-modules van commit `6a330185`. De persoonlijke login is bevestigd; de D1-database bevatte één geldige sessie.
- Versie `ea714a56-94eb-4170-8ee4-ce7b399cf40e` is actief met dezelfde code, dezelfde D1-binding en de bestaande wachtwoordhash als Secret. De wachtwoordwaarde en andere bindings zijn niet gewijzigd.
- Theory7-run [45420474355](https://github.com/E-AI-MODEL/website/actions/runs/45420474355) is geslaagd voor hoofdcommit `003d46f`, inclusief productiecontroles.
- Het vernieuwde publicatiedashboard leest jobs van één Theory7-run, kiest de huidige hoofdcommit wanneer die beschikbaar is, en toont nooit een oudere geslaagde run als bevestiging voor een nieuwere commit. Onvolledige jobs blijven onbekend. Dit is actief in Worker-versie `85c03b53-5260-441f-b7a2-583443d50090` op 100% verkeer. Alleen `admin.js` en `admin-client.js` zijn gewijzigd; de aanmelding en databasebinding zijn behouden.
- Nieuwe SQLite-integratietest met synthetische gegevens: inloggen, uploaden, afgeschermd bekijken, verbergen, herstellen, terugrollen bij een SQL-fout, logboek en afmelden. De aparte anonieme productietest gebruikt geen echte bestands-ID's of inloggegevens. Beide tests zijn geslaagd in [run 45425162462](https://github.com/E-AI-MODEL/website/actions/runs/45425162462). De productieproef zonder sessie betrof de voorafgaande versie met exact dezelfde authenticatie- en bestandsroutes. Na dashboarduitrol is de persoonlijke browserproef nog nodig.

De productie-D1-proef doorliep published → hidden → published met drie bijbehorende auditregels. Na afloop waren de twee oorspronkelijke bestanden en hun statussen onveranderd; nul synthetische upload- of auditregels bleven achter. De tijdelijke trigger is afwezig. Na de dashboarduitrol is één geldige sessie geteld. De actuele hoofdversie kan inmiddels gewijzigd zijn door andere PR's.
