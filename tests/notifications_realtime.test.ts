import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { ALLOWED_NOTIFICATION_TYPES } from '../server/trustedFinancialBackend.js';

// Mock Firebase Auth and Admin DB
vi.mock('../server/auth.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    authenticateTrustedUser: vi.fn(async (req, res) => {
      const authHeader = req.headers.authorization || '';
      if (authHeader.includes('driver_a')) {
        return {
          uid: 'driver_a_uid',
          email: 'drivera@babasultan.com',
          name: 'Driver A',
          role: 'Driver',
          branchId: 'main_branch_01'
        };
      }
      if (authHeader.includes('driver_b')) {
        return {
          uid: 'driver_b_uid',
          email: 'driverb@babasultan.com',
          name: 'Driver B',
          role: 'Driver',
          branchId: 'main_branch_01'
        };
      }
      if (authHeader.includes('manager')) {
        return {
          uid: 'manager_uid',
          email: 'manager@babasultan.com',
          name: 'Branch Manager',
          role: 'Manager',
          branchId: 'main_branch_01'
        };
      }
      res.status(401).json({ error: 'Unauthorized token' });
      return null;
    })
  };
});

const mockNotificationsStore: Record<string, any> = {
  'notif_001': {
    id: 'notif_001',
    recipientId: 'driver_a_uid',
    recipientType: 'driver',
    branchId: 'main_branch_01',
    deliveryId: 'del_101',
    orderId: 'ord_101',
    type: 'DELIVERY_ASSIGNED',
    title: 'New Delivery Assigned',
    message: 'Delivery #ord_101 assigned to you.',
    priority: 'high',
    read: false,
    createdAt: new Date().toISOString()
  }
};

const mockTokensStore: Record<string, any> = {};

vi.mock('../server/db.js', () => ({
  getAdminDb: vi.fn(() => ({
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          if (colName === 'notifications') {
            const data = mockNotificationsStore[docId];
            return { exists: Boolean(data), data: () => data };
          }
          if (colName === 'notification_tokens') {
            const data = mockTokensStore[docId];
            return { exists: Boolean(data), data: () => data };
          }
          return { exists: false, data: () => undefined };
        },
        set: async (data: any, options?: any) => {
          if (colName === 'notification_tokens') {
            mockTokensStore[docId] = { ...(mockTokensStore[docId] || {}), ...data };
            return true;
          }
          if (colName === 'notifications') {
            mockNotificationsStore[docId] = { ...(mockNotificationsStore[docId] || {}), ...data };
            return true;
          }
        },
        update: async (data: any) => {
          if (colName === 'notifications' && mockNotificationsStore[docId]) {
            Object.assign(mockNotificationsStore[docId], data);
            return true;
          }
        }
      })
    })
  }))
}));

describe('REALTIME NOTIFICATIONS & DISPATCH INTEGRATION TESTS', () => {
  it('allows authenticated driver to register FCM device token', async () => {
    const res = await request(app)
      .post('/api/notifications/register-device')
      .set('Authorization', 'Bearer driver_a')
      .send({ token: 'fcm_token_sample_12345' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.userId).toBe('driver_a_uid');
    expect(mockTokensStore['driver_a_uid']?.fcmToken).toBe('fcm_token_sample_12345');
  });

  it('rejects device token registration without token string', async () => {
    const res = await request(app)
      .post('/api/notifications/register-device')
      .set('Authorization', 'Bearer driver_a')
      .send({ token: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  it('allows notification recipient to mark notification as read', async () => {
    const res = await request(app)
      .post('/api/notifications/notif_001/read')
      .set('Authorization', 'Bearer driver_a')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(mockNotificationsStore['notif_001'].read).toBe(true);
  });

  it('allows branch manager to mark notification as read for their branch', async () => {
    mockNotificationsStore['notif_002'] = {
      id: 'notif_002',
      recipientId: 'driver_b_uid',
      branchId: 'main_branch_01',
      read: false
    };

    const res = await request(app)
      .post('/api/notifications/notif_002/read')
      .set('Authorization', 'Bearer manager')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('prevents unauthorized driver B from marking driver A notification read even in same branch', async () => {
    mockNotificationsStore['notif_same_branch'] = {
      id: 'notif_same_branch',
      recipientId: 'driver_a_uid',
      branchId: 'main_branch_01', // Same branch as driver B
      read: false
    };

    const res = await request(app)
      .post('/api/notifications/notif_same_branch/read')
      .set('Authorization', 'Bearer driver_b')
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Access Denied');
  });

  it('prevents unauthorized driver B from marking driver A notification read in different branch', async () => {
    mockNotificationsStore['notif_003'] = {
      id: 'notif_003',
      recipientId: 'driver_a_uid',
      branchId: 'other_branch_99',
      read: false
    };

    const res = await request(app)
      .post('/api/notifications/notif_003/read')
      .set('Authorization', 'Bearer driver_b')
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Access Denied');
  });

  it('verifies notification types allowlist', () => {
    expect(ALLOWED_NOTIFICATION_TYPES.has('DELIVERY_ASSIGNED')).toBe(true);
    expect(ALLOWED_NOTIFICATION_TYPES.has('ORDER_CREATED')).toBe(true);
    expect(ALLOWED_NOTIFICATION_TYPES.has('KITCHEN_NEW_ORDER')).toBe(true);
  });

  it('enforces single active device FCM token registration per user', async () => {
    // Initial token registration
    await request(app)
      .post('/api/notifications/register-device')
      .set('Authorization', 'Bearer driver_a')
      .send({ token: 'initial_device_token_111' });

    expect(mockTokensStore['driver_a_uid']?.fcmToken).toBe('initial_device_token_111');

    // Register new device token for same driver replaces previous token
    await request(app)
      .post('/api/notifications/register-device')
      .set('Authorization', 'Bearer driver_a')
      .send({ token: 'updated_device_token_222' });

    expect(mockTokensStore['driver_a_uid']?.fcmToken).toBe('updated_device_token_222');
  });
});
