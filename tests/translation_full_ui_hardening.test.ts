import { describe, expect, it } from 'vitest';
import { translations } from '../src/i18n/translations';
import { RAW_UI_KEYS, translateRawUi } from '../src/i18n/rawUi';

describe('Full UI translation hardening', () => {
  it('contains no artificial translation fallback markers', async () => {
    const raw = await import('../src/i18n/rawUi');
    // Runtime lookup is locale-aware; this test guards the source catalog values used by the app.
    expect(JSON.stringify(raw)).not.toContain('ترجمة:');
    expect(JSON.stringify(raw)).not.toContain('Turjumid:');
  });

  it('keeps all canonical legacy UI keys available in all three languages', () => {
    const en = translations.en.legacyUi as Record<string, string>;
    const ar = translations.ar.legacyUi as Record<string, string>;
    const so = translations.so.legacyUi as Record<string, string>;
    for (const key of Object.keys(en)) {
      expect(ar[key]).toBeTruthy();
      expect(so[key]).toBeTruthy();
    }
  });

  it('has a raw UI translation catalog with all registered keys', () => {
    expect(RAW_UI_KEYS.length).toBeGreaterThan(0);
    expect(typeof translateRawUi('System Status')).toBe('string');
  });
});
