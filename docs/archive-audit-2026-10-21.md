# Controle archief en gekoppelde tools

Controle gestart op 21 oktober 2026. Deze notitie beschrijft de scope en bronbevindingen; alleen een geslaagde productiecontrole bevestigt publicatie.

## Wat is onderzocht?

De eerste inventarisatie bevat 132 eigen HTML-pagina's en 80 externe URL's. Alle eigen pagina's waren bereikbaar. De 264 lokale weergavetests gebruikten Chromium op desktop en WebKit op mobiel. Op twaalf URL's werd horizontale overflow gevonden; drie daarvan zijn oude verwijzingen naar dezelfde artikelen. Die telling is geen kwaliteitscijfer.

De acht publicatiepagina's zijn gelezen. De brontoets richtte zich op hun dragende leerclaims, maatstaven, bronverwijzingen en juridische uitspraken. Niet elk onderliggend onderzoek is opnieuw methodologisch beoordeeld.

## Inhoudelijke correcties

- Wang & Fan (2025): het tijdschrift trok de studie op 22 april 2026 in. De eerdere EAI-rapportage is geen bruikbare onderzoeksbasis. De oorspronkelijke tekst blijft bewaard naast een gedateerde correctie.
- Task Density: de voorbeeldscores en drempel 0,7 in het oude voorstel zijn niet als gevalideerde leermeting onderbouwd. De genoemde Sweller-publicatie kon niet worden geverifieerd.
- Oudere Act of Learning-teksten, Beyond Explainability en AI-balans: een goede of slechte prestatie met/zonder AI bewijst niet zonder verdere meting dat leren geheel heeft plaatsgevonden of geheel is uitgebleven. Algemene verboden en vaste aantallen prompts zijn geen gevalideerde grenzen.
- De juridische tekst in Act of Learning deel 2 is verouderd. De huidige Commissie-uitleg bij artikel 4 verlangt maatregelen voor de ontwikkeling van AI-geletterdheid, geen specifiek niveau voor ieder individu.

Primaire bronnen:
- https://www.nature.com/articles/s41599-026-07310-z
- https://digital-strategy.ec.europa.eu/en/policies/ai-talent-skills-and-literacy
- https://researched.eu/nieuws/de-researched-nederland-podcast-aflevering-71-ai-in-ons-onderwijs-en-uitwerking-van-het-inspectie-oordeel

## Functionele grenzen

Vier Netlify-tools reageerden met 429 in de testomgeving. Dat bewijst geen verwijdering of algemene storing. De volledige werking is niet bevestigd.

Bij What If zijn fictieve lesgegevens ingevoerd, een fase en werkvorm gekozen en is een lesplan bekeken. De aanvullende download- en kopieertest liep vast; die acties zijn niet goedgekeurd. Bij enkele andere externe apps is alleen de publieke ingang bekeken. Afgesloten docent-/leerlingstromen vereisen een apart testaccount.

De gepubliceerde Ed25519-handtekening van het manifest is geldig onder de gepubliceerde sleutel. Het originele ondertekende promptbook is niet aangeleverd; de integriteit van dat document is dus niet volledig getest. Het ondertekende manifest wordt niet aangepast.

De aanvullende lokale taaktests gebruiken fictieve invoer, blokkeren externe API's en onderscheiden werkende tekstexport van niet-bevestigde PNG/PDF-export. Geen leerlinggegevens, nieuwe accounts of betaalde AI-aanroepen.

## Bronbehoud

De bestanden in `content/legacy/` blijven ongewijzigd. Gedateerde aanvullingen worden tijdens het bouwen toegevoegd. De House of Talents-versie en de historische 3D-bestanden zijn uitgesloten.
