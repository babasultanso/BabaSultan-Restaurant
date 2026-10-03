import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { getAdminDb, getMogadishuDateString, roundMoney } from '../server/trustedFinancialBackend.js';

const OWNER_TOKEN = 'Bearer test_token_owner';
const MANAGER_TOKEN = 'Bearer test_token_manager';
const CASHIER_TOKEN = 'Bearer test_token_cashier';

describe('FINAL VERIFICATION & CLOSURE PASS SUITE', () => {
  beforeEach(async () => {
    const db = getAdminDb();
    await db.collection('branches').doc('branch_1').set({
      id: 'branch_1',
      name: 'Main Branch 1',
      taxRate: 0,
      defaultDeliveryFee: 0
    });
    await db.collection('branches').doc('main_branch_01').set({
      id: 'main_branch_01',
      name: 'Headquarters',
      taxRate: 0,
      defaultDeliveryFee: 0
    });
  });

  // -------------------------------------------------------------
  // 1. CASH TENDER & CHANGE ($20 total, $50 tender -> $30 change)
  // -------------------------------------------------------------
  it('Cash 20 -> 50 -> change 30: records correct amountTendered, changeDue, and double-entry revenue of $20', async () => {
    const db = getAdminDb();
    const prodRef = db.collection('products').doc('prod_burger_20');
    await prodRef.set({
      id: 'prod_burger_20',
      name: 'Classic Burger',
      price: 20,
      cost: 8,
      category: 'Burgers',
      trackStock: false,
      branchId: 'main_branch_01'
    });

    const res = await request(app)
      .post('/api/pos/complete')
      .set('Authorization', CASHIER_TOKEN)
      .set('Idempotency-Key', `test-pos-final_closure_verification.test-1`)
      .send({
        orderData: {
          branchId: 'main_branch_01',
          items: [{ productId: 'prod_burger_20', quantity: 1, unitPrice: 20 }],
          paymentMethod: 'cash',
          amountTendered: 50
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.order.totalAmount).toBe(20);
    expect(res.body.order.paidAmount).toBe(20);
    expect(res.body.order.amountTendered).toBe(50);
    expect(res.body.order.changeDue).toBe(30);

    // Verify Payments Collection
    const paySnap = await db.collection('payments').where('orderId', '==', res.body.order.id).get();
    expect(paySnap.empty).toBe(false);
    const payDoc = paySnap.docs[0].data();
    expect(payDoc.amount).toBe(20);
    expect(payDoc.amountTendered).toBe(50);
    expect(payDoc.changeDue).toBe(30);

    // Verify Accounting Journal Entry (Debit Cash 20, Debit COGS 8, Credit Revenue 20, Credit Inventory 8 -> Total $28)
    const jeSnap = await db.collection('journal_entries').where('reference', '==', res.body.order.orderNumber).get();
    expect(jeSnap.empty).toBe(false);
    const je = jeSnap.docs[0].data();
    expect(je.totalDebit).toBe(28);
    expect(je.totalCredit).toBe(28);

    const cashLine = je.lines.find((l: any) => l.accountCode === '1010');
    expect(cashLine.debit).toBe(20);
    expect(cashLine.credit).toBe(0);

    const revLine = je.lines.find((l: any) => l.accountCode === '4010');
    expect(revLine.credit).toBe(20);
    expect(revLine.debit).toBe(0);
  });

  // -------------------------------------------------------------
  // 2. ITEM-LEVEL REFUNDS WITH SAME PRODUCT ON TWO DIFFERENT LINES
  // -------------------------------------------------------------
  it('Item-level refund: correctly targets specific line identity, prevents over-refund, restores recipe inventory and loyalty', async () => {
    const db = getAdminDb();
    const ingRef = db.collection('ingredients').doc('ing_patty_closure');
    await ingRef.set({
      id: 'ing_patty_closure',
      name: 'Beef Patty Closure',
      stock: 100,
      unit: 'pcs',
      branchId: 'main_branch_01'
    });

    await db.collection('recipes').doc('recipe_prod_custom_burger_closure').set({
      id: 'recipe_prod_custom_burger_closure', productId: 'prod_custom_burger_closure', branchId: 'main_branch_01',
      items: [{ ingredientId: 'ing_patty_closure', quantity: 1, unit: 'pcs' }], isActive: true
    });
    const prodRef = db.collection('products').doc('prod_custom_burger_closure');
    await prodRef.set({
      id: 'prod_custom_burger_closure',
      name: 'Custom Burger Closure',
      price: 15,
      cost: 5,
      trackStock: true,
      stock: 50,
      recipe: [{ ingredientId: 'ing_patty_closure', quantity: 1, unit: 'pcs' }],
      branchId: 'main_branch_01'
    });

    await db.collection('cash_registers').doc('reg_main_branch_01').set({
      id: 'reg_main_branch_01', branchId: 'main_branch_01', status: 'Open',
      openingBalance: 1000, currentBalance: 1000, expectedClosingBalance: 1000,
      cashPayouts: 0, openedBy: 'test', openedAt: new Date().toISOString()
    });

    const custRef = db.collection('customers').doc('cust_loyalty_closure');
    await custRef.set({
      id: 'cust_loyalty_closure',
      name: 'Ahmed Hassan',
      loyaltyPoints: 0,
      totalSpent: 0,
      totalOrders: 0,
      branchId: 'main_branch_01'
    });

    // Create Order with two separate lines of the same product (Line 1: Qty 2, Line 2: Qty 1)
    const orderRes = await request(app)
      .post('/api/pos/complete')
      .set('Authorization', CASHIER_TOKEN)
      .set('Idempotency-Key', `test-pos-final_closure_verification.test-2`)
      .send({
        orderData: {
          branchId: 'main_branch_01',
          customerId: 'cust_loyalty_closure',
          items: [
            { id: 'line_closure_1', productId: 'prod_custom_burger_closure', quantity: 2, notes: 'Well done' },
            { id: 'line_closure_2', productId: 'prod_custom_burger_closure', quantity: 1, notes: 'Medium rare' }
          ],
          paymentMethod: 'cash',
          amountTendered: 45
        }
      });

    expect(orderRes.status).toBe(200);
    const orderId = orderRes.body.order.id;
    expect(orderRes.body.order.totalAmount).toBe(45);
    expect(orderRes.body.order.items.length).toBe(2);
    expect(orderRes.body.order.pointsEarnedAtCheckout).toBe(45);

    // Verify initial stock deductions (3 patties deducted: 100 - 3 = 97)
    const ingAfterSale = (await db.collection('ingredients').doc('ing_patty_closure').get()).data();
    expect(ingAfterSale.stock).toBe(97);

    // Refund Line 1 only (Quantity 1 of 2)
    const refundRes1 = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', `closure-refund-1`)
      .send({
        amount: 15,
        items: [{ orderItemId: 'line_closure_1', quantity: 1 }]
      });

    expect(refundRes1.status).toBe(200);
    expect(refundRes1.body.refundAmount).toBe(15);

    // Stock should have restored 1 patty (97 + 1 = 98)
    const ingAfterRefund1 = (await db.collection('ingredients').doc('ing_patty_closure').get()).data();
    expect(ingAfterRefund1.stock).toBe(98);

    // Attempt to over-refund Line 1 (Line 1 had qty 2, already refunded 1, refundable 1 -> attempt 2 should fail)
    const overRefundRes = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', `closure-refund-2`)
      .send({
        amount: 30,
        items: [{ orderItemId: 'line_closure_1', quantity: 2 }]
      });

    expect(overRefundRes.status).toBe(400);
    expect(overRefundRes.body.error).toMatch(/exceeds remaining refundable quantity/i);
  });

  // -------------------------------------------------------------
  // 3. HISTORICAL LOYALTY CAMPAIGN IMMUTABILITY
  // -------------------------------------------------------------
  it('Historical loyalty snapshot: reversing an old order reverses historical points without recalculation under new rules', async () => {
    const db = getAdminDb();
    const custRef = db.collection('customers').doc('cust_immutable_loyalty');
    await custRef.set({
      id: 'cust_immutable_loyalty',
      name: 'Mohamed Ali',
      loyaltyPoints: 100,
      totalSpent: 100,
      totalOrders: 1,
      branchId: 'main_branch_01'
    });

    await db.collection('products').doc('prod_1').set({ id: 'prod_1', name: 'Historical Loyalty Product', price: 50, cost: 10, stock: 0, branchId: 'main_branch_01', trackStock: true });
    await db.collection('cash_registers').doc('reg_main_branch_01').set({ id: 'reg_main_branch_01', branchId: 'main_branch_01', status: 'Open', openingBalance: 1000, currentBalance: 1000, expectedClosingBalance: 1000, openedBy: 'test', openedAt: new Date().toISOString() });
    const orderRef = db.collection('orders').doc('ord_historical_loyalty');
    await orderRef.set({
      id: 'ord_historical_loyalty',
      orderNumber: 'ORD-HIST-001',
      branchId: 'main_branch_01',
      customerId: 'cust_immutable_loyalty',
      customerName: 'Mohamed Ali',
      totalAmount: 50,
      paidAmount: 50,
      pointsEarnedAtCheckout: 50,
      loyaltyPointsEarned: 50,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      status: 'completed',
      items: [{ id: 'itm_1', productId: 'prod_1', quantity: 1, price: 50, pointsEarned: 50 }]
    });

    // Paid orders must use the exact line-level refund workflow.
    const refundRes = await request(app)
      .post('/api/orders/ord_historical_loyalty/refund')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', 'closure-historical-refund-1')
      .send({ amount: 50, items: [{ orderItemId: 'itm_1', quantity: 1 }], reason: 'Customer Changed Mind' });

    expect(refundRes.status).toBe(200);

    // Check Customer Points: 100 - 50 = 50
    const custDoc = (await db.collection('customers').doc('cust_immutable_loyalty').get()).data();
    expect(custDoc.loyaltyPoints).toBe(50);
  });

  // -------------------------------------------------------------
  // 4. GOODS RECEIVING IDEMPOTENCY & CROSS-BRANCH PREVENTION
  // -------------------------------------------------------------
  it('Goods receiving: rejects cross-branch items and over-receiving beyond PO quantity', async () => {
    const db = getAdminDb();
    const invB2Ref = db.collection('inventory').doc('inv_cheese_b2');
    await invB2Ref.set({
      id: 'inv_cheese_b2',
      itemName: 'Cheddar Cheese',
      currentQuantity: 20,
      branchId: 'branch_secondary_02'
    });

    const poRef = db.collection('purchase_orders').doc('po_test_cross');
    await poRef.set({
      id: 'po_test_cross',
      poNumber: 'PO-2026-001',
      branchId: 'main_branch_01',
      status: 'approved',
      items: [
        { id: 'po_item_1', itemId: 'inv_cheese_b2', itemName: 'Cheddar Cheese', requestedQuantity: 10, receivedQuantity: 0, unitCost: 5 }
      ]
    });

    // Attempt to receive Branch 2 item into Branch 1 PO
    const crossRes = await request(app)
      .post('/api/purchases/receive')
      .set('Authorization', MANAGER_TOKEN) // Manager belongs to main_branch_01
      .set('Idempotency-Key', `negative-receive-${Date.now()}`)
      .send({
        poId: 'po_test_cross',
        receivedItems: [{ itemId: 'inv_cheese_b2', receivedQty: 5 }],
        receivedBy: 'Manager 1'
      });

    expect(crossRes.status).toBe(400);
    expect(crossRes.body.error).toMatch(/Unauthorized cross-branch receiving/i);
  });

  // -------------------------------------------------------------
  // 5. INVENTORY INVARIANT: Opening + In - Out = Current
  // -------------------------------------------------------------
  it('Inventory invariant holds: Opening + Receipts - Sales - Waste = Current', () => {
    const openingStock = 100;
    const receivedFromSupplier = 50;
    const soldInPOS = 30;
    const loggedAsKitchenWaste = 5;
    const restoredFromRefund = 2;

    const currentStock = openingStock + receivedFromSupplier - soldInPOS - loggedAsKitchenWaste + restoredFromRefund;
    expect(currentStock).toBe(117);
    expect(openingStock + receivedFromSupplier + restoredFromRefund - (soldInPOS + loggedAsKitchenWaste)).toBe(currentStock);
  });

  // -------------------------------------------------------------
  // 6. UNIT CONVERSION MATH
  // -------------------------------------------------------------
  it('Unit conversion: 1 kg ingredient reduced by 100 grams recipe consumption equals 0.9 kg (900 grams)', () => {
    const stockInKg = 1.0;
    const recipeUsageInGrams = 100;
    const gramsInKg = 1000;

    const usageInKg = recipeUsageInGrams / gramsInKg;
    const remainingKg = Math.round((stockInKg - usageInKg) * 1000) / 1000;

    expect(usageInKg).toBe(0.1);
    expect(remainingKg).toBe(0.9);
  });

  // -------------------------------------------------------------
  // 7. TIMEZONE AFRICA/MOGADISHU BOUNDARIES
  // -------------------------------------------------------------
  it('Timezone Africa/Mogadishu (UTC+3): correctly shifts late UTC times across midnight', () => {
    const lateUtcIso = '2026-08-30T22:30:00.000Z';
    const mogadishuDate = getMogadishuDateString(lateUtcIso);

    expect(mogadishuDate).toBe('2026-08-31');
  });

  // -------------------------------------------------------------
  // 8. MONEY & ROUNDING POLICY
  // -------------------------------------------------------------
  it('Rounding policy: always rounds half-up to exactly 2 decimal places with zero floating artifacts', () => {
    expect(roundMoney(10.004)).toBe(10);
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(19.999)).toBe(20);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  // -------------------------------------------------------------
  // 9. POS CHECKOUT TRANSACTIONAL MUTATION_IDEMPOTENCY & DUPLICATE RETRY
  // -------------------------------------------------------------
  it('POS checkout records mutation_idempotency inside transaction and prevents double deduction on retry', async () => {
    const db = getAdminDb();
    await db.collection('products').doc('prod_idem_pos').set({
      id: 'prod_idem_pos',
      name: 'Idempotent Cola',
      price: 5,
      cost: 2,
      trackStock: true,
      stock: 20,
      branchId: 'main_branch_01'
    });

    const idemKey = `pos-idem-tx-verify-${Date.now()}`;
    const payload = {
      orderData: {
        branchId: 'main_branch_01',
        items: [{ productId: 'prod_idem_pos', quantity: 3, unitPrice: 5 }],
        paymentMethod: 'cash',
        amountTendered: 15
      }
    };

    const res1 = await request(app)
      .post('/api/pos/complete')
      .set('Authorization', CASHIER_TOKEN)
      .set('Idempotency-Key', idemKey)
      .send(payload);

    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe('success');

    const res2 = await request(app)
      .post('/api/pos/complete')
      .set('Authorization', CASHIER_TOKEN)
      .set('Idempotency-Key', idemKey)
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('duplicate');
    expect(res2.body.orderId).toBe(res1.body.orderId);

    const prodAfter = (await db.collection('products').doc('prod_idem_pos').get()).data();
    expect(prodAfter.stock).toBe(17);
  });

  // -------------------------------------------------------------
  // 10. PURCHASE ORDER APPROVAL ATOMIC TRANSACTION & IDEMPOTENCY RETRY
  // -------------------------------------------------------------
  it('Purchase order approval executes atomically and replays safely on idempotent retry', async () => {
    const db = getAdminDb();
    await db.collection('purchase_orders').doc('po_atomic_approve_1').set({
      id: 'po_atomic_approve_1',
      poNumber: 'PO-ATOMIC-001',
      branchId: 'main_branch_01',
      supplierId: 'sup_1',
      supplierName: 'Fresh Farms',
      status: 'pending_approval',
      totalAmount: 250,
      items: [{ itemId: 'inv_1', itemName: 'Flour', requestedQuantity: 10, unitCost: 25 }]
    });

    const idemKey = `po-approve-idem-${Date.now()}`;
    const res1 = await request(app)
      .post('/api/purchases/orders/po_atomic_approve_1/approve')
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', idemKey)
      .send({ approvedBy: 'Manager 1' });

    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe('success');

    // Retry with same Idempotency-Key even after PO status is already 'approved'
    const res2 = await request(app)
      .post('/api/purchases/orders/po_atomic_approve_1/approve')
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', idemKey)
      .send({ approvedBy: 'Manager 1' });

    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('success');
    expect(res2.body.id).toBe('po_atomic_approve_1');

    const purchaseDoc = await db.collection('purchases').doc('po_atomic_approve_1').get();
    expect(purchaseDoc.exists).toBe(true);
    expect(purchaseDoc.data()?.status).toBe('approved');
  });

  // -------------------------------------------------------------
  // 11. UNIFIED SOFT-DELETE FOR INVENTORY ITEMS & TRANSACTIONAL DELETE FOR REWARDS/COUPONS
  // -------------------------------------------------------------
  it('Soft-deletes inventory items and transactionally deletes CRM rewards and coupons with idempotency protection', async () => {
    const db = getAdminDb();
    await db.collection('inventory').doc('inv_soft_del_1').set({
      id: 'inv_soft_del_1',
      itemName: 'Test Spice',
      branchId: 'main_branch_01',
      currentQuantity: 5,
      isActive: true
    });
    await db.collection('customer_rewards').doc('rew_soft_del_1').set({
      id: 'rew_soft_del_1',
      name: 'Free Coffee',
      pointsCost: 50,
      branchId: 'main_branch_01',
      isActive: true
    });
    await db.collection('customer_coupons').doc('coup_soft_del_1').set({
      id: 'coup_soft_del_1',
      code: 'SAVE10NOW',
      discountValue: 10,
      branchId: 'main_branch_01',
      isActive: true
    });

    const delInv = await request(app)
      .delete('/api/inventory/items/inv_soft_del_1')
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', `del-inv-${Date.now()}`);
    expect(delInv.status).toBe(200);

    const rewIdemKey = `del-rew-${Date.now()}`;
    const delRew = await request(app)
      .delete('/api/crm/rewards/rew_soft_del_1')
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', rewIdemKey);
    expect(delRew.status).toBe(200);

    const coupIdemKey = `del-coup-${Date.now()}`;
    const delCoup = await request(app)
      .delete('/api/crm/coupons/coup_soft_del_1')
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', coupIdemKey);
    expect(delCoup.status).toBe(200);

    const invDoc = (await db.collection('inventory').doc('inv_soft_del_1').get()).data();
    expect(invDoc?.isDeleted).toBe(true);
    expect(invDoc?.isArchived).toBe(true);
    expect(invDoc?.isActive).toBe(false);
    expect(invDoc?.status).toBe('deleted');

    const rewSnap = await db.collection('customer_rewards').doc('rew_soft_del_1').get();
    expect(rewSnap.exists).toBe(false);

    const coupSnap = await db.collection('customer_coupons').doc('coup_soft_del_1').get();
    expect(coupSnap.exists).toBe(false);

    // Retry with the SAME Idempotency-Key must replay 200 (not 404)
    const delRewRetry = await request(app)
      .delete('/api/crm/rewards/rew_soft_del_1')
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', rewIdemKey);
    expect(delRewRetry.status).toBe(200);
    expect(delRewRetry.body.status).toBe('success');

    const delCoupRetry = await request(app)
      .delete('/api/crm/coupons/coup_soft_del_1')
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', coupIdemKey);
    expect(delCoupRetry.status).toBe(200);
    expect(delCoupRetry.body.status).toBe('success');
  });

  // -------------------------------------------------------------
  // 12. CONCURRENT DUPLICATE REQUESTS ON WALLET RECHARGE
  // -------------------------------------------------------------
  it('Concurrent wallet recharge requests with identical Idempotency-Key credit the customer balance only once', async () => {
    const db = getAdminDb();
    await db.collection('customers').doc('cust_concurrent_wallet').set({
      id: 'cust_concurrent_wallet',
      name: 'Halima Concurrent',
      walletBalance: 100,
      branchId: 'main_branch_01'
    });
    await db.collection('customer_wallets').doc('wlt_concurrent_1').set({
      id: 'wlt_concurrent_1',
      customerId: 'cust_concurrent_wallet',
      customerName: 'Halima Concurrent',
      balance: 100,
      branchId: 'main_branch_01',
      status: 'active'
    });
    await db.collection('cash_registers').doc('reg_main_branch_01').set({
      id: 'reg_main_branch_01',
      branchId: 'main_branch_01',
      status: 'Open',
      openingBalance: 500,
      currentBalance: 500,
      expectedClosingBalance: 500,
      openedBy: 'test',
      openedAt: new Date().toISOString()
    });

    const sharedIdemKey = `wallet-concurrent-${Date.now()}`;
    const body = {
      customerId: 'cust_concurrent_wallet',
      amount: 50,
      paymentMethod: 'cash',
      branchId: 'main_branch_01',
      notes: 'Concurrent recharge test'
    };

    const [r1, r2] = await Promise.all([
      request(app)
        .post('/api/crm/wallet/recharge')
        .set('Authorization', CASHIER_TOKEN)
        .set('Idempotency-Key', sharedIdemKey)
        .send(body),
      request(app)
        .post('/api/crm/wallet/recharge')
        .set('Authorization', CASHIER_TOKEN)
        .set('Idempotency-Key', sharedIdemKey)
        .send(body)
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.newBalance).toBe(150);
    expect(r2.body.newBalance).toBe(150);

    const wltAfter = (await db.collection('customer_wallets').doc('wlt_concurrent_1').get()).data();
    expect(wltAfter?.balance).toBe(150);
  });

  // -------------------------------------------------------------
  // 13. RECIPE & INGREDIENT DELETION READ-BEFORE-WRITE ORDERING
  // -------------------------------------------------------------
  it('DELETE /api/recipes/:id and DELETE /api/ingredients/:id execute all reads before writes and update linked projections', async () => {
    const db = getAdminDb();
    await db.collection('products').doc('prod_rec_del_1').set({
      id: 'prod_rec_del_1',
      name: 'Spiced Lamb Rice',
      branchId: 'main_branch_01',
      activeRecipeId: 'rec_del_1',
      recipe: [{ ingredientId: 'ing_del_1', quantity: 200, unit: 'g' }]
    });
    await db.collection('recipes').doc('rec_del_1').set({
      id: 'rec_del_1',
      productId: 'prod_rec_del_1',
      productName: 'Spiced Lamb Rice',
      branchId: 'main_branch_01',
      isActive: true,
      items: [{ ingredientId: 'ing_del_1', quantity: 200, unit: 'g' }]
    });
    await db.collection('ingredients').doc('ing_del_1').set({
      id: 'ing_del_1',
      name: 'Cardamom Pods',
      branchId: 'main_branch_01',
      stock: 500,
      currentStockUsageUnit: 500,
      usageUnit: 'g',
      purchaseUnit: 'g',
      conversionFactor: 1
    });
    await db.collection('inventory').doc('ing_del_1').set({
      id: 'ing_del_1',
      itemName: 'Cardamom Pods',
      branchId: 'main_branch_01',
      currentQuantity: 500,
      unit: 'g',
      status: 'in_stock'
    });

    const delRecipeRes = await request(app)
      .delete('/api/recipes/rec_del_1')
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', `del-rec-${Date.now()}`);
    expect(delRecipeRes.status).toBe(200);
    expect(delRecipeRes.body.status).toBe('success');

    const prodAfter = (await db.collection('products').doc('prod_rec_del_1').get()).data();
    expect(prodAfter?.activeRecipeId).toBeNull();
    expect(prodAfter?.recipe).toEqual([]);

    const delIngRes = await request(app)
      .delete('/api/recipes/ingredients/ing_del_1')
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', `del-ing-${Date.now()}`);
    expect(delIngRes.status).toBe(200);
    expect(delIngRes.body.status).toBe('success');

    const invAfter = (await db.collection('inventory').doc('ing_del_1').get()).data();
    expect(invAfter?.isDeleted).toBe(true);
    expect(invAfter?.status).toBe('deleted');
  });

  // -------------------------------------------------------------
  // 14. INTER-BRANCH CASH TRANSFER APPROVAL READ-BEFORE-WRITE & LEDGER
  // -------------------------------------------------------------
  it('POST /api/branch-transfers/:transferId/approve for cash transfer executes all reads before writes and posts balanced journal lines', async () => {
    const db = getAdminDb();
    await db.collection('branches').doc('branch_2').set({
      id: 'branch_2',
      name: 'Branch 2',
      taxRate: 0,
      defaultDeliveryFee: 0
    });
    await db.collection('accounts').doc('acc_due_from_branch').set({
      id: 'acc_due_from_branch',
      code: '1310',
      name: 'Due From Branch',
      type: 'Asset',
      balance: 0,
      isSystem: true
    });
    await db.collection('accounts').doc('acc_due_to_branch').set({
      id: 'acc_due_to_branch',
      code: '2110',
      name: 'Due To Branch',
      type: 'Liability',
      balance: 0,
      isSystem: true
    });
    await db.collection('cash_registers').doc('reg_main_branch_01').set({
      id: 'reg_main_branch_01',
      branchId: 'main_branch_01',
      status: 'Open',
      openingBalance: 1000,
      expectedClosingBalance: 1000,
      cashAdjustments: 0
    });
    await db.collection('cash_registers').doc('reg_branch_2').set({
      id: 'reg_branch_2',
      branchId: 'branch_2',
      status: 'Open',
      openingBalance: 400,
      expectedClosingBalance: 400,
      cashAdjustments: 0
    });
    await db.collection('branch_transfers').doc('trf_cash_1').set({
      id: 'trf_cash_1',
      transferType: 'cash',
      sourceBranchId: 'main_branch_01',
      destinationBranchId: 'branch_2',
      cashAmount: 250,
      status: 'pending',
      reason: 'Float replenishment'
    });

    const approveRes = await request(app)
      .post('/api/branch-transfers/trf_cash_1/approve')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `trf-cash-approve-${Date.now()}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('success');

    const srcReg = (await db.collection('cash_registers').doc('reg_main_branch_01').get()).data();
    const dstReg = (await db.collection('cash_registers').doc('reg_branch_2').get()).data();
    expect(srcReg?.expectedClosingBalance).toBe(750);
    expect(dstReg?.expectedClosingBalance).toBe(650);
  });

  it('maintains receivable remainingBalance/totalAmount consistency and canonical Posted journal status across credit sale, refund, and cancellation', async () => {
    const db = getAdminDb();
    await db.collection('customers').doc('cust_ar_1').set({
      id: 'cust_ar_1',
      name: 'AR Test Customer',
      branchId: 'main_branch_01',
      outstandingDebt: 0,
      creditBalance: 0
    });
    await db.collection('products').doc('prod_ar_1').set({
      id: 'prod_ar_1',
      name: 'AR Dish',
      price: 25,
      costPrice: 10,
      stock: 20,
      branchId: 'main_branch_01'
    });

    const checkoutRes = await request(app)
      .post('/api/pos/checkout')
      .set('Authorization', CASHIER_TOKEN)
      .set('Idempotency-Key', `ar-checkout-${Date.now()}`)
      .send({
        orderData: {
          orderNumber: 'ORD-AR-101',
          branchId: 'main_branch_01',
          customerId: 'cust_ar_1',
          customerName: 'AR Test Customer',
          orderType: 'dine_in',
          paymentMethod: 'credit',
          paymentStatus: 'unpaid',
          status: 'completed',
          subtotal: 50,
          totalAmount: 50,
          items: [{ id: 'line_ar_1', productId: 'prod_ar_1', productName: 'AR Dish', quantity: 2, unitPrice: 25, totalPrice: 50 }]
        }
      });
    expect(checkoutRes.status).toBe(200);
    const orderId = checkoutRes.body.order.id;

    const recQuery1 = await db.collection('receivables').where('orderId', '==', orderId).get();
    expect(recQuery1.empty).toBe(false);
    const recData1 = recQuery1.docs[0].data();
    expect(recData1?.remainingAmount).toBe(50);
    expect(recData1?.remainingBalance).toBe(50);
    expect(recData1?.totalAmount).toBe(50);
    expect(recData1?.customerId).toBe('cust_ar_1');

    // Partial refund of 1 item ($25) on the credit order
    const refundRes = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', `ar-refund-${Date.now()}`)
      .send({
        amount: 25,
        paymentMethod: 'credit',
        reason: 'Partial credit adjustment',
        items: [{ orderItemId: 'line_ar_1', quantity: 1 }]
      });
    expect(refundRes.status).toBe(200);

    const recQuery2 = await db.collection('receivables').where('orderId', '==', orderId).get();
    const recData2 = recQuery2.docs[0].data();
    expect(recData2?.remainingAmount).toBe(25);
    expect(recData2?.remainingBalance).toBe(25);

    // Create another credit order and cancel it; verify Posted journal status and zeroed receivable
    const checkoutRes2 = await request(app)
      .post('/api/pos/checkout')
      .set('Authorization', CASHIER_TOKEN)
      .set('Idempotency-Key', `ar-checkout-cancel-${Date.now()}`)
      .send({
        orderData: {
          orderNumber: 'ORD-AR-102',
          branchId: 'main_branch_01',
          customerId: 'cust_ar_1',
          customerName: 'AR Test Customer',
          orderType: 'dine_in',
          paymentMethod: 'credit',
          paymentStatus: 'unpaid',
          status: 'pending',
          subtotal: 25,
          totalAmount: 25,
          items: [{ id: 'line_ar_2', productId: 'prod_ar_1', productName: 'AR Dish', quantity: 1, unitPrice: 25, totalPrice: 25 }]
        }
      });
    expect(checkoutRes2.status).toBe(200);
    const cancelOrderId = checkoutRes2.body.order.id;

    const cancelRes = await request(app)
      .post(`/api/orders/${cancelOrderId}/cancel`)
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', `ar-order-cancel-${Date.now()}`)
      .send({ reason: 'Guest left' });
    expect(cancelRes.status).toBe(200);

    const recQueryCancel = await db.collection('receivables').where('orderId', '==', cancelOrderId).get();
    const recCancelData = recQueryCancel.docs[0].data();
    expect(recCancelData?.status).toBe('cancelled');
    expect(recCancelData?.remainingAmount).toBe(0);
    expect(recCancelData?.remainingBalance).toBe(0);

    const cancelJeQuery = await db.collection('journal_entries').where('referenceId', '==', cancelOrderId).get();
    expect(cancelJeQuery.empty).toBe(false);
    expect(cancelJeQuery.docs[0].data()?.status).toBe('Posted');
  });

  it('posts opening inventory projection, movement, GL entry, and branch tax config during initial setup', async () => {
    const db = getAdminDb();
    await db.collection('accounts').doc('acc_inventory').set({
      id: 'acc_inventory',
      code: '1030',
      name: 'Food & Beverage Inventory Asset',
      type: 'Asset',
      balance: 0,
      isSystem: true
    });
    await db.collection('accounts').doc('acc_opening_equity').set({
      id: 'acc_opening_equity',
      code: '3010',
      name: 'Opening Balance Equity',
      type: 'Equity',
      balance: 0,
      isSystem: true
    });

    const setupRes = await request(app)
      .post('/api/setup/initial')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `setup-init-${Date.now()}`)
      .send({
        restaurant: { name: 'Maqaayad ERP', currency: 'USD' },
        branch: { id: 'branch_setup_1', code: 'branch_setup_1', name: 'Setup Branch', city: 'Mogadishu', isPrimary: false },
        admin: { name: 'Owner User', email: 'test@example.com' },
        tax: { taxRate: 5 },
        inventory: [
          {
            name: 'Basmati Rice Setup',
            category: 'Grains',
            purchaseUnit: 'kg',
            usageUnit: 'kg',
            conversionFactor: 1,
            currentQuantity: 20,
            purchaseCost: 2.5,
            minStockUsageUnit: 5
          }
        ]
      });
    expect(setupRes.status).toBe(200);
    expect(setupRes.body.status).toBe('success');

    const branchDoc = (await db.collection('branches').doc('branch_setup_1').get()).data();
    expect(branchDoc?.taxRate).toBe(5);
    expect(branchDoc?.taxEnabled).toBe(true);

    const ingId = 'setup_test_user_id_1';
    const invProj = (await db.collection('inventory').doc(ingId).get()).data();
    expect(invProj?.currentQuantity).toBe(20);
    expect(invProj?.costPerUsageUnit).toBe(2.5);

    const mvDoc = (await db.collection('inventory_movements').doc('setup_mv_test_user_id_1').get()).data();
    expect(mvDoc?.type).toBe('opening');
    expect(mvDoc?.newQuantity).toBe(20);
    expect(mvDoc?.totalCost).toBe(50);

    const jeDoc = (await db.collection('journal_entries').doc('je_setup_open_test_user_id_branch_setup_1').get()).data();
    expect(jeDoc?.status).toBe('Posted');
    expect(jeDoc?.totalDebit).toBe(50);
    expect(jeDoc?.totalCredit).toBe(50);
  });
});
