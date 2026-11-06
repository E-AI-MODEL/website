# EAImesh en EAIstudio op eaimodel.nl

Op verzoek van Hans worden de bestaande HTML-tools gepubliceerd, naast WiHTML. De toolspagina’s in beide talen, de bestaande /tools/-route en het gedeelde menu verwijzen naar alle drie.

| Product | Introductie | Werkende tool | Bron |
| --- | --- | --- | --- |
| EAImesh | /tools/eaimesh/ | /tools/eaimesh/start/ | EAImesh 2.html, versie 0.6.1, 13 september 2026 |
| EAIstudio (presentaties) | /tools/eaistudio/ | /tools/eaistudio/studio/ | EAIdeck_studio_2_2_1(1).html, versie 2.2.1, 12 september 2026 |

De bronbestanden staan in content/eaimesh en content/eaistudio. De build publiceert de HTML ongewijzigd. De presentatiestudio behoudt intern de naam EAIdeck Studio, haar bestandsformaat en haar bestaande opslag. Dit is de bestaande zelfstandige presentatiestudio. Het React-project EAI Studio Aurora is een andere toepassing en wordt hier niet gepubliceerd.

EAImesh biedt een bladwijzer die de gebruiker op een openbare GitHub-repository start. De proef controleert het maken en tonen van die bladwijzer en het openen van de configuratie op een GitHub-testpagina. Dat is geen volledige controle van iedere repository-parser of grafische weergave.

De bestaande presentatiestudio verwijst naar een appmanifest, iconen en een service worker. Die bestanden worden nu ook geleverd. De service worker blijft binnen /tools/eaistudio/studio/ en bewaart alleen de appbestanden. Projecten en geëxporteerde presentaties worden niet naar een server verstuurd. De browserproef controleert het opnieuw openen van de app zonder netwerk en het downloaden en offline openen van de presentatie-HTML.

Controles: tests/test_tool_launch.py en scripts/test_tool_launch.mjs. De laatste controleert de werkelijke browserbediening, projectexport, presentatie en mobiele breedte. Echte gebruikersfeedback en installatie op verschillende telefoons zijn nog niet gemeten.
