// Browserstemmen worden per taal gekozen. De lijst komt van het apparaat, niet van een modelcatalogus.
const KEY='eaispeak-browser-voice-';
export const voiceLanguage=(value='')=>String(value).split('-')[0].toLowerCase();
export function availableVoices(synthesis,language) {
  const code=voiceLanguage(language);
  if(!synthesis?.getVoices)return [];
  return synthesis.getVoices().filter(v=>voiceLanguage(v.lang)===code);
}
export function readVoicePreference(language,storage=globalThis.localStorage) {
  try{return storage?.getItem(KEY+voiceLanguage(language))||'';}catch{return '';}
}
export function saveVoicePreference(language,uri,storage=globalThis.localStorage) {
  try{
    const key=KEY+voiceLanguage(language);
    if(uri)storage?.setItem(key,uri);
    else storage?.removeItem(key);
  }catch{}
}
