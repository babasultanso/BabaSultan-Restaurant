import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { getAdminDb } from '../server/trustedFinancialBackend.js';

describe('ISSUE 002 — Accounting Period IDOR & Branch Isolation Suite', () => {
  const db = getAdminDb();

  beforeEach(async () => {
    await db.collection('branches').doc('branch_a').set({ id: 'branch_a', name: 'Branch A' });
    await db.collection('branches').doc('branch_b').set({ id: 'branch_b', name: 'Branch B' });
  });

  it('1. branch A -> own period = allowed (200)', async () => {
    const periodId = `period_branch_a_2026_q1_${Date.now()}`;
    const res = await request(app)
      .post('/api/accounting/periods')
      .set('Authorization', 'Bearer test_token_accountant_branch_a')
      .set('Idempotency-Key', `period-create-own-${Date.now()}`)
      .send({
        periodData: {
          id: periodId,
          name: 'Branch A 2026 Q1',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          status: 'Open',
          branchId: 'branch_a'
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.period.id).toBe(periodId);
    expect(res.body.period.branchId).toBe('branch_a');
  });

  it('2. branch A -> branch B period = 403 Forbidden', async () => {
    // Seed a period belonging to branch B
    const periodBId = `period_branch_b_2026_q1_${Date.now()}`;
    await db.collection('accounting_periods').doc(periodBId).set({
      id: periodBId,
      name: 'Branch B 2026 Q1',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      status: 'Open',
      branchId: 'branch_b',
      createdAt: new Date().toISOString()
    });

    // Branch A user tries to modify Branch B's period
    const res = await request(app)
      .post('/api/accounting/periods')
      .set('Authorization', 'Bearer test_token_accountant_branch_a')
      .set('Idempotency-Key', `period-hack-branch-b-${Date.now()}`)
      .send({
        periodData: {
          id: periodBId,
          name: 'Branch B Hacked',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          status: 'Closed',
          branchId: 'branch_a'
        }
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/unauthorized|access denied/i);
  });

  it('3. branch A -> all period = policy enforced (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/accounting/periods')
      .set('Authorization', 'Bearer test_token_accountant_branch_a')
      .set('Idempotency-Key', `period-global-attempt-${Date.now()}`)
      .send({
        periodData: {
          name: 'Global Period 2026',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          status: 'Open',
          branchId: 'all'
        }
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Only HQ Owner\/Admin can manage global \("all"\) accounting periods/i);
  });

  it('4. branchId change on existing period = rejected (400)', async () => {
    // Owner creates a period for branch A
    const periodId = `period_branch_a_transfer_${Date.now()}`;
    await db.collection('accounting_periods').doc(periodId).set({
      id: periodId,
      name: 'Transfer Test Period',
      startDate: '2026-04-01',
      endDate: '2026-06-30',
      status: 'Open',
      branchId: 'branch_a',
      createdAt: new Date().toISOString()
    });

    // Even HQ owner tries to transfer an existing period from branch_a to branch_b
    const res = await request(app)
      .post('/api/accounting/periods')
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `period-transfer-attempt-${Date.now()}`)
      .send({
        periodData: {
          id: periodId,
          name: 'Transfer Test Period Moved',
          startDate: '2026-04-01',
          endDate: '2026-06-30',
          status: 'Open',
          branchId: 'branch_b'
        }
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot transfer accounting period across branches/i);
  });

  it('5. Locked period: non-HQ cannot modify/reopen (403), HQ Owner can reopen (200)', async () => {
    const periodId = `period_locked_${Date.now()}`;
    await db.collection('accounting_periods').doc(periodId).set({
      id: periodId,
      name: 'Locked Branch A Period',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      status: 'Locked',
      branchId: 'branch_a',
      createdAt: new Date().toISOString()
    });

    // Branch A accountant attempts to reopen a locked period -> 403
    const managerRes = await request(app)
      .post(`/api/accounting/periods/${periodId}/status`)
      .set('Authorization', 'Bearer test_token_accountant_branch_a')
      .set('Idempotency-Key', `reopen-locked-mgr-${Date.now()}`)
      .send({ status: 'Open' });

    expect(managerRes.status).toBe(403);
    expect(managerRes.body.error).toMatch(/Locked accounting periods can only be reopened by HQ Owner or Admin/i);

    // HQ Owner reopens -> 200
    const ownerRes = await request(app)
      .post(`/api/accounting/periods/${periodId}/status`)
      .set('Authorization', 'Bearer test_token_owner')
      .set('Idempotency-Key', `reopen-locked-owner-${Date.now()}`)
      .send({ status: 'Open' });

    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.period.status).toBe('Open');
  });

  it('6. Status change endpoint /api/accounting/periods/:id/status enforces existingData.branchId (403 for cross-branch)', async () => {
    const periodId = `period_cross_status_${Date.now()}`;
    await db.collection('accounting_periods').doc(periodId).set({
      id: periodId,
      name: 'Branch B Period',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      status: 'Open',
      branchId: 'branch_b',
      createdAt: new Date().toISOString()
    });

    // Branch A user tries to close Branch B period
    const res = await request(app)
      .post(`/api/accounting/periods/${periodId}/status`)
      .set('Authorization', 'Bearer test_token_accountant_branch_a')
      .set('Idempotency-Key', `close-cross-${Date.now()}`)
      .send({ status: 'Closed' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/unauthorized|access denied/i);
  });
});
