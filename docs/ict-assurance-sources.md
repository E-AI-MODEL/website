# Bronnen en grenzen van de ICT-controles

Gecontroleerd op 21 november 2026. Deze notitie onderbouwt de keuze voor vaste,
herhaalbare softwarecontroles. Ze beschrijft geen afgeronde beoordeling van een
organisatie, leverancier of AI-systeem.

## Vastgestelde bronstatus

| Bron | Vastgesteld | Gebruik in het dashboard |
| --- | --- | --- |
| [Uitvoeringsbesluit (EU) 2026/2274](https://eur-lex.europa.eu/eli/dec_impl/2026/2274/oj/eng) | Besluit van 12 oktober 2026, gepubliceerd op 14 oktober 2026. De bijlage noemt EN 18286:2026. EUR-Lex geeft de status als in werking. | Primaire bron voor de verwijzing in het EU-Publicatieblad. Bewaar besluitdatum en publicatiedatum apart. |
| [NEN-EN 18286:2026](https://www.nen.nl/nen-en-18286-2026-en-354718) | Definitieve Engelse norm. De NEN-catalogus vermeldt 1 juli 2026 als publicatiedatum en 27 juli 2026 als registratiedatum. | Bron voor editie, titel en verkrijgbaarheid. Deze catalogusdata zijn niet de datum van harmonisatie. |
| [Europese Commissie, toelichting van 19 oktober 2026](https://digital-strategy.ec.europa.eu/en/library/first-harmonised-standard-supporting-ai-act-published-official-journal) | Beschrijft het kwaliteitsmanagement voor aanbieders van hoogrisico-AI en het vermoeden van overeenstemming voor de gedekte eisen. Pagina bijgewerkt op 21 oktober 2026. | Leesbare toelichting naast het besluit en de norm. |
| [Artikel 17, AI Act Service Desk](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-17) | Officiële artikelsgewijze weergave. De pagina verwijst naar de [geconsolideerde tekst van 27 juli 2026](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02024R1689-20260727). | Vindplaats voor eisen aan toetsing, gegevensbeheer, documentatie en verantwoordelijkheden. Gebruik de juridische tekst bij een toepasselijkheidsbesluit. |
| Door de gebruiker aangeleverde NEK EN 18286:2026, Engelse uitgave | 53 PDF-pagina's, met een extra nationale voorpagina. De Europese norm vermeldt juli 2026. Annex ZA staat op gedrukte pagina's 48–49, PDF-pagina's 49–50. | Bron voor de hieronder genoemde paragrafen en de grenzen van de dekking. De PDF wordt niet in deze repository opgenomen. |

De webbronnen zijn gericht opgehaald via Exa en Firecrawl. Een geslaagde
bronophaling bewijst de inhoudelijke juistheid van een eigen dossier niet.

## Toepassing per systeem en organisatie

EN 18286 is sectoronafhankelijk en richt zich primair op aanbieders van
hoogrisico-AI. De toepasselijkheid hangt af van het systeem, het beoogde gebruik
en de rol van de organisatie. Emmauscollege is één toepassing van het dashboard.
Een andere organisatie moet haar eigen gegevens en beoordelingen kunnen invoeren.

Leg daarom de organisatie, het systeem en zijn versie, het beoogde gebruik, de
rol, de beoordelaar, de datum en de onderbouwing afzonderlijk vast. Een rol die
nog niet is vastgesteld blijft onbekend. Het invullen van een leverancier maakt
de gebruiker van diens product niet automatisch tot aanbieder.

Een technische check kan nagaan of deze registratie bestaat en onderling klopt.
De inhoudelijke bepaling van rol, risicoklasse, toepasselijke wetgeving of een
wezenlijke wijziging vraagt een daarvoor verantwoordelijke beoordelaar.

## Begrensde vertaling naar software

Onderstaande tabel is een ontwerpkaart. De kolom met softwareondersteuning is
geen verklaring dat ieder genoemd onderdeel al is geïmplementeerd, uitgevoerd
of voldoende is om aan de norm te voldoen.

| Onderwerp | Vindplaats in de aangeleverde norm | Wat software kan ondersteunen | Wat apart moet worden beoordeeld |
| --- | --- | --- | --- |
| Toepasselijkheid en bereik | 4.2–4.4; gedrukte p.18–20, PDF p.19–21 | Vastleggen welke eis bij welk systeem hoort, met versie en reden. Signaleren van ontbrekende of verlopen beoordelingen. | Welke eisen daadwerkelijk gelden en welke aanpak voldoende is. |
| Beheer van bewijsstukken | 4.5; gedrukte p.20–22, PDF p.21–23 | Bronidentiteit, wijzigingsgeschiedenis, versies, bewaartermijn en verwijzingen controleren. | Betrouwbaarheid, volledigheid en passende bescherming van de inhoud. |
| Verantwoordelijkheden | 5.3; gedrukte p.23, PDF p.24 | Eigenaar en beoordelaar registreren; ontbrekende toewijzing signaleren. | Bevoegdheid, deskundigheid en daadwerkelijk kunnen ingrijpen. |
| Verificatie en validatie | 8.4; gedrukte p.32–33, PDF p.33–34 | Vooraf vastgelegde testgevallen, grenswaarden, uitvoercondities en resultaten bewaren en herhalen. | Of het systeem geschikt is voor zijn beoogde gebruik en voorzienbaar misbruik. |
| Gegevens en corpus | 8.5; gedrukte p.33, PDF p.34 | Herkomst, versie, labels, bewerkingen, datasetrol en bewaartermijn vastleggen; schemafouten en ontbrekende verwijzingen vinden. | Geschiktheid, representativiteit en toereikendheid voor de concrete toepassing. |
| Identiteit en wijzigingen | 8.7 en 9.4; gedrukte p.34 en 37, PDF p.35 en 38 | Systeemversie koppelen aan documentatie en gegevens; verschillen ten opzichte van een vastgelegde uitgangsversie tonen. | Gevolgen van wijzigingen en de vraag of een wijziging wezenlijk is. |
| Leveranciers | 9.3; gedrukte p.36–37, PDF p.37–38 | Criteria, beoordelingsdatum, bewijs en vervolgactie registreren. | Of geleverde producten, diensten en maatregelen aan de eigen eisen voldoen. |
| Monitoring tijdens gebruik | 9.5; gedrukte p.37–39, PDF p.38–40 | Metingen, incidenten, signalen, frequentie en opvolging vastleggen en vergelijken. | Of de verzamelde gegevens voldoende zicht geven op het gebruik en de gevolgen. |

Voor een corpus hoeft niet alle inhoud te worden herschreven. Voeg waar nodig
controleerbare metadata en expliciete koppelingen toe. Houd oorspronkelijke
bronnen, eigen annotaties en testgevallen herkenbaar uit elkaar. Een dataset die
voor ontwikkeling wordt gebruikt, wordt niet zonder onderbouwing ook een
onafhankelijke evaluatieset. Veranderingen in de EAI-taxonomie vragen een eigen
inhoudelijke beoordeling; een normverwijzing is daarvoor op zichzelf geen reden.

## Betekenis van controles en lampjes

Vaste code kan datatypen, verplichte velden, relaties, datums, waarden en expliciete
beweringen vergelijken. Zo'n feitencontrole controleert een vastgelegde bewering
tegen aangewezen gegevens. Zij beoordeelt niet zelfstandig de waarheid van
willekeurige teksten of de betrouwbaarheid van een leverancier.

Een wijzigingscontrole toont verschillen met een benoemde uitgangsversie.
Prestatieverandering vraagt ook actuele metingen, vergelijkbare testcondities en
vooraf bepaalde grenzen. Zonder die gegevens is er geen gemeten prestatie-oordeel.

Gebruik groen uitsluitend voor uitgevoerde, geslaagde controles binnen hun
vastgelegde bereik. Oranje kan aandacht, ontbrekende gegevens of een vervallen
beoordeling betekenen, mits de reden zichtbaar blijft. Rood betekent dat een
concrete controle faalde. Niet uitgevoerd, onbekend en niet van toepassing moeten
herkenbaar blijven en mogen niet stilzwijgend als geslaagd meetellen. Bewaar bij
een resultaat de invoerversie, regelversie, uitvoerdatum en verwijzing naar bewijs.

Deze controles kunnen zonder AI-model draaien. Gebruik van AI tijdens het
schrijven van code is een andere kwestie dan een AI-afhankelijkheid tijdens het
gebruik. Menselijke beoordeling van bronnen, regels en wijzigingen blijft nodig.

## Wat een groen resultaat niet verklaart

Annex ZA, gedrukte p.48–49, verbindt normonderdelen aan specifieke wettelijke
eisen en noemt voorwaarden en uitzonderingen. De verwijzing naar artikel 11(1),
eerste zin, is bijvoorbeeld gekoppeld aan volledige technische documentatie
volgens bijlage IV. De koppeling aan artikel 17(1)(g) veronderstelt een passend
risicomanagementsysteem volgens artikel 9. Artikel 17(2), (3) en (4) staan in deze
bijlage als niet gedekt.

Het vermoeden van overeenstemming geldt binnen de reikwijdte en voorwaarden van
de betrokken normonderdelen en zolang de verwijzing in het EU-Publicatieblad
blijft bestaan. Het is geen algemene verklaring dat een product of organisatie
aan alle regels voldoet. Het dashboard ondersteunt het vastleggen en controleren
van bewijs; een groen lampje is geen certificaat, juridische beoordeling of
bewijs van onderwijskundig effect.

Deze notitie bevat eigen samenvattingen en beperkte vindplaatsgegevens. Zij
vervangt de normtekst, de juridische beoordeling of een volledige toetsing niet.
