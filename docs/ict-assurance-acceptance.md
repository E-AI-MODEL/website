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
| Bronnen | Exacte bestanden, Git-revisies, aantallen en verwijzingen worden gecontroleerd. Een bronregister legt bronhouder, versie, rechten, gebruik, bereik, bewaartermijn en goedkeuring vast. Een goedkeuring verwijst naar de exacte brongegevens. | Een ingevuld veld bewijst geen waarheid, gebruiksrecht of bevoegdheid van de invuller. |
| Beoordelingen | Onderbouwing, beoordelaar, datum, toepasselijke rol en opvolging worden gecontroleerd. Een bevestigde beoordeling wordt verbonden aan de exacte registratie, gekoppelde bronnen en regels. Een wijziging in die opgenomen inhoud maakt de bevestiging verouderd. | De automatische controle stelt de identiteit van de beoordelaar niet vast en beslist niet of de beoordeling inhoudelijk juist is. |
| Wijzigingen | Een expliciet gekozen eerdere stand wordt aan organisatie, bron en regels gekoppeld. Een oude uitslag verdwijnt zodra de huidige invoer verandert. | Dit is gegevensvergelijking. Gedrags- of prestatieverandering van externe systemen vraagt aparte metingen. |
| Organisaties | Een tweede fictief profiel gebruikt dezelfde regels. Lokale opslag is per organisatie en bron gescheiden. | Het is geen account- of autorisatiesysteem voor een gedeelde server. |
| Bewerken | Onbekende velden, bronverwijzingen en auditgegevens blijven behouden. Gewoon opslaan vernieuwt geen goedkeuring. Het GitHub-voorstel toetst nieuwe bevestigingen aan de uiteindelijke gegevens van de volledige wijzigingsbatch. | Een voorstel moet inhoudelijk worden beoordeeld voordat het in de hoofdbranch komt. |
| Publiceren | De publicatieroute weigert verkeerde bronidentiteiten, onverwachte API-doelen, redirects en herkenbare sleutels. Nieuwere concepten blijven na publicatie behouden. | Een gevonden geheimenpatroon is geen volledige classificatie van vertrouwelijke informatie. |
| Gebruikersroute | Een echte browser importeert de registers, voert de worker uit, exporteert het verslag en vergelijkt gewijzigde gegevens op breed en smal scherm. | Een automatische browserproef vervangt geen gebruikstest met collega's of volledige toegankelijkheidsbeoordeling. |
| Hosting | De app levert beveiligingsheaders mee; de browserproef controleert hun werking op een lokale testserver. | De werkelijke HTTP-respons van de productiehost moet na plaatsing afzonderlijk worden gecontroleerd. |

## Beveiligingscontroles in de repository

De regressies behandelen onder meer bronverwisseling, verborgen veldverlies,
ongeldige datums, onvolledige batches, tokens in inhoud en foutmeldingen,
onverwachte API-adressen, iframepublicatie, HTML-invoer, lokale opslagscheiding,
verouderde bron- en normbeoordelingen en wijzigingen die tijdens een publicatie
worden gemaakt. De tests controleren ook wijzigingen in onbekende JSON-velden,
een gewijzigde bron binnen dezelfde batch en een bronwijziging in GitHub sinds
de lokale bevestiging. De schrijver vernieuwt geen bevestiging namens de gebruiker.

De schrijfroute leest ook de expliciet geconfigureerde profiel- en
catalogusbestanden op dezelfde basiscommit. Verschillen met de geladen
configuratie blokkeren de eerste schrijfactie. De moduleversies worden
afzonderlijk vergeleken zonder remote JavaScript uit te voeren. Een leesprofiel
zonder deze configuratiemapping kan geen GitHub-voorstel maken. Dit is geen
bewijs dat alle uitvoerbare modulebytes gelijk zijn.

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

De sitebrede publicatie roept dezelfde ICT-workflow aan en heeft die als verplichte
jobafhankelijkheid. Een technische fout blokkeert de upload. Een correct vastgelegde
bronafwijzing blijft rood in het controlerapport, maar mag wel worden opgeslagen.
De commandoregel onderscheidt zulke inhoudelijke besluiten van fouten in gegevens,
uitvoering en tests. Het exacte onderscheid staat hieronder.

Op 21 november 2026 is [regelsysteem 27792543](https://github.com/E-AI-MODEL/website/rules/27792543)
actief voor `main`: een pull request, afgeronde discussies en een geslaagde
`static-checks` op een bijgewerkte branch zijn verplicht. Verwijderen en geforceerd
overschrijven zijn geblokkeerd. Het verplichte aantal menselijke goedkeuringen is
nul. De regel vereist geen afzonderlijke ICT-statuscheck voor het samenvoegen;
de publicatieworkflow heeft die jobafhankelijkheid wel. Dit document wijzigt geen
repositoryinstellingen.

## Bronregister en bevestigde beoordelingen

`2026-bronnenregister.json` bevat 51 voorgestelde bronregistraties voor 468 bestaande,
exacte bronverwijzingen. Twee expliciet genoemde bronbestanden vormen twee groepen;
de overige verwijzingen zijn afzonderlijk opgenomen. De oorspronkelijke drie
inventarisbestanden zijn niet herschreven. Bronhouder, rechten, versie en
goedkeuring zijn niet uit een bestandsnaam afgeleid. De voorstellen beginnen als
`Onbekend` en `Nog te beoordelen`.

De kaarteditor vraagt een afzonderlijke bevestiging voor brongoedkeuring en voor
een nieuwe of gewijzigde eindbeoordeling. Het vinkje staat niet vooraf aan.
De opgeslagen vergelijking bevat ook onbekende inhoudsvelden. Een gewone
inhoudswijziging bewaart de eerdere bevestiging en toont haar als verouderd.
Het logboek krijgt geen beslissende rol: alleen een nieuwe auditregel toevoegen
verandert de beoordeelde inhoud niet.

Een actuele inhoudsvergelijking vervangt de afzonderlijke controles op bewijs,
beoordelaar, rol en datums niet. De peildatum en de globale bestandsrevisie staan
niet in de bevestiging; de werkelijke brongegevens en hun vastgelegde versie wel.
Een latere peildatum kan een verlopen beoordeling signaleren zonder dat de
opgeslagen inhoud is gewijzigd.

Deze vergelijking is geen digitale handtekening. De namen in `approvedBy` en
`reviewedBy` zijn opgegeven tekst. Toegangsbeheer, de echte bevoegdheid van de
beoordelaar en een eventueel verplicht tweede oordeel vragen apart beheer.

## Werkelijke invulling en ingebruikname

Voor bredere inzet moeten onderstaande onderwerpen apart worden ingevuld.
Ze zijn geen verborgen groene controles in de huidige uitslag.

- **Bronbesluiten:** de 51 voorgestelde bronregistraties laten beoordelen en
  ontbrekende bronverwijzingen aanvullen. Alleen een bevoegde persoon kan de
  werkelijke gebruiksrechten, grenzen en goedkeuring vaststellen.
- **Menselijke beoordelingen:** de beoordelaar en bevoegdheid vaststellen,
  werkelijk bewijs beoordelen en de betreffende versie expliciet bevestigen.
  Het bewaren van een vergelijking levert deze beoordeling niet zelf.
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
Het synthetische corpus bevat 31 gevallen met 35 vooraf bepaalde verwachtingen.

### Technisch slagen en een afgewezen bron

De CLI bewaart naast de ongewijzigde lampkleuren een `execution.technicalGate`.
Onder beleid `source-decisions-v1` blokkeren de expliciete rode bronbesluiten
`SOURCE_USE_DENIED` en `SOURCE_APPROVAL_REJECTED` de technische verwerking niet.
Die uitzondering geldt alleen voor de broncontrole, met minstens één van die
rode meldingen en verder uitsluitend bekende rode bronbesluiten of meldingen
met ernst `attention`. De waarde van `category` verleent geen uitzondering.

Een ongeldige datum in een uitgevoerde controle, misvormde bevestiging,
onbekende foutcode of ernstwaarde, andere mislukte controle of verkeerde
corpusverwachting geeft exitcode 1. Ongeldige argumenten, onleesbare invoer,
manifestfouten en fouten bij het uitvoeren of bewaren geven exitcode 2.
Een correct geregistreerde bronafwijzing kan exitcode 0 geven terwijl de bronlamp
en de totaalstatus rood blijven. Ook een expliciet bewaarde vergelijkingsstand
kan die rode afwijzing bevatten. Exitcode 0 en die vergelijkingsstand geven geen
toestemming om de bron te gebruiken en geen verklaring over inhoudelijke naleving.

Normbronnen en hun toepassingsgrenzen staan in
[ict-assurance-sources.md](ict-assurance-sources.md). De onderzochte oudere
code, broncommits en licentiegrenzen staan in
[ict-assurance-reuse.md](ict-assurance-reuse.md).
