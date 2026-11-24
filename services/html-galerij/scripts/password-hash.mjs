// One-time local setup utility. The password is not echoed or saved.
import { pbkdf2Sync, randomBytes } from 'node:crypto';

function secret(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run dit script in een interactieve terminal. Gebruik geen commandoregelargument voor het wachtwoord.');
  }
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdout.write(prompt);
    function finish(err) {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (err) reject(err); else resolve(input);
    }
    function onData(buffer) {
      const sequence = buffer.toString('utf8');
      for (const ch of sequence) {
        if (ch === '\r' || ch === '\n') return finish();
        if (ch === '\u0003') return finish(new Error('Afgebroken'));
        if (ch === '\u007f' || ch === '\b') { input = input.slice(0, -1); continue; }
        if (ch.charCodeAt(0) < 32) continue;
        input += ch;
      }
    }
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}
const pass = await secret('Kies een wachtwoord (minimaal 16 tekens): ');
if (pass.length < 16 || pass.length > 1024) throw new Error('Gebruik een wachtwoord van 16 tot 1024 tekens.');
const again = await secret('Herhaal het wachtwoord: ');
if (again !== pass) throw new Error('De wachtwoorden komen niet overeen.');
const salt = randomBytes(24);
const hash = pbkdf2Sync(pass, salt, 310000, 32, 'sha256');
console.log('\nPlaats deze volledige regel als Cloudflare Worker secret GALLERY_PASSWORD_HASH:');
console.log('pbkdf2_sha256$310000$' + salt.toString('base64') + '$' + hash.toString('base64'));
console.log('\nBewaar het gekozen wachtwoord in een wachtwoordmanager en niet in GitHub.');
