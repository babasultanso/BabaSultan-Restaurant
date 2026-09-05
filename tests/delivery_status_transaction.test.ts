import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { getAdminDb } from '../server/trustedFinancialBackend.js';

describe('DELIVERY STATUS TRANSACTION ORDERING & STATE MACHINE REGRESSION SUITE', () => {
  const OWNER_TOKEN = 'Bearer test_token_owner';
  const BRANCH_ID = 'branch_test_del_stat_01';

  beforeEach(async () => {
    const db = getAdminDb();
    await db.collection('branches').doc(BRANCH_ID).set({ id: BRANCH_ID, name: 'Main Branch' });

    await db.collection('drivers').doc('drv_del_stat_1').set({
      id: 'drv_del_stat_1',
      fullName: 'Speedy Driver',
      phoneNumber: '+1999888777',
      branchId: BRANCH_ID,
      status: 'active',
      isActive: true,
      availability: 'on_delivery'
    });
  });

  // Test 1 — assigned → accepted
  it('Test 1 — assigned -> accepted: Successfully transitions delivery and updates timestamps', async () => {
    const db = getAdminDb();
    const deliveryId = 'del_stat_test_001';
    const orderId = 'ord_stat_test_001';

    await db.collection('orders').doc(orderId).set({
      id: orderId,
      branchId: BRANCH_ID,
      status: 'confirmed',
      deliveryStatus: 'assigned'
    });

    await db.collection('deliveries').doc(deliveryId).set({
      id: deliveryId,
      orderId,
      branchId: BRANCH_ID,
      driverId: 'drv_del_stat_1',
      status: 'assigned'
    });

    const res = await request(app)
      .post(`/api/deliveries/${deliveryId}/status`)
      .set('Authorization', OWNER_TOKEN)
      .send({ status: 'accepted' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.deliveryStatus).toBe('accepted');

    const delSnap = await db.collection('deliveries').doc(deliveryId).get();
    expect(delSnap.data()?.status).toBe('accepted');
    expect(delSnap.data()?.acceptedAt).toBeDefined();
  });

  // Test 2 — accepted → picked_up
  it('Test 2 — accepted -> picked_up: Successfully transitions delivery and updates order to in_transit', async () => {
    const db = getAdminDb();
    const deliveryId = 'del_stat_test_002';
    const orderId = 'ord_stat_test_002';

    await db.collection('orders').doc(orderId).set({
      id: orderId,
      branchId: BRANCH_ID,
      status: 'confirmed',
      deliveryStatus: 'assigned'
    });

    await db.collection('deliveries').doc(deliveryId).set({
      id: deliveryId,
      orderId,
      branchId: BRANCH_ID,
      driverId: 'drv_del_stat_1',
      status: 'accepted'
    });

    const res = await request(app)
      .post(`/api/deliveries/${deliveryId}/status`)
      .set('Authorization', OWNER_TOKEN)
      .send({ status: 'picked_up' });

    expect(res.status).toBe(200);
    expect(res.body.deliveryStatus).toBe('picked_up');

    const delSnap = await db.collection('deliveries').doc(deliveryId).get();
    expect(delSnap.data()?.status).toBe('picked_up');
    expect(delSnap.data()?.pickedUpAt).toBeDefined();

    const ordSnap = await db.collection('orders').doc(orderId).get();
    expect(ordSnap.data()?.deliveryStatus).toBe('in_transit');
  });

  // Test 3 — picked_up → on_the_way
  it('Test 3 — picked_up -> on_the_way: Successfully transitions delivery to on_the_way', async () => {
    const db = getAdminDb();
    const deliveryId = 'del_stat_test_003';
    const orderId = 'ord_stat_test_003';

    await db.collection('orders').doc(orderId).set({
      id: orderId,
      branchId: BRANCH_ID,
      status: 'confirmed',
      deliveryStatus: 'in_transit'
    });

    await db.collection('deliveries').doc(deliveryId).set({
      id: deliveryId,
      orderId,
      branchId: BRANCH_ID,
      driverId: 'drv_del_stat_1',
      status: 'picked_up'
    });

    const res = await request(app)
      .post(`/api/deliveries/${deliveryId}/status`)
      .set('Authorization', OWNER_TOKEN)
      .send({ status: 'on_the_way' });

    expect(res.status).toBe(200);
    expect(res.body.deliveryStatus).toBe('on_the_way');

    const delSnap = await db.collection('deliveries').doc(deliveryId).get();
    expect(delSnap.data()?.status).toBe('on_the_way');
    expect(delSnap.data()?.onTheWayAt).toBeDefined();
  });

  // Test 4 — on_the_way → arrived
  it('Test 4 — on_the_way -> arrived: Successfully transitions delivery to arrived', async () => {
    const db = getAdminDb();
    const deliveryId = 'del_stat_test_004';
    const orderId = 'ord_stat_test_004';

    await db.collection('deliveries').doc(deliveryId).set({
      id: deliveryId,
      orderId,
      branchId: BRANCH_ID,
      driverId: 'drv_del_stat_1',
      status: 'on_the_way'
    });

    const res = await request(app)
      .post(`/api/deliveries/${deliveryId}/status`)
      .set('Authorization', OWNER_TOKEN)
      .send({ status: 'arrived' });

    expect(res.status).toBe(200);
    expect(res.body.deliveryStatus).toBe('arrived');

    const delSnap = await db.collection('deliveries').doc(deliveryId).get();
    expect(delSnap.data()?.status).toBe('arrived');
    expect(delSnap.data()?.arrivedAt).toBeDefined();
  });

  // Test 5 — arrived → delivered
  it('Test 5 — arrived -> delivered: Successfully completes delivery, updates driver availability to available, and sets order to completed', async () => {
    const db = getAdminDb();
    const deliveryId = 'del_stat_test_005';
    const orderId = 'ord_stat_test_005';

    await db.collection('orders').doc(orderId).set({
      id: orderId,
      branchId: BRANCH_ID,
      status: 'confirmed',
      deliveryStatus: 'in_transit'
    });

    await db.collection('deliveries').doc(deliveryId).set({
      id: deliveryId,
      orderId,
      branchId: BRANCH_ID,
      driverId: 'drv_del_stat_1',
      status: 'arrived'
    });

    const res = await request(app)
      .post(`/api/deliveries/${deliveryId}/status`)
      .set('Authorization', OWNER_TOKEN)
      .send({ status: 'delivered' });

    expect(res.status).toBe(200);
    expect(res.body.deliveryStatus).toBe('delivered');

    // Verify delivery document
    const delSnap = await db.collection('deliveries').doc(deliveryId).get();
    expect(delSnap.data()?.status).toBe('delivered');
    expect(delSnap.data()?.deliveredAt).toBeDefined();

    // Verify driver availability restored to available
    const drvSnap = await db.collection('drivers').doc('drv_del_stat_1').get();
    expect(drvSnap.data()?.availability).toBe('available');

    // Verify order completed
    const ordSnap = await db.collection('orders').doc(orderId).get();
    expect(ordSnap.data()?.status).toBe('completed');
    expect(ordSnap.data()?.deliveryStatus).toBe('delivered');
  });

  // Test 6 — assigned → cancelled
  it('Test 6 — assigned -> cancelled: Successfully cancels assigned delivery and releases driver', async () => {
    const db = getAdminDb();
    const deliveryId = 'del_stat_test_006';
    const orderId = 'ord_stat_test_006';

    await db.collection('deliveries').doc(deliveryId).set({
      id: deliveryId,
      orderId,
      branchId: BRANCH_ID,
      driverId: 'drv_del_stat_1',
      status: 'assigned'
    });

    const res = await request(app)
      .post(`/api/deliveries/${deliveryId}/status`)
      .set('Authorization', OWNER_TOKEN)
      .send({ status: 'cancelled', failureReason: 'Customer requested cancellation' });

    expect(res.status).toBe(200);
    expect(res.body.deliveryStatus).toBe('cancelled');

    const delSnap = await db.collection('deliveries').doc(deliveryId).get();
    expect(delSnap.data()?.status).toBe('cancelled');
    expect(delSnap.data()?.failureReason).toBe('Customer requested cancellation');

    const drvSnap = await db.collection('drivers').doc('drv_del_stat_1').get();
    expect(drvSnap.data()?.availability).toBe('available');
  });

  // Test 7 — assigned → failed (Must remain REJECTED)
  it('Test 7 — assigned -> failed: Rejects invalid direct transition from assigned to failed', async () => {
    const db = getAdminDb();
    const deliveryId = 'del_stat_test_007';

    await db.collection('deliveries').doc(deliveryId).set({
      id: deliveryId,
      branchId: BRANCH_ID,
      driverId: 'drv_del_stat_1',
      status: 'assigned'
    });

    const res = await request(app)
      .post(`/api/deliveries/${deliveryId}/status`)
      .set('Authorization', OWNER_TOKEN)
      .send({ status: 'failed' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid delivery transition from "assigned" to "failed"/i);
    expect(res.body.error).toMatch(/accepted, cancelled/i);
  });

  // Test 8 — Transaction ordering (End-to-End lifecycle validation)
  it('Test 8 — Transaction ordering: Executes full lifecycle from assigned -> accepted -> picked_up -> on_the_way -> arrived -> delivered with zero read-after-write errors', async () => {
    const db = getAdminDb();
    const deliveryId = 'del_stat_test_008_e2e';
    const orderId = 'ord_stat_test_008_e2e';

    await db.collection('orders').doc(orderId).set({
      id: orderId,
      branchId: BRANCH_ID,
      status: 'confirmed',
      deliveryStatus: 'assigned'
    });

    await db.collection('deliveries').doc(deliveryId).set({
      id: deliveryId,
      orderId,
      branchId: BRANCH_ID,
      driverId: 'drv_del_stat_1',
      status: 'assigned'
    });

    // Step 1: accepted
    const r1 = await request(app).post(`/api/deliveries/${deliveryId}/status`).set('Authorization', OWNER_TOKEN).send({ status: 'accepted' });
    expect(r1.status).toBe(200);

    // Step 2: picked_up
    const r2 = await request(app).post(`/api/deliveries/${deliveryId}/status`).set('Authorization', OWNER_TOKEN).send({ status: 'picked_up' });
    expect(r2.status).toBe(200);

    // Step 3: on_the_way
    const r3 = await request(app).post(`/api/deliveries/${deliveryId}/status`).set('Authorization', OWNER_TOKEN).send({ status: 'on_the_way' });
    expect(r3.status).toBe(200);

    // Step 4: arrived
    const r4 = await request(app).post(`/api/deliveries/${deliveryId}/status`).set('Authorization', OWNER_TOKEN).send({ status: 'arrived' });
    expect(r4.status).toBe(200);

    // Step 5: delivered
    const r5 = await request(app).post(`/api/deliveries/${deliveryId}/status`).set('Authorization', OWNER_TOKEN).send({ status: 'delivered' });
    expect(r5.status).toBe(200);
  });

  // Test 9 — Kitchen completion on delivery order does not mark order as completed
  it('Test 9 — Kitchen completion on delivery order maps order to ready_for_pickup, NOT completed', async () => {
    const db = getAdminDb();
    const orderId = 'ord_del_kitch_009';
    const ticketId = 'ord_del_kitch_009';
    const delId = 'del_kitch_009';

    await db.collection('orders').doc(orderId).set({
      id: orderId,
      branchId: BRANCH_ID,
      orderType: 'delivery',
      status: 'confirmed',
      kitchenStatus: 'cooking'
    });

    await db.collection('kitchen_orders').doc(ticketId).set({
      id: ticketId,
      orderId,
      branchId: BRANCH_ID,
      orderType: 'delivery',
      prepStatus: 'cooking',
      items: [
        { productId: 'p1', productName: 'Pizza', quantity: 2, itemStatus: 'cooking' }
      ]
    });

    await db.collection('deliveries').doc(delId).set({
      id: delId,
      orderId,
      branchId: BRANCH_ID,
      status: 'assigned'
    });

    // Kitchen sets ready_for_pickup then completed
    const rReady = await request(app)
      .post(`/api/kitchen/${ticketId}/status`)
      .set('Authorization', OWNER_TOKEN)
      .send({ status: 'ready_for_pickup' });
    expect(rReady.status).toBe(200);

    const res = await request(app)
      .post(`/api/kitchen/${ticketId}/status`)
      .set('Authorization', OWNER_TOKEN)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);

    const ordSnap = await db.collection('orders').doc(orderId).get();
    expect(ordSnap.data()?.status).toBe('ready_for_pickup');
    expect(ordSnap.data()?.kitchenStatus).toBe('completed');
    expect(ordSnap.data()?.completedAt).toBeUndefined(); // Delivery not finished yet!
  });

  // Test 10 — Kitchen Station Status Update endpoint
  it('Test 10 — POST /api/kitchen/stations/:stationId/status updates station load and chef', async () => {
    const db = getAdminDb();
    const stationId = 'grill';

    const res = await request(app)
      .post(`/api/kitchen/stations/${stationId}/status`)
      .set('Authorization', OWNER_TOKEN)
      .send({
        status: 'overloaded',
        chefName: 'Chef Tariq'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const stSnap = await db.collection('stations').doc(stationId).get();
    expect(stSnap.data()?.status).toBe('overloaded');
    expect(stSnap.data()?.assignedChef).toBe('Chef Tariq');
  });
});
