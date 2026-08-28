import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { checkBranchAuthorization, isHQRoleOrClaim, validateUserPrivilegeUpdate, checkRoleAuthorization } from '../server/auth.js';
import { getAdminDb } from '../server/trustedFinancialBackend.js';

describe('POST-CLEANUP SECURITY RE-AUDIT MATRIX', () => {
  const db = getAdminDb();

  beforeEach(async () => {
    // Seed test branches
    await db.collection('branches').doc('branch_a').set({ id: 'branch_a', name: 'Branch A' });
    await db.collection('branches').doc('branch_b').set({ id: 'branch_b', name: 'Branch B' });
  });

  describe('1. P1 PREVIOUS SECURITY FINDINGS VERIFICATION', () => {
    it('P1-04: Rejects Branch Manager / Accountant from modifying Global Chart of Accounts', async () => {
      // Create global account as HQ Admin first
      const createRes = await request(app)
        .post('/api/accounting/accounts')
        .set('Authorization', 'Bearer test_token_owner')
        .send({
          code: '1010-GLOBAL',
          name: 'Global Central Vault',
          type: 'asset',
          branchId: 'all'
        });
      expect([200, 201]).toContain(createRes.status);
      const accId = createRes.body.id || '1010-GLOBAL';

      // Attempt update by Branch A Manager
      const updateRes = await request(app)
        .post(`/api/accounting/accounts/${accId}`)
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({
          name: 'Hacked Global Vault'
        });
      expect(updateRes.status).toBe(403);
      expect(updateRes.body.error).toMatch(/Global Chart of Accounts modification is restricted to Enterprise Owner and HQ Admin/i);
    });

    it('P1-06: Strictly DENIES Branch A Manager from creating, updating, or deleting Branch B rewards', async () => {
      // Seed Reward in Branch B
      await db.collection('customer_rewards').doc('rew_b_001').set({
        id: 'rew_b_001',
        rewardName: 'Branch B Free Shawarma',
        pointsRequired: 100,
        branchId: 'branch_b',
        discountType: 'fixed',
        discountValue: 10
      });

      // Branch A Manager tries to create reward for Branch B
      const createRes = await request(app)
        .post('/api/crm/rewards')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({
          rewardName: 'Branch B Unauthorized Reward',
          pointsRequired: 50,
          branchId: 'branch_b'
        });
      expect(createRes.status).toBe(403);
      expect(createRes.body.error).toMatch(/Unauthorized cross-branch transaction/i);

      // Branch A Manager tries to update Branch B reward
      const updateRes = await request(app)
        .post('/api/crm/rewards/rew_b_001/update')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({
          rewardName: 'Modified Reward'
        });
      expect(updateRes.status).toBe(403);
      expect(updateRes.body.error).toMatch(/Unauthorized cross-branch transaction/i);

      // Branch A Manager tries to delete Branch B reward
      const deleteRes = await request(app)
        .delete('/api/crm/rewards/rew_b_001')
        .set('Authorization', 'Bearer test_token_manager_branch_a');
      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.error).toMatch(/Unauthorized cross-branch transaction/i);
    });

    it('P1-07: Strictly DENIES Branch A Manager from creating, updating, or deleting Branch B coupons', async () => {
      // Seed Coupon in Branch B
      await db.collection('customer_coupons').doc('coup_b_001').set({
        id: 'coup_b_001',
        code: 'BRANCHB50',
        title: 'Branch B 50% Off',
        discountType: 'percentage',
        discountValue: 50,
        branchId: 'branch_b'
      });

      // Branch A Manager tries to create coupon for Branch B
      const createRes = await request(app)
        .post('/api/crm/coupons')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({
          code: 'UNAUTH_B',
          discountValue: 20,
          branchId: 'branch_b'
        });
      expect(createRes.status).toBe(403);
      expect(createRes.body.error).toMatch(/Unauthorized cross-branch transaction/i);

      // Branch A Manager tries to update Branch B coupon
      const updateRes = await request(app)
        .post('/api/crm/coupons/coup_b_001/update')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({
          title: 'Hacked Coupon'
        });
      expect(updateRes.status).toBe(403);
      expect(updateRes.body.error).toMatch(/Unauthorized cross-branch transaction/i);

      // Branch A Manager tries to delete Branch B coupon
      const deleteRes = await request(app)
        .delete('/api/crm/coupons/coup_b_001')
        .set('Authorization', 'Bearer test_token_manager_branch_a');
      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.error).toMatch(/Unauthorized cross-branch transaction/i);
    });
  });

  describe('2. P2 SECURITY & CRM/FINANCE TESTS', () => {
    it('P2-Taxes: Non-HQ user is denied from creating/updating Global Taxes', async () => {
      const createRes = await request(app)
        .post('/api/accounting/taxes')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({
          name: 'Unauthorized Global VAT',
          rate: 15,
          type: 'percentage'
        });
      expect(createRes.status).toBe(403);
      expect(createRes.body.error).toMatch(/Global Tax administration is restricted to Enterprise Owner and HQ Admin/i);
    });

    it('P2-CORS: Rejects malicious origin with 403 on preflight and omits allow-origin header', async () => {
      const maliciousRes = await request(app)
        .options('/api/pos/complete')
        .set('Origin', 'https://malicious-attacker.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(maliciousRes.status).toBe(403);
      expect(maliciousRes.headers['access-control-allow-origin']).toBeUndefined();

      // Allowed origin succeeds
      const allowedRes = await request(app)
        .options('/api/pos/complete')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(allowedRes.status).toBe(204);
      expect(allowedRes.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });

  describe('3. CROSS-BRANCH ATTACK MATRIX (Branch A Manager)', () => {
    const branchAUser = { role: 'Manager', branchId: 'branch_a' };

    it('Branch A Manager cannot access Branch B in checkBranchAuthorization', () => {
      const auth = checkBranchAuthorization(branchAUser, 'branch_b');
      expect(auth.authorized).toBe(false);
      expect(auth.error).toMatch(/Unauthorized cross-branch transaction/i);
    });

    it('Branch A Manager cannot use "all" to bypass branch restriction', () => {
      const auth = checkBranchAuthorization(branchAUser, 'all');
      expect(auth.authorized).toBe(false);
      expect(auth.error).toMatch(/Non-HQ user is not authorized for global "all" branch scope/i);
    });

    it('Branch A Admin cannot elevate user to Owner, grant Admin/isHQ, or move user branch', () => {
      const branchAAdmin = { role: 'Admin', branchId: 'branch_a' };
      const targetUser = { role: 'Cashier', branchId: 'branch_a' };

      // Try promote to Owner
      const promoteOwner = validateUserPrivilegeUpdate(branchAAdmin, targetUser, { role: 'Owner' });
      expect(promoteOwner.allowed).toBe(false);
      expect(promoteOwner.error).toMatch(/Admin cannot promote user to Owner/i);

      // Try grant isHQ
      const grantHQ = validateUserPrivilegeUpdate(branchAAdmin, targetUser, { isHQ: true });
      expect(grantHQ.allowed).toBe(false);
      expect(grantHQ.error).toMatch(/Admin cannot grant isHQ privilege/i);

      // Try move user across branches
      const moveBranch = validateUserPrivilegeUpdate(branchAAdmin, targetUser, { branchId: 'branch_b' });
      expect(moveBranch.allowed).toBe(false);
      expect(moveBranch.error).toMatch(/Admin cannot move user across branches/i);
    });
  });
});
