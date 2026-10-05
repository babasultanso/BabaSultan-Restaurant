import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { getAdminDb } from '../server/trustedFinancialBackend.js';

describe('ERP GAP CLOSURE VERIFICATION SUITE', () => {
  const db = getAdminDb();

  beforeEach(async () => {
    await db.collection('branches').doc('branch_a').set({ id: 'branch_a', name: 'Branch A' });
    await db.collection('branches').doc('branch_b').set({ id: 'branch_b', name: 'Branch B' });
  });

  it('1. Accounting Period Management: creates, closes, blocks postings in closed period, and reopens period', async () => {
    const createRes = await request(app)
      .post('/api/accounting/periods')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `period-create-${Date.now()}`)
      .send({
        periodData: {
          name: 'FY 2024 Q1 Archive',
          startDate: '2024-01-01',
          endDate: '2024-03-31',
          status: 'Closed',
          branchId: 'branch_a',
          notes: 'Quarter 1 closed for audit'
        }
      });

    expect(createRes.status).toBe(200);
    expect(createRes.body.period.status).toBe('Closed');
    const periodId = createRes.body.period.id;

    // Verify GET /api/accounting/periods returns the period
    const listRes = await request(app)
      .get('/api/accounting/periods?branchId=branch_a')
      .set('Authorization', 'Bearer test_token_owner');
    expect(listRes.status).toBe(200);
    expect(listRes.body.periods.some((p: any) => p.id === periodId)).toBe(true);

    // Attempt to post a manual journal entry inside the closed period (2024-02-15) -> should be rejected
    const jeRes = await request(app)
      .post('/api/accounting/journal-entries')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `je-closed-period-${Date.now()}`)
      .send({
        date: '2024-02-15',
        reference: 'JE-CLOSED-TEST',
        description: 'Test posting in closed period',
        source: 'Manual',
        status: 'Posted',
        totalDebit: 100,
        totalCredit: 100,
        branchId: 'branch_a',
        lines: [
          { accountId: 'acc_cash', accountCode: '1010', accountName: 'Cash', debit: 100, credit: 0 },
          { accountId: 'acc_sales', accountCode: '4010', accountName: 'Sales', debit: 0, credit: 100 }
        ]
      });
    expect(jeRes.status).toBeGreaterThanOrEqual(400);
    expect(jeRes.body.error).toMatch(/closed|locked/i);

    // Reopen the period
    const reopenRes = await request(app)
      .post(`/api/accounting/periods/${periodId}/status`)
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `period-reopen-${Date.now()}`)
      .send({ status: 'Open' });
    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.period.status).toBe('Open');
  });

  it('2. Purchase Returns & Vendor Debit Notes: deducts stock, reduces AP & supplier balance, and posts GL entry', async () => {
    await db.collection('suppliers').doc('sup_ret_1').set({
      id: 'sup_ret_1',
      companyName: 'Mogadishu Fresh Foods',
      outstandingBalance: 500,
      pendingAmount: 500,
      branchId: 'branch_a'
    });

    await db.collection('inventory').doc('inv_ret_1').set({
      id: 'inv_ret_1',
      itemName: 'Basmati Rice 25kg',
      itemCode: 'ING-RICE-25',
      currentQuantity: 20,
      minimumQuantity: 5,
      unit: 'bag',
      costPrice: 30,
      purchaseCost: 30,
      branchId: 'branch_a',
      status: 'in_stock'
    });

    await db.collection('payables').doc('ap_ret_1').set({
      id: 'ap_ret_1',
      billNumber: 'BILL-RET-1',
      vendorName: 'Mogadishu Fresh Foods',
      supplierId: 'sup_ret_1',
      totalAmount: 500,
      paidAmount: 0,
      remainingBalance: 500,
      status: 'Unpaid',
      branchId: 'branch_a',
      date: '2026-10-01',
      createdAt: new Date().toISOString()
    });

    const retRes = await request(app)
      .post('/api/purchases/returns')
      .set('Authorization', 'Bearer test_token_manager_branch_a')
      .set('Idempotency-Key', `pret-test-${Date.now()}`)
      .send({
        returnData: {
          itemId: 'inv_ret_1',
          supplierId: 'sup_ret_1',
          quantity: 4,
          unitCost: 30,
          reason: 'Damaged bags on delivery',
          branchId: 'branch_a'
        }
      });

    expect(retRes.status).toBe(200);
    expect(retRes.body.newStock).toBe(16);
    expect(retRes.body.purchaseReturn.totalCost).toBe(120);

    // Check supplier balance reduced by $120 (from 500 to 380)
    const supSnap = await db.collection('suppliers').doc('sup_ret_1').get();
    expect(supSnap.data()?.outstandingBalance).toBe(380);

    // Check AP bill creditNoteAmount recorded $120 and remainingBalance reduced to $380
    const apSnap = await db.collection('payables').doc('ap_ret_1').get();
    expect(apSnap.data()?.creditNoteAmount).toBe(120);
    expect(apSnap.data()?.remainingBalance).toBe(380);
    expect(apSnap.data()?.status).toBe('Partial');

    // Verify GET /api/purchases/returns lists the return
    const listRet = await request(app)
      .get('/api/purchases/returns?branchId=branch_a')
      .set('Authorization', 'Bearer test_token_manager_branch_a');
    expect(listRet.status).toBe(200);
    expect(listRet.body.purchaseReturns.some((r: any) => r.id === retRes.body.id)).toBe(true);
  });

  it('3. Physical Stock Count: creates authoritative stock count and applies inventory reconciliation', async () => {
    await db.collection('ingredients').doc('ing_sc_1').set({
      id: 'ing_sc_1',
      name: 'Olive Oil Extra Virgin',
      code: 'ING-OIL-01',
      usageUnit: 'L',
      currentStockUsageUnit: 10,
      stock: 10,
      minStockUsageUnit: 2,
      costPerUsageUnit: 12,
      branchId: 'branch_a',
      status: 'available'
    });

    const createScRes = await request(app)
      .post('/api/inventory/stock-count')
      .set('Authorization', 'Bearer test_token_manager_branch_a')
      .set('Idempotency-Key', `sc-create-${Date.now()}`)
      .send({
        stockCountData: {
          branchId: 'branch_a',
          status: 'completed',
          notes: 'End of month kitchen audit',
          items: [
            {
              ingredientId: 'ing_sc_1',
              ingredientName: 'Olive Oil Extra Virgin',
              unit: 'L',
              expectedQuantity: 10,
              actualQuantity: 8,
              costPerUnit: 12
            }
          ]
        }
      });

    expect(createScRes.status).toBe(200);
    const scId = createScRes.body.id;
    expect(createScRes.body.stockCount.totalDiscrepancyValue).toBe(24);

    // Apply the stock count adjustment
    const applyRes = await request(app)
      .post('/api/inventory/stock-count/apply')
      .set('Authorization', 'Bearer test_token_manager_branch_a')
      .set('Idempotency-Key', `sc-apply-${Date.now()}`)
      .send({
        stockCountId: scId,
        user: 'Branch A Manager'
      });

    expect(applyRes.status).toBe(200);

    const ingAfter = await db.collection('ingredients').doc('ing_sc_1').get();
    expect(ingAfter.data()?.currentStockUsageUnit).toBe(8);
  });

  it('4. Table Reservations: creates booking, prevents overlapping time-slot conflict (409), and updates status', async () => {
    const res1 = await request(app)
      .post('/api/reservations')
      .set('Authorization', 'Bearer test_token_manager_branch_a')
      .set('Idempotency-Key', `res-1-${Date.now()}`)
      .send({
        reservationData: {
          customerName: 'Amina Hassan',
          customerPhone: '+252615550101',
          tableNumber: 4,
          partySize: 4,
          reservationDate: '2026-10-15',
          reservationTime: '19:00',
          durationMinutes: 90,
          branchId: 'branch_a'
        }
      });

    expect(res1.status).toBe(200);
    const resId = res1.body.id;

    // Attempt overlapping reservation on Table 4 at 19:30 on same date -> must return 409 Conflict
    const resConflict = await request(app)
      .post('/api/reservations')
      .set('Authorization', 'Bearer test_token_manager_branch_a')
      .set('Idempotency-Key', `res-conflict-${Date.now()}`)
      .send({
        reservationData: {
          customerName: 'Double Booker',
          customerPhone: '+252615550999',
          tableNumber: 4,
          partySize: 2,
          reservationDate: '2026-10-15',
          reservationTime: '19:30',
          durationMinutes: 60,
          branchId: 'branch_a'
        }
      });

    expect(resConflict.status).toBe(409);
    expect(resConflict.body.error).toMatch(/already reserved/i);

    // Seat the guest
    const seatRes = await request(app)
      .post(`/api/reservations/${resId}/status`)
      .set('Authorization', 'Bearer test_token_manager_branch_a')
      .set('Idempotency-Key', `res-seat-${Date.now()}`)
      .send({ status: 'seated' });

    expect(seatRes.status).toBe(200);
    expect(seatRes.body.reservation.status).toBe('seated');
  });

  it('5. Enterprise Audit Logs: returns branch-scoped audit trail entries', async () => {
    const logsRes = await request(app)
      .get('/api/audit/logs?branchId=branch_a')
      .set('Authorization', 'Bearer test_token_manager_branch_a');

    expect(logsRes.status).toBe(200);
    expect(Array.isArray(logsRes.body.logs)).toBe(true);
    expect(logsRes.body.logs.length).toBeGreaterThan(0);
  });
});
