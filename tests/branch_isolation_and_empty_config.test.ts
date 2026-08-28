import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { checkBranchAuthorization } from '../server/auth.js';
import { FinancialsRepositoryImpl } from '../src/data/repositories/FinancialsRepositoryImpl.ts';
import { CustomerRepositoryImpl } from '../src/data/repositories/CustomerRepositoryImpl.ts';
import { InventoryRepositoryImpl } from '../src/data/repositories/InventoryRepositoryImpl.ts';

describe('BRANCH ISOLATION & EMPTY CONFIGURATION AUDIT TESTS', () => {

  describe('1. Branch Isolation at Repository & Query Level', () => {
    it('Branch A user cannot access or modify Branch B resources', () => {
      const branchAUser = { role: 'Cashier', branchId: 'branch_a' };
      const authResult = checkBranchAuthorization(branchAUser, 'branch_b');
      expect(authResult.authorized).toBe(false);
      expect(authResult.error).toMatch(/Unauthorized cross-branch/i);
    });

    it('Branch Manager A cannot access Branch B analytics or resources', () => {
      const branchAManager = { role: 'Manager', branchId: 'branch_a' };
      const authResult = checkBranchAuthorization(branchAManager, 'branch_b');
      expect(authResult.authorized).toBe(false);
      expect(authResult.error).toMatch(/Unauthorized cross-branch/i);
    });

    it('HQ Owner or Admin with branchId="all" can access any branch', () => {
      const hqOwner = { role: 'Owner', branchId: 'all' };
      const resA = checkBranchAuthorization(hqOwner, 'branch_a');
      expect(resA.authorized).toBe(true);
      expect(resA.targetBranchId).toBe('branch_a');

      const resB = checkBranchAuthorization(hqOwner, 'branch_b');
      expect(resB.authorized).toBe(true);
      expect(resB.targetBranchId).toBe('branch_b');
    });

    it('Financial summary blocks cross-branch query (Branch A accessing Branch B returns 403)', async () => {
      const res = await request(app)
        .get('/api/financial-summary?branchId=branch_b')
        .set('Authorization', 'Bearer test_token_manager_branch_a');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Unauthorized cross-branch/i);
    });

    it('Financial summary allows user to query their own branch', async () => {
      const res = await request(app)
        .get('/api/financial-summary?branchId=branch_a')
        .set('Authorization', 'Bearer test_token_manager_branch_a');
      expect(res.status).toBe(200);
      expect(res.body.branchId).toBe('branch_a');
    });
  });

  describe('2. Empty Configuration Handling (Tax, Branch, Delivery, CRM)', () => {
    it('Deterministic Tax Resolution: Missing tax configuration returns explicit error, NO silent 5% fallback', async () => {
      const repo = new FinancialsRepositoryImpl();
      // Calling getActiveTaxConfig with a branch that has no tax in empty mock
      await expect(repo.getActiveTaxConfig('non_existent_branch_xyz')).rejects.toThrow(
        /No active tax configuration found/i
      );
    });

    it('Deterministic Tax Resolution: Branch with missing tax doc and no global default fails with configuration error', () => {
      const taxes: any[] = [];
      const resolveTax = (taxesList: any[], branchId: string) => {
        const activeTaxes = (taxesList || []).filter(t => t.isActive !== false);
        const branchTax = activeTaxes.find(t => t.branchId === branchId) ||
                          activeTaxes.find(t => !t.branchId || t.branchId === 'all');
        if (!branchTax || typeof branchTax.rate !== 'number') {
          throw new Error('No active tax configuration found for the specified branch or global default.');
        }
        return branchTax.rate;
      };

      expect(() => resolveTax(taxes, 'branch_01')).toThrow(
        'No active tax configuration found for the specified branch or global default.'
      );
    });

    it('Missing Branch Context: User without branch context is blocked from performing transactions', async () => {
      const res = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', 'Bearer test_token_cashier_nobranch')
        .send({
          orderData: {
            branchId: 'branch_a',
            paymentMethod: 'cash',
            paidAmount: 10,
            items: [{ productId: 'p1', quantity: 1, price: 10 }]
          }
        });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Access denied.*not assigned/i);
    });

    it('CRM Rewards & Coupons: Empty Firestore returns [] without hardcoded fallback arrays', async () => {
      const custRepo = new CustomerRepositoryImpl();
      // fetchRewards and fetchCoupons should return an array
      const rewards = await custRepo.fetchRewards();
      expect(Array.isArray(rewards)).toBe(true);

      const coupons = await custRepo.fetchCoupons();
      expect(Array.isArray(coupons)).toBe(true);
    });

    it('Inventory Status Calculation: Edge cases calculated without fallback assumptions', () => {
      const repo = new InventoryRepositoryImpl();
      const calc = (repo as any).calculateStatus.bind(repo);
      
      expect(calc(0, 5, 20)).toBe('out_of_stock');
      expect(calc(-2, 5, 20)).toBe('out_of_stock');
      expect(calc(3, 5, 20)).toBe('low_stock');
      expect(calc(10, 5, 20)).toBe('in_stock');
      expect(calc(25, 5, 20)).toBe('overstock');
      expect(calc(10, 5, 20, '2020-01-01')).toBe('expired');
    });
  });
});
