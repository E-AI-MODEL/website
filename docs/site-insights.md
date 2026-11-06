# EAI Insights

Deze pagina toont echte dagtotalen. Geen voorbeelddata, geen unieke bezoekersaantallen.

- Pagina: `/nl/insights/` en `/en/insights/`
- Browser: `assets/site-insights.js`, geladen door `assets/site-refresh.js` of rechtstreeks op de homepage en in door de build gemaakte pagina's.
- Database: `eai_site_daily_counts` met datum, publiek pad, gebeurtenis, apparaatgroep en aantal.
- API: publieke GET voor tellingen; POST vanuit het eigen domein, met servervalidatie van route en event. De browser ziet nooit een databasegeheim.
- `pagina`: een geladen pagina. `tool`: klik naar een tool op eaimodel.nl. `gelezen`: minstens twintig seconden zichtbaar op het scherm.
- De teller is geen maat voor unieke bezoekers, leerrendement of menselijke aandacht. Bots en herladen kunnen de aantallen beïnvloeden.
- Geen cookies, opslag van vaste browser-ID's of queryparameters. `Do Not Track` en Global Privacy Control worden gerespecteerd. LEIF en de private handoff buiten meting. Supabase kan voor beveiliging wel eigen technische verzoeklogboeken bijhouden.
- Bekijk cijfers zonder ingelogde beheerrechten, uitsluitend op geaggregeerd niveau. De database weigert rechtstreeks lezen en schrijven vanuit `anon` of `authenticated`.
- Dit is een eerste versie. Voor betere meetkwaliteit zijn botscreening en bescherming tegen kunstmatig veel gebeurtenissen gewenst.

## Publicatie en controle

De database-migratie is op 6 november 2026 uitgevoerd op het bestaande EAI-Supabaseproject. Edge Function `eai-site-insights` draait in dezelfde omgeving. De tellers komen pas binnen nadat de website de browserscriptwijziging heeft gepubliceerd.

Tests: `tests/test_site_insights.py`, sitebuild en de bestaande UI-checks. Controleer na publicatie in de browser of de grafieken niet op voorbeeldcijfers terugvallen.