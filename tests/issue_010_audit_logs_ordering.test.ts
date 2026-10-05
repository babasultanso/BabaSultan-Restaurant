import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { getAdminDb } from '../server/trustedFinancialBackend.js';

describe('ISSUE 010 — Audit Logs Ordering (orderBy timestamp desc)', () => {
  const db = getAdminDb();
  const branchId = 'main_branch_01';

  beforeEach(async () => {
    await db.collection('branches').doc(branchId).set({ id: branchId, name: 'Main Flagship Branch' });
  });

  it('guarantees that newest logs are returned in descending chronological order and branch filtered', async () => {
    const ts = Date.now();

    // Insert an old log from 2024
    await db.collection('audit_logs').doc(`audit_old_${ts}`).set({
      id: `audit_old_${ts}`,
      action: 'OLD_EVENT',
      module: 'Legacy',
      details: 'Old record from 2024',
      branchId,
      timestamp: '2024-01-01T00:00:00.000Z'
    });

    // Insert a new log from 2026
    await db.collection('audit_logs').doc(`audit_new_${ts}`).set({
      id: `audit_new_${ts}`,
      action: 'NEW_RECENT_EVENT',
      module: 'Accounting',
      details: 'New record from 2026',
      branchId,
      timestamp: '2026-10-05T12:00:00.000Z'
    });

    // Insert a log belonging to a different branch
    await db.collection('audit_logs').doc(`audit_branch_b_${ts}`).set({
      id: `audit_branch_b_${ts}`,
      action: 'BRANCH_B_EVENT',
      module: 'Accounting',
      details: 'Branch B record',
      branchId: 'branch_b',
      timestamp: '2026-10-05T12:30:00.000Z'
    });

    // Query logs for main_branch_01
    const res = await request(app)
      .get(`/api/audit/logs?branchId=${branchId}&limit=10`)
      .set('Authorization', 'Bearer test_token_owner');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.logs)).toBe(true);

    const logs = res.body.logs;
    expect(logs.length).toBeGreaterThanOrEqual(1);

    // Verify ordering: newest log is first
    const newLogIndex = logs.findIndex((l: any) => l.id === `audit_new_${ts}`);
    const oldLogIndex = logs.findIndex((l: any) => l.id === `audit_old_${ts}`);
    expect(newLogIndex).toBeGreaterThanOrEqual(0);

    if (oldLogIndex >= 0) {
      expect(newLogIndex).toBeLessThan(oldLogIndex);
    }

    // Verify branch isolation: no branch_b logs returned
    const branchBFound = logs.some((l: any) => l.id === `audit_branch_b_${ts}`);
    expect(branchBFound).toBe(false);
  });
});
