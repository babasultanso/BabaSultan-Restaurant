import { UnitConversion } from '../domain/entities/recipe';

// Base Unit Conversion Map (to base metric unit: g for mass, ml for volume, pcs for count)
const BASE_CONVERSIONS: Record<string, { baseUnit: string; factor: number }> = {
  // Mass -> base: g
  g: { baseUnit: 'g', factor: 1 },
  gram: { baseUnit: 'g', factor: 1 },
  grams: { baseUnit: 'g', factor: 1 },
  kg: { baseUnit: 'g', factor: 1000 },
  kilogram: { baseUnit: 'g', factor: 1000 },
  kilograms: { baseUnit: 'g', factor: 1000 },
  Ton: { baseUnit: 'g', factor: 1000000 },
  ton: { baseUnit: 'g', factor: 1000000 },

  // Volume -> base: ml
  ml: { baseUnit: 'ml', factor: 1 },
  milliliter: { baseUnit: 'ml', factor: 1 },
  milliliters: { baseUnit: 'ml', factor: 1 },
  L: { baseUnit: 'ml', factor: 1000 },
  l: { baseUnit: 'ml', factor: 1000 },
  liter: { baseUnit: 'ml', factor: 1000 },
  liters: { baseUnit: 'ml', factor: 1000 },

  // Count & Packaging -> base: pcs
  pcs: { baseUnit: 'pcs', factor: 1 },
  piece: { baseUnit: 'pcs', factor: 1 },
  pieces: { baseUnit: 'pcs', factor: 1 },
  box: { baseUnit: 'pcs', factor: 24 },
  carton: { baseUnit: 'pcs', factor: 12 },
  bag: { baseUnit: 'pcs', factor: 50 },
  bottle: { baseUnit: 'pcs', factor: 1 },
  can: { baseUnit: 'pcs', factor: 1 },
  tray: { baseUnit: 'pcs', factor: 30 },
  pack: { baseUnit: 'pcs', factor: 10 }
};

export class UnitConversionEngine {
  /**
   * Convert quantity from one unit to another
   */
  static convert(
    value: number,
    fromUnit: string,
    toUnit: string,
    customConversions: UnitConversion[] = [],
    ingredientId?: string
  ): number {
    if (value === 0) return 0;
    const cleanFrom = (fromUnit || '').trim().toLowerCase();
    const cleanTo = (toUnit || '').trim().toLowerCase();

    if (cleanFrom === cleanTo) return value;

    // Check custom conversions first
    const customMatch = customConversions.find(
      (c) =>
        (c.ingredientId === ingredientId || !c.ingredientId) &&
        (c.fromUnit || '').trim().toLowerCase() === cleanFrom &&
        (c.toUnit || '').trim().toLowerCase() === cleanTo
    );
    if (customMatch) {
      return value * customMatch.factor;
    }

    const reverseMatch = customConversions.find(
      (c) =>
        (c.ingredientId === ingredientId || !c.ingredientId) &&
        (c.fromUnit || '').trim().toLowerCase() === cleanTo &&
        (c.toUnit || '').trim().toLowerCase() === cleanFrom
    );
    if (reverseMatch && reverseMatch.factor !== 0) {
      return value / reverseMatch.factor;
    }

    // Standard conversion lookup
    const fromInfo = BASE_CONVERSIONS[cleanFrom] || BASE_CONVERSIONS[fromUnit] || { baseUnit: cleanFrom, factor: 1 };
    const toInfo = BASE_CONVERSIONS[cleanTo] || BASE_CONVERSIONS[toUnit] || { baseUnit: cleanTo, factor: 1 };

    // Same category (e.g. g <-> kg, ml <-> L, pcs <-> box)
    if (fromInfo.baseUnit === toInfo.baseUnit) {
      const baseValue = value * fromInfo.factor;
      return baseValue / toInfo.factor;
    }

    // If units differ in category, fallback to 1:1 if unknown
    return value;
  }

  /**
   * Calculate meals remaining given available stock, recipe usage per meal, and conversion rules
   */
  static getMealsRemaining(
    currentStock: number,
    stockUnit: string,
    recipeQuantityPerMeal: number,
    recipeUnit: string,
    customConversions: UnitConversion[] = [],
    ingredientId?: string
  ): number {
    if (recipeQuantityPerMeal <= 0) return 0;
    const convertedStock = this.convert(currentStock, stockUnit, recipeUnit, customConversions, ingredientId);
    return Math.floor(convertedStock / recipeQuantityPerMeal);
  }

  /**
   * Calculate food cost percentage
   */
  static calculateFoodCostPercent(cost: number, sellingPrice: number): number {
    if (sellingPrice <= 0) return 0;
    return Number(((cost / sellingPrice) * 100).toFixed(2));
  }

  /**
   * Calculate gross profit & margins
   */
  static calculateProfitMetrics(cost: number, sellingPrice: number) {
    const grossProfit = Number((sellingPrice - cost).toFixed(2));
    const grossMargin = sellingPrice > 0 ? Number(((grossProfit / sellingPrice) * 100).toFixed(2)) : 0;
    const foodCostPercent = sellingPrice > 0 ? Number(((cost / sellingPrice) * 100).toFixed(2)) : 0;
    return {
      grossProfit,
      grossMargin,
      foodCostPercent
    };
  }
}
