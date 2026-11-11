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

Er zijn **62 afzonderlijke Nederlandstalige gidsartikelen** geschreven. Hiervan hebben er nu **47** een gerichte leerboekverwijzing naar de beschreven anatomie. Deze 47 teksten worden als specifieke uitleg getoond. De andere **15** blijven in het bronbestand staan, maar zijn in de atlas voorlopig vervangen door algemene uitleg zolang er geen passende bron aan gekoppeld is. Verder krijgen de **1.574** structuren zonder eigen gidsartikel ook alleen algemene uitleg. Dat maakt samen **1.589** algemene uitlegroutes en **47** specifieke. Zeven bronnamen blijven onbekend. Een koppeling met een leerboeksectie is nog geen onafhankelijke medische eindcontrole; de exacte woordkeuze en 3D-geometrie blijven voor vakinhoudelijke toetsing vatbaar.

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

## Broncontrole en zichtbaarheid

`content/anatomie/sourceMap.js` koppelt specifiek beschreven structuren aan de geraadpleegde secties van **OpenStax Anatomy and Physiology 2e**. Die bron ondersteunt de anatomische informatie, maar bewijst niet de juistheid van het 3D-mesh of de redactionele vertaling. De andere gidsartikelen zijn niet verdwenen: ze blijven in `guide.js` voor verdere toetsing, maar de leerling ziet alleen algemene uitleg.

Voor de internationale terminologie gebruiken we **FIPAT, Terminologia Anatomica 2** als vergelijkingsbron. De huidige Nederlandse namen zijn redactionele vertalingen. We mogen ze niet als officiële FIPAT-termen presenteren. Ook de upstream Latijnse gegevens zijn niet foutloos: de bron verwisselt een teengewricht met de schouder. De Engelse definities komen grotendeels uit Wikipedia en hebben niet altijd dezelfde detaillering als het gekozen modelonderdeel.

De bronlinks staan in het informatiepaneel onder **Herkomst en bronnen**. De algemene uitleg is herkenbaar gelabeld en de oorspronkelijke Engelse definitie blijft uitklapbaar. De tests controleren of bronkoppelingen naar echte structuren verwijzen, niet of een auteur iedere medische claim persoonlijk heeft beoordeeld. `node scripts/test_anatomie_sources.mjs` controleert de nieuwe bronlaag.
