# Beperking en testbewijs, 19 november 2026

- De drie JS-tests voor de podiumvolgorde, modelbestanden en het Franse script slagen lokaal.
- `node --check src/main.js` slaagt lokaal.
- Er is in de ontwikkelomgeving geen verbinding met npm of Hugging Face voor een echte modeltest.
- Daarom zijn browserbuild, modelstart, spreekkwaliteit en vertraging niet werkelijk geverifieerd.
- De Phonon French checkpoint is gated en onder CC BY-NC 4.0. Niet automatisch publiek hosten.
- De Nederlandstalige stem komt uit een door de gebruiker gekozen aanwezige systeemstem. Dat is een tijdelijke beperking, geen bewijs van een bijzondere stem.
- De route voor de nieuwe pagina wordt door de bestaande websitebuild expliciet gekopieerd; de workflow draait een npm-installatie en de browserbuild.
