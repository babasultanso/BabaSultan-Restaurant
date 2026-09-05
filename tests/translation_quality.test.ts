import { describe, expect, it } from 'vitest';
import { translations } from '../src/i18n/translations';

function flatten(value: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      flatten(nested, prefix ? `${prefix}.${key}` : key, out);
    }
  } else if (value !== undefined && value !== null) {
    out[prefix] = String(value);
  }
  return out;
}

describe('Translation quality guards', () => {
  it('has no missing keys between English, Arabic and Somali', () => {
    const en = flatten(translations.en);
    const ar = flatten(translations.ar);
    const so = flatten(translations.so);
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(so).sort()).toEqual(Object.keys(en).sort());
  });

  it('does not silently leave obvious English values untranslated in Arabic/Somali', () => {
    const en = flatten(translations.en);
    const ar = flatten(translations.ar);
    const so = flatten(translations.so);
    const identical = (locale: Record<string, string>) => Object.keys(en)
      .filter((key) => locale[key] === en[key] && /[A-Za-z]/.test(en[key]))
      .map((key) => `${key}=${en[key]}`);

    expect(identical(ar)).toEqual([]);
    expect(identical(so)).toEqual([]);
  });
});
