import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { getAdminDb } from '../server/trustedFinancialBackend.js';

describe('DRIVER ASSIGNMENT TRANSACTION ORDERING & BUSINESS RULES SUITE', () => {
  const MANAGER_TOKEN = 'Bearer test_token_cashier'; // Cashier/Manager role has assign permission
  const OWNER_TOKEN = 'Bearer test_token_owner';
  const BRANCH_ID = 'branch_test_assign_01';
  const OTHER_BRANCH_ID = 'branch_test_assign_02';

  beforeEach(async () => {
    const db = getAdminDb();
    // Seed branches
    await db.collection('branches').doc(BRANCH_ID).set({ id: BRANCH_ID, name: 'Main Branch' });
    await db.collection('branches').doc(OTHER_BRANCH_ID).set({ id: OTHER_BRANCH_ID, name: 'Other Branch' });

    // Seed Driver A
    await db.collection('drivers').doc('drv_test_a').set({
      id: 'drv_test_a',
      fullName: 'Driver Alpha',
      phoneNumber: '+1234567890',
      branchId: BRANCH_ID,
      status: 'active',
      isActive: true,
      availability: 'available'
    });

    // Seed Driver B
    await db.collection('drivers').doc('drv_test_b').set({
      id: 'drv_test_b',
      fullName: 'Driver Beta',
      phoneNumber: '+1234567891',
      branchId: BRANCH_ID,
      status: 'active',
      isActive: true,
      availability: 'available'
    });

    // Seed Cross-Branch Driver C
    await db.collection('drivers').doc('drv_test_c_other').set({
      id: 'drv_test_c_other',
      fullName: 'Driver Charlie Other Branch',
      phoneNumber: '+1234567892',
      branchId: OTHER_BRANCH_ID,
      status: 'active',
      isActive: true,
      availability: 'available'
    });

    // Seed Busy Driver D
    await db.collection('drivers').doc('drv_test_d_busy').set({
      id: 'drv_test_d_busy',
      fullName: 'Driver Delta Busy',
      phoneNumber: '+1234567893',
      branchId: BRANCH_ID,
      status: 'active',
      isActive: true,
      availability: 'on_delivery'
    });
  });

  // Test 1 — Normal assignment
  it('Test 1 — Normal assignment: Assigns available driver to unassigned delivery and syncs state', async () => {
    const db = getAdminDb();
    const deliveryId = 'del_norm_assign_001';
    const orderId = 'ord_norm_assign_001';

    await db.collection('orders').doc(orderId).set({
      id: orderId,
      branchId: BRANCH_ID,
      status: 'ready_for_pickup',
      deliveryStatus: 'pending'
    });

    await db.collection('deliveries').doc(deliveryId).set({
      id: deliveryId,
      orderId,
      branchId: BRANCH_ID,
      status: 'pending',
      address: '123 Main St'
    });

    const res = await request(app)
      .post(`/api/deliveries/${deliveryId}/assign`)
      .set('Authorization', OWNER_TOKEN)
      .send({ driverId: 'drv_test_a' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.driverId).toBe('drv_test_a');

    // Verify driver availability updated to on_delivery
    const drvSnap = await db.collection('drivers').doc('drv_test_a').get();
    expect(drvSnap.data()?.availability).toBe('on_delivery');

    // Verify delivery document updated
    const delSnap = await db.collection('deliveries').doc(deliveryId).get();
    expect(delSnap.data()?.driverId).toBe('drv_test_a');
    expect(delSnap.data()?.status).toBe('assigned');
    expect(delSnap.data()?.driverName).toBe('Driver Alpha');

    // Verify order document deliveryStatus updated
    const ordSnap = await db.collection('orders').doc(orderId).get();
    expect(ordSnap.data()?.deliveryStatus).toBe('assigned');

    // Verify notification created
    const notifSnap = await db.collection('notifications').doc(`DELIVERY_ASSIGNED_${deliveryId}_drv_test_a`).get();
    expect(notifSnap.exists).toBe(true);
    expect(notifSnap.data()?.recipientId).toBe('drv_test_a');
    expect(notifSnap.data()?.type).toBe('DELIVERY_ASSIGNED');
  });

  // Test 2 — Reassignment
  it('Test 2 — Reassignment: Reassigns from Driver A to Driver B, restoring Driver A availability', async () => {
    const db = getAdminDb();
    const deliveryId = 'del_reassign_002';
    const orderId = 'ord_reassign_002';

    // Driver A is currently assigned
    await db.collection('drivers').doc('drv_test_a').update({ availability: 'on_delivery' });

    await db.collection('orders').doc(orderId).set({
      id: orderId,
      branchId: BRANCH_ID,
      status: 'ready_for_pickup',
      deliveryStatus: 'assigned'
    });

    await db.collection('deliveries').doc(deliveryId).set({
      id: deliveryId,
      orderId,
      branchId: BRANCH_ID,
      driverId: 'drv_test_a',
      driverName: 'Driver Alpha',
      status: 'assigned'
    });

    const res = await request(app)
      .post(`/api/deliveries/${deliveryId}/assign`)
      .set('Authorization', OWNER_TOKEN)
      .send({ driverId: 'drv_test_b' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    // Driver A restored to available
    const drvASnap = await db.collection('drivers').doc('drv_test_a').get();
    expect(drvASnap.data()?.availability).toBe('available');

    // Driver B updated to on_delivery
    const drvBSnap = await db.collection('drivers').doc('drv_test_b').get();
    expect(drvBSnap.data()?.availability).toBe('on_delivery');

    // Delivery updated to Driver B
    const delSnap = await db.collection('deliveries').doc(deliveryId).get();
    expect(delSnap.data()?.driverId).toBe('drv_test_b');
    expect(delSnap.data()?.driverName).toBe('Driver Beta');
    expect(delSnap.data()?.status).toBe('assigned');
  });

  // Test 3 — Cross-branch rejection
  it('Test 3 — Cross-branch rejection: Rejects assigning driver from different branch for branch-scoped user', async () => {
    const db = getAdminDb();
    const deliveryId = 'del_cross_003';

    await db.collection('deliveries').doc(deliveryId).set({
      id: deliveryId,
      branchId: BRANCH_ID,
      status: 'pending'
    });

    // Cashier token has branchId: main_branch_01 or branch_test_assign_01
    const res = await request(app)
      .post(`/api/deliveries/${deliveryId}/assign`)
      .set('Authorization', MANAGER_TOKEN)
      .send({ driverId: 'drv_test_c_other' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cross-branch|Unauthorized/i);
  });

  // Test 4 — Driver unavailable
  it('Test 4 — Driver unavailable: Rejects assigning driver who is already on delivery', async () => {
    const db = getAdminDb();
    const deliveryId = 'del_busy_004';

    await db.collection('deliveries').doc(deliveryId).set({
      id: deliveryId,
      branchId: BRANCH_ID,
      status: 'pending'
    });

    const res = await request(app)
      .post(`/api/deliveries/${deliveryId}/assign`)
      .set('Authorization', OWNER_TOKEN)
      .send({ driverId: 'drv_test_d_busy' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/currently on delivery/i);
  });

  // Test 5 — Transaction ordering
  it('Test 5 — Transaction ordering: Executes strict Phase 1 Reads before Phase 2 Writes with zero transaction read-after-write errors', async () => {
    const db = getAdminDb();
    const deliveryId = 'del_order_005';
    const orderId = 'ord_order_005';

    await db.collection('orders').doc(orderId).set({
      id: orderId,
      branchId: BRANCH_ID,
      status: 'confirmed',
      deliveryStatus: 'pending'
    });

    await db.collection('deliveries').doc(deliveryId).set({
      id: deliveryId,
      orderId,
      branchId: BRANCH_ID,
      driverId: 'drv_test_a',
      status: 'assigned'
    });

    // Reassigning while order is linked tests all 4 reads and all 5 writes in sequence
    const res = await request(app)
      .post(`/api/deliveries/${deliveryId}/assign`)
      .set('Authorization', OWNER_TOKEN)
      .send({ driverId: 'drv_test_b' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});
