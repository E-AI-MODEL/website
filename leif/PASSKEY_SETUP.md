# LEIF-beheer: Face ID via passkeys

Status: **onvoltooid concept, niet gepubliceerd**. De huidige LEIF-productieomgeving blijft ongewijzigd. De browser- en servercode zijn voorbereid; integratie, authentieke registratie, iPhone-test en beveiligingscontrole ontbreken.

## Gewenst gedrag
- De bestaande toegangscode `VIS` selecteert de beheerdersroute, maar is **geen bewijs van identiteit**.
- De beheerder kiest `Open beheer met Face ID` (op andere apparaten: de bijbehorende passkeycontrole).
- Supabase Auth controleert de cryptografische handtekening van de passkey en geeft alleen dan een geldige gebruikerssessie terug.
- De LEIF-server controleert vervolgens opnieuw dat het account lid is van de tenant `leif` met rol `manager`, vóór er beheerdata worden teruggegeven.
- Er is bij volgende aanmeldingen geen e-mail of wachtwoord nodig. Gebruikers zonder geregistreerde passkey krijgen geen toegang.

## Eenmalige activatie
Een passkey registreren voor een bestaand Supabase Auth-account **vereist een reeds geldige sessie van dat account**. Een open Supabase Dashboard-sessie is niet automatisch een Supabase Auth-sessie voor LEIF. Face ID kan dus niet rechtstreeks worden geregistreerd op grond van de tekst `VIS` of het openen van de Supabase AI Assistant.

De eerste koppeling moet plaatsvinden terwijl de bestaande manageridentiteit aantoonbaar is bevestigd, bijvoorbeeld via een al geldige LEIF-sessie of een eenmalige, door de projectbeheerder veilig gegenereerde Auth-link zonder e-mail. Pas daarna kan de iPhone een passkey registreren. Er mogen nooit API-geheimen, herstelcodes of Auth-links in GitHub of deze chat worden geplaatst.

## Supabase-instellingen (nog niet uitgevoerd)
1. Open `Authentication → Passkeys` en controleer of de functie voor dit project beschikbaar is. Het is een experimentele functie.
2. Configureer `Relying Party ID`: `eaimodel.nl`.
3. Configureer toegestane origins: `https://eaimodel.nl`, eventueel ook `https://www.eaimodel.nl` wanneer die host voor beheer wordt gebruikt.
4. De Relying Party ID later wijzigen maakt bestaande passkeys ongeldig.

## Technische voorbereiding
- `leif/passkey-client.js` bevat de WebAuthn-stappen in de browser en bewaart geen sleutel.
- `leif/multitenant/edge-passkey.ts` bevat vier serveracties voor start en afronding van registratie en aanmelden. Deze controleren de bestaande LEIF-managerrechten. De functie is **niet gedeployed** en de werking is **niet getest op een echt Supabase-project**.
- De bestaande serverautoriteit bij lezen, opslaan en publiceren van persoonlijke dossiers moet ongewijzigd blijven.
- `leif/passkey-client.js` is op de startpagina geladen, maar de bestaande `VIS`-afhandeling vraagt nog steeds een e-maillink. De verbinding met de passkeyclient is **nog niet gereed**. Pas na veilige accountregistratie, een geslaagde E2E-test en expliciete publicatietoestemming mag de oude route worden verwijderd.
- De onvoltooide wachtwoordwijzigingen in PR #99 zijn nadrukkelijk **niet** de gewenste oplossing en mogen niet worden samengevoegd.

## Vereiste tests vóór publicatie
- Zonder passkey geen sessie en geen beheergegevens.
- Een passkey voor een account zonder `leif`-managerrol opent geen beheer.
- Eerste registratie zonder geldige managersessie wordt geweigerd.
- Een geldige managersessie kan de eigen passkey registreren, maar niet die van anderen.
- Een geannuleerde Face ID-vraag geeft geen toegang; geen wachtwoord- of e-mailaanvraag als fallback bij normale login.
- Bestaande KEI-, LIS- en deelnemercodes blijven werken.
- Mobiele iPhone/Safari-test en Chromium-test.
- De passkey-configuratie is daadwerkelijk ingeschakeld in het Supabase-project.

Bron: https://supabase.com/docs/guides/auth/passkeys
