# Controle archief en gekoppelde tools

Controle gestart op 21 oktober 2026. Deze notitie beschrijft de controle en bronbevindingen; alleen een geslaagde productiecontrole bevestigt publicatie.

## Wat is onderzocht?

De eerste inventarisatie bevat 132 eigen HTML-pagina's en 80 externe URL's. Alle eigen pagina's waren bereikbaar. De 264 lokale weergavetests gebruikten Chromium op desktop en WebKit op mobiel. Op twaalf URL's werd horizontale overloop gevonden; drie daarvan zijn oude verwijzingen naar dezelfde artikelen. Die telling is geen kwaliteitscijfer.

De acht publicatiepagina's zijn gelezen. De brontoets richtte zich op hun dragende leerclaims, maatstaven, bronverwijzingen en juridische uitspraken. Niet elk onderliggend onderzoek is opnieuw methodologisch beoordeeld.

## Afgeronde reparaties

De laatste volledige testronde op commit `12d304ee1530d26b4ae0b2d0d28eb760c9a18051` bevat 264 weergaven zonder geregistreerde JavaScript-fouten, horizontale paginaoverloop of buitenbeeld-menu's. Ook de zes resterende mobiele gevallen zijn hersteld: Bronnen, EAA-model, publicatieverificatie, Onderbouwing, Counterargument First en Justification Mapping.

De reparaties begrenzen de elementen die de pagina verbreedden: lange koppen, knoppen, bestandsvelden en verificatieresultaten. Tabellen en brede diagrammen blijven binnen hun eigen schuifbare vak bereikbaar. De pagina wordt niet afgeknipt om een fout te verbergen.

De taaktests in Chromium en WebKit bevestigen dat de oudere workflowbouwer instellingen bewaart bij terugnavigeren en een lege taakselectie weigert. Beide prompttools verwerken gewijzigde invoer en leveren een tekstdownload met die invoer. De verificatiepagina wijst een ongeldig manifest af. De auditjob faalt voortaan bij gevonden lokale weergavefouten; een uitgevoerde test is niet meer automatisch een geslaagde test.

Bewijs: GitHub Actions-run `39622423436`, artifact `12355487059`. Het opgehaalde ZIP-bestand heeft SHA-256 `b9026753c1ea08fc974bcb5ad2fe074fcc9ffba01f113727739046759ab04fc4`, gelijk aan de artifactdigest. PR #63 is samengevoegd als commit `a63ca3116292516739f77b976be7c86154af437a`. Publicatie wordt afzonderlijk gecontroleerd.

## Inhoudelijke correcties

- Wang & Fan (2025): het tijdschrift trok de studie op 22 april 2026 in. De eerdere EAI-rapportage is geen bruikbare onderzoeksbasis. De oorspronkelijke tekst blijft bewaard naast een gedateerde correctie.
- Task Density: de voorbeeldscores en drempel 0,7 in het oude voorstel zijn niet als gevalideerde leermeting onderbouwd. De genoemde Sweller-publicatie kon niet worden geverifieerd.
- Oudere Act of Learning-teksten, Beyond Explainability en AI-balans: een goede of slechte prestatie met of zonder AI bewijst niet zonder verdere meting dat leren geheel heeft plaatsgevonden of geheel is uitgebleven. Algemene verboden en vaste aantallen prompts zijn geen gevalideerde grenzen.
- De juridische tekst in Act of Learning deel 2 is verouderd. De huidige Commissie-uitleg bij artikel 4 verlangt maatregelen voor de ontwikkeling van AI-geletterdheid, geen specifiek niveau voor ieder individu.

Primaire bronnen, opnieuw gelezen op 21 oktober 2026:
- https://www.nature.com/articles/s41599-026-07310-z
- https://digital-strategy.ec.europa.eu/en/policies/ai-talent-skills-and-literacy
- https://researched.eu/nieuws/de-researched-nederland-podcast-aflevering-71-ai-in-ons-onderwijs-en-uitwerking-van-het-inspectie-oordeel

## Functionele grenzen

Vier Netlify-tools reageerden met 429 in de testomgeving. Dat bewijst geen verwijdering of algemene storing. De volledige werking is niet bevestigd.

Bij What If zijn fictieve lesgegevens ingevoerd, een fase en werkvorm gekozen en is een lesplan bekeken. De aanvullende download- en kopieertest liep vast; die acties zijn niet goedgekeurd. Ook de nieuwe poging op 21 oktober liep tegen een browsertime-out aan. Bij enkele andere externe apps is alleen de publieke ingang bekeken. Afgesloten docent- en leerlingstromen vereisen een apart testaccount.

De gepubliceerde Ed25519-handtekening van het manifest is geldig onder de gepubliceerde sleutel. Het originele ondertekende promptbook is niet aangeleverd; de integriteit van dat document is dus niet volledig getest. Het ondertekende manifest wordt niet aangepast.

De aanvullende lokale taaktests gebruiken fictieve invoer, blokkeren externe API's en onderscheiden werkende tekstexport van niet-bevestigde PNG/PDF-export. Geen leerlinggegevens, nieuwe accounts of betaalde AI-aanroepen.

## Bronbehoud

De bestanden in `content/legacy/` blijven ongewijzigd. Gedateerde aanvullingen worden tijdens het bouwen toegevoegd. De House of Talents-versie en de historische 3D-bestanden zijn uitgesloten.
