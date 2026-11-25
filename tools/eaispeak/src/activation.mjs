export const LIVE_SAMPLES=Object.freeze({'nl-NL':'Goedemorgen. Dit is een test.','en-US':'Good morning. This is a test.','fr-FR':'Bonjour. Ceci est un test.','de-DE':'Guten Morgen. Das ist ein Test.','es-ES':'Buenos días. Esto es una prueba.','pt-PT':'Bom dia. Este é um teste.'});
export const liveKey=s=>JSON.stringify([s.mode,s.source,s.target,s.route,s.recognition,s.endpoint,s.speak]);
export const talkKey=s=>JSON.stringify([s.engine,s.model,s.endpoint,s.source,s.target,s.voice]);
export function activationGate(){let verified=null;return {mark(key){verified=key;},clear(){verified=null;},has(key){return verified!==null&&verified===key;}};}
export function liveNeedsModel(s){return s.recognition!=='browser'||s.mode==='translate';}
const localDocs='https://github.com/E-AI-MODEL/website/blob/main/tools/eaispeak/docs/local-transcription.md',speechDocs='https://github.com/E-AI-MODEL/website/blob/main/tools/eaispeak/docs/speech-engines.md';
export const ROUTES=Object.freeze({
browser:{name:'Browser',help:'Geen eigen spraakserver nodig. De browser kan spraak naar zijn eigen online dienst sturen. Je geeft pas microfoontoestemming bij starten.'},
apple:{name:'Apple op deze Mac',help:'macOS 26 of hoger. Installeer de Apple-helper en start de lokale transcriptiebridge. Nederlands is niet gegarandeerd; kies Whisper als Apple geen taalmodel meldt.',url:localDocs,command:'Open de map bridge. Compileer de Apple-helper volgens de handleiding. Start daarna: python transcribe.py --engine apple'},
whisper:{name:'Whisper op mijn computer',help:'Installeer een meertalig Whisper-model en de lokale EAIspeak-bridge. Start de server voordat je verbindt.',url:localDocs,command:'Zet EAISPEAK_WHISPER_MODEL op de lokale modelmap. Start in bridge/: python transcribe.py --engine whisper'},
moshi:{name:'Moshi · eigen server',help:'Engels gesprek. Op Apple Silicon kun je de meegeleverde launcher gebruiken. De modeldownload kan meerdere GB kosten.',url:speechDocs,command:'bash tools/eaispeak/bridge/start-macos.sh moshi'},
hibiki:{name:'Hibiki · eigen server',help:'Frans naar Engels. Start de modelserver en EAIspeak-bridge.',url:speechDocs,command:'bash tools/eaispeak/bridge/start-macos.sh hibiki'},
'hibiki-zero':{name:'Hibiki-Zero · eigen server',help:'Frans, Spaans, Duits of Portugees naar Engels. Vereist een geschikte NVIDIA-modelserver, een bridge en zo nodig beveiligde WSS.',url:speechDocs},
dessa:{name:'Dessa',help:'Nog niet beschikbaar. Kies een andere route.'}});
export function guidance(node,message,state='idle'){node.textContent=message;node.dataset.state=state;}
