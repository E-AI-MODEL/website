# CI-optimalisatie na #403

Uitgangspunt: main `878bfa368c4a23736725621feba7c919c0e49bd5` (de geïntegreerde en geteste refactor).

## Nulmeting

[Volledige integratieproef #403](https://github.com/E-AI-MODEL/website/actions/runs/45641585869):
52 geslaagde jobs, 564 seconden van eerste jobstart tot laatste jobeinde,
3624 opgetelde jobseconden (60,4 minuten). Dit zijn gemeten jobtijden, geen berekende facturatiekosten.

| Vóór: extra centrale job of uitvoering | Na: verplichte behouden uitvoering |
|---|---|
| EAIwork dashboard: broncheck en Chromium | build-site broncheck, verify-ui matrix eaiwork |
| Science mobile WebKit (57 s) | science-fixed-workspace, exact hetzelfde commando en screenshotpad |
| Schuine worp Chromium (60 s), ook in physics-fixed | verify-ui matrix physics; WebKit blijft apart verplicht |
| LLM Chromium in afzonderlijke workflow | verify-ui matrix llm; WebKit, wiskunde, modeltrace en broncontrole blijven |
| Vier LO-browserjobs (205 s samen), mobiele proef dubbel | lo-aanvalslab: één Chromium/WebKit-installatie, zes afzonderlijke controles; tactiek en tracking blijven onafhankelijk |
| EAIgit en negen natuurkundebronchecks dubbel | source-checks, Node 22, dezelfde scope; standalone build behoudt de proeven |
| LEIF KEI en multitenant dubbel | altijd in source-checks; overige LEIF-proeven ongewijzigd |
| ICT-publicatiecheck en GitHub-sync dubbel | elk eenmaal onvoorwaardelijk; alle gebouwde-site-, bronuitsluitings- en sitemapcontroles blijven |
| Dashboard- en storycardbronchecks vóór build | verify-ui op definitief artifact; standalone build behoudt bronchecks |
| EAIgame unit-test dubbel | eaigame-workflow; browserproeven op bron én gebouwde site blijven |
| HTML-galerij node-tests dubbel | verplichte auth-workflow, inclusief syntax en anonieme livecontrole |
| Scope-unit-test dubbel | source-checks; losse build blijft zelfstandig diagnosticeerbaar |

Alle individuele browserworkflows blijven handmatig beschikbaar. De centrale
scope en verplichte jobset zijn in tests aan de releasegate gekoppeld.
De LO-modelproef is ongewijzigd uit de oorspronkelijke heredoc geëxtraheerd;
de gecombineerde workflow blijft bij een mislukte proef de andere onafhankelijke
proeven uitvoeren en faalt als een verplichte proef mislukt.

## Bewuste keuzes

- Behoud de onafhankelijke astronomische referenties en alle controles op het
  definitieve artifact. EAIspeak browser-smoke blijft verplicht voor elk nieuw
  daadwerkelijk gebouwd pakket. Geen tweede productieversie.
- De Playwright-cache is een experiment met vaste Ubuntu-versie, architectuur,
  Playwright-versie en browsercombinatie. Geen fallback-cache en geen cache van
  releasebestanden. Bestaande installatiestappen blijven actief.
- Alleen achterhaalde PR-runs worden geannuleerd. Geen aanpassing van
  Theory7-publicatie, FTPS-overdracht, eigenaarstoestemming, TOPO, herstel of Pages.
- Historische stand na #403: gedeeltelijke reruns met een ontbrekend artifact
  van de actuele runpoging bleven fail-closed. Dit is voor productiepublicatie
  hersteld in #414; zie de [geactualiseerde vergelijking](README.md#vergelijking-met-de-gepubliceerde-versie-op-26-november-2026). De overige artifactdownloaders zijn niet hiermee aangepast.
- De inventory-workflow rapporteert volledige run/uses-blokken en hun context;
  de lexicale vergelijking alleen bewijst geen semantische testgelijkheid.
- Actionlint wordt zowel op de baseline als op de gewijzigde workflows uitgevoerd;
  nieuwe bevindingen blokkeren de audit. Bestaande bevindingen blijven zichtbaar.

## Nog te verifiëren

Nieuwe volledige integratierun, actionlint-uitkomst, voor/na-inventaris,
runnergebruik en warme cache. Geen tijdwinst claimen zonder meting.
Herstelomgeving en Pages-instellingen zijn niet volledig toegankelijk via
de gebruikte GitHub-verbinding. Productiepublicatie van deze optimalisatie
vereist afzonderlijke toestemming.
