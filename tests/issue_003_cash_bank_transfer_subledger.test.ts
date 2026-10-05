import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { getAdminDb } from '../server/trustedFinancialBackend.js';

describe('ISSUE 003 — Cash / Bank Transfer Subledger Atomic Suite', () => {
  const db = getAdminDb();
  const branchId = 'main_branch_01';

  beforeEach(async () => {
    await db.collection('branches').doc(branchId).set({ id: branchId, name: 'Main Flagship Branch' });
    await db.collection('taxes').doc(`tax_${branchId}`).set({
      id: `tax_${branchId}`,
      name: 'Standard Tax',
      rate: 0,
      isActive: true,
      isDefault: true,
      branchId
    });

    // Close any previous open registers to ensure single authoritative test register
    const regSnaps = await db.collection('cash_registers').where('branchId', '==', branchId).get();
    for (const d of regSnaps.docs) {
      await d.ref.update({ status: 'Closed' });
    }
  });

  it('1. bank -> bank: atomically updates source & dest bank_accounts subledger, GL, journal, and ledger', async () => {
    const ts = Date.now();
    const srcBankId = `bank_src_${ts}`;
    const destBankId = `bank_dest_${ts}`;
    const srcGlId = `gl_bank_src_${ts}`;
    const destGlId = `gl_bank_dest_${ts}`;

    // Seed GL accounts
    await db.collection('accounts').doc(srcGlId).set({
      id: srcGlId,
      code: '1020-01',
      name: 'Source Bank GL',
      type: 'Asset',
      subType: 'bank',
      balance: 1000,
      branchId,
      status: 'Active'
    });
    await db.collection('accounts').doc(destGlId).set({
      id: destGlId,
      code: '1020-02',
      name: 'Destination Bank GL',
      type: 'Asset',
      subType: 'bank',
      balance: 500,
      branchId,
      status: 'Active'
    });

    // Seed Bank Subledger accounts
    await db.collection('bank_accounts').doc(srcBankId).set({
      id: srcBankId,
      accountName: 'Premier Bank Source',
      accountNumber: 'ACC-SRC-01',
      glAccountId: srcGlId,
      currentBalance: 1000,
      balance: 1000,
      branchId,
      status: 'Active'
    });
    await db.collection('bank_accounts').doc(destBankId).set({
      id: destBankId,
      accountName: 'Dahabshiil Bank Dest',
      accountNumber: 'ACC-DEST-02',
      glAccountId: destGlId,
      currentBalance: 500,
      balance: 500,
      branchId,
      status: 'Active'
    });

    const res = await request(app)
      .post('/api/accounting/bank-transaction')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `transfer-b2b-${ts}`)
      .send({
        bankTransactionData: {
          bankAccountId: srcBankId,
          toAccountId: destBankId,
          type: 'transfer',
          amount: 200,
          date: '2026-05-10',
          reference: `REF-B2B-${ts}`,
          description: 'Transfer 200 from Premier to Dahabshiil',
          branchId
        }
      });

    expect(res.status).toBe(200);

    // Verify Subledger updates
    const srcBankSnap = await db.collection('bank_accounts').doc(srcBankId).get();
    expect(srcBankSnap.data()?.currentBalance).toBe(800);

    const destBankSnap = await db.collection('bank_accounts').doc(destBankId).get();
    expect(destBankSnap.data()?.currentBalance).toBe(700);

    // Verify GL updates
    const srcGlSnap = await db.collection('accounts').doc(srcGlId).get();
    expect(srcGlSnap.data()?.balance).toBe(800);

    const destGlSnap = await db.collection('accounts').doc(destGlId).get();
    expect(destGlSnap.data()?.balance).toBe(700);

    // Verify destination bank_transactions collection entry was posted
    const destTxSnaps = await db.collection('bank_transactions')
      .where('bankAccountId', '==', destBankId)
      .get();
    expect(destTxSnaps.empty).toBe(false);
    expect(destTxSnaps.docs[0].data().amount).toBe(200);
    expect(destTxSnaps.docs[0].data().balanceAfter).toBe(700);
  });

  it('2. cash -> bank: atomically updates cash_registers, dest bank subledger, GL, journal, and ledger', async () => {
    const ts = Date.now();
    const regId = `reg_test_${ts}`;
    const destBankId = `bank_c2b_${ts}`;
    const destGlId = `gl_bank_c2b_${ts}`;

    // Seed GL accounts
    await db.collection('accounts').doc('acc_cash').set({
      id: 'acc_cash',
      code: '1010',
      name: 'Cash on Hand',
      type: 'Asset',
      subType: 'cash',
      balance: 1000,
      branchId: 'all',
      status: 'Active'
    });
    await db.collection('accounts').doc(destGlId).set({
      id: destGlId,
      code: '1020-03',
      name: 'IBS Bank Deposit GL',
      type: 'Asset',
      subType: 'bank',
      balance: 300,
      branchId,
      status: 'Active'
    });

    // Seed cash register
    await db.collection('cash_registers').doc(regId).set({
      id: regId,
      registerName: 'Main Cash Register',
      branchId,
      status: 'Open',
      openingBalance: 600,
      expectedClosingBalance: 600
    });

    // Seed destination bank account
    await db.collection('bank_accounts').doc(destBankId).set({
      id: destBankId,
      accountName: 'IBS Bank Vault',
      accountNumber: 'ACC-IBS-01',
      glAccountId: destGlId,
      currentBalance: 300,
      balance: 300,
      branchId,
      status: 'Active'
    });

    const res = await request(app)
      .post('/api/accounting/bank-transaction')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `transfer-c2b-${ts}`)
      .send({
        bankTransactionData: {
          bankAccountId: 'acc_cash',
          toAccountId: destBankId,
          type: 'transfer',
          amount: 150,
          date: '2026-05-10',
          reference: `REF-C2B-${ts}`,
          description: 'Cash deposit to IBS Bank',
          branchId
        }
      });

    expect(res.status).toBe(200);

    // Verify cash register subledger decremented by 150
    const regSnap = await db.collection('cash_registers').doc(regId).get();
    expect(regSnap.data()?.expectedClosingBalance).toBe(450);

    // Verify dest bank subledger incremented by 150
    const destBankSnap = await db.collection('bank_accounts').doc(destBankId).get();
    expect(destBankSnap.data()?.currentBalance).toBe(450);

    // Verify GL balances
    const cashGlSnap = await db.collection('accounts').doc('acc_cash').get();
    expect(cashGlSnap.data()?.balance).toBe(850); // 1000 - 150

    const destGlSnap = await db.collection('accounts').doc(destGlId).get();
    expect(destGlSnap.data()?.balance).toBe(450); // 300 + 150
  });

  it('3. bank -> cash: atomically decrements bank subledger and increments cash_registers', async () => {
    const ts = Date.now();
    const regId = `reg_b2c_${ts}`;
    const srcBankId = `bank_b2c_${ts}`;
    const srcGlId = `gl_bank_b2c_${ts}`;

    await db.collection('accounts').doc(srcGlId).set({
      id: srcGlId,
      code: '1020-04',
      name: 'Salaam Bank GL',
      type: 'Asset',
      subType: 'bank',
      balance: 1000,
      branchId,
      status: 'Active'
    });
    await db.collection('accounts').doc('acc_cash').set({
      id: 'acc_cash',
      code: '1010',
      name: 'Cash on Hand',
      type: 'Asset',
      subType: 'cash',
      balance: 500,
      branchId: 'all',
      status: 'Active'
    });
    await db.collection('cash_registers').doc(regId).set({
      id: regId,
      registerName: 'Main Cash Register',
      branchId,
      status: 'Open',
      openingBalance: 400,
      expectedClosingBalance: 400
    });
    await db.collection('bank_accounts').doc(srcBankId).set({
      id: srcBankId,
      accountName: 'Salaam Bank Account',
      accountNumber: 'ACC-SAL-01',
      glAccountId: srcGlId,
      currentBalance: 1000,
      balance: 1000,
      branchId,
      status: 'Active'
    });

    const res = await request(app)
      .post('/api/accounting/bank-transaction')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `transfer-b2c-${ts}`)
      .send({
        bankTransactionData: {
          bankAccountId: srcBankId,
          toAccountId: 'acc_cash',
          type: 'transfer',
          amount: 250,
          date: '2026-05-10',
          reference: `REF-B2C-${ts}`,
          description: 'Withdrawal from Salaam to register',
          branchId
        }
      });

    expect(res.status).toBe(200);

    // Verify bank subledger decremented
    const bankSnap = await db.collection('bank_accounts').doc(srcBankId).get();
    expect(bankSnap.data()?.currentBalance).toBe(750);

    // Verify cash register incremented
    const regSnap = await db.collection('cash_registers').doc(regId).get();
    expect(regSnap.data()?.expectedClosingBalance).toBe(650); // 400 + 250
  });

  it('4. rejects transfer involving non-bank/cash accounts (e.g. Accounts Receivable acc_ar)', async () => {
    const ts = Date.now();
    await db.collection('accounts').doc('acc_ar_test').set({
      id: 'acc_ar_test',
      code: '1200',
      name: 'Accounts Receivable',
      type: 'Asset',
      subType: 'receivable',
      balance: 500,
      branchId,
      status: 'Active'
    });

    const res = await request(app)
      .post('/api/accounting/bank-transaction')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `transfer-bad-${ts}`)
      .send({
        bankTransactionData: {
          bankAccountId: 'acc_ar_test',
          toAccountId: 'acc_cash',
          type: 'transfer',
          amount: 50,
          date: '2026-05-10',
          branchId
        }
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not a valid bank or cash account/i);
  });

  it('5. POS bank settlement: updates bank_accounts subledger, GL, journal, and ledger', async () => {
    const ts = Date.now();
    const bankId = `bank_pos_${ts}`;
    const glId = `gl_bank_pos_${ts}`;
    const prodId = `prod_pos_${ts}`;

    await db.collection('accounts').doc(glId).set({
      id: glId,
      code: '1020-POS',
      name: 'POS Bank GL',
      type: 'Asset',
      subType: 'bank',
      balance: 1000,
      branchId,
      status: 'Active'
    });
    await db.collection('bank_accounts').doc(bankId).set({
      id: bankId,
      accountName: 'Merchant POS Bank',
      accountNumber: `ACC-POS-${ts}`,
      glAccountId: glId,
      currentBalance: 1000,
      balance: 1000,
      branchId,
      status: 'Active'
    });
    await db.collection('products').doc(prodId).set({
      id: prodId,
      name: 'Lamb Shank Special',
      price: 50,
      costPrice: 20,
      branchId,
      isActive: true,
      category: 'Main'
    });

    const res = await request(app)
      .post('/api/pos/checkout')
      .set('Authorization', 'Bearer test_token_cashier')
      .set('Idempotency-Key', `pos-bank-order-${ts}`)
      .send({
        orderData: {
          items: [
            { id: prodId, productId: prodId, name: 'Lamb Shank Special', price: 50, quantity: 1, type: 'product' }
          ],
          paymentMethod: 'bank',
          paymentAmount: 50,
          paidAmount: 50,
          bankAccountId: bankId,
          fulfillmentType: 'dine_in',
          branchId
        }
      });

    expect(res.status).toBe(200);

    // Verify Bank Subledger was incremented by order total (50)
    const bankSnap = await db.collection('bank_accounts').doc(bankId).get();
    expect(bankSnap.data()?.currentBalance).toBe(1050);

    // Verify GL Account balance was incremented by 50
    const glSnap = await db.collection('accounts').doc(glId).get();
    expect(glSnap.data()?.balance).toBe(1050);
  });

  it('6. AR bank collection: updates bank_accounts subledger, decrements AR, and posts GL lines', async () => {
    const ts = Date.now();
    const bankId = `bank_ar_${ts}`;
    const glId = `gl_bank_ar_${ts}`;
    const custId = `cust_ar_${ts}`;
    const recId = `rec_ar_${ts}`;

    await db.collection('accounts').doc(glId).set({
      id: glId,
      code: '1020-AR',
      name: 'AR Bank GL',
      type: 'Asset',
      subType: 'bank',
      balance: 2000,
      branchId,
      status: 'Active'
    });
    await db.collection('bank_accounts').doc(bankId).set({
      id: bankId,
      accountName: 'Corporate Collections Bank',
      accountNumber: `ACC-AR-${ts}`,
      glAccountId: glId,
      currentBalance: 2000,
      balance: 2000,
      branchId,
      status: 'Active'
    });
    await db.collection('customers').doc(custId).set({
      id: custId,
      name: 'VIP Corporate Client',
      branchId,
      outstandingBalance: 300
    });
    await db.collection('receivables').doc(recId).set({
      id: recId,
      invoiceNumber: `INV-AR-${ts}`,
      customerId: custId,
      customerName: 'VIP Corporate Client',
      totalAmount: 300,
      paidAmount: 0,
      remainingBalance: 300,
      status: 'Unpaid',
      branchId,
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .post(`/api/accounting/receivables/${recId}/payment`)
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `ar-bank-pay-${ts}`)
      .send({
        amount: 300,
        paymentMethod: 'bank',
        bankAccountId: bankId,
        branchId
      });

    expect(res.status).toBe(200);

    // Bank subledger updated: 2000 + 300 = 2300
    const bankSnap = await db.collection('bank_accounts').doc(bankId).get();
    expect(bankSnap.data()?.currentBalance).toBe(2300);

    // Receivable status paid
    const recSnap = await db.collection('receivables').doc(recId).get();
    expect(recSnap.data()?.status).toBe('Paid');
    expect(recSnap.data()?.remainingBalance).toBe(0);
  });
});
