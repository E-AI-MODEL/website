# Bediening natuurkunde: vergelijking met de 53 oorspronkelijke proeven

Stand: 12 november 2026. Bronnen worden gebruikt als inspiratie en als toetsbare vergelijking, niet als bewijs dat een eigen model natuurkundig goed is.

## Wat het oorspronkelijke bestand wel en niet bevat

Het aangeleverde crawlbestand `scrape-www_walter_fendt_de-1794388276782.md` bevat de Nederlandse index van Walter Fendt (53 HTML5-proeven, 4 september 2023), paginabeschrijvingen en een als tekst uitgelezen ZIP. Die ZIP-uitvoer is geen betrouwbare basis om programmagedrag te reconstrueren. Vergelijk de rechtstreeks gepubliceerde pagina's en toets waar mogelijk de originele interactieve app afzonderlijk.

- **Magneetveld van een staafmagneet:** een verplaatsbare kompasnaald laat de lokale veldrichting zien, met een getekende veldlijn. Dat is meer dan een camera om het magneetveld draaien. Bron: https://www.walter-fendt.de/html5/phnl/magneticfieldbar_nl.htm
- **Tweede wet van Kepler:** sectoren met gelijke oppervlakte zijn verstelbaar en draaibaar met ingedrukte muisknop. De tijdsintervallen en snelheid blijven zichtbaar. Bron: https://www.walter-fendt.de/html5/phnl/keplerlaw2_nl.htm
- **Bragg-diffractie:** golflengte, vlakafstand en invallende hoek moeten in de proef zelf met de relatie `2d sin(θ) = kλ` overeenkomen. Alleen de hele scène kantelen is hiervoor niet voldoende. Bron: https://www.walter-fendt.de/html5/phnl/braggreflection_nl.htm

## Andere voorbeelden

- **PhET:** touchbediening, alternatieve invoer en duidelijke selectiefeedback zijn voor HTML-simulaties bewust onderdeel van het ontwerp. Bron: https://phet.colorado.edu/en/inclusive-design/accessibility
- **Three.js OrbitControls (bedieningsreferentie):** één vinger of linkermuisknop om te draaien; twee vingers om te zoomen; reset van de kijkrichting. Onze natuurkundeweergave gebruikt **een eigen 3D-projectie op canvas** en niet automatisch de Three.js-engine. Bron: https://threejs.org/docs/pages/OrbitControls

## Aangepast in deze PR

- De t-weergave verandert maximaal per tiende seconde en neemt altijd dezelfde breedte in. De **fysische berekening zelf** houdt de oorspronkelijke tijdnauwkeurigheid.
- Proeven zonder betekenisvol tijdsverloop tonen 'Statisch model' in plaats van een doortellende t-waarde.
- Alle zeven bestaande ruimtelijke proefweergaven hebben dezelfde bediening: vasthouden pauzeert, slepen draait de kijkrichting, loslaten hervat de eerdere speelstand, twee vingers zoomen, pijltjestoetsen draaien en Home zet de kijkrichting terug.
- Per proef staat een passende aanwijzing voor de ruimtelijke bediening.

## Wat inhoudelijk nog per proef moet gebeuren

| Proef | Directe handeling voor een volgende ronde | Wat je moet toetsen |
| --- | --- | --- |
| Kepler 1 en 2 | Planeet en sector afzonderlijk kiezen/draaien, niet alleen de camera | Tweede wet: gelijke sectoroppervlakken in gelijke tijd |
| Staafmagneet | Verplaatsbare kompasnaald/veldsonde in het model | Plaatselijke veldrichting en veldlijn |
| Stroomdraad | Meetsonde radiaal verplaatsen | Veldsterkte als functie van afstand |
| Elektromagnetische golf | E- en B-vector op een gekozen punt aanwijzen | Richting, fase en voortplantingssnelheid |
| Bohr-model | Energieniveaus afzonderlijk selecteren | Discrete niveaus, toegestane overgangen |
| Bragg | Kristalvlakken of bundel rechtstreeks draaien | Bragg-voorwaarde en gehele orde |

**Beoordelingsgrens:** een muis- of touchtest die de camera laat draaien, bewijst nog niet dat een object zelf kan worden vastgepakt en natuurkundig juist gemanipuleerd. Dat moet afzonderlijk worden gebouwd en getest, passend bij iedere proef. Zie ook `natuurkunde-kwaliteit.json`.
