import { describe, it, expect } from 'vitest';
import { matchesBranch, calculateConsolidatedBranchAnalytics } from '../src/lib/multiBranchService';
import { calculateCFOAnalytics, CFODataPackage } from '../src/lib/cfoAnalytics';
import { calculateCEOAnalytics, CEODataPackage } from '../src/lib/ceoAnalytics';
import { RecipeController } from '../src/controllers/RecipeController';
import { translations } from '../src/i18n/translations';

describe('PHASE 2 REMEDIATION REGRESSION TESTS', () => {

  describe('1. Branch Matching & Isolation (matchesBranch & areBranchesMatching)', () => {
    it('accurately matches branches by identical ID or slug', () => {
      expect(matchesBranch('main-branch', 'Main Branch', 'main-branch', 'Main Branch')).toBe(true);
      expect(matchesBranch('main_branch', 'Main Branch', 'main-branch', 'Main Branch')).toBe(true);
      expect(matchesBranch('branch_1', 'Branch 1', 'branch-1', 'Branch 1')).toBe(true);
      expect(matchesBranch('branch_a', 'Branch A', 'branch_a', 'Branch A')).toBe(true);
      expect(matchesBranch('mogadishu-central', 'Mogadishu Central', 'mogadishu_central', 'Mogadishu Central')).toBe(true);
    });

    it('rejects cross-branch false positives and substring collision', () => {
      // Prevents "branch_1" from matching "branch_10" or "branch_11"
      expect(matchesBranch('branch_10', 'Branch 10', 'branch_1', 'Branch 1')).toBe(false);
      expect(matchesBranch('branch_1', 'Branch 1', 'branch_10', 'Branch 10')).toBe(false);

      // Prevents "Central" from accidentally matching "Central Annex"
      expect(matchesBranch('central', 'Central', 'central_annex', 'Central Annex')).toBe(false);
      expect(matchesBranch('branch_a', 'Branch A', 'branch_b', 'Branch B')).toBe(false);
    });

    it('handles null, undefined, or empty branch targets safely without throwing', () => {
      expect(matchesBranch(null, null, 'branch_1', 'Branch 1')).toBe(false);
      expect(matchesBranch('branch_1', 'Branch 1', null, null)).toBe(false);
      expect(matchesBranch('', '', '', '')).toBe(false);
    });

    it('consolidates analytics strictly per branch without leaking data across branches', () => {
      const mockBranches: any[] = [
        { id: 'b1', name: 'Branch 1', branchCode: 'B1', status: 'active' },
        { id: 'b2', name: 'Branch 2', branchCode: 'B2', status: 'active' }
      ];

      const mockOrders: any[] = [
        { id: 'o1', branchId: 'b1', totalAmount: 100, status: 'completed', cogs: 30 },
        { id: 'o2', branchId: 'b1', totalAmount: 150, status: 'completed', cogs: 40 },
        { id: 'o3', branchId: 'b2', totalAmount: 200, status: 'completed', cogs: 50 },
        { id: 'o4', branchId: 'b2', totalAmount: 50, status: 'cancelled', cogs: 10 } // cancelled
      ];

      const mockExpenses: any[] = [
        { id: 'e1', branchId: 'b1', amount: 30 },
        { id: 'e2', branchId: 'b2', amount: 75 }
      ];

      const mockInventory: any[] = [
        { id: 'i1', branchId: 'b1', stock: 10, costPerUnit: 2 },
        { id: 'i2', branchId: 'b2', stock: 5, costPerUnit: 10 }
      ];

      const mockStaff: any[] = [
        { id: 's1', branchId: 'b1', role: 'Chef' },
        { id: 's2', branchId: 'b2', role: 'Waiter' }
      ];

      const mockTransfers: any[] = [
        { id: 't1', sourceBranchId: 'b1', destinationBranchId: 'b2', status: 'pending' }
      ];

      const analytics = calculateConsolidatedBranchAnalytics({
        branches: mockBranches,
        orders: mockOrders,
        expenses: mockExpenses,
        ingredients: mockInventory,
        products: [],
        employees: mockStaff,
        customers: [],
        transfers: mockTransfers
      });

      expect(analytics.rankedBranches.length).toBe(2);

      const b1Analytics = analytics.rankedBranches.find(a => a.branchId === 'b1');
      const b2Analytics = analytics.rankedBranches.find(a => a.branchId === 'b2');

      expect(b1Analytics).toBeDefined();
      expect(b2Analytics).toBeDefined();

      // Branch 1: 100 + 150 = 250 sales, 2 completed orders, 30 expenses, cogs=70, net profit = 250 - 70 - 30 = 150
      expect(b1Analytics?.sales).toBe(250);
      expect(b1Analytics?.ordersCount).toBe(2);
      expect(b1Analytics?.expenses).toBe(30);
      expect(b1Analytics?.netProfit).toBe(150);

      // Branch 2: 200 sales (cancelled order excluded), 1 completed order, 75 expenses, cogs=50, net profit = 200 - 50 - 75 = 75
      expect(b2Analytics?.sales).toBe(200);
      expect(b2Analytics?.ordersCount).toBe(1);
      expect(b2Analytics?.expenses).toBe(75);
      expect(b2Analytics?.netProfit).toBe(75);

      // Overall totals
      expect(analytics.totalConsolidatedSales).toBe(450);
      expect(analytics.totalConsolidatedOrders).toBe(3);
      expect(analytics.pendingTransfers.length).toBe(1);
    });
  });

  describe('2. CFO Financial Analytics Period Alignment', () => {
    it('scopes refunds, expenses, labor costs, and VAT strictly to the last 30 days', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();

      const orders: any[] = [
        {
          id: 'ord_recent',
          totalAmount: 1000,
          subtotal: 900,
          taxAmount: 100,
          cogsTotal: 300,
          paymentStatus: 'completed',
          status: 'completed',
          createdAt: tenDaysAgo
        },
        {
          id: 'ord_old',
          totalAmount: 500,
          subtotal: 450,
          taxAmount: 50,
          cogsTotal: 150,
          paymentStatus: 'completed',
          status: 'completed',
          createdAt: fortyDaysAgo // older than 30 days
        }
      ];

      const expenses: any[] = [
        { id: 'exp_recent', amount: 150, category: 'Utilities', createdAt: tenDaysAgo },
        { id: 'exp_old', amount: 500, category: 'Equipment', createdAt: fortyDaysAgo } // older than 30 days
      ];

      const refunds: any[] = [
        { id: 'ref_recent', amount: 50, createdAt: tenDaysAgo },
        { id: 'ref_old', amount: 200, createdAt: fortyDaysAgo } // older than 30 days
      ];

      const employees: any[] = [
        { id: 'emp_1', salaryAmount: 3000, payFrequency: 'Monthly', status: 'Active' }
      ];

      const salaries: any[] = [
        { id: 'sal_1', employeeId: 'emp_1', employeeName: 'Staff', period: 'August 2026', amount: 3000, status: 'paid', paidDate: tenDaysAgo }
      ];

      const cfo = calculateCFOAnalytics({
        orders,
        expenses,
        refunds,
        employees,
        products: [],
        ingredients: [],
        purchases: [],
        salaries,
        suppliers: [],
        inventory_movements: [],
        bank_transactions: [],
        accounts: []
      });

      // Monthly revenue is strictly scoped to the last 30 days (1000, excluding 500 from 40 days ago)
      expect(cfo.kpis.monthlyRevenue).toBe(1000);

      // Total completed orders in all-time history
      expect(cfo.kpis.totalCompletedOrders).toBe(2);

      // Refunds: 30 days = 50 (excluding 200 from 40 days ago)
      expect(cfo.kpis.totalRefunds).toBe(50);

      // Raw expenses: 30 days = 150 (excluding 500 from 40 days ago)
      // Total expenses includes operating costs + labor (3000)
      expect(cfo.kpis.laborCosts).toBe(3000);
      expect(cfo.kpis.utilityCosts).toBe(150);

      // VAT: 30 days = 100 (excluding 50 from 40 days ago)
      expect(cfo.kpis.estimatedVAT).toBe(100);
    });
  });

  describe('3. CEO Executive Analytics Order Status Integrity', () => {
    it('only counts completed or delivered orders toward todayRevenue and todayCOGS', () => {
      const todayIso = new Date().toISOString();

      const orders: any[] = [
        {
          id: 'ord_delivered',
          totalAmount: 200,
          cogs: 60,
          status: 'delivered',
          createdAt: todayIso
        },
        {
          id: 'ord_completed',
          totalAmount: 150,
          cogs: 45,
          status: 'completed',
          createdAt: todayIso
        },
        {
          id: 'ord_pending',
          totalAmount: 300,
          cogs: 90,
          status: 'pending', // Pending order should not count as realized today revenue
          createdAt: todayIso
        },
        {
          id: 'ord_cancelled',
          totalAmount: 500,
          cogs: 150,
          status: 'cancelled', // Cancelled order must be excluded
          createdAt: todayIso
        }
      ];

      const ceo = calculateCEOAnalytics({
        orders,
        products: [],
        ingredients: [],
        expenses: [],
        purchases: [],
        employees: [],
        salaries: [],
        suppliers: [],
        branches: []
      });

      // Realized today revenue: 200 + 150 = 350
      expect(ceo.executiveBriefing.todayRevenue).toBe(350);

      // Realized today expenses: 0 (no expenses today in mock)
      expect(ceo.executiveBriefing.todayExpenses).toBe(0);
    });
  });

  describe('4. Recipe Controller Heuristic Transparency', () => {
    it('calculates cost, margin, and estimatedNetProfit with documented 15% overhead estimate', () => {
      const controller = new RecipeController({} as any);

      const recipeItems = [
        { id: 'ri1', ingredientId: 'i1', ingredientName: 'Flour', quantity: 2, unit: 'kg', costPerUnit: 2.0, totalCost: 4.0 },
        { id: 'ri2', ingredientId: 'i2', ingredientName: 'Sugar', quantity: 0.5, unit: 'kg', costPerUnit: 4.0, totalCost: 2.0 }
      ];

      const sellingPrice = 20.0;
      const calc = controller.calculateRecipeTotals(recipeItems, sellingPrice, 1);

      // Total ingredient cost: 4 + 2 = $6.00
      expect(calc.totalCost).toBe(6.0);

      // Gross profit: 20.0 - 6.0 = $14.00
      expect(calc.grossProfit).toBe(14.0);

      // Food cost %: (6 / 20) * 100 = 30%
      expect(calc.foodCostPercentage).toBe(30.0);

      // Gross Profit Margin %: (14 / 20) * 100 = 70%
      expect(calc.grossProfitMargin).toBe(70.0);

      // Estimated Net Profit after 15% estimated overhead: 14.0 * 0.85 = 11.90
      expect(calc.estimatedNetProfit).toBe(11.9);
      expect(calc.netProfit).toBe(11.9);
      expect(calc.overheadRateEstimated).toBe(0.15);
    });
  });

  describe('5. Localization Integrity Guards', () => {
    it('ensures Somali legacyUi entries have zero Arabic characters (excluding sarRiyal)', () => {
      const so = translations.so.legacyUi;
      const corrupted: string[] = [];

      for (const [key, value] of Object.entries(so)) {
        if (key === 'sarRiyal') continue;
        if (/[\u0600-\u06FF]/.test(value)) {
          corrupted.push(`${key}=${value}`);
        }
      }

      expect(corrupted).toEqual([]);
    });

    it('ensures English legacyUi entries do not have unspaced multi-word camelCase strings', () => {
      const en = translations.en.legacyUi;
      const unspaced: string[] = [];

      for (const [key, value] of Object.entries(en)) {
        // Multi-word camelCase keys like "branchNetProfit", "totalAmount", etc.
        if (/[a-z][A-Z]/.test(key) && key.length > 6) {
          if (value.toLowerCase() === key.toLowerCase() && !value.includes(' ') && !value.includes('/') && !value.includes('-')) {
            unspaced.push(`${key}=${value}`);
          }
        }
      }

      expect(unspaced).toEqual([]);
    });
  });

});
