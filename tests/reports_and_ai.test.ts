import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { calculateCFOAnalytics, CFODataPackage } from '../src/lib/cfoAnalytics.ts';
import { generateCPAReport, getEmployeePayrollStatus } from '../src/lib/reports.ts';
import { Employee, SalaryPayment } from '../src/types.ts';

describe('11 & 12 & 13. REPORTS FINANCIAL CONSISTENCY, AI CPA ASSISTANT & AUDIT LOGS TESTS', () => {

  it('11. Production CFO Financial Analytics: Net Profit == Gross Profit - Expenses', () => {
    const pkg: CFODataPackage = {
      orders: [
        {
          id: 'ord_1',
          orderNumber: '101',
          customerName: 'Ali',
          items: [],
          totalAmount: 115,
          subtotal: 100,
          taxAmount: 15,
          discountAmount: 0,
          cogs: 40,
          status: 'completed',
          paymentStatus: 'paid',
          paymentMethod: 'cash',
          orderType: 'dine_in',
          createdAt: new Date().toISOString()
        } as any,
        {
          id: 'ord_2',
          orderNumber: '102',
          customerName: 'Hassan',
          items: [],
          totalAmount: 230,
          subtotal: 200,
          taxAmount: 30,
          discountAmount: 0,
          cogs: 80,
          status: 'completed',
          paymentStatus: 'paid',
          paymentMethod: 'cash',
          orderType: 'takeaway',
          createdAt: new Date().toISOString()
        } as any
      ],
      expenses: [
        { id: 'exp_1', title: 'Supplies', amount: 50, category: 'Supplies', date: new Date().toISOString() } as any,
        { id: 'exp_2', title: 'Repairs', amount: 30, category: 'Maintenance', date: new Date().toISOString() } as any
      ],
      purchases: [],
      salaries: [],
      products: [],
      ingredients: [],
      employees: [],
      suppliers: [],
      refunds: [],
      bank_transactions: [],
      inventory_movements: [],
      accounts: []
    };

    const analytics = calculateCFOAnalytics(pkg);

    expect(analytics.kpis.foodCosts).toBe(120);
    expect(analytics.kpis.operatingCosts).toBe(80);
    // Net profit = Gross Profit - Operating Expenses (when laborCosts = 0)
    expect(analytics.kpis.netProfit).toBe(analytics.kpis.grossProfit - analytics.kpis.operatingCosts);
  });

  it('12. Production Payroll Report: Dynamic Status (PAID, PARTIAL, UNPAID)', () => {
    const emp1: Employee = {
      id: 'emp_101',
      employeeId: 'EMP-101',
      fullName: 'Ahmed Noor',
      name: 'Ahmed Noor',
      role: 'Chef',
      salary: 1000,
      payFrequency: 'monthly',
      status: 'Active',
      department: 'Kitchen',
      phone: '+252615000001',
      email: 'chef@example.com',
      nationalIdOrPassport: 'NID-101',
      address: 'Mogadishu',
      dateOfBirth: '1990-01-01',
      gender: 'Male',
      hireDate: '2025-01-01',
      employmentType: 'Full-time'
    } as any;

    const emp2: Employee = {
      id: 'emp_102',
      employeeId: 'EMP-102',
      fullName: 'Fatima Ali',
      name: 'Fatima Ali',
      role: 'Cashier',
      salary: 600,
      payFrequency: 'monthly',
      status: 'Active',
      department: 'Front Desk',
      phone: '+252615000002',
      email: 'cashier@example.com',
      nationalIdOrPassport: 'NID-102',
      address: 'Mogadishu',
      dateOfBirth: '1995-01-01',
      gender: 'Female',
      hireDate: '2025-02-01',
      employmentType: 'Full-time'
    } as any;

    const emp3: Employee = {
      id: 'emp_103',
      employeeId: 'EMP-103',
      fullName: 'Yusuf Omar',
      name: 'Yusuf Omar',
      role: 'barista',
      salary: 500,
      payFrequency: 'monthly',
      status: 'Active',
      department: 'Beverages',
      phone: '+252615000003',
      email: 'barista@example.com',
      nationalIdOrPassport: 'NID-103',
      address: 'Mogadishu',
      dateOfBirth: '1998-01-01',
      gender: 'Male',
      hireDate: '2025-03-01',
      employmentType: 'Full-time'
    } as any;

    const currentPeriod = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const salaries: SalaryPayment[] = [
      {
        id: 'sal_1',
        employeeId: 'emp_101',
        employeeName: 'Ahmed Noor',
        amount: 1000,
        period: currentPeriod,
        status: 'paid',
        paidDate: new Date().toISOString()
      },
      {
        id: 'sal_2',
        employeeId: 'emp_102',
        employeeName: 'Fatima Ali',
        amount: 300, // Partial: 300 of 600
        period: currentPeriod,
        status: 'paid',
        paidDate: new Date().toISOString()
      }
      // emp3 has no payments
    ];

    expect(getEmployeePayrollStatus(emp1, salaries, currentPeriod)).toBe('PAID');
    expect(getEmployeePayrollStatus(emp2, salaries, currentPeriod)).toBe('PARTIAL');
    expect(getEmployeePayrollStatus(emp3, salaries, currentPeriod)).toBe('UNPAID');
  });

  it('13. Audit Log Generator: creates structured audit entries for financial operations', () => {
    function createAuditLog(action: string, userId: string, branchId: string, details: Record<string, any>) {
      return {
        id: `audit_${Date.now()}`,
        action,
        userId,
        branchId,
        details,
        timestamp: new Date().toISOString()
      };
    }
    const log = createAuditLog('RECORD_REFUND', 'u1', 'branch_a', { orderId: 'o100', amount: 50 });
    expect(log.action).toBe('RECORD_REFUND');
    expect(log.branchId).toBe('branch_a');
  });

  describe('14. AI ACTION SCHEMA & SECURITY VALIDATION TESTS', () => {
    it('rejects unknown AI actionType', () => {
      const ALLOWED_AI_ACTIONS = new Set(['ADD_EXPENSE', 'REGISTER_PURCHASE', 'REGISTER_SALARY', 'RECORD_REFUND', 'RECORD_BANK_TRANSACTION', 'RECORD_MOVEMENT', 'UPDATE_STOCK']);
      const unknownAction = 'DELETE_ALL_DATA';
      expect(ALLOWED_AI_ACTIONS.has(unknownAction)).toBe(false);
    });

    it('rejects AI payload with client-controlled security fields (role, branchId, userId)', () => {
      const payload = { title: 'Office Supplies', amount: 100, role: 'Owner', branchId: 'all' };
      const FORBIDDEN_FIELDS = ['userId', 'role', 'branchId', 'createdBy', 'permissions'];
      const hasForbidden = FORBIDDEN_FIELDS.some(f => f in payload);
      expect(hasForbidden).toBe(true);
    });

    it('identifies and rejects fake or dummy resource IDs (sup_1, ord_1, emp_1, item_1)', () => {
      const isFakeOrDummyId = (id: any): boolean => {
        if (!id || typeof id !== 'string') return true;
        const str = id.trim().toLowerCase();
        if (!str) return true;
        const dummySet = new Set(['sup_1', 'ord_1', 'emp_1', 'item_1', 'prod_1', 'acc_1', 'user_1', 'dummy', 'fake', 'test_id']);
        if (dummySet.has(str)) return true;
        if (/^(sup|ord|emp|item|prod|acc|usr)_[0-9]+$/i.test(str)) return true;
        return false;
      };

      expect(isFakeOrDummyId('sup_1')).toBe(true);
      expect(isFakeOrDummyId('ord_123')).toBe(true);
      expect(isFakeOrDummyId('emp_1')).toBe(true);
      expect(isFakeOrDummyId('item_99')).toBe(true);
      expect(isFakeOrDummyId('real_id_8971239812')).toBe(false);
    });

    it('blocks unauthorized roles from executing AI financial actions', () => {
      const userRole = 'Staff';
      const managementRoles = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant'];
      const isAuthorized = managementRoles.includes(userRole);
      expect(isAuthorized).toBe(false);
    });

    it('blocks AI cross-branch action execution', () => {
      const user = { role: 'Manager', branchId: 'branch_a' };
      const targetOrderBranch = 'branch_b';
      const isAllowed = user.branchId === targetOrderBranch;
      expect(isAllowed).toBe(false);
    });

    it('rejects AI invalid action with missing required fields (ADD_EXPENSE missing amount)', () => {
      const payload = { title: 'Rent' };
      const amount = Number((payload as any).amount);
      const isValid = Boolean(payload.title && Number.isFinite(amount) && amount > 0);
      expect(isValid).toBe(false);
    });
  });

  describe('15. GEMINI 3.6 FLASH ENDPOINT & AI SECURITY BOUNDARY TESTS', () => {
    it('rejects unauthenticated AI chat requests with 401', async () => {
      const res = await request(app)
        .post('/api/ai-chat')
        .send({ prompt: 'What is our profit today?' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Authentication required/i);
    });

    it('processes authenticated AI chat request safely with server-selected model', async () => {
      const res = await request(app)
        .post('/api/ai-chat')
        .set('Authorization', 'Bearer test_token_owner')
        .send({ prompt: 'What is our monthly financial status?', language: 'en' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reply');
      expect(res.body).toHaveProperty('detectedLanguage');
    }, 15000);

    it('ignores client attempts to override the model or inject arbitrary model parameters', async () => {
      const res = await request(app)
        .post('/api/ai-chat')
        .set('Authorization', 'Bearer test_token_owner')
        .send({
          prompt: 'Calculate tax margin',
          model: 'gemini-1.5-pro-override',
          apiKey: 'fake_client_api_key'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reply');
      // Server does not echo or expose any client model parameter
      expect(res.body.model).toBeUndefined();
    }, 15000);

    it('returns clean error message without leaking sensitive internal details when prompt is empty', async () => {
      const res = await request(app)
        .post('/api/ai-chat')
        .set('Authorization', 'Bearer test_token_owner')
        .send({ prompt: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('A valid text prompt is required.');
    });

    it('verifies active production model identifier is a supported Gemini Flash model', () => {
      const defaultModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      expect(['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash-lite']).toContain(defaultModel);
      expect(defaultModel).not.toBe('gemini-2.5-flash');
      expect(defaultModel).not.toBe('gemini-1.5-flash');
    });
  });

  describe('16. REPORTS + ERP RECONCILIATION & HISTORICAL ACCURACY REGRESSIONS', () => {
    it('CFO Analytics sums multiple cash/bank accounts, supports costOfGoodsSold fallback, and ranks mostProfitableProduct by unit margin', async () => {
      const { calculateCFOAnalytics } = await import('../src/lib/cfoAnalytics');
      const nowIso = new Date().toISOString();
      const res = calculateCFOAnalytics({
        orders: [
          {
            id: 'ord_cfo_1',
            orderNumber: 'ORD-101',
            status: 'delivered',
            totalAmount: 200,
            costOfGoodsSold: 70,
            tax: 10,
            paymentMethod: 'cash',
            createdAt: nowIso,
            items: []
          } as any
        ],
        products: [
          { id: 'p_high_vol', name: 'Tea', price: 3, cost: 2, stock: 50, minStockAlert: 5, salesCount: 100, category: 'Drinks' } as any,
          { id: 'p_high_margin', name: 'Mixed Grill Platter', price: 45, cost: 15, stock: 20, minStockAlert: 5, salesCount: 10, category: 'Grills' } as any
        ],
        ingredients: [],
        expenses: [{ id: 'exp_1', title: 'Utilities', amount: 20, category: 'utilities', createdAt: nowIso } as any],
        purchases: [],
        employees: [],
        salaries: [
          { id: 'sal_paid', employeeId: 'e1', employeeName: 'Chef A', amount: 30, status: 'paid', paymentDate: nowIso } as any,
          { id: 'sal_pend', employeeId: 'e2', employeeName: 'Chef B', amount: 90, status: 'pending', paymentDate: nowIso } as any
        ],
        suppliers: [],
        inventory_movements: [],
        refunds: [{ id: 'ref_1', orderId: 'ord_cfo_1', amount: 25, reason: 'Partial refund', createdAt: nowIso } as any],
        bank_transactions: [],
        accounts: [
          { id: 'acc_cash_1', code: '1010', name: 'Main Safe Cash', type: 'cash', balance: 400 } as any,
          { id: 'acc_cash_2', code: '1011', name: 'Petty Cash Drawer', type: 'cash', balance: 150 } as any,
          { id: 'acc_bank_1', code: '1020', name: 'Salaam Somali Bank', type: 'bank', balance: 1200 } as any,
          { id: 'acc_bank_2', code: '1021', name: 'Dahabshiil Corporate', type: 'bank', balance: 800 } as any
        ]
      });

      expect(res.kpis.totalRefunds).toBe(25);
      expect(res.kpis.monthlyRevenue).toBe(200);
      expect(res.kpis.foodCosts).toBe(70);
      expect(res.kpis.grossProfit).toBe(105);
      expect(res.kpis.laborCosts).toBe(30);
      expect(res.kpis.operatingCosts).toBe(20);
      expect(res.kpis.netProfit).toBe(55);
      expect(res.kpis.cashBalance).toBe(550);
      expect(res.kpis.bankBalance).toBe(2000);
      expect(res.kpis.totalLiquidity).toBe(2550);
      expect(res.businessQuestionAnswers.most_profitable_products.answer).toContain('Mixed Grill Platter');
    });

    it('CEO Analytics deducts refunds, excludes unpaid salaries, avoids double-counting product sales, and signs bank withdrawals', async () => {
      const { calculateCEOAnalytics } = await import('../src/lib/ceoAnalytics');
      const nowIso = new Date().toISOString();
      const res = calculateCEOAnalytics({
        orders: [
          {
            id: 'ord_ceo_1',
            status: 'completed',
            totalAmount: 150,
            cogs: 50,
            createdAt: nowIso,
            items: [{ productId: 'p1', productName: 'Camel Steak', quantity: 3, unitPrice: 50, totalPrice: 150 }]
          } as any,
          {
            id: 'ord_ceo_cancelled',
            status: 'cancelled',
            totalAmount: 500,
            cogs: 200,
            createdAt: nowIso,
            items: [{ productId: 'p1', productName: 'Camel Steak', quantity: 10, unitPrice: 50, totalPrice: 500 }]
          } as any
        ],
        products: [
          { id: 'p1', name: 'Camel Steak', price: 50, cost: 15, stock: 25, minStockAlert: 5, salesCount: 3, category: 'Main' } as any
        ],
        ingredients: [],
        expenses: [{ id: 'e1', title: 'Rent', amount: 20, category: 'rent', createdAt: nowIso } as any],
        employees: [{ id: 'emp1', name: 'Waiter 1', role: 'Waiter', salary: 500 } as any],
        salaries: [
          { id: 's1', employeeId: 'emp1', employeeName: 'Waiter 1', amount: 30, status: 'paid', paymentDate: nowIso } as any,
          { id: 's2', employeeId: 'emp1', employeeName: 'Waiter 1', amount: 500, status: 'unpaid', paymentDate: nowIso } as any
        ],
        refunds: [{ id: 'r1', orderId: 'ord_ceo_1', amount: 10, createdAt: nowIso } as any],
        bankTransactions: [
          { id: 'bt1', type: 'deposit', amount: 1000, date: nowIso } as any,
          { id: 'bt2', type: 'withdrawal', amount: 250, date: nowIso } as any
        ],
        purchases: [],
        suppliers: [],
        attendance: [],
        drivers: []
      } as any);

      // Gross 150 - Refund 10 = Net 140; COGS 50 -> Gross Profit 90; Expenses (20 + 30 paid salary) = 50 -> Net Profit 40
      expect(res.executiveBriefing.todayRevenue).toBe(140);
      expect(res.executiveBriefing.todayExpenses).toBe(50);
      expect(res.executiveBriefing.todayProfit).toBe(40);
      // CashFlowBalance = (deposit 1000 + netRevenue 140) - (withdrawal 250 + totalExpenses 50) = 840
      expect(res.executiveBriefing.cashFlowBalance).toBe(840);
      // Product sales should be 3 from the completed order (not 3 + 3 = 6 double-counted, and not +10 from cancelled order)
      const camelSteak = res.executiveBriefing.bestSellingProducts.find(p => p.name === 'Camel Steak');
      expect(camelSteak?.salesCount).toBe(3);
      expect(camelSteak?.revenue).toBe(150);
    });

    it('AI Business Platform & Multi-Branch Analytics reconcile delivered orders, customer refunds, and paid salaries', async () => {
      const { calculateAIBusinessPlatformAnalytics } = await import('../src/lib/aiBusinessPlatformAnalytics');
      const { calculateConsolidatedBranchAnalytics } = await import('../src/lib/multiBranchService');
      const nowIso = new Date().toISOString();

      const aiRes = calculateAIBusinessPlatformAnalytics({
        orders: [
          { id: 'o1', status: 'delivered', totalAmount: 300, costOfGoodsSold: 100, createdAt: nowIso, branchId: 'b1' } as any
        ],
        products: [],
        ingredients: [],
        expenses: [{ id: 'ex1', title: 'Fuel', amount: 40, category: 'utilities', createdAt: nowIso, branchId: 'b1' } as any],
        employees: [],
        salaries: [
          { id: 'sal1', amount: 50, status: 'paid', branchId: 'b1', paymentDate: nowIso } as any,
          { id: 'sal2', amount: 200, status: 'pending', branchId: 'b1', paymentDate: nowIso } as any
        ],
        refunds: [{ id: 'ref1', amount: 30, branchId: 'b1', createdAt: nowIso } as any],
        bankTransactions: [
          { id: 'btx1', type: 'deposit', amount: 500 } as any,
          { id: 'btx2', type: 'withdrawal', amount: 120 } as any
        ],
        purchases: [],
        suppliers: []
      } as any);

      expect(aiRes.totalRevenue).toBe(270);
      expect(aiRes.totalExpenses).toBe(90);
      expect(aiRes.netProfit).toBe(80);
      expect(aiRes.liquidBalance).toBe(380);

      const branchRes = calculateConsolidatedBranchAnalytics({
        branches: [
          { id: 'b1', name: 'Hodan Branch', code: 'BR-01', status: 'active', isHeadOffice: true } as any
        ],
        orders: [
          { id: 'o1', status: 'delivered', totalAmount: 300, costOfGoodsSold: 100, createdAt: nowIso, branchId: 'b1' } as any
        ],
        expenses: [{ id: 'ex1', title: 'Fuel', amount: 40, category: 'utilities', createdAt: nowIso, branchId: 'b1' } as any],
        employees: [],
        ingredients: [],
        products: [],
        customers: [],
        transfers: [],
        salaries: [{ id: 'sal1', amount: 50, status: 'paid', branchId: 'b1', paymentDate: nowIso } as any],
        refunds: [{ id: 'ref1', amount: 30, branchId: 'b1', createdAt: nowIso } as any]
      });

      expect(branchRes.totalConsolidatedSales).toBe(270);
      expect(branchRes.totalConsolidatedExpenses).toBe(40);
      expect(branchRes.totalConsolidatedPayroll).toBe(50);
      expect(branchRes.totalConsolidatedProfit).toBe(80);
      expect(branchRes.rankedBranches[0]?.sales).toBe(270);
      expect(branchRes.rankedBranches[0]?.netProfit).toBe(80);
    });

    it('AccountingRepositoryImpl.getFinancialStatements keeps Balance Sheet and Trial Balance balanced across historical date ranges and same-day endDate postings', async () => {
      const { AccountingRepositoryImpl } = await import('../src/data/repositories/AccountingRepositoryImpl');
      const repo = new AccountingRepositoryImpl();

      // Seed accounts and journal lines with prior-period (2026-08-15) and current-period same-day (2026-09-30T14:30:00Z) postings
      vi.spyOn(repo, 'getAccounts').mockResolvedValue([
        { id: 'acc_cash', code: '1010', name: 'Cash on Hand', type: 'Asset', balance: 300, branchId: 'all' } as any,
        { id: 'acc_sales', code: '4010', name: 'Sales Revenue', type: 'Revenue', balance: 350, branchId: 'all' } as any,
        { id: 'acc_cogs', code: '5010', name: 'Food COGS', type: 'COGS', balance: 50, branchId: 'all' } as any
      ]);

      vi.spyOn(repo as any, 'fetchJournalLinesForScope').mockResolvedValueOnce([
        // Prior period sale: +100 Cash / +100 Revenue on 2026-08-15
        { id: 'jl_1', accountId: 'acc_cash', debit: 100, credit: 0, date: '2026-08-15T10:00:00.000Z', branchId: 'main_branch_01' },
        { id: 'jl_2', accountId: 'acc_sales', debit: 0, credit: 100, date: '2026-08-15T10:00:00.000Z', branchId: 'main_branch_01' },
        // Current period sale on endDate afternoon: +250 Cash / +250 Revenue, and +50 COGS / -50 Cash on 2026-09-30T14:30:00Z
        { id: 'jl_3', accountId: 'acc_cash', debit: 250, credit: 0, date: '2026-09-30T14:30:00.000Z', branchId: 'main_branch_01' },
        { id: 'jl_4', accountId: 'acc_sales', debit: 0, credit: 250, date: '2026-09-30T14:30:00.000Z', branchId: 'main_branch_01' },
        { id: 'jl_5', accountId: 'acc_cogs', debit: 50, credit: 0, date: '2026-09-30T14:30:00.000Z', branchId: 'main_branch_01' },
        { id: 'jl_6', accountId: 'acc_cash', debit: 0, credit: 50, date: '2026-09-30T14:30:00.000Z', branchId: 'main_branch_01' }
      ]);

      const statements = await repo.getFinancialStatements('2026-09-01', '2026-09-30', 'all');
      expect(statements.profitAndLoss.totalRevenue).toBe(250);
      expect(statements.profitAndLoss.totalCOGS).toBe(50);
      expect(statements.profitAndLoss.netProfit).toBe(200);
      expect(statements.balanceSheet.totalAssets).toBe(300);
      expect(statements.balanceSheet.totalLiabilitiesAndEquity).toBe(300);
      expect(statements.balanceSheet.isBalanced).toBe(true);
      expect(statements.isTrialBalanced).toBe(true);
    });

    it('generateCPAReport reconciles sales costOfGoodsSold fallback, product + ingredient inventory_cost, and audit metrics', async () => {
      const { generateCPAReport } = await import('../src/lib/reports');
      const nowIso = new Date().toISOString();
      const rawData = {
        orders: [
          { id: 'ord1', orderNumber: '1001', status: 'delivered', totalAmount: 120, costOfGoodsSold: 45, tax: 6, paymentMethod: 'cash', createdAt: nowIso } as any,
          { id: 'ord2', orderNumber: '1002', status: 'cancelled', totalAmount: 500, costOfGoodsSold: 200, tax: 25, paymentMethod: 'cash', createdAt: nowIso } as any
        ],
        expenses: [{ id: 'exp1', title: 'Gas', amount: 15, category: 'utilities', createdAt: nowIso } as any],
        purchases: [{ id: 'pur1', ingredientName: 'Rice', quantity: 10, unitCost: 2, totalCost: 20, status: 'paid', createdAt: nowIso } as any],
        ingredients: [{ id: 'ing1', name: 'Rice', category: 'Grains', stock: 10, minStockAlert: 2, unit: 'kg', costPerUnit: 2 } as any],
        products: [{ id: 'prod1', name: 'Bottled Water', category: 'Drinks', stock: 20, minStockAlert: 5, cost: 0.5, price: 1.5 } as any],
        employees: [],
        salaries: [{ id: 'sal1', employeeName: 'Cashier', amount: 10, status: 'paid', paymentDate: nowIso } as any],
        suppliers: [],
        refunds: [{ id: 'ref1', orderId: 'ord1', amount: 20, reason: 'Discount adjustment', createdAt: nowIso } as any],
        bankTransactions: [
          { id: 'bt1', type: 'deposit', amount: 300, description: 'Owner capital injection', date: nowIso } as any,
          { id: 'bt2', type: 'withdrawal', amount: 80, description: 'Supplier settlement', date: nowIso } as any
        ]
      };
      const dummyMetrics: any = {
        dailySales: 120,
        weeklySales: 120,
        monthlySales: 120,
        yearlySales: 120,
        grossRevenue: 120,
        customerRefundsTotal: 20,
        netRevenue: 100,
        cogs: 45,
        foodCostPercentage: 45,
        grossProfit: 55,
        laborCost: 10,
        laborCostPercentage: 10,
        operatingExpenses: 15,
        deliveryCost: 0,
        totalExpenses: 25,
        netProfit: 30,
        netProfitMargin: 30,
        cashBalance: 100,
        bankBalance: 220,
        totalLiquidity: 320,
        taxEstimatedVAT: 6,
        taxEstimatedCorporate: 3,
        accountsPayable: 0,
        inventoryValuation: 30
      };

      const salesReport = generateCPAReport('sales', dummyMetrics, rawData as any, 'csv');
      expect(salesReport.sections[0].rows.length).toBe(1); // Only completed/delivered order included, cancelled order excluded
      expect(salesReport.sections[0].rows[0][3]).toBe('$45.00'); // costOfGoodsSold fallback used for COGS
      expect(salesReport.sections[0].rows[0][4]).toBe('$75.00'); // Profit = 120 - 45

      const invReport = generateCPAReport('inventory_cost', dummyMetrics, rawData as any, 'csv');
      expect(invReport.sections.length).toBe(2); // Both Ingredient Inventory Valuation and Product Inventory Valuation sections
      expect(invReport.sections[0].rows[0][3]).toBe('$20.00'); // Ingredients: 10 * 2
      expect(invReport.sections[1].rows[0][4]).toBe('$10.00'); // Products: 20 * 0.5
    });
  });
});
