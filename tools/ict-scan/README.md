# Schoolbrede ICT-scan

Een zelfstandige pagina van de EAI-website. Geen bronbestanden, tokens, wachtwoorden, persoonsgegevens, boekingsregels of andere schoolinhoud worden naar GitHub of naar een server verstuurd. De import, de controles en de exports draaien in het browservenster.

## Gebruik

De route staat niet in de gewone website-navigatie of de sitemap. De pagina begint met de standaard 404-weergave. Klik op de eerste 4 en voer de afgesproken toegangsnaam in. Dit is een verborgen ingang, geen authenticatie of beveiliging van de broncode.

Open een of meer bestanden via Bronnen en export. Op het overzicht staan de aantallen en de verdelingen. Toepassingen en AI-functies zijn gescheiden van Entra-registraties en onderliggende productonderdelen. Controles met gelijke ID worden samengevoegd en de bronregels blijven herkenbaar. Nieuwe onderzoekssignalen staan apart. Er kan een XLSX, JSON of PDF via het afdrukvenster worden gemaakt.

## Ondersteunde bestanden

- .xlsx: Excel-werkbladen met herkende kolomnamen, inclusief verborgen bronbladen.
- .csv: komma, puntkomma of tab, met aanhalingstekens en meerrijige inhoud.
- .json: tabellen en Microsoft Graph-export met `value`-lijst, of een export uit deze tool.
- .docx: tekst uit Word lokaal lezen; nog geen geautomatiseerd juridisch oordeel.
- .pdf: bronregistratie, geen automatische inhoudsextractie.

Het dashboard start leeg. Er worden geen aantallen of controles verzonnen. Categorieen en namen komen uit de ingevoerde bestanden. De 2026-ICT-registratie levert alleen mogelijke toepassingen op; het systeem verwijdert alle financiële velden en gebruikt die niet in de rapportages. Een vermelding is geen bewijs van gebruik.

## Grenzen

De toegangscode is zichtbaar in publieke JavaScript en is niet geschikt als toegangsbeveiliging voor serverdata. Bestanden worden nergens opgeslagen en zijn na herladen verdwenen. De site heeft geen toegang tot de live Microsoft 365-tenant. Een Entra-registratie is geen bewijs van een actieve gegevenskoppeling. Juridische verwijzingen zijn niet automatisch juridisch advies. DPIA-beoordelingen hebben een bewijsstatus en vragen lokale verificatie. Publicatie op een openbaar domein maakt de code openbaar, niet de lokaal ingelezen inhoud.

De pagina laadt geen externe JavaScript-bibliotheken, analytics of lettertypen. De CSP verbiedt netwerkverzoeken vanuit JavaScript. Exports worden lokaal gegenereerd. PDF loopt via het afdrukvenster van de browser.

## Controle

De bronparser is getest met een echte inventarisbestand (69 toepassingen, 76 AI-functies, 93 Entra-registraties, 27 productonderdelen, 10 DPIA-bronregels, 22 AI-beheerregels) en de ICT-registratie 2026. In de controlelijst werden 184 regels met 151 unieke ID's gevonden. De gegenereerde XLSX is opnieuw geopend met openpyxl. De uiteindelijke pagina moet nog in Safari en Chrome op een regulier werkstation worden beproefd. Voordat de site beschikbaar wordt gemaakt, moet de bronpublicatie in de websitebuild zijn opgenomen en de bestaande publicatietests slagen.