# Science Observatory: proefpublicatie

Dit is de publieke proefbibliotheek voor natuurkunde en wiskunde A/B. De oorspronkelijke Galactische HTML is als zelfstandig bestand opgenomen.

## Onderscheid tussen beheer en publiek

De publieke pagina en vijf onderzoeksmodellen bevatten uitsluitend onderzoeks- en leerfuncties. Er staat geen beheeraccount, publicatietoken of opslagservice in. Docentbeheer en broncontrole blijven buiten deze publieksroute.

## Bestanden

- `landing.html`: bron voor de catalogus op `/tools/science-observatory/`.
- `labs/melkweg.html`: de oorspronkelijke referentie, inhoudelijk niet gewijzigd.
- `labs/gravitatie-banen.html`, `labs/wiskunde-a.html`, `labs/wiskunde-b.html`: bestaande proefmodellen.
- `labs/natuurkunde.html`: natuurkunde V3 met 53 interactieve onderwijsmodellen, een onderzoekswerkruimte met tabbladen en beperkte directe manipulatie/3D-bediening.
- `scripts/build_site.py` neemt de bestanden op in de productiebuild; de uitvoermap `tools/` is geen bron.

## Grenzen

De proefmodellen hebben niet allemaal dezelfde wetenschappelijke diepgang. De 53 natuurkundeonderwerpen zijn in deze versie zichtbaar en bedienbaar, maar niet allemaal afzonderlijk inhoudelijk gevalideerd. Het Galactisch Observatorium blijft het referentieniveau voor een rijke onderzoeksomgeving. De officiële eindtermen en schoolse verdeling over vwo 5/6 worden pas definitief gekoppeld na toetsing aan het PTA. De site bewaart geen leerlingantwoorden centraal.

## Aanpassen en publiceren

Bewerk de bronnen onder `content/science-observatory/`. Controleer de modellen en laat de websitebuild en browsertests slagen. Publicatie volgt pas na review en merge van de betreffende PR.
## Navigatie

Science Observatory blijft bereikbaar onder `/tools/science-observatory/`. Van daaruit opent natuurkunde onder `/tools/science-observatory/labs/natuurkunde/`. De afzonderlijke proeven hebben directe hash-links. De Nederlandse en Engelstalige Tools-pagina's verwijzen naar de observatoria onder een eigen rubriek. Het publieke deel bevat alleen proef- en leerfuncties; beheer en publicatie horen niet in deze leerlingenpagina.

Bij wijzigingen aan de catalogus of het menu draait `node --test tests/test_science_observatory_navigation.mjs` mee in de sitecontrole.

## Rekenkundige controles (november 2026)

De automatische test `tests/test_science_physics_models.mjs` opent de rekenmodellen van alle 53 proefonderwerpen en vergelijkt geselecteerde uitkomsten met zelfstandig te berekenen referentiegevallen. De test controleert onder andere hydrostatische druk, worpbeweging, lenzen/wet van Snellius, elektrische weerstand, magnetisch veld, tijdrek en Bragg-reflectie.

Drie concrete fouten zijn hersteld:

- Bij een drijvend lichaam is de opwaartse kracht in evenwicht gelijk aan het gewicht; het maximale waterverplaatsingsvolume wordt alleen bij volledige onderdompeling gebruikt.
- De intensiteit precies midden tussen twee gelijke coherente bronnen hangt bij een nul-weglengteverschil van hun faseverschil af.
- De verticale positie van het getekende gewicht van een ideale veer volgt nu ook de ingestelde amplitude.

De controles bewijzen geen volledige natuurkundige validatie van alle situaties. De schema's en grafieken van de andere proeven worden nog per onderwerp inhoudelijk nagezien.
