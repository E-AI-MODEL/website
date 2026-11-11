# Anatomielexicon voor havo 4 en vwo 5

De atlas gebruikt originele 3D-modellen uit de vastgezette bron. De modelsleutel en de oorspronkelijke anatomische gegevens blijven onveranderd.

## Nederlandse namen

`content/anatomie/synonyms.nl.json` bevat Nederlandse zoeknamen. De sleutel is de **exacte Engelse basisnaam van het model**, in kleine letters, zonder de extensie `.l` of `.r`. Het eerste element van de array is de getoonde Nederlandse naam. Andere elementen mogen gecontroleerde synoniemen zijn.

De zoekfunctie gebruikt uitsluitend die exacte sleutel. Een deels overeenkomende Engelse naam mag niet zomaar Nederlandse woorden van een ander onderdeel overnemen.

De naamdekking is 1.636 van 1.643 unieke modelstructuren. Die telling betekent **niet** dat alle namen onafhankelijk anatomisch of didactisch zijn beoordeeld. In de gegevens zitten ook zeer specifieke medische onderdelen die buiten de gebruikelijke lesstof van havo 4 en vwo 5 vallen.

## Onleesbare namen in het bronmodel

Zeven sleutels kunnen nog niet betrouwbaar worden gekoppeld:

- `????????`
- `?x`
- `Central canal'`
- `Lat_Fis-ant-Horizont`
- `Lat_Fis-ant-Vertical`
- `Lat_Fis-post`
- `Sulcus interm_prim-Jensen`

Deze onderdelen krijgen in de interface geen verzonnen anatomische naam. Eerst vaststellen welk object de geometrie werkelijk voorstelt. De onduidelijke sleutels worden gerapporteerd door de audit.

## Anatomische uitleg

`content/anatomie/guide.js` bevat per specifieke structuur vier soorten informatie: naam, functie, ligging en werking. De optionele onderzoeksvraag verwijst naar wat een leerling in het 3D-model kan bekijken.

Schrijf voor een leerling van havo 4 of vwo 5. Begin met herkenbare woorden; leg een medische term alleen uit als die nodig is. Verwar een modelhiërarchie niet met een werkelijke anatomische verbinding. Leid een specifieke functie niet uitsluitend af uit een Engelse naam.

Er zijn nu **62 afzonderlijke Nederlandstalige gidsartikelen** die gekoppeld zijn aan echte modelonderdelen. De overige **1.574 herkenbare onderdelen** krijgen een korte uitleg op basis van het type weefsel of orgaan en een vraag om zelf de ligging te onderzoeken. Die informatie is bewust gemarkeerd als **algemene uitleg**, omdat zij niet de specifieke functie van ieder onderdeel bewijst. Zeven bronnamen blijven onbekend. De originele Engelse bronbeschrijving blijft alleen op verzoek zichtbaar.

## Controle vóór een volgende publicatie

```sh
python -m unittest discover -s tests -p 'test_anatomie_content_audit.py' -v
python scripts/audit_anatomie_content.py --out audit-anatomie
```

De audit levert CSV voor broncontrole, JSON voor automatische verwerking en een leesbaar Markdown-overzicht. Controleer zeker gelijke Nederlandse labels die naar verschillende model-ID's verwijzen. Sommige zijn geldige alternatieve bronbenamingen; andere vragen inhoudelijk onderzoek.

De bestaande viewer-, camera-, touch- en WebKit-tests blijven nodig. Een correcte inhoudsaudit bewijst op zichzelf niet dat de 3D-atlas goed werkt.

## Beoordeling van de medische terminologie

FIPAT onderhoudt de internationale anatomische nomenclatuur, met Terminologia Anatomica 2 (2019) als standaard: https://ifaa.net/committees/anatomical-terminology-fipat/fipat-ifaa-terminologies/ . Dit register is een toetsbron, **geen verklaring** dat onze Nederlandse namen al in TA2 gecontroleerd of officieel vertaald zijn. De internationale termen en de 3D-meshkoppelingen zijn verschillende gegevenslagen. Wijzig een fout niet alleen in de gegenereerde publicatiemap.

De korte type-uitleg staat in `content/anatomie/teaching.js`. Die regels geven algemene, controleerbare informatie, geen individuele medische functieclaims. Bij gespecialiseerde onderdelen is de werking nog niet afzonderlijk beschreven. De zeven onduidelijke bron-ID's krijgen geen verzonnen naam of functie. De automatische test `node scripts/test_anatomie_teaching.mjs` controleert de dekking en de indeling.
