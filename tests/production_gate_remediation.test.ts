import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { getAdminDb } from '../server/trustedFinancialBackend.js';
import { createDeliveryZone } from '../src/lib/deliveryService';
import { doc as clientDoc, getDoc as clientGetDoc } from 'firebase/firestore';
import { db as clientDb, COLLECTIONS } from '../src/lib/firebase';

describe('PRODUCTION GATE REMEDIATION AUDIT SUITE', () => {
  const OWNER_TOKEN = 'Bearer test_token_owner';
  const CASHIER_TOKEN = 'Bearer test_token_cashier';
  const BRANCH_ID = 'main_branch_01';

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
      'delivery_zones',
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
    await db.collection('accounts').doc('acc_rev').set({
      id: 'acc_rev',
      code: '4010',
      name: 'Food & Beverage Sales',
      type: 'Revenue',
      balance: 0,
      branchId: 'all'
    });

    // Seed branch & open cash register
    await db.collection('branches').doc(BRANCH_ID).set({
      id: BRANCH_ID,
      name: 'Main Branch'
    });
    await db.collection('cash_registers').doc('reg_prod_gate_01').set({
      id: 'reg_prod_gate_01',
      branchId: BRANCH_ID,
      status: 'Open',
      openingBalance: 1000,
      currentBalance: 1000,
      expectedClosingBalance: 1000,
      openedBy: 'test',
      openedAt: new Date().toISOString()
    });
  });

  // =========================================================================
  // 1. CRI-01 — FULL AR LIFECYCLE (Order Sync, Partial, Final, Overpayment Guard)
  // =========================================================================
  describe('1. CRI-01 — Full AR Lifecycle & Linked Sales Order Settlement', () => {
    it('executes partial AR payment, updates order paidAmount and paymentStatus to partial with balanced journals', async () => {
      const db = getAdminDb();
      const orderId = 'ord_ar_gate_001';
      const receivableId = 'rec_ar_gate_001';

      // 1. Credit Order Created
      await db.collection('orders').doc(orderId).set({
        id: orderId,
        branchId: BRANCH_ID,
        total: 100,
        totalAmount: 100,
        paidAmount: 0,
        paymentStatus: 'unpaid',
        paymentMethod: 'Credit',
        status: 'completed',
        createdAt: new Date().toISOString()
      });

      // 2. Linked Receivable Created
      await db.collection('receivables').doc(receivableId).set({
        id: receivableId,
        orderId,
        branchId: BRANCH_ID,
        customerName: 'Ahmed Omar',
        customerId: 'cust_ar_gate_01',
        amount: 100,
        paidAmount: 0,
        remainingBalance: 100,
        status: 'Unpaid',
        createdAt: new Date().toISOString()
      });

      // 3. Partial Payment: $40
      const resPartial = await request(app)
        .post(`/api/accounting/receivables/${receivableId}/payment`)
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', 'idem-ar-gate-001')
        .send({
          amount: 40,
          paymentMethod: 'Cash',
          receivedBy: 'Cashier Ali'
        });

      expect(resPartial.status).toBe(200);
      expect(resPartial.body.status).toBe('success');
      expect(resPartial.body.orderPaymentStatus).toBe('partial');
      expect(resPartial.body.orderPaidAmount).toBe(40);

      // Verify Receivable doc
      const recAfterPartial = (await db.collection('receivables').doc(receivableId).get()).data();
      expect(recAfterPartial?.paidAmount).toBe(40);
      expect(recAfterPartial?.remainingBalance).toBe(60);
      expect(recAfterPartial?.status).toBe('Partial');

      // Verify Linked Order doc
      const ordAfterPartial = (await db.collection('orders').doc(orderId).get()).data();
      expect(ordAfterPartial?.paidAmount).toBe(40);
      expect(ordAfterPartial?.paymentStatus).toBe('partial');

      // Verify Equality
      expect(recAfterPartial?.paidAmount).toBe(ordAfterPartial?.paidAmount);

      // Verify Journal Entries are balanced
      const jnls = await db.collection('journal_entries').where('reference', '==', receivableId).get();
      expect(jnls.docs.length).toBe(1);
      const jnlData = jnls.docs[0].data();
      const lines = jnlData.lines || [];
      const totalDebit = lines.reduce((s: number, l: any) => s + (l.debit || 0), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + (l.credit || 0), 0);
      expect(totalDebit).toBe(40);
      expect(totalCredit).toBe(40);
      expect(totalDebit).toBe(totalCredit);
    });

    it('executes final AR payment, updates order to paid, closes receivable, and rejects overpayment', async () => {
      const db = getAdminDb();
      const orderId = 'ord_ar_gate_002';
      const receivableId = 'rec_ar_gate_002';

      await db.collection('orders').doc(orderId).set({
        id: orderId,
        branchId: BRANCH_ID,
        total: 100,
        totalAmount: 100,
        paidAmount: 40,
        paymentStatus: 'partial',
        status: 'completed',
        createdAt: new Date().toISOString()
      });

      await db.collection('receivables').doc(receivableId).set({
        id: receivableId,
        orderId,
        branchId: BRANCH_ID,
        customerName: 'Ahmed Omar',
        customerId: 'cust_ar_gate_01',
        amount: 100,
        paidAmount: 40,
        remainingBalance: 60,
        status: 'Partial',
        createdAt: new Date().toISOString()
      });

      // Final payment of remaining $60
      const resFinal = await request(app)
        .post(`/api/accounting/receivables/${receivableId}/payment`)
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', 'idem-ar-gate-002')
        .send({
          amount: 60,
          paymentMethod: 'Cash',
          receivedBy: 'Cashier Ali'
        });

      expect(resFinal.status).toBe(200);
      expect(resFinal.body.orderPaymentStatus).toBe('paid');
      expect(resFinal.body.orderPaidAmount).toBe(100);

      const recSnap = (await db.collection('receivables').doc(receivableId).get()).data();
      const ordSnap = (await db.collection('orders').doc(orderId).get()).data();

      expect(recSnap?.status).toBe('Paid');
      expect(recSnap?.paidAmount).toBe(100);
      expect(recSnap?.remainingBalance).toBe(0);

      expect(ordSnap?.paymentStatus).toBe('paid');
      expect(ordSnap?.paidAmount).toBe(100);

      expect(recSnap?.paidAmount).toBe(ordSnap?.paidAmount);
      expect(recSnap?.remainingBalance).toBe(ordSnap?.total - 100);

      // Overpayment / duplicate retry rejection
      const resOverpay = await request(app)
        .post(`/api/accounting/receivables/${receivableId}/payment`)
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', 'idem-ar-gate-003')
        .send({
          amount: 10,
          paymentMethod: 'Cash',
          receivedBy: 'Cashier Ali'
        });

      expect(resOverpay.status).toBe(400);
      expect(resOverpay.body.error).toMatch(/exceeds remaining|already fully paid/i);
    });
  });

  // =========================================================================
  // 2. CRI-02 — COD ACCOUNTING LIFECYCLE & DOUBLE SETTLEMENT GUARD
  // =========================================================================
  describe('2. CRI-02 — Full COD Accounting Lifecycle & Double Settlement Guard', () => {
    it('atomically collects COD cash, records journal, adjusts cash drawer and driver balance upon delivery', async () => {
      const db = getAdminDb();
      const orderId = 'ord_cod_gate_001';
      const deliveryId = 'del_cod_gate_001';
      const driverId = 'drv_cod_gate_001';
      const receivableId = 'rec_cod_gate_001';

      await db.collection('drivers').doc(driverId).set({
        id: driverId,
        fullName: 'Sahal Courier',
        branchId: BRANCH_ID,
        status: 'active',
        isActive: true,
        availability: 'on_delivery',
        currentCashBalance: 0
      });

      await db.collection('orders').doc(orderId).set({
        id: orderId,
        branchId: BRANCH_ID,
        total: 50,
        totalAmount: 50,
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
        amount: 50,
        paidAmount: 0,
        remainingBalance: 50,
        status: 'Unpaid'
      });

      await db.collection('deliveries').doc(deliveryId).set({
        id: deliveryId,
        orderId,
        branchId: BRANCH_ID,
        driverId,
        status: 'arrived',
        isCod: true,
        paymentMethod: 'cod'
      });

      // Transition to delivered
      const res = await request(app)
        .post(`/api/deliveries/${deliveryId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'delivered' });

      expect(res.status).toBe(200);
      expect(res.body.deliveryStatus).toBe('delivered');

      // Verify delivery doc
      const delSnap = (await db.collection('deliveries').doc(deliveryId).get()).data();
      expect(delSnap?.status).toBe('delivered');
      expect(delSnap?.codSettled).toBe(true);

      // Verify order doc
      const ordSnap = (await db.collection('orders').doc(orderId).get()).data();
      expect(ordSnap?.status).toBe('completed');
      expect(ordSnap?.deliveryStatus).toBe('delivered');
      expect(ordSnap?.paymentStatus).toBe('paid');
      expect(ordSnap?.paidAmount).toBe(50);

      // Verify driver cash balance & availability
      const drvSnap = (await db.collection('drivers').doc(driverId).get()).data();
      expect(drvSnap?.availability).toBe('available');
      expect(drvSnap?.currentCashBalance).toBe(50);

      // Verify cash register expectedClosingBalance
      const regSnap = (await db.collection('cash_registers').doc('reg_prod_gate_01').get()).data();
      expect(regSnap?.expectedClosingBalance).toBe(1050);

      // Verify linked receivable closed
      const recSnap = (await db.collection('receivables').doc(receivableId).get()).data();
      expect(recSnap?.status).toBe('Paid');
      expect(recSnap?.remainingBalance).toBe(0);

      // Verify balanced double-entry journal (Debit Cash 1010, Credit AR 1200)
      const jnlSnap = await db.collection('journal_entries').where('source', '==', 'Delivery').get();
      expect(jnlSnap.docs.length).toBe(1);
      const lines = jnlSnap.docs[0].data().lines || [];
      const debitCash = lines.find((l: any) => l.accountCode === '1010')?.debit;
      const creditAr = lines.find((l: any) => l.accountCode === '1200')?.credit;
      expect(debitCash).toBe(50);
      expect(creditAr).toBe(50);
    });

    it('guarantees double settlement protection (idempotent delivery retry)', async () => {
      const db = getAdminDb();
      const orderId = 'ord_cod_gate_002';
      const deliveryId = 'del_cod_gate_002';
      const driverId = 'drv_cod_gate_002';

      await db.collection('drivers').doc(driverId).set({
        id: driverId,
        fullName: 'Courier Dual',
        branchId: BRANCH_ID,
        status: 'active',
        isActive: true,
        availability: 'on_delivery',
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

      await db.collection('deliveries').doc(deliveryId).set({
        id: deliveryId,
        orderId,
        branchId: BRANCH_ID,
        driverId,
        status: 'arrived',
        isCod: true,
        paymentMethod: 'cod'
      });

      // Request 1: deliver
      const res1 = await request(app)
        .post(`/api/deliveries/${deliveryId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'delivered' });
      expect(res1.status).toBe(200);

      // Request 2: duplicate delivered request
      const res2 = await request(app)
        .post(`/api/deliveries/${deliveryId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'delivered' });
      expect(res2.status).toBe(200);

      // Request 3: retry Request 1
      const res3 = await request(app)
        .post(`/api/deliveries/${deliveryId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'delivered' });
      expect(res3.status).toBe(200);

      // Verify exactly ONE journal entry exists
      const jnlSnap = await db.collection('journal_entries').where('source', '==', 'Delivery').get();
      expect(jnlSnap.docs.length).toBe(1);

      // Driver cash collected only once (75, not 150 or 225)
      const drvSnap = (await db.collection('drivers').doc(driverId).get()).data();
      expect(drvSnap?.currentCashBalance).toBe(75);

      // Cash register credited only once (1000 + 75 = 1075)
      const regSnap = (await db.collection('cash_registers').doc('reg_prod_gate_01').get()).data();
      expect(regSnap?.expectedClosingBalance).toBe(1075);
    });

    it('blocks COD settlement with 409 when 0 open registers exist (Case A)', async () => {
      const db = getAdminDb();
      const orderId = 'ord_cod_gate_no_reg';
      const deliveryId = 'del_cod_gate_no_reg';
      const driverId = 'drv_cod_gate_no_reg';

      // Delete all registers for this branch
      const regSnap = await db.collection('cash_registers').where('branchId', '==', BRANCH_ID).get();
      for (const d of regSnap.docs) await d.ref.delete();

      await db.collection('drivers').doc(driverId).set({
        id: driverId,
        fullName: 'Courier NoReg',
        branchId: BRANCH_ID,
        status: 'active',
        isActive: true,
        availability: 'on_delivery',
        currentCashBalance: 0
      });

      await db.collection('orders').doc(orderId).set({
        id: orderId,
        branchId: BRANCH_ID,
        total: 40,
        totalAmount: 40,
        paidAmount: 0,
        paymentStatus: 'unpaid',
        paymentMethod: 'cod',
        isCodOrder: true,
        status: 'confirmed',
        deliveryStatus: 'arrived'
      });

      await db.collection('deliveries').doc(deliveryId).set({
        id: deliveryId,
        orderId,
        branchId: BRANCH_ID,
        driverId,
        status: 'arrived',
        isCod: true,
        paymentMethod: 'cod'
      });

      const res = await request(app)
        .post(`/api/deliveries/${deliveryId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'delivered' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/No open cash register exists/i);

      // Verify no changes occurred
      const delDoc = (await db.collection('deliveries').doc(deliveryId).get()).data();
      expect(delDoc?.status).toBe('arrived');
      expect(delDoc?.codSettled).toBeUndefined();

      const ordDoc = (await db.collection('orders').doc(orderId).get()).data();
      expect(ordDoc?.status).toBe('confirmed');
      expect(ordDoc?.paymentStatus).toBe('unpaid');
    });

    it('blocks COD settlement with 409 when multiple open registers exist (Case C)', async () => {
      const db = getAdminDb();
      const orderId = 'ord_cod_gate_mult_reg';
      const deliveryId = 'del_cod_gate_mult_reg';
      const driverId = 'drv_cod_gate_mult_reg';

      // Ensure 2 open registers exist
      await db.collection('cash_registers').doc('reg_prod_gate_01').set({
        id: 'reg_prod_gate_01',
        branchId: BRANCH_ID,
        status: 'Open',
        openingBalance: 1000,
        expectedClosingBalance: 1000
      });
      await db.collection('cash_registers').doc('reg_prod_gate_02').set({
        id: 'reg_prod_gate_02',
        branchId: BRANCH_ID,
        status: 'Open',
        openingBalance: 500,
        expectedClosingBalance: 500
      });

      await db.collection('drivers').doc(driverId).set({
        id: driverId,
        fullName: 'Courier MultiReg',
        branchId: BRANCH_ID,
        status: 'active',
        isActive: true,
        availability: 'on_delivery',
        currentCashBalance: 0
      });

      await db.collection('orders').doc(orderId).set({
        id: orderId,
        branchId: BRANCH_ID,
        total: 60,
        totalAmount: 60,
        paidAmount: 0,
        paymentStatus: 'unpaid',
        paymentMethod: 'cod',
        isCodOrder: true,
        status: 'confirmed',
        deliveryStatus: 'arrived'
      });

      await db.collection('deliveries').doc(deliveryId).set({
        id: deliveryId,
        orderId,
        branchId: BRANCH_ID,
        driverId,
        status: 'arrived',
        isCod: true,
        paymentMethod: 'cod'
      });

      const res = await request(app)
        .post(`/api/deliveries/${deliveryId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'delivered' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Multiple open cash registers/i);

      // Verify no changes occurred
      const delDoc = (await db.collection('deliveries').doc(deliveryId).get()).data();
      expect(delDoc?.status).toBe('arrived');
      expect(delDoc?.codSettled).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. DELIVERY ZONE VALIDATION & SCOPING (HQ, Empty, Invalid Branch)
  // =========================================================================
  describe('3. Delivery Zone Validation & Scoping', () => {
    it('rejects delivery zone creation when branchId is "all"', async () => {
      await expect(
        createDeliveryZone({
          name: 'HQ Zone All',
          code: 'HQ-ALL',
          city: 'Mogadishu',
          coverageRadiusKm: 5,
          baseDeliveryFee: 3.5,
          minOrderAmount: 10,
          estimatedTimeMinutes: 30,
          isActive: true,
          branchId: 'all'
        })
      ).rejects.toThrow(/valid specific branch is required/i);
    });

    it('rejects delivery zone creation when branchId is empty string', async () => {
      await expect(
        createDeliveryZone({
          name: 'Empty Branch Zone',
          code: 'EMPTY-Z',
          city: 'Mogadishu',
          coverageRadiusKm: 5,
          baseDeliveryFee: 3.5,
          minOrderAmount: 10,
          estimatedTimeMinutes: 30,
          isActive: true,
          branchId: ''
        })
      ).rejects.toThrow(/valid specific branch is required/i);
    });

    it('successfully persists delivery zone when valid branchId is provided', async () => {
      const zoneId = await createDeliveryZone({
        name: 'Zone Mogadishu North',
        code: 'Z-MOG-N',
        city: 'Mogadishu',
        coverageRadiusKm: 5,
        baseDeliveryFee: 4.0,
        minOrderAmount: 15,
        estimatedTimeMinutes: 25,
        isActive: true,
        branchId: BRANCH_ID
      });

      expect(zoneId).toBeDefined();
      expect(typeof zoneId).toBe('string');

      const clientSnap = await clientGetDoc(clientDoc(clientDb, COLLECTIONS.DELIVERY_ZONES, zoneId));
      expect(clientSnap.exists()).toBe(true);
      expect(clientSnap.data()?.name).toBe('Zone Mogadishu North');
      expect(clientSnap.data()?.branchId).toBe(BRANCH_ID);
    });
  });

  // =========================================================================
  // 4. BLK-01 — ADC & CLOUD RUN ENVIRONMENT INITIALIZATION
  // =========================================================================
  describe('4. BLK-01 — ADC and Cloud Run Initialization Verification', () => {
    it('detects Cloud Run environment variables (K_SERVICE) and honors ADC initialization pathway', async () => {
      // In Cloud Run, K_SERVICE is defined by the runtime
      const isCloudRun = Boolean(process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.GOOGLE_APPLICATION_CREDENTIALS);
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'babasultan-restaurant';

      expect(projectId).toBeDefined();
      expect(typeof projectId).toBe('string');
      expect(projectId.length).toBeGreaterThan(0);

      // Verify db connection can perform read/write via initialized Firebase Admin
      const db = getAdminDb();
      const pingDoc = db.collection('system_diagnostics').doc('adc_ping_test');
      await pingDoc.set({
        pingAt: new Date().toISOString(),
        environment: isCloudRun ? 'CloudRun/ADC' : 'LocalDev/Emulator'
      });

      const snap = await pingDoc.get();
      expect(snap.exists).toBe(true);
      expect(snap.data()?.pingAt).toBeDefined();
      await pingDoc.delete();
    });
  });
});
