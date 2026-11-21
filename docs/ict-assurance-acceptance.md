# Acceptatie en grenzen van de ICT-controles

## Bereik van deze wijziging

De wijziging voegt vaste controles toe aan het bestaande ICT-register. Dezelfde
controlefunctie draait in een browserworker en in GitHub Actions. Organisatie,
bronmap, registerbestanden en controletermijn staan in een apart profiel. De
werking tijdens gebruik vraagt geen taalmodel of AI-sleutel.

Het controlescherm toont korte labels, een uitslag en een concrete vervolgactie.
Details over versies en uitvoering staan in het controleverslag. Een uitslag
beschrijft uitsluitend de uitgevoerde controle. Het is geen algemene score voor
veiligheid, juridische naleving of inhoudelijke kwaliteit.

## Acceptatie per onderdeel

| Onderdeel | Bewijs dat deze wijziging moet leveren | Grens |
| --- | --- | --- |
| Herhaalbaarheid | Gelijke gegevens, regels, peildatum en vergelijkingsstand leveren gelijke uitslagen. De testset bevat vooraf vastgelegde verwachtingen. | De testset beoordeelt de controlecode; zij bewijst geen kwaliteit van een extern AI-product. |
| Bronnen | Exacte bestanden, Git-revisies, aantallen en bronverwijzingen worden gecontroleerd en vastgelegd. | Aanwezigheid en consistentie van een verwijzing bewijzen geen waarheid, gebruiksrecht of toestemming. |
| Beoordelingen | Ontbrekende onderbouwing, beoordelaar, datum, toepasselijke rol en opvolging worden gesignaleerd. | De automatische controle beslist niet of een menselijke beoordeling inhoudelijk juist is. |
| Wijzigingen | Een expliciet gekozen eerdere stand wordt aan organisatie, bron en regels gekoppeld. Een oude uitslag verdwijnt zodra de huidige invoer verandert. | Dit is gegevensvergelijking. Gedrags- of prestatieverandering van externe systemen vraagt aparte metingen. |
| Organisaties | Een tweede fictief profiel gebruikt dezelfde regels. Lokale opslag is per organisatie en bron afgeschermd. | Het is geen account- of autorisatiesysteem voor een gedeelde server. |
| Bewerken | Onbekende velden, bronverwijzingen en auditgegevens blijven behouden. Een bronwissel kan een bestaand concept niet aan een andere bron koppelen. | Een voorstel moet inhoudelijk worden beoordeeld voordat het in de hoofdbranch komt. |
| Publiceren | De publicatieroute weigert verkeerde bronidentiteiten, onverwachte API-doelen, redirects en herkenbare sleutels. Nieuwere concepten blijven na publicatie behouden. | Een gevonden geheimenpatroon is geen volledige classificatie van vertrouwelijke informatie. |
| Gebruikersroute | Een echte browser importeert de registers, voert de worker uit, exporteert het verslag en vergelijkt gewijzigde gegevens op breed en smal scherm. | Een automatische browserproef vervangt geen gebruikstest met collega's of volledige toegankelijkheidsbeoordeling. |
| Hosting | De app levert beveiligingsheaders mee; de browserproef controleert hun werking op een lokale testserver. | De werkelijke HTTP-respons van de productiehost moet na plaatsing afzonderlijk worden gecontroleerd. |

## Beveiligingscontroles in de repository

De regressies behandelen onder meer bronverwisseling, verborgen veldverlies,
ongeldige datums, onvolledige batches, tokens in inhoud en foutmeldingen,
onverwachte API-adressen, iframepublicatie, HTML-invoer, lokale opslagscheiding
en wijzigingen die tijdens een publicatie worden gemaakt.

De sitebrede uitrol plaatst de beveiligingsheaders uitsluitend in de map van het
dashboard. De uploadclient controleert voortaan het certificaat en de hostnaam
op zijn eigen TLS-verbinding. De bestaande voorafcontrole van een fingerprint
blijft aanvullend; die afzonderlijke verbinding beveiligt de upload zelf niet.
De actuele productiecertificaatketen en de werkelijke overdracht zijn nog niet
beproefd. Een ongeldige keten of hostnaam moet de uitrol laten stoppen.

De workflow heeft alleen leesrechten, gebruikt vastgezette action-commits en
ontvangt geen publicatietoken. De browserproef blokkeert externe netwerkacties
en publiceert niets. Het dagelijkse schema werkt pas nadat de workflow in de
standaardbranch staat. Een geslaagde CI-run is bewijs voor de geteste commit
en omgeving, geen uitgevoerde externe penetratietest.

## Aanvullingen die nog eigen ontwerp en bewijs vragen

Voor bredere inzet moeten onderstaande onderwerpen apart worden ingevuld.
Ze zijn geen verborgen groene controles in de huidige uitslag.

- **Bronregister:** bronhouder, rechten, toegestaan gebruik, toepassingsbereik,
  bewaartermijn en goedkeuringsstatus per bron. Een bronverwijzing vult deze
  gegevens niet automatisch in.
- **Versie van een inhoudelijke beoordeling:** koppel de beoordeling aan de
  exacte beoordeelde inhoud en regels. Algemene wijzigingsdetectie waarschuwt
  voor verschillen, maar trekt nog niet gericht iedere eerdere menselijke
  beoordeling in.
- **Inhoudelijke evaluatie:** echte gebruiksvragen, representatieve gevallen,
  vooraf bepaalde grenzen en beoordeling door deskundigen. Een geslaagde
  softwaretest telt niet als inhoudelijk bewijs.
- **Beheer:** aangewezen eigenaar, vervanger, incidentroute, herstelproef en
  vastgelegde beslissingen over bron- en regelwijzigingen.
- **Plaatsing:** werkende productieheaders, passende toegangsrechten,
  gebruikstest en bevestigde verwerking van de werkelijke organisatiegegevens.

De inhoudelijke taxonomie blijft een eigen gegevensmodel. Voeg waar nodig
bron- en beoordelingsmetadata toe; verander de betekenis van begrippen niet
om een controlescherm gunstiger te laten kleuren. Originele documenten,
annotaties en synthetische testgevallen blijven afzonderlijk herkenbaar.

## Reproduceerbare uitvoering

```sh
node --test tests/test_ict_scan_assurance*.mjs tests/test_ict_scan_cards.mjs tests/test_ict_scan_github_sync.mjs
node tests/test_ict_scan_export.mjs
python3 -m unittest discover -s tests -p 'test_ict_scan_publish.py' -v
node scripts/check_ict_assurance.mjs --as-of 2026-11-21 --output /tmp/ict-assurance.json
```

De browserproef staat in `tests/verify_ict_assurance_browser.mjs`; de workflow
installeert de vastgelegde Playwright-versie en bewaart verslag en screenshots.
Een controlerapport met oranje of grijs blijft zo staan, ook wanneer de tests
van de controlecode slagen. Alleen uitgevoerde controles kunnen groen worden.

Normbronnen en hun toepassingsgrenzen staan in
[ict-assurance-sources.md](ict-assurance-sources.md). De onderzochte oudere
code, broncommits en licentiegrenzen staan in
[ict-assurance-reuse.md](ict-assurance-reuse.md).
