import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { getAdminDb } from '../server/trustedFinancialBackend.js';

describe('ISSUE 004 — Supplier Payment & Credit Notes Balance Verification', () => {
  const db = getAdminDb();
  const branchId = 'main_branch_01';

  beforeEach(async () => {
    await db.collection('branches').doc(branchId).set({ id: branchId, name: 'Main Flagship Branch' });

    // Close any previous open registers to ensure single authoritative test register
    const regSnaps = await db.collection('cash_registers').where('branchId', '==', branchId).get();
    for (const d of regSnaps.docs) {
      await d.ref.update({ status: 'Closed' });
    }

    await db.collection('cash_registers').doc(`reg_${branchId}`).set({
      id: `reg_${branchId}`,
      registerName: 'Main Cash Register',
      branchId,
      status: 'Open',
      openingBalance: 5000,
      expectedClosingBalance: 5000
    });
  });

  it('verifies Invoice=1000, Paid=300, Credit=200 leaves remaining 500: payment 500 allowed, payment 501 rejected, cannot double pay', async () => {
    const ts = Date.now();
    const supId = `sup_cn_${ts}`;
    const apId = `ap_cn_${ts}`;
    const regId = `reg_cn_${ts}`;

    await db.collection('suppliers').doc(supId).set({
      id: supId,
      name: 'Supplier Credit Note Test',
      branchId,
      outstandingBalance: 500, // 1000 total - 300 paid - 200 credit = 500 remaining
      pendingAmount: 500
    });

    await db.collection('payables').doc(apId).set({
      id: apId,
      billNumber: `BILL-CN-${ts}`,
      supplierId: supId,
      vendorName: 'Supplier Credit Note Test',
      branchId,
      totalAmount: 1000,
      amount: 1000,
      paidAmount: 300,
      creditNoteAmount: 200,
      remainingBalance: 500,
      status: 'Partial',
      payments: []
    });

    // 1. Try paying 501 via single AP payment -> must be rejected
    const rejectRes = await request(app)
      .post(`/api/accounting/payables/${apId}/payment`)
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `ap-pay-excess-${ts}`)
      .send({
        amount: 501,
        paymentMethod: 'cash',
        branchId
      });

    expect(rejectRes.status).toBeGreaterThanOrEqual(400);
    expect(rejectRes.body.error).toMatch(/exceeds remaining payable balance/i);

    // 2. Try paying 501 via supplier payment -> must also be rejected
    const rejectSupRes = await request(app)
      .post('/api/purchases/supplier-payment')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `sup-pay-excess-${ts}`)
      .send({
        supplierId: supId,
        amount: 501,
        paymentMethod: 'cash',
        branchId
      });

    expect(rejectSupRes.status).toBe(400);
    expect(rejectSupRes.body.error).toMatch(/exceeds outstanding balance/i);

    // 3. Paying exact remaining balance (500) -> allowed
    const allowRes = await request(app)
      .post(`/api/accounting/payables/${apId}/payment`)
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `ap-pay-exact-${ts}`)
      .send({
        amount: 500,
        paymentMethod: 'cash',
        branchId
      });

    expect(allowRes.status).toBe(200);

    const updatedApSnap = await db.collection('payables').doc(apId).get();
    expect(updatedApSnap.data()?.status).toBe('Paid');
    expect(updatedApSnap.data()?.remainingBalance).toBe(0);
    expect(updatedApSnap.data()?.paidAmount).toBe(800);
    expect(updatedApSnap.data()?.creditNoteAmount).toBe(200);

    const updatedSupSnap = await db.collection('suppliers').doc(supId).get();
    expect(updatedSupSnap.data()?.outstandingBalance).toBe(0);

    // 4. Try paying anything further on the credit-covered invoice -> must be rejected
    const doublePayRes = await request(app)
      .post(`/api/accounting/payables/${apId}/payment`)
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `ap-pay-double-${ts}`)
      .send({
        amount: 50,
        paymentMethod: 'cash',
        branchId
      });

    expect(doublePayRes.status).toBeGreaterThanOrEqual(400);
    expect(doublePayRes.body.error).toMatch(/exceeds remaining payable balance/i);
  });

  it('full credit note covers invoice: remaining balance is 0 and no further payment accepted', async () => {
    const ts = Date.now();
    const supId = `sup_full_cn_${ts}`;
    const apId = `ap_full_cn_${ts}`;

    await db.collection('suppliers').doc(supId).set({
      id: supId,
      name: 'Full Credit Supplier',
      branchId,
      outstandingBalance: 0,
      pendingAmount: 0
    });

    await db.collection('payables').doc(apId).set({
      id: apId,
      billNumber: `BILL-FULL-CN-${ts}`,
      supplierId: supId,
      branchId,
      totalAmount: 500,
      amount: 500,
      paidAmount: 0,
      creditNoteAmount: 500,
      remainingBalance: 0,
      status: 'Paid',
      payments: []
    });

    const res = await request(app)
      .post(`/api/accounting/payables/${apId}/payment`)
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `pay-zero-rem-${ts}`)
      .send({
        amount: 10,
        paymentMethod: 'cash',
        branchId
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toMatch(/exceeds remaining payable balance/i);
  });

  it('multiple credit notes correctly decrement remaining payable balance', async () => {
    const ts = Date.now();
    const supId = `sup_multi_cn_${ts}`;
    const apId = `ap_multi_cn_${ts}`;

    // Invoice total 1000, multiple credit notes applied: 300 + 400 = 700 total credit
    await db.collection('suppliers').doc(supId).set({
      id: supId,
      name: 'Multi Credit Supplier',
      branchId,
      outstandingBalance: 300,
      pendingAmount: 300
    });

    await db.collection('payables').doc(apId).set({
      id: apId,
      billNumber: `BILL-MULTI-CN-${ts}`,
      supplierId: supId,
      branchId,
      totalAmount: 1000,
      amount: 1000,
      paidAmount: 0,
      creditNoteAmount: 700,
      remainingBalance: 300,
      status: 'Partial',
      payments: []
    });

    // Attempting to pay 301 must fail
    const failRes = await request(app)
      .post(`/api/accounting/payables/${apId}/payment`)
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `multi-pay-fail-${ts}`)
      .send({
        amount: 301,
        paymentMethod: 'cash',
        branchId
      });

    expect(failRes.status).toBeGreaterThanOrEqual(400);
    expect(failRes.body.error).toMatch(/exceeds remaining payable balance/i);

    // Paying exactly 300 succeeds
    const passRes = await request(app)
      .post(`/api/accounting/payables/${apId}/payment`)
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `multi-pay-pass-${ts}`)
      .send({
        amount: 300,
        paymentMethod: 'cash',
        branchId
      });

    expect(passRes.status).toBe(200);
    const snap = await db.collection('payables').doc(apId).get();
    expect(snap.data()?.status).toBe('Paid');
    expect(snap.data()?.remainingBalance).toBe(0);
    expect(snap.data()?.paidAmount).toBe(300);
    expect(snap.data()?.creditNoteAmount).toBe(700);
  });
});
