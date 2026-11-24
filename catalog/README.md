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
51 producten uit de LLMscan-catalogus en twee WiHTML-voorbeeldlessen opgenomen.
In de EAIgame-omgeving zijn zes gebieden en de bijbehorende bron van
100 vragen opgenomen. De applicatie maakt daar varianten voor vmbo, havo
en vwo van, samen 300 vraagrecords. Dit zijn geen 300 losse pagina's.
Ook 40 herbruikbare EAIstudio-componenten, drie startvoorbeelden,
acht scènesjablonen, tien WiHTML-lesvormen, vijftien interne EAIwork-
schermen en zeven EAImesh-analysekeuzes zijn afzonderlijk benoemd.

De aanvullende inventarisatie heeft ook zes onderwerpen voor oceaanonderzoek,
zes voor gravitatie en satellietbanen, vier werkwijzen bij sport en twee
werkwijzen van de proceswizard vastgelegd. Het totaal van afzonderlijk
benoemde onderdelen is 319. De twee Melkweguitvoeringen blijven
aparte bestanden met zes gekoppelde gedeelde onderwerpen.

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
waar ze een herkenbare eigennaam zijn. De vastgestelde vaknamen worden gebruikt op de openbare ingangen,
kaarten en in de zoekfunctie. Technische IDs, bronpaden en URL's veranderen niet.

## Controleren

Voer vanaf de hoofdmap uit:

    python scripts/check_website_register.py
    python -m unittest discover -s tests -p 'test_website_register.py' -v

De controle stopt bij ontbrekende of dubbele registraties, ontbrekende
bronbestanden en wijzigingen in de reeds machineleesbare catalogi,
inclusief de twee WiHTML-voorbeeldlessen.
Bij een nieuw HTML-bestand of nieuw zelfstandig onderdeel moeten ook
de gegevens in het register worden aangevuld. Alleen een link in een
menu zetten is niet genoeg.

## Nog afzonderlijk beoordelen

- Pagina's die niet in de publieke zoekindex staan, inclusief oude
  doorverwijzingen en afgeschermde of technische pagina's.
- Het EAI Prompt Framework heeft een vaste formulieropbouw, geen afzonderlijk
  te openen inhoudelijke pagina's. De HTML-galerij heeft een uploadformulier
  en een dynamisch overzicht. Door gebruikers geüploade inhoud valt buiten
  de Git-inventaris en is niet live gecontroleerd. Ook thema's, schuifjes en
  andere instellingen zijn geen afzonderlijke inhoudspagina's.
- De twee Melkweguitvoeringen zijn op broncode en onderdelen vergeleken.
  De hoofdonderwerpen komen overeen; de uitgebreide uitvoering heeft daarnaast
  begeleidende vragen, hints en extra bediening. Of samenvoegen wenselijk of
  technisch verantwoord is, is niet vastgesteld.
- Of een Nederlandse of Engelse paginanaam werkelijk aansluit op de
  beschikbare taal, en de definitieve namen op de publieke website.

Deze vragen blijven zichtbaar als te beoordelen, niet als voltooid.

## Publieke indeling na PR #293

Het register staat op main. De openbare indeling wordt apart uitgewerkt en
pas na controles gepubliceerd. Het menu Zelf aan de slag verwijst naar één
overzicht met acht directe keuzes: Natuurkunde, Wiskunde, Menselijk lichaam,
Heelal, Oceanografie, Sport en bewegen, AI, Lessen en presentaties.

De Melkweg gebruikt /tools/melkweg-lab/ als publieke ingang. De uitvoering op
/tools/science-observatory/labs/melkweg/ blijft bestaan via een inhoudelijke
verwijzing, zonder tweede vermelding in de algemene zoekfunctie.

`search_scope` onderscheidt algemene zoekresultaten, inhoud binnen een
zelfstandige toepassing, de eigen bibliotheek en interne schermen. De 319
onderdelen blijven geregistreerd, ook als zij niet in de algemene zoekfunctie
worden opgenomen. De 53 natuurkundeonderwerpen blijven rechtstreeks
vindbaar via hun bestaande fragmentadressen.

Het register wijzigt geen bestaande URL, omleiding of backend.
Branches worden pas verwijderd na vergelijking van hun inhoud, PR's
en afhankelijkheden met de actuele main. Dit register verwijdert niets.

## Status van niet-geindexeerde pagina's

De negen rechtstreeks gecontroleerde HTML-doorverwijzingen hebben een
`redirect_target`. Acht gecontroleerde pagina's bevatten `noindex`,
waaronder LEIF. `noindex` zegt niets over werkelijke toegangsbeveiliging.
Gewone pagina's zonder zoekindexvermelding zijn niet automatisch verouderd.
De verwijzingen naar externe sites zijn uit de bron overgenomen, niet live
gecontroleerd. De naamvoorstellen wijzigen geen publieke teksten.

## Sitemap en zoekindex

De vastgelegde sitemap bevat nu 145 URL's. Het register bevat 179 pagina's,
waarvan 34 niet in de sitemap staan. Daaronder zijn bewust uitgesloten
pagina's, doorverwijzingen en eerder gepubliceerde archiefroutes.
De tijdens de bouw gegenereerde modelpagina's `/nl/model/` en `/en/model/`
worden nu ook door `build_site.py` aan de sitemap toegevoegd.
De controle vergelijkt iedere sitemapvermelding met het register.
Dat is geen controle of zoekmachines alle pagina's hebben opgenomen.
