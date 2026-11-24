# Onderwijs in · HTML-overdracht voor House of Talents

Dit is een **los overdrachtspakket**, niet de productiepagina van eaimodel.nl. De originele EAI-pagina en de bronbestanden blijven ongewijzigd.

## Inhoud

- `index.html` · zelfstandig overzicht met **Overzicht, Tekst, Pijplijn en 3D**, zoekfunctie, bronlinks en de keuze **Gewone taal / Technisch**.
- `3d/index.html` · de bijbehorende interactieve 3D-schets. Dit is een **historisch concept** met deels onbevestigde relaties, geen geverifieerde architectuur.

## Gebruik

Plaats de complete map op een statische webserver. De pagina verwijst met een **relatief pad** naar `./3d/index.html`. De 3D-schets verwijst terug naar `../index.html#overzicht`. De EAI-header, footer en site-CSS zijn niet nodig.

Lokaal testen kan vanuit deze map, bijvoorbeeld met:

```bash
python -m http.server 8000
```

Open daarna `http://localhost:8000/`. Voor de 3D-weergave is internettoegang nodig: Three.js wordt geladen via `cdn.jsdelivr.net` en een lettertype via Google Fonts. De overige overzichten gebruiken inline CSS, JavaScript en JSON.

## Inhoudelijke grenzen

- Peildatum van de hoofd-inventarisatie: **19 oktober 2026** (18 publieke GitHub-repositories). Dit is **geen live synchronisatie**.
- De 3D-schets gebruikt deels gegevens met oudere controledatums, waaronder **26 september 2026**, en bevat aannames. Behandel de 3D-relaties niet als aangetoonde productieverbindingen.
- **Openbare code bewijst niet dat software in productie draait.** Labels, bronnen en beperkingen blijven bewust behouden.
- Niet gemaakt of goedgekeurd door Stichting Onderwijs in; geen toegang tot private repositories, accounts of serverconfiguratie.
- Externe links wijzen naar de feitelijke websites of GitHub-bronnen, niet naar EAI.
- De overdrachtsversie bevat **geen EAI-branding, geen navigatie van eaimodel.nl, geen analytics en geen externe EAI-stylesheets**.

## Wat is aangepast ten opzichte van de bron?

- EAI-label bovenaan neutraler gemaakt; verwijzing naar EAI in de bronverantwoording verwijderd.
- Beide 3D-verwijzingen omgezet naar relatieve bestanden; de teruglink in de 3D-schets eveneens.
- Alleen een minimale reset van browsermarges toegevoegd. Overige inhoud, repositorygegevens, bronbeperkingen, filters, tabs en interactie zijn inhoudelijk niet aangepast.
- Geen naam, merk of auteurschap van House of Talents toegevoegd.

## Bron en onderhoud

De werkversie is afgeleid van `content/legacy/onderwijsin-embed1.html` en `onderwijsin/3d/index.html` in de repository `E-AI-MODEL/website`. Wijzigingen voor House of Talents kunnen binnen deze map plaatsvinden zonder de gepubliceerde EAI-pagina te veranderen.

Controleer inhoudelijke beweringen opnieuw voor publicatie onder een andere afzender. Voor nieuwe of gewijzigde claims zijn actuele broncontrole en afstemming met de betrokken organisatie nodig.
