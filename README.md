# EAI website

Publieke website van EAI: https://eaimodel.nl

De productiebron is `main`. De site wordt statisch gegenereerd met `scripts/build_site.py`.

## Bron van waarheid

Bewerk voor nieuwe inhoud zoveel mogelijk de bronbestanden, niet de gegenereerde HTML:

- `content/workforms.json` — EAI-werkvormen
- `content/didactic-models.json` — didactische bronmodel-adapters
- `content/taalwerkvormen-page.html` — complete TAALwerkvormen-pagina
- `content/bronnen-page.html` — bronnenregister
- `content/legacy/` — vaste snapshots van historische publicaties en embeds die vroeger van de Google Site kwamen
- `scripts/build_site.py` — pagina-opbouw, navigatie, styles en sitemap

De mappen zoals `werkvormen/`, `taalwerkvormen/`, `bronnen/`, `publicaties/` en `assets/` zijn gegenereerde productie-output.

## Lokaal bouwen

```bash
python -m pip install beautifulsoup4
python scripts/build_site.py --sources content/legacy --out site-build
```

De build controleert of alle vereiste historische bronbestanden aanwezig zijn.

## CI en publiceren

`.github/workflows/build-site.yml` draait:

- op iedere pull request naar `main` wanneer build- of contentbronnen wijzigen;
- op relevante pushes naar `main`;
- handmatig via `workflow_dispatch`.

De workflow:

1. bouwt de volledige site uit de repo;
2. controleert alle interne links;
3. publiceert de gegenereerde bestanden alleen vanaf `main`.

TAALwerkvormen en Bronnen zijn onderdeel van dezelfde generator en kunnen dus niet meer verdwijnen bij een volledige rebuild.

## Contact

LinkedIn is de primaire publieke contactroute:
https://nl.linkedin.com/in/hans-visser-92531a105
