# EAI website — actuele architectuur

Status: productiearchitectuur voor `main`.

## Doel

De site helpt een bezoeker vanuit een concrete onderwijs- of ontwerpvraag naar:

1. een scherpere analyse van leren en AI;
2. een passende werkvorm;
3. een bestaand didactisch model als ingang waar relevant;
4. bronnen, onderbouwing en publicaties voor verdieping.

De site is geen versie-archief en geen losse verzameling AI-tools.

## Hoofdnavigatie

- EAI
- Werkvormen
- TAALwerkvormen
- Verdieping
- Bronnen
- Over
- LinkedIn als primaire externe contactroute

E-mail is alleen een rustige fallback op de Over-pagina.

## Inhoudelijke lagen

### EAI Toolbox

57 EAI-werkvormen. De bezoeker kan starten vanuit een gewone onderwijsvraag of vanuit een ondersteund didactisch bronmodel. De toolbox biedt zoeken, filters, bewaren en inhoudelijk aansluitende vervolgstappen.

### TAALwerkvormen

Zelfstandige verzameling van 15 complete werkvormkaarten uit TAALwerkvormen Emmauscollege v11, inclusief achtergrond, bewijs van leren, redo en volledige LLM-prompts.

### Didactische modellen

EAI herschrijft bronmodellen niet. De huidige modelingangen gebruiken de termen, fasen en functies van hun bronmodel en voegen EAI-vragen als aparte analysetlaag toe.

### Onderbouwing en Bronnen

`/onderbouwing/` legt de redenering en grenzen van claims uit.

`/bronnen/` is het bronregister. Het maakt onderscheid tussen:
- bronmodel;
- onderbouwend onderzoek;
- EAI-ontwerpvertaling.

Een onderliggende bron maakt een specifieke EAI-werkvorm niet automatisch wetenschappelijk gevalideerd.

## Redactionele lijn

- gewone Nederlandse onderwijstaal voorop;
- technische EAI-termen pas in een tweede laag;
- geen antropomorf AI-taalgebruik;
- geen sterkere claims dan de bronnen dragen;
- een eindproduct niet verwarren met bewijs van zelfstandig leren of professioneel oordeel;
- bronmodel en EAI-ontwerpkeuze expliciet uit elkaar houden.

## Visuele lijn

- rustige, redactionele vormgeving;
- groot en leesbaar;
- veel witruimte zonder slide-deck-ritme;
- compacte kaarten voor keuzes en acties;
- diagrammen alleen waar ze een onderscheid verduidelijken;
- geen decoratieve AI-beelden;
- dezelfde inhoudsvolgorde op desktop en mobiel.

## Technische bron van waarheid

De website wordt volledig vanuit de repository gebouwd.

Belangrijkste bronnen:
- `content/workforms.json`
- `content/didactic-models.json`
- `content/taalwerkvormen-page.html`
- `content/bronnen-page.html`
- `content/legacy/`
- `scripts/build_site.py`

Historische publicatie-embeds zijn als vaste snapshots onder `content/legacy/` opgenomen. De build crawlt de oude Google Site niet meer.

## Build en validatie

`.github/workflows/build-site.yml`:

1. installeert alleen de noodzakelijke Python-builddependency;
2. bouwt de volledige statische site;
3. controleert interne links;
4. publiceert alleen op `main`.

Pull requests krijgen dezelfde build- en linkcontrole zonder productie-output te publiceren.

## Wijzigingsregel

Bewerk structurele inhoud in de bronbestanden. Gegenereerde HTML mag alleen rechtstreeks worden aangepast wanneer die wijziging óók in de generator of broncontent wordt vastgelegd. Zo blijft een volledige rebuild gelijkwaardig aan de gepubliceerde site.
