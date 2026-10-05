import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { getAdminDb, getFinancialSummaryData } from '../server/trustedFinancialBackend.js';

describe('ISSUE 009 — Historical Inventory Reporting (as-of date accuracy)', () => {
  const db = getAdminDb();
  const branchId = 'main_branch_01';

  beforeEach(async () => {
    await db.collection('branches').doc(branchId).set({ id: branchId, name: 'Main Flagship Branch' });
  });

  it('correctly reconstructs historical inventory as of Date X (100) instead of falling back to current stock (40)', async () => {
    const ts = Date.now();
    const ingId = `ing_hist_${ts}`;

    // Item was created on 2026-01-01 with initial stock 100
    // Current stock on document is 40 (because on 2026-03-05, 60 units were used/sold)
    await db.collection('ingredients').doc(ingId).set({
      id: ingId,
      name: 'Olive Oil Historical',
      branchId,
      stock: 40,
      currentStockUsageUnit: 40,
      costPerUnit: 10,
      costPerUsageUnit: 10,
      purchaseCost: 10,
      unit: 'L',
      usageUnit: 'L',
      createdAt: '2026-01-01T00:00:00.000Z'
    });

    // Movement after Date X (occurred on 2026-03-05): previousQuantity = 100, newQuantity = 40
    await db.collection('inventory_movements').doc(`mov_after_${ts}`).set({
      id: `mov_after_${ts}`,
      itemId: ingId,
      itemType: 'ingredient',
      type: 'out',
      quantity: 60,
      previousQuantity: 100,
      newQuantity: 40,
      unitCost: 10,
      branchId,
      createdAt: '2026-03-05T12:00:00.000Z',
      date: '2026-03-05'
    });

    // Query financial summary as of 2026-03-01 (Date X)
    const summary = await getFinancialSummaryData({
      userBranchId: branchId,
      dateTo: '2026-03-01',
      period: 'custom'
    });

    // As of 2026-03-01, stock was 100 at $10/L = $1,000 inventory valuation (not 40 * $10 = $400)
    // Summary inventory includes this ingredient valuation
    expect(summary.inventory).toBeGreaterThanOrEqual(1000);
  });
});
