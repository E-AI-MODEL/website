# Downloadbesluit: EAIgame 2.0 | De Storm

**Uitgevoerd op 16 november 2026 · proefset 0.1 · geen productie-assets**

## Besluit

**We downloaden niet alles uit het bronregister.** We hebben eerst een kleine reeks met vastgelegde herkomst en licentie geselecteerd en als tijdelijk GitHub Actions-artifact opgehaald. Dit houdt de website-repository vrij van grote 3D-pakketten. De bronkeuze, scripts en het manifest blijven reproduceerbaar in de repository.

| Stap | Bestemming | Status |
|---|---|---|
| Brede inventaris, inspiratie, bronvermeldingen | `docs/eaigame-world/` in deze repo | Aanwezig: 39 kandidaten |
| Kleine controleerbare proefset | Tijdelijk GitHub Actions-artifact, niet `main` | **Uitgevoerd** |
| Visuele 3D-vergelijking in browser | Afzonderlijke ontwikkelproef | **Nog niet uitgevoerd** |
| Definitieve geoptimaliseerde modellen | `assets/eaigame2/` of aparte assethosting ná toetsing | Nog geen toestemming of beslissing |
| Grote ruwe archieven van uitgevers | Niet opnemen in website Git | Uitgesloten |

## Werkelijk gedownload

**19 3D-modellen** uit vier bronpakketten, aangevuld met benodigde bestanden: 8 Kenney Nature, 5 Kenney Fantasy Town, 5 KayKit Medieval Hexagon 1.0 en 1 KayKit Adventurers 1.0. Niet meer claimen dan dit.

- Kenney Nature: onder andere twee bomen, rotsen, gras, een houten brug, steenwand en paddeel.
- Kenney Fantasy Town: onder andere een beschadigde muur, deur/wand, dak, planken en lantaarn.
- KayKit Medieval: een waterradmolen met apart wiel, brugobject, steiger/steigerwerk, ton en rots.
- KayKit Adventurers: een geanimeerd personage (Rogue Hooded). De werkelijke bruikbaarheid van animatie en uiterlijk is nog **niet** bewezen.

Technisch: 36 bestanden inclusief sidecars en twee licentieteksten; samen **4.241.114 bytes**, gecomprimeerd circa **1,4 MB**. Alle bestanden zijn SHA-256-gecontroleerd. De **19 modelbestanden zijn daarnaast lokaal onafhankelijk met Trimesh ingelezen**; geen laadfouten. Dat is géén bewijs van visuele kwaliteit of speelbaarheid. De totale geometrie telt circa 13.590 driehoeken (geteld over de losse modellen, zonder instancing). De schaal tussen Kenney en KayKit verschilt en moet worden genormaliseerd.

**Herkomst en toegang:**
- [Geslaagde download en checksumproef](https://github.com/E-AI-MODEL/website/actions/runs/43817891733)
- [Tijdelijk ZIP-artifact](https://github.com/E-AI-MODEL/website/actions/runs/43817891733/artifacts/14202822587) (GitHub Actions-bewaartermijn: **tot 30 november 2026**)
- [Herhaalbaar downloadscript](../../scripts/eaigame_asset_proof.py)
- [Workflow en controle](../../.github/workflows/eaigame-assets.yml)
- ZIP bevat `manifest.json` met **bronlink, vastgepinde revisie, bestand, grootte en SHA-256**.

Het downloadscript kan later opnieuw worden gedraaid vanuit de Actions-tab. Daardoor kunnen tijdelijke bestanden vervallen zonder dat de gekozen bronnen of de herkomst verdwijnen.

## Licenties en beperkingen

1. **KayKit**: exacte historische GitHub-revisies van de 1.0-pakketten, met de eigen `LICENSE.txt` in de download. Die vermeldt CC0 voor deze twee pakketten. Niet veronderstellen dat latere 2.0-bestanden dezelfde exacte inhoud hebben.
2. **Kenney**: de officiële Nature Kit en Fantasy Town Kit vermelden CC0 op [Nature Kit](https://kenney.nl/assets/nature-kit) en [Fantasy Town](https://kenney.nl/assets/fantasy-town-kit). De oorspronkelijke ZIP-links bleken geen ZIP terug te geven. De geselecteerde GLB-bestanden zijn daarom gehaald uit de **openbare re-exportverzameling [shorepine/kenney](https://github.com/shorepine/kenney), vastgezet op commit `3694c6879e487c108f55677be7dd2ca75b07cc3b`**. Dit is niet dezelfde byteset als het originele uitgeversarchief. Nog vóór publicatie controleren we die kopieën visueel en op afwijkingen.
3. **Quaternius**: voorlopig niet downloaden vanwege onzekerheid over los verspreiden onder de actuele QAL.
4. Losse modelsamples uit eerdere zoekopdrachten, stockafbeeldingen en game-screenshots zijn niet automatisch vrij te hergebruiken.

## Wat is de volgende echte beslissing?

**Niet méér modellen downloaden totdat de eerste 19 zichtbaar in één scène zijn beoordeeld.** De omvang is klein, maar Kenney is vaak erg eenvoudig gestileerd. Met de sfeerbeelden als doel kan dat te kaal zijn voor de voorgrond. De juiste eerste proef toont:

- dezelfde brugomgeving met Kenney, KayKit en een beperkte gecombineerde opstelling;
- camera-overzicht, camerastand achter de speler en bediening bij het waterrad;
- de leesbaarheid van bomen/gebouwen/personage, en of materiaal, schaal en belichting één geheel vormen;
- mobiele framerate, bestandsgrootte, drawcalls, interactie en werkelijke animaties.

Na deze proef: geschikte onderdelen houden, rest afwijzen, ontbrekende modellen gericht downloaden. Geen duizenden modellen verzamelen puur omdat er een CC0-label op staat.

## Grenzen van het huidige bewijs

Er is **geen** hoogwaardige speelwereld, werkelijk brugmechaniek, simulatie, GPU-meting of gebruikersproef opgeleverd. De huidige download is een **samenhangende eerste selectie** met aantoonbaar te openen modelbestanden en herkomst. PR #277, `main` en de publieke website zijn onveranderd.
