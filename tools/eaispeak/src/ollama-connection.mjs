const EAI_ORIGINS=['https://eaimodel.nl','https://www.eaimodel.nl'];
function quote(value){return "'"+String(value).replaceAll("'","'\\''")+"'";}
export const OLLAMA_HTTP='http://localhost:11434/';
export const OLLAMA_HTTPS='https://localhost:11435/';
export const CADDY_CONFIG=[
  '{',
  '  auto_https disable_redirects',
  '  admin off',
  '}',
  'https://localhost:11435, https://127.0.0.1:11435 {',
  '  bind 127.0.0.1 [::1]',
  '  tls internal',
  '  reverse_proxy 127.0.0.1:11434 {',
  '    header_up Host 127.0.0.1:11434',
  '  }',
  '}'
].join('\n')+'\n';

export function macOllamaCommands(siteOrigin){
  const parsed=new URL(siteOrigin);
  if(!['http:','https:'].includes(parsed.protocol)||parsed.origin!==siteOrigin)
    throw new Error('Geen geldige website-origin');
  const origins=EAI_ORIGINS.includes(siteOrigin)?EAI_ORIGINS.join(','):siteOrigin;
  const configFile='"$HOME/.config/eaispeak/Caddyfile"';
  const writeConfig='mkdir -p "$HOME/.config/eaispeak" && printf '+quote('%s\\n')+' '+CADDY_CONFIG.trimEnd().split('\n').map(quote).join(' ')+' > '+configFile;
  const curl=endpoint=>'curl -i --max-time 10 -H '+quote('Origin: '+siteOrigin)+' '+endpoint+'api/tags';
  return {
    origins,
    showOrigins:'launchctl getenv OLLAMA_ORIGINS',
    setOrigins:'launchctl setenv OLLAMA_ORIGINS '+quote(origins),
    restartApp:'open -a Ollama',
    checkListener:'lsof -nP -iTCP:11434 -sTCP:LISTEN',
    startTerminal:'OLLAMA_HOST=127.0.0.1:11434 OLLAMA_ORIGINS='+quote(origins)+' ollama serve',
    curlHttp:curl(OLLAMA_HTTP),
    curlHttps:curl(OLLAMA_HTTPS),
    writeConfig,
    startCaddy:'caddy validate --config '+configFile+' --adapter caddyfile && caddy run --config '+configFile+' --adapter caddyfile'
  };
}
