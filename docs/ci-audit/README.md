# Historische nulmeting CI/CD: 25 november 2026

**Historisch document; niet de actuele workflowconfiguratie.** De inventaris is gebaseerd op main `a752987bcd5aef4ac354ea11aa38acbd750c73a0`, vóór de herstructurering. De huidige stand is opgenomen in de vergelijking onderaan. De repository bevatte 824 gevolgde bestanden en 45 Actions-workflows. PR #396 voegt een 46e workflow toe. De nulmeting komt uit de GitHub Jobs API. GitHub registreert tijden per stap op hele seconden. Een stap met vijf tests heeft één gezamenlijke tijd. Op 26 november zijn twaalf concrete voorbeeldruns opnieuw gecontroleerd tegen de Jobs API. 238 van de 427 stapregels hebben nu een herbevestigde meting met broncommit, job-ID, daadwerkelijke jobnaam en API-stapnummer. De overige 189 regels hebben geen herbevestigde tijd; 178 eerder ingevulde, niet herbevestigde tijden zijn gewist. Dertien bevestigde metingen zijn aan een andere, passende run gekoppeld. De originele, ongecorrigeerde [CSV blijft in de Git-geschiedenis](https://github.com/E-AI-MODEL/website/blob/da1ebe1b0af2b3eb78d9c755eaf22ce86ecabb56/docs/ci-audit/stappen.csv) bewaard. Bij matrixjobs is één concrete job bemonsterd; dit is geen gemiddelde. De stapdefinities en bestandskoppelingen zijn historisch en niet integraal opnieuw geïnventariseerd.

- [Workflows en rechten](workflows.csv) bevat alle jobs, triggers, padfilters, wachtrijen en aanroepen.
- [Stappen en metingen](stappen.csv) koppelt iedere stap aan scripts, voorwaarden en waar beschikbaar een gemeten run.
- [Tests en afhankelijkheden](tests.csv) koppelt testbestanden aan deze stappen. Letterlijke verwijzingen geven een ondergrens. Wildcards, opgebouwde URL's, imports en gedeelde bouwcode kunnen meer raken.
- [Open PR’s](open-prs.csv) is de momentopname voor deze audit. Een gedeeld bestand vraagt inhoudelijke vergelijking bij het samenvoegen.

## Historische voorbeelden van doorlooptijden

| Run | Van aanmaken tot afronden | Jobs die de tijd bepalen |
| --- | ---: | --- |
| [PR #396, website](https://github.com/E-AI-MODEL/website/actions/runs/45562543789) | 8m26s | UI 8m13s, Anatomie WebKit 3m42s, ICT WebKit 2m40s. Deze jobs liepen deels parallel. |
| [PR #396, benchmark](https://github.com/E-AI-MODEL/website/actions/runs/45562544068) | 39s | Onafhankelijke validatie 35s |
| [Hoofdversie, Theory7](https://github.com/E-AI-MODEL/website/actions/runs/45552268124) | 13m55s | UI 8m27s, upload en livecontroles samen 5m12s |

Deze runs hebben verschillende bronbomen. De tijden zijn voorbeelden, geen schatting van de winst. De algemene sitebouw duurde in deze twee websiteruns 25s en 32s voor de hele buildjob. De tijd van de UI-job is vooral browserwerk.

## Van bron naar productie vóór de refactor

`build_site.py` combineert legacy-inhoud, vertalingen, catalogi en losse toepassingen. Soms zijn zowel een bewerkbare bron als een gepubliceerde kopie ingecheckt. `build_anatomie.py` levert onder meer lokale modellen, Draco en de viewer. De anatomiecontrole inspecteert de tussenstand vóór `prepare_ui.py`. Die laatste stap maakt de zoekindex uit de gebouwde website, past gedeelde navigatie toe, maakt redirects en geeft CSS en JavaScript bestandsnamen met een hash. Controleer het website-register, de NL/EN-routes, de identiteit van standalones en de uiteindelijke build ook bij een kleine URL-wijziging.

| Gewijzigde bron | Bereik |
| --- | --- |
| Hartslaglab, hartmeshes, oorsprong van GLB | Hartcyclus, geometrie, uitleg, browsers en atlasbouwer. Gedeelde anatomiebouw raakt beide toepassingen. |
| Galactisch Observatorium | Melkweg binnen science-observatory. De afzonderlijke route melkweg-lab heeft eigen mobiele en visuele tests. |
| Stellair Observatorium | Leeuw, sterrenposities en onderlinge afstanden. Wetenschappelijke benchmark gebruikt beide observatoria. |
| Natuurkunde | Gedeelde proefcode, 53 experimenten, mobiele bediening, vaste werkruimte en grafieken. Wiskunde deelt de werkruimteworkflow. |
| ICT-scan | Vier registers, bronhashes, PHP-bewerkendpoint, afgeschermde bronmappen, dashboard, exports en WebKit. Beheer-Worker en GitHub zijn mede-afhankelijkheden. |
| LEIF | Statische bestanden plus Supabase-sessies, rollen en scheiding per deelnemer. De negatieve controle verwacht een live 404. |
| EAIgit, EAIwork | projecthulp-assets, wizard en contractproef met de vastgepinde EAIwork-repository. De bronroute en de gebouwde route zijn verschillende testobjecten. |
| EAIgame, TOPO | Spelgegevens en echte 3D-rendering respectievelijk eigen bronboom, kaartgegevens, Chromium en WebKit. TOPO valt buiten de algemene FTPS-mirror. |
| Gedeelde CSS, JavaScript, templates, scripts, register, onbekende paden | Brede selectie. Ook wijzigingen aan een generator of CI bepalen welke controles nodig zijn. |

De bestaande selector wordt op drie plekken aangeroepen met dezelfde diff. Bij een PR ziet deze alleen het verschil met de eerste ouder van de mergecommit. Op main selecteert hij alles. Afzonderlijke workflows kennen hun eigen padfilters. De Natuurkundetests voor referenties, grafieken en animatie draaien in build-site én source-checks. De algemene build, UI, ICT WebKit, archiefaudit en verschillende wetenschapstests bouwen opnieuw. Afwijkende browserversies en controles vóór en na het genereren zijn geen bewezen doublures.

## Publicatie, rechten en herstel vóór de refactor

Een push naar main start Theory7. Een eigenaar kan met /publish-eai dezelfde workflow nogmaals starten. De upload gebruikt een artifact uit de eigen run, vergelijkt SHA-256 voor alle lokale bestanden, controleert de huidige main-commit en verifieert live onder andere ICT, modellen en hartmeshes. Het manifest bevat geen boom-ID, runnummer of testuitslagen. De wachtrij theory7-production beschermt ook acht handmatige herstelroutes. TOPO heeft zijn eigen wachtrij. De statistiekentaak schrijft periodiek een aggregaat naar main en Theory7. Ook GitHub Pages bouwt en publiceert afzonderlijk. Een wijziging aan de hoofdworkflow alleen dekt deze routes niet.

Een mislukte upload kan een gedeeltelijk gewijzigde site achterlaten. Assets gaan vóór HTML, de mirror verwijdert oude bestanden niet en eerdere gehashte assets blijven beschikbaar. Er is geen bewijs van een geteste atomische terugrol van de hele website. Bewaar de vorige gevalideerde versie en laat een herstel via dezelfde eigenaarscontrole, huidige bronboom en livecontroles lopen. De FTP-certificaatpin wordt apart gecontroleerd. Meerdere deelworkflows schakelen certificaatcontrole in de overdrachtsclient zelf uit.

De [actieve main-regel](https://github.com/E-AI-MODEL/website/rules/27792543) vereist een actuele PR, opgeloste gesprekken en static-checks. Nul verplichte goedkeurende reviews. Alleen github-pages kwam terug uit de Environments API, zonder vereiste reviewer. De connector meldt adminrechten voor de verbonden identiteit. GitHub gaf 401 voor de volledige medewerkerslijst en de standaard Actions-rechten. Bypassrechten en eigendom van productiesecrets zijn niet onafhankelijk vastgesteld.

Cloudflare gebruikt een Worker met D1, toegestane origin en Turnstile. Tests omvatten sessies, rechten, CSRF, SQLite en anonieme liveverzoeken. Wrangler-configuratie is geen bewijs van een live deployment. Supabase-code voor site-insights en LO heeft SQL-schema's en externe endpoints. De LEIF-API, GitHub API, Cloudflare Analytics, Hugging Face en externe LO-meetgegevens hebben eigen beschikbaarheid en versiebeheer. Geef PR-code geen productiecredentials. Scheid read-only controles van taken die datasets of onderzoeksbranches schrijven.

PR #278 wijzigt dezelfde publicatie en anatomiecontroles. #290 raakt liveverificatie. #346 raakt publicatie-audits, #395 de observatoriumroutes, #396 de benchmark. #275 raakt authenticatie en #352, #356 en #362 eigen toepassingen. Herbereken de verschillen tegen de meest recente main en de laatst bevestigde publicatie vóór integratie.

## Oorspronkelijk verbeterplan

Eerst de testselectie en regressies als afzonderlijke wijziging. Daarna één bouwresultaat doorgeven aan parallelle testjobs. Bewijs de identiteit van run, bronboom, bestandenset en testuitslag vóór vrijgave. Houd de dagelijkse reeks read-only. Promoveer alleen een kandidaat van de vertrouwde main-workflow. Een PR-artifact is nooit een productiebron. Behoud bij onvolledige informatie de bredere controles. Vergelijk doorlooptijden pas op gelijkwaardige versies en met de feitelijke jobresultaten.

## Vergelijking met de gepubliceerde versie op 26 november 2026

Stand: main `e464e8a9386bff3216cf32647b796d39054bf953`, inclusief #410 en #414. De huidige bronbestanden bevatten 49 workflowdefinities. Het aantal bestanden is geen maat voor het aantal uitgevoerde jobs. Zie ook [de tussenstand na #403](optimization-2026-11-25.md).

| Onderwerp | Toen | Nu |
| --- | --- | --- |
| Publicatie | Theory7-workflow valideert en publiceert | `validate-main.yml` valideert; Theory7 en TOPO worden na een geslaagde run automatisch gestart |
| Sitebuild | Meerdere jobs bouwen zelfstandig | Centrale bouwjob met een manifest voor commit, boom, repository, run en bouwpoging; afhankelijke controles ontvangen het artifact |
| Toepassingstests | Verspreide triggers en dubbele uitvoering | Centrale selectie met `ci_suites.json`, gekoppeld aan de verplichte eindcontrole |
| Gedeeltelijke rerun | Geen betrouwbaar hergebruik over pogingen | #414 koppelt productiepublicatie aan de werkelijke geslaagde upload van dezelfde validatierun |
| Integriteit | Exacte HTML en bestandshashes | Exacte artifact- en bestandshashes, vertrouwde validatierun, bronboom en livecontroles |
| Pages | Afzonderlijke branch-build | Nog steeds afzonderlijke branch-build; niet meeverhuisd naar het gevalideerde artifact |

### Geobserveerde resultaten

| Run | Verstreken tijd volgens GitHub | Uitkomst |
| --- | ---: | --- |
| [#414 PR](https://github.com/E-AI-MODEL/website/actions/runs/45711977206) | 8m46s | 46 jobs geslaagd |
| [Hoofdvalidatie](https://github.com/E-AI-MODEL/website/actions/runs/45713949898) | 12m15s inclusief mislukte poging en wachttijd; poging 2: 2m04s | 47 jobs geslaagd, Leeuw WebKit heruitgevoerd |
| [Theory7](https://github.com/E-AI-MODEL/website/actions/runs/45715687138) | 8m30s | Gevalideerde sitebuild uit poging 1 opnieuw gebruikt; alle livecontroles geslaagd |
| [TOPO](https://github.com/E-AI-MODEL/website/actions/runs/45715687099) | 47s | Geslaagd, eigen artifact uit poging 2 |

De publicatie gebruikte `site-release-45713949898-1` (artifact 15068842217) na succesvolle validatiepoging 2. Daarmee is het hergebruik in de productiepublicatie aangetoond. Deze runs gebruiken verschillende bronbomen en testselecties dan de historische voorbeelden. Er is geen vergelijkbare meting van tijdwinst of kosten gemaakt.

### Openstaande technische punten

- GitHub Pages bouwt nog onafhankelijk van de centrale gevalideerde websitebuild. Verwijder geen gevolgde toolkopieën voordat de publicatieroute is aangepast en gecontroleerd.
- #414 repareert artifactselectie bij de productiepublicatie. De gedeelde `checked-build`-actie en de EAIspeak-artifactdownload in `build-site.yml` gebruiken nog het actuele pogingsnummer. Bij een gedeeltelijke rerun van een artifact-afhankelijke job kan dat afzonderlijk een ontbrekend bestand opleveren. Dit is uit de broncode vastgesteld; geen nieuwe mislukte run hiervoor opgewekt.
- WebKit is incidenteel onverwacht afgesloten. De verbeterde Leeuw-bediening en archiefredirectcontrole zijn geslaagd, maar dat bewijst niet dat alle browserinstabiliteit verdwenen is.
- De eerdere punten over Pages-instellingen, herstelprocedures, productiecredentials en externe systemen zijn niet opnieuw volledig geaudit. Geen algemene veiligheids- of volledigheidsclaim.
