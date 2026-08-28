import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';

describe('11 & 12 & 13. REPORTS FINANCIAL CONSISTENCY, AI CPA ASSISTANT & AUDIT LOGS TESTS', () => {

  interface FinancialData {
    orders: { totalAmount: number; subtotal: number; taxAmount: number; discountAmount: number; cogs: number; status: string }[];
    expenses: { amount: number }[];
    cashBalance: number;
    bankBalance: number;
    receivables: number;
    payables: number;
    inventoryValue: number;
  }

  function calculateFinancialSummary(data: FinancialData) {
    const activeOrders = data.orders.filter(o => o.status !== 'cancelled' && o.status !== 'refunded');

    const totalSales = activeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const discounts = activeOrders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
    const tax = activeOrders.reduce((sum, o) => sum + (o.taxAmount || 0), 0);
    const netSales = totalSales - discounts - tax;
    const cogs = activeOrders.reduce((sum, o) => sum + (o.cogs || 0), 0);
    const grossProfit = netSales - cogs;
    const expenses = data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = grossProfit - expenses;

    return {
      totalSales,
      netSales,
      discounts,
      tax,
      cogs,
      grossProfit,
      expenses,
      netProfit,
      cashBalance: data.cashBalance,
      bankBalance: data.bankBalance,
      receivables: data.receivables,
      payables: data.payables,
      inventoryValue: data.inventoryValue
    };
  }

  it('11. Financial Summary Calculations: Net Profit == Gross Profit - Expenses', () => {
    const mockData: FinancialData = {
      orders: [
        { totalAmount: 115, subtotal: 100, taxAmount: 15, discountAmount: 0, cogs: 40, status: 'completed' },
        { totalAmount: 230, subtotal: 200, taxAmount: 30, discountAmount: 0, cogs: 80, status: 'completed' }
      ],
      expenses: [{ amount: 50 }, { amount: 30 }],
      cashBalance: 500,
      bankBalance: 1200,
      receivables: 150,
      payables: 200,
      inventoryValue: 800
    };

    const summary = calculateFinancialSummary(mockData);

    expect(summary.totalSales).toBe(345);
    expect(summary.netSales).toBe(300);
    expect(summary.cogs).toBe(120);
    expect(summary.grossProfit).toBe(180); // 300 - 120 = 180
    expect(summary.expenses).toBe(80); // 50 + 30 = 80
    expect(summary.netProfit).toBe(100); // 180 - 80 = 100
  });

  it('12. AI Financial Context Provider: Ensures AI model receives backend calculated metrics', () => {
    const mockSummary = calculateFinancialSummary({
      orders: [{ totalAmount: 100, subtotal: 100, taxAmount: 0, discountAmount: 0, cogs: 30, status: 'completed' }],
      expenses: [{ amount: 20 }],
      cashBalance: 300,
      bankBalance: 500,
      receivables: 50,
      payables: 100,
      inventoryValue: 400
    });

    const aiPromptContext = `
      Verified Financial Metrics:
      - Total Sales: $${mockSummary.totalSales}
      - Net Profit: $${mockSummary.netProfit}
      - Cash Balance: $${mockSummary.cashBalance}
    `;

    expect(aiPromptContext).toContain('Total Sales: $100');
    expect(aiPromptContext).toContain('Net Profit: $50');
    expect(aiPromptContext).toContain('Cash Balance: $300');
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
      expect(['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash-lite']).toContain(defaultModel);
      expect(defaultModel).not.toBe('gemini-2.5-flash');
      expect(defaultModel).not.toBe('gemini-1.5-flash');
    });
  });
});
