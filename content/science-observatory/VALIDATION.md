# Wetenschappelijke controle van de observatoria

Deze benchmark controleert de bestaande berekeningen zonder het publieksmodel te wijzigen.

## Drie afzonderlijke vragen

1. Voert de browser de gekozen formules correct uit? De werkelijke JavaScript-functies uit de HTML worden uitgevoerd en vergeleken met galpy (Miyamoto–Nagai, Hernquist, NFW, cirkelbaansnelheid, periode en illustratieve Toomre-Q). Negen parametercombinaties, inclusief de uiterste waarden van de schuifregelaars, worden getest over 1–20 kpc, plus de meetstralen.
2. Hoe goed past het standaardmodel bij de waarnemingen? Alle 8 gepubliceerde punten uit Põder et al. (2023), tabel 1, en alle 12 punten uit Feng et al. (2026), tabel 1, worden vergeleken met het bestaande model én galpy's MWPotential2014 op diens gebruikelijke schaal (R0=8 kpc, v0=220 km/s). Geen herijking of selectie van gunstige punten. MAE, RMSE, MAPE, gemiddelde afwijking en het aantal binnen de gepubliceerde intervallen worden afzonderlijk gerapporteerd. De onzekerheden in beide artikelen hebben een andere betekenis; we berekenen geen gezamenlijke chi-kwadraattoets. De vergelijking is geen blinde validatie: Põder was al een bron van de toepassing en de andere meetreeks is bekend.
3. Klopt de meetkundige reconstructie van Leeuw? Astropy berekent onafhankelijk de negen afstanden en 36 onderlinge hoeken en afstanden uit dezelfde opgenomen astrometrische gegevens. Dit bevestigt geen nieuwe catalogusmetingen, noch de nauwkeurigheid van de langetermijnbeweging.

## Uitvoeren

```sh
python -m pip install -r tests/requirements-astronomy.txt
python scripts/validate_astronomy.py
```

Node 22 en Python 3.11; alle rekenbibliotheken draaien uitsluitend in de testomgeving, niet bij de bezoeker. De workflow maakt een Markdown-rapport, JSON met alle uitkomsten en CSV met alle meetpunten, inclusief SHA-256 van de twee bron-HTML-bestanden. Een numerieke afwijking buiten de vooraf gekozen toleranties laat de test falen. Een afwijking van de metingen blijft zichtbaar in het rapport; die wordt niet verborgen door een falende meting uit te sluiten of de parameters tijdens de test te veranderen.

## Bronnen

- [Põder et al. (2023), A&A 676 A134, tabel 1](https://doi.org/10.1051/0004-6361/202346474)
- [Feng et al. (2026), MNRAS 546(2), stag011, tabel 1](https://doi.org/10.1093/mnras/stag011)
- [galpy, MWPotential2014 en potentiaalmodellen](https://docs.galpy.org/en/v1.11.0/reference/potential.html)
- [Astropy SkyCoord](https://docs.astropy.org/en/stable/api/astropy.coordinates.SkyCoord.html)

De twee meetreeksen zijn afgeleid uit waarnemingen met verschillende tracers; ze hoeven niet dezelfde kleine structuur in de rotatiekromme te tonen. De vergelijking met MWPotential2014 zegt niets over de volledige kwaliteit van andere software, de nauwkeurigheid van de afgebeelde sterpopulaties of het mobiele gebruiksgemak. Hiervoor zijn aparte tests nodig.

## Referentie voor regressies

Het bestand tests/fixtures/astronomy-baseline.json bevat de ongeronde waarden uit GitHub-run 45562544068. De PR controleert ook de SHA-256 van de meetgegevens. Voor de vijf foutmaten per Gaia-reeks geldt een marge van 0,000001 in de gerapporteerde eenheid. Het aantal punten binnen het gepubliceerde interval mag niet afnemen. Voor numerieke verschillen met galpy en Astropy geldt 0,1% van de gemeten fout, met een minimale marge van respectievelijk 1e-12 en 1e-10 voor afrondingsverschillen. De oorspronkelijke absolute grenswaarden blijven gelden. Deze marges zijn regressiegrenzen voor dezelfde berekening. Ze geven geen onzekerheidsinterval voor het astronomische model. Een inhoudelijk gewijzigd model of een nieuwe meetreeks vereist afzonderlijke beoordeling van de referentie.
