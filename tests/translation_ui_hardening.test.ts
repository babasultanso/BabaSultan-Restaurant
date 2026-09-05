import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';

const SRC_ROOT = resolve(process.cwd(), 'src');

function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = resolve(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (full.endsWith('.tsx')) files.push(full);
    }
  };
  walk(SRC_ROOT);
  return files;
}

describe('UI translation hardening', () => {
  it('routes simple JSX text literals through the translation layer', () => {
    const direct: string[] = [];
    const pattern = />\s*([A-Za-z][^<{]*?)\s*<\/[A-Za-z][^>]*>/gs;
    for (const file of sourceFiles()) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(pattern)) {
        const value = match[1].replace(/\s+/g, ' ').trim();
        if (!value || value.startsWith('translateRawUi(')) continue;
        if (/[{}=]|=>|\|\||&&/.test(value)) continue;
        if (/[A-Za-z]{2,}/.test(value)) direct.push(`${file}: ${value}`);
      }
    }
    expect(direct).toEqual([]);
  });

  it('does not leave literal user-facing placeholder/title/aria-label/alt attributes', () => {
    const direct: string[] = [];
    const pattern = /\b(placeholder|title|aria-label|alt)=("|')([\s\S]*?)\2/g;
    for (const file of sourceFiles()) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(pattern)) {
        const value = match[3].replace(/\s+/g, ' ').trim();
        if (/[A-Za-z]{2,}/.test(value)) direct.push(`${file}: ${match[1]}=${value}`);
      }
    }
    expect(direct).toEqual([]);
  });

  it('has a catalog entry for every translateRawUi literal call', () => {
    const rawUi = readFileSync(resolve(SRC_ROOT, 'i18n/rawUi.ts'), 'utf8');
    const keyPattern = /^\s*(['"])((?:\\.|(?!\1).)*)\1\s*:/gm;
    const keys = new Set(Array.from(rawUi.matchAll(keyPattern), m => m[2].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\')));
    const missing: string[] = [];
    const pattern = /translateRawUi\((['"])((?:\\.|(?!\1).)*)\1\)/g;
    for (const file of sourceFiles()) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(pattern)) {
        const value = match[2].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        if (!keys.has(value)) missing.push(`${file}: ${value}`);
      }
    }
    expect(missing).toEqual([]);
  });
});


it('does not contain duplicate raw UI catalog keys', () => {
  const source = readFileSync(new URL('../src/i18n/rawUi.ts', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('const M:'), source.indexOf('};\nexport function translateRawUi'));
  const keyPattern = /^\s*(['\"])((?:\\.|(?!\1).)*)\1\s*:\s*\{\s*en\s*:/gm;
  const decode = (value: string) => value.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const keys = [...body.matchAll(keyPattern)].map((m) => decode(m[2]));
  const duplicates = [...new Set(keys.filter((key, i) => keys.indexOf(key) !== i))];
  expect(duplicates).toEqual([]);
});
