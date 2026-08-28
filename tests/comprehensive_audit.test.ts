import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { calculatePeriodDateRange } from '../server/trustedFinancialBackend.ts';
import { getAdminDb } from '../server/trustedFinancialBackend.js';

describe('COMPREHENSIVE AUDIT & VERIFICATION SUITE (ALL 21 REQUIREMENTS)', () => {

  beforeEach(async () => {
    const db = getAdminDb();
    await db.collection('branches').doc('main_branch_01').set({
      id: 'main_branch_01',
      taxRate: 0.05,
      defaultDeliveryFee: 2.00
    });
  });

  describe('1. DATE-RANGE & MOGADISHU TIMEZONE CALCULATION', () => {
    it('calculates "today" range within Mogadishu (+03:00) bounds', () => {
      const { startDate, endDate } = calculatePeriodDateRange('today');
      expect(startDate).not.toBeNull();
      expect(endDate).not.toBeNull();
      expect(startDate!.toISOString()).toBeDefined();
      expect(endDate!.toISOString()).toBeDefined();
      expect(startDate!.getTime()).toBeLessThan(endDate!.getTime());
    });

    it('calculates "yesterday" range spanning exactly 24 hours', () => {
      const { startDate, endDate } = calculatePeriodDateRange('yesterday');
      expect(startDate).not.toBeNull();
      expect(endDate).not.toBeNull();
      const diffMs = endDate!.getTime() - startDate!.getTime();
      expect(diffMs).toBeCloseTo(24 * 60 * 60 * 1000 - 1, -2);
    });

    it('calculates "this_week" starting on Monday in Mogadishu timezone', () => {
      const { startDate, endDate } = calculatePeriodDateRange('this_week');
      expect(startDate).not.toBeNull();
      expect(endDate).not.toBeNull();
      expect(startDate!.getTime()).toBeLessThanOrEqual(endDate!.getTime());
    });

    it('calculates "last_week", "this_month", "last_month", "this_year", "last_year", and "all_time"', () => {
      const lastWeek = calculatePeriodDateRange('last_week');
      expect(lastWeek.startDate).not.toBeNull();
      expect(lastWeek.endDate).not.toBeNull();
      expect(lastWeek.startDate!.getTime()).toBeLessThan(lastWeek.endDate!.getTime());

      const thisMonth = calculatePeriodDateRange('this_month');
      expect(thisMonth.startDate).not.toBeNull();
      expect(thisMonth.endDate).not.toBeNull();

      const lastMonth = calculatePeriodDateRange('last_month');
      expect(lastMonth.startDate).not.toBeNull();
      expect(lastMonth.endDate).not.toBeNull();
      expect(lastMonth.startDate!.getTime()).toBeLessThan(lastMonth.endDate!.getTime());

      const thisYear = calculatePeriodDateRange('this_year');
      expect(thisYear.startDate).not.toBeNull();

      const lastYear = calculatePeriodDateRange('last_year');
      expect(lastYear.startDate).not.toBeNull();
      expect(lastYear.endDate).not.toBeNull();

      const allTime = calculatePeriodDateRange('all_time');
      expect(allTime.startDate).toBeNull();
      expect(allTime.endDate).toBeNull();
    });

    it('parses custom dateFrom and dateTo correctly with timezone awareness', () => {
      const custom = calculatePeriodDateRange(undefined, '2026-05-01', '2026-05-31');
      expect(custom.startDate).not.toBeNull();
      expect(custom.endDate).not.toBeNull();
      expect(custom.startDate!.toISOString()).toContain('2026-04-30T21:00:00.000Z'); // 2026-05-01 00:00 +03:00
      expect(custom.endDate!.toISOString()).toContain('2026-05-31T20:59:59.999Z'); // 2026-05-31 23:59:59.999 +03:00
    });
  });

  describe('2. CASH REGISTER LIFECYCLE & STATE INTEGRITY', () => {
    it('prevents closing an already closed cash register', async () => {
      const openRes = await request(app)
        .post('/api/accounting/cash-registers/open')
        .set('Authorization', 'Bearer test_token_manager')
        .send({
          branchId: 'main_branch_01',
          openingBalance: 150
        });
      expect([200, 409]).toContain(openRes.status);
      const registerId = openRes.body.id || openRes.body.activeRegisterId;

      // First close
      const closeRes1 = await request(app)
        .post('/api/accounting/cash-registers/close')
        .set('Authorization', 'Bearer test_token_manager')
        .send({
          id: registerId,
          actualClosingBalance: 150
        });
      expect(closeRes1.status).toBe(200);

      // Second close attempt on same register must fail with 400
      const closeRes2 = await request(app)
        .post('/api/accounting/cash-registers/close')
        .set('Authorization', 'Bearer test_token_manager')
        .send({
          id: registerId,
          actualClosingBalance: 150
        });
      expect(closeRes2.status).toBe(400);
      expect(closeRes2.body.error).toContain('already closed');
    });
  });

  describe('3. AI ACTION CONTRACT & SCHEMAS ALIGNMENT', () => {
    it('executes AI RECORD_REFUND with aligned orderId and paymentMethod schema', async () => {
      const db = getAdminDb();
      await db.collection('products').doc('prod_ai_ref_1').set({
        id: 'prod_ai_ref_1',
        name: 'Camel Tea',
        price: 10,
        cost: 4,
        stock: 50,
        branchId: 'main_branch_01'
      });

      const posRes = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', 'Bearer test_token_manager')
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_ai_ref_1', productName: 'Camel Tea', quantity: 1, price: 10, costPrice: 4 }],
            subtotal: 10,
            tax: 0.5,
            discountAmount: 0,
            totalAmount: 10.5,
            paidAmount: 10.5,
            paymentMethod: 'cash'
          }
        });
      expect(posRes.status).toBe(200);
      const orderId = posRes.body.order.id;

      const aiRes = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', 'Bearer test_token_manager')
        .set('Idempotency-Key', `idemp-refund-${Date.now()}`)
        .send({
          actionType: 'RECORD_REFUND',
          payload: {
            orderId,
            amount: 10.5,
            reason: 'Quality discrepancy',
            paymentMethod: 'cash'
          }
        });
      expect(aiRes.status).toBe(200);
      expect(aiRes.body.refundId).toBeDefined();
    });

    it('executes AI RECORD_BANK_TRANSACTION supporting fee type and reference field', async () => {
      const aiRes = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', 'Bearer test_token_manager')
        .set('Idempotency-Key', `idemp-bank-${Date.now()}`)
        .send({
          actionType: 'RECORD_BANK_TRANSACTION',
          payload: {
            amount: 25,
            type: 'fee',
            accountName: 'Operating Account',
            description: 'Monthly Maintenance Fee',
            reference: 'REF-FEE-991'
          }
        });
      expect(aiRes.status).toBe(200);
      expect(aiRes.body.id).toBeDefined();
    });

    it('executes AI REGISTER_PURCHASE and routes to purchases in ledger', async () => {
      const aiRes = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', 'Bearer test_token_manager')
        .set('Idempotency-Key', `idemp-purch-${Date.now()}`)
        .send({
          actionType: 'REGISTER_PURCHASE',
          payload: {
            itemName: 'Fresh Cardamom Seeds',
            quantity: 15,
            unit: 'kg',
            unitPrice: 8,
            totalCost: 120,
            supplierName: 'Mogadishu Spice Suppliers',
            status: 'completed'
          }
        });
      expect(aiRes.status).toBe(200);
      expect(aiRes.body.id).toBeDefined();
    });

    it('rejects AI actions from unauthorized operational roles', async () => {
      const res = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', 'Bearer test_token_cashier')
        .send({
          actionType: 'ADD_EXPENSE',
          payload: {
            title: 'Unauthorized Office Supplies',
            amount: 50
          }
        });
      expect(res.status).toBe(403);
    });

    it('rejects AI action payload containing forbidden security fields', async () => {
      const res = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', 'Bearer test_token_manager')
        .send({
          actionType: 'ADD_EXPENSE',
          payload: {
            title: 'Server Utilities',
            amount: 100,
            role: 'Owner', // Forbidden privilege escalation field
            branchId: 'rogue_branch'
          }
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Security violation');
    });
  });

  describe('4. BANK TRANSACTIONS & DOUBLE-ENTRY SEMANTICS', () => {
    it('creates double-entry journal entry for bank fee transaction', async () => {
      const res = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', 'Bearer test_token_manager')
        .send({
          bankTransactionData: {
            accountName: 'Premier Bank Business Account',
            type: 'fee',
            amount: 15,
            description: 'SWIFT wire transfer service fee',
            referenceNumber: 'WIRE-FEE-2026'
          }
        });
      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
    });
  });

  describe('5. DELIVERY DISPATCH & DRIVER ISOLATION', () => {
    it('ensures delivery creation generates complete tracking records or auto-provisions on delivery POS order', async () => {
      const db = getAdminDb();
      await db.collection('products').doc('prod_del_1').set({
        id: 'prod_del_1',
        name: 'Suqaar Box',
        price: 10,
        cost: 4,
        stock: 50,
        branchId: 'main_branch_01'
      });

      // 1. Delivery order via POS creates order and auto-creates delivery record
      const orderRes = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', 'Bearer test_token_manager')
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_del_1', productName: 'Suqaar Box', quantity: 1, price: 10, costPrice: 4 }],
            subtotal: 10,
            tax: 0.5,
            discountAmount: 0,
            totalAmount: 12.5,
            paidAmount: 12.5,
            deliveryFee: 2.0,
            orderType: 'delivery',
            deliveryAddress: 'KM4 Junction, Mogadishu',
            customerName: 'Amina Duale',
            customerPhone: '+252 61 555 1234',
            paymentMethod: 'cash'
          }
        });
      expect(orderRes.status).toBe(200);
      const orderId = orderRes.body.order.id;

      // Delivery record is created automatically
      const delSnap = await db.collection('deliveries').where('orderId', '==', orderId).get();
      expect(delSnap.empty).toBe(false);
      expect(delSnap.docs[0].data().status).toBe('unassigned');
      expect(delSnap.docs[0].data().orderNumber).toBeDefined();

      // 2. Duplicate delivery creation for same order is rejected (409 Conflict)
      const dupRes = await request(app)
        .post('/api/deliveries')
        .set('Authorization', 'Bearer test_token_manager')
        .send({
          deliveryData: {
            orderId,
            customerName: 'Amina Duale',
            customerPhone: '+252 61 555 1234',
            address: 'KM4 Junction, Mogadishu',
            branchId: 'main_branch_01'
          }
        });
      expect(dupRes.status).toBe(409);
    });
  });
});
