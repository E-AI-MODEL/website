# Vaste browseromgeving: zware WebKit- en combinatietests

Basis: `f16222f7636d16e7ed2e2594148dc2df8f0f2365`, geslaagde main-validatie [45839467339](https://github.com/E-AI-MODEL/website/actions/runs/45839467339).
Volgende stap na #415, geen wijziging aan publicatie of aan toepassingsbronnen.

| Job | Eerdere volledige jobduur |
| --- | ---: |
| anatomy-webkit | 246 s |
| audit-archive | 349 s |
| check-own-exports | 111 s |
| llm-observatorium-ui | 75 s |
| science-fixed-workspace | 238 s |
| science-studio-webkit | 95 s |

De zes jobs gebruiken de bestaande Node-runtimeactie met de versiepassende Playwright 1.56.1 Noble-image en 1 GiB shared memory. De browserbibliotheken en executables komen uit de image; de gecontroleerde Node-binding wordt lokaal geïnstalleerd. Bestaande Python 3.12, Node 22, bash, testcommando's, guards voor dubbele Chromium-tests, timeout, buildartifactcontrole en poginggebonden bewijs blijven behouden. Ook losse workflow_dispatch-runs behouden hun bestaande bouwroute.

De snelle Chromium-only jobs, de aparte ICT-WebKit-omgeving (1.56.0), Leeuw, de dagelijkse browserproeven en alle publicatieworkflows blijven voorlopig ongewijzigd. De laatste dagelijkse run [45805114589](https://github.com/E-AI-MODEL/website/actions/runs/45805114589) had afzonderlijke fouten bij Firefox (Leeuw-camera) en de HTTP-aanvragen voor live Cloudflare-meting; die zijn geen bewijs van een probleem in deze zes installaties.

Acceptatie: alle bestaande PR-controles groen, geen nieuwe actionlint-fouten, vergelijking van testinventaris, geen nieuwe reviewbevindingen, behoud van testbewijs. Vergelijk de zes jobtijden met bovenstaande referentie na CI. Geen tijdwinstgarantie vooraf. De echte documentatie-only selectiemeting blijft gepland voor een reguliere documentatiewijziging na geslaagde publicatie.
