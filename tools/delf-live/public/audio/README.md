# DELF · Franse opnamen

De twee audiobestanden zijn bedoeld voor de gescripte DELF-diploma-uitreiking. Ze worden vooraf gemaakt. Tijdens de voorstelling zijn geen Ollama, Caddy, internetverbinding of live spraakgeneratie voor deze scènes nodig.

- `scene-1-interruption.mp3`: Franse spreker onderbreekt de Nederlandse toespraak
- `scene-2-discours.mp3`: de vaste Franse DELF-speech, gevolgd door de teruggave van het woord
- `audio-manifest.json`: model, stem, lengte en bestandsgrootte

Beide opnamen zijn gegenereerd met [Kokoro 82M](https://huggingface.co/hexgrad/Kokoro-82M), stem `ff_siwis`. Kokoro is beschikbaar onder Apache-2.0. De stem `ff_siwis` is gebaseerd op de SIWIS French Speech Synthesis Database (Yamagishi, Honnet, Garner en Lazaridis, University of Edinburgh, CC BY 4.0). Controleer de actuele licentievoorwaarden bij verder verspreiden.

De exacte speechtekst voor scène 2 komt uit `src/script.mjs`. Scène 1 en de afsluitende teruggave staan in `scripts/generate_scene_audio.py`. De Nederlandse reactie spreekt de presentator zelf uit. De opname begint pas na een druk op →.

Voor een andere stem of opname kunnen de twee bestanden handmatig worden vervangen via **Overige opties → Andere audio kiezen** in de podiumapp.
