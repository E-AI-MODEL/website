# Science Observatory: proefpublicatie

Dit is de publieke proefbibliotheek voor natuurkunde en wiskunde A/B. De oorspronkelijke Galactische HTML is als zelfstandig bestand opgenomen.

## Onderscheid tussen beheer en publiek

De publieke pagina en vijf onderzoeksmodellen bevatten uitsluitend onderzoeks- en leerfuncties. Er staat geen beheeraccount, publicatietoken of opslagservice in. Docentbeheer en broncontrole blijven buiten deze publieksroute.

## Bestanden

- `landing.html`: bron voor de catalogus op `/tools/science-observatory/`.
- `labs/melkweg.html`: de oorspronkelijke referentie, inhoudelijk niet gewijzigd.
- `labs/gravitatie-banen.html`, `labs/natuurkunde.html`, `labs/wiskunde-a.html`, `labs/wiskunde-b.html`: bestaande proefmodellen.
- `scripts/build_site.py` neemt de bestanden op in de productiebuild; de uitvoermap `tools/` is geen bron.

## Grenzen

De proefmodellen hebben niet allemaal dezelfde wetenschappelijke diepgang. Meer dan 50 eerdere compacte labvarianten worden niet automatisch als afgeronde simulaties gepubliceerd. De officiële eindtermen en schoolse verdeling over vwo 5/6 worden pas definitief gekoppeld na toetsing aan het PTA. De site bewaart geen leerlingantwoorden centraal.

## Aanpassen en publiceren

Bewerk de bronnen onder `content/science-observatory/`. Controleer de modellen en laat de websitebuild en browsertests slagen. Publicatie volgt pas na review en merge van de betreffende PR.