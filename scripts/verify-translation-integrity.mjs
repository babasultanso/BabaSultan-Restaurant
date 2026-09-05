import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const raw = fs.readFileSync(path.join(root, 'src/i18n/rawUi.ts'), 'utf8');
const markerStart = raw.indexOf('const M:');
const markerEnd = raw.indexOf('};\nexport function translateRawUi');
if (markerStart < 0 || markerEnd < 0) throw new Error('rawUi catalog boundaries not found');
const body = raw.slice(markerStart, markerEnd);
const keyPattern = /^\s*(['"])((?:\\.|(?!\1).)*)\1\s*:\s*\{\s*en\s*:/gm;
const decode = (value) => value.replace(/\\(['"\\])/g, '$1');
const keys = [...body.matchAll(keyPattern)].map((m) => decode(m[2]));
const duplicates = [...new Set(keys.filter((key, i) => keys.indexOf(key) !== i))];
if (duplicates.length) {
  console.error('Duplicate rawUi keys:', duplicates);
  process.exit(1);
}
const suspicious = keys.filter((key) => key.includes('||') || key.includes('&&') || key.includes('=>') || key.startsWith('Number('));
if (suspicious.length) {
  console.error('Suspicious code-like rawUi keys:', suspicious);
  process.exit(1);
}
console.log(`translation integrity PASS: ${keys.length} unique rawUi keys`);
