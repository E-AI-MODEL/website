import { opening, reply, closing, interrupt, handback, speech } from './script.mjs';

const STORAGE_KEY = 'eai-cloud-studio-sessions-v1';
const SELECTED_KEY = 'eai-cloud-studio-selection-v1';
const REQUIRED = ['name','opening','reply','interrupt','speech','handback','closing'];
const defaultSession = Object.freeze({
  id:'delf',
  name:'DELF scolaire',
  opening,reply,closing,interrupt,handback,speech,
  builtIn:true
});

function readSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item === 'object' &&
      typeof item.id === 'string' &&
      REQUIRED.every(key => typeof item[key] === 'string' && item[key].trim().length > 0)
    ).slice(0,40);
  } catch {
    return [];
  }
}
export function listSessions() { return [defaultSession,...readSessions()]; }
export function getActiveSession() {
  try {
    const id = localStorage.getItem(SELECTED_KEY) || 'delf';
    return listSessions().find(item => item.id === id) || defaultSession;
  } catch {
    return defaultSession;
  }
}
function notify() {
  window.dispatchEvent(new CustomEvent('cloud-session-change',{detail:{id:getActiveSession().id}}));
}
export function selectSession(id) {
  const selected = listSessions().find(item => item.id === id);
  if (!selected) throw new Error('Deze sessie is niet gevonden.');
  try { localStorage.setItem(SELECTED_KEY,selected.id); }
  catch { throw new Error('Je browser bewaart geen sessies. Controleer de opslaginstellingen.'); }
  notify();
  return selected;
}
export function storeSession(input,id=null) {
  const payload = {};
  for (const key of REQUIRED) {
    const value = String(input[key] || '').trim();
    if (!value) throw new Error('Vul alle tekstvelden in voordat je de sessie bewaart.');
    payload[key] = value;
  }
  if (payload.name.length > 80) throw new Error('De sessienaam is te lang.');
  const sessions = readSessions();
  if (sessions.length >= 40 && !sessions.some(item => item.id === id)) {
    throw new Error('Je hebt al 40 sessies. Exporteer oudere sessies voordat je verdergaat.');
  }
  const resolvedId = id && id !== 'delf'
    ? id
    : 'sessie-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
  const record = {id:resolvedId,...payload,builtIn:false};
  const index = sessions.findIndex(item => item.id === resolvedId);
  if (index >= 0) sessions[index] = record;
  else sessions.push(record);
  try {
    localStorage.setItem(STORAGE_KEY,JSON.stringify(sessions));
    localStorage.setItem(SELECTED_KEY,record.id);
  } catch { throw new Error('Opslaan lukt niet in deze browser. Exporteer de tekst om niets kwijt te raken.'); }
  notify();
  return record;
}
export function deleteSession(id) {
  if (id === 'delf') throw new Error('De standaard DELF-sessie kan niet worden verwijderd.');
  const list=readSessions();
  if (!list.some(item => item.id === id)) throw new Error('Deze sessie is niet gevonden.');
  try {
    localStorage.setItem(STORAGE_KEY,JSON.stringify(list.filter(item => item.id !== id)));
    localStorage.setItem(SELECTED_KEY,'delf');
  } catch { throw new Error('Verwijderen lukt niet in deze browser.'); }
  notify();
}
export function exportSessionData() {
  const current = getActiveSession();
  const {id,builtIn,...content}=current;
  return JSON.stringify({format:'eai-cloud-studio/v1',session:content},null,2);
}
export function importSessionData(raw) {
  let data;
  try { data=JSON.parse(raw); } catch { throw new Error('Dit bestand bevat geen geldige JSON.'); }
  if (!data || data.format !== 'eai-cloud-studio/v1' || !data.session) {
    throw new Error('Dit is geen exportbestand uit deze studio.');
  }
  return storeSession(data.session);
}
