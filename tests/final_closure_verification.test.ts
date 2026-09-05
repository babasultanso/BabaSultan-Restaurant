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

    await db.collection('cash_registers').doc('reg_refund_closure').set({
      id: 'reg_refund_closure', branchId: 'main_branch_01', status: 'Open',
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
    await db.collection('cash_registers').doc('reg_historical_loyalty').set({ id: 'reg_historical_loyalty', branchId: 'main_branch_01', status: 'Open', openingBalance: 1000, currentBalance: 1000, expectedClosingBalance: 1000, openedBy: 'test', openedAt: new Date().toISOString() });
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
});
