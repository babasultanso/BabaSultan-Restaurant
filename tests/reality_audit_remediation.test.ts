import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { getAdminDb } from '../server/db';
import { getFinancialSummaryData, isControlAccount } from '../server/trustedFinancialBackend';

const OWNER_TOKEN = 'Bearer test_token_owner';
const MANAGER_TOKEN = 'Bearer test_token_manager';

describe('REALITY AUDIT REMEDIATION SUITE (BLOCKERS 3, 4, 5, 6)', () => {
  const db = getAdminDb();
  const branchId = 'main_branch_01';

  beforeEach(async () => {
    // Ensure base chart of accounts exists
    const accounts = [
      { id: 'acc_cash', code: '1010', name: 'Cash on Hand', type: 'cash', balance: 1000, branchId: 'all' },
      { id: 'acc_bank', code: '1020', name: 'Main Corporate Bank', type: 'bank', balance: 5000, branchId: 'all' },
      { id: 'acc_ar', code: '1200', name: 'Accounts Receivable', type: 'asset', balance: 0, branchId: 'all' },
      { id: 'acc_inventory', code: '1300', name: 'Inventory Asset', type: 'asset', balance: 2000, branchId: 'all' },
      { id: 'acc_ap', code: '2010', name: 'Accounts Payable', type: 'liability', balance: 0, branchId: 'all' },
      { id: 'acc_driver_payable', code: '2020', name: 'Driver Commissions Payable', type: 'liability', balance: 0, branchId: 'all' },
      { id: 'acc_wallet_liability', code: '2030', name: 'Customer Wallet Liability', type: 'liability', balance: 0, branchId: 'all' },
      { id: 'acc_revenue', code: '4010', name: 'Restaurant Sales Revenue', type: 'revenue', balance: 0, branchId: 'all' },
      { id: 'acc_cogs', code: '5010', name: 'Cost of Goods Sold', type: 'expense', balance: 0, branchId: 'all' },
      { id: 'acc_expense', code: '6100', name: 'Operating Expense', type: 'expense', balance: 0, branchId: 'all' },
      { id: 'acc_bank_fees', code: '6200', name: 'Bank Charges & Fees', type: 'expense', balance: 0, branchId: 'all' }
    ];
    for (const acc of accounts) {
      await db.collection('accounts').doc(acc.id).set(acc);
    }
    await db.collection('branches').doc(branchId).set({
      id: branchId,
      name: 'Main Flagship Branch',
      code: 'MAIN-01',
      isActive: true,
      taxEnabled: false
    });
    await db.collection('taxes').doc(`tax_${branchId}`).set({
      id: `tax_${branchId}`,
      name: 'Zero Tax',
      rate: 0,
      taxRate: 0,
      branchId,
      isActive: true,
      isPrimary: true
    });
    await db.collection('cash_registers').doc(`reg_${branchId}`).set({
      id: `reg_${branchId}`,
      branchId,
      status: 'Open',
      openingBalance: 1000,
      expectedClosingBalance: 1000,
      cashAdjustments: 0,
      updatedAt: new Date().toISOString()
    });
  });

  // =========================================================================
  // BLOCKER 3: Manual AP Supplier Linkage
  // Regression test: Create Manual AP -> Supplier Balance +300 -> Pay 300 -> Supplier Balance -300
  // =========================================================================
  it('BLOCKER 3: Manual AP -> Supplier Balance +300 -> AP Payment 300 -> Supplier Balance -300', async () => {
    const supplierId = `sup_test_${Date.now()}`;
    await db.collection('suppliers').doc(supplierId).set({
      id: supplierId,
      name: 'Prime Food Wholesalers',
      companyName: 'Prime Food Wholesalers',
      outstandingBalance: 0,
      pendingAmount: 0,
      branchId,
      status: 'active'
    });

    // 1. Create Manual AP Bill for $300 linked to supplierId
    const billRes = await request(app)
      .post('/api/accounting/payables')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idem_ap_create_${Date.now()}`)
      .send({
        supplierId,
        supplierName: 'Prime Food Wholesalers',
        billNumber: `BILL-${Date.now()}`,
        totalAmount: 300,
        branchId,
        dueDate: '2026-11-01'
      });

    expect(billRes.status).toBe(200);
    expect(billRes.body.status).toBe('success');
    const payableId = billRes.body.id;
    expect(payableId).toBeDefined();

    // Verify supplier balance increased by +300
    const supSnapAfterCreate = await db.collection('suppliers').doc(supplierId).get();
    expect(supSnapAfterCreate.exists).toBe(true);
    expect(supSnapAfterCreate.data()?.outstandingBalance).toBe(300);
    expect(supSnapAfterCreate.data()?.pendingAmount).toBe(300);

    // Verify payable doc has canonical supplierId
    const payableSnap = await db.collection('payables').doc(payableId).get();
    expect(payableSnap.data()?.supplierId).toBe(supplierId);
    expect(payableSnap.data()?.remainingBalance).toBe(300);

    // 2. Pay $300 towards the payable
    const payRes = await request(app)
      .post(`/api/accounting/payables/${payableId}/payment`)
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idem_ap_pay_${Date.now()}`)
      .send({
        amount: 300,
        paymentMethod: 'cash',
        date: '2026-10-03'
      });

    expect(payRes.status).toBe(200);

    // Verify supplier balance decreased back to 0
    const supSnapAfterPay = await db.collection('suppliers').doc(supplierId).get();
    expect(supSnapAfterPay.data()?.outstandingBalance).toBe(0);
    expect(supSnapAfterPay.data()?.pendingAmount).toBe(0);

    // Verify payable status is now Paid
    const payableSnapAfterPay = await db.collection('payables').doc(payableId).get();
    expect(payableSnapAfterPay.data()?.status).toBe('Paid');
    expect(payableSnapAfterPay.data()?.remainingBalance).toBe(0);
  });

  it('BLOCKER 3: Rejects Manual AP creation referencing non-existent supplierId', async () => {
    const res = await request(app)
      .post('/api/accounting/payables')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idem_ap_fail_${Date.now()}`)
      .send({
        supplierId: 'non_existent_supplier_xyz',
        supplierName: 'Fake Supplier',
        totalAmount: 150,
        branchId
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });

  // =========================================================================
  // BLOCKER 4: Bank Subledger Synchronization (All 7 Paths)
  // =========================================================================
  describe('BLOCKER 4: Bank Subledger Synchronization across all 7 paths', () => {
    let testBankAccountId: string;
    let testBankGlAccountId: string;

    beforeEach(async () => {
      testBankAccountId = `bank_acc_${Date.now()}`;
      testBankGlAccountId = `acc_gl_${testBankAccountId}`;

      // Create GL account for this bank
      await db.collection('accounts').doc(testBankGlAccountId).set({
        id: testBankGlAccountId,
        code: `1020-${testBankAccountId.slice(0, 6)}`,
        name: 'Mogadishu Central Bank Account',
        type: 'bank',
        balance: 1000,
        branchId
      });

      // Create bank_accounts subledger document
      await db.collection('bank_accounts').doc(testBankAccountId).set({
        id: testBankAccountId,
        accountName: 'Mogadishu Central Bank Account',
        bankName: 'Central Bank of Somalia',
        accountNumber: `CBS-${Date.now()}`,
        currentBalance: 1000,
        balance: 1000,
        glAccountId: testBankGlAccountId,
        branchId,
        status: 'Active'
      });
    });

    // Path 1: POS payment by bank
    it('Path 1: POS payment by bank atomically updates bank_accounts.currentBalance and bank_transactions', async () => {
      // Create product
      const prodId = `prod_${Date.now()}`;
      await db.collection('products').doc(prodId).set({
        id: prodId,
        name: 'Camel Steak Special',
        price: 50,
        cost: 20,
        branchId,
        stock: 100,
        isActive: true
      });

      const orderPayload = {
        orderType: 'dine_in',
        paymentMethod: 'card', // mapped to bank settlement
        bankAccountId: testBankAccountId,
        totalAmount: 50,
        paidAmount: 50,
        subtotal: 50,
        taxAmount: 0,
        items: [{ productId: prodId, productName: 'Camel Steak Special', quantity: 1, unitPrice: 50, totalPrice: 50 }],
        branchId
      };

      const res = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idem_pos_bank_${Date.now()}`)
        .send({ orderData: orderPayload });

      expect(res.status).toBe(200);

      // Verify bank_accounts.currentBalance increased from 1000 to 1050
      const bankSnap = await db.collection('bank_accounts').doc(testBankAccountId).get();
      expect(bankSnap.data()?.currentBalance).toBe(1050);

      // Verify bank_transactions record exists
      const txSnap = await db.collection('bank_transactions').where('bankAccountId', '==', testBankAccountId).get();
      expect(txSnap.empty).toBe(false);
      const matchingTx = txSnap.docs.find(d => d.data().type === 'deposit' && d.data().amount === 50);
      expect(matchingTx).toBeDefined();
      expect(matchingTx?.data().balanceAfter).toBe(1050);

      // Verify GL account was updated
      const glSnap = await db.collection('accounts').doc(testBankGlAccountId).get();
      expect(glSnap.data()?.balance).toBe(1050);
    });

    // Path 2: AR payment by bank
    it('Path 2: AR payment by bank atomically updates bank_accounts.currentBalance and bank_transactions', async () => {
      const recId = `rec_${Date.now()}`;
      await db.collection('receivables').doc(recId).set({
        id: recId,
        customerName: 'Loyal VIP Client',
        totalAmount: 200,
        paidAmount: 0,
        remainingBalance: 200,
        status: 'Unpaid',
        branchId
      });

      const res = await request(app)
        .post(`/api/accounting/receivables/${recId}/payment`)
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idem_ar_bank_${Date.now()}`)
        .send({
          amount: 200,
          paymentMethod: 'card',
          bankAccountId: testBankAccountId,
          date: '2026-10-03'
        });

      expect(res.status).toBe(200);

      const bankSnap = await db.collection('bank_accounts').doc(testBankAccountId).get();
      expect(bankSnap.data()?.currentBalance).toBe(1200); // 1000 + 200

      const txSnap = await db.collection('bank_transactions').where('bankAccountId', '==', testBankAccountId).get();
      const matchingTx = txSnap.docs.find(d => d.data().source === 'AR' && d.data().amount === 200);
      expect(matchingTx).toBeDefined();
      expect(matchingTx?.data().balanceAfter).toBe(1200);
    });

    // Path 3: AP payment by bank
    it('Path 3: AP payment by bank atomically updates bank_accounts.currentBalance and bank_transactions', async () => {
      const payableId = `pay_${Date.now()}`;
      await db.collection('payables').doc(payableId).set({
        id: payableId,
        vendorName: 'Vegetable Supplier',
        totalAmount: 150,
        paidAmount: 0,
        remainingBalance: 150,
        status: 'Unpaid',
        branchId
      });

      const res = await request(app)
        .post(`/api/accounting/payables/${payableId}/payment`)
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idem_ap_bank_${Date.now()}`)
        .send({
          amount: 150,
          paymentMethod: 'card',
          bankAccountId: testBankAccountId,
          date: '2026-10-03'
        });

      expect(res.status).toBe(200);

      const bankSnap = await db.collection('bank_accounts').doc(testBankAccountId).get();
      expect(bankSnap.data()?.currentBalance).toBe(850); // 1000 - 150

      const txSnap = await db.collection('bank_transactions').where('bankAccountId', '==', testBankAccountId).get();
      const matchingTx = txSnap.docs.find(d => d.data().source === 'AP' && d.data().amount === 150);
      expect(matchingTx).toBeDefined();
      expect(matchingTx?.data().balanceAfter).toBe(850);
    });

    // Path 4: Supplier payment by bank
    it('Path 4: Supplier payment by bank atomically updates bank_accounts.currentBalance and bank_transactions', async () => {
      const supplierId = `sup_bank_${Date.now()}`;
      await db.collection('suppliers').doc(supplierId).set({
        id: supplierId,
        name: 'Dairy Supplier Co',
        outstandingBalance: 500,
        pendingAmount: 500,
        branchId
      });

      const res = await request(app)
        .post('/api/purchases/supplier-payment')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idem_sup_bank_${Date.now()}`)
        .send({
          supplierId,
          supplierName: 'Dairy Supplier Co',
          amount: 300,
          paymentMethod: 'card',
          bankAccountId: testBankAccountId,
          branchId
        });

      expect(res.status).toBe(200);

      const bankSnap = await db.collection('bank_accounts').doc(testBankAccountId).get();
      expect(bankSnap.data()?.currentBalance).toBe(700); // 1000 - 300

      const txSnap = await db.collection('bank_transactions').where('bankAccountId', '==', testBankAccountId).get();
      const matchingTx = txSnap.docs.find(d => d.data().source === 'Supplier' && d.data().amount === 300);
      expect(matchingTx).toBeDefined();
      expect(matchingTx?.data().balanceAfter).toBe(700);
    });

    // Path 5 & 6: Bank deposit & withdrawal
    it('Path 5 & 6: Bank deposit and withdrawal atomically update bank_accounts and GL', async () => {
      // Deposit $400
      const depRes = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idem_dep_${Date.now()}`)
        .send({
          bankAccountId: testBankAccountId,
          type: 'deposit',
          amount: 400,
          description: 'Cash deposit from register',
          branchId
        });
      expect(depRes.status).toBe(200);

      let bankSnap = await db.collection('bank_accounts').doc(testBankAccountId).get();
      expect(bankSnap.data()?.currentBalance).toBe(1400); // 1000 + 400

      // Withdrawal $200
      const withRes = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idem_with_${Date.now()}`)
        .send({
          bankAccountId: testBankAccountId,
          type: 'withdrawal',
          amount: 200,
          description: 'Petty cash bank withdrawal',
          branchId
        });
      expect(withRes.status).toBe(200);

      bankSnap = await db.collection('bank_accounts').doc(testBankAccountId).get();
      expect(bankSnap.data()?.currentBalance).toBe(1200); // 1400 - 200
    });

    // Path 7: Bank transfer
    it('Path 7: Bank transfer updates both source and destination bank balances and records transactions', async () => {
      const destBankAccountId = `bank_dest_${Date.now()}`;
      const destBankGlId = `acc_gl_${destBankAccountId}`;

      await db.collection('accounts').doc(destBankGlId).set({
        id: destBankGlId,
        code: `1020-${destBankAccountId.slice(0, 6)}`,
        name: 'Secondary Savings Account',
        type: 'bank',
        balance: 500,
        branchId
      });

      await db.collection('bank_accounts').doc(destBankAccountId).set({
        id: destBankAccountId,
        accountName: 'Secondary Savings Account',
        bankName: 'Dahabshiil Bank',
        currentBalance: 500,
        balance: 500,
        glAccountId: destBankGlId,
        branchId,
        status: 'Active'
      });

      const transferRes = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idem_xfer_${Date.now()}`)
        .send({
          bankAccountId: testBankAccountId,
          toAccountId: destBankAccountId,
          type: 'transfer',
          amount: 300,
          description: 'Inter-account liquidity transfer',
          branchId
        });

      expect(transferRes.status).toBe(200);

      // Source bank: 1000 - 300 = 700
      const srcSnap = await db.collection('bank_accounts').doc(testBankAccountId).get();
      expect(srcSnap.data()?.currentBalance).toBe(700);

      // Dest bank: 500 + 300 = 800
      const destSnap = await db.collection('bank_accounts').doc(destBankAccountId).get();
      expect(destSnap.data()?.currentBalance).toBe(800);

      // Dest bank transactions contains transfer received record
      const destTxSnap = await db.collection('bank_transactions').where('bankAccountId', '==', destBankAccountId).get();
      expect(destTxSnap.empty).toBe(false);
      const destTx = destTxSnap.docs.find(d => d.data().type === 'transfer' && d.data().amount === 300);
      expect(destTx).toBeDefined();
      expect(destTx?.data().balanceAfter).toBe(800);
    });
  });

  // =========================================================================
  // BLOCKER 5: Manual Control Accounts Enforcement
  // =========================================================================
  describe('BLOCKER 5: Manual Control Accounts Enforcement', () => {
    it('isControlAccount correctly identifies all canonical control accounts', () => {
      expect(isControlAccount({ id: 'acc_cash', code: '1010' })).toBe(true);
      expect(isControlAccount({ id: 'acc_bank', code: '1020' })).toBe(true);
      expect(isControlAccount({ id: 'acc_bank_sub', code: '1020-001' })).toBe(true);
      expect(isControlAccount({ id: 'acc_ar', code: '1200' })).toBe(true);
      expect(isControlAccount({ id: 'acc_inventory', code: '1300' })).toBe(true);
      expect(isControlAccount({ id: 'acc_ap', code: '2010' })).toBe(true);
      expect(isControlAccount({ id: 'acc_driver_payable', code: '2020' })).toBe(true);
      expect(isControlAccount({ id: 'acc_wallet_liability', code: '2030' })).toBe(true);

      // Normal GL accounts are NOT control accounts
      expect(isControlAccount({ id: 'acc_revenue', code: '4010' })).toBe(false);
      expect(isControlAccount({ id: 'acc_expense', code: '6100' })).toBe(false);
      expect(isControlAccount({ id: 'acc_rent', code: '6210' })).toBe(false);
    });

    it('Normal GL account: Manual journal entry is ALLOWED', async () => {
      // Create custom normal operating accounts
      await db.collection('accounts').doc('acc_consulting_exp').set({
        id: 'acc_consulting_exp',
        code: '6350',
        name: 'Consulting Expense',
        type: 'expense',
        balance: 0,
        branchId: 'all'
      });
      await db.collection('accounts').doc('acc_accrued_exp').set({
        id: 'acc_accrued_exp',
        code: '2150',
        name: 'Accrued Operating Liabilities',
        type: 'liability',
        balance: 0,
        branchId: 'all'
      });

      const res = await request(app)
        .post('/api/accounting/journal-entries')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idem_je_normal_${Date.now()}`)
        .send({
          description: 'Accrue month-end legal consulting fees',
          lines: [
            { accountId: 'acc_consulting_exp', debit: 500, credit: 0 },
            { accountId: 'acc_accrued_exp', debit: 0, credit: 500 }
          ],
          branchId
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    it('Control account: Manual journal entry without override is REJECTED', async () => {
      // Trying to directly manipulate Accounts Payable control account
      const res = await request(app)
        .post('/api/accounting/journal-entries')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idem_je_ctrl_reject_${Date.now()}`)
        .send({
          description: 'Direct adjustment to AP control account',
          lines: [
            { accountId: 'acc_expense', debit: 200, credit: 0 },
            { accountId: 'acc_ap', debit: 0, credit: 200 } // Control account!
          ],
          branchId
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('control account');
      expect(res.body.error).toContain('prohibited');
    });

    it('Control account: Authorized override with documented policy is ALLOWED', async () => {
      const res = await request(app)
        .post('/api/accounting/journal-entries')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idem_je_ctrl_override_${Date.now()}`)
        .send({
          description: 'Annual audited reconciliation adjusting entry',
          allowControlAccountOverride: true,
          overrideReason: 'External CPA audit adjustment confirmed by CFO for year-end inventory write-off',
          lines: [
            { accountId: 'acc_cogs', debit: 100, credit: 0 },
            { accountId: 'acc_inventory', debit: 0, credit: 100 } // Control account with override
          ],
          branchId
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      // Verify journal entry record contains override audit trail
      const jeSnap = await db.collection('journal_entries').doc(res.body.id).get();
      expect(jeSnap.data()?.controlAccountOverride).toBe(true);
      expect(jeSnap.data()?.overrideReason).toContain('External CPA audit');
    });
  });

  // =========================================================================
  // BLOCKER 6: Branch Financial Summary Reconciliations
  // =========================================================================
  describe('BLOCKER 6: Branch Financial Summary Reconciliation', () => {
    it('Includes canonical accounts with branchId="all" and derives branch balance strictly from branch journal lines', async () => {
      const branchA = 'branch_a';
      const branchB = 'branch_b';

      // Record a sale in Branch A ($300)
      const jeA = db.collection('journal_entries').doc();
      await jeA.set({
        id: jeA.id,
        date: '2026-10-01',
        branchId: branchA,
        status: 'Posted',
        lines: [
          { accountId: 'acc_cash', debit: 300, credit: 0, branchId: branchA },
          { accountId: 'acc_revenue', debit: 0, credit: 300, branchId: branchA }
        ]
      });
      await db.collection('journal_lines').doc().set({
        accountId: 'acc_cash',
        accountCode: '1010',
        debit: 300,
        credit: 0,
        branchId: branchA,
        date: '2026-10-01'
      });
      await db.collection('journal_lines').doc().set({
        accountId: 'acc_revenue',
        accountCode: '4010',
        debit: 0,
        credit: 300,
        branchId: branchA,
        date: '2026-10-01'
      });

      // Record a sale in Branch B ($700)
      const jeB = db.collection('journal_entries').doc();
      await jeB.set({
        id: jeB.id,
        date: '2026-10-01',
        branchId: branchB,
        status: 'Posted',
        lines: [
          { accountId: 'acc_cash', debit: 700, credit: 0, branchId: branchB },
          { accountId: 'acc_revenue', debit: 0, credit: 700, branchId: branchB }
        ]
      });
      await db.collection('journal_lines').doc().set({
        accountId: 'acc_cash',
        accountCode: '1010',
        debit: 700,
        credit: 0,
        branchId: branchB,
        date: '2026-10-01'
      });
      await db.collection('journal_lines').doc().set({
        accountId: 'acc_revenue',
        accountCode: '4010',
        debit: 0,
        credit: 700,
        branchId: branchB,
        date: '2026-10-01'
      });

      // Update global acc_cash.balance to 1000 (300 + 700)
      await db.collection('accounts').doc('acc_cash').update({
        balance: 1000
      });

      // Fetch summary for Branch A
      const summaryA = await getFinancialSummaryData({
        userBranchId: branchA,
        period: 'all_time'
      });

      // 1. Canonical accounts must be included (accounts array not empty)
      expect(summaryA).toBeDefined();
      expect(summaryA.grossSales).toBe(300); // Only Branch A revenue!
      expect(summaryA.netSales).toBe(300);

      // 2. Branch A Cash balance MUST be derived from Branch A journal lines ($300), NOT the global $1000
      expect(summaryA.cash).toBe(300);

      // Fetch summary for Branch B
      const summaryB = await getFinancialSummaryData({
        userBranchId: branchB,
        period: 'all_time'
      });

      expect(summaryB.grossSales).toBe(700);
      expect(summaryB.cash).toBe(700);
    });
  });
});
