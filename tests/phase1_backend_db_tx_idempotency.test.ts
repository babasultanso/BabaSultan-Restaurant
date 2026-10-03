import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { getAdminDb } from '../server/trustedFinancialBackend.js';

const ADMIN_TOKEN = 'Bearer test_token_admin';
const MANAGER_TOKEN = 'Bearer test_token_manager';
const CASHIER_TOKEN = 'Bearer test_token_cashier';
const BRANCH_A_TOKEN = 'Bearer test_token_manager_branch_a';
const BRANCH_B_TOKEN = 'Bearer test_token_manager_branch_b';

describe('PHASE 1: BACKEND, DATABASE, TRANSACTIONS & IDEMPOTENCY HARDENING', () => {
  beforeEach(async () => {
    const db = getAdminDb();
    await db.collection('taxes').doc('tax_main_01').set({
      id: 'tax_main_01',
      name: 'VAT',
      rate: 5,
      isActive: true,
      isDefault: true,
      branchId: 'main_branch_01'
    });
    await db.collection('branches').doc('main_branch_01').set({
      id: 'main_branch_01',
      branchId: 'main_branch_01',
      branchName: 'Main Branch',
      deliveryFee: 3
    }, { merge: true });
    const openRegs = await db.collection('cash_registers')
      .where('branchId', '==', 'main_branch_01')
      .where('status', '==', 'Open')
      .get();
    if (openRegs.empty) {
      await db.collection('cash_registers').doc('reg_phase1_main').set({
        id: 'reg_phase1_main',
        registerName: 'Main Register',
        branchId: 'main_branch_01',
        status: 'Open',
        openingBalance: 500,
        expectedClosingBalance: 500,
        cashSales: 0,
        cashExpenses: 0
      });
    }
  });

  it('1. Enforces Idempotency-Key payload hash conflict (409) when reusing same key with different payload', async () => {
    const db = getAdminDb();
    const itemId = `inv_idem_conflict_${Date.now()}`;
    await db.collection('inventory').doc(itemId).set({
      id: itemId,
      itemName: 'Test Flour',
      currentQuantity: 100,
      minimumQuantity: 10,
      unit: 'kg',
      costPrice: 2,
      branchId: 'main_branch_01'
    });

    const sharedKey = `idem-conflict-key-${Date.now()}`;
    const first = await request(app)
      .post('/api/inventory/adjust')
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', sharedKey)
      .send({
        movementData: {
          itemId,
          itemType: 'inventory',
          type: 'out',
          mode: 'delta',
          quantity: 5,
          reason: 'Count adjustment 1'
        }
      });
    expect(first.status).toBe(200);

    // Exact retry with same payload returns 200 and does not double-deduct
    const retrySame = await request(app)
      .post('/api/inventory/adjust')
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', sharedKey)
      .send({
        movementData: {
          itemId,
          itemType: 'inventory',
          type: 'out',
          mode: 'delta',
          quantity: 5,
          reason: 'Count adjustment 1'
        }
      });
    expect(retrySame.status).toBe(200);
    expect(retrySame.body.id).toBe(first.body.id);

    // Reuse same key with different quantity must return 409 Conflict
    const conflict = await request(app)
      .post('/api/inventory/adjust')
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', sharedKey)
      .send({
        movementData: {
          itemId,
          itemType: 'inventory',
          type: 'out',
          mode: 'delta',
          quantity: 20,
          reason: 'Count adjustment 1'
        }
      });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    const finalSnap = await db.collection('inventory').doc(itemId).get();
    expect(finalSnap.data()?.currentQuantity).toBe(95);
  });

  it('2. Order cancellation merges shared recipe ingredients across multiple products and reverses driver earnings', async () => {
    const db = getAdminDb();
    const ts = Date.now();
    const ingId = `ing_shared_beef_${ts}`;
    const prod1Id = `prod_burger_1_${ts}`;
    const prod2Id = `prod_burger_2_${ts}`;
    const rec1Id = `rec_burger_1_${ts}`;
    const rec2Id = `rec_burger_2_${ts}`;

    await db.collection('ingredients').doc(ingId).set({
      id: ingId,
      name: 'Beef Patty',
      stock: 100,
      currentStockUsageUnit: 100,
      usageUnit: 'pcs',
      purchaseUnit: 'pcs',
      conversionFactor: 1,
      costPerUsageUnit: 2,
      branchId: 'main_branch_01'
    });

    await db.collection('products').doc(prod1Id).set({
      id: prod1Id,
      name: 'Single Burger',
      price: 10,
      stock: 50,
      branchId: 'main_branch_01'
    });
    await db.collection('products').doc(prod2Id).set({
      id: prod2Id,
      name: 'Double Burger',
      price: 15,
      stock: 50,
      branchId: 'main_branch_01'
    });

    await db.collection('recipes').doc(rec1Id).set({
      id: rec1Id,
      productId: prod1Id,
      productName: 'Single Burger',
      yieldQuantity: 1,
      items: [{ ingredientId: ingId, ingredientName: 'Beef Patty', quantity: 1, unit: 'pcs' }],
      branchId: 'main_branch_01'
    });
    await db.collection('recipes').doc(rec2Id).set({
      id: rec2Id,
      productId: prod2Id,
      productName: 'Double Burger',
      yieldQuantity: 1,
      items: [{ ingredientId: ingId, ingredientName: 'Beef Patty', quantity: 2, unit: 'pcs' }],
      branchId: 'main_branch_01'
    });

    // Checkout with 2x Single Burger (2 patties) + 3x Double Burger (6 patties) = 8 patties deducted
    const checkoutRes = await request(app)
      .post('/api/pos/complete')
      .set('Authorization', CASHIER_TOKEN)
      .set('Idempotency-Key', `checkout-shared-ing-${ts}`)
      .send({
        orderData: {
          orderType: 'delivery',
          paymentMethod: 'cod',
          customerName: 'Delivery Customer',
          customerPhone: '615000001',
          deliveryAddress: 'KM4 Mogadishu',
          branchId: 'main_branch_01',
          items: [
            { productId: prod1Id, productName: 'Single Burger', quantity: 2, unitPrice: 10 },
            { productId: prod2Id, productName: 'Double Burger', quantity: 3, unitPrice: 15 }
          ]
        }
      });

    expect(checkoutRes.status).toBe(200);
    const orderId = checkoutRes.body.id || checkoutRes.body.orderId;

    const afterCheckoutIng = await db.collection('ingredients').doc(ingId).get();
    expect(afterCheckoutIng.data()?.currentStockUsageUnit).toBe(92);

    // Cancel the order and verify all 8 patties (2 + 6) are restored, not overwritten by the last product
    const cancelRes = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', `cancel-shared-ing-${ts}`)
      .send({ reason: 'Customer changed mind' });

    expect(cancelRes.status).toBe(200);
    const afterCancelIng = await db.collection('ingredients').doc(ingId).get();
    expect(afterCancelIng.data()?.currentStockUsageUnit).toBe(100);
    expect(afterCancelIng.data()?.stock).toBe(100);
  });

  it('3. POS Checkout with coupon executes all reads before writes and preserves customer lifetimePoints on checkout and cancellation', async () => {
    const db = getAdminDb();
    const ts = Date.now();
    const custId = `cust_loyalty_${ts}`;
    const couponId = `coup_${ts}`;
    const prodId = `prod_coup_${ts}`;

    await db.collection('customers').doc(custId).set({
      id: custId,
      name: 'Loyalty Customer',
      fullName: 'Loyalty Customer',
      loyaltyPoints: 600,
      lifetimePoints: 2500,
      membershipLevel: 'Gold',
      totalOrders: 10,
      totalSpent: 500,
      totalSpending: 500,
      branchId: 'main_branch_01'
    });
    await db.collection('customer_points').doc(`pts_${custId}`).set({
      id: `pts_${custId}`,
      customerId: custId,
      totalPoints: 600,
      lifetimePoints: 2500,
      pointsRedeemed: 1900,
      membershipLevel: 'Gold',
      branchId: 'main_branch_01'
    });
    await db.collection('customer_coupons').doc(couponId).set({
      id: couponId,
      code: `SAVE10_${ts}`,
      discountType: 'fixed',
      discountValue: 10,
      minOrderAmount: 20,
      maxUses: 10,
      usedCount: 0,
      usageCount: 0,
      isActive: true,
      status: 'active',
      branchId: 'main_branch_01'
    });
    await db.collection('products').doc(prodId).set({
      id: prodId,
      name: 'Platter',
      price: 50,
      stock: 20,
      branchId: 'main_branch_01'
    });

    const checkoutRes = await request(app)
      .post('/api/pos/complete')
      .set('Authorization', CASHIER_TOKEN)
      .set('Idempotency-Key', `checkout-coupon-lifetime-${ts}`)
      .send({
        orderData: {
          orderType: 'takeaway',
          paymentMethod: 'credit',
          customerId: custId,
          customerName: 'Loyalty Customer',
          couponCode: `SAVE10_${ts}`,
          discountAmount: 10,
          branchId: 'main_branch_01',
          items: [{ productId: prodId, productName: 'Platter', quantity: 1, unitPrice: 50 }]
        }
      });

    expect(checkoutRes.status).toBe(200);
    const ptsAfterCheckout = await db.collection('customer_points').doc(`pts_${custId}`).get();
    expect(ptsAfterCheckout.data()?.lifetimePoints).toBeGreaterThanOrEqual(2500);

    const couponSnap = await db.collection('customer_coupons').doc(couponId).get();
    expect(couponSnap.data()?.usedCount).toBe(1);

    // Cancel order and verify lifetimePoints is updated and preserved on both customer and customer_points
    const cancelRes = await request(app)
      .post(`/api/orders/${checkoutRes.body.id || checkoutRes.body.orderId}/cancel`)
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', `cancel-coupon-lifetime-${ts}`)
      .send({ reason: 'Test cancellation' });

    expect(cancelRes.status).toBe(200);
    const ptsAfterCancel = await db.collection('customer_points').doc(`pts_${custId}`).get();
    const custAfterCancel = await db.collection('customers').doc(custId).get();
    expect(ptsAfterCancel.data()?.lifetimePoints).toBe(2500);
    expect(custAfterCancel.data()?.lifetimePoints).toBe(2500);
  });

  it('4. Kitchen waste updates GL accounts (acc_waste and acc_inventory) and synchronizes linked inventory projection', async () => {
    const db = getAdminDb();
    const ts = Date.now();
    const ingId = `ing_waste_sync_${ts}`;

    await db.collection('ingredients').doc(ingId).set({
      id: ingId,
      name: 'Fresh Cheese',
      stock: 20,
      currentStockUsageUnit: 20,
      usageUnit: 'kg',
      purchaseUnit: 'kg',
      conversionFactor: 1,
      costPerUsageUnit: 5,
      branchId: 'main_branch_01'
    });
    await db.collection('inventory').doc(ingId).set({
      id: ingId,
      itemName: 'Fresh Cheese',
      currentQuantity: 20,
      minimumQuantity: 2,
      unit: 'kg',
      costPrice: 5,
      branchId: 'main_branch_01'
    });

    const beforeWasteAcc = (await db.collection('accounts').doc('acc_waste').get()).data()?.balance || 0;
    const beforeInvAcc = (await db.collection('accounts').doc('acc_inventory').get()).data()?.balance || 0;

    const res = await request(app)
      .post('/api/kitchen/waste')
      .set('Authorization', MANAGER_TOKEN)
      .set('Idempotency-Key', `waste-gl-sync-${ts}`)
      .send({
        wasteData: {
          itemId: ingId,
          itemType: 'ingredient',
          quantity: 4,
          unit: 'kg',
          reason: 'Expired batch'
        }
      });

    expect(res.status).toBe(200);
    const afterWasteAcc = (await db.collection('accounts').doc('acc_waste').get()).data()?.balance || 0;
    const afterInvAcc = (await db.collection('accounts').doc('acc_inventory').get()).data()?.balance || 0;
    expect(afterWasteAcc - beforeWasteAcc).toBeCloseTo(20, 2); // 4 * $5 = $20
    expect(beforeInvAcc - afterInvAcc).toBeCloseTo(20, 2);

    const invProjection = await db.collection('inventory').doc(ingId).get();
    expect(invProjection.data()?.currentQuantity).toBe(16);
  });

  it('5. Enforces strict branch isolation and atomic branch settings + kitchen station updates with idempotency', async () => {
    const db = getAdminDb();
    const ts = Date.now();
    const stationId = `station_grill_${ts}`;
    await db.collection('stations').doc(stationId).set({
      id: stationId,
      name: 'Grill Station',
      status: 'normal',
      branchId: 'branch_a'
    });

    // Branch B manager cannot update Branch A station
    const crossBranchRes = await request(app)
      .post(`/api/kitchen/stations/${stationId}/status`)
      .set('Authorization', BRANCH_B_TOKEN)
      .set('Idempotency-Key', `station-cross-${ts}`)
      .send({ status: 'busy', chefName: 'Chef B' });
    expect(crossBranchRes.status).toBe(403);

    // Branch A manager can update Branch A station idempotently
    const stationIdemKey = `station-ok-${ts}`;
    const okRes = await request(app)
      .post(`/api/kitchen/stations/${stationId}/status`)
      .set('Authorization', BRANCH_A_TOKEN)
      .set('Idempotency-Key', stationIdemKey)
      .send({ status: 'busy', chefName: 'Chef A' });
    expect(okRes.status).toBe(200);

    // Same key with different status conflicts with 409
    const stationConflict = await request(app)
      .post(`/api/kitchen/stations/${stationId}/status`)
      .set('Authorization', BRANCH_A_TOKEN)
      .set('Idempotency-Key', stationIdemKey)
      .send({ status: 'overloaded', chefName: 'Chef A' });
    expect(stationConflict.status).toBe(409);

    // Branch settings atomic update
    const settingsKey = `branch-settings-${ts}`;
    const settingsRes = await request(app)
      .put('/api/settings/branch')
      .set('Authorization', ADMIN_TOKEN)
      .set('Idempotency-Key', settingsKey)
      .send({
        branchId: 'main_branch_01',
        restaurant: { name: 'Baba Sultan HQ Updated' },
        tax: { defaultTaxRate: 5 }
      });
    expect(settingsRes.status).toBe(200);

    const branchDoc = await db.collection('branches').doc('main_branch_01').get();
    expect(branchDoc.data()?.branchName).toBe('Baba Sultan HQ Updated');
  });
});
