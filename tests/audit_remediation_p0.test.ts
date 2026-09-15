import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, rateState, cleanupRateState, RATE_LIMIT_MAX_ENTRIES } from '../server.ts';
import { getAdminDb } from '../server/trustedFinancialBackend.js';
import { getEmployeePayrollStatus } from '../src/lib/reports.ts';
import { Employee, SalaryPayment } from '../src/types.ts';

describe('P0/P1 AUDIT REMEDIATION INTEGRATION TEST SUITE', () => {
  const OWNER_TOKEN = 'Bearer test_token_owner';
  const BRANCH_ID = 'branch_mogadishu_01';

  beforeEach(async () => {
    const db = getAdminDb();
    for (const col of [
      'orders',
      'receivables',
      'deliveries',
      'drivers',
      'cash_registers',
      'journal_entries',
      'journal_lines',
      'accounts',
      'accounting_periods',
      'mutation_idempotency'
    ]) {
      const snap = await db.collection(col).get();
      for (const d of snap.docs) await d.ref.delete();
    }

    // Standard chart of accounts
    await db.collection('accounts').doc('acc_cash').set({
      id: 'acc_cash',
      code: '1010',
      name: 'Cash on Hand',
      type: 'Asset',
      balance: 0,
      branchId: 'all'
    });
    await db.collection('accounts').doc('acc_ar').set({
      id: 'acc_ar',
      code: '1200',
      name: 'Accounts Receivable',
      type: 'Asset',
      balance: 0,
      branchId: 'all'
    });

    // Seed branch
    await db.collection('branches').doc(BRANCH_ID).set({
      id: BRANCH_ID,
      name: 'Mogadishu Central',
      status: 'active'
    });
  });

  describe('1. COD — ZERO OPEN CASH REGISTERS (FAIL-SAFE)', () => {
    it('rejects COD delivery settlement with 409 and performs zero state writes when 0 open registers exist', async () => {
      const db = getAdminDb();
      const orderId = 'ord_zero_reg_01';
      const deliveryId = 'del_zero_reg_01';
      const driverId = 'drv_zero_reg_01';
      const receivableId = 'rec_zero_reg_01';

      // Ensure NO open cash register exists
      const regSnap = await db.collection('cash_registers').where('branchId', '==', BRANCH_ID).get();
      expect(regSnap.empty).toBe(true);

      await db.collection('drivers').doc(driverId).set({
        id: driverId,
        fullName: 'Driver Zero',
        branchId: BRANCH_ID,
        availability: 'on_delivery',
        totalCashCollected: 0,
        currentCashBalance: 0
      });

      await db.collection('orders').doc(orderId).set({
        id: orderId,
        branchId: BRANCH_ID,
        total: 75,
        totalAmount: 75,
        paidAmount: 0,
        paymentStatus: 'unpaid',
        paymentMethod: 'cod',
        isCodOrder: true,
        status: 'confirmed',
        deliveryStatus: 'arrived'
      });

      await db.collection('receivables').doc(receivableId).set({
        id: receivableId,
        orderId,
        branchId: BRANCH_ID,
        amount: 75,
        paidAmount: 0,
        remainingBalance: 75,
        status: 'Unpaid'
      });

      await db.collection('deliveries').doc(deliveryId).set({
        id: deliveryId,
        orderId,
        branchId: BRANCH_ID,
        driverId,
        status: 'arrived',
        isCod: true,
        paymentMethod: 'cod',
        totalAmount: 75
      });

      // Transition to delivered
      const res = await request(app)
        .post(`/api/deliveries/${deliveryId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'delivered' });

      // Must fail with 409 Conflict / Blocked
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/No open cash register exists/i);

      // Verify ZERO writes occurred (atomic transaction rollback)
      const afterDel = (await db.collection('deliveries').doc(deliveryId).get()).data();
      expect(afterDel?.status).toBe('arrived');
      expect(afterDel?.codSettled).toBeUndefined();

      const afterOrd = (await db.collection('orders').doc(orderId).get()).data();
      expect(afterOrd?.status).toBe('confirmed');
      expect(afterOrd?.paymentStatus).toBe('unpaid');

      const afterDrv = (await db.collection('drivers').doc(driverId).get()).data();
      expect(afterDrv?.currentCashBalance).toBe(0);
      expect(afterDrv?.availability).toBe('on_delivery');

      const afterRec = (await db.collection('receivables').doc(receivableId).get()).data();
      expect(afterRec?.status).toBe('Unpaid');
      expect(afterRec?.remainingBalance).toBe(75);

      const jnlSnap = await db.collection('journal_entries').get();
      expect(jnlSnap.empty).toBe(true);
    });
  });

  describe('2. COD — MULTIPLE OPEN REGISTERS (BLOCKING AMBIGUITY)', () => {
    it('rejects COD delivery settlement with 409 when more than 1 open cash register exists', async () => {
      const db = getAdminDb();
      const orderId = 'ord_mult_reg_01';
      const deliveryId = 'del_mult_reg_01';
      const driverId = 'drv_mult_reg_01';

      // Create TWO open cash registers for the same branch
      await db.collection('cash_registers').doc('reg_open_1').set({
        id: 'reg_open_1',
        branchId: BRANCH_ID,
        status: 'Open',
        openingBalance: 500,
        expectedClosingBalance: 500,
        cashAdjustments: 0
      });
      await db.collection('cash_registers').doc('reg_open_2').set({
        id: 'reg_open_2',
        branchId: BRANCH_ID,
        status: 'Open',
        openingBalance: 300,
        expectedClosingBalance: 300,
        cashAdjustments: 0
      });

      await db.collection('drivers').doc(driverId).set({
        id: driverId,
        fullName: 'Driver Multi',
        branchId: BRANCH_ID,
        availability: 'on_delivery',
        totalCashCollected: 0,
        currentCashBalance: 0
      });

      await db.collection('orders').doc(orderId).set({
        id: orderId,
        branchId: BRANCH_ID,
        total: 40,
        totalAmount: 40,
        paymentStatus: 'unpaid',
        paymentMethod: 'cod',
        status: 'confirmed',
        deliveryStatus: 'arrived'
      });

      await db.collection('deliveries').doc(deliveryId).set({
        id: deliveryId,
        orderId,
        branchId: BRANCH_ID,
        driverId,
        status: 'arrived',
        paymentMethod: 'cod',
        totalAmount: 40
      });

      const res = await request(app)
        .post(`/api/deliveries/${deliveryId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'delivered' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Multiple open cash registers/i);

      // Verify no register was modified
      const reg1 = (await db.collection('cash_registers').doc('reg_open_1').get()).data();
      const reg2 = (await db.collection('cash_registers').doc('reg_open_2').get()).data();
      expect(reg1?.expectedClosingBalance).toBe(500);
      expect(reg2?.expectedClosingBalance).toBe(300);

      // Verify delivery doc not settled
      const delDoc = (await db.collection('deliveries').doc(deliveryId).get()).data();
      expect(delDoc?.status).toBe('arrived');
      expect(delDoc?.codSettled).toBeUndefined();
    });
  });

  describe('3. COD — 1 OPEN REGISTER & CASH CUSTODY MODEL', () => {
    it('settles successfully when exactly 1 register is open, updating driver custody and register state atomically', async () => {
      const db = getAdminDb();
      const orderId = 'ord_single_reg_01';
      const deliveryId = 'del_single_reg_01';
      const driverId = 'drv_single_reg_01';
      const receivableId = 'rec_single_reg_01';
      const registerId = 'reg_single_01';

      // Create EXACTLY ONE open cash register
      await db.collection('cash_registers').doc(registerId).set({
        id: registerId,
        branchId: BRANCH_ID,
        status: 'Open',
        openingBalance: 1000,
        expectedClosingBalance: 1000,
        cashAdjustments: 0
      });

      await db.collection('drivers').doc(driverId).set({
        id: driverId,
        fullName: 'Driver Custody',
        branchId: BRANCH_ID,
        availability: 'on_delivery',
        totalCashCollected: 100,
        currentCashBalance: 100
      });

      await db.collection('orders').doc(orderId).set({
        id: orderId,
        branchId: BRANCH_ID,
        total: 60,
        totalAmount: 60,
        paymentStatus: 'unpaid',
        paymentMethod: 'cod',
        status: 'confirmed',
        deliveryStatus: 'arrived'
      });

      await db.collection('receivables').doc(receivableId).set({
        id: receivableId,
        orderId,
        branchId: BRANCH_ID,
        amount: 60,
        paidAmount: 0,
        remainingBalance: 60,
        status: 'Unpaid'
      });

      await db.collection('deliveries').doc(deliveryId).set({
        id: deliveryId,
        orderId,
        branchId: BRANCH_ID,
        driverId,
        status: 'arrived',
        paymentMethod: 'cod',
        totalAmount: 60
      });

      const res = await request(app)
        .post(`/api/deliveries/${deliveryId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'delivered' });

      expect(res.status).toBe(200);
      expect(res.body.deliveryStatus).toBe('delivered');

      // 1. Driver Cash Custody: driver collected $60, balance goes from 100 -> 160
      const drvSnap = (await db.collection('drivers').doc(driverId).get()).data();
      expect(drvSnap?.availability).toBe('available');
      expect(drvSnap?.currentCashBalance).toBe(160);
      expect(drvSnap?.totalCashCollected).toBe(160);

      // 2. Register State: expected closing balance incremented by $60 (1000 -> 1060)
      const regSnap = (await db.collection('cash_registers').doc(registerId).get()).data();
      expect(regSnap?.expectedClosingBalance).toBe(1060);
      expect(regSnap?.cashAdjustments).toBe(60);

      // 3. Receivable settled
      const recSnap = (await db.collection('receivables').doc(receivableId).get()).data();
      expect(recSnap?.status).toBe('Paid');
      expect(recSnap?.remainingBalance).toBe(0);

      // 4. Balanced Journal Entry
      const jnlSnap = await db.collection('journal_entries').where('source', '==', 'Delivery').get();
      expect(jnlSnap.docs.length).toBe(1);
      const lines = jnlSnap.docs[0].data().lines || [];
      const debit1010 = lines.find((l: any) => l.accountCode === '1010')?.debit;
      const credit1200 = lines.find((l: any) => l.accountCode === '1200')?.credit;
      expect(debit1010).toBe(60);
      expect(credit1200).toBe(60);
    });
  });

  describe('4. COD — STRICT IDEMPOTENCY & CONCURRENT DUPLICATES', () => {
    it('handles concurrent duplicate delivery requests without double settlement', async () => {
      const db = getAdminDb();
      const orderId = 'ord_concurrent_01';
      const deliveryId = 'del_concurrent_01';
      const driverId = 'drv_concurrent_01';
      const registerId = 'reg_concurrent_01';

      await db.collection('cash_registers').doc(registerId).set({
        id: registerId,
        branchId: BRANCH_ID,
        status: 'Open',
        openingBalance: 500,
        expectedClosingBalance: 500,
        cashAdjustments: 0
      });

      await db.collection('drivers').doc(driverId).set({
        id: driverId,
        fullName: 'Driver Concurrent',
        branchId: BRANCH_ID,
        availability: 'on_delivery',
        totalCashCollected: 0,
        currentCashBalance: 0
      });

      await db.collection('orders').doc(orderId).set({
        id: orderId,
        branchId: BRANCH_ID,
        total: 50,
        totalAmount: 50,
        paymentStatus: 'unpaid',
        paymentMethod: 'cod',
        status: 'confirmed',
        deliveryStatus: 'arrived'
      });

      await db.collection('deliveries').doc(deliveryId).set({
        id: deliveryId,
        orderId,
        branchId: BRANCH_ID,
        driverId,
        status: 'arrived',
        paymentMethod: 'cod',
        totalAmount: 50
      });

      // Fire 3 concurrent delivery status requests
      const [res1, res2, res3] = await Promise.all([
        request(app).post(`/api/deliveries/${deliveryId}/status`).set('Authorization', OWNER_TOKEN).send({ status: 'delivered' }),
        request(app).post(`/api/deliveries/${deliveryId}/status`).set('Authorization', OWNER_TOKEN).send({ status: 'delivered' }),
        request(app).post(`/api/deliveries/${deliveryId}/status`).set('Authorization', OWNER_TOKEN).send({ status: 'delivered' })
      ]);

      expect([res1.status, res2.status, res3.status]).toContain(200);

      // Verify ONLY ONE settlement occurred
      const drvSnap = (await db.collection('drivers').doc(driverId).get()).data();
      expect(drvSnap?.currentCashBalance).toBe(50); // Exactly 50, NOT 100 or 150

      const regSnap = (await db.collection('cash_registers').doc(registerId).get()).data();
      expect(regSnap?.expectedClosingBalance).toBe(550); // Exactly 550, NOT 600 or 650

      const jnlSnap = await db.collection('journal_entries').where('source', '==', 'Delivery').get();
      expect(jnlSnap.docs.length).toBe(1); // Exactly 1 journal entry
    });
  });

  describe('5. RATE LIMITER MEMORY & EVICTION', () => {
    it('evicts expired entries and keeps map strictly bounded', () => {
      rateState.clear();
      const now = Date.now();

      // Add expired entries
      rateState.set('expired_ip_1:GET', { count: 5, resetAt: now - 5000 });
      rateState.set('expired_ip_2:POST', { count: 10, resetAt: now - 1000 });
      // Add active entry
      rateState.set('active_ip:GET', { count: 2, resetAt: now + 60000 });

      expect(rateState.size).toBe(3);

      // Run cleanup
      cleanupRateState(now);

      expect(rateState.has('expired_ip_1:GET')).toBe(false);
      expect(rateState.has('expired_ip_2:POST')).toBe(false);
      expect(rateState.has('active_ip:GET')).toBe(true);
      expect(rateState.size).toBe(1);

      // Test maximum capacity bounding
      for (let i = 0; i < RATE_LIMIT_MAX_ENTRIES + 200; i++) {
        rateState.set(`flood_ip_${i}:GET`, { count: 1, resetAt: now + 60000 });
      }

      cleanupRateState(now);
      expect(rateState.size).toBeLessThanOrEqual(RATE_LIMIT_MAX_ENTRIES);
    });
  });

  describe('6. PAYROLL REPORT DYNAMIC STATUS', () => {
    const mockEmployee: Employee = {
      id: 'emp_aud_1',
      employeeId: 'EMP-AUD-1',
      fullName: 'Sahra Hassan',
      name: 'Sahra Hassan',
      role: 'Chef',
      salary: 800,
      payFrequency: 'monthly',
      status: 'Active',
      department: 'Bakery',
      phone: '+252615999001',
      email: 'sahra@example.com',
      nationalIdOrPassport: 'NID-999',
      address: 'Mogadishu',
      dateOfBirth: '1992-05-15',
      gender: 'Female',
      hireDate: '2025-01-01',
      employmentType: 'Full-time'
    } as any;

    const currentPeriod = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    it('returns PAID when salary payment equals or exceeds monthly salary', () => {
      const salaries: SalaryPayment[] = [{
        id: 'sal_full',
        employeeId: 'emp_aud_1',
        employeeName: 'Sahra Hassan',
        amount: 800,
        period: currentPeriod,
        status: 'paid',
        paidDate: '2026-07-01'
      }];
      expect(getEmployeePayrollStatus(mockEmployee, salaries, currentPeriod)).toBe('PAID');
    });

    it('returns PARTIAL when salary payment is less than monthly salary', () => {
      const salaries: SalaryPayment[] = [{
        id: 'sal_part',
        employeeId: 'emp_aud_1',
        employeeName: 'Sahra Hassan',
        amount: 350,
        period: currentPeriod,
        status: 'paid',
        paidDate: '2026-07-01'
      }];
      expect(getEmployeePayrollStatus(mockEmployee, salaries, currentPeriod)).toBe('PARTIAL');
    });

    it('returns UNPAID when no payment records exist or status is pending', () => {
      expect(getEmployeePayrollStatus(mockEmployee, [], currentPeriod)).toBe('UNPAID');

      const pendingSalaries: SalaryPayment[] = [{
        id: 'sal_pend',
        employeeId: 'emp_aud_1',
        employeeName: 'Sahra Hassan',
        amount: 800,
        period: currentPeriod,
        status: 'pending',
        paidDate: ''
      }];
      expect(getEmployeePayrollStatus(mockEmployee, pendingSalaries, currentPeriod)).toBe('UNPAID');
    });
  });
});
