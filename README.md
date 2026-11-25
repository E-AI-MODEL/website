# EAI website

Publieke website van EAI: https://eaimodel.nl

De productiebron is `main`. De site wordt statisch gegenereerd met `scripts/build_site.py`.

## Bron van waarheid

De tweetalige hoofdpagina’s worden rechtstreeks onderhouden in `nl/` en `en/`; `index.html` is de Nederlandse ingang. De bijbehorende omgeleide of vernieuwde pagina’s met `class="eai-refresh"` worden eveneens als paginabron bewaard. De build behoudt deze pagina’s en hun gedeelde assets. Bewerk oudere uitlegpagina’s en hulpmiddelen in hun generator of contentbron:

- `content/workforms.json` — EAI-werkvormen
- `content/didactic-models.json` — didactische bronmodel-adapters
- `content/taalwerkvormen-page.html` — complete TAALwerkvormen-pagina
- `content/bronnen-page.html` — bronnenregister
- `content/legacy/` — vaste snapshots van historische publicaties en embeds die vroeger van de Google Site kwamen
- `scripts/build_site.py` — pagina-opbouw, navigatie, styles en sitemap

De productie-output staat in `site-build/`. De map `assets/` bevat ook rechtstreeks onderhouden bronbestanden. Rootpagina's kunnen nog nodig zijn voor de generator of GitHub Pages; verwijder ze niet zonder controle.

## Lokaal bouwen

```bash
python -m pip install beautifulsoup4
python scripts/build_site.py --sources content/legacy --out site-build
```

De build controleert of alle vereiste historische bronbestanden aanwezig zijn.

## CI en publiceren

Ontwikkel op een branch, open een pull request en merge pas na beoordeling en geslaagde verplichte controles. De merge naar de beschermde hoofdbranch is de toestemming om te publiceren.

- `site-check.yml` controleert pull requests; `validate-main.yml` valideert de hoofdversie na de merge.
- Een geslaagde main-validatie start automatisch de publicatie van het bijbehorende gecontroleerde artifact op Theory7. De publicatie controleert de bronboom, herkomst, SHA-256 en verplichte tests opnieuw, maar bouwt de website niet opnieuw.
- TOPO behoudt een afzonderlijke workflow, wachtrij en gecontroleerd artifact.
- Een verouderde, mislukte of niet van main afkomstige build kan niet worden gepubliceerd.
- Alleen voor herstel kan de eigenaar de deployworkflow handmatig starten met het nummer van een geldige main-validatie. De normale route vraagt geen tweede toestemming.
- GitHub Pages gebruikt nog een afzonderlijke publicatieprocedure. Die wordt apart beoordeeld voordat rootbestanden verdwijnen.

TAALwerkvormen en Bronnen zijn onderdeel van dezelfde generator en kunnen dus niet meer verdwijnen bij een volledige rebuild.

## Contact

LinkedIn is de primaire publieke contactroute:
https://nl.linkedin.com/in/hans-visser-92531a105
