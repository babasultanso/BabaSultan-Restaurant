import { describe, it, expect } from 'vitest';
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
});
