# Inhoudsregister van eaimodel.nl

Dit register beschrijft uitsluitend de repository E-AI-MODEL/website. De andere GitHub-repositories vallen buiten deze opdracht.

## Bestanden

- website-register.json bevat de routes, bronbestanden en afzonderlijk benoemde onderdelen binnen pagina's.
- taxonomie.json bevat vaste familie-ID's, Nederlandse en Engelse namen en taalafspraken.
- scripts/check_website_register.py vergelijkt de registraties met de websitebestanden en de bestaande broncatalogi.
- .github/workflows/check-website-register.yml voert die controle uit bij relevante wijzigingen.

De eerste momentopname is gemaakt van website-main op commit
f3bcd77c94f464aa636ce7ddac766f9d87dc2c26, aangevuld met het op
16 november 2026 gepubliceerde zoekbestand /assets/site-search-index.json.

Er zijn 177 HTML-pagina's uit de repository en twee pagina's die tijdens
de bouw ontstaan, plus 40 andere HTML-bestanden. Er zijn ook 144
afzonderlijke verwijzingen uit de publieke zoekindex, 15 TAALwerkvormen
en 51 producten uit de LLMscan-catalogus opgenomen.

Dit zijn verschillende meeteenheden. Een HTML-bestand kan veel
inhoudelijke onderdelen bevatten. Een zoekresultaat kan naar een
hele pagina of naar een afzonderlijk onderdeel verwijzen.

## Plaats, bron en zichtbaarheid

Een record heeft een technische herkomst (file of source_file), een
familie (family), een directe ouder (parent) en een publieke route (url).
Dat zijn verschillende eigenschappen. De diepte van het register
schrijft niet voor hoeveel stappen een bezoeker moet doorlopen.

Een familie kan verschillende uitvoeringen hebben. De twee bestaande
Melkwegomgevingen krijgen daarom dezelfde inhoudelijke naam, maar hun
afzonderlijke URL's en bronbestanden blijven behouden. Een technische
samenvoeging volgt alleen op een vergelijking van hun werking.

## Naamgeving

Gebruik als titel de juiste vakterm, bijvoorbeeld De hefboom, Binomiale
verdeling of Sagittarius A*. Een beschrijving zegt wat er daadwerkelijk
te onderzoeken of te doen is. Interne typeaanduidingen zoals onderdeel
zijn geen verplichte zichtbare labels.

Gebruik geen algemene publieksnamen als proeven, modules, labs of
observatoria voor de hele verzameling. Productnamen mogen blijven staan
waar ze een herkenbare eigennaam zijn. Voorgestelde namen zijn nog geen
gepubliceerde wijzigingen. Bestaande URLs, IDs, menu's en interfaces
blijven onaangeroerd.

## Controleren

Voer vanaf de hoofdmap uit:

    python scripts/check_website_register.py
    python -m unittest discover -s tests -p 'test_website_register.py' -v

De controle stopt bij ontbrekende of dubbele registraties, ontbrekende
bronbestanden en wijzigingen in de reeds machineleesbare catalogi.
Bij een nieuw HTML-bestand of nieuw zelfstandig onderdeel moeten ook
de gegevens in het register worden aangevuld. Alleen een link in een
menu zetten is niet genoeg.

## Nog afzonderlijk beoordelen

- Pagina's die niet in de publieke zoekindex staan, inclusief oude
  doorverwijzingen en afgeschermde of technische pagina's.
- JavaScript-weergaven en andere zelfstandig te gebruiken onderdelen
  die nog geen machineleesbare broncatalogus hebben. Hun HTML-bestanden
  zijn wel geregistreerd, maar dit bewijst niet dat ieder onderdeel
  daarbinnen is herkend.
- De verschillen en overeenkomsten tussen de Melkweguitvoeringen.
- Of een Nederlandse of Engelse paginanaam werkelijk aansluit op de
  beschikbare taal, en de definitieve namen op de publieke website.

Deze vragen blijven zichtbaar als te beoordelen, niet als voltooid.

## Geen wijzigingen aan de live website

Het register wijzigt geen menu, URL, omleiding, backend of applicatie.
Branches worden pas verwijderd na vergelijking van hun inhoud, PR's
en afhankelijkheden met de actuele main. Dit register verwijdert niets.
