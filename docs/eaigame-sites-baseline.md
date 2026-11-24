# EAIgame: uitgangspunten uit de oorspronkelijke Sites-versie

Bron: https://expeditie-kennis-bordspel.werkruimte-s-2100.chatgpt.site/
Geverifieerd met livepagina en interactieve browserproef op 15 november 2026. Dit is een inventaris van daadwerkelijk aangetroffen functies, geen functionele claim over de nieuwe EAIgame.

## Wat de gebruiker in het oorspronkelijke spel zag

- Het hele speelbord en de route waren in één oogopslag zichtbaar. Bij een desktopviewport van 1920 × 993 was de bordcontainer circa 703 × 703 pixels.
- Het bord stond links, de actieve speler, dobbelsteenactie, medailles, punten en voortgang stonden ernaast.
- Vier kleurgecodeerde kenniswijken: Natuur, Wereld, Taal en Rekenen. Het bord heeft 32 genummerde posities, waaronder start, rust, verrassing, keuze en kamp.
- Speler kan meteen zien wie aan zet is en wat de volgende handeling is. Woorden zoals 'Gooi de dobbelsteen', 'Controleer antwoord' en 'Volgende speler' zijn concreet.
- Speelbaar met 1–4 spelers op één scherm. Goed antwoord levert in de oorspronkelijke spelregels punten en een wijkmedaille op. De eerste speler die alle vier de medailles heeft, wint.

## Bestaande inhoud en beheer

- Een redactionele bank van 64 vragen, verdeeld over de vier wijken en basis/uitdaging.
- Vier werkelijk verschillende vraagvormen: meerkeuze, waar/niet waar, getalvraag en zet-op-volgorde.
- Vraagbank bekijken, op wijk filteren, antwoorden en uitleg inzien, een eigen meerkeuzevraag toevoegen.
- De volledige vragenbank exporteren en importeren als JSON; een import kan ongedaan worden gemaakt.
- Voortgang wordt in de browser bewaard (localStorage-sleutel `expeditie-kennis-v1`).
- De oorspronkelijke publieke assets bevatten onder andere `/app.js`, `/questions.js`, `/island.js` en `/improvements.js`. Het verbeterenplan telt 50 voorstellen.

## Wat PR #272 daadwerkelijk repareert

- Het overzicht en de afstand tot het bord in 3D, standaard zonder automatisch draaien of naar een wijk inzoomen.
- Een echt bordvlak met alle gebiedsnamen. De speler kan nog wel zelf inzoomen of draaien.
- Bediening naast het bord op desktop; op mobiel eerst de actuele spelersactie en dan het gehele bord.
- Heldere dobbelsteen- en routewoorden in plaats van 'impuls' als hoofdactie.
- Herhaalde Playwright-proef op desktop en mobiel, inclusief controle dat het bord niet uit beeld verdwijnt.

## Nog niet overgenomen, dus niet claimen

- De originele vier kenniswijken, 32 bordvakken, rust-/verrassings-/keuze-/kampfuncties en medaillewinst.
- De bewerkbare 64-vragenbank, JSON-import/export en bewaren van voortgang.
- Een echte getalvraag als aparte vraagvorm.
- De vijftig voorstellen uit het oorspronkelijke verbeterplan als uitgevoerde functies.
- Didactisch geijkte verschillen tussen vmbo-, havo- en vwo-opdrachten.

Een volledige overname vraagt een afzonderlijke wijziging waarbij de oorspronkelijke bronbestanden en spelregels vertrekpunt zijn. PR #272 is alleen een gecontroleerde verbetering van het bordoverzicht.
