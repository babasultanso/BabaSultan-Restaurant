import { describe, expect, it } from 'vitest';
import { translations, projectTranslations } from '../src/i18n/translations';

const supported = ['en', 'ar', 'so'] as const;

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj).sort().reduce<Record<string, unknown>>((out, key) => { out[key] = shape(obj[key]); return out; }, {});
  }
  return typeof value;
}

describe('Project translation registry', () => {
  it('contains every supported locale at the canonical root', () => {
    expect(Object.keys(projectTranslations).sort()).toEqual([...supported].sort());
  });

  it('keeps the core dictionary schema aligned across languages', () => {
    const base = shape(translations.en);
    expect(shape(translations.ar)).toEqual(base);
    expect(shape(translations.so)).toEqual(base);
  });

  it('exposes all domain dictionaries through the same locale namespace', () => {
    for (const lang of supported) {
      expect(projectTranslations[lang]).toHaveProperty('core');
      expect(projectTranslations[lang]).toHaveProperty('inventory');
      expect(projectTranslations[lang]).toHaveProperty('recipe');
      expect(projectTranslations[lang]).toHaveProperty('kitchen');
    }
  });

  it('keeps each domain dictionary schema aligned across all locales', () => {
    for (const domain of ['inventory', 'recipe', 'kitchen'] as const) {
      const base = shape(projectTranslations.en[domain]);
      expect(shape(projectTranslations.ar[domain])).toEqual(base);
      expect(shape(projectTranslations.so[domain])).toEqual(base);
    }
  });
});
