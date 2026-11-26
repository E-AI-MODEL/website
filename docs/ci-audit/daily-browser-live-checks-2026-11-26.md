# Dagelijkse Firefox- en Cloudflare-controles

Uitgangspunt: main 3d7556f09598c84feee24460777ebf8ad3496c67, na #416. De dagelijkse run [45805114589](https://github.com/E-AI-MODEL/website/actions/runs/45805114589) faalde in de Leeuw-proef bij een onveranderde yaw na slepen, en in de live Cloudflare-proef bij HTTP-fouten op alle vier de URLs. De log vermeldde geen HTTP-status. De precieze oorzaak van beide storingen is nog niet bewezen.

- Voeg Firefox toe aan de bestaande, scope-gebonden Leeuw-browserproef (geen aparte volledige websitebuild). Controleer echte pointerinput, het aanraakdoel en de daadwerkelijke yaw; wacht begrensd op de waargenomen toestand. Leg bij een fout de pointer-events, viewport en screenshot vast. Firefox krijgt geen door Playwright niet-ondersteunde isMobile-instelling; de smalle viewport en reduced-motion-controles blijven.
- Bewaar bewijs van de dagelijkse browserjobs ook bij mislukking, per browser en poging.
- Controleer de vier bestaande live URLs met dezelfde herkenbare User-Agent als de releasecheck. Onderscheid HTTP-fouten van een ontbrekende beacon. Verifieer de scriptbron en het juiste token op hetzelfde element, ook na een redirect tussen de twee bekende domeinen. Begrens retries. Geen wijziging aan Cloudflare-instellingen, DNS, hosting of publicatieworkflows.
- De live Cloudflare-proef draait op PRs die zijn eigen workflow, script of tests veranderen; de afzonderlijke dagelijkse en handmatige proef blijven bestaan. De pure regressietests zijn onderdeel van source-checks.

Acceptatie: PR-controles, inclusief Firefox op 1440/390/320 px en reduced motion, groen; live Cloudflare-controle groen op alle vier de URLs; geen reviewbevindingen. De volledige dagelijkse Firefox/UI-smoke is een afzonderlijke vervolgvalidatie; een groene Leeuw-proef alleen is daarvoor geen bewijs.
