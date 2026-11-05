import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const root = readFileSync(new URL('../leif/index.html', import.meta.url), 'utf8');
const reader = readFileSync(new URL('../leif/verhaal/index.html', import.meta.url), 'utf8');
const utf8 = new TextEncoder();
const bytes = value => Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const capture = (pattern, label) => {
  const hit = reader.match(pattern);
  assert.ok(hit, label + ' missing');
  return bytes(hit[1]);
};

async function openWith(code) {
  const salt = capture(/const KEI_WRAP_SALT='([^']+)'/, 'key derivation salt');
  const payload = capture(/const KEI_WRAPPED_KEY='([^']+)'/, 'encrypted key');
  const secret = await webcrypto.subtle.importKey('raw', utf8.encode(code), 'PBKDF2', false, ['deriveKey']);
  const wrapping = await webcrypto.subtle.deriveKey(
    {name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},
    secret,{name:'AES-GCM',length:256},false,['decrypt']);
  const original = await webcrypto.subtle.decrypt(
    {name:'AES-GCM',iv:payload.subarray(0,12),additionalData:utf8.encode('LEIF-KEI-WRAP-V1')},
    wrapping,payload.subarray(12));
  const storyKey = await webcrypto.subtle.importKey('raw', original, 'AES-GCM', false, ['decrypt']);
  const encrypted = capture(/<script type="text\/plain" id="protected-text">([^<]+)<\/script>/, 'encrypted story');
  const decoded = await webcrypto.subtle.decrypt(
    {name:'AES-GCM',iv:encrypted.subarray(0,12),additionalData:utf8.encode('LEIF-PERSONAL-READ-V1')},
    storyKey,encrypted.subarray(12));
  return JSON.parse(new TextDecoder().decode(decoded));
}

test('KEI unlocks the complete encrypted three-part personal story', async () => {
  const story = await openWith('KEI');
  assert.equal(story.version, 1);
  assert.equal(story.parts.length,3);
  assert.deepEqual(story.parts.map(part => part.sections.length),[5,7,8]);
  assert.ok(story.parts[2].sections.some(section => section.fields?.length));
});

test('an incorrect code does not decrypt the personal story', async () => {
  await assert.rejects(openWith('FOUT'));
});

test('the original portal and the personal story share one tab session', () => {
  assert.match(root, /pw\.value\.trim\(\)\.toUpperCase\(\)==='KEI'/);
  assert.match(root, /sessionStorage\.setItem\('leif-kei-session-v1','1'\)/);
  assert.match(root, /href="\/leif\/verhaal\/"/);
  assert.match(reader, /sessionStorage\.getItem\('leif-kei-session-v1'\)==='1'/);
  assert.match(reader, /unlock\('KEI'\)/);
  assert.match(reader, /href="\/leif\/"/);
  assert.match(reader, /async function saveNotes/);
  assert.match(reader, /async function restoreNotes/);
});
