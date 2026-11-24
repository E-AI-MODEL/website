# EAIgit: zelfstandige controle van losse bestanden, ZIP en openbare broncode

De browser voert alleen **statische controles** uit. Geen projectbestanden worden naar EAIgit verzonden, geen projectcode wordt geïmporteerd of uitgevoerd en geen npm-script draait. Voor openbare GitHub-repositories haalt een browserworker alleen openbare gegevens op via de GitHub API.

## Controleketen

1. De gebruiker kiest een doel. Voor een broncontrole geeft die één los bestand, een ZIP en/of openbare GitHub-repository. Zonder bron kan EAIgit alleen een maak- en testroute voorstellen.
2. Bij een los bestand leest de browserworker maximaal 8 MiB, zonder code uit te voeren. Voor ondersteunde UTF-8-teksten onderzoekt EAIgit maximaal 220 kB inhoud. Uitvoerbare en onbekende bestanden blijven ongetest. De bestaande ZIP-parser leest centraal register, padnamen en bytes, met limieten op omvang, aantal bestanden, uitpakratio en onveilige paden. De ZIP blijft lokaal.
3. Voor relevante bestanden uit ZIP-bundels berekent EAIgit inhoudsvingerafdrukken en leest maximaal een begrensd deel van tekstbestanden. De publieke GitHub-bronnen worden bij het inlezen tegen hun Git-blobhash gecontroleerd.
4. De browserparser **Acorn 8.15.0** controleert de syntaxis van gewone `.js`, `.mjs` en `.cjs`. De parser draait op de ingehaalde tekst, niet op het programma zelf. Hij wordt met MIT-licentie vanaf onze eigen website geleverd en hoeft geen externe CDN te laden.
5. Een statische HTML- en structuurcontrole zoekt onder andere dubbele `id`-attributen, `img` zonder `alt`, `index.html` op gangbare plekken, mobiele viewport, doctype, vaste DOM-ID-verwijzingen en directe `node <bestandsnaam>`-startscripts. De bestaande analyse van JSON, lokale imports, CSS, HTML en onderlinge versies blijft actief.
6. De resultaten worden gerangschikt. Een herleidbare JavaScript-syntaxisfout komt vóór algemene HTML-tips; mogelijk gevoelige bestanden krijgen altijd voorrang.
7. De wizard geeft één volgende handeling met bestandsnaam, regelnummer (waar betrouwbaar), uitleg en controlepunt. Een optionele AI-opdracht bevat de bevinding, maar wordt **niet verstuurd**; de gebruiker kiest zelf of die tekst wordt gekopieerd.

## Wat de uitkomst betekent

| Uitkomst | Status |
| --- | --- |
| Acorn geeft een fout op een gelezen JavaScript-bestand | Statisch vastgesteld: dit bestand is niet geparseerd. Geen conclusie over andere bestanden |
| JSON.parse geeft een fout | Statisch vastgesteld: geen geldige JSON |
| Bestandsverwijzing niet aangetroffen in een ZIP-project | Vastgestelde afwijking van de beschikbare lijst; een build kan het bestand nog genereren |
| Bestandsverwijzing vanuit één los HTML-bestand | **Niet meegeleverd**, dus geen bewijs dat het bestand op de computer ontbreekt |
| Dubbele HTML-ID in een gelezen HTML-bestand | Statisch vastgesteld in de gelezen markup |
| `getElementById('x')` maar geen `id="x"` in de gelezen HTML | **Vraag voor nader onderzoek**, geen bewijs dat het element ontbreekt. Code kan het dynamisch maken |
| Geen `index.html` op bekende plek bij ZIP/repository | **Vraag voor nader onderzoek**, vooral bij frameworks en builds. Eén los `oefening.html` is niet automatisch fout |
| JSX, TypeScript, Vue, Svelte, Astro | Niet met de gewone Acorn-JavaScript-parser gevalideerd |
| Externe URL, netwerk-API, serviceworker, module of browseropslag in één bestand | Aanwijzing voor een offline controle. Niet bewezen dat de toepassing online of offline werkt |
| Los binair of uitvoerbaar bestand (.exe, .dmg, .jar enzovoort) | Geen runtime- of beveiligingscontrole; bestandsnaam alleen is geen bewijs |
| Geen meldingen | Niet gelijk aan een foutloos of werkend project |

De uitvoer vermeldt welke bestanden wel en niet zijn gelezen en dat code, builds en gebruikersfuncties niet zijn gedraaid. EAIgit doet geen algemene lint-beloften. Een echte ESLint-run, TypeScript-compile, browsersimulatie of volledige testuitvoering vraagt een aparte omgeving en toestemming.

## Beperkingen en afbakening

- Los bestand maximaal 8 MiB; ondersteunde tekst maximaal 220 kB voor statische inhoudscontrole. Een binaire toepassing wordt niet gestart, geïnstalleerd of op malware gecontroleerd.
- Een zelfstandige HTML-pagina kan lokaal openen, maar `file://` kent browserbeperkingen. Externe bronnen, netwerkgebruik, modules, serviceworkers, opslag en benodigde installatie zijn afhankelijk van de omgeving. Offline werking moet iemand werkelijk testen.
- ZIP-archief maximaal 16 MiB; de bestaande parser beperkt bestanden, totale gedecomprimeerde omvang en uitpakratio.
- Inhoudelijk ZIP-onderzoek is beperkt in aantal bestanden, grootte en totaal gelezen bytes. De JavaScript-parser controleert maximaal 60 teksten van maximaal 220.000 tekens per bestand.
- De publieke GitHub-inspectie haalt alleen een beperkte prioritaire selectie van kleine bestanden op. Een publieke boomlijst zonder gelezen broninhoud is geen complete codeanalyse.
- Voor HTML worden alleen statisch zichtbare markeringen onderzocht. React, webcomponenten, template-builds en scripts kunnen DOM-elementen pas tijdens uitvoering toevoegen.
- Regex-herkenning van DOM-toegang is een **aanwijzing**. De JavaScript-parser bevestigt uitsluitend syntaxis, niet functies, typen, afhankelijkheden of runtimegedrag.
- EAI Work levert het gevalideerde takenplan met fases, afhankelijkheden en gescheiden beslissingstaken. De website start geen algemene EAI Work-worker of code-uitvoerder.

## Tests en onderhoud

- `tests/test_static_audit.mjs`: parser, HTML, ID's, scripts, onbekende talen en niet-uitvoeren van broncode.
- `tests/test_projecthulp.mjs`: bestaande ZIP- en hash-gecontroleerde GitHub-routes.
- `tests/test_eaigit_single_file.mjs`: losse HTML, scripts, binaire bestanden, offline afhankelijkheden en routes zonder repository.
- `tests/test_audit_advice.mjs`: prioritering, toestemming, routekeuze, herleidbare optionele AI-opdrachten.
- `scripts/test_projecthulp_browser.mjs`: browserflow, mobiele weergave en foutpad.
- `.github/workflows/projecthulp-browser.yml`: voert de tests en visuele proef uit bij relevante PR's.

**Voor een volgende uitbreiding** ligt een expliciete, geïsoleerde testomgeving meer voor de hand dan steeds meer heuristiek in de browser. Denk aan op toestemming gegronde lint-, type-, build- en gebruikstests met uitvoer en log per bestand. De broncode van een willekeurig ZIP-bestand mag nooit stilzwijgend in de bezoekersbrowser worden uitgevoerd.
