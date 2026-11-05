import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const root = readFileSync(new URL('../leif/index.html', import.meta.url), 'utf8');
const reader = readFileSync(new URL('../leif/verhaal/index.html', import.meta.url), 'utf8');
const encodedEdits = readFileSync(new URL('../leif/verhaal/tekstcorrecties.enc', import.meta.url), 'utf8').trim();
const decoder = value => Buffer.from(value.replace(/-/g,'+').replace(/_/g,'/'),'base64');
const utf8 = new TextEncoder();

function requireValue(regex, label) {
  const matched = reader.match(regex);
  assert.ok(matched, label+' ontbreekt');
  return decoder(matched[1]);
}

async function decryptEditData() {
  const salt = requireValue(/const KEI_WRAP_SALT='([^']+)'/, 'PBKDF2-salt');
  const blob = requireValue(/const KEI_WRAPPED_KEY='([^']+)'/, 'versleutelde verhaalcode');
  const sourceKey = await webcrypto.subtle.importKey('raw',utf8.encode('KEI'),'PBKDF2',false,['deriveKey']);
  const wrapKey = await webcrypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},sourceKey,{name:'AES-GCM',length:256},false,['decrypt']);
  const storyKey = await webcrypto.subtle.decrypt({name:'AES-GCM',iv:blob.subarray(0,12),additionalData:utf8.encode('LEIF-KEI-WRAP-V1')},wrapKey,blob.subarray(12));
  const edits = decoder(encodedEdits);
  const contentKey = await webcrypto.subtle.importKey('raw',storyKey,'AES-GCM',false,['decrypt']);
  const plain = await webcrypto.subtle.decrypt({name:'AES-GCM',iv:edits.subarray(0,12),additionalData:utf8.encode('LEIF-PERSONAL-EDIT-V1')},contentKey,edits.subarray(12));
  return JSON.parse(gunzipSync(Buffer.from(plain)).toString('utf8'));
}

test('LEIF-startscherm gebruikt de rustige leesvormgeving', () => {
  assert.match(root,/class="hero leif-landing"/);
  assert.match(root,/href="\/leif\/verhaal\/"/);
  assert.doesNotMatch(root,/<div class="ring"><\/div>/);
});

test('Deel 1 en 2 lezen doorlopend met scrollvoortgang', () => {
  assert.match(reader,/function showContinuous\(i,j\)/);
  assert.match(reader,/leif-book-section/);
  assert.match(reader,/readingScrollQueued/);
  assert.match(reader,/addParagraphs\(section,item.paragraphs\)/);
});

test('Spotify wordt niet automatisch geladen', () => {
  assert.match(reader,/insertSpotifyPlayer\(article\)/);
  assert.match(reader,/button.onclick=\(\)=>\{/);
  assert.match(reader,/open.spotify.com\/embed\/track\/0bqZiCxLGqeftnqRKlV1jn/);
  assert.match(reader,/frame-src https:\/\/open.spotify.com/);
  assert.doesNotMatch(reader,/<iframe/);
});

test('Alle correcties zijn versleuteld, compleet en te openen met KEI', async () => {
  const edits = await decryptEditData();
  assert.equal(edits.version,1);
  assert.equal(edits.metadata.length,3);
  assert.equal(edits.part2.length,7);
  assert.equal(edits.part2.flat().length,54);
  assert.ok(!edits.part2.flat().join('\n').includes('vertrouwenn'));
  assert.ok(!edits.part2.flat().join('\n').includes('gewend rake naan'));
});