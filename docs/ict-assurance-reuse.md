# Hergebruik van eerdere controlemechanismen

Onderzocht op 21 november 2026. Deze controle betreft twee eerdere repositories
en de bestaande GitHub-synchronisatie van het ICT-dashboard. Zij is geen audit
van die volledige projecten.

## Keuze

Behoud de bestaande manifestcontrole en het herstel bij een mislukte import.
Gebruik daarnaast het kleine mechanisme uit EAIwork waarmee een check zijn
geldigheid verliest zodra de gebruikte invoer verandert. Een bewaarde groene
uitslag mag alleen meetellen voor de invoer en regels waarop de check is uitgevoerd.

Het gaat hier om een gericht hergebruik van dat mechanisme. Deze notitie verklaart
niet dat de volledige EAIwork-engine in het dashboard is geïmporteerd. De eigen
statuswoorden, bewijsrangorde en AI-koppelingen van EAIwork horen niet automatisch
bij de ICT-controles.

| Kandidaat | Geïnspecteerd gedrag | Keuze voor dit dashboard |
| --- | --- | --- |
| Bestaande `tools/ict-scan/github-sync.js` | Vergelijkt de bestanden en GitHub-blob-SHA's met het manifest. Haalt blobs op hun SHA op. Controleert aantallen en herstelt de vorige staat na een fout tijdens vervanging. | Behouden. Een nieuwe organisatieconfiguratie mag deze controles niet omzeilen. Dit is geen eigen SHA-256-herberekening van alle ontvangen bytes. |
| EAIwork, `derive.ts` en `replay.ts` | Leidt status opnieuw af uit het actuele bewijs. Gewijzigde basiswaarden maken een eerder checkresultaat ongeldig. De laatste uitslag van dezelfde check vervangt de eerdere uitslag. | Geschikt patroon voor het binden van resultaten aan invoer en regelversie, met een expliciete reden voor veroudering. |
| PiM, `modelIntegrity.ts` | Houdt ontbrekende, afwijkende, nog niet gecontroleerde en gecontroleerde modelbestanden apart. Vergelijkt bytes via SHA-256; ondersteunt ook een lokale eerste vastlegging. | Geen extra module nodig. Het modelregister en de lokale eerste vastlegging voegen hier niets toe aan de bestaande broncontrole. Het onderscheid tussen ontbrekend en gecontroleerd blijft wel bruikbaar. |

## Exacte bronversies

**EAIwork** is gelezen op commit
[`8754936ffe594766339e8f8493c963c41a0b4206`](https://github.com/E-AI-MODEL/EAIwork-/tree/8754936ffe594766339e8f8493c963c41a0b4206).

| Bestand | Git-blob-SHA | Bewijs in deze ronde |
| --- | --- | --- |
| [`packages/core/src/derive.ts`](https://github.com/E-AI-MODEL/EAIwork-/blob/8754936ffe594766339e8f8493c963c41a0b4206/packages/core/src/derive.ts) | `57ebdce7e02f95f35c5e1abdbceea9b938a0205a` | Implementatie gelezen; begrensde proef uitgevoerd. |
| [`packages/core/src/replay.ts`](https://github.com/E-AI-MODEL/EAIwork-/blob/8754936ffe594766339e8f8493c963c41a0b4206/packages/core/src/replay.ts) | `aaaa14c5468286ed0d22993b0d022b4601907702` | Aanroepende en toestandswijzigende code gelezen. |
| [`packages/core/src/validate.ts`](https://github.com/E-AI-MODEL/EAIwork-/blob/8754936ffe594766339e8f8493c963c41a0b4206/packages/core/src/validate.ts) | `f3aef6a6406ef082dd705df21cd56e9f633fec0b` | Invoergrens gelezen. |
| [`tests/grounding.test.ts`](https://github.com/E-AI-MODEL/EAIwork-/blob/8754936ffe594766339e8f8493c963c41a0b4206/tests/grounding.test.ts) | `5262335d2eb4cc989aef6fb1142a17a63294145d` | Gelezen; twee pure tests afzonderlijk uitgevoerd. Serverproeven niet uitgevoerd. |
| [`tests/core.test.ts`](https://github.com/E-AI-MODEL/EAIwork-/blob/8754936ffe594766339e8f8493c963c41a0b4206/tests/core.test.ts) | `19da8a4013e135b52098fd3eb4072b742c80e237` | Bestaande proef voor verlopen bewijs gelezen. |

**PiM** is gelezen op commit
[`840ad1f70b5d86eb9058b08f8d9d649b8773f243`](https://github.com/E-AI-MODEL/project-pim/tree/840ad1f70b5d86eb9058b08f8d9d649b8773f243).
De bestanden
[`src/lib/pim/modelIntegrity.ts`](https://github.com/E-AI-MODEL/project-pim/blob/840ad1f70b5d86eb9058b08f8d9d649b8773f243/src/lib/pim/modelIntegrity.ts)
en
[`src/lib/pim/__tests__/modelIntegrity.test.ts`](https://github.com/E-AI-MODEL/project-pim/blob/840ad1f70b5d86eb9058b08f8d9d649b8773f243/src/lib/pim/__tests__/modelIntegrity.test.ts)
hebben respectievelijk blob-SHA
`d908f1e111855182491fba8c8c30a6af49bde9dd` en
`ffde341d587715a3ea74cf221fdd1dff0ec47e54`.
Beide zijn gelezen. De PiM-tests zijn in deze ronde niet uitgevoerd.

## Uitgevoerde proef

De ongewijzigde `derive.ts` en `types.ts` uit de genoemde EAIwork-commit zijn in
een tijdelijke testmap geladen onder **Node v24.22.3**. Met `node --test` zijn
**zeven tests geslaagd**, zonder fouten of overgeslagen tests:

- Twee bestaande pure tests uit `grounding.test.ts`: volgorde-onafhankelijkheid
  en blokkering van zichzelf bevestigende cycli; oude bronloze registraties
  leveren geen ongefundeerde verhoging op. Alleen de imports zijn beperkt tot
  de te onderzoeken functies; de testinhoud is gelijk gebleven.
- Vijf gerichte controles: gewijzigde invoer maakt de uitslag ongeldig; een
  ontbrekend antwoord blijft onbekend; verlopen bewijs telt niet mee;
  modelbewijs verhoogt de uitslag niet; tegenbewijs begrenst de uitslag.

Dit bewijst het genoemde gedrag in deze afgebakende proef. Het is geen nieuwe
uitvoering van de volledige EAIwork-testsuite, de HTTP-server, de opslagketen of
een productieomgeving. Overdracht naar het dashboard vraagt nog eigen regressies
op het gebruikte gegevenscontract.

## Voorwaarden bij overname

Een checkresultaat moet verwijzen naar zijn werkelijke invoer, de regelversie en
de uitvoerdatum. Vergelijk die verwijzingen opnieuw voordat een bewaarde uitslag
wordt gebruikt. Ontbrekende of afwijkende verwijzingen leveren geen geslaagde
controle op. Laat zien waarom een nieuwe uitvoering nodig is.

De bronfunctie veronderstelt geldige domeingegevens. Neem haar datumvergelijkingen
niet over als volledige invoervalidatie. Het dashboard moet ongeldige datums,
lege registraties en verkeerde typen zelf afwijzen. Houd klok en geldigheidsduur
expliciet, zodat een proef herhaalbaar blijft.

Behoud ten minste regressies voor gewijzigde invoer, gewijzigde regels, verlopen
uitslagen, ontbrekende resultaten en ontbrekende of ongeldige verwijzingen.
Voorkom dat dubbele bewijsstukken als onafhankelijke bevestiging meetellen.
Neem het woord `proven` en de EAIwork-bewijsrangorde niet over als algemene
waarheids- of conformiteitsclaim.

De bestaande
[`tests/test_ict_scan_github_sync.mjs`](../tests/test_ict_scan_github_sync.mjs)
moet blijven controleren dat een verkeerde manifest-SHA of een verkeerd aantal
records de bestaande gegevens niet vervangt. Resultaten van nieuwe dashboardtests
horen bij de geteste dashboardversie, niet bij deze broninspectie.

## Licenties en onderhoud

De genoemde EAIwork-commit bevat
[`LICENSE`](https://github.com/E-AI-MODEL/EAIwork-/blob/8754936ffe594766339e8f8493c963c41a0b4206/LICENSE)
met **PolyForm Noncommercial 1.0.0** en de verplichte vermelding
`Copyright 2026 H. Visser / E-AI-MODEL.` Letterlijke overname vraagt behoud van
de toepasselijke voorwaarden en vermelding. Deze controle verleent geen nieuwe
licentie voor onbeperkt commercieel gebruik.

PiM vermeldt in
[`LICENSE`](https://github.com/E-AI-MODEL/project-pim/blob/840ad1f70b5d86eb9058b08f8d9d649b8773f243/LICENSE)
`MIT` en `Copyright 2026 E-AI-MODEL`. Er is geen PiM-code overgenomen. Een eventuele
latere overname moet de volledige toepasselijke licentievoorwaarden meeleveren.

Bronwijzigingen worden bewust beoordeeld en opnieuw getest. Er is geen directe
runtime-afhankelijkheid van deze andere repositories toegevoegd. Een geverifieerd
klein mechanisme is bruikbaar bewijs; een onvoorwaardelijke betrouwbaarheidsgarantie
volgt daar niet uit.
