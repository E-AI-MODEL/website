import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const raw=await readFile('content/anatomie/sourceMap.js','utf8');
const {anatomySourceStatus, supportedGuideKeys}=await import('data:text/javascript;base64,'+Buffer.from(raw).toString('base64'));
const guide=await readFile('content/anatomie/guide.js','utf8');
const system=JSON.parse(await readFile('tools/anatomie/data/systems.json','utf8'));
const unique=new Set(Object.values(system).flat().map(x=>x.replace(/\.[lr]$/,'').trim().toLowerCase()));
const guideKeys=[...guide.matchAll(/^\s{2}['"]([^'"]+)['"]:\s*\{/gm)].map(m=>m[1]);
assert.equal(guideKeys.length,62);
assert.equal(new Set(guideKeys).size,guideKeys.length);
for(const key of supportedGuideKeys){
  assert(guideKeys.includes(key),'Bron staat bij niet-bestaand gidsartikel '+key);
  assert(unique.has(key),'Bron koppelt aan onbekende 3D-sleutel '+key);
  const s=anatomySourceStatus(key);
  assert(s.hasSpecific&&s.specific,'Geen vakbron voor '+key);
  const host=new URL(s.specific.url).hostname.toLowerCase();
  assert(['openstax.org','www.ncbi.nlm.nih.gov','www.elsevier.com'].includes(host),
    'Onbekende bronhouder '+key+' ('+host+')');
}
assert.equal(supportedGuideKeys.length,62,'Ieder specifiek gidsartikel heeft een bronverwijzing nodig');
const unsourced=guideKeys.filter(k=>!anatomySourceStatus(k).hasSpecific);
assert.deepEqual(unsourced,[],'Geen specifiek gidsartikel mag zonder passende vakbron staan');
for(const type of ['bot','spier','band','zintuig','slagader','lymfeklier']) {
  const info=anatomySourceStatus('naam niet specifiek onderbouwd',type);
  assert.equal(info.hasSpecific,false);
  assert(info.general?.url.startsWith('https://openstax.org/'));
}
const missing=anatomySourceStatus('????????');
assert.equal(missing.hasSpecific,false);
console.log('Gidsartikelen: '+guideKeys.length+', gekoppeld aan leerboekbron: '+supportedGuideKeys.length+', nog te controleren: '+unsourced.length);
