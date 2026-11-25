# Websitecontrole en publicatie op 25 november 2026

Onderzocht op main `a752987bcd5aef4ac354ea11aa38acbd750c73a0`. De repository bevatte 824 gevolgde bestanden en 45 Actions-workflows. PR #396 voegt een 46e workflow toe. De nulmeting komt uit de GitHub Jobs API. GitHub registreert tijden per stap op hele seconden. Een stap met vijf tests heeft één gezamenlijke tijd. Een leeg tijdveld betekent dat de steekproef geen herleidbare meting opleverde.

- [Workflows en rechten](workflows.csv) bevat alle jobs, triggers, padfilters, wachtrijen en aanroepen.
- [Stappen en metingen](stappen.csv) koppelt iedere stap aan scripts, voorwaarden en waar beschikbaar een gemeten run.
- [Tests en afhankelijkheden](tests.csv) koppelt testbestanden aan deze stappen. Letterlijke verwijzingen geven een ondergrens. Wildcards, opgebouwde URL's, imports en gedeelde bouwcode kunnen meer raken.
- [Open PR’s](open-prs.csv) is de momentopname voor deze audit. Een gedeeld bestand vraagt inhoudelijke vergelijking bij het samenvoegen.

## Gemeten tijden

| Run | Van aanmaken tot afronden | Jobs die de tijd bepalen |
| --- | ---: | --- |
| [PR #396, website](https://github.com/E-AI-MODEL/website/actions/runs/45562543789) | 8m26s | UI 8m13s, Anatomie WebKit 3m42s, ICT WebKit 2m40s. Deze jobs liepen deels parallel. |
| [PR #396, benchmark](https://github.com/E-AI-MODEL/website/actions/runs/45562544068) | 39s | Onafhankelijke validatie 35s |
| [Hoofdversie, Theory7](https://github.com/E-AI-MODEL/website/actions/runs/45552268124) | 13m55s | UI 8m27s, upload en livecontroles samen 5m12s |

Deze runs hebben verschillende bronbomen. De tijden zijn voorbeelden, geen schatting van de winst. De algemene sitebouw duurde in deze twee websiteruns 25s en 32s voor de hele buildjob. De tijd van de UI-job is vooral browserwerk.

## Van bron naar productie

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

## Publicatie, rechten en herstel

Een push naar main start Theory7. Een eigenaar kan met /publish-eai dezelfde workflow nogmaals starten. De upload gebruikt een artifact uit de eigen run, vergelijkt SHA-256 voor alle lokale bestanden, controleert de huidige main-commit en verifieert live onder andere ICT, modellen en hartmeshes. Het manifest bevat geen boom-ID, runnummer of testuitslagen. De wachtrij theory7-production beschermt ook acht handmatige herstelroutes. TOPO heeft zijn eigen wachtrij. De statistiekentaak schrijft periodiek een aggregaat naar main en Theory7. Ook GitHub Pages bouwt en publiceert afzonderlijk. Een wijziging aan de hoofdworkflow alleen dekt deze routes niet.

Een mislukte upload kan een gedeeltelijk gewijzigde site achterlaten. Assets gaan vóór HTML, de mirror verwijdert oude bestanden niet en eerdere gehashte assets blijven beschikbaar. Er is geen bewijs van een geteste atomische terugrol van de hele website. Bewaar de vorige gevalideerde versie en laat een herstel via dezelfde eigenaarscontrole, huidige bronboom en livecontroles lopen. De FTP-certificaatpin wordt apart gecontroleerd. Meerdere deelworkflows schakelen certificaatcontrole in de overdrachtsclient zelf uit.

De [actieve main-regel](https://github.com/E-AI-MODEL/website/rules/27792543) vereist een actuele PR, opgeloste gesprekken en static-checks. Nul verplichte goedkeurende reviews. Alleen github-pages kwam terug uit de Environments API, zonder vereiste reviewer. De connector meldt adminrechten voor de verbonden identiteit. GitHub gaf 401 voor de volledige medewerkerslijst en de standaard Actions-rechten. Bypassrechten en eigendom van productiesecrets zijn niet onafhankelijk vastgesteld.

Cloudflare gebruikt een Worker met D1, toegestane origin en Turnstile. Tests omvatten sessies, rechten, CSRF, SQLite en anonieme liveverzoeken. Wrangler-configuratie is geen bewijs van een live deployment. Supabase-code voor site-insights en LO heeft SQL-schema's en externe endpoints. De LEIF-API, GitHub API, Cloudflare Analytics, Hugging Face en externe LO-meetgegevens hebben eigen beschikbaarheid en versiebeheer. Geef PR-code geen productiecredentials. Scheid read-only controles van taken die datasets of onderzoeksbranches schrijven.

PR #278 wijzigt dezelfde publicatie en anatomiecontroles. #290 raakt liveverificatie. #346 raakt publicatie-audits, #395 de observatoriumroutes, #396 de benchmark. #275 raakt authenticatie en #352, #356 en #362 eigen toepassingen. Herbereken de verschillen tegen de meest recente main en de laatst bevestigde publicatie vóór integratie.

## Volgorde

Eerst de testselectie en regressies als afzonderlijke wijziging. Daarna één bouwresultaat doorgeven aan parallelle testjobs. Bewijs de identiteit van run, bronboom, bestandenset en testuitslag vóór vrijgave. Houd de dagelijkse reeks read-only. Promoveer alleen een kandidaat van de vertrouwde main-workflow. Een PR-artifact is nooit een productiebron. Behoud bij onvolledige informatie de bredere controles. Vergelijk doorlooptijden pas op gelijkwaardige versies en met de feitelijke jobresultaten.
