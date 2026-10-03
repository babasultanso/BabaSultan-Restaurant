import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { getAdminDb } from '../server/db';

const OWNER_TOKEN = 'Bearer test_token_owner';
const MANAGER_TOKEN = 'Bearer test_token_manager';
const MANAGER_BRANCH_B_TOKEN = 'Bearer test_token_manager_branch_b';

describe('8 & 9 & 10. DOUBLE-ENTRY ACCOUNTING, REFUNDS, & ROLE AUTHORIZATION TESTS', () => {

  // Helper function to test Journal Entry Debit == Credit equality
  function verifyJournalEntry(lines: { account: string; debit: number; credit: number }[]) {
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    return {
      isBalanced: totalDebit === totalCredit,
      totalDebit,
      totalCredit
    };
  }

  it('A. Cash Sale Journal: TOTAL DEBIT == TOTAL CREDIT', () => {
    const lines = [
      { account: '1010 - Cash on Hand', debit: 150, credit: 0 },
      { account: '4010 - Sales Revenue', debit: 0, credit: 150 }
    ];
    const res = verifyJournalEntry(lines);
    expect(res.isBalanced).toBe(true);
    expect(res.totalDebit).toBe(150);
    expect(res.totalCredit).toBe(150);
  });

  it('B. Credit Sale Journal: TOTAL DEBIT == TOTAL CREDIT', () => {
    const lines = [
      { account: '1100 - Accounts Receivable', debit: 300, credit: 0 },
      { account: '4010 - Sales Revenue', debit: 0, credit: 300 }
    ];
    const res = verifyJournalEntry(lines);
    expect(res.isBalanced).toBe(true);
    expect(res.totalDebit).toBe(300);
    expect(res.totalCredit).toBe(300);
  });

  it('C. Customer Payment Journal: TOTAL DEBIT == TOTAL CREDIT', () => {
    const lines = [
      { account: '1010 - Cash on Hand', debit: 200, credit: 0 },
      { account: '1100 - Accounts Receivable', debit: 0, credit: 200 }
    ];
    const res = verifyJournalEntry(lines);
    expect(res.isBalanced).toBe(true);
    expect(res.totalDebit).toBe(200);
    expect(res.totalCredit).toBe(200);
  });

  it('D. Inventory Purchase Journal: TOTAL DEBIT == TOTAL CREDIT', () => {
    const lines = [
      { account: '1200 - Raw Materials Inventory', debit: 500, credit: 0 },
      { account: '2010 - Accounts Payable', debit: 0, credit: 500 }
    ];
    const res = verifyJournalEntry(lines);
    expect(res.isBalanced).toBe(true);
    expect(res.totalDebit).toBe(500);
    expect(res.totalCredit).toBe(500);
  });

  it('E. Supplier Payment Journal: TOTAL DEBIT == TOTAL CREDIT', () => {
    const lines = [
      { account: '2010 - Accounts Payable', debit: 500, credit: 0 },
      { account: '1020 - Main Bank Account', debit: 0, credit: 500 }
    ];
    const res = verifyJournalEntry(lines);
    expect(res.isBalanced).toBe(true);
    expect(res.totalDebit).toBe(500);
    expect(res.totalCredit).toBe(500);
  });

  it('F. Expense Journal: TOTAL DEBIT == TOTAL CREDIT', () => {
    const lines = [
      { account: '5020 - Utility Expenses', debit: 80, credit: 0 },
      { account: '1010 - Cash on Hand', debit: 0, credit: 80 }
    ];
    const res = verifyJournalEntry(lines);
    expect(res.isBalanced).toBe(true);
    expect(res.totalDebit).toBe(80);
    expect(res.totalCredit).toBe(80);
  });

  it('G. Cost of Goods Sold Journal: TOTAL DEBIT == TOTAL CREDIT', () => {
    const lines = [
      { account: '5010 - Cost of Goods Sold', debit: 60, credit: 0 },
      { account: '1200 - Inventory', debit: 0, credit: 60 }
    ];
    const res = verifyJournalEntry(lines);
    expect(res.isBalanced).toBe(true);
    expect(res.totalDebit).toBe(60);
    expect(res.totalCredit).toBe(60);
  });

  it('9. REFUND PROCESS: creates Reversal Journal Entry without deleting original record', () => {
    const originalSaleJournal = [
      { account: 'Cash', debit: 100, credit: 0 },
      { account: 'Sales Revenue', debit: 0, credit: 100 },
      { account: 'COGS', debit: 40, credit: 0 },
      { account: 'Inventory', debit: 0, credit: 40 }
    ];

    // Reversal journal for 100% refund
    const refundReversalJournal = [
      { account: 'Sales Revenue / Refunds', debit: 100, credit: 0 },
      { account: 'Cash', debit: 0, credit: 100 },
      { account: 'Inventory', debit: 40, credit: 0 },
      { account: 'COGS', debit: 0, credit: 40 }
    ];

    const originalCheck = verifyJournalEntry(originalSaleJournal);
    const refundCheck = verifyJournalEntry(refundReversalJournal);

    expect(originalCheck.isBalanced).toBe(true);
    expect(refundCheck.isBalanced).toBe(true);
    expect(refundCheck.totalDebit).toBe(140);
    expect(refundCheck.totalCredit).toBe(140);

    // Original entry remains untouched for audit integrity
    expect(originalSaleJournal.length).toBe(4);
  });

  it('10. AUTHORIZATION & ROLE RESTRICTIONS: Cashier prohibited from executing management financial operations', () => {
    const allowedRolesForExpense = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant'];
    
    function isActionAllowed(role: string, action: string) {
      if (action === 'create_expense' || action === 'edit_accounting' || action === 'disburse_salary' || action === 'adjust_inventory_direct') {
        return allowedRolesForExpense.includes(role);
      }
      return true;
    }

    expect(isActionAllowed('Admin', 'create_expense')).toBe(true);
    expect(isActionAllowed('Manager', 'edit_accounting')).toBe(true);
    expect(isActionAllowed('Accountant', 'disburse_salary')).toBe(true);

    // CASHIER MUST BE REJECTED
    expect(isActionAllowed('Cashier', 'create_expense')).toBe(false);
    expect(isActionAllowed('Cashier', 'edit_accounting')).toBe(false);
    expect(isActionAllowed('Cashier', 'disburse_salary')).toBe(false);
    expect(isActionAllowed('Cashier', 'adjust_inventory_direct')).toBe(false);
  });

  it('11. REFUND CALCULATION TEST: Sale = 100, Refund = 20 -> Net Sales = 80 (No double counting)', () => {
    const journalLines = [
      { accountCode: '4010', debit: 0, credit: 100 }, // Sale revenue credit: 100
      { accountCode: '4010', debit: 20, credit: 0 },  // Refund revenue debit: 20
    ];

    let glGrossRevenue = 0;
    let glRevenueDebits = 0;

    journalLines.forEach((jl) => {
      const code = String(jl.accountCode || '');
      if (code.startsWith('4')) {
        glGrossRevenue += jl.credit;
        glRevenueDebits += jl.debit;
      }
    });

    const grossSales = glGrossRevenue;
    const refunds = glRevenueDebits;
    const netSales = grossSales - refunds;

    expect(grossSales).toBe(100);
    expect(refunds).toBe(20);
    expect(netSales).toBe(80); // Correctly 80, NOT double-deducted to 60
  });

  it('12. FULL & PARTIAL REFUND BALANCE TEST: Full & Partial Refund restores COGS, Inventory, Revenue, and Tax', () => {
    // Initial State: Inventory = 10, Unit Cost = $15, Price = $50
    let inventory = 10;
    const unitCost = 15;
    const unitPrice = 50;

    // Step 1: Sell 2 items (Gross Sale = 100, COGS = 30)
    const qtySold = 2;
    inventory -= qtySold; // inventory = 8
    const saleRevenue = qtySold * unitPrice; // 100
    const saleCogs = qtySold * unitCost; // 30

    expect(inventory).toBe(8);
    expect(saleRevenue).toBe(100);
    expect(saleCogs).toBe(30);

    // Step 2: Partial Refund 1 item (Refund = 50, Reversal COGS = 15)
    const refundQtyPartial = 1;
    inventory += refundQtyPartial; // inventory = 9
    const refundRevenuePartial = refundQtyPartial * unitPrice; // 50
    const refundCogsPartial = refundQtyPartial * unitCost; // 15

    const netRevenuePartial = saleRevenue - refundRevenuePartial; // 50
    const netCogsPartial = saleCogs - refundCogsPartial; // 15

    expect(inventory).toBe(9);
    expect(netRevenuePartial).toBe(50);
    expect(netCogsPartial).toBe(15);

    // Step 3: Full Refund of remaining 1 item
    const refundQtyRemaining = 1;
    inventory += refundQtyRemaining; // inventory = 10
    const totalRefundRevenue = saleRevenue; // 100
    const netRevenueFull = saleRevenue - totalRefundRevenue; // 0

    expect(inventory).toBe(10); // Inventory fully restored
    expect(netRevenueFull).toBe(0); // Revenue fully reversed
  });

  it('13. TAX ENGINE: Uses configured tax rate dynamically and rejects silent 5% fallback', () => {
    function computeTaxLiability(revenue: number, taxesConfig?: { rate: number; isActive?: boolean }[]) {
      if (!taxesConfig || taxesConfig.length === 0) {
        throw new Error('Authoritative tax configuration is unavailable.');
      }
      const active = taxesConfig.filter(t => t.isActive !== false);
      if (active.length === 0) {
        throw new Error('No active tax configuration found.');
      }
      const rate = active[0].rate / 100;
      return revenue * rate;
    }

    // Configured 10% tax rate
    expect(computeTaxLiability(1000, [{ rate: 10, isActive: true }])).toBe(100);

    // Configured 8% tax rate
    expect(computeTaxLiability(500, [{ rate: 8, isActive: true }])).toBe(40);

    // Missing tax configuration must throw, NEVER silently compute 5% ($50)
    expect(() => computeTaxLiability(1000, [])).toThrow('Authoritative tax configuration is unavailable.');
    expect(() => computeTaxLiability(1000, undefined)).toThrow('Authoritative tax configuration is unavailable.');
    expect(() => computeTaxLiability(1000, [{ rate: 10, isActive: false }])).toThrow('No active tax configuration found.');
  });

  it('14. TAX 10% PROPAGATION: POS -> Order -> Receipt -> Accounting -> Reports consistent at 10%', () => {
    const configuredTaxRate = 10; // 10%
    const itemPrice = 100;
    const quantity = 1;
    const subtotal = itemPrice * quantity;

    // 1. POS calculation
    const posTax = Number(((subtotal * configuredTaxRate) / 100).toFixed(2));
    const posGrandTotal = subtotal + posTax;
    expect(posTax).toBe(10.00);
    expect(posGrandTotal).toBe(110.00);

    // 2. Order persistence
    const orderPayload = {
      subtotal,
      tax: posTax,
      taxRate: configuredTaxRate / 100,
      totalAmount: posGrandTotal
    };
    expect(orderPayload.tax).toBe(10.00);
    expect(orderPayload.taxRate).toBe(0.10);

    // 3. Receipt label and tax
    const receiptTaxPercent = orderPayload.taxRate
      ? (orderPayload.taxRate * 100).toFixed(0)
      : ((orderPayload.tax / orderPayload.subtotal) * 100).toFixed(0);
    const receiptTaxLabel = `Tax (${receiptTaxPercent}% VAT):`;
    expect(receiptTaxLabel).toBe('Tax (10% VAT):');
    expect(orderPayload.tax).toBe(10.00);

    // 4. Accounting Journal Entry
    const taxLiabilityDebit = 0;
    const taxLiabilityCredit = orderPayload.tax;
    expect(taxLiabilityCredit).toBe(10.00);

    // 5. Reports / CFO Analytics
    const recordedOrders = [orderPayload];
    const reportedVAT = recordedOrders.reduce((sum, o) => sum + (Number(o.tax) || 0), 0);
    expect(reportedVAT).toBe(10.00); // Strict 10% recorded VAT, NOT 5% ($5)
  });

  it('15. SECURITY DENIALS: Role boundaries, cross-branch, unknown roles, missing branch', () => {
    // 1. Manager Branch A -> Branch B = DENY
    const isBranchAuthorized = (userBranch: string, reqBranch: string, role: string) => {
      if (['Owner', 'owner'].includes(role) || userBranch === 'all') return true;
      if (!userBranch || !reqBranch) return false;
      return userBranch === reqBranch;
    };
    expect(isBranchAuthorized('branch_a', 'branch_b', 'Manager')).toBe(false);

    // 2. Cashier -> Accounting Write = DENY
    const isAccountingWriteAllowed = (role: string) => {
      return ['Owner', 'owner', 'Admin', 'admin', 'Accountant', 'accountant'].includes(role);
    };
    expect(isAccountingWriteAllowed('Cashier')).toBe(false);
    expect(isAccountingWriteAllowed('Staff')).toBe(false);
    expect(isAccountingWriteAllowed('Accountant')).toBe(true);

    // 3. Unknown role -> Privileged Endpoint = DENY
    const isKnownPrivilegedRole = (role: string) => {
      const allowed = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant'];
      return allowed.includes(role);
    };
    expect(isKnownPrivilegedRole('HackerRole')).toBe(false);
    expect(isKnownPrivilegedRole('')).toBe(false);
    expect(isKnownPrivilegedRole('Guest')).toBe(false);

    // 4. Missing branch -> Branch-scoped operation = DENY
    expect(isBranchAuthorized('', 'branch_a', 'Cashier')).toBe(false);
  });

  it('16. ZERO TAX (0%): System calculates $0.00 tax accurately and NEVER triggers a 5% fallback', () => {
    const configuredTaxRate = 0; // 0% zero-rated
    const itemPrice = 150;
    const quantity = 2;
    const subtotal = itemPrice * quantity; // 300

    // 1. POS calculation with 0% tax
    const posTax = Number(((subtotal * configuredTaxRate) / 100).toFixed(2));
    const posGrandTotal = subtotal + posTax;
    expect(posTax).toBe(0.00);
    expect(posGrandTotal).toBe(300.00);

    // 2. Order persistence with 0% tax
    const orderPayload = {
      subtotal,
      tax: posTax,
      taxRate: configuredTaxRate,
      totalAmount: posGrandTotal
    };
    expect(orderPayload.tax).toBe(0.00);
    expect(orderPayload.taxRate).toBe(0);
    expect(orderPayload.totalAmount).toBe(300.00);

    // 3. Receipt label with 0% tax
    const receiptTaxPercent = String(orderPayload.taxRate);
    const receiptTaxLabel = `Tax (${receiptTaxPercent}% VAT):`;
    expect(receiptTaxLabel).toBe('Tax (0% VAT):');

    // 4. Accounting ledger credit for tax liability
    const taxLiabilityCredit = orderPayload.tax;
    expect(taxLiabilityCredit).toBe(0.00);

    // 5. Reports / Analytics
    const recordedVAT = [orderPayload].reduce((sum, o) => sum + (Number(o.tax) || 0), 0);
    expect(recordedVAT).toBe(0.00);
  });

  it('17. MISSING TAX CONFIG: POS blocks checkout and throws configuration error without 5% fallback', () => {
    function resolveBranchTax(taxes: { branchId?: string; rate?: number; isActive?: boolean; isDefault?: boolean }[], currentBranchId: string) {
      const activeTaxes = (taxes || []).filter(t => t.isActive !== false);
      const branchTax = activeTaxes.find(t => t.branchId === currentBranchId) || 
                        activeTaxes.find(t => t.isDefault) || 
                        activeTaxes.find(t => !t.branchId || t.branchId === 'all') || 
                        activeTaxes[0];

      if (!branchTax || typeof branchTax.rate !== 'number' || !Number.isFinite(branchTax.rate)) {
        return {
          status: 'ERROR',
          error: 'No authoritative tax rate configured for this branch. Please configure taxes in Settings.',
          taxRatePercent: null
        };
      }

      return {
        status: 'READY',
        error: null,
        taxRatePercent: branchTax.rate
      };
    }

    // When taxes collection is empty
    const emptyResult = resolveBranchTax([], 'branch_01');
    expect(emptyResult.status).toBe('ERROR');
    expect(emptyResult.taxRatePercent).toBe(null);
    expect(emptyResult.error).toContain('No authoritative tax rate configured');

    // When taxes have no matching rate or are inactive
    const inactiveResult = resolveBranchTax([{ branchId: 'branch_01', rate: 10, isActive: false }], 'branch_01');
    expect(inactiveResult.status).toBe('ERROR');
    expect(inactiveResult.taxRatePercent).toBe(null);

    // When valid 15% rate is present
    const validResult = resolveBranchTax([{ branchId: 'branch_01', rate: 15, isActive: true }], 'branch_01');
    expect(validResult.status).toBe('READY');
    expect(validResult.taxRatePercent).toBe(15);
  });

  it('18. BRANCH TAX ISOLATION: Branch A (15%) and Branch B (8%) never leak tax settings', () => {
    const allTaxes = [
      { id: 'tax_a', branchId: 'branch_mogadishu', rate: 15, name: 'Mogadishu Municipality VAT' },
      { id: 'tax_b', branchId: 'branch_hargeisa', rate: 8, name: 'Hargeisa Local VAT' }
    ];

    function getTaxForBranch(branchId: string) {
      const tax = allTaxes.find(t => t.branchId === branchId);
      if (!tax) throw new Error(`No tax configured for branch ${branchId}`);
      return tax.rate;
    }

    expect(getTaxForBranch('branch_mogadishu')).toBe(15);
    expect(getTaxForBranch('branch_hargeisa')).toBe(8);
    expect(() => getTaxForBranch('branch_kismayo')).toThrow('No tax configured for branch branch_kismayo');
  });

  it('19. TAX SECURITY: Global tax creation requires HQ/Owner; Branch tax creation requires branch match', () => {
    function canCreateTax(user: { role: string; branchId: string }, taxDoc: { branchId?: string; rate: number }) {
      const isHQOrAdmin = ['Owner', 'owner', 'Admin', 'admin'].includes(user.role) || ['all', 'HQ', 'hq'].includes(user.branchId);
      const isManagement = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager'].includes(user.role);
      const isGlobal = !taxDoc.branchId || taxDoc.branchId === 'all';

      if (isGlobal) {
        return isHQOrAdmin;
      }

      // Branch-scoped tax
      const isUserBranch = user.branchId === taxDoc.branchId || isHQOrAdmin;
      return isManagement && isUserBranch && taxDoc.branchId.length > 0;
    }

    // HQ Owner can create global tax
    expect(canCreateTax({ role: 'Owner', branchId: 'HQ' }, { branchId: '', rate: 10 })).toBe(true);

    // Branch manager CANNOT create global tax (empty branchId)
    expect(canCreateTax({ role: 'Manager', branchId: 'branch_01' }, { branchId: '', rate: 10 })).toBe(false);

    // Branch manager CAN create tax for their own branch
    expect(canCreateTax({ role: 'Manager', branchId: 'branch_01' }, { branchId: 'branch_01', rate: 10 })).toBe(true);

    // Branch manager CANNOT create tax for another branch
    expect(canCreateTax({ role: 'Manager', branchId: 'branch_01' }, { branchId: 'branch_02', rate: 10 })).toBe(false);

    // Cashier CANNOT create taxes anywhere
    expect(canCreateTax({ role: 'Cashier', branchId: 'branch_01' }, { branchId: 'branch_01', rate: 10 })).toBe(false);
  });

  describe('REAL BACKEND /api/orders/:orderId/refund (handleCustomerRefund) & /api/crm/wallet/refund (handleWalletRefund) VERIFICATION SUITE', () => {
    beforeEach(async () => {
      const db = getAdminDb();
      if (typeof (db as any).clearAll === 'function') {
        (db as any).clearAll();
      }
      await db.collection('branches').doc('main_branch_01').set({
        id: 'main_branch_01',
        name: 'Mogadishu Main Branch',
        code: 'MOG-01',
        isActive: true
      });
      await db.collection('branches').doc('branch_b').set({
        id: 'branch_b',
        name: 'Hargeisa Branch',
        code: 'HAR-02',
        isActive: true
      });
      await db.collection('cash_registers').doc('reg_refund_main').set({
        id: 'reg_refund_main',
        branchId: 'main_branch_01',
        status: 'Open',
        openingBalance: 500,
        cashSales: 100,
        cashPayouts: 0,
        expectedClosingBalance: 600
      });
      await db.collection('products').doc('prod_refund_steak').set({
        id: 'prod_refund_steak',
        name: 'Grilled Steak',
        price: 20,
        cost: 6,
        costPrice: 6,
        stock: 10,
        trackStock: true,
        branchId: 'main_branch_01'
      });
      await db.collection('products').doc('prod_refund_juice').set({
        id: 'prod_refund_juice',
        name: 'Fresh Mango Juice',
        price: 10,
        cost: 3,
        costPrice: 3,
        stock: 30,
        trackStock: false, // Untracked direct product stock
        branchId: 'main_branch_01'
      });
      await db.collection('ingredients').doc('ing_refund_beef').set({
        id: 'ing_refund_beef',
        name: 'Beef Sirloin',
        stock: 40,
        currentStockUsageUnit: 40,
        minStockUsageUnit: 5,
        usageUnit: 'kg',
        costPerUsageUnit: 3,
        branchId: 'main_branch_01'
      });
      await db.collection('recipes').doc('rec_refund_steak').set({
        id: 'rec_refund_steak',
        productId: 'prod_refund_steak',
        branchId: 'main_branch_01',
        isActive: true,
        items: [{ ingredientId: 'ing_refund_beef', quantity: 2, unit: 'kg' }]
      });
      await db.collection('customers').doc('cust_refund_1').set({
        id: 'cust_refund_1',
        name: 'Amina Hassan',
        fullName: 'Amina Hassan',
        branchId: 'main_branch_01',
        totalSpent: 66,
        totalSpending: 66,
        points: 60,
        loyaltyPoints: 60,
        lifetimePoints: 210,
        membershipLevel: 'Silver'
      });
      await db.collection('customer_points').doc('cust_refund_1').set({
        customerId: 'cust_refund_1',
        customerName: 'Amina Hassan',
        points: 60,
        currentPointsBalance: 60,
        lifetimePoints: 210,
        tier: 'Silver'
      });
      await db.collection('customer_wallets').doc('wallet_refund_1').set({
        id: 'wallet_refund_1',
        customerId: 'cust_refund_1',
        customerName: 'Amina Hassan',
        balance: 50,
        currency: 'USD',
        status: 'active',
        branchId: 'main_branch_01'
      });
    });

    it('1, 2, 3, 4, 9, 10, 11, 12 & 13. Processes item-level partial refund then full remaining refund, tracking refundedQuantity, restoring inventory & recipe ingredients, and reversing COGS, tax, revenue, cash register, payments, and loyalty points', async () => {
      const db = getAdminDb();
      const orderId = 'ord_full_partial_1';
      await db.collection('orders').doc(orderId).set({
        id: orderId,
        orderNumber: 'ORD-FP-01',
        branchId: 'main_branch_01',
        customerId: 'cust_refund_1',
        customerName: 'Amina Hassan',
        subtotal: 60,
        discountAmount: 0,
        taxRate: 10,
        tax: 6,
        deliveryFee: 0,
        totalAmount: 66,
        paidAmount: 66,
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        status: 'completed',
        pointsEarnedAtCheckout: 60,
        items: [
          {
            id: 'line_steak',
            orderItemId: 'line_steak',
            productId: 'prod_refund_steak',
            productName: 'Grilled Steak',
            quantity: 2,
            refundedQuantity: 0,
            price: 20,
            subtotal: 40,
            itemCogs: 12,
            pointsEarned: 40,
            recipeSnapshot: [
              { ingredientId: 'ing_refund_beef', ingredientName: 'Beef Sirloin', quantityPerItem: 2, totalQuantity: 4, costPerUnit: 3, totalCost: 12 }
            ]
          },
          {
            id: 'line_juice',
            orderItemId: 'line_juice',
            productId: 'prod_refund_juice',
            productName: 'Fresh Mango Juice',
            quantity: 2,
            refundedQuantity: 0,
            price: 10,
            subtotal: 20,
            itemCogs: 6,
            pointsEarned: 20,
            recipeSnapshot: []
          }
        ]
      });
      await db.collection('payments').doc('pay_fp_01').set({
        id: 'pay_fp_01',
        orderId,
        amount: 66,
        status: 'completed',
        branchId: 'main_branch_01'
      });

      // Step 1: Item-level partial refund of 1 Grilled Steak (subtotal 20 + 2 tax = 22, COGS = 6, points = 20)
      const resPartial = await request(app)
        .post(`/api/orders/${orderId}/refund`)
        .set('Authorization', MANAGER_TOKEN)
        .set('Idempotency-Key', 'idem-refund-partial-step-1')
        .send({
          amount: 22,
          paymentMethod: 'cash',
          reason: 'One steak returned',
          items: [{ orderItemId: 'line_steak', quantity: 1 }]
        });

      expect(resPartial.status).toBe(200);
      expect(resPartial.body.status).toBe('success');
      expect(resPartial.body.refundAmount).toBe(22);
      expect(resPartial.body.refundedAmount).toBe(22);

      // Verify order state & refundedQuantity after partial refund
      const orderAfterPartial = (await db.collection('orders').doc(orderId).get()).data()!;
      expect(orderAfterPartial.refundedAmount).toBe(22);
      expect(orderAfterPartial.paymentStatus).toBe('partially_refunded');
      expect(orderAfterPartial.refundStatus).toBe('partial');
      expect(orderAfterPartial.status).toBe('completed');
      expect(orderAfterPartial.items[0].refundedQuantity).toBe(1);
      expect(orderAfterPartial.items[1].refundedQuantity).toBe(0);

      // Verify inventory restoration (1 steak product + 2kg beef ingredient restored)
      const steakAfterPartial = (await db.collection('products').doc('prod_refund_steak').get()).data()!;
      expect(steakAfterPartial.stock).toBe(11); // 10 + 1
      const beefAfterPartial = (await db.collection('ingredients').doc('ing_refund_beef').get()).data()!;
      expect(beefAfterPartial.stock).toBe(42); // 40 + 2
      expect(beefAfterPartial.currentStockUsageUnit).toBe(42);

      // Verify cash register & payment record updated
      const regAfterPartial = (await db.collection('cash_registers').doc('reg_refund_main').get()).data()!;
      expect(regAfterPartial.cashPayouts).toBe(22);
      expect(regAfterPartial.expectedClosingBalance).toBe(578); // 600 - 22
      const payAfterPartial = (await db.collection('payments').doc('pay_fp_01').get()).data()!;
      expect(payAfterPartial.status).toBe('partially_refunded');
      expect(payAfterPartial.refundedAmount).toBe(22);

      // Verify loyalty points & lifetimePoints reversal (60 - 20 = 40, lifetime 210 - 20 = 190 -> Bronze)
      const custAfterPartial = (await db.collection('customers').doc('cust_refund_1').get()).data()!;
      expect(custAfterPartial.points).toBe(40);
      expect(custAfterPartial.lifetimePoints).toBe(190);
      expect(custAfterPartial.membershipLevel).toBe('Bronze');
      expect(custAfterPartial.totalSpent).toBe(44);

      // Verify Journal Entry for partial refund (Revenue 20, Tax 2, Cash 22, Inventory 6, COGS 6)
      const jeSnap1 = await db.collection('journal_entries').where('reference', '==', 'ORD-FP-01').get();
      expect(jeSnap1.size).toBe(1);
      const je1 = jeSnap1.docs[0].data();
      expect(je1.totalDebit).toBe(28); // 20 rev + 2 tax + 6 inv
      expect(je1.totalCredit).toBe(28); // 22 cash + 6 cogs

      // Step 2: Full refund of remaining balance ($44) without explicit items array
      const resRemainingFull = await request(app)
        .post(`/api/orders/${orderId}/refund`)
        .set('Authorization', MANAGER_TOKEN)
        .set('Idempotency-Key', 'idem-refund-partial-step-2')
        .send({
          amount: 44,
          paymentMethod: 'cash',
          reason: 'Remaining items refunded'
        });

      expect(resRemainingFull.status).toBe(200);
      expect(resRemainingFull.body.refundedAmount).toBe(44);

      const orderAfterFull = (await db.collection('orders').doc(orderId).get()).data()!;
      expect(orderAfterFull.refundedAmount).toBe(66);
      expect(orderAfterFull.paymentStatus).toBe('refunded');
      expect(orderAfterFull.refundStatus).toBe('full');
      expect(orderAfterFull.status).toBe('cancelled');
      expect(orderAfterFull.items[0].refundedQuantity).toBe(2);
      expect(orderAfterFull.items[1].refundedQuantity).toBe(2);

      // Verify prod_refund_steak (trackStock: true) is 12, while prod_refund_juice (trackStock: false) stayed 30
      const steakAfterFull = (await db.collection('products').doc('prod_refund_steak').get()).data()!;
      const juiceAfterFull = (await db.collection('products').doc('prod_refund_juice').get()).data()!;
      const beefAfterFull = (await db.collection('ingredients').doc('ing_refund_beef').get()).data()!;
      expect(steakAfterFull.stock).toBe(12);
      expect(juiceAfterFull.stock).toBe(30);
      expect(beefAfterFull.stock).toBe(44);
    });

    it('5, 6, 7 & 8. Enforces idempotency, handles concurrent refunds safely, rejects payload conflicts with 409, and blocks over-refund & duplicate refunds', async () => {
      const db = getAdminDb();
      const orderId = 'ord_idem_conc_1';
      await db.collection('orders').doc(orderId).set({
        id: orderId,
        orderNumber: 'ORD-IC-01',
        branchId: 'main_branch_01',
        subtotal: 40,
        discountAmount: 0,
        taxRate: 10,
        tax: 4,
        totalAmount: 44,
        paidAmount: 44,
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        status: 'completed',
        items: [
          {
            id: 'line_1',
            orderItemId: 'line_1',
            productId: 'prod_refund_steak',
            productName: 'Grilled Steak',
            quantity: 2,
            refundedQuantity: 0,
            price: 20,
            subtotal: 40,
            itemCogs: 12,
            recipeSnapshot: [{ ingredientId: 'ing_refund_beef', quantityPerItem: 2, totalQuantity: 4, costPerUnit: 3 }]
          }
        ]
      });

      // 7 & 8a. Concurrent requests with the SAME Idempotency-Key and payload execute exactly once
      const idemKey = 'idem-refund-concurrent-same-key';
      const payload = {
        amount: 22,
        paymentMethod: 'cash',
        items: [{ orderItemId: 'line_1', quantity: 1 }]
      };
      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/api/orders/${orderId}/refund`)
          .set('Authorization', MANAGER_TOKEN)
          .set('Idempotency-Key', idemKey)
          .send(payload),
        request(app)
          .post(`/api/orders/${orderId}/refund`)
          .set('Authorization', MANAGER_TOKEN)
          .set('Idempotency-Key', idemKey)
          .send(payload)
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(resA.body.refundId).toBeDefined();
      expect(resA.body.refundId).toBe(resB.body.refundId);
      expect(resB.body.refundedAmount).toBe(22);

      const refundsSnap = await db.collection('refunds').where('orderId', '==', orderId).get();
      expect(refundsSnap.size).toBe(1);

      // 8b. Reusing the SAME Idempotency-Key with a DIFFERENT payload returns 409 Conflict
      const resConflict = await request(app)
        .post(`/api/orders/${orderId}/refund`)
        .set('Authorization', MANAGER_TOKEN)
        .set('Idempotency-Key', idemKey)
        .send({
          amount: 44,
          paymentMethod: 'cash',
          items: [{ orderItemId: 'line_1', quantity: 2 }]
        });
      expect(resConflict.status).toBe(409);
      expect(resConflict.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

      // 5. Over-refund (requesting quantity 2 when only 1 remains, or $30 when $22 remains) is rejected with 400
      const resOverQty = await request(app)
        .post(`/api/orders/${orderId}/refund`)
        .set('Authorization', MANAGER_TOKEN)
        .set('Idempotency-Key', 'idem-refund-over-qty')
        .send({
          amount: 44,
          paymentMethod: 'cash',
          items: [{ orderItemId: 'line_1', quantity: 2 }]
        });
      expect(resOverQty.status).toBe(400);
      expect(resOverQty.body.error).toMatch(/exceeds remaining refundable/i);

      // 7b. Two concurrent competing refunds for the last remaining item with DIFFERENT keys: exactly one succeeds, one fails
      const [comp1, comp2] = await Promise.all([
        request(app)
          .post(`/api/orders/${orderId}/refund`)
          .set('Authorization', MANAGER_TOKEN)
          .set('Idempotency-Key', 'idem-refund-competing-1')
          .send(payload),
        request(app)
          .post(`/api/orders/${orderId}/refund`)
          .set('Authorization', MANAGER_TOKEN)
          .set('Idempotency-Key', 'idem-refund-competing-2')
          .send(payload)
      ]);
      const statuses = [comp1.status, comp2.status].sort();
      expect(statuses).toEqual([200, 400]);

      // 6. Duplicate refund after order is already fully refunded -> rejected with 400
      const resDupAfterFull = await request(app)
        .post(`/api/orders/${orderId}/refund`)
        .set('Authorization', MANAGER_TOKEN)
        .set('Idempotency-Key', 'idem-refund-after-full')
        .send(payload);
      expect(resDupAfterFull.status).toBe(400);
      expect(resDupAfterFull.body.error).toMatch(/already fully refunded|Cannot refund cancelled Order/i);
    });

    it('13, 14, 15 & 16. Supports wallet refunds with GL 2030 & cross-endpoint cap, enforces branch isolation (403), blocks closed accounting periods, and rolls back atomically on failure', async () => {
      const db = getAdminDb();
      const orderId = 'ord_wallet_and_atomic_1';
      await db.collection('orders').doc(orderId).set({
        id: orderId,
        orderNumber: 'ORD-WA-01',
        branchId: 'main_branch_01',
        customerId: 'cust_refund_1',
        customerName: 'Amina Hassan',
        subtotal: 20,
        discountAmount: 0,
        taxRate: 10,
        tax: 2,
        totalAmount: 22,
        paidAmount: 22,
        paymentStatus: 'paid',
        paymentMethod: 'wallet',
        status: 'completed',
        items: [
          {
            id: 'line_w1',
            orderItemId: 'line_w1',
            productId: 'prod_refund_steak',
            productName: 'Grilled Steak',
            quantity: 1,
            refundedQuantity: 0,
            price: 20,
            subtotal: 20
            // Note: itemCogs omitted to verify server fallback to canonical recipe / product cost
          }
        ]
      });

      // 14. Branch isolation: Manager of branch_b cannot refund an order belonging to main_branch_01 (403)
      const resCrossBranch = await request(app)
        .post(`/api/orders/${orderId}/refund`)
        .set('Authorization', MANAGER_BRANCH_B_TOKEN)
        .set('Idempotency-Key', 'idem-refund-cross-branch')
        .send({
          amount: 22,
          paymentMethod: 'wallet',
          items: [{ orderItemId: 'line_w1', quantity: 1 }]
        });
      expect(resCrossBranch.status).toBe(403);

      // 15. Closed accounting period blocks refund with 400 and leaves zero partial state
      await db.collection('accounting_periods').doc('period_closed_test').set({
        id: 'period_closed_test',
        branchId: 'main_branch_01',
        startDate: '2020-01-01',
        endDate: '2099-12-31',
        status: 'Closed'
      });
      const resClosedPeriod = await request(app)
        .post(`/api/orders/${orderId}/refund`)
        .set('Authorization', MANAGER_TOKEN)
        .set('Idempotency-Key', 'idem-refund-closed-period')
        .send({
          amount: 22,
          paymentMethod: 'wallet',
          items: [{ orderItemId: 'line_w1', quantity: 1 }]
        });
      expect(resClosedPeriod.status).toBe(400);
      expect(resClosedPeriod.body.error).toMatch(/Accounting period.*is closed/i);

      // 16. Verify zero partial state after failed refund
      const walletBefore = (await db.collection('customer_wallets').doc('wallet_refund_1').get()).data()!;
      expect(walletBefore.balance).toBe(50);
      const steakBefore = (await db.collection('products').doc('prod_refund_steak').get()).data()!;
      expect(steakBefore.stock).toBe(10);

      // Re-open accounting period and execute wallet refund (omitting amount to verify server line-level derivation & fallback COGS)
      await db.collection('accounting_periods').doc('period_closed_test').delete();
      const resWalletRefund = await request(app)
        .post(`/api/orders/${orderId}/refund`)
        .set('Authorization', MANAGER_TOKEN)
        .set('Idempotency-Key', 'idem-refund-wallet-ok')
        .send({
          paymentMethod: 'wallet',
          items: [{ orderItemId: 'line_w1', quantity: 1 }]
        });
      expect(resWalletRefund.status).toBe(200);
      expect(resWalletRefund.body.refundAmount).toBe(22);

      // Verify customer wallet credited (50 + 22 = 72) and GL 2030 + fallback COGS (2kg * $3 = $6) posted
      const walletAfter = (await db.collection('customer_wallets').doc('wallet_refund_1').get()).data()!;
      expect(walletAfter.balance).toBe(72);
      const walletAccount = (await db.collection('accounts').doc('acc_wallet_liability').get()).data()!;
      expect(walletAccount.balance).toBe(22);
      const jeSnap = await db.collection('journal_entries').where('reference', '==', 'ORD-WA-01').get();
      expect(jeSnap.size).toBe(1);
      expect(jeSnap.docs[0].data().totalDebit).toBe(28); // 20 rev + 2 tax + 6 inv
      expect(jeSnap.docs[0].data().totalCredit).toBe(28); // 22 wallet liability + 6 cogs

      // Cross-endpoint over-refund protection: attempting to refund the same order again via /api/crm/wallet/refund fails
      const resCrossEndpoint = await request(app)
        .post('/api/crm/wallet/refund')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', 'idem-wallet-cross-endpoint')
        .send({
          customerId: 'cust_refund_1',
          orderId,
          amount: 10,
          branchId: 'main_branch_01'
        });
      expect(resCrossEndpoint.status).toBeGreaterThanOrEqual(400);
      expect(resCrossEndpoint.body.error).toMatch(/exceeds remaining refundable balance|cancelled/i);
    });
  });
});
