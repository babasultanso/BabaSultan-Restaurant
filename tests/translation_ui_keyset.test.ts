import {describe,it,expect} from "vitest"; import {translations} from "../src/i18n/translations";
describe("UI locale parity",()=>{it("has equal legacyUi keysets",()=>{const e=Object.keys(translations.en.legacyUi).sort(); expect(Object.keys(translations.ar.legacyUi).sort()).toEqual(e); expect(Object.keys(translations.so.legacyUi).sort()).toEqual(e);});});
