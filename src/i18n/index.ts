/** Canonical i18n entry point for the entire application. */
export { translations, projectTranslations } from './translations';
export { inventoryDict } from './modules/inventory';
export type { InventoryLang } from './modules/inventory';
export { recipeDict } from './modules/recipe';
export type { RecipeLang } from './modules/recipe';
export { kdsDict } from './modules/kitchen';
export type { KitchenLang } from './modules/kitchen';

export { translateRawUi, RAW_UI_KEYS } from './rawUi';
