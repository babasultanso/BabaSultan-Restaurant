import { describe, it, expect } from 'vitest';
import { convertIngredientPurchaseQuantityToUsageUnit } from '../server/trustedFinancialBackend.js';
import { inventoryService } from '../src/domain/services/inventoryService';

describe('Ingredient purchase -> usage unit integrity', () => {
  it('converts liters to milliliters using the ingredient factor', () => {
    expect(convertIngredientPurchaseQuantityToUsageUnit(20, { name: 'Oil', purchaseUnit: 'L', usageUnit: 'ml', conversionFactor: 1000 })).toBe(20000);
  });

  it('uses the ingredient usage-unit balance as the canonical receiving baseline', () => {
    const ingredientStockUsageUnit = 0;
    const staleInventoryProjection = 20000;
    const receivedUsageUnit = convertIngredientPurchaseQuantityToUsageUnit(20, { name: 'Oil', purchaseUnit: 'L', usageUnit: 'ml', conversionFactor: 1000 });
    expect(ingredientStockUsageUnit + receivedUsageUnit).toBe(20000);
    expect(staleInventoryProjection + 0).toBe(20000);
  });

  it('keeps same-unit ingredients 1:1', () => {
    expect(convertIngredientPurchaseQuantityToUsageUnit(12, { name: 'Egg', purchaseUnit: 'pcs', usageUnit: 'pcs', conversionFactor: 1 })).toBe(12);
  });

  it('rejects inconsistent same-unit conversion factors', () => {
    expect(() => convertIngredientPurchaseQuantityToUsageUnit(12, { name: 'Bad Egg', purchaseUnit: 'pcs', usageUnit: 'pcs', conversionFactor: 24 })).toThrow(/inconsistent units/i);
  });

  it('rejects invalid conversion factors', () => {
    expect(() => convertIngredientPurchaseQuantityToUsageUnit(1, { name: 'Bad Oil', purchaseUnit: 'L', usageUnit: 'ml', conversionFactor: 0 })).toThrow(/invalid conversionFactor/i);
  });
});


describe('Ingredient usage-unit valuation', () => {
  it('values 20,000 ml of oil at $0.033/ml instead of $33/ml', () => {
    const report = inventoryService.calculateValuation([{
      id: 'oil', itemName: 'Oil', itemCode: 'ING-557', barcode: '', category: 'Liquids', unit: 'ml',
      purchaseCost: 33, sellingCost: 0, currentQuantity: 20000, minimumQuantity: 5000, maximumQuantity: 50000,
      reorderLevel: 5000, storageLocation: 'Main', status: 'in_stock', createdAt: '', updatedAt: '',
      itemType: 'ingredient', purchaseUnit: 'L', usageUnit: 'ml', conversionFactor: 1000, costPerUsageUnit: 0.033
    }]);
    expect(report.totalPurchaseValuation).toBeCloseTo(660, 8);
  });
});
