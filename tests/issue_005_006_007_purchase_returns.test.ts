import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { getAdminDb } from '../server/trustedFinancialBackend.js';

describe('ISSUES 005, 006, 007 — Purchase Return Integrity, Supplier Linkage & Server Valuation', () => {
  const db = getAdminDb();
  const branchId = 'main_branch_01';

  beforeEach(async () => {
    await db.collection('branches').doc(branchId).set({ id: branchId, name: 'Main Flagship Branch' });
  });

  it('ISSUE 005: rejects return if quantity exceeds PO received quantity or repeated returns exceed received', async () => {
    const ts = Date.now();
    const supId = `sup_pr_${ts}`;
    const itemId = `inv_pr_${ts}`;
    const poId = `po_pr_${ts}`;

    await db.collection('suppliers').doc(supId).set({
      id: supId,
      name: 'Purity Goods Ltd',
      branchId,
      outstandingBalance: 1000,
      pendingAmount: 1000
    });

    await db.collection('inventory').doc(itemId).set({
      id: itemId,
      itemName: 'Flour 50kg',
      itemCode: 'FLR-50',
      currentQuantity: 20,
      costPrice: 25,
      purchaseCost: 25,
      unit: 'bag',
      branchId,
      status: 'in_stock'
    });

    // PO had 10 received
    await db.collection('purchase_orders').doc(poId).set({
      id: poId,
      poNumber: `PO-TEST-${ts}`,
      supplierId: supId,
      supplierName: 'Purity Goods Ltd',
      branchId,
      status: 'received',
      items: [
        {
          itemId,
          itemName: 'Flour 50kg',
          quantity: 10,
          receivedQuantity: 10,
          returnedQuantity: 0,
          unitCost: 25
        }
      ]
    });

    // 1. Attempt returning 11 (exceeds 10 received) -> must be rejected
    const rejectExcessRes = await request(app)
      .post('/api/purchases/returns')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `pr-excess-${ts}`)
      .send({
        itemId,
        poId,
        supplierId: supId,
        quantity: 11,
        branchId
      });

    expect(rejectExcessRes.status).toBe(400);
    expect(rejectExcessRes.body.error).toMatch(/exceeds remaining returnable quantity/i);

    // 2. Return 6 (less than received 10) -> allowed
    const allowFirstRes = await request(app)
      .post('/api/purchases/returns')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `pr-first-part-${ts}`)
      .send({
        itemId,
        poId,
        supplierId: supId,
        quantity: 6,
        branchId
      });

    expect(allowFirstRes.status).toBe(200);

    // 3. Repeated return: attempt returning 5 (remaining returnable is only 4) -> must be rejected
    const rejectSecondExcessRes = await request(app)
      .post('/api/purchases/returns')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `pr-second-excess-${ts}`)
      .send({
        itemId,
        poId,
        supplierId: supId,
        quantity: 5,
        branchId
      });

    expect(rejectSecondExcessRes.status).toBe(400);
    expect(rejectSecondExcessRes.body.error).toMatch(/exceeds remaining returnable quantity/i);

    // 4. Return exact remaining (4) -> allowed
    const allowSecondRes = await request(app)
      .post('/api/purchases/returns')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `pr-second-exact-${ts}`)
      .send({
        itemId,
        poId,
        supplierId: supId,
        quantity: 4,
        branchId
      });

    expect(allowSecondRes.status).toBe(200);
  });

  it('ISSUE 006: rejects purchase return if supplier does not exist or PO supplier mismatches', async () => {
    const ts = Date.now();
    const itemId = `inv_sup_mismatch_${ts}`;
    const poId = `po_sup_mismatch_${ts}`;

    await db.collection('inventory').doc(itemId).set({
      id: itemId,
      itemName: 'Cooking Oil 20L',
      currentQuantity: 10,
      costPrice: 40,
      unit: 'jerrycan',
      branchId,
      status: 'in_stock'
    });

    // 1. Without any supplier or PO -> rejected
    const noSupRes = await request(app)
      .post('/api/purchases/returns')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `pr-nosup-${ts}`)
      .send({
        itemId,
        quantity: 2,
        branchId
      });

    expect(noSupRes.status).toBe(400);
    expect(noSupRes.body.error).toMatch(/supplierId is required/i);

    // 2. With non-existent supplier -> rejected 404
    const nonExistentSupRes = await request(app)
      .post('/api/purchases/returns')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `pr-badsup-${ts}`)
      .send({
        itemId,
        supplierId: 'sup_phantom_9999',
        quantity: 2,
        branchId
      });

    expect(nonExistentSupRes.status).toBe(404);
    expect(nonExistentSupRes.body.error).toMatch(/not found/i);

    // 3. PO belongs to Supplier A, but user provides Supplier B -> rejected 400
    await db.collection('suppliers').doc(`sup_a_${ts}`).set({ id: `sup_a_${ts}`, name: 'Supplier A', branchId });
    await db.collection('suppliers').doc(`sup_b_${ts}`).set({ id: `sup_b_${ts}`, name: 'Supplier B', branchId });

    await db.collection('purchase_orders').doc(poId).set({
      id: poId,
      supplierId: `sup_a_${ts}`,
      branchId,
      items: [{ itemId, quantity: 5, receivedQuantity: 5, returnedQuantity: 0, unitCost: 40 }]
    });

    const mismatchRes = await request(app)
      .post('/api/purchases/returns')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `pr-mismatch-${ts}`)
      .send({
        itemId,
        poId,
        supplierId: `sup_b_${ts}`,
        quantity: 2,
        branchId
      });

    expect(mismatchRes.status).toBe(400);
    expect(mismatchRes.body.error).toMatch(/does not match return supplier/i);

    // 4. Cross-branch supplier: supplier belongs to branch_b, user is on main_branch_01 -> rejected 403
    await db.collection('suppliers').doc(`sup_branch_b_${ts}`).set({
      id: `sup_branch_b_${ts}`,
      name: 'Supplier Branch B',
      branchId: 'branch_b'
    });

    const crossBranchSupRes = await request(app)
      .post('/api/purchases/returns')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `pr-cross-sup-${ts}`)
      .send({
        itemId,
        supplierId: `sup_branch_b_${ts}`,
        quantity: 1,
        branchId: 'main_branch_01'
      });

    expect(crossBranchSupRes.status).toBe(403);
    expect(crossBranchSupRes.body.error).toMatch(/Unauthorized cross-branch purchase return/i);

    // 5. Invalid/non-existent PO ID -> rejected 404
    const badPoRes = await request(app)
      .post('/api/purchases/returns')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `pr-bad-po-${ts}`)
      .send({
        itemId,
        poId: 'po_phantom_99999',
        supplierId: `sup_a_${ts}`,
        quantity: 1,
        branchId: 'main_branch_01'
      });

    expect(badPoRes.status).toBe(404);
    expect(badPoRes.body.error).toMatch(/Purchase order "po_phantom_99999" not found/i);
  });

  it('ISSUE 007: client-supplied unitCost is strictly ignored in favor of server-authoritative valuation', async () => {
    const ts = Date.now();
    const supId = `sup_val_${ts}`;
    const itemId = `inv_val_${ts}`;
    const poId = `po_val_${ts}`;

    await db.collection('suppliers').doc(supId).set({
      id: supId,
      name: 'Authoritative Valuation Supplier',
      branchId,
      outstandingBalance: 1000,
      pendingAmount: 1000
    });

    // Authoritative cost is $15 per unit in inventory and PO
    await db.collection('inventory').doc(itemId).set({
      id: itemId,
      itemName: 'Sugar 50kg',
      currentQuantity: 10,
      costPrice: 15,
      purchaseCost: 15,
      unit: 'bag',
      branchId,
      status: 'in_stock'
    });

    await db.collection('purchase_orders').doc(poId).set({
      id: poId,
      supplierId: supId,
      branchId,
      items: [{ itemId, quantity: 5, receivedQuantity: 5, returnedQuantity: 0, unitCost: 15 }]
    });

    // Client maliciously passes unitCost = $9999
    const res = await request(app)
      .post('/api/purchases/returns')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `pr-tamper-${ts}`)
      .send({
        itemId,
        poId,
        supplierId: supId,
        quantity: 2,
        unitCost: 9999, // Tampered client value
        branchId
      });

    expect(res.status).toBe(200);

    // Verify movement totalCost is 2 * $15 = $30 (NOT 2 * $9999 = $19998)
    const movementsSnap = await db.collection('inventory_movements')
      .where('itemId', '==', itemId)
      .where('type', '==', 'purchase_return')
      .get();

    expect(movementsSnap.empty).toBe(false);
    const mov = movementsSnap.docs[0].data();
    expect(mov.unitCost).toBe(15);
    expect(mov.totalCost).toBe(30);

    // Verify supplier balance was deducted by $30, not $19998
    const supSnap = await db.collection('suppliers').doc(supId).get();
    expect(supSnap.data()?.outstandingBalance).toBe(970); // 1000 - 30
  });
});
