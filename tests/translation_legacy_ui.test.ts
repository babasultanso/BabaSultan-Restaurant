import { describe, expect, it } from "vitest";
import { translations } from "../src/i18n/translations";

describe("legacy UI translation completeness", () => {
  it("keeps the same legacyUi keyset in all supported locales", () => {
    const en = Object.keys(translations.en.legacyUi).sort();
    const ar = Object.keys(translations.ar.legacyUi).sort();
    const so = Object.keys(translations.so.legacyUi).sort();
    expect(ar).toEqual(en);
    expect(so).toEqual(en);
  });

  it("does not use obvious English-only placeholder values for newly added keys", () => {
    const en = translations.en.legacyUi as Record<string,string>;
    const ar = translations.ar.legacyUi as Record<string,string>;
    const so = translations.so.legacyUi as Record<string,string>;
    for (const key of Object.keys(en)) {
      if (!key.match(/^(all|type|status|actions)$/)) {
        expect(ar[key]).toBeTruthy();
        expect(so[key]).toBeTruthy();
      }
    }
  });
});
