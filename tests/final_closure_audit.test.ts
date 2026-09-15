import { describe, it, expect } from 'vitest';
import { matchesBranch } from '../src/lib/multiBranchService';
import { areBranchesMatching, getCanonicalBranchId } from '../src/lib/branchUtils';
import { RecipeController } from '../src/controllers/RecipeController';
import { calculateCFOAnalytics, CFOKPIs } from '../src/lib/cfoAnalytics';
import { calculateCEOAnalytics } from '../src/lib/ceoAnalytics';
import { calculateAIBusinessPlatformAnalytics } from '../src/lib/aiBusinessPlatformAnalytics';
import { getMogadishuDateString } from '../src/lib/dateUtils';
import { Order, Product, Ingredient, Expense, SalaryPayment, CustomerRefund } from '../src/types';

describe('FINAL CLOSURE AUDIT VERIFICATION SUITE', () => {
  describe('Issue 1: Branch Isolation & Identity Rules', () => {
    it('1. Main vs Main: identical names with different IDs MUST return false', () => {
      expect(matchesBranch('branch_001', 'Main', 'branch_002', 'Main')).toBe(false);
    });

    it('2. Main vs Main: identical names and matching IDs MUST return true', () => {
      expect(matchesBranch('branch_001', 'Main', 'branch_001', 'Main')).toBe(true);
    });

    it('3. Main vs Mogadishu Main: different IDs MUST return false', () => {
      expect(matchesBranch('branch_a', 'Main', 'branch_b', 'Mogadishu Main')).toBe(false);
    });

    it('4. Main vs Mogadishu Main Flagship: unmapped strings MUST return false', () => {
      expect(matchesBranch(null, 'Main', null, 'Mogadishu Main Flagship')).toBe(false);
    });

    it('5. Conflicting branchId + branchName: branchId is 100% authoritative', () => {
      // Entity says branch_001 with name "Downtown", target queries branch_002 with name "Downtown"
      expect(matchesBranch('branch_001', 'Downtown', 'branch_002', 'Downtown')).toBe(false);
    });

    it('6. Missing branchId fallback: only when entity ID is absent, branchName is checked', () => {
      expect(matchesBranch(null, 'Downtown Branch', 'branch_dt', 'Downtown Branch')).toBe(true);
      expect(matchesBranch('', 'Downtown Branch', null, 'Downtown Branch')).toBe(true);
    });

    it('7. Stale branchName: branchId matches even if branch name was updated', () => {
      expect(matchesBranch('branch_hq_01', 'Old HQ Name', 'branch_hq_01', 'New Flagship HQ')).toBe(true);
    });

    it('8. Normalized slug collision: distinct branch IDs cannot match by accidental collision', () => {
      expect(matchesBranch('branch_10', 'Branch 10', 'branch_1', 'Branch 1')).toBe(false);
      expect(matchesBranch('branch_a', 'Branch A', 'branch_b', 'Branch B')).toBe(false);
    });
  });

  describe('Issue 2: Inventory Conservation Law', () => {
    it('ensures branch inventory + unassigned inventory exactly equals enterprise inventory with zero synthetic averaging', () => {
      const enterpriseIngredients = [
        { id: 'ing_1', name: 'Flour', stock: 100, costPerUnit: 2, branchId: 'branch_a' },
        { id: 'ing_2', name: 'Sugar', stock: 50, costPerUnit: 3, branchId: 'branch_b' },
        { id: 'ing_3', name: 'Salt', stock: 20, costPerUnit: 1, branchId: 'branch_a' },
        { id: 'ing_4', name: 'Yeast', stock: 10, costPerUnit: 5 } // unassigned
      ];

      const branchAStock = enterpriseIngredients
        .filter(i => matchesBranch(i.branchId, null, 'branch_a', null))
        .reduce((sum, i) => sum + i.stock, 0);

      const branchBStock = enterpriseIngredients
        .filter(i => matchesBranch(i.branchId, null, 'branch_b', null))
        .reduce((sum, i) => sum + i.stock, 0);

      const unassignedStock = enterpriseIngredients
        .filter(i => !i.branchId || i.branchId === 'all')
        .reduce((sum, i) => sum + i.stock, 0);

      const enterpriseStock = enterpriseIngredients.reduce((sum, i) => sum + i.stock, 0);

      expect(branchAStock).toBe(120); // 100 Flour + 20 Salt
      expect(branchBStock).toBe(50);  // 50 Sugar
      expect(unassignedStock).toBe(10); // 10 Yeast
      expect(branchAStock + branchBStock + unassignedStock).toBe(enterpriseStock);
    });
  });

  describe('Issue 4: Recipe Net Profit vs Estimated Contribution Margin', () => {
    it('returns gross profit, 15% estimated overhead, and estimated contribution margin without misrepresenting as audited GAAP net profit', () => {
      const controller = new RecipeController({} as any);
      const items = [
        { ingredientId: 'ing_1', ingredientName: 'Beef', quantity: 0.5, unit: 'kg', unitCost: 10, totalCost: 5 },
        { ingredientId: 'ing_2', ingredientName: 'Bread', quantity: 1, unit: 'pc', unitCost: 1, totalCost: 1 }
      ];
      // Selling price $20, total cost $6, yield 1 portion
      const result = controller.calculateRecipeTotals(items as any, 20, 1);

      expect(result.totalCost).toBe(6.00);
      expect(result.costPerPortion).toBe(6.00);
      expect(result.foodCostPercentage).toBe(30.00);
      expect(result.grossProfit).toBe(14.00);
      expect(result.grossProfitMargin).toBe(70.00);
      expect(result.overheadRateEstimated).toBe(0.15);
      expect(result.estimatedOverhead).toBe(2.10); // 14.00 * 0.15
      expect(result.estimatedProfit).toBe(11.90);   // 14.00 - 2.10
      expect(result.estimatedContributionMargin).toBe(11.90);
      // Backwards compatible fields
      expect(result.netProfit).toBe(11.90);
      expect(result.estimatedNetProfit).toBe(11.90);
    });
  });

  describe('Issue 6: CFO Period Consistency & AOV Mathematical Integrity', () => {
    it('calculates averageOrderValue strictly using 30-day orders as denominator for 30-day monthly revenue', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();

      const orders: Order[] = [
        // 30-day order: $200
        { id: 'ord_1', totalAmount: 200, status: 'completed', createdAt: tenDaysAgo, items: [], branchId: 'all' } as any,
        // 30-day order: $100
        { id: 'ord_2', totalAmount: 100, status: 'completed', createdAt: tenDaysAgo, items: [], branchId: 'all' } as any,
        // Old order (40 days ago): $500
        { id: 'ord_3', totalAmount: 500, status: 'completed', createdAt: fortyDaysAgo, items: [], branchId: 'all' } as any,
        // Cancelled order in 30 days: $1000 (should not be in completed)
        { id: 'ord_4', totalAmount: 1000, status: 'cancelled', createdAt: tenDaysAgo, items: [], branchId: 'all' } as any
      ];

      const cfo = calculateCFOAnalytics({
        orders,
        products: [],
        ingredients: [],
        expenses: [],
        purchases: [],
        employees: [],
        salaries: [],
        suppliers: [],
        inventory_movements: [],
        refunds: [],
        bank_transactions: [],
        accounts: []
      });

      // 30-day monthly revenue: 200 + 100 = 300
      expect(cfo.kpis.monthlyRevenue).toBe(300);
      // All-time completed orders: 3
      expect(cfo.kpis.totalCompletedOrders).toBe(3);
      // 30-day completed orders: 2
      expect(cfo.kpis.monthlyCompletedOrdersCount).toBe(2);
      // AOV strictly for the 30-day period: 300 / 2 = 150 (NEVER 300 / 3 = 100)
      expect(cfo.kpis.averageOrderValue).toBe(150);
    });
  });

  describe('Issue 8 & 25: Africa/Mogadishu Timezone Boundary Consistency', () => {
    it('correctly maps UTC late evening orders to Mogadishu morning today date', () => {
      // Suppose Mogadishu is UTC+3.
      // UTC 2026-09-14T22:30:00Z is 2026-09-15T01:30:00+03:00 in Mogadishu.
      const timestamp = '2026-09-14T22:30:00.000Z';
      const mogDate = getMogadishuDateString(timestamp);
      expect(mogDate).toBe('2026-09-15');
    });

    it('consistently filters today orders across CEO and Business Platform analytics', () => {
      const todayStr = getMogadishuDateString();
      const mockOrderToday: Order = {
        id: 'ord_today',
        totalAmount: 120,
        status: 'completed',
        createdAt: new Date().toISOString(),
        items: [],
        branchId: 'all'
      } as any;

      const mockOrderYesterday: Order = {
        id: 'ord_yesterday',
        totalAmount: 80,
        status: 'completed',
        createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        items: [],
        branchId: 'all'
      } as any;

      const ceo = calculateCEOAnalytics({
        orders: [mockOrderToday, mockOrderYesterday],
        products: [],
        ingredients: [],
        expenses: [],
        purchases: [],
        employees: [],
        salaries: [],
        suppliers: []
      });

      expect(ceo.executiveBriefing.todayRevenue).toBe(120);

      const platform = calculateAIBusinessPlatformAnalytics({
        orders: [mockOrderToday, mockOrderYesterday],
        products: [],
        ingredients: [],
        expenses: [],
        purchases: [],
        employees: [],
        salaries: [],
        suppliers: []
      });

      expect(platform.todayRevenue).toBe(120);
    });
  });
});
