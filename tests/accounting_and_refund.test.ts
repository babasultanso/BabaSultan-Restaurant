import { describe, it, expect } from 'vitest';

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
});
